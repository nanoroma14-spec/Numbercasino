/**
 * Простой бэкенд для Telegram Clicker (плоская структура)
 * Все файлы лежат в корне репозитория
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Раздаём фронтенд (index.html лежит в той же папке)
app.use(express.static(__dirname));

// ============ НАСТРОЙКИ ============
const BOT_TOKEN = process.env.BOT_TOKEN; // токен от @BotFather
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.warn('⚠️  BOT_TOKEN не задан! Укажи его в переменных окружения.');
}

// Простая "база" в памяти
const paidUsers = new Map();

// ============ Создание инвойса Stars ============
app.post('/api/create-invoice', async (req, res) => {
  try {
    const { userId, productId, amount, title, description } = req.body;

    if (!userId || !productId || !amount) {
      return res.status(400).json({ error: 'Не хватает данных' });
    }

    if (!BOT_TOKEN) {
      return res.status(500).json({ error: 'BOT_TOKEN не настроен на сервере' });
    }

    const payload = JSON.stringify({ userId, productId, ts: Date.now() });

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || 'Покупка в игре',
        description: description || 'Внутриигровой товар',
        payload,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: title || 'Товар', amount: Number(amount) }]
      })
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram error:', data);
      return res.status(500).json({ error: data.description || 'Ошибка Telegram' });
    }

    res.json({ invoiceLink: data.result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ============ Webhook от Telegram ============
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  const update = req.body;

  if (update.pre_checkout_query) {
    const queryId = update.pre_checkout_query.id;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pre_checkout_query_id: queryId,
        ok: true
      })
    });
    return res.sendStatus(200);
  }

  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    try {
      const payload = JSON.parse(payment.invoice_payload);
      const { userId, productId } = payload;
      console.log(`✅ Оплата: user ${userId}, product ${productId}, ${payment.total_amount} Stars`);

      if (!paidUsers.has(userId)) paidUsers.set(userId, new Set());
      paidUsers.get(userId).add(productId);
    } catch (e) {
      console.error('Ошибка разбора payload', e);
    }
  }

  res.sendStatus(200);
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasToken: !!BOT_TOKEN });
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  if (!BOT_TOKEN) {
    console.log('   ⚠️  Не забудь указать BOT_TOKEN');
  }
});
