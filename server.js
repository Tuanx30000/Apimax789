/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V10.7 - HYBRID INTELLIGENT ENGINE
 * ADMIN: TUANX3000 | VERSION: 10.7 PRO MAX
 * * TÍNH NĂNG CHÍNH:
 * 1. Railway     → Chỉ dùng thuật toán cũ (đã nâng cấp mạnh)
 * 2. Grok AI     → Chỉ dùng Grok phân tích
 * 3. Hybrid      → Kết hợp vote giữa thuật toán cũ + Grok (tối ưu nhất)
 * * Win/Loss/Rate luôn lấy từ dữ liệu thực tế (không fake)
 * Error handling cực mạnh, log rõ ràng, anti-crash
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
    SYNC_INTERVAL: 3000,
    GROK_MODEL: "grok-4.20-reasoning",
    ENDPOINTS: {
        NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
        MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
    }
};

// KEY GROK TỪ RAILWAY VARIABLES (AN TOÀN)
const GROK_API_KEY = process.env.GROK_API_KEY;

// ================== DATA STORE (LƯU TRỮ DỮ LIỆU THỰC TẾ) ==================
let DATA_STORE = {
    nohu: { 
        history: [], 
        lastPrediction: null, 
        stats: { win: 0, loss: 0, total: 0 }, 
        processedSessions: new Set() 
    },
    md5: { 
        history: [], 
        lastPrediction: null, 
        stats: { win: 0, loss: 0, total: 0 }, 
        processedSessions: new Set() 
    }
};

// ================== UTILS ==================
const Utils = {
    standardize: (item) => {
        let raw = String(item.resultTruyenThong || item.result || item.BetSide || '').toUpperCase();
        if (raw.includes('TAI') || raw.includes('TÀI') || (item.DiceSum && item.DiceSum >= 11)) return 'Tài';
        return 'Xỉu';
    }
};

// ================== THUẬT TOÁN CŨ ĐÃ NÂNG CẤP MẠNH (CHUẨN HƠN) ==================
const Algos = {
    markovChain: (h) => {
        const last6 = h.map(x => x.result === 'Tài' ? 'T' : 'X').slice(-6).join('');
        const patterns = {
            'TTTTTT': 'X', 'XXXXXX': 'T',
            'TTTTTX': 'X', 'XXXXXT': 'T',
            'TTTXTT': 'X', 'XXXTTX': 'T',
            'TXTXTX': 'T', 'XTXTXT': 'X',
            'TTXXTT': 'X', 'XXTTXX': 'T',
            'TXXTXX': 'T', 'XTTXTT': 'X'
        };
        return patterns[last6] || null;
    },

    frequency: (h) => {
        const countT = h.slice(-20).filter(x => x.result === 'Tài').length;
        if (countT >= 14) return 'X';
        if (countT <= 6) return 'T';
        if (countT >= 11) return 'X';
        if (countT <= 9) return 'T';
        return null;
    },

    trendFollow: (h) => {
        const last5 = h.slice(-5);
        if (last5.length < 5) return null;
        if (last5.every(v => v.result === last5[0].result)) return last5[0].result;
        return null;
    }
};

// ================== DỰ ĐOÁN TỔNG HỢP (NÂNG CẤP CAO) ==================
function predictNext(type) {
    const history = DATA_STORE[type].history;
    if (history.length < 10) return { res: 'N/A', conf: '0%', log: 'Đang nạp dữ liệu' };

    const lastResult = history[history.length - 1].result;

    // 1. Streak - Ưu tiên cao nhất
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].result === lastResult) streak++;
        else break;
    }
    if (streak >= 3 && streak <= 7) {
        return { res: lastResult, conf: '91%', log: `THEO BỆT MẠNH ${streak + 1} TAY` };
    }

    // 2. Vote nâng cao
    let votes = { T: 0, X: 0 };
    const pMarkov = Algos.markovChain(history);
    const pFreq = Algos.frequency(history);
    const pTrend = Algos.trendFollow(history);

    if (pMarkov === 'T') votes.T += 3;
    else if (pMarkov === 'X') votes.X += 3;

    if (pFreq === 'T') votes.T += 2;
    else if (pFreq === 'X') votes.X += 2;

    if (pTrend === 'T') votes.T += 2;
    else if (pTrend === 'X') votes.X += 2;

    // 3. Cân bằng dài hạn
    const countT20 = history.slice(-20).filter(x => x.result === 'Tài').length;
    if (countT20 > 14) votes.X += 4;
    if (countT20 < 6) votes.T += 4;

    if (votes.T > votes.X) return { res: 'Tài', conf: '84%', log: 'VOTE TÀI MẠNH (NÂNG CẤP)' };
    if (votes.X > votes.T) return { res: 'Xỉu', conf: '84%', log: 'VOTE XỈU MẠNH (NÂNG CẤP)' };

    return { res: lastResult === 'Tài' ? 'Xỉu' : 'Tài', conf: '70%', log: 'ĐÁNH CẦU ĐẢO' };
}

// ================== GROK TX MASTER ==================
async function callGrokTX(mode) {
    if (!GROK_API_KEY) {
        return { du_doan: "TÀI", tin_cay: "65%", phan_tich: "Không có key Grok", stats: DATA_STORE[mode].stats };
    }

    const prompt = `Bạn là TX Master Grok - chuyên gia Tài Xỉu Max789.
Mode: ${mode.toUpperCase()}.
Dự đoán ván tiếp theo là TÀI hay XỈU.
Trả về đúng JSON sau, không thêm bất kỳ chữ nào khác:

{
  "du_doan": "TÀI" hoặc "XỈU",
  "tin_cay": "85%",
  "phan_tich": "Lý do ngắn gọn, rõ ràng",
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
                temperature: 0.6,
                max_tokens: 700
            })
        });

        const data = await res.json();
        
        if (!data.choices || !data.choices[0]) {
             throw new Error("Grok trả về dữ liệu không hợp lệ");
        }

        let text = data.choices[0].message.content.trim();

        // FIX: Lấy đúng phần JSON đề phòng Grok nói thêm
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            text = text.substring(start, end + 1);
        }

        const result = JSON.parse(text);

        // Giữ win/loss/rate từ dữ liệu thực tế
        result.stats = result.stats || {};
        result.stats.win = DATA_STORE[mode].stats.win;
        result.stats.loss = DATA_STORE[mode].stats.loss;
        result.stats.rate = DATA_STORE[mode].stats.total > 0 
            ? ((DATA_STORE[mode].stats.win / DATA_STORE[mode].stats.total) * 100).toFixed(1) + '%' 
            : '0%';

        return result;
    } catch (err) {
        console.error("Grok Error:", err.message);
        return { 
            du_doan: "TÀI", 
            tin_cay: "68%", 
            phan_tich: "Grok lỗi tạm thời (" + err.message + ")", 
            stats: DATA_STORE[mode].stats 
        };
    }
}

// ================== SYNC DỮ LIỆU (TÍNH WIN/LOSS THỰC TẾ) ==================
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
                
                // Cập nhật Win/Loss nếu có phiên mới hoàn thành
                if (state.lastPrediction && state.lastPrediction.session === latest.session) {
                    if (!state.processedSessions.has(latest.session)) {
                        // So sánh uppercase để tránh lỗi case-sensitive
                        if (state.lastPrediction.res.toUpperCase() === latest.result.toUpperCase()) {
                            state.stats.win++;
                        } else {
                            state.stats.loss++;
                        }
                        state.stats.total++;
                        state.processedSessions.add(latest.session);
                    }
                }
                // Cập nhật mảng lịch sử mới nhất
                state.history = cleanList;
            }
        } catch (err) {
            console.log(`[SYNC ERROR] Lỗi đồng bộ data ${key.toUpperCase()}:`, err.message);
        }
    }
}

// ================== API CHÍNH (XỬ LÝ ĐA THUẬT TOÁN) ==================
app.get('/api/all', async (req, res) => {
    // 1. Lấy thông số từ User (mặc định là nohu và railway)
    const mode = (req.query.mode || 'nohu').toLowerCase();
    const provider = (req.query.provider || 'railway').toLowerCase();

    // Kiểm tra mode hợp lệ
    if (!DATA_STORE[mode]) {
        return res.status(400).json({ error: "Mode không hợp lệ. Sử dụng 'nohu' hoặc 'md5'" });
    }

    try {
        const state = DATA_STORE[mode];
        const lastSes = state.history.length > 0 ? state.history[state.history.length - 1].session : 0;
        let finalResult;

        // --- CHẾ ĐỘ 1: CHỈ DÙNG THUẬT TOÁN RAILWAY (OLD SCHOOL UPGRADED) ---
        if (provider === 'railway') {
            const pred = predictNext(mode);
            // Lưu lại để tính Win/Loss thực tế ở vòng Sync sau
            state.lastPrediction = { session: lastSes + 1, res: pred.res };
            
            finalResult = {
                du_doan: pred.res.toUpperCase(),
                tin_cay: pred.conf,
                phan_tich: pred.log,
            };
        } 

        // --- CHẾ ĐỘ 2: CHỈ DÙNG GROK AI (REASONING MODE) ---
        else if (provider === 'grok') {
            const grokData = await callGrokTX(mode);
            state.lastPrediction = { session: lastSes + 1, res: grokData.du_doan };

            finalResult = {
                du_doan: grokData.du_doan.toUpperCase(),
                tin_cay: grokData.tin_cay,
                phan_tich: "Grok AI: " + grokData.phan_tich,
            };
        }

        // --- CHẾ ĐỘ 3: HYBRID (KẾT HỢP VOTE THÔNG MINH) ---
        else if (provider === 'hybrid') {
            const algo = predictNext(mode);
            const grok = await callGrokTX(mode);
            
            let consensusRes;
            let consensusConf;
            let logNote;

            // Logic Hybrid: Nếu đồng thuận -> tỷ lệ nổ cao
            if (algo.res.toUpperCase() === grok.du_doan.toUpperCase()) {
                consensusRes = algo.res;
                consensusConf = "95%"; 
                logNote = `SỰ ĐỒNG THUẬN CAO (Algo + Grok)`;
            } else {
                // Nếu lệch, lấy bên có % tin cậy cao hơn
                const algoConfNum = parseFloat(algo.conf) || 0;
                const grokConfNum = parseFloat(grok.tin_cay) || 0;
                
                if (algoConfNum >= grokConfNum) {
                    consensusRes = algo.res;
                    consensusConf = algo.conf;
                    logNote = `Algo ưu tiên (Grok lệch: ${grok.du_doan.toUpperCase()})`;
                } else {
                    consensusRes = grok.du_doan;
                    consensusConf = grok.tin_cay;
                    logNote = `Grok ưu tiên (Algo lệch: ${algo.res.toUpperCase()})`;
                }
            }

            state.lastPrediction = { session: lastSes + 1, res: consensusRes };
            finalResult = {
                du_doan: consensusRes.toUpperCase(),
                tin_cay: consensusConf,
                phan_tich: "HYBRID: " + logNote
            };
        } else {
            return res.status(400).json({ error: "Provider không hợp lệ. Sử dụng 'railway', 'grok' hoặc 'hybrid'" });
        }

        // ================== TRẢ KẾT QUẢ CHUẨN ==================
        res.json({
            author: CONFIG.ADMIN,
            version: CONFIG.VERSION,
            server_time: new Date().toLocaleString('vi-VN'),
            provider: provider.toUpperCase(),
            data: {
                [mode]: {
                    phien_hien_tai: lastSes,
                    phien_tiep: lastSes + 1,
                    du_doan: finalResult.du_doan,
                    tin_cay: finalResult.tin_cay,
                    phan_tich: finalResult.phan_tich,
                    stats: {
                        win: state.stats.win,
                        loss: state.stats.loss,
                        rate: state.stats.total > 0 ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + '%' : '0%'
                    }
                }
            }
        });

    } catch (error) {
        console.error("Critical API Error:", error);
        res.status(500).json({ error: "Lỗi xử lý thuật toán", detail: error.message });
    }
});

// ================== KHỞI ĐỘNG SERVER ==================
app.listen(PORT, () => {
    console.log(`🚀 ${CONFIG.ADMIN} V10.7 HYBRID ONLINE | Port: ${PORT}`);
    runSync(); // Chạy Sync ngay khi khởi động
    setInterval(runSync, CONFIG.SYNC_INTERVAL); // Chạy định kỳ để cập nhật data
});
