/**
 * facebook-api.js
 * Wrapper gọi Facebook Graph API.
 * Khi FAKE_MODE=true → chỉ log (dùng cho demo/testing).
 * Khi FAKE_MODE=false → gọi thật qua axios (cần cài thêm axios).
 */

const FAKE_MODE = process.env.FAKE_MODE === 'true';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const FB_API_VERSION = process.env.FB_API_VERSION || 'v19.0';
const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

// ─── Fake helpers ────────────────────────────────────────────────────────────

const fakeSuccess = (action, details) => {
  console.log(`[Facebook API - FAKE] ✅ ${action}:`, details);
  return { success: true, fake: true };
};

const fakeFail = (action, details) => {
  console.log(`[Facebook API - FAKE] ❌ SIMULATED FAILURE - ${action}:`, details);
  throw new Error(`Simulated Facebook timeout for action: ${action}`);
};

// ─── Real API calls ──────────────────────────────────────────────────────────

const realPost = async (url, body) => {
  // Dynamic require: axios không bắt buộc khi FAKE_MODE=true
  const axios = require('axios');
  try {
    const response = await axios.post(url, { ...body, access_token: PAGE_ACCESS_TOKEN });
    return response.data;
  } catch (error) {
    if (error.response?.data) {
      console.error(`[Facebook API] ❌ API Error:`, JSON.stringify(error.response.data));
    }
    throw error;
  }
};

// ─── API Methods ─────────────────────────────────────────────────────────────

/**
 * Reply một bình luận Facebook
 */
const replyComment = async (commentId, replyText) => {
  if (FAKE_MODE) {
    return fakeSuccess('replyComment', { commentId, replyText });
  }
  const url = `${FB_BASE_URL}/${commentId}/comments`;
  const result = await realPost(url, { message: replyText });
  console.log(`[Facebook API] ✅ Đã reply comment ${commentId}`);
  return result;
};

/**
 * Ẩn một bình luận Facebook
 */
const hideComment = async (commentId) => {
  if (FAKE_MODE) {
    return fakeSuccess('hideComment', { commentId });
  }
  const url = `${FB_BASE_URL}/${commentId}`;

  // Facebook API yêu cầu is_hidden phải gửi dưới dạng URLSearchParams thay vì JSON body
  const axios = require('axios');
  const params = new URLSearchParams();
  params.append('is_hidden', 'true');
  params.append('access_token', PAGE_ACCESS_TOKEN);

  const response = await axios.post(url, params);

  console.log(`[Facebook API] ✅ Đã ẩn comment ${commentId}`);
  return response.data;
};

/**
 * Xóa một bình luận Facebook (Xóa hoàn toàn, không ai thấy được nữa)
 */
const deleteComment = async (commentId) => {
  if (FAKE_MODE) {
    return fakeSuccess('deleteComment', { commentId });
  }
  const url = `${FB_BASE_URL}/${commentId}`;

  const axios = require('axios');
  const response = await axios.delete(url, {
    params: { access_token: PAGE_ACCESS_TOKEN }
  });

  console.log(`[Facebook API] 🗑️ Đã XÓA comment ${commentId}`);
  return response.data;
};

/**
 * Tạo bài post mới trên Page
 */
const createPost = async (pageId, message) => {
  if (FAKE_MODE) {
    return fakeSuccess('createPost', { pageId, message });
  }
  const url = `${FB_BASE_URL}/${pageId}/feed`;
  const result = await realPost(url, { message });
  console.log(`[Facebook API] ✅ Đã tạo post cho page ${pageId}`);
  return result;
};

module.exports = { replyComment, hideComment, deleteComment, createPost };
