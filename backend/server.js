const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const DERIV_APP_ID = 1089; // Default Deriv public testing App ID

// Persistent WebSocket connection 
let ws;
let isWsConnected = false;

function connectDerivWS() {
    ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`);

    ws.on('open', () => {
        console.log('Connected to Deriv WebSocket API');
        isWsConnected = true;
    });

    ws.on('close', () => {
        console.log('Disconnected. Reconnecting to Deriv API...');
        isWsConnected = false;
        setTimeout(connectDerivWS, 5000);
    });

    ws.on('error', (err) => {
        console.error('WebSocket Error:', err);
    });
}

connectDerivWS();

// Helper function to fetch data via WebSocket
function fetchDerivData(requestPayload) {
    return new Promise((resolve, reject) => {
        if (!isWsConnected) return reject('WebSocket not connected');

        const listener = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.req_id === requestPayload.req_id) {
                ws.removeEventListener('message', listener);
                if (data.error) reject(data.error.message);
                else resolve(data);
            }
        };

        ws.addEventListener('message', listener);
        ws.send(JSON.stringify(requestPayload));
    });
}

app.get('/api/analyze/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    const reqId = Math.floor(Math.random() * 100000);

    try {
        // Fetch last 10 M5 (300 seconds) candles [cite: 19]
        const candleRequest = {
            ticks_history: symbol,
            adjust_start_time: 1,
            count: 10,
            end: "latest",
            granularity: 300, 
            style: "candles",
            req_id: reqId
        };

        const response = await fetchDerivData(candleRequest);
        const candles = response.candles;

        if (!candles || candles.length < 10) {
            return res.status(400).json({ error: 'Insufficient market data' });
        }

        // Identify Highest High and Lowest Low [cite: 20, 21, 22]
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const resistance = Math.max(...highs);
        const support = Math.min(...lows);
        
        // Current active price [cite: 24, 27]
        const currentPrice = candles[candles.length - 1].close; 

        let signalData = {
            status: "Hold - Consolidating", // Null State [cite: 30]
            direction: null,
            entry: currentPrice,
            tp: null,
            sl: null,
            resistance,
            support
        };

        // Signal Generation Logic [cite: 23]
        if (currentPrice >= resistance + 2) {
            // BUY Signal Trigger [cite: 24]
            signalData.status = "Signal Generated";
            signalData.direction = "BUY";
            signalData.sl = support; // [cite: 25]
            signalData.tp = currentPrice + ((currentPrice - support) * 2); // [cite: 26]
        } else if (currentPrice <= support - 2) {
            // SELL Signal Trigger [cite: 27]
            signalData.status = "Signal Generated";
            signalData.direction = "SELL";
            signalData.sl = resistance; // [cite: 28]
            signalData.tp = currentPrice - ((resistance - currentPrice) * 2); // [cite: 29]
        }

        // Round numeric values to 2 decimal places for clean UI output
        if (signalData.direction) {
            signalData.entry = parseFloat(signalData.entry.toFixed(4));
            signalData.tp = parseFloat(signalData.tp.toFixed(4));
            signalData.sl = parseFloat(signalData.sl.toFixed(4));
        }

        res.json(signalData);

    } catch (error) {
        res.status(500).json({ error: error === 'WebSocket not connected' ? 'Reconnecting to Deriv API...' : 'Market data unavailable' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
