# 🚀 Facebook Webhook + Kafka — Microservice Architecture

Hệ thống xử lý sự kiện Facebook Page theo kiến trúc **event-driven microservice** với **retry pipeline** và **dead letter queue**.

---

## 🛠️ Cập nhật mới nhất (Changelog)
- **Tắt FAKE_MODE**: Chuyển `FAKE_MODE=false` trong `backend-api` và tích hợp `axios` để chính thức gọi Facebook Graph API thật.
- **Nâng cấp xử lý Spam**: Đổi chiến lược từ "Ẩn (Hide)" sang **"Xóa vĩnh viễn (Delete)"** bình luận rác. Giúp loại bỏ hoàn toàn dấu vết spam thay vì chỉ ẩn (Shadowban) như trước.
- **Fix lỗi 400 Bad Request**: Chuyển đổi việc gửi `PAGE_ACCESS_TOKEN` từ body JSON sang tham số URL (Query Parameter `?access_token=...`) để đáp ứng đúng yêu cầu của Graph API, đảm bảo Auto-reply mượt mà.
- **Dọn dẹp code**: Xóa file `facebook-api.js` thừa bên `core-service`, đảm bảo nguyên tắc kiến trúc Microservices (chỉ `backend-api` mới được gọi ra ngoài Facebook).

---

## 🏗️ Kiến trúc tổng quan

```
Facebook
   │
   ▼
webhook-service  (port 3001)
   │  publish
   ▼
Kafka topic: raw_events
   │  consume
   ▼
core-service
├── spam-filter.js      → phát hiện spam
├── ai-classifier.js    → phân tích AI (Gemini / OpenAI)
└── decision-engine.js  → quyết định hành động
   │  publish
   ▼
Kafka topic: reply_commands
   │  consume
   ▼
backend-api
└── facebook-api.js     → gọi Facebook Graph API
   │
   ├── SUCCESS → log ✅
   │
   └── FAIL → publish
         ▼
      Kafka topic: send_failed
         │  consume
         ▼
      retry-service
      └── retry-handler.js  → exponential backoff
         │
         ├── retry_count < 3 → publish → send_retry → backend-api retry
         │
         └── retry_count >= 3 → publish → dead_letter ☠️
```

---

## 📦 Services

### 1. `webhook-service` — Cổng nhận sự kiện Facebook
| File | Chức năng |
|------|-----------|
| `src/index.js` | Express server, verify webhook |
| `src/webhook-handler.js` | Normalize event → publish `raw_events` |
| `src/kafka-producer.js` | Kafka producer |
| `src/signature-verifier.js` | Xác thực chữ ký Facebook |

### 2. `core-service` — Xử lý AI & ra quyết định
| File | Chức năng |
|------|-----------|
| `src/index.js` | Consumer `raw_events` → pipeline xử lý |
| `src/spam-filter.js` | Phát hiện spam, link độc hại |
| `src/ai-classifier.js` | Gọi Gemini/OpenAI phân tích intent + sentiment |
| `src/decision-engine.js` | Ra quyết định: reply / hide / ignore |
| `src/kafka-producer.js` | Publish `reply_commands` |

> ⚠️ **Core-service KHÔNG gọi Facebook API trực tiếp**

### 3. `backend-api` — Thực thi lệnh lên Facebook
| File | Chức năng |
|------|-----------|
| `src/index.js` | Entry point |
| `src/kafka-consumer.js` | Consume `reply_commands` + `send_retry` |
| `src/kafka-producer.js` | Publish `send_failed` khi lỗi |
| `src/facebook-api.js` | Wrapper gọi Facebook Graph API |
| `src/handlers/command-handler.js` | Route action → FB API |

### 4. `retry-service` — Retry pipeline
| File | Chức năng |
|------|-----------|
| `src/index.js` | Entry point |
| `src/kafka-consumer.js` | Consume `send_failed` |
| `src/kafka-producer.js` | Publish `send_retry` hoặc `dead_letter` |
| `src/retry-handler.js` | Exponential backoff logic |

---

## 📨 Kafka Topics

| Topic | Producer | Consumer | Mô tả |
|-------|----------|----------|-------|
| `raw_events` | webhook-service | core-service | Sự kiện thô từ Facebook |
| `reply_commands` | core-service | backend-api | Lệnh thực thi lên Facebook |
| `send_failed` | backend-api | retry-service | Lệnh thất bại cần retry |
| `send_retry` | retry-service | backend-api | Retry sau backoff |
| `dead_letter` | retry-service | _(monitor)_ | Thất bại vĩnh viễn (>= 3 lần) |

---

## 🔄 Retry Pipeline

```
send_failed (retry_count=1)
   ↓ delay = 1000 * 2^(1-1) = 1s
send_retry → backend-api

send_failed (retry_count=2)
   ↓ delay = 1000 * 2^(2-1) = 2s
send_retry → backend-api

send_failed (retry_count=3)
   ↓ retry_count >= MAX_RETRIES (3)
dead_letter ☠️
```

---

## ⚙️ Cấu hình `.env`

Tất cả cấu hình môi trường hiện được đặt chung tại một file **`.env` ở thư mục gốc (root)** của dự án để dễ quản lý. File `.env` sẽ trông như sau:

```env
# ==== KAFKA ====
KAFKA_BROKERS=localhost:9092

# ==== FACEBOOK API ====
PAGE_ACCESS_TOKEN=EAASXYz...
FB_APP_SECRET=c92d29583526e62dae3451158faf33e3
FB_VERIFY_TOKEN=my_verify_token_123
FB_API_VERSION=v19.0
FAKE_MODE=false

# ==== AI CONFIG ====
AI_PROVIDER=GEMINI
GEMINI_API_KEY=AIzaSy...

# ==== RETRY SERVICE ====
MAX_RETRIES=3
```

> **Lưu ý**: Các biến riêng biệt cho từng service (như `KAFKA_GROUP_ID`, `PORT`) đã được thiết lập sẵn trong file `docker-compose.yml`.

---

## 🚀 Hướng dẫn chạy

### 1. Khởi động Kafka (Docker)
```bash
docker-compose up -d
```

Kafka UI: http://localhost:8080

### 2. Chạy từng service (terminal riêng)

```bash
# Terminal 1 — Webhook Service
cd services/webhook-service
npm run dev

# Terminal 2 — Core Service
cd services/core-service
npm run dev

# Terminal 3 — Backend API
cd services/backend-api
npm run dev

# Terminal 4 — Retry Service
cd services/retry-service
npm run dev
```

### 3. Test flow
```bash
# Gửi event giả lập vào raw_events (cần kafka-console-producer hoặc Kafka UI)
# Hoặc POST webhook giả lập:
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"page","entry":[...]}'
```

---

## 🔍 Monitoring

| Service | URL |
|---------|-----|
| Kafka UI | http://localhost:8080 |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |

---

## 📋 Message Schemas

### `reply_commands`
```json
{
  "schema_version": 1,
  "command_id": "uuid-v4",
  "event_id": "evt_001",
  "action": "reply | hide | delete | create_post",
  "target": { "comment_id": "123", "sender_id": null, "type": "comment" },
  "reply_text": "Cảm ơn bạn đã ủng hộ shop!",
  "intent": "positive_feedback",
  "sentiment": "positive",
  "created_at": "2026-05-15T10:00:00.000Z"
}
```

### `send_failed`
```json
{
  "schema_version": 1,
  "command_id": "cmd_001",
  "event_id": "evt_001",
  "retry_count": 1,
  "last_error": "Facebook timeout",
  "payload": { "action": "reply", "reply_text": "Cảm ơn bạn" },
  "failed_at": "2026-05-15T10:00:01.000Z"
}
```

### `dead_letter`
```json
{
  "schema_version": 1,
  "command_id": "cmd_001",
  "event_id": "evt_001",
  "retry_count": 3,
  "final_error": "Facebook timeout after maximum retries",
  "dead_at": "2026-05-15T10:00:10.000Z"
}
```
