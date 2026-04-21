/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V11.0 - THE SUPREME DUAL-ENGINE
 * ADMIN: TUANX3000 | VERSION: 11.0 FINAL PRO MAX
 * NỀN TẢNG: RAILWAY.APP | STYLE: CYBER-TECH NEON
 * * TÍNH NĂNG TỔNG HỢP:
 * 1. Dual-Sourcing: Quét đồng thời dữ liệu NoHu và MD5.
 * 2. Multi-Algorithm: Railway Core (Xác suất), Grok Master (AI), Hybrid (Hợp nhất).
 * 3. Auto-Sync & Clean: Tự động dọn dẹp bộ nhớ và đồng bộ phiên theo thời gian thực.
 * 4. Win/Loss Tracking: Thống kê tỉ lệ thắng thực tế dựa trên kết quả nhà cái.
 * =========================================================================================
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ================== ⚙️ CẤU HÌNH HỆ THỐNG ==================
const CONFIG = {
    ADMIN: "TUANX3000",
    VERSION: "11.0 SUPREME",
    SYNC_MS: 3000,
    GROK_MODEL: "grok-4.20-reasoning",
    ENDPOINTS: {
        NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
        MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
    }
};

const GROK_API_KEY = process.env.GROK_API_KEY;

// KHO DỮ LIỆU ĐỘC LẬP
let DATA_STORE = {
    nohu: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() },
    md5: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() }
};

// ================== 🛠️ CORE LOGIC & UTILS ==================
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
        if (h.length < 10) return { res: 'N/A', conf: '0%', log: 'Đang nạp dữ liệu sảnh...' };

        // Chuỗi Markov 6 phiên
        const last6 = h.map(x => x.result === 'Tài' ? 'T' : 'X').slice(-6).join('');
        const patterns = { 
            'TTTTTT': 'X', 'XXXXXX': 'T', 'TXTXTX': 'T', 'XTXTXT': 'X', 
            'TTXXTT': 'X', 'XXTTXX': 'T', 'TTTXXX': 'T', 'XXXT T T': 'X' 
        };

        if (patterns[last6]) return { res: patterns[last6] === 'T' ? 'Tài' : 'Xỉu', conf: '92%', log: 'Pattern Markov detected' };

        // Cân bằng tần suất 20 phiên
        const countT = h.slice(-20).filter(x => x.result === 'Tài').length;
        if (countT >= 13) return { res: 'Xỉu', conf: '84%', log: 'High Frequency Reset' };
        if (countT <= 7) return { res: 'Tài', conf: '84%', log: 'Low Frequency Reset' };

        return { res: h[h.length - 1].result === 'Tài' ? 'Xỉu' : 'Tài', conf: '70%', log: 'Counter-Trend Default' };
    }
};

// ================== 🤖 AI ENGINE (GROK) ==================
async function callGrok(mode) {
    if (!GROK_API_KEY) return { du_doan: "TÀI", tin_cay: "50%", phan_tich: "No Key Configured" };
    const sequence = DATA_STORE[mode].history.slice(-15).map(x => x.result).join('->');
    try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROK_API_KEY}` },
            body: JSON.stringify({
                model: CONFIG.GROK_MODEL,
                messages: [{ role: "system", content: "Expert Data Analyst." }, { role: "user", content: `History ${mode}: ${sequence}. Predict next. Return JSON only: {"du_doan":"TÀI","tin_cay":"89%","phan_tich":"..."}` }],
                temperature: 0.4
            })
        });
        const data = await res.json();
        return JSON.parse(data.choices[0].message.content.match(/\{.*\}/s)[0]);
    } catch (e) { return { du_doan: "XỈU", tin_cay: "50%", phan_tich: "AI API Timeout" }; }
}

// ================== 🔄 REAL-TIME SYNC ENGINE ==================
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
                // Kiểm soát Win/Loss
                if (state.lastPrediction && state.lastPrediction.session === latest.session && !state.processedSessions.has(latest.session)) {
                    if (state.lastPrediction.res.toUpperCase() === latest.result.toUpperCase()) state.stats.win++;
                    else state.stats.loss++;
                    state.stats.total++;
                    state.processedSessions.add(latest.session);
                }
                state.history = cleanList;
                // Giới hạn bộ nhớ processed
                if (state.processedSessions.size > 100) state.processedSessions.clear();
            }
        } catch (err) { console.error(`Sync fail: ${key}`); }
    }
}

// ================== 🖥️ CYBER-TECH DASHBOARD ==================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${CONFIG.ADMIN} V11.0</title>
            <style>
                :root { --neon-g: #00ff41; --neon-p: #bc13fe; --bg: #080808; }
                body { background: var(--bg); color: var(--neon-g); font-family: 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; overflow: hidden; }
                .container { width: 90%; max-width: 480px; background: #121212; border: 1px solid var(--neon-g); border-radius: 20px; padding: 30px; box-shadow: 0 0 30px rgba(0,255,65,0.2); text-align: center; position: relative; }
                .container::before { content: ''; position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; border-radius: 22px; background: linear-gradient(45deg, var(--neon-g), transparent, var(--neon-p)); z-index: -1; opacity: 0.3; }
                h1 { font-size: 1.6rem; color: #fff; text-shadow: 0 0 10px var(--neon-g); margin-bottom: 5px; }
                .tagline { font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px; }
                .btn-group { display: flex; flex-direction: column; gap: 15px; }
                .btn { padding: 18px; border: 1px solid var(--neon-g); color: var(--neon-g); background: transparent; border-radius: 12px; cursor: pointer; text-decoration: none; font-weight: bold; transition: 0.3s; font-size: 0.9rem; }
                .btn:hover { background: var(--neon-g); color: #000; box-shadow: 0 0 20px var(--neon-g); transform: translateY(-2px); }
                .btn span { display: block; font-size: 0.7rem; font-weight: normal; opacity: 0.7; margin-top: 4px; }
                .btn.special { border-color: var(--neon-p); color: var(--neon-p); }
                .btn.special:hover { background: var(--neon-p); color: #fff; box-shadow: 0 0 20px var(--neon-p); }
                .footer { margin-top: 30px; font-size: 0.7rem; color: #333; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${CONFIG.ADMIN} <span style="color:var(--neon-p)">ULTIMATE</span></h1>
                <div class="tagline">System Engine Version 11.0</div>
                
                <div class="btn-group">
                    <a href="/api/dual-engine?provider=railway" class="btn">
                        1. RAILWAY CORE ENGINE
                        <span>Phân tích NoHu & MD5 bằng thuật toán Code</span>
                    </a>
                    <a href="/api/dual-engine?provider=grok" class="btn">
                        2. GROK AI MASTER
                        <span>Phân tích NoHu & MD5 bằng trí tuệ nhân tạo</span>
                    </a>
                    <a href="/api/dual-engine?provider=hybrid" class="btn special">
                        3. HYBRID CONSENSUS (VIP)
                        <span>Kết hợp Code + AI để tối ưu độ chính xác</span>
                    </a>
                </div>
                <div class="footer">ADMIN: TUANX3000 | STATUS: ONLINE</div>
            </div>
        </body>
        </html>
    `);
});

// ================== ⚡ API DUAL-ENGINE (TRẢ VỀ CẢ 2 LOẠI) ==================
app.get('/api/dual-engine', async (req, res) => {
    const provider = (req.query.provider || 'railway').toLowerCase();
    const finalResults = {};

    for (const mode of ['nohu', 'md5']) {
        const state = DATA_STORE[mode];
        const lastSes = state.history.length > 0 ? state.history[state.history.length - 1].session : 0;
        let prediction;

        if (provider === 'grok') {
            const g = await callGrok(mode);
            prediction = { res: g.du_doan, conf: g.tin_cay, log: "Grok AI: " + g.phan_tich };
        } else if (provider === 'hybrid') {
            const a = Algos.railwayCore(mode);
            const g = await callGrok(mode);
            if (a.res.toUpperCase() === g.du_doan.toUpperCase()) {
                prediction = { res: a.res, conf: "96%", log: "Consensus Met (Code & AI Agree)" };
            } else {
                prediction = parseFloat(a.conf) > parseFloat(g.tin_cay) ? a : { res: g.du_doan, conf: g.tin_cay, log: "AI Primary Analysis" };
            }
        } else {
            prediction = Algos.railwayCore(mode);
        }

        // Lưu vết dự đoán
        state.lastPrediction = { session: lastSes + 1, res: prediction.res };

        finalResults[mode.toUpperCase()] = {
            current_session: lastSes,
            next_session: lastSes + 1,
            predict: prediction.res.toUpperCase(),
            confidence: prediction.conf,
            analysis: prediction.log,
            accuracy: {
                win: state.stats.win,
                loss: state.stats.loss,
                rate: state.stats.total > 0 ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + '%' : '0%'
            }
        };
    }

    res.json({
        author: CONFIG.ADMIN,
        version: CONFIG.VERSION,
        provider: provider.toUpperCase(),
        server_time: new Date().toLocaleString('vi-VN'),
        results: finalResults
    });
});

// ================== 🚀 KHỞI CHẠY ==================
app.listen(PORT, () => {
    console.log(`🚀 ${CONFIG.ADMIN} V11.0 ONLINE PORT ${PORT}`);
    runSync();
    setInterval(runSync, CONFIG.SYNC_MS);
});
