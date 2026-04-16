/**
 * =========================================================================================
 * 🚀 TUANX3000 ELITE V13.5 - HỆ THỐNG PHÂN TÍCH TỔNG HỢP SIÊU CẤP
 * VERSION: 13.5 | MODULE: TRIPLE-CORE LOGIC | STATUS: PRODUCTION
 * =========================================================================================
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG & ENDPOINTS ---
const CONFIG = {
    VERSION: "13.5 ELITE",
    AUTHOR: "TUANX3000",
    AI_MODEL: "grok-4.20-reasoning",
    SYNC_INTERVAL: 3500,
    ENDPOINTS: {
        NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
        MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
    }
};

// CƠ SỞ DỮ LIỆU TẠM THỜI (IN-MEMORY)
let CORE_DATA = {
    nohu: { 
        history: [], 
        stats: { win: 0, loss: 0, total: 0, streak: 0 }, 
        prediction: null, 
        processed: new Set(),
        logs: [] 
    },
    md5: { 
        history: [], 
        stats: { win: 0, loss: 0, total: 0, streak: 0 }, 
        prediction: null, 
        processed: new Set(),
        logs: []
    }
};

/**
 * =========================================================
 * 🟢 MODULE 1: THUẬT TOÁN CODE LOGIC (PATTERN ENGINE)
 * Chuyên trách nhận diện các mẫu hình xác suất lặp lại.
 * =========================================================
 */
class PatternEngine {
    constructor(history) {
        this.history = history.slice(-10); // Lấy 10 phiên gần nhất
    }

    analyze() {
        if (this.history.length < 6) return { res: "N/A", conf: 0 };

        const seq = this.history.map(x => x.result === 'Tài' ? 'T' : 'X').join('');
        const last6 = seq.slice(-6);
        const last4 = seq.slice(-4);

        // 1. Phân tích cầu Bệt
        if (last6 === 'TTTTTT') return { res: 'Xỉu', conf: 94, note: 'Bẻ bệt Tài' };
        if (last6 === 'XXXXXX') return { res: 'Tài', conf: 94, note: 'Bẻ bệt Xỉu' };

        // 2. Phân tích cầu Đảo 1-1
        if (last4 === 'TXTX' || last4 === 'XTXT') {
            const next = last4.endsWith('T') ? 'Xỉu' : 'Tài';
            return { res: next, conf: 88, note: 'Theo cầu 1-1' };
        }

        // 3. Phân tích cầu đối xứng 2-2
        if (last4 === 'TTXX' || last4 === 'XXTT') {
            const next = last4.endsWith('X') ? 'Xỉu' : 'Tài';
            return { res: next, conf: 82, note: 'Theo cầu 2-2' };
        }

        // 4. Phân tích cầu 3-1-3
        if (seq.includes('TTTXTTT') || seq.includes('XXXTXXX')) {
            return { res: seq.endsWith('T') ? 'Xỉu' : 'Tài', conf: 75, note: 'Cầu gãy nhịp' };
        }

        // Mặc định: Thuật toán Markov (Xác suất chuyển trạng thái)
        const lastRes = this.history[this.history.length - 1].result;
        return { res: lastRes === 'Tài' ? 'Xỉu' : 'Tài', conf: 60, note: 'Xác suất cơ bản' };
    }
}

/**
 * =========================================================
 * 🟣 MODULE 2: TRÍ TUỆ NHÂN TẠO (AI REASONING)
 * Phân tích dữ liệu phi cấu trúc và nhịp điệu cầu dài.
 * =========================================================
 */
async function getAiPrediction(history) {
    const API_KEY = process.env.GROK_API_KEY;
    if (!API_KEY) return { res: "N/A", conf: 0 };

    const prompt = `Bạn là chuyên gia phân tích dữ liệu sòng bạc. Dưới đây là chuỗi 20 phiên gần nhất. 
    Hãy tìm ra quy luật ngầm và dự đoán phiên tiếp theo. 
    Chỉ trả về JSON theo định dạng: {"p": "TÀI", "c": 85, "r": "Lý do ngắn"}`;

    const sequence = history.slice(-20).map(h => h.result).join(' -> ');

    try {
        const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${API_KEY}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                model: CONFIG.AI_MODEL,
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: `Chuỗi dữ liệu: ${sequence}` }
                ],
                temperature: 0.1
            })
        });
        const data = await response.json();
        const rawRes = JSON.parse(data.choices[0].message.content.match(/\{.*\}/s)[0]);
        return { 
            res: rawRes.p.includes("TÀI") ? "Tài" : "Xỉu", 
            conf: rawRes.c,
            reason: rawRes.r 
        };
    } catch (e) {
        return { res: "N/A", conf: 0, reason: "AI Timeout" };
    }
}

/**
 * =========================================================
 * 🔵 MODULE 3: HYBRID CALCULATOR (LAI TÍNH TOÁN & LỊCH SỬ)
 * Bộ não trung tâm, lọc nhiễu và chốt kết quả cuối cùng.
 * =========================================================
 */
class HybridArbitrator {
    static async solve(mode) {
        const data = CORE_DATA[mode];
        if (data.history.length < 15) return { status: "WAITING_DATA" };

        const engine1 = new PatternEngine(data.history).analyze();
        const engine2 = await getAiPrediction(data.history);

        // 1. Phân tích mật độ (Density) 40 phiên gần nhất
        const last40 = data.history.slice(-40);
        const tCount = last40.filter(x => x.result === 'Tài').length;
        const xCount = last40.length - tCount;
        
        // 2. Định luật cân bằng (The Law of Large Numbers)
        let densityBias = null;
        if (tCount >= 25) densityBias = 'Xỉu'; // Tài quá nóng -> Dự đoán Xỉu
        if (xCount >= 25) densityBias = 'Tài'; // Xỉu quá nóng -> Dự đoán Tài

        // 3. Chốt kết quả dựa trên trọng số
        let finalPredict = "";
        let finalConf = 0;
        let method = "";

        if (engine1.res === engine2.res) {
            // Trường hợp ĐỒNG THUẬN
            finalPredict = engine1.res;
            finalConf = Math.min(99, Math.max(engine1.conf, engine2.conf) + 5);
            method = "Đồng thuận Triple-Core";
        } else {
            // Trường hợp XUNG ĐỘT -> Trọng tài Mật độ vào cuộc
            if (densityBias && (densityBias === engine1.res || densityBias === engine2.res)) {
                finalPredict = densityBias;
                finalConf = 85;
                method = "Trọng tài Mật độ (Density)";
            } else {
                // Ưu tiên AI nếu độ tự tin AI > 85%, ngược lại ưu tiên Code
                if (engine2.conf > 85) {
                    finalPredict = engine2.res;
                    finalConf = engine2.conf;
                    method = "Ưu tiên Trí tuệ AI";
                } else {
                    finalPredict = engine1.res;
                    finalConf = engine1.conf;
                    method = "Ưu tiên Thuật toán Code";
                }
            }
        }

        const nextSession = data.history[data.history.length - 1].session + 1;
        data.prediction = { session: nextSession, res: finalPredict };

        return {
            session: nextSession,
            predict: finalPredict.toUpperCase(),
            conf: finalConf + "%",
            method: method,
            sub: { code: engine1.res, ai: engine2.res, bias: densityBias || "Cân bằng" },
            stats: {
                rate: data.stats.total > 0 ? ((data.stats.win / data.stats.total) * 100).toFixed(1) + '%' : '100%',
                win: data.stats.win,
                loss: data.stats.loss,
                total: data.stats.total
            }
        };
    }
}

// --- HỆ THỐNG ĐỒNG BỘ DỮ LIỆU (SYNC ENGINE) ---
async function sync() {
    for (const key of ['nohu', 'md5']) {
        try {
            const resp = await fetch(CONFIG.ENDPOINTS[key.toUpperCase()]);
            const json = await resp.json();
            const rawList = Array.isArray(json) ? json : (json.list || json.data || []);
            const db = CORE_DATA[key];

            const formatted = rawList.map(item => ({
                session: Number(item.id || item.SessionId || 0),
                result: (item.DiceSum >= 11 || String(item.result).includes('TAI')) ? 'Tài' : 'Xỉu'
            })).filter(i => i.session > 0);

            // Cập nhật lịch sử (Không trùng lặp)
            const map = new Map(db.history.map(o => [o.session, o]));
            formatted.forEach(o => map.set(o.session, o));
            db.history = Array.from(map.values()).sort((a,b) => a.session - b.session).slice(-100);

            // Kiểm tra Win/Loss tay trước
            if (db.history.length > 0) {
                const latest = db.history[db.history.length - 1];
                if (db.prediction && latest.session === db.prediction.session && !db.processed.has(latest.session)) {
                    if (db.prediction.res === latest.result) {
                        db.stats.win++; db.stats.streak++;
                    } else {
                        db.stats.loss++; db.stats.streak = 0;
                    }
                    db.stats.total++;
                    db.processed.add(latest.session);
                }
            }
        } catch (e) { console.log("Sync Error for " + key); }
    }
}

// --- API ENDPOINTS ---
app.get('/api/elite-analysis', async (req, res) => {
    const results = {
        NOHU: await HybridArbitrator.solve('nohu'),
        MD5: await HybridArbitrator.solve('md5')
    };
    res.json(results);
});

setInterval(sync, CONFIG.SYNC_INTERVAL);
app.listen(PORT, () => {
    sync();
    console.log(`=========================================`);
    console.log(`🚀 ${CONFIG.VERSION} IS NOW ONLINE`);
    console.log(`🚀 PORT: ${PORT} | ADMIN: ${CONFIG.AUTHOR}`);
    console.log(`=========================================`);
});
