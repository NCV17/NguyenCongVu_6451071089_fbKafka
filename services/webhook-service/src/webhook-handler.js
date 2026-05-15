const { publishEvent } = require('./kafka-producer');

const normalizeAndPublish = async (body) => {
  if (body.object === 'page') {
    for (const entry of body.entry) {
      const pageId = entry.id;
      const timeOfEvent = entry.time;

      // Xử lý Tin nhắn (Messages)
      if (entry.messaging) {
        for (const webhookEvent of entry.messaging) {
          const senderId = webhookEvent.sender.id;
          
          if (webhookEvent.message && !webhookEvent.message.is_echo && webhookEvent.message.text) {
            const normalizedEvent = {
              source: 'facebook',
              type: 'message',
              pageId,
              senderId,
              timestamp: timeOfEvent,
              content: webhookEvent.message.text,
              messageId: webhookEvent.message.mid,
              raw: webhookEvent, // Lưu lại raw nếu cần debug sau này
              status: 'received'
            };
            
            // Đẩy vào Kafka
            await publishEvent('raw_events', normalizedEvent);
          }
        }
      }

      // Xử lý Bình luận và Bài viết mới (Feed changes)
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === 'feed') {
            // Sự kiện có bình luận mới
            if (change.value.item === 'comment' && change.value.verb === 'add') {
              // Bỏ qua bình luận do chính Page (Bot) phản hồi để tránh vòng lặp vô hạn (Dùng String để so sánh an toàn)
              if (change.value.from && String(change.value.from.id) === String(pageId)) continue;

              const normalizedEvent = {
                source: 'facebook',
                type: 'comment',
                pageId,
                senderId: change.value.from.id,
                senderName: change.value.from.name,
                timestamp: change.value.created_time,
                content: change.value.message,
                commentId: change.value.comment_id,
                postId: change.value.post_id,
                raw: change.value,
                status: 'received'
              };
              console.log(`[Webhook] Đã nhận Comment mới từ ${change.value.from.name}: "${change.value.message}"`);
              await publishEvent('raw_events', normalizedEvent);
            } 
            // Sự kiện có bài viết mới trên page
            else if (['status', 'post', 'photo', 'video', 'share'].includes(change.value.item) && change.value.verb === 'add') {
              const normalizedEvent = {
                source: 'facebook',
                type: 'post',
                pageId,
                senderId: change.value.from ? change.value.from.id : 'N/A',
                senderName: change.value.from ? change.value.from.name : 'Page',
                timestamp: change.value.created_time,
                content: change.value.message || "[No Text/Media only]",
                postId: change.value.post_id,
                raw: change.value,
                status: 'received'
              };
              console.log(`[Webhook] Đã nhận Bài đăng mới: "${normalizedEvent.content}"`);
              await publishEvent('raw_events', normalizedEvent);
            }
          }
        }
      }
    }
  }
};

module.exports = { normalizeAndPublish };
