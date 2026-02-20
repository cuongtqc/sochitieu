# Telegram -> Groq -> Google Sheets Webhook

Webhook nhận tin nhắn Telegram, trích xuất dữ liệu chi tiêu/thu nhập bằng Groq, rồi append vào Google Sheets.

## 1) Cài đặt

```bash
npm install
cp .env.example .env
```

## 2) Cấu hình `.env`

Các biến bắt buộc:

- `TELEGRAM_BOT_TOKEN`
- `GROQ_API_KEY` (khuyến nghị)
- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

Các biến thường dùng:

- `PORT=3000`
- `TELEGRAM_WEBHOOK_SECRET=...` (khuyến nghị để verify webhook)
- `GROQ_MODEL=llama-3.1-8b-instant`
- `GOOGLE_SHEET_NAME=Sheet1`
- `DEFAULT_TIMEZONE=Asia/Ho_Chi_Minh`

Lưu ý tương thích cũ: nếu chưa set `GROQ_API_KEY`, app vẫn fallback dùng `GEMINI_API_KEY`.

## 3) Chạy local

```bash
npm run dev
```

Healthcheck:

```bash
curl http://localhost:3000/health
```

## 4) Đăng ký Telegram webhook

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-domain>/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## 5) Cột dữ liệu ghi vào Google Sheets

App append vào `A:J` theo thứ tự:

1. `created_at` (ISO)
2. `chat_id`
3. `telegram_user_id`
4. `telegram_username`
5. `amount`
6. `purpose`
7. `category`
8. `time`
9. `source`
10. `raw_message`
