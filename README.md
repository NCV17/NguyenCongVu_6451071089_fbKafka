# Hệ Thống Facebook Event Processor (Realtime AI Auto-Reply & Anti-Spam)

Đây là hệ thống xử lý sự kiện thời gian thực (Webhook) từ Facebook Page, kết hợp với Apache Kafka, AI Gemini để tự động hóa chăm sóc khách hàng (Auto-Reply) và chống Spam.

## 🏗 Cấu trúc Dự Án
Hệ thống được thiết kế theo kiến trúc Microservices điều hướng bằng Kafka.

```text
fb_api/
├── docker-compose.yml       # Cấu hình hạ tầng (Kafka, Zookeeper, DB, Monitoring...)
├── services/
│   ├── webhook-service/     # Entry point nhận Webhook, chuẩn hóa và đẩy vào Kafka
│   ├── core-service/        # Nhận event từ Kafka, lọc Spam, phân tích AI và gọi FB API
│   └── retry-service/       # (TODO) Xử lý các event bị lỗi từ topic send_failed
└── README.md                # Tài liệu dự án
```

## 🚀 Các Tính Năng Đã Hoàn Thiện (Bài 1, 2, 3)

### 1. Hạ tầng Hệ Thống (Infrastructure)
- Cấu hình thành công `docker-compose.yml` gồm các container: **Zookeeper, Kafka, Kafka UI (Port 8080), Prometheus, Alertmanager, PostgreSQL**.
- Đã tự động tạo các topic Kafka cần thiết: `raw_events`, `send_failed`.

### 2. Webhook Service (Port: 3001)
- Lắng nghe sự kiện từ Facebook (Comments, Messages, Posts).
- **Chống lặp (Infinite Loop):** Tự động bỏ qua các bình luận/tin nhắn do chính Bot (Page) phát ra để tránh vòng lặp tự nói chuyện một mình.
- Chuẩn hóa payload từ cấu trúc phức tạp của Facebook về một Schema chung.
- Đẩy dữ liệu (Publish) vào Kafka topic `raw_events`.

### 3. Core Service (AI & Action Engine)
- **Kafka Consumer:** Tiêu thụ liên tục các sự kiện từ topic `raw_events`.
- **Spam Filter (`spam-filter.js`):** 
  - Tự động nhận diện các URL chứa `http/https` hoặc các domain độc hại dạng `spam.link`, `www.domain.com`.
- **AI Classifier (`ai-classifier.js`):** 
  - Tích hợp thành công **Gemini 2.5 Flash** (hỗ trợ ép kiểu trả về nguyên bản JSON).
  - Phân tích Ý định (Intent: hỏi giá, khiếu nại, hỗ trợ...) và Cảm xúc (Sentiment: Tích cực, Tiêu cực, Trung tính).
- **Decision Engine & Facebook API (`decision-engine.js`, `facebook-api.js`):**
  - **Spam:** Trực tiếp gọi Graph API (`Form Data`) để ẩn (`is_hidden = true`) các bình luận chứa link rác.
  - **Tích cực:** Tự động chọn ngẫu nhiên 1 trong 4 câu cảm ơn để Reply khách hàng.
  - **Tiêu cực:** Tự động chọn ngẫu nhiên 1 trong 4 câu xin lỗi để Reply khách hàng.
  - **Hỏi giá:** Tự động báo giá và điều hướng inbox.
- **Dead Letter Queue (DLQ):** Mọi lỗi phát sinh (VD: Lỗi gọi AI, lỗi token hết hạn) sẽ đẩy event đó qua topic `send_failed` để xử lý lại sau, không bị mất data.

## ⚙️ Cấu Hình Môi Trường (Environment Variables)

Hệ thống yêu cầu các file `.env` ở mỗi service:

**1. `services/webhook-service/.env`**
```env
PORT=3001
FB_VERIFY_TOKEN=KHOA_BAO_MAT_CUA_BAN
FB_APP_SECRET=SECRET_CUA_APP_FACEBOOK
KAFKA_BROKERS=localhost:9092
PAGE_ACCESS_TOKEN=EAA... (Mã Token lấy từ Graph API Explorer)
```

**2. `services/core-service/.env`**
```env
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=core-service-group
AI_PROVIDER=GEMINI
GEMINI_API_KEY=AIzaSy... (API Key của Google AI Studio)
PAGE_ACCESS_TOKEN=EAA... (Mã Token lấy từ Graph API Explorer, lưu ý token chỉ sống 1-2h nếu không dùng long-lived)
```

## 🛠 Hướng Dẫn Chạy Dự Án

**Bước 1: Chạy hạ tầng Kafka**
```bash
cd "d:/Lập trình API/fb_api"
docker-compose up -d
```
*(Vào http://localhost:8080 để xem Kafka UI)*

**Bước 2: Mở đường hầm Ngrok (Dành cho Webhook)**
```bash
ngrok http 3001
```
*(Copy link HTTPS dán vào cấu hình Webhook trên trang developers.facebook.com)*

**Bước 3: Chạy Webhook Service**
```bash
cd "d:/Lập trình API/fb_api/services/webhook-service"
npm run dev
```

**Bước 4: Chạy Core Service**
```bash
cd "d:/Lập trình API/fb_api/services/core-service"
npm run dev
```

*(Lưu ý: Bất cứ khi nào Facebook báo lỗi `Error validating access token: Session has expired`, bạn cần vào Graph API sinh Token mới và chép đè vào 2 file `.env`, sau đó khởi động lại server)*

## 🎯 Các Bước Phát Triển Tiếp Theo (Next Steps)
1. **Retry Service:** Code thư mục `retry-service` để tự động kéo các event lỗi từ topic `send_failed`, đợi một thời gian (Exponential Backoff) rồi chạy lại quy trình.
2. **Database Storage:** Lưu trữ lịch sử tất cả các Event, Intent, Sentiment, và Action vào PostgreSQL (hiện tại PostgreSQL đã chạy trên docker nhưng chưa kết nối).
3. **Dashboard / Metrics:** Theo dõi số lượng spam, tin nhắn trên biểu đồ Grafana thông qua Prometheus Metrics.
