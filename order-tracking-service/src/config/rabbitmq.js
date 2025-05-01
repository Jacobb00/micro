const amqp = require('amqplib');
const logger = require('./logger');

let channel = null;

const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    
    // Order related queues
    await channel.assertQueue('order.created', { durable: true });
    await channel.assertQueue('order.updated', { durable: true });
    await channel.assertQueue('order.status.changed', { durable: true });
    await channel.assertQueue('order.canceled', { durable: true });
    
    // Product stock related queues
    await channel.assertQueue('stock.update', { durable: true });
    await channel.assertQueue('stock.update.response', { durable: true });
    await channel.assertQueue('stock.rollback', { durable: true });
    await channel.assertQueue('stock.rollback.response', { durable: true });
    
    // Payment related queues
    await channel.assertQueue('payment.successful', { durable: true });
    
    // Declare the payment_events exchange
    await channel.assertExchange('payment_events', 'topic', { durable: true });
    
    // Bind the payment.successful queue to the exchange
    await channel.bindQueue('payment.successful', 'payment_events', 'payment.successful');
    
    logger.info('Connected to RabbitMQ');
    return channel;
  } catch (error) {
    logger.error(`Error connecting to RabbitMQ: ${error.message}`);
    process.exit(1);
  }
};

const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return channel;
};

module.exports = { connectRabbitMQ, getChannel }; 