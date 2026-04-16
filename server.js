/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V10.6 - 2 CHẾ ĐỘ: RAILWAY + GROK TX MASTER
 * ADMIN: TUANX3000 | VERSION: 10.6 PRO MAX
 * CHẾ ĐỘ 1: Thuật toán cũ (Railway) 
 * CHẾ ĐỘ 2: Grok AI (provider=grok)
 * WIN/LOSE/RATE LUÔN CHÍNH XÁC TỪ DỮ LIỆU THỰC TẾ
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
    VERSION: "10.6 PRO MAX - 2 MODE",
    SYNC_INTERVAL: 3000,
    GROK_MODEL: "grok-4.20-reasoning",
    ENDPOINTS: {
        NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
        MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
    }
};

// LẤY KEY TỪ RAILWAY VARIABLES
const GROK_API_KEY = process.env.GROK_API_KEY;

// ================== DATA STORE ==================
let DATA_STORE = {
    nohu: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() },
    md5: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() }
};

// ================== UTILS ==================
const Utils = {
    standardize: (item) => {
        let raw = String(item.resultTruyenThong || item.result || item.BetSide || '').toUpperCase();
        if (raw.includes('TAI') || raw.includes('TÀI') || (item.DiceSum && item.DiceSum >= 11)) return 'Tài';
        return 'Xỉu';
    }
};

// ================== THUẬT TOÁN (ĐẦY ĐỦ NHƯ CODE CŨ) ==================
const Algos = {
    markovChain: (h) => {
        const last4 = h.map(x => x.result === 'Tài' ? 'T' : 'X').slice(-4).join('');
        const patterns = { 'TTTT': 'X', 'XXXX': 'T', 'TXTX': 'T', 'XTXT': 'X', 'TTXX': 'T', 'XXTT': 'X' };
        return patterns[last4] || null;
    },
    frequency: (h) => {
        const countT = h.slice(-12).filter(x => x.result === 'Tài').length;
        if (countT >= 8) return 'X';
        if (countT <= 4) return 'T';
        return null;
    },
    trendFollow: (h) => {
        const last3 = h.slice(-3);
        if (last3.length < 3) return null;
        if (last3.every(v => v.result === last3[0].result)) return last3[0].result;
        return null;
    }
};

function predictNext(type) {
    const history = DATA_STORE[type].history;
    if (history.length < 10) return { res: 'N/A', conf: '0%', log: 'Đang nạp dữ liệu' };

    const lastResult = history[history.length - 1].result;
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].result === lastResult) streak++;
        else break;
    }

    if (streak >= 3 && streak <= 5) {
        return { res: lastResult, conf: '88%', log: `THEO BỆT ${streak + 1} TAY` };
    }

    let votes = { T: 0, X: 0 };
    const pMarkov = Algos.markovChain(history);
    const pFreq = Algos.frequency(history);
    const pTrend = Algos.trendFollow(history);

    if (pMarkov === 'T') votes.T += 2; else if (pMarkov === 'X') votes.X += 2;
    if (pFreq === 'T') votes.T += 1; else if (pFreq === 'X') votes.X += 1;
    if (pTrend === 'T') votes.T += 1; else if (pTrend === 'X') votes.X += 1;

    if (votes.T > votes.X) return { res: 'Tài', conf: '78%', log: 'AI VOTE TÀI' };
    if (votes.X > votes.T) return { res: 'Xỉu', conf: '78%', log: 'AI VOTE XỈU' };

    return { res: lastResult === 'Tài' ? 'Xỉu' : 'Tài', conf: '65%', log: 'ĐÁNH CẦU ĐẢO' };
}

// ================== GROK TX MASTER ==================
async function callGrokTX(mode) {
    if (!GROK_API_KEY) {
        return { du_doan: "TÀI", tin_cay: "65%", phan_tich: "Không có key Grok", stats: DATA_STORE[mode].stats };
    }

    const prompt = `Bạn là TX Master Grok - chuyên gia Tài Xỉu Max789.
Mode hiện tại: ${mode.toUpperCase()}.
Dự đoán ván tiếp theo là TÀI hay XỈU.
Trả về đúng JSON sau:

{
  "du_doan": "TÀI" hoặc "XỈU",
  "tin_cay": "82%",
  "phan_tich": "Lý do ngắn gọn",
  "stats": {
    "win": ${DATA_STORE[mode].stats.win},
    "loss": ${DATA_STORE[mode].stats.loss},
    "rate": "${DATA_STORE[mode].stats.total > 0 ? ((DATA_STORE[mode].stats.win / DATA_STORE[mode].stats.total) * 100).toFixed(1) : 0}%"
  }
}`;

    try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROK_API_KEY}`
            },
            body: JSON.stringify({
                model: CONFIG.GROK_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.65,
                max_tokens: 700
            })
        });

        const data = await res.json();
        const text = data.choices[0].message.content.trim();
        const result = JSON.parse(text);

        result.stats = result.stats || {};
        result.stats.win = DATA_STORE[mode].stats.win;
        result.stats.loss = DATA_STORE[mode].stats.loss;
        result.stats.rate = DATA_STORE[mode].stats.total > 0 
            ? ((DATA_STORE[mode].stats.win / DATA_STORE[mode].stats.total) * 100).toFixed(1) + '%' 
            : '0%';

        return result;
    } catch (err) {
        console.error("Grok Error:", err.message);
        return { du_doan: "TÀI", tin_cay: "68%", phan_tich: "Grok lỗi tạm thời", stats: DATA_STORE[mode].stats };
    }
}

// ================== SYNC DỮ LIỆU ==================
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
                if (state.lastPrediction && state.lastPrediction.session === latest.session) {
                    if (!state.processedSessions.has(latest.session)) {
                        if (state.lastPrediction.res === latest.result) state.stats.win++;
                        else state.stats.loss++;
                        state.stats.total++;
                        state.processedSessions.add(latest.session);
                    }
                }
                state.history = cleanList;
            }
        } catch (err) {
            console.log(`Sync error ${key}`);
        }
    }
}

// ================== API ROUTES ==================
app.get('/', (req, res) => {
    res.send(`<h1 style="text-align:center; padding:50px; color:#00ffcc;">🚀 TUANX3000 V10.6<br>API is running!</h1>`);
});

app.get('/api/all', async (req, res) => {
    const mode = req.query.mode || 'nohu';
    const provider = req.query.provider || 'railway';

    try {
        let resultData;

        if (provider === 'grok') {
            const grokResult = await callGrokTX(mode);
            const lastSes = DATA_STORE[mode].history.length > 0 ? DATA_STORE[mode].history[DATA_STORE[mode].history.length - 1].session : 0;

            resultData = {
                phien_hien_tai: lastSes,
                phien_tiep: lastSes + 1,
                du_doan: grokResult.du_doan,
                tin_cay: grokResult.tin_cay,
                phan_tich: grokResult.phan_tich,
                stats: grokResult.stats
            };
        } else {
            const s = DATA_STORE[mode];
            const lastSes = s.history.length > 0 ? s.history[s.history.length - 1].session : 0;
            const pred = predictNext(mode);
            s.lastPrediction = { session: lastSes + 1, res: pred.res };

            resultData = {
                phien_hien_tai: lastSes,
                phien_tiep: lastSes + 1,
                du_doan: pred.res,
                tin_cay: pred.conf,
                phan_tich: pred.log,
                stats: {
                    win: s.stats.win,
                    loss: s.stats.loss,
                    rate: s.stats.total > 0 ? ((s.stats.win / s.stats.total) * 100).toFixed(1) + '%' : '0%'
                }
            };
        }

        res.json({
            author: CONFIG.ADMIN,
            version: CONFIG.VERSION,
            server_time: new Date().toLocaleString(),
            provider: provider,
            data: { [mode]: resultData }
        });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 TUANX3000 V10.6 ONLINE | Port: ${PORT}`);
    runSync();
    setInterval(runSync, CONFIG.SYNC_INTERVAL);
});