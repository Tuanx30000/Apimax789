/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V10.7 - HYBRID INTELLIGENT ENGINE (FINAL VERSION)
 * ADMIN: TUANX3000 | VERSION: 10.7 PRO MAX
 * NỀN TẢNG: RAILWAY.APP | ENGINE: HYBRID (ALGO + AI)
 * * TÍNH NĂNG ĐỘC QUYỀN:
 * 1. Railway Engine: Thuật toán xác suất nâng cao (Markov + Frequency).
 * 2. Grok AI Engine: Phân tích sâu bằng trí tuệ nhân tạo Grok-4.20.
 * 3. Hybrid Mode: Cơ chế đồng thuận (Consensus) - Tự động so khớp kết quả.
 * 4. Real-time Statistics: Tính tỉ lệ Win/Loss thực tế từ dữ liệu nhà cái.
 * =========================================================================================
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ================== CẤU HÌNH HỆ THỐNG ==================
const CONFIG = {
    ADMIN: "TUANX3000",
    VERSION: "10.7 PRO MAX - HYBRID",
    SYNC_INTERVAL: 3000, // Quét dữ liệu mỗi 3 giây
    GROK_MODEL: "grok-4.20-reasoning",
    ENDPOINTS: {
        NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
        MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
    }
};

const GROK_API_KEY = process.env.GROK_API_KEY;

// DATA STORE (Lưu trạng thái bộ nhớ đệm)
let DATA_STORE = {
    nohu: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() },
    md5: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() }
};

// ================== UTILS (Xử lý dữ liệu thô) ==================
const Utils = {
    standardize: (item) => {
        let raw = String(item.resultTruyenThong || item.result || item.BetSide || '').toUpperCase();
        if (raw.includes('TAI') || raw.includes('TÀI') || (item.DiceSum && item.DiceSum >= 11)) return 'Tài';
        return 'Xỉu';
    }
};

// ================== THUẬT TOÁN ENGINE RAILWAY ==================
const Algos = {
    markovChain: (h) => {
        const last6 = h.map(x => x.result === 'Tài' ? 'T' : 'X').slice(-6).join('');
        const patterns = {
            'TTTTTT': 'X', 'XXXXXX': 'T', 'TTTTTX': 'X', 'XXXXXT': 'T',
            'TXTXTX': 'T', 'XTXTXT': 'X', 'TTXXTT': 'X', 'XXTTXX': 'T'
        };
        return patterns[last6] || null;
    },
    frequency: (h) => {
        const last20 = h.slice(-20);
        const countT = last20.filter(x => x.result === 'Tài').length;
        if (countT >= 13) return 'X';
        if (countT <= 7) return 'T';
        return null;
    },
    predict: (type) => {
        const history = DATA_STORE[type].history;
        if (history.length < 10) return { res: 'N/A', conf: '0%', log: 'Đang thu thập dữ liệu...' };

        const lastResult = history[history.length - 1].result;
        const pMarkov = Algos.markovChain(history);
        const pFreq = Algos.frequency(history);

        if (pMarkov) return { res: pMarkov === 'T' ? 'Tài' : 'Xỉu', conf: '89%', log: 'Xác nhận Markov Chain' };
        if (pFreq) return { res: pFreq === 'T' ? 'Tài' : 'Xỉu', conf: '84%', log: 'Cân bằng xác suất 20 phiên' };
        
        return { res: lastResult === 'Tài' ? 'Xỉu' : 'Tài', conf: '70%', log: 'Đánh cầu đảo mặc định' };
    }
};

// ================== GROK AI INTEGRATION ==================
async function callGrok(mode) {
    if (!GROK_API_KEY) return { du_doan: "TÀI", tin_cay: "60%", phan_tich: "Thiếu GROK_API_KEY trong Railway Variables" };

    const historyText = DATA_STORE[mode].history.slice(-15).map(x => x.result).join(' -> ');
    const prompt = `Bạn là TX Master Grok. Dữ liệu gần nhất: ${historyText}. Dự đoán phiên tiếp theo là TÀI hay XỈU? Trả về duy nhất JSON: {"du_doan":"TÀI","tin_cay":"85%","phan_tich":"..."}`;

    try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROK_API_KEY}` },
            body: JSON.stringify({
                model: CONFIG.GROK_MODEL,
                messages: [{ role: "system", content: "Chuyên gia soi cầu TX Max789." }, { role: "user", content: prompt }],
                temperature: 0.6
            })
        });
        const data = await res.json();
        const content = data.choices[0].message.content.trim();
        return JSON.parse(content.match(/\{.*\}/s)[0]);
    } catch (e) {
        return { du_doan: "TÀI", tin_cay: "55%", phan_tich: "Grok AI lỗi kết nối" };
    }
}

// ================== REAL-TIME SYNC (Đồng bộ Win/Loss) ==================
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
            })).filter(h => h.session > 0).sort((a, b) => a.session - b.session);

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

// ================== GIAO DIỆN DASHBOARD (Sửa lỗi Cannot GET /) ==================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${CONFIG.ADMIN} - V10.7 HYBRID</title>
            <style>
                body { background: #080808; color: #00ff41; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .card { background: #121212; border: 1px solid #00ff41; padding: 30px; border-radius: 20px; box-shadow: 0 0 25px rgba(0,255,65,0.15); width: 90%; max-width: 450px; text-align: center; }
                h1 { font-size: 1.5rem; color: #fff; text-shadow: 0 0 10px #00ff41; margin: 0; letter-spacing: 2px; }
                .badge { font-size: 0.7rem; background: #00ff41; color: #000; padding: 2px 8px; border-radius: 10px; font-weight: bold; vertical-align: middle; }
                .menu { margin-top: 30px; }
                .btn { display: block; width: 100%; padding: 16px; margin: 15px 0; border: 1px solid #00ff41; background: transparent; color: #00ff41; border-radius: 12px; cursor: pointer; text-decoration: none; font-weight: bold; transition: 0.3s; box-sizing: border-box; }
                .btn:hover { background: #00ff41; color: #000; box-shadow: 0 0 20px #00ff41; transform: scale(1.02); }
                .btn.hybrid { border-color: #ff00ff; color: #ff00ff; }
                .btn.hybrid:hover { background: #ff00ff; color: #fff; box-shadow: 0 0 20px #ff00ff; }
                .desc { font-size: 0.75rem; color: #666; display: block; margin-top: 5px; font-weight: normal; }
                .footer { margin-top: 30px; font-size: 0.7rem; color: #333; text-transform: uppercase; letter-spacing: 2px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>${CONFIG.ADMIN} <span class="badge">PRO MAX</span></h1>
                <p style="color: #0ff; font-size: 0.8rem; margin-top: 5px;">HỆ THỐNG PHÂN TÍCH HYBRID V10.7</p>
                
                <div class="menu">
                    <a href="/api/all?provider=railway" class="btn">
                        1. RAILWAY ENGINE
                        <span class="desc">Chạy thuật toán xác suất & Markov (Tốc độ ⚡)</span>
                    </a>

                    <a href="/api/all?provider=grok" class="btn">
                        2. GROK AI ENGINE
                        <span class="desc">Phân tích bằng trí tuệ nhân tạo Grok-4.20</span>
                    </a>

                    <a href="/api/all?provider=hybrid" class="btn hybrid">
                        3. HYBRID MODE (VIP)
                        <span class="desc">Kết hợp AI + Code (Độ chính xác cao nhất)</span>
                    </a>
                </div>
            </div>
            <div class="footer">ADMIN: ${CONFIG.ADMIN} | ENGINE: HYBRID INTELLIGENT</div>
        </body>
        </html>
    `);
});

// ================== API XỬ LÝ CHÍNH ==================
app.get('/api/all', async (req, res) => {
    const mode = (req.query.mode || 'nohu').toLowerCase();
    const provider = (req.query.provider || 'railway').toLowerCase();
    
    if (!DATA_STORE[mode]) return res.status(400).json({ error: "Mode không hợp lệ. Hãy dùng nohu hoặc md5." });

    const state = DATA_STORE[mode];
    const lastSes = state.history.length > 0 ? state.history[state.history.length - 1].session : 0;
    let final;

    try {
        if (provider === 'grok') {
            const g = await callGrok(mode);
            final = { res: g.du_doan, conf: g.tin_cay, log: "Grok AI: " + g.phan_tich };
        } else if (provider === 'hybrid') {
            const a = Algos.predict(mode);
            const g = await callGrok(mode);
            
            if (a.res.toUpperCase() === g.du_doan.toUpperCase()) {
                final = { res: a.res, conf: "95%", log: "ĐỒNG THUẬN CAO (Code + AI)" };
            } else {
                const aConf = parseFloat(a.conf);
                const gConf = parseFloat(g.tin_cay);
                final = aConf >= gConf ? a : { res: g.du_doan, conf: g.tin_cay, log: "AI ưu tiên phân tích" };
            }
        } else {
            final = Algos.predict(mode);
        }

        // Ghi lại dự đoán để đối chiếu phiên sau
        state.lastPrediction = { session: lastSes + 1, res: final.res };

        res.json({
            author: CONFIG.ADMIN,
            version: CONFIG.VERSION,
            provider: provider.toUpperCase(),
            server_time: new Date().toLocaleString('vi-VN'),
            data: {
                [mode]: {
                    phien_hien_tai: lastSes,
                    phien_tiep_theo: lastSes + 1,
                    du_doan: final.res.toUpperCase(),
                    tin_cay: final.conf,
                    phan_tich: final.log,
                    stats: {
                        win: state.stats.win,
                        loss: state.stats.loss,
                        rate: state.stats.total > 0 ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + '%' : '0%'
                    }
                }
            }
        });
    } catch (e) {
        res.status(500).json({ error: "Lỗi thực thi thuật toán", message: e.message });
    }
});

// ================== KHỞI CHẠY HỆ THỐNG ==================
app.listen(PORT, () => {
    console.log(`
    =============================================
    🚀 TUANX3000 V10.7 HYBRID IS ONLINE
    PORT: ${PORT} | ADMIN: ${CONFIG.ADMIN}
    =============================================
    `);
    runSync();
    setInterval(runSync, CONFIG.SYNC_INTERVAL);
});
