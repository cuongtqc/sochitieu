import express from 'express';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const {
  PORT = 3000,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET,
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-2.0-flash',
  GOOGLE_SPREADSHEET_ID,
  GOOGLE_SHEET_NAME = 'Sheet1',
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh',
} = process.env;

const requiredEnv = [
  'TELEGRAM_BOT_TOKEN',
  'GEMINI_API_KEY',
  'GOOGLE_SPREADSHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
];

const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length > 0) {
  throw new Error(`Thiếu biến môi trường: ${missing.join(', ')}`);
}

const app = express();
app.use(express.json());

const serviceAccountPrivateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

const auth = new google.auth.JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: serviceAccountPrivateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    amount: {
      type: 'number',
      description: 'Số tiền theo đơn vị VND, chỉ là số.',
    },
    purpose: {
      type: 'string',
      description: 'Mục đích chi tiêu hoặc thu nhập.',
    },
    category: {
      type: 'string',
      description: 'Nhóm chi tiêu/thu nhập phù hợp như ăn uống, di chuyển, lương, giải trí.',
    },
    time: {
      type: 'string',
      description: 'Thời gian chuẩn ISO-8601 nếu xác định được, nếu không dùng ngày hiện tại theo timezone.',
    },
    source: {
      type: 'string',
      description: 'Nguồn tiền: ví dụ tiền mặt, tài khoản ngân hàng, momo, lương, chưa rõ.',
    },
    raw_message: {
      type: 'string',
      description: 'Tin nhắn gốc người dùng gửi.',
    },
  },
  required: ['amount', 'purpose', 'category', 'time', 'source', 'raw_message'],
};

async function extractExpenseWithGemini(rawMessage) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const instruction = [
    'Bạn là hệ thống trích xuất dữ liệu chi tiêu/thu nhập tiếng Việt.',
    'Trả về JSON đúng schema.',
    'amount bắt buộc là số, không có dấu chấm phẩy hay ký tự tiền tệ.',
    `Nếu người dùng không ghi ngày, suy ra ngày hiện tại theo timezone ${DEFAULT_TIMEZONE}.`,
    'source nếu không rõ thì ghi "chưa rõ".',
  ].join(' ');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: instruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: rawMessage }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API lỗi (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini không trả về dữ liệu hợp lệ.');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Không parse được JSON từ Gemini: ${text}`);
  }

  return parsed;
}

async function appendToSheet({ telegramUserId, telegramUsername, chatId, extracted }) {
  const row = [
    new Date().toISOString(),
    chatId,
    telegramUserId,
    telegramUsername ?? '',
    extracted.amount,
    extracted.purpose,
    extracted.category,
    extracted.time,
    extracted.source,
    extracted.raw_message,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `${GOOGLE_SHEET_NAME}!A:J`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [row],
    },
  });
}

async function sendTelegramMessage(chatId, text) {
  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram sendMessage lỗi (${response.status}): ${errorText}`);
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/telegram/webhook', async (req, res) => {
  try {
    if (TELEGRAM_WEBHOOK_SECRET) {
      const tokenHeader = req.get('x-telegram-bot-api-secret-token');
      if (tokenHeader !== TELEGRAM_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Invalid secret token' });
      }
    }

    const message = req.body?.message;
    const text = message?.text?.trim();

    if (!message || !text) {
      return res.status(200).json({ ok: true, skipped: 'no-text-message' });
    }

    const chatId = message.chat.id;
    const telegramUserId = message.from?.id;
    const telegramUsername = message.from?.username;

    const extracted = await extractExpenseWithGemini(text);

    extracted.raw_message = text;

    await appendToSheet({
      chatId,
      telegramUserId,
      telegramUsername,
      extracted,
    });

    await sendTelegramMessage(
      chatId,
      `✅ Đã lưu: ${extracted.amount} VND | ${extracted.purpose} | ${extracted.category}`,
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);

    const fallbackChatId = req.body?.message?.chat?.id;
    if (fallbackChatId) {
      try {
        await sendTelegramMessage(
          fallbackChatId,
          '❌ Mình chưa xử lý được tin nhắn này. Bạn thử ghi rõ: số tiền + mục đích + ngày (nếu có).',
        );
      } catch (telegramError) {
        console.error('Không gửi được tin nhắn lỗi về Telegram:', telegramError.message);
      }
    }

    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Webhook server running at http://localhost:${PORT}`);
});
