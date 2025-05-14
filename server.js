const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PAYFAST_ENV = process.env.PAYFAST_ENV || 'production';

// Load passphrase for signature validation
const PASSPHRASE = PAYFAST_ENV === 'sandbox'
  ? process.env.PAYFAST_PASSPHRASE_SANDBOX
  : process.env.PAYFAST_PASSPHRASE_PROD;

// Middleware to log every request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Use bodyParser to read urlencoded bodies (important for PayFast)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Optional log to file
function logToFile(message) {
  const logPath = path.join(__dirname, 'webhook.log');
  const logEntry = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logPath, logEntry);
}

// Function to recreate PayFast signature
function generateSignature(data) {
  const keys = Object.keys(data).filter(k => k !== 'signature').sort();
  const str = keys.map(key => `${key}=${decodeURIComponent(data[key])}`).join('&');
  const fullString = str + (PASSPHRASE ? `&passphrase=${PASSPHRASE}` : '');
  console.log('Signature string:', fullString);
  return crypto.createHash('md5').update(fullString).digest('hex');
}

// Main webhook handler
app.post('/payfast-notify', async (req, res) => {
  try {
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    const payload = req.body;
    logToFile(`Received payload: ${JSON.stringify(payload)}`);

    // Signature check
    const localSig = generateSignature(payload);
    console.log('Expected Signature:', localSig);
    console.log('Received Signature:', payload.signature);

    if (payload.signature !== localSig) {
      logToFile(`Invalid signature! Expected: ${localSig}, Got: ${payload.signature}`);
      return res.status(400).send('Invalid signature');
    }

    // Forward to Salesforce if SF_WEBHOOK_URL is defined
    const SF_ENDPOINT = process.env.SF_WEBHOOK_URL;
    if (SF_ENDPOINT) {
      console.log(`Posting to Salesforce at ${SF_ENDPOINT}`);
      const sfResponse = await axios.post(SF_ENDPOINT, payload);
      console.log('Salesforce response status:', sfResponse.status);
      logToFile(`Posted to Salesforce: ${sfResponse.status}`);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Error handling webhook:', err.message);
    logToFile(`Error: ${err.message}`);
    res.status(500).send('Server error');
  }
});

// Optional root route for Render health check
app.get('/', (req, res) => {
  res.send('PayFast Webhook Server is running 🚀');
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
