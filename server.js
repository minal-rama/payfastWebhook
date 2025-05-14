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

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Optional: Log to file
function logToFile(message) {
  const logPath = path.join(__dirname, 'webhook.log');
  const logEntry = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logPath, logEntry);
}

// Recreate PayFast signature string
function generateSignature(data) {
  const keys = Object.keys(data).filter(k => k !== 'signature').sort();
  const str = keys.map(key => `${key}=${decodeURIComponent(data[key])}`).join('&');
  return crypto.createHash('md5').update(str + (PASSPHRASE ? `&passphrase=${PASSPHRASE}` : '')).digest('hex');
}

// Handle PayFast IPN POST
app.post('/payfast-notify', async (req, res) => {
  try {
    const payload = req.body;

    logToFile(`Received payload: ${JSON.stringify(payload)}`);

    // Validate signature
    const localSig = generateSignature(payload);
    if (payload.signature !== localSig) {
      logToFile(`Invalid signature! Expected: ${localSig}, Got: ${payload.signature}`);
      return res.status(400).send('Invalid signature');
    }

    // Optional: post to Salesforce
    const SF_ENDPOINT = process.env.SF_WEBHOOK_URL; // Set this in Render
    if (SF_ENDPOINT) {
      const sfResponse = await axios.post(SF_ENDPOINT, payload);
      logToFile(`Posted to Salesforce: ${sfResponse.status}`);
    }

    res.status(200).send('OK');
  } catch (err) {
    logToFile(`Error: ${err.message}`);
    res.status(500).send('Server error');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
