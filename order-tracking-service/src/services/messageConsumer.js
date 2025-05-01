const logger = require('../config/logger');
const { getChannel } = require('../config/rabbitmq');
const orderService = require('./orderService');

/**
 * Set up RabbitMQ message consumers
 */
const setupConsumers = async () => {
  const channel = getChannel();
  
  // Handle order created events
  channel.consume('order.created', async (msg) => {
    try {
      const orderData = JSON.parse(msg.content.toString());
      logger.info(`Received order created event for order: ${orderData._id}`);
      // Process order created event if needed
      channel.ack(msg);
    } catch (error) {
      logger.error(`Error processing order created event: ${error.message}`);
      channel.nack(msg, false, true); // Requeue the message
    }
  });
  
  // Handle order status changed events
  channel.consume('order.status.changed', async (msg) => {
    try {
      const statusData = JSON.parse(msg.content.toString());
      logger.info(`Received order status changed event: ${statusData.orderId} -> ${statusData.newStatus}`);
      // Process status change event if needed
      channel.ack(msg);
    } catch (error) {
      logger.error(`Error processing order status changed event: ${error.message}`);
      channel.nack(msg, false, true); // Requeue the message
    }
  });
  
  // Handle payment successful events
  channel.consume('payment.successful', async (msg) => {
    try {
      const message = JSON.parse(msg.content.toString());
      const data = message.data || message; // Handle both direct data and {event_type, data} format
      
      logger.info(`Received payment successful event for order: ${data.orderId}`);
      
      // Enrich the items with required fields if missing
      const enrichedItems = data.items.map(item => {
        // Make sure each item has the required fields
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price || 0,
          name: item.name || `Product ${item.productId}`,
          ...item // Keep any other fields that might be there
        };
      });
      
      // Create a new order in order-tracking-service based on payment data
      const orderData = {
        userId: data.userId,
        orderNumber: data.orderId,
        items: enrichedItems,
        totalAmount: data.totalAmount,
        shippingAddress: data.shippingAddress || {
          street: "Default Address",
          city: "Default City",
          state: "Default State",
          zipCode: "00000",
          country: "Default Country"
        }
      };
      
      await orderService.createOrder(orderData);
      logger.info(`Created new order from payment: ${data.orderId}`);
      
      channel.ack(msg);
    } catch (error) {
      logger.error(`Error processing payment successful event: ${error.message}`);
      channel.nack(msg, false, true); // Requeue the message
    }
  });
  
  // Handle stock update responses
  channel.consume('stock.update.response', async (msg) => {
    try {
      const response = JSON.parse(msg.content.toString());
      logger.info(`Received stock update response for order: ${response.orderId}`);
      
      if (response.success) {
        // Stock was successfully updated
        logger.info(`Stock update successful for order: ${response.orderId}`);
      } else {
        // Stock update failed, revert the order confirmation
        logger.warn(`Stock update failed for order: ${response.orderId}, reverting to PENDING`);
        await orderService.updateOrderStatus(
          response.orderId,
          'PENDING',
          'Order reverted to pending due to stock issues'
        );
      }
      channel.ack(msg);
    } catch (error) {
      logger.error(`Error processing stock update response: ${error.message}`);
      channel.nack(msg, false, true); // Requeue the message
    }
  });
  
  // Handle stock rollback responses
  channel.consume('stock.rollback.response', async (msg) => {
    try {
      const response = JSON.parse(msg.content.toString());
      logger.info(`Received stock rollback response for order: ${response.orderId}`);
      channel.ack(msg);
    } catch (error) {
      logger.error(`Error processing stock rollback response: ${error.message}`);
      channel.nack(msg, false, true); // Requeue the message
    }
  });
  
  logger.info('RabbitMQ message consumers set up successfully');
};

module.exports = { setupConsumers }; 