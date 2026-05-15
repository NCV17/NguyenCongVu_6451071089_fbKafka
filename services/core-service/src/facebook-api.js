const axios = require('axios');

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const FB_API_VERSION = 'v19.0'; // Có thể đổi phiên bản API tương ứng
const FB_API_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

// Ẩn bình luận
const hideComment = async (commentId) => {
  if (!commentId || !PAGE_ACCESS_TOKEN) return;
  try {
    const url = `${FB_API_URL}/${commentId}`;
    const params = new URLSearchParams();
    params.append('is_hidden', 'true');
    params.append('access_token', PAGE_ACCESS_TOKEN);

    const response = await axios.post(url, params);
    console.log(`[FB API] Đã ẩn comment ${commentId}`);
    return response.data;
  } catch (error) {
    console.error(`[FB API] Lỗi khi ẩn comment ${commentId}:`, error.response?.data || error.message);
    throw error;
  }
};

// Trả lời bình luận tự động
const replyToComment = async (commentId, message) => {
  if (!commentId || !PAGE_ACCESS_TOKEN) return;
  try {
    const url = `${FB_API_URL}/${commentId}/comments`;
    const response = await axios.post(url, {
      message: message,
      access_token: PAGE_ACCESS_TOKEN
    });
    console.log(`[FB API] Đã reply comment ${commentId}`);
    return response.data;
  } catch (error) {
    console.error(`[FB API] Lỗi khi reply comment ${commentId}:`, error.response?.data || error.message);
    throw error;
  }
};

// Gửi tin nhắn tự động (cho Message)
const sendMessage = async (senderId, message) => {
  if (!senderId || !PAGE_ACCESS_TOKEN) return;
  try {
    const url = `${FB_API_URL}/me/messages`;
    const response = await axios.post(url, {
      recipient: { id: senderId },
      message: { text: message },
      messaging_type: "RESPONSE",
      access_token: PAGE_ACCESS_TOKEN
    });
    console.log(`[FB API] Đã gửi tin nhắn cho khách hàng ID ${senderId}`);
    return response.data;
  } catch (error) {
    console.error(`[FB API] Lỗi gửi tin nhắn cho ${senderId}:`, error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  hideComment,
  replyToComment,
  sendMessage
};
