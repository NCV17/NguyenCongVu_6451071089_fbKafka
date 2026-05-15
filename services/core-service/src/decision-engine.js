const makeDecision = async (event, spamResult, aiResult) => {
  console.log(`[Decision Engine] Đang xử lý [${event.type.toUpperCase()}] từ ${event.senderName}`);
  
  // 1. Xử lý Spam -> Xóa bình luận
  if (spamResult.isSpam) {
    console.log(`=> HÀNH ĐỘNG: [XÓA BÌNH LUẬN] - Lý do: Spam / Chứa liên kết.`);
    return 'delete';
  }

  // Nếu API AI chưa cấu hình thì bỏ qua
  if (aiResult.error === 'AI_NOT_CONFIGURED') {
    console.log(`=> HÀNH ĐỘNG: [BỎ QUA] - Lý do: Chưa cấu hình API Key của AI.`);
    return 'no_action';
  }

  // 2. Xử lý tự động hóa theo cảm xúc (Sentiment)
  if (aiResult.sentiment === 'tích cực') {
    console.log(`=> HÀNH ĐỘNG: [CẢM ƠN] - Lý do: Cảm xúc tích cực.`);
    return 'reply_positive';
  }

  if (aiResult.sentiment === 'tiêu cực') {
    console.log(`=> HÀNH ĐỘNG: [XIN LỖI] - Lý do: Cảm xúc tiêu cực.`);
    return 'reply_negative';
  }

  if (aiResult.intent === 'hỏi giá') {
    console.log(`=> HÀNH ĐỘNG: [AUTO-REPLY BÁO GIÁ] - Lý do: Khách hỏi giá.`);
    return 'auto_reply';
  }

  console.log(`=> HÀNH ĐỘNG: [BỎ QUA/KHÔNG LÀM GÌ] - Ý định: ${aiResult.intent}`);
  return 'no_action';
};

module.exports = { makeDecision };
