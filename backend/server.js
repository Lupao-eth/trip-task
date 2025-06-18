console.log('Starting backend server...');

require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiter: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Example: Proxy a POST to Supabase (adjust for your needs)
app.post('/api/supabase/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const response = await axios.post(
      `${process.env.SUPABASE_URL}/rest/v1/${table}`,
      req.body,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

// You can add GET, PUT, DELETE similarly

app.listen(3001, () => console.log('API proxy running on http://localhost:3001'));