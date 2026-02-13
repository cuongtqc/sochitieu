# Telegram -> Webhook(Node.js) -> Gemini -> Google Sheets

Webhook này nhận tin nhắn Telegram, trích xuất dữ liệu giao dịch bằng Gemini, rồi lưu vào Google Spreadsheet.

## 1) Chuẩn bị

- Node.js >= 18
- Telegram Bot Token (từ @BotFather)
- Gemini API Key
- Google Spreadsheet + Service Account có quyền chỉnh sửa sheet

## 2) Cài đặt

```bash
npm install
cp .env.example .env
```

Điền các biến trong `.env`.

## 3) Cấu trúc dữ liệu lưu vào Sheet

Hệ thống append vào cột `A:J` theo thứ tự:

1. `created_at` (ISO time lúc server xử lý)
2. `chat_id`
3. `telegram_user_id`
4. `telegram_username`
5. `amount`
6. `purpose`
7. `category`
8. `time`
9. `source`
10. `raw_message`

## 4) Chạy server

```bash
npm run dev
# hoặc
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

## 5) Đăng ký Telegram webhook

Sau khi deploy server public HTTPS, gọi:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

> Nếu không dùng secret token, bỏ `-d secret_token=...` và để trống `TELEGRAM_WEBHOOK_SECRET` trong `.env`.

## 6) Ví dụ tin nhắn

- `150k ăn trưa với team hôm nay`
- `chi 2.500.000 đóng tiền nhà ngày 05/02`
- `nhận lương 20 triệu tháng này`

Gemini sẽ trả JSON chuẩn gồm: `amount`, `purpose`, `category`, `time`, `source`, `raw_message`.

## 7) Lưu ý triển khai

- Endpoint webhook: `POST /telegram/webhook`
- Telegram cần URL HTTPS public.
- Nếu parse lỗi hoặc gọi API lỗi, bot sẽ phản hồi thông báo lỗi để người dùng nhập lại rõ hơn.
