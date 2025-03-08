require('dotenv').config()
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const pino = require('pino');
const axios = require('axios');
const QRCode = require('qrcode');
const { Client } = require('whatsapp-web.js');

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

let base64qr = false;

const client = new Client({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

const send2AI = async (params, model = process.env.MODEL, role = 'user') => {
  try {
    const { data } = await axios.post(process.env.OLLAMA_API, {
      model: model,
      messages: [{ role: role, content: params }],
      stream: false
    }, { timeout: 3600000 });

    logger.info(data);
    return data.message.content.replace(/<think>[\s\S]*?<\/think>\s*/g, "").replace(/\n+/g, " ");
  } catch (error) {
    logger.error(error);
    throw "Maaf, AI sedang sibuk!";
  }
};

// Ketika Client Siap
client.on('ready', () => {
  logger.info('✅ WhatsApp Bot is Ready!');
});

// QR Code Event
client.on('qr', (qr) => {
  base64qr = qr;
  logger.info(`🚨 QR RECEIVED`);
});

// Pesan Masuk
client.on('message', async (message) => {
  const msg = message.body;
  
  if (msg.toLowerCase() === 'hello') {
    return client.sendMessage(message.from, 'Hello! I am your AI Assistant. Type **AI:** followed by your question.');
  }

  if (msg.toLowerCase() === '!ping') {
    return client.sendMessage(message.from, 'Pong! 🏓');
  }

  if (msg.startsWith("AI:") || msg.startsWith("ai:")) {
    const question = msg.replace(/^AI:\s*/i, "").trim();
    try {
      const result = await send2AI(question);
      return client.sendMessage(message.from, result);
    } catch (error) {
      return client.sendMessage(message.from, error);
    }
  }
});

// API Endpoint untuk QR
app.get('/', async (req, res) => {
  if (!base64qr) {
    return res.send('⏳ Loading QR... Please wait!');
  }
  const qrImage = await QRCode.toBuffer(base64qr);
  res.setHeader('Content-Type', 'image/png');
  res.send(qrImage);
});

// Test AI API
app.get('/AI', async (req, res) => {
  const { question } = req.query;
  if (!question) return res.status(400).send("Question is required!");

  try {
    const response = await send2AI(question);
    res.send(response);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Jalankan Server
app.listen(port, () => {
  client.initialize();
  logger.info(`🚀 Server running at http://localhost:${port}`);
});
