const { publishSendRetry, publishDeadLetter } = require('./kafka-producer');

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);

/**
 * Tính exponential backoff delay (ms)
 * retry 1 → 1000ms (1s)
 * retry 2 → 2000ms (2s)
 * retry 3 → 4000ms (4s)
 */
const calcBackoffDelay = (retryCount) => {
  return 1000 * Math.pow(2, retryCount - 1);
};

/**
 * Xử lý một message từ topic send_failed.
 * - Đọc retry_count
 * - Tính exponential backoff delay
 * - Nếu retry_count < MAX_RETRIES → publish send_retry sau delay
 * - Nếu retry_count >= MAX_RETRIES → publish dead_letter
 */
const handleRetry = async (failedMessage) => {
  const { command_id, event_id, retry_count, last_error, payload } = failedMessage;

  console.log(`\n[Retry Handler] Nhận failed message [${command_id}]`);
  console.log(`  retry_count : ${retry_count}`);
  console.log(`  last_error  : ${last_error}`);
  console.log(`  MAX_RETRIES : ${MAX_RETRIES}`);

  if (retry_count >= MAX_RETRIES) {
    // Đã vượt quá số lần retry → Dead Letter Queue
    console.log(`[Retry Handler]  retry_count (${retry_count}) >= MAX_RETRIES (${MAX_RETRIES}) → Dead Letter Queue`);
    await publishDeadLetter(failedMessage);
    return;
  }

  // Còn có thể retry
  const delay = calcBackoffDelay(retry_count);
  console.log(`[Retry Handler] Sẽ retry sau ${delay}ms (retry #${retry_count})...`);

  // Chờ backoff delay rồi mới publish
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Build retry message (bao gồm toàn bộ payload để backend-api xử lý lại)
  const retryMessage = {
    schema_version:  1,
    command_id,
    event_id,
    action:          payload?.action,
    target:          payload?.target,
    reply_text:      payload?.reply_text,
    intent:          payload?.intent,
    sentiment:       payload?.sentiment,
    retry_count,     // giữ nguyên — backend-api sẽ +1 nếu fail lại
    retried_at:      new Date().toISOString(),
  };

  await publishSendRetry(retryMessage);
  console.log(`[Retry Handler] Đã gửi lại → send_retry [retry #${retry_count}]`);
};

module.exports = { handleRetry };
