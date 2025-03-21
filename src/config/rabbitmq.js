const amqp = require('amqplib');
require('dotenv').config();

class RabbitMQClient {
    constructor() {
        this.channel = null;
        this.connection = null;
    }

    async connect() {
        try {
            this.connection = await amqp.connect(process.env.RABBITMQ_URL);
            this.channel = await this.connection.createChannel();
            console.log('Successfully connected to RabbitMQ');
        } catch (error) {
            console.error('RabbitMQ connection error:', error);
            throw error;
        }
    }

    async publishMessage(exchange, routingKey, message) {
        try {
            if (!this.channel) {
                await this.connect();
            }

            await this.channel.assertExchange(exchange, 'topic', { durable: true });
            this.channel.publish(
                exchange,
                routingKey,
                Buffer.from(JSON.stringify(message))
            );
            console.log(`Message published to ${exchange} with routing key ${routingKey}`);
        } catch (error) {
            console.error('Error publishing message:', error);
            throw error;
        }
    }

    async consumeMessage(exchange, queue, routingKey, callback) {
        try {
            if (!this.channel) {
                await this.connect();
            }

            await this.channel.assertExchange(exchange, 'topic', { durable: true });
            const q = await this.channel.assertQueue(queue, { durable: true });
            
            await this.channel.bindQueue(q.queue, exchange, routingKey);
            
            this.channel.consume(q.queue, (msg) => {
                if (msg !== null) {
                    const content = JSON.parse(msg.content.toString());
                    callback(content);
                    this.channel.ack(msg);
                }
            });

            console.log(`Consuming messages from queue: ${queue}`);
        } catch (error) {
            console.error('Error consuming message:', error);
            throw error;
        }
    }

    async closeConnection() {
        try {
            await this.channel.close();
            await this.connection.close();
        } catch (error) {
            console.error('Error closing RabbitMQ connection:', error);
            throw error;
        }
    }
}

module.exports = new RabbitMQClient(); 