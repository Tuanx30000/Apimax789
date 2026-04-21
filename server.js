/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V11.1 - THE SUPREME DUAL-ENGINE (RE-FIXED)
 * ADMIN: TUANX3000 | VERSION: 11.1 FINAL - OPTIMIZED FOR RAILWAY
 * =========================================================================================
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080; // Railway thường dùng 8080 hoặc động

app.use(cors());
app.use(express.json());

// ================== ⚙️ CẤU HÌNH HỆ THỐNG ==================
const CONFIG = {
    ADMIN: "TUANX3000",
    VERSION: "11.1 SUPREME RE-FIXED",
    SYNC_MS: 3000,
    GROK_MODEL: "grok-2-1212", // Update model mới nhất của X.AI
    ENDPOINTS: {
        NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
        MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
    }
};

const GROK_API_KEY = process.env.GROK_API_KEY;

let DATA_STORE = {
    nohu: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() },
    md5: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() }
};

// ================== 🛠️ CORE LOGIC ==================
const Utils = {
    standardize: (item) => {
        let raw = String(item.resultTruyenThong || item.result || item.BetSide || '').toUpperCase();
        if (raw.includes('TAI') || raw.includes('TÀI') || (item.DiceSum && item.DiceSum >= 11)) return 'Tài';
        return 'Xỉu';
    }
};

const Algos = {
    railwayCore: (mode) => {
        const h = DATA_STORE[mode].history;
        if (h.length < 10) return { res: 'N/A', conf: '0%', log: 'Đang nạp dữ liệu...' };

        const last6 = h.map(x => x.result === 'Tài' ? 'T' : 'X').slice(-6).join('');
        const patterns = { 
            'TTTTTT': 'X', 'XXXXXX': 'T', 'TXTXTX': 'T', 'XTXTXT': 'X', 
            'TTXXTT': 'X', 'XXTTXX': 'T', 'TTTXXX': 'T', 'XXXTTT': 'X' 
        };

        if (patterns[last6]) return { res: patterns[last6] === 'T' ? 'Tài' : 'Xỉu', conf: '92%', log: 'Pattern Markov' };

        const countT = h.slice(-20).filter(x => x.result === 'Tài').length;
        if (countT >= 13) return { res: 'Xỉu', conf: '84%', log: 'Overbought Reset' };
        if (countT <= 7) return { res: 'Tài', conf: '84%', log: 'Oversold Reset' };

        return { res: h[h.length - 1].result === 'Tài' ? 'Xỉu' : 'Tài', conf: '70%', log: 'Dynamic Counter' };
    }
};

// ================== 🤖 AI ENGINE ==================
async function callGrok(mode) {
    if (!GROK_API_KEY) return { du_doan: "XỈU", tin_cay: "50%", phan_tich: "Missing API Key" };
    
    const sequence = DATA_STORE[mode].history.slice(-15).map(x => x.result).join(' ');
    try {
        const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROK_API_KEY}` },
            body: JSON.stringify({
                model: CONFIG.GROK_MODEL,
                messages: [
                    { role: "system", content: "You are a gambling probability expert. Respond ONLY with JSON." },
                    { role: "user", content: `History: ${sequence}. Predict next result (TÀI/XỈU). Return: {"du_doan":"TÀI","tin_cay":"85%","phan_tich":"..."}` }
                ],
                temperature: 0.2
            })
        });
        const data = await response.json();
        return JSON.parse(data.choices[0].message.content.match(/\{.*\}/s)[0]);
    } catch (e) {
        return { du_doan: "TÀI", tin_cay: "50%", phan_tich: "AI Bypass" };
    }
}

// ================== 🔄 SYNC ==================
async function runSync() {
    for (const key of ['nohu', 'md5']) {
        try {
            const response = await fetch(CONFIG.ENDPOINTS[key.toUpperCase()]);
            const json = await response.json();
            const list = Array.isArray(json) ? json : (json.list || json.data || []);
            const state = DATA_STORE[key];

            const cleanList = list.map(item => ({
                session: Number(item.id || item.SessionId || 0),
                result: Utils.standardize(item)
            })).filter(i => i.session > 0).sort((a, b) => a.session - b.session);

            if (cleanList.length > 0) {
                const latest = cleanList[cleanList.length - 1];
                if (state.lastPrediction && state.lastPrediction.session === latest.session && !state.processedSessions.has(latest.session)) {
                    if (state.lastPrediction.res.toUpperCase() === latest.result.toUpperCase()) state.stats.win++;
                    else state.stats.loss++;
                    state.stats.total++;
                    state.processedSessions.add(latest.session);
                }
                state.history = cleanList;
            }
        } catch (err) { console.error(`Sync error: ${key}`); }
    }
}

// ================== 🖥️ DASHBOARD HTML ==================
app.get('/', (req, res) => {
    res.send(`
    <html>
        <head>
            <title>TUANX3000 V11.1</title>
            <style>
                body { background: #0a0a0a; color: #00ff00; font-family: 'Courier New', monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .box { border: 2px solid #00ff00; padding: 20px; box-shadow: 0 0 15px #00ff00; background: rgba(0,255,0,0.05); border-radius: 10px; width: 80%; max-width: 500px; text-align: center; }
                h1 { text-shadow: 0 0 10px #00ff00; margin-bottom: 10px; }
                .status { color: #ff00ff; font-weight: bold; }
                .footer { margin-top: 20px; font-size: 0.8em; opacity: 0.6; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>🚀 TUANX3000 V11.1</h1>
                <p>SERVER STATUS: <span class="status">ONLINE (PORT ${PORT})</span></p>
                <p>AI ENGINE: <span style="color: cyan;">GROK-2-1212</span></p>
                <hr style="border-color: #00ff00;">
                <p>API Endpoint: <code>/api/dual-engine?provider=hybrid</code></p>
            </div>
            <div class="footer">ADMIN: TUANX3000 | RAILWAY DEPLOYED</div>
        </body>
    </html>
    `);
});

// ================== ⚡ API DUAL-ENGINE ==================
app.get('/api/dual-engine', async (req, res) => {
    const provider = (req.query.provider || 'hybrid').toLowerCase();
    const finalResults = {};

    for (const mode of ['nohu', 'md5']) {
        const state = DATA_STORE[mode];
        const lastSes = state.history.length > 0 ? state.history[state.history.length - 1].session : 0;
        let prediction;

        if (provider === 'grok') {
            const g = await callGrok(mode);
            prediction = { res: g.du_doan, conf: g.tin_cay, log: g.phan_tich };
        } else {
            const a = Algos.railwayCore(mode);
            const g = await callGrok(mode);
            if (a.res.toUpperCase() === g.du_doan.toUpperCase()) {
                prediction = { res: a.res, conf: "96%", log: "✅ Consensus" };
            } else {
                prediction = parseFloat(a.conf) > parseFloat(g.tin_cay) ? a : { res: g.du_doan, conf: g.tin_cay, log: "🤖 AI Focus" };
            }
        }

        state.lastPrediction = { session: lastSes + 1, res: prediction.res };
        finalResults[mode.toUpperCase()] = {
            session: lastSes + 1,
            predict: prediction.res.toUpperCase(),
            confidence: prediction.conf,
            analysis: prediction.log,
            win_rate: state.stats.total > 0 ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + '%' : '0%'
        };
    }

    res.json({ status: "SUCCESS", data: finalResults });
});

app.listen(PORT, () => {
    console.log(`🚀 ${CONFIG.ADMIN} V11.1 FIXED ONLINE PORT ${PORT}`);
    setInterval(runSync, CONFIG.SYNC_MS);
});
