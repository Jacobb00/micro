const Order = require('../models/Order');
const logger = require('../config/logger');
const { getChannel } = require('../config/rabbitmq');
const axios = require('axios');

/**
 * Get order by ID
 */
const getOrderById = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
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
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    return orders;
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
    const orders = await Order.find().sort({ createdAt: -1 });
    return orders;
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