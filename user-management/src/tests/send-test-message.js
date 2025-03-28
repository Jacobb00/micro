const amqp = require('amqplib');

async function sendTestMessage() {
    try {
        // RabbitMQ'ya bağlan
        const connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672');
        const channel = await connection.createChannel();
        
        // Exchange'i tanımla
        const exchange = 'user_events';
        await channel.assertExchange(exchange, 'topic', { durable: true });
        
        // Test mesajı
        const testMessage = {
            id: 'test-123',
            email: 'test@example.com',
            event: 'test_event',
            timestamp: new Date().toISOString()
        };
        
        // Mesajı gönder
        channel.publish(
            exchange,
            'user.test',
            Buffer.from(JSON.stringify(testMessage))
        );
        
        console.log('Test mesajı gönderildi:', testMessage);
        
        // Bağlantıyı kapat
        setTimeout(() => {
            connection.close();
            process.exit(0);
        }, 500);

    } catch (error) {
        console.error('Hata:', error);
    }
}

// Test mesajını gönder
sendTestMessage(); 