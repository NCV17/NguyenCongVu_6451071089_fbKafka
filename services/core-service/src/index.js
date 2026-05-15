require('dotenv').config();
const { Kafka } = require('kafkajs');
const { detectSpam } = require('./spam-filter');
const { classifyEvent } = require('./ai-classifier');
const { makeDecision } = require('./decision-engine');
const facebookApi = require('./facebook-api');

const kafka = new Kafka({
  clientId: 'core-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'core-service-group' });
const producer = kafka.producer();

const run = async () => {
  await producer.connect();
  await consumer.connect();
  // Đăng ký nhận từ topic raw_events
  await consumer.subscribe({ topic: 'raw_events', fromBeginning: false });

  console.log('====================================================');
  console.log('[Core Service] Khởi động thành công!');
  console.log('[Core Service] Đang lắng nghe topic "raw_events"...');
  console.log('====================================================');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        event.status = 'processed';

        console.log(`\n>> Nhận event mới: [${event.type}] - Nội dung: "${event.content}"`);

        // Bước 1: Lọc Spam
        const spamResult = detectSpam(event.content);
        
        // Bước 2: AI Classification
        // Chỉ gọi AI nếu không phải Spam để tiết kiệm chi phí
        let aiResult = { intent: 'unknown', sentiment: 'neutral' };
        if (!spamResult.isSpam) {
          aiResult = await classifyEvent(event.content);
        }

        // Bước 3: Ra quyết định
        const action = await makeDecision(event, spamResult, aiResult);
        
        // Bước 4: Thực thi hành động gọi Facebook API
        if (action === 'hidden_and_queued' || action === 'hidden') {
          if (event.type === 'comment') {
            await facebookApi.hideComment(event.commentId);
            event.status = 'hidden';
          }
        } else if (action === 'reply_positive') {
          const positiveReplies = [
            "Cảm ơn bạn đã ủng hộ shop!",
            "Dạ shop cảm ơn bạn rất nhiều ạ ❤️",
            "Cảm ơn bạn đã tin tưởng và sử dụng sản phẩm bên mình nhé!",
            "Shop rất vui khi nhận được phản hồi tuyệt vời từ bạn!"
          ];
          const replyText = positiveReplies[Math.floor(Math.random() * positiveReplies.length)];
          
          if (event.type === 'comment') {
            await facebookApi.replyToComment(event.commentId, replyText);
          } else if (event.type === 'message') {
            await facebookApi.sendMessage(event.senderId, replyText);
          }
          event.status = 'replied';
        } else if (action === 'reply_negative') {
          const negativeReplies = [
            "Rất xin lỗi vì trải nghiệm chưa tốt, bên mình sẽ kiểm tra ngay.",
            "Dạ shop thành thật xin lỗi vì sự bất tiện này. Bạn inbox để shop hỗ trợ ngay nhé.",
            "Thành thật xin lỗi bạn! Đội ngũ hỗ trợ sẽ liên hệ xử lý ngay lập tức ạ.",
            "Xin lỗi bạn vì sự cố này. Mong bạn thông cảm, shop sẽ kiểm tra và đền bù cho bạn."
          ];
          const replyText = negativeReplies[Math.floor(Math.random() * negativeReplies.length)];

          if (event.type === 'comment') {
            await facebookApi.replyToComment(event.commentId, replyText);
          } else if (event.type === 'message') {
            await facebookApi.sendMessage(event.senderId, replyText);
          }
          event.status = 'replied';
        } else if (action === 'auto_reply') {
          const replyText = "Cảm ơn bạn đã quan tâm! Sản phẩm này đang có giá ưu đãi. Nhân viên sẽ IB tư vấn thêm cho bạn nhé!";
          if (event.type === 'comment') {
            await facebookApi.replyToComment(event.commentId, replyText);
          } else if (event.type === 'message') {
            await facebookApi.sendMessage(event.senderId, replyText);
          }
          event.status = 'replied';
        } else {
          event.status = 'completed'; // no_action hoặc notify_staff
        }

        // Cập nhật log
        event.action = action;
        event.ai_analysis = aiResult;
        event.spam_analysis = spamResult;

        console.log('Trạng thái cuối:', { action, intent: aiResult.intent, sentiment: aiResult.sentiment, status: event.status });

      } catch (error) {
        console.error('[Core Service] Lỗi xử lý event:', error);
        
        // Push vào send_failed để Retry Service xử lý sau (Dead Letter Queue)
        try {
          await producer.send({
            topic: 'send_failed',
            messages: [{ value: message.value.toString() }]
          });
          console.log('[Core Service] Đã đẩy event lỗi vào topic "send_failed"');
        } catch (e) {
          console.error('[Core Service] Lỗi khi đẩy vào send_failed:', e);
        }
      }
    },
  });
};

// Catch gracefully
const errorTypes = ['unhandledRejection', 'uncaughtException'];
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

errorTypes.map(type => {
  process.on(type, async e => {
    try {
      console.log(`process.on ${type}`);
      console.error(e);
      await consumer.disconnect();
      await producer.disconnect();
      process.exit(0);
    } catch (_) {
      process.exit(1);
    }
  });
});

signalTraps.map(type => {
  process.once(type, async () => {
    try {
      await consumer.disconnect();
      await producer.disconnect();
    } finally {
      process.kill(process.pid, type);
    }
  });
});

run().catch(console.error);
