const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow external site embeddings/calls if needed
}));
app.use(cors());
app.use(express.json());

// Market Prices Cache
let cachedPrices = {
    boiGordo: { price: '---', date: '---', trend: 'neutral' },
    bezerro: { price: '---', date: '---', trend: 'neutral' },
    lastUpdate: null
};

async function updatePrices() {
    try {
        console.log('Fetching market prices...');
        // CEPEA Boi Gordo
        const boiRes = await axios.get('https://www.cepea.esalq.usp.br/br/indicador/boi-gordo.aspx', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $boi = cheerio.load(boiRes.data);
        const boiPrice = $boi('#imagenet-indicador-1 tbody tr:first-child td:nth-child(2)').text().trim();
        const boiDate = $boi('#imagenet-indicador-1 tbody tr:first-child td:nth-child(1)').text().trim();
        
        // CEPEA Bezerro
        const bezRes = await axios.get('https://www.cepea.esalq.usp.br/br/indicador/bezerro.aspx', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $bez = cheerio.load(bezRes.data);
        const bezPrice = $bez('#imagenet-indicador-1 tbody tr:first-child td:nth-child(2)').text().trim();
        const bezDate = $bez('#imagenet-indicador-1 tbody tr:first-child td:nth-child(1)').text().trim();

        cachedPrices = {
            boiGordo: { price: `R$ ${boiPrice}`, date: boiDate, trend: 'up' },
            bezerro: { price: `R$ ${bezPrice}`, date: bezDate, trend: 'up' },
            lastUpdate: new Date().toISOString()
        };
        console.log('Prices updated successfully');
    } catch (error) {
        console.error('Error fetching prices:', error.message);
    }
}

// Initial fetch and interval (1 hour)
updatePrices();
setInterval(updatePrices, 3600000);

// Endpoints
app.get('/api/prices', (req, res) => {
    res.json(cachedPrices);
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, systemPrompt } = req.body;
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'OpenRouter API Key not configured' });
        }

        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "google/gemini-2.0-flash-exp:free",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://meat-equity.vercel.app',
                'X-Title': 'Meat Equity Platform',
                'Content-Type': 'application/json'
            }
        });

        const text = response.data.choices[0].message.content;
        res.json({ text });
    } catch (error) {
        console.error('OpenRouter Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(port, () => console.log(`Server running on port ${port}`));
