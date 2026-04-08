const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Caching for prices
let cachedPrices = {
    boiGordo: { price: '---', date: '---', trend: 'neutral' },
    bezerro: { price: '---', date: '---', trend: 'neutral' },
    lastUpdate: null
};

async function updatePrices() {
    try {
        // Fetch CEPEA Boi Gordo
        const boiRes = await axios.get('https://www.cepea.esalq.usp.br/br/indicador/boi-gordo.aspx');
        const $boi = cheerio.load(boiRes.data);
        const boiPrice = $boi('#imagenet-indicador-1 tbody tr:first-child td:nth-child(2)').text().trim();
        const boiDate = $boi('#imagenet-indicador-1 tbody tr:first-child td:nth-child(1)').text().trim();
        
        // Fetch CEPEA Bezerro
        const bezRes = await axios.get('https://www.cepea.esalq.usp.br/br/indicador/bezerro.aspx');
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

// Update prices every 1 hour
setInterval(updatePrices, 3600000);
updatePrices(); // Initial fetch

app.get('/api/prices', (req, res) => {
    res.json(cachedPrices);
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, systemPrompt } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();

        res.json({ text });
    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
