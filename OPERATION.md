Runbook triển khai trên Render (Telegram → Webhook → Groq → Google Sheets)
0) Bạn đã có sẵn gì trong code
App đang dùng Express, có POST /telegram/webhook để nhận update từ Telegram và GET /health để healthcheck.
App cần các biến môi trường Telegram/Groq/Sheets được khai báo sẵn trong .env.example.
README đã mô tả cách set webhook Telegram và yêu cầu HTTPS public (Render đáp ứng).
1) Chuẩn bị Google Sheets
Tạo Google Sheet (ví dụ: so_chi_tieu).
Lấy spreadsheetId từ URL Sheet.
Share Sheet cho GOOGLE_SERVICE_ACCOUNT_EMAIL với quyền Editor.
Tạo tab đúng tên GOOGLE_SHEET_NAME (ví dụ Sheet1).
Cột dữ liệu app sẽ append vào A:J theo thứ tự đã ghi trong README.
2) Chuẩn bị Telegram Bot
Tạo bot qua @BotFather, lấy TELEGRAM_BOT_TOKEN.
Tạo 1 chuỗi random làm TELEGRAM_WEBHOOK_SECRET (khuyến nghị).
3) Tạo Web Service trên Render
Vào Render → New + → Web Service.
Connect GitHub repo sochitieu.
Cấu hình:
Environment: Node
Build Command: npm install
Start Command: npm start
Thêm Environment Variables (copy từ .env.example):
PORT=3000
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
GOOGLE_SPREADSHEET_ID=...
GOOGLE_SHEET_NAME=Sheet1
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=... (giữ \n escaped như mẫu).
DEFAULT_TIMEZONE=Asia/Ho_Chi_Minh
Vì app có check thiếu env khi boot, thiếu biến sẽ fail ngay (đây là đúng).
4) Verify service sau deploy
Sau khi Render cấp URL, test:
GET https://<your-render-service>.onrender.com/health → phải trả { ok: true }.
5) Đăng ký webhook Telegram trỏ về Render
Chạy lệnh (ở đâu cũng được: máy local, terminal online):
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-render-service>.onrender.com/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
Lệnh này đúng theo README hiện tại của repo.
6) Test end-to-end
Nhắn bot Telegram ví dụ:
150k ăn trưa với team hôm nay
Kỳ vọng:
Bot phản hồi ✅ Đã lưu: ...
Google Sheet có dòng mới ở A:J.
Nếu lỗi:
Bot sẽ trả tin nhắn fallback báo nhập rõ hơn.
7) Checklist production nên bật thêm (khuyến nghị)
Bật alert trên Render khi service down.
Theo dõi logs để bắt lỗi Groq/Sheets.
Xoay vòng API keys định kỳ.
Cân nhắc thêm rate-limit cho webhook endpoint.
Lỗi thường gặp (và cách xử lý nhanh)
401 Invalid secret token
TELEGRAM_WEBHOOK_SECRET trên Render khác với lúc setWebhook.
500 khi ghi Sheet
Chưa share Sheet cho service account, sai spreadsheetId, hoặc sai tab name.。
Groq parse lỗi
Tin nhắn quá mơ hồ hoặc key sai/hết quota; xem Render logs để biết response cụ thể.
Các lệnh em đã dùng để soạn runbook này
nl -ba README.md | sed -n '1,220p'
nl -ba .env.example | sed -n '1,220p'
nl -ba src/index.js | sed -n '1,260p'
Nếu anh muốn, em có thể gửi thêm một bản “copy-paste checklist 5 phút” cực ngắn để anh đưa cho team vận hành luôn.
