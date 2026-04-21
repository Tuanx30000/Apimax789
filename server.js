/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V11.1 - THE SUPREME DASHBOARD
 * ADMIN: TUANX3000 | STYLE: CYBER-TECH NEON
 * =========================================================================================
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// ================== ⚙️ CẤU HÌNH HỆ THỐNG ==================
const CONFIG = {
    ADMIN: "TUANX3000",
    VERSION: "11.1 SUPREME",
    SYNC_MS: 3000,
    GROK_MODEL: "grok-2-1212",
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

// ================== 🛠️ CORE UTILS ==================
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
        if (h.length < 10) return { res: 'N/A', conf: '0%', log: 'Dữ liệu chưa đủ' };
        const last6 = h.map(x => x.result === 'Tài' ? 'T' : 'X').slice(-6).join('');
        const patterns = { 'TTTTTT': 'X', 'XXXXXX': 'T', 'TXTXTX': 'T', 'XTXTXT': 'X' };
        if (patterns[last6]) return { res: patterns[last6] === 'T' ? 'Tài' : 'Xỉu', conf: '92%', log: 'Pattern Detected' };
        return { res: h[h.length - 1].result === 'Tài' ? 'Xỉu' : 'Tài', conf: '70%', log: 'Counter-Trend' };
    }
};

async function callGrok(mode) {
    if (!GROK_API_KEY) return { du_doan: "TÀI", tin_cay: "50%", phan_tich: "No Key" };
    try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROK_API_KEY}` },
            body: JSON.stringify({
                model: CONFIG.GROK_MODEL,
                messages: [{ role: "user", content: `History: ${DATA_STORE[mode].history.slice(-10).map(x=>x.result).join(',')}. Predict next. Return JSON: {"du_doan":"TÀI","tin_cay":"80%"}` }],
                temperature: 0.2
            })
        });
        const d = await res.json();
        return JSON.parse(d.choices[0].message.content.match(/\{.*\}/s)[0]);
    } catch (e) { return { du_doan: "XỈU", tin_cay: "50%", phan_tich: "Error" }; }
}

async function runSync() {
    for (const key of ['nohu', 'md5']) {
        try {
            const response = await fetch(CONFIG.ENDPOINTS[key.toUpperCase()]);
            const json = await response.json();
            const list = Array.isArray(json) ? json : (json.list || json.data || []);
            const state = DATA_STORE[key];
            const cleanList = list.map(item => ({ session: Number(item.id || item.SessionId || 0), result: Utils.standardize(item) })).filter(i => i.session > 0).sort((a, b) => a.session - b.session);
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
        } catch (err) {}
    }
}

// ================== 🖥️ UI DASHBOARD ==================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${CONFIG.ADMIN} ULTIMATE</title>
            <style>
                :root { --neon-g: #00ff41; --neon-p: #bc13fe; --bg: #080808; }
                body { background: var(--bg); color: var(--neon-g); font-family: 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .container { width: 90%; max-width: 480px; background: #121212; border: 1px solid var(--neon-g); border-radius: 20px; padding: 30px; box-shadow: 0 0 30px rgba(0,255,65,0.2); text-align: center; }
                h1 { font-size: 1.6rem; color: #fff; text-shadow: 0 0 10px var(--neon-g); margin-bottom: 5px; }
                .tagline { font-size: 0.75rem; color: #666; text-transform: uppercase; margin-bottom: 20px; }
                .result-box { display: none; background: #000; border: 1px solid #333; border-radius: 12px; padding: 15px; margin-bottom: 20px; text-align: left; font-family: monospace; }
                .btn-group { display: flex; flex-direction: column; gap: 12px; }
                .btn { padding: 15px; border: 1px solid var(--neon-g); color: var(--neon-g); background: transparent; border-radius: 10px; cursor: pointer; font-weight: bold; font-size: 0.85rem; transition: 0.3s; }
                .btn:hover { background: var(--neon-g); color: #000; box-shadow: 0 0 20px var(--neon-g); }
                .btn.special { border-color: var(--neon-p); color: var(--neon-p); }
                .btn.special:hover { background: var(--neon-p); color: #fff; }
                .loading { color: yellow; font-size: 0.8rem; display: none; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${CONFIG.ADMIN} <span style="color:var(--neon-p)">ULTIMATE</span></h1>
                <div class="tagline">Engine Version ${CONFIG.VERSION}</div>
                
                <div id="loading" class="loading">ĐANG PHÂN TÍCH DỮ LIỆU...</div>
                <div id="resultBox" class="result-box"></div>

                <div class="btn-group">
                    <button onclick="runPredict('railway')" class="btn">1. RAILWAY CORE ENGINE<span>(Thuật toán Code)</span></button>
                    <button onclick="runPredict('grok')" class="btn">2. GROK AI MASTER<span>(Trí tuệ nhân tạo)</span></button>
                    <button onclick="runPredict('hybrid')" class="btn special">3. HYBRID CONSENSUS (VIP)<span>(Code + AI Agree)</span></button>
                </div>
                <div style="margin-top:20px; font-size:0.6rem; color:#444">ADMIN: TUANX3000 | RAILWAY ONLINE</div>
            </div>

            <script>
                async function runPredict(p) {
                    const box = document.getElementById('resultBox');
                    const ld = document.getElementById('loading');
                    ld.style.display = 'block';
                    box.style.display = 'none';

                    try {
                        const r = await fetch('/api/dual-engine?provider=' + p);
                        const d = await r.json();
                        ld.style.display = 'none';
                        box.style.display = 'block';
                        
                        let html = '<div style="color:cyan">>>> HỆ THỐNG ' + p.toUpperCase() + '</div>';
                        for (let key in d.results) {
                            let item = d.results[key];
                            let color = item.predict === 'TÀI' ? '#ff4444' : '#44aaff';
                            html += '<div style="margin-top:10px; border-top:1px solid #222; padding-top:5px">' +
                                    '<b>' + key + ':</b> <span style="color:'+color+'">' + item.predict + '</span> (' + item.confidence + ')<br>' +
                                    '<small style="color:#666">Phiên: ' + item.next_session + ' | Winrate: ' + item.accuracy.rate + '</small></div>';
                        }
                        box.innerHTML = html;
                    } catch(e) {
                        ld.innerText = "LỖI KẾT NỐI SERVER!";
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// ================== ⚡ API ==================
app.get('/api/dual-engine', async (req, res) => {
    const provider = (req.query.provider || 'railway').toLowerCase();
    const finalResults = {};
    for (const mode of ['nohu', 'md5']) {
        const state = DATA_STORE[mode];
        const lastSes = state.history.length > 0 ? state.history[state.history.length - 1].session : 0;
        let p;
        if (provider === 'grok') {
            const g = await callGrok(mode);
            p = { res: g.du_doan, conf: g.tin_cay, log: "AI" };
        } else if (provider === 'hybrid') {
            const a = Algos.railwayCore(mode), g = await callGrok(mode);
            p = a.res === g.du_doan ? { res: a.res, conf: "96%", log: "Consensus" } : a;
        } else { p = Algos.railwayCore(mode); }

        state.lastPrediction = { session: lastSes + 1, res: p.res };
        finalResults[mode.toUpperCase()] = {
            next_session: lastSes + 1,
            predict: p.res.toUpperCase(),
            confidence: p.conf,
            analysis: p.log,
            accuracy: { rate: state.stats.total > 0 ? ((state.stats.win/state.stats.total)*100).toFixed(1)+'%' : '0%' }
        };
    }
    res.json({ results: finalResults });
});

app.listen(PORT, () => {
    console.log(`🚀 ${CONFIG.ADMIN} ONLINE PORT ${PORT}`);
    setInterval(runSync, CONFIG.SYNC_MS);
});
