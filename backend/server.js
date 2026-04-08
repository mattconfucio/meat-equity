const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

let cachedPrices = {
    boiGordo: { price: 'R$ 364,25', date: '07/04/2026', trend: 'up' }, // Realistic default
    bezerro: { price: 'R$ 3.305,87', date: '07/04/2026', trend: 'up' },
    lastUpdate: new Date().toISOString()
};

async function updatePrices() {
    try {
        console.log('Fetching prices from Notícias Agrícolas...');
        // Try Boi Gordo
        const boiRes = await axios.get('https://www.noticiasagricolas.com.br/cotacoes/boi-gordo', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $boi = cheerio.load(boiRes.data);
        const boiPrice = $('.tabela-cotacoes:first tbody tr:first-child td:nth-child(2)').text().trim();
        const boiDate = $('.tabela-cotacoes:first tbody tr:first-child td:nth-child(1)').text().trim();

        if (boiPrice) cachedPrices.boiGordo = { price: `R$ ${boiPrice}`, date: boiDate, trend: 'up' };

        // Try Bezerro (usually in the same or related page)
        const bezRes = await axios.get('https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/bezerro-ms-cepea', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $bez = cheerio.load(bezRes.data);
        const bezPrice = $('.tabela-cotacoes:first tbody tr:first-child td:nth-child(2)').text().trim();
        const bezDate = $('.tabela-cotacoes:first tbody tr:first-child td:nth-child(1)').text().trim();

        if (bezPrice) cachedPrices.bezerro = { price: `R$ ${bezPrice}`, date: bezDate, trend: 'up' };
        
        cachedPrices.lastUpdate = new Date().toISOString();
        console.log('Prices updated successfully');
    } catch (error) {
        console.error('Scraping error, using last known values:', error.message);
    }
}

updatePrices();
setInterval(updatePrices, 3600000);

app.get('/api/prices', (req, res) => res.json(cachedPrices));

app.post('/api/chat', async (req, res) => {
    try {
        const { message, systemPrompt } = req.body;
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) return res.status(500).json({ error: 'OpenRouter Key missing' });

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
                'X-Title': 'Meat Equity',
                'Content-Type': 'application/json'
            }
        });

        res.json({ text: response.data.choices[0].message.content });
    } catch (error) {
        console.error('Chat Error:', error.message);
        res.status(500).json({ error: 'Failed' });
    }
});

app.listen(port, () => console.log(`Server v2 running on ${port}`));
