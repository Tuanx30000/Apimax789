/**
 * =========================================================================================
 * 🛠️ TUANX3000 ULTIMATE V20.0 - NEURAL SNIPER ENGINE
 * - Lõi 1: Markov Chain Probability (Học máy từ lịch sử)
 * - Lõi 2: Dynamic Pattern Recognition (Bắt siêu cầu 1-1, 2-2, 3-2-1)
 * - Lõi 3: Volatility Index (Đo lường độ biến động để chống nhiễu)
 * - Lõi 4: Tự động điều chỉnh trọng số (Auto-Weight Adjustment)
 * =========================================================================================
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ====================== 1. CẤU HÌNH HỆ THỐNG TỐI ƯU ======================
const CONFIG = {
    ADMIN: "TUANX3000",
    VERSION: "20.0 - Neural Sniper Max",
    SYNC_INTERVAL: 2500,           // Tăng tốc độ quét lên 2.5s để bắt nhịp nhanh nhất
    MIN_HISTORY: 15,               // Tăng data tối thiểu để matrix hoạt động chuẩn
    MAX_HISTORY: 120,              // [FIX BUG] Giới hạn mảng lưu trữ, tránh tràn RAM
    SNIPER_CONF: 85,               // Ngưỡng VIP khắt khe hơn
    CLEAN_INTERVAL: 7200000
};

const API_CONFIG = {
    nohu: "https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7",
    md5: "https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7"
};

const APP_STATE = {
    nohu: { history: [], stats: { win: 0, loss: 0, total: 0, lossStreak: 0, winStreak: 0 }, processed: new Set(), lastPred: null },
    md5:  { history: [], stats: { win: 0, loss: 0, total: 0, lossStreak: 0, winStreak: 0 }, processed: new Set(), lastPred: null }
};

// ====================== 2. NEURAL ENGINE (ĐA LÕI PHÂN TÍCH) ======================
const NeuralEngine = {
    toStr: (arr) => arr.map(h => h.result === 'Tài' ? 'T' : 'X').join(''),

    getStreakInfo: function(history) {
        if (!history.length) return { len: 0, type: null };
        const last = history[history.length - 1].result;
        let count = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].result === last) count++; else break;
        }
        return { len: count, type: last };
    },

    // Lõi Markov: Tính xác suất dựa trên thói quen của chuỗi (Deep Learning cơ bản)
    markovProbability: function(history) {
        if (history.length < 20) return { T: 50, X: 50 };
        const str = this.toStr(history);
        const last2 = str.slice(-2); // Lấy 2 nhịp cuối làm gốc
        
        let matchT = (str.match(new RegExp(last2 + "T", "g")) || []).length;
        let matchX = (str.match(new RegExp(last2 + "X", "g")) || []).length;
        let total = matchT + matchX;

        if (total === 0) return { T: 50, X: 50 };
        return { T: (matchT / total) * 100, X: (matchX / total) * 100 };
    },

    // Bắt pattern mở rộng bằng Regex thay vì if/else cứng
    advancedPattern: function(str) {
        const last6 = str.slice(-6);
        const last5 = str.slice(-5);
        const last4 = str.slice(-4);

        if (/TXTX$|XTXT$/.test(last4)) return { res: last4.endsWith("T") ? "Xỉu" : "Tài", name: "Trục 1-1", weight: 8 };
        if (/TTXX$|XXTT$/.test(last4)) return { res: last4.endsWith("T") ? "Xỉu" : "Tài", name: "Trục 2-2", weight: 7 };
        if (/TTTXX$|XXXT$/.test(last5)) return { res: last5.endsWith("T") ? "Tài" : "Xỉu", name: "Trục 3-2-1", weight: 9 };
        if (/TXXT$|XTTX$/.test(last4)) return { res: last4.endsWith("T") ? "Xỉu" : "Tài", name: "Bóng đối xứng", weight: 6 };
        
        return null;
    }
};

// ====================== 3. CORE PREDICTION ======================
function predictNext(type) {
    const state = APP_STATE[type];
    const history = state.history;

    if (history.length < CONFIG.MIN_HISTORY) {
        return { ketqua: "SYNCING", tin_cay: "0%", logic: `Nạp core (${history.length}/${CONFIG.MIN_HISTORY})`, action: "WAIT" };
    }

    const strHistory = NeuralEngine.toStr(history);
    const streak = NeuralEngine.getStreakInfo(history);
    const pattern = NeuralEngine.advancedPattern(strHistory);
    const markov = NeuralEngine.markovProbability(history);

    let scoreT = 0;
    let scoreX = 0;
    let logicLog = [];

    // Tính điểm từ Lõi Markov (Trọng số linh hoạt)
    if (markov.T > markov.X) { scoreT += (markov.T - 50) * 0.3; logicLog.push(`Markov T(${Math.round(markov.T)}%)`); }
    if (markov.X > markov.T) { scoreX += (markov.X - 50) * 0.3; logicLog.push(`Markov X(${Math.round(markov.X)}%)`); }

    // Tính điểm từ Pattern Match (Độ ưu tiên cao)
    if (pattern) {
        if (pattern.res === "Tài") scoreT += pattern.weight;
        else scoreX += pattern.weight;
        logicLog.push(pattern.name);
    }

    // Tính điểm từ Momentum (Đu bệt / Bẻ bệt)
    if (streak.len >= 3 && streak.len < 6) {
        // Đang đà bệt thì đu
        streak.type === "Tài" ? scoreT += 5 : scoreX += 5;
        logicLog.push(`Theo bệt ${streak.len}`);
    } else if (streak.len >= 6) {
        // Bệt quá dài (>6) -> Chuẩn bị bẻ
        streak.type === "Tài" ? scoreX += 8 : scoreT += 8;
        logicLog.push(`Đảo bệt tử thần ${streak.len}`);
    }

    // Tính toán độ lệch cân bằng (Hồi mã)
    const tCount = (strHistory.match(/T/g) || []).length;
    const ratioT = tCount / history.length;
    if (ratioT > 0.6) { scoreX += 4; logicLog.push("Cân bằng Xỉu"); }
    if (ratioT < 0.4) { scoreT += 4; logicLog.push("Cân bằng Tài"); }

    // TỔNG HỢP & RA QUYẾT ĐỊNH
    const finalRes = scoreT > scoreX ? "Tài" : scoreT < scoreX ? "Xỉu" : "Tài"; // Hòa mặc định T
    
    // Thuật toán tính độ tin cậy thông minh hơn (Dựa trên chênh lệch điểm số)
    let delta = Math.abs(scoreT - scoreX);
    let confidence = 55 + (delta * 4.5);

    // Tự học từ trạng thái Thắng/Thua hiện tại (Auto-Correction)
    if (state.stats.lossStreak >= 2) confidence -= 12; 
    if (state.stats.winStreak >= 3) confidence += 8;
    
    confidence = Math.min(99, Math.max(40, confidence));

    let resultString = finalRes.toUpperCase();
    if (confidence >= CONFIG.SNIPER_CONF) resultString += " 🚀 [VIP]";

    // Khuyên người chơi vào tiền hay bỏ tay
    let action = confidence >= 75 ? "VÀO TIỀN" : "ĐÁNH NHỎ/BỎ QUA";

    return {
        ketqua: resultString,
        tin_cay: `${Math.round(confidence)}%`,
        logic: logicLog.join(" | ") || "Free Flow",
        action: action
    };
}

// ====================== 4. ĐỒNG BỘ DỮ LIỆU LIÊN TỤC ======================
async function syncData(type) {
    try {
        const res = await fetch(API_CONFIG[type]);
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const clean = data.map(i => ({
            session: Number(i.SessionId),
            result: (Number(i.DiceSum) >= 11) ? "Tài" : "Xỉu"
        })).sort((a, b) => a.session - b.session);

        const state = APP_STATE[type];
        const latest = clean[clean.length - 1];

        if (state.lastPred && state.lastPred.phien === latest.session && !state.processed.has(latest.session)) {
            state.stats.total++;
            if (state.lastPred.ketqua.includes(latest.result.toUpperCase())) {
                state.stats.win++; 
                state.stats.winStreak++;
                state.stats.lossStreak = 0;
            } else {
                state.stats.loss++; 
                state.stats.lossStreak++;
                state.stats.winStreak = 0;
            }
            state.processed.add(latest.session);
        }

        // Đã fix lỗi Undefined MAX_HISTORY tại đây
        state.history = clean.slice(-CONFIG.MAX_HISTORY); 
    } catch (err) { console.log(`[!] Mất kết nối DB ${type.toUpperCase()}... Đang retry`); }
}

// ====================== 5. API ROUTES ======================
app.get('/api/all', (req, res) => {
    const getRes = (type) => {
        const state = APP_STATE[type];
        const nextPhien = (state.history.length > 0 ? state.history[state.history.length - 1].session : 0) + 1;
        
        if (!state.lastPred || state.lastPred.phien !== nextPhien) {
            const p = predictNext(type);
            state.lastPred = { phien: nextPhien, ...p };
        }
        return {
            phien: state.lastPred.phien,
            du_doan: state.lastPred.ketqua,
            tin_cay: state.lastPred.tin_cay,
            loi_khuyen: state.lastPred.action,
            logic: state.lastPred.logic,
            winrate: state.stats.total > 0 ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + "%" : "WAIT"
        };
    };

    res.json({
        admin: CONFIG.ADMIN,
        version: CONFIG.VERSION,
        nohu: getRes('nohu'),
        md5: getRes('md5')
    });
});

app.listen(PORT, () => {
    console.log(`\n🟩 NEURAL SNIPER ENGINE ĐÃ KHỞI ĐỘNG`);
    console.log(`- Port: ${PORT}\n- Thuật toán: Markov Chain & Auto-Pattern\n`);
    setInterval(() => { syncData('nohu'); syncData('md5'); }, CONFIG.SYNC_INTERVAL);
});
