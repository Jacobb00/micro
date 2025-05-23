const Order = require('../models/Order');
const logger = require('../config/logger');
const { getChannel } = require('../config/rabbitmq');
const axios = require('axios');
const orderRedisCache = require('../redis');

/**
 * Get order by ID
 */
const getOrderById = async (orderId) => {
  try {
    // Cache'den kontrol et
    const cachedOrder = await orderRedisCache.getOrder(orderId);
    if (cachedOrder) {
      logger.info(`Order ${orderId} cache'den getirildi`);
      return cachedOrder;
    }

    // Cache miss - veritabanından getir
    const order = await Order.findById(orderId);
    
    // Cache'e kaydet (30 dakika TTL)
    if (order) {
      await orderRedisCache.cacheOrder(orderId, order, 1800);
    }
    
    return order;
  } catch (error) {
    logger.error(`Error fetching order: ${error.message}`);
    throw error;
  }
};

/**
 * Get all orders for a user
 */
const getOrdersByUserId = async (userId) => {
  try {
    return await orderRedisCache.cacheFunction(
      `user:orders:${userId}`,
      async () => {
        const orders = await Order.find({ userId }).sort({ createdAt: -1 });
        return orders;
      },
      900 // 15 dakika cache
    );
  } catch (error) {
    logger.error(`Error fetching user orders: ${error.message}`);
    throw error;
  }
};

/**
 * Get all orders
 */
const getAllOrders = async () => {
  try {
    return await orderRedisCache.cacheFunction(
      'orders:all',
      async () => {
        const orders = await Order.find().sort({ createdAt: -1 });
        return orders;
      },
      600 // 10 dakika cache (admin verisi)
    );
  } catch (error) {
    logger.error(`Error fetching all orders: ${error.message}`);
    throw error;
  }
};

/**
 * Create a new order
 */
const createOrder = async (orderData) => {
  try {
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newOrder = new Order({
      ...orderData,
      orderNumber,
      status: 'PENDING'
    });
    
    const savedOrder = await newOrder.save();
    
    // Cache invalidation - yeni sipariş eklendi
    await orderRedisCache.del(`user:orders:${orderData.userId}`);
    await orderRedisCache.del('orders:all');
    // Yeni siparişi cache'le
    await orderRedisCache.cacheOrder(savedOrder._id, savedOrder, 1800);
    await orderRedisCache.cacheOrderStatus(savedOrder._id, 'PENDING', 1800);
    
    // Publish to RabbitMQ
    const channel = getChannel();
    channel.sendToQueue(
      'order.created',
      Buffer.from(JSON.stringify(savedOrder)),
      { persistent: true }
    );
    
    logger.info(`New order created: ${savedOrder._id}`);
    return savedOrder;
  } catch (error) {
    logger.error(`Error creating order: ${error.message}`);
    throw error;
  }
};

/**
 * Update order status
 */
const updateOrderStatus = async (orderId, status, note) => {
  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // If we're canceling an order, we need to rollback stock
    if (status === 'CANCELED' && order.status !== 'CANCELED') {
      // Notify stock service to increase back quantities
      const channel = getChannel();
      channel.sendToQueue(
        'stock.rollback',
        Buffer.from(JSON.stringify({ orderId: order._id, items: order.items })),
        { persistent: true }
      );
      logger.info(`Stock rollback requested for order: ${order._id} from status ${order.status}`);
    }
    
    // Update the order status
    await order.updateStatus(status, note);
    
    // Cache invalidation - sipariş güncellendi
    await orderRedisCache.deleteOrder(orderId);
    await orderRedisCache.del(`user:orders:${order.userId}`);
    await orderRedisCache.del('orders:all');
    await orderRedisCache.cacheOrderStatus(orderId, status, 1800); // Yeni status'u cache'le
    
    // Publish status change event
    const channel = getChannel();
    channel.sendToQueue(
      'order.status.changed',
      Buffer.from(JSON.stringify({ 
        orderId: order._id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        oldStatus: order.statusHistory[order.statusHistory.length - 2]?.status,
        newStatus: status,
        timestamp: new Date()
      })),
      { persistent: true }
    );
    
    logger.info(`Order ${order._id} status updated to ${status}`);
    return order;
  } catch (error) {
    logger.error(`Error updating order status: ${error.message}`);
    throw error;
  }
};

/**
 * Confirm order and update product stock
 */
const confirmOrder = async (orderId, note) => {
  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    if (order.status !== 'PENDING') {
      throw new Error(`Cannot confirm order in ${order.status} status`);
    }
    
    // Update the order status to CONFIRMED
    await order.updateStatus('CONFIRMED', note || 'Order confirmed');
    
    // Cache invalidation - sipariş onaylandı
    await orderRedisCache.deleteOrder(orderId);
    await orderRedisCache.del(`user:orders:${order.userId}`);
    await orderRedisCache.del('orders:all');
    await orderRedisCache.cacheOrderStatus(orderId, 'CONFIRMED', 1800);
    
    // Notify stock service to decrease quantities
    const channel = getChannel();
    channel.sendToQueue(
      'stock.update',
      Buffer.from(JSON.stringify({ 
        orderId: order._id, 
        items: order.items,
        operation: 'decrease'
      })),
      { persistent: true }
    );
    
    logger.info(`Order ${order._id} confirmed and stock update requested`);
    return order;
  } catch (error) {
    logger.error(`Error confirming order: ${error.message}`);
    throw error;
  }
};

module.exports = {
  getOrderById,
  getOrdersByUserId,
  getAllOrders,
  createOrder,
  updateOrderStatus,
  confirmOrder
}; 