/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V11.0 - THE SUPREME DUAL-ENGINE (FIXED)
 * ADMIN: TUANX3000 | VERSION: 11.0 FINAL PRO MAX - FIXED
 * NỀN TẢNG: RAILWAY.APP | STYLE: CYBER-TECH NEON
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
    VERSION: "11.0 SUPREME FIXED",
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
            'TTXXTT': 'X', 'XXTTXX': 'T', 'TTTXXX': 'T', 'XXXTTT': 'X'   // ← FIXED: bỏ khoảng trắng
        };

        if (patterns[last6]) return { res: patterns[last6] === 'T' ? 'Tài' : 'Xỉu', conf: '92%', log: 'Pattern Markov detected' };

        // Cân bằng tần suất 20 phiên
        const countT = h.slice(-20).filter(x => x.result === 'Tài').length;
        if (countT >= 13) return { res: 'Xỉu', conf: '84%', log: 'High Frequency Reset' };
        if (countT <= 7) return { res: 'Tài', conf: '84%', log: 'Low Frequency Reset' };

        return { res: h[h.length - 1].result === 'Tài' ? 'Xỉu' : 'Tài', conf: '70%', log: 'Counter-Trend Default' };
    }
};

// ================== 🤖 AI ENGINE (GROK) - ĐÃ FIX RẤT MẠNH ==================
async function callGrok(mode) {
    if (!GROK_API_KEY) {
        return { du_doan: "TÀI", tin_cay: "50%", phan_tich: "No GROK_API_KEY configured" };
    }

    const sequence = DATA_STORE[mode].history.slice(-15).map(x => x.result).join(' → ');

    try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${GROK_API_KEY}` 
            },
            body: JSON.stringify({
                model: CONFIG.GROK_MODEL,
                messages: [
                    { role: "system", content: "Bạn là Expert Data Analyst chuyên dự đoán Tài Xỉu. Trả về CHÍNH XÁC JSON, KHÔNG thêm bất kỳ chữ nào khác." },
                    { role: "user", content: `History ${mode.toUpperCase()}: ${sequence}\n\nDự đoán kết quả phiên TIẾP THEO (chỉ TÀI hoặc XỈU).\nTrả về JSON DUY NHẤT, KHÔNG markdown, KHÔNG giải thích:\n{"du_doan":"TÀI","tin_cay":"89%","phan_tich":"phân tích ngắn gọn"}` }
                ],
                temperature: 0.3
            })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON an toàn hơn
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) throw new Error('No JSON found');

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            du_doan: parsed.du_doan || "TÀI",
            tin_cay: parsed.tin_cay || "70%",
            phan_tich: parsed.phan_tich || "Grok analysis completed"
        };

    } catch (e) {
        console.error(`[Grok Error] ${mode} →`, e.message);
        return { 
            du_doan: "XỈU", 
            tin_cay: "50%", 
            phan_tich: `Grok API Error: ${e.message}` 
        };
    }
}

// ================== 🔄 REAL-TIME SYNC ENGINE (không thay đổi) ==================
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

                if (state.lastPrediction && 
                    state.lastPrediction.session === latest.session && 
                    !state.processedSessions.has(latest.session)) {
                    
                    if (state.lastPrediction.res.toUpperCase() === latest.result.toUpperCase()) state.stats.win++;
                    else state.stats.loss++;
                    state.stats.total++;
                    state.processedSessions.add(latest.session);
                }

                state.history = cleanList;

                if (state.processedSessions.size > 100) state.processedSessions.clear();
            }
        } catch (err) {
            console.error(`Sync fail: ${key} →`, err.message);
        }
    }
}

// ================== 🖥️ CYBER-TECH DASHBOARD (không thay đổi) ==================
app.get('/', (req, res) => {
    // ... (giữ nguyên HTML cũ của bạn)
    res.send(`...`); // giữ nguyên như code cũ của bạn
});

// ================== ⚡ API DUAL-ENGINE (không thay đổi logic) ==================
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
                prediction = { res: a.res, conf: "96%", log: "✅ Consensus Met (Code & AI Agree)" };
            } else {
                prediction = parseFloat(a.conf) > parseFloat(g.tin_cay) ? a : { res: g.du_doan, conf: g.tin_cay, log: "🤖 AI Primary Analysis" };
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
    console.log(`🚀 ${CONFIG.ADMIN} V11.0 FIXED ONLINE PORT ${PORT}`);
    runSync();
    setInterval(runSync, CONFIG.SYNC_MS);
});