const express = require('express');
const app = express();
const port = 3000;
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

const client = new Client();
let base64qr = false;

const send2AI = (params, model ='deepseek-r1:1.5b', role='user') => {
  return axios.post('http://192.168.100.222/ollama/api/chat', {
    "model": model,
    "messages": [
      {
        "role": role,
        "content": params
      }
    ],
    "stream": false
  }, {
    timeout: 3600000
  })
  .then(function (response) {
    logger.info(response.data)
    return response.data
  })
  .catch(function (error) {
    logger.error(error)
    throw(error);
  });
}

// Ketika Client Siap
client.once('ready', () => {
  logger.info('Client is ready!');
});

// Ketika menerima QR
client.on('qr', (qr) => {
  base64qr = qr; // QR disimpan di variable
  logger.info(`QR RECEIVED : ${qr}`);
});

// Listener pesan masuk
client.on('message_create', message => {
  const msg = message.body
  if ( msg === 'hello') {
      return client.sendMessage(message.from, 'hello i am a personal asistant please type "AI:" before type message for response from AI, example "AI: why the color sky blue?" ')
  }
  if (msg === '!ping') {
    return client.sendMessage(message.from, 'pong');
  }
  if (msg.startsWith("AI:") || msg.startsWith("ai:") ){
    return send2AI(msg.replace(/^AI:\s*/i, "").trim()).then(response => {
      let result = response.message.content.replace(/<think>[\s\S]*?<\/think>\s*/g, "");
      result = result.replace(/\n+/g, " ");
      result = result.replace(/<think>[\s\S]*?<\/think>\s*/g, "").replace(/<\/think>\s*/g, " ")
      return client.sendMessage(message.from, result);
    }).catch(error => client.sendMessage(message.from, error))
   
  }
});

// API Generate QR
app.get('/', async (req, res) => {
  try {
    if (!base64qr) {
      return res.send('Loading QR... please wait!');
    }

    // Generate QR dari Base64 ke PNG Buffer
    const qrImage = await QRCode.toBuffer(base64qr);

    // Set Header Response Image
    res.setHeader('Content-Type', 'image/png');
    res.send(qrImage);
  } catch (error) {
    logger.error(error);
    res.status(500).send('Failed to generate QR Code');
  }
});

app.get('/AI', async (req, res) => {
  try {
  const { question } = req.params
  logger.debug(req)
  const response = await send2AI(question)
  let result = response.message.content.replace(/<think>[\s\S]*?<\/think>\s*/g, "");

  result = result.replace(/\n+/g, " ");
  result = result.replace(/<think>[\s\S]*?<\/think>\s*/g, "").replace(/<\/think>\s*/g, " ")

  res.send(result.trim());
  } catch (error) {
    logger.error(error);
    res.status(500).send('Failed to generate QR Code');
  }
});

// Jalankan Server
app.listen(port, () => {
  client.initialize();
  logger.info(`Example app listening on port http://localhost:${port}`);
});
