const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(bodyParser.urlencoded({ extended: false })); // PayFast posts form data

// Logging helper
function logToFile(message) {
  fs.appendFileSync('webhook.log', `[${new Date().toISOString()}] ${message}\n`);
}

app.post('/payfast-notify', async (req, res) => {
  const payload = req.body;
  logToFile(`Received: ${JSON.stringify(payload)}`);

  try {
    // TODO: validate PayFast data here (IP, signature, etc.)

    // Example: Forward to Salesforce
    const sfResponse = await axios.post(
      'https://YOUR_INSTANCE.salesforce.com/services/apexrest/payfast',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.SF_TOKEN}`,
          'Content-Type': 'application/json',
        }
      }
    );

    logToFile(`Salesforce response: ${sfResponse.status}`);
    res.status(200).send('OK');
  } catch (err) {
    logToFile(`Error: ${err.message}`);
    res.status(500).send('Webhook processing failed');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logToFile(`Server started on port ${PORT}`);
});
