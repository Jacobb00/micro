const amqp = require('amqplib');

async function monitorMessages() {
    try {
        // RabbitMQ'ya bağlan
        console.log('RabbitMQ\'ya bağlanılıyor...');
        const connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672');
        console.log('Bağlantı başarılı!');

        // Kanal oluştur
        const channel = await connection.createChannel();
        
        // Exchange'i tanımla
        const exchange = 'user_events';
        await channel.assertExchange(exchange, 'topic', { durable: true });
        
        // Geçici kuyruk oluştur
        const { queue } = await channel.assertQueue('', { exclusive: true });
        
        // Tüm user event'lerini dinle
        await channel.bindQueue(queue, exchange, 'user.*');
        
        console.log('Mesajlar dinleniyor... Her tür kullanıcı olayı görüntülenecek.');
        
        // Mesajları dinle
        channel.consume(queue, (msg) => {
            if (msg !== null) {
                const content = JSON.parse(msg.content.toString());
                console.log('─────────────────────────────────────');
                console.log('Routing Key:', msg.fields.routingKey);
                console.log('Mesaj:', JSON.stringify(content, null, 2));
                console.log('Zaman:', new Date().toLocaleString());
                console.log('─────────────────────────────────────\n');
                channel.ack(msg);
            }
        });

    } catch (error) {
        console.error('Hata:', error);
    }
}

// İzlemeyi başlat
monitorMessages(); 