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
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${CONFIG.ADMIN} V11.1</title>
            <style>
                :root { --neon-g: #00ff41; --neon-p: #bc13fe; --bg: #050505; }
                body { background: var(--bg); color: var(--neon-g); font-family: 'Consolas', monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .container { width: 95%; max-width: 500px; background: #000; border: 1px solid var(--neon-g); border-radius: 15px; padding: 20px; box-shadow: 0 0 20px rgba(0,255,65,0.15); text-align: center; }
                h1 { font-size: 1.5rem; color: #fff; text-shadow: 0 0 10px var(--neon-g); margin: 0; }
                .status-bar { font-size: 0.7rem; color: #666; margin-bottom: 20px; text-transform: uppercase; border-bottom: 1px solid #222; padding-bottom: 10px; }
                
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
                .card { background: #111; border: 1px solid #333; padding: 15px; border-radius: 10px; position: relative; overflow: hidden; }
                .card h3 { font-size: 0.8rem; margin: 0 0 10px 0; color: #aaa; }
                .res-val { font-size: 1.8rem; font-weight: 900; margin: 5px 0; }
                .tai { color: #ff0000; text-shadow: 0 0 10px #ff0000; }
                .xiu { color: #0088ff; text-shadow: 0 0 10px #0088ff; }
                .conf { font-size: 0.7rem; color: var(--neon-p); }

                .btn-group { display: grid; grid-template-columns: 1fr; gap: 10px; }
                .btn { padding: 12px; border: 1px solid var(--neon-g); color: var(--neon-g); background: transparent; border-radius: 8px; cursor: pointer; text-decoration: none; font-size: 0.8rem; transition: 0.3s; }
                .btn:hover { background: var(--neon-g); color: #000; box-shadow: 0 0 15px var(--neon-g); }
                .btn.active { background: var(--neon-g); color: #000; font-weight: bold; }
                
                .log-box { margin-top: 15px; padding: 10px; background: #0a0a0a; border: 1px dashed #444; font-size: 0.65rem; color: #888; text-align: left; height: 40px; overflow-y: auto; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${CONFIG.ADMIN} <span style="color:var(--neon-p)">SUPREME</span></h1>
                <div class="status-bar">System Status: <span id="time">Loading...</span></div>
                
                <div class="grid">
                    <div class="card">
                        <h3>SẢNH NỔ HŨ</h3>
                        <div id="nohu-res" class="res-val">--</div>
                        <div id="nohu-conf" class="conf">Confidence: 0%</div>
                    </div>
                    <div class="card">
                        <h3>SẢNH MD5</h3>
                        <div id="md5-res" class="res-val">--</div>
                        <div id="md5-conf" class="conf">Confidence: 0%</div>
                    </div>
                </div>

                <div class="btn-group">
                    <button onclick="fetchData('hybrid', this)" class="btn active">HYBRID ENGINE (CODE + AI)</button>
                    <button onclick="fetchData('grok', this)" class="btn">GROK AI ONLY</button>
                    <button onclick="fetchData('railway', this)" class="btn">RAILWAY CORE (FAST)</button>
                </div>

                <div id="log" class="log-box">>> Ready to scan pattern...</div>
                <div style="font-size: 0.6rem; margin-top: 15px; color: #333;">AUTO-REFRESH EVERY 15S</div>
            </div>

            <script>
                async function fetchData(provider, btn) {
                    // Update UI
                    document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
                    if(btn) btn.classList.add('active');
                    
                    document.getElementById('log').innerText = ">> Accessing " + provider.toUpperCase() + "...";
                    
                    try {
                        const res = await fetch('/api/dual-engine?provider=' + provider);
                        const json = await res.json();
                        
                        // Update NoHu
                        const nohu = json.results.NOHU;
                        const nohuEl = document.getElementById('nohu-res');
                        nohuEl.innerText = nohu.predict;
                        nohuEl.className = 'res-val ' + (nohu.predict === 'TÀI' ? 'tai' : 'xiu');
                        document.getElementById('nohu-conf').innerText = "Confidence: " + nohu.confidence + " | " + nohu.accuracy.rate;

                        // Update MD5
                        const md5 = json.results.MD5;
                        const md5El = document.getElementById('md5-res');
                        md5El.innerText = md5.predict;
                        md5El.className = 'res-val ' + (md5.predict === 'TÀI' ? 'tai' : 'xiu');
                        document.getElementById('md5-conf').innerText = "Confidence: " + md5.confidence + " | " + md5.accuracy.rate;

                        document.getElementById('log').innerText = ">> Session: " + nohu.next_session + " | Analysis: " + nohu.analysis;
                        document.getElementById('time').innerText = json.server_time;

                    } catch (e) {
                        document.getElementById('log').innerText = ">> Error: Sync failed!";
                    }
                }

                // Auto refresh
                fetchData('hybrid');
                setInterval(() => fetchData('hybrid'), 15000);
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`🚀 ${CONFIG.ADMIN} V11.1 FIXED ONLINE PORT ${PORT}`);
    setInterval(runSync, CONFIG.SYNC_MS);
});
