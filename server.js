/**
 * =========================================================================================
 * 🛠️ TUANX3000 ULTIMATE V14.0 - PHIÊN BẢN CHIẾN THUẬT TỔNG HỢP
 * - Chế độ: Nhảy cầu linh hoạt (Flexible Switching)
 * - Ưu tiên: Đu bệt (Trend Following) & Bắt nhịp cầu chuẩn (1-1, 2-2, 1-2, 3-1)
 * - Trạng thái: Always Active (Chỉ cần nạp đủ 10 phiên đầu)
 * =========================================================================================
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ====================== 1. CẤU HÌNH HỆ THỐNG ======================
const CONFIG = {
    ADMIN: "TUANX3000",
    VERSION: "14.0 - Ultra Sniper",
    SYNC_INTERVAL: 3500,           // Tốc độ quét dữ liệu (ms)
    MIN_HISTORY: 10,               // Số phiên tối thiểu để bắt đầu dự đoán
    SNIPER_CONF: 82,               // Ngưỡng đánh dấu kèo VIP
    CLEAN_INTERVAL: 7200000        // 2 tiếng tự reset thống kê 1 lần
};

// URL API - Hãy thay bằng link token thực tế của bạn
const API_CONFIG = {
    nohu: "https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7",
    md5: "https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGx%2F%2BEp1KITyrOSx3mDcMtc5B3UwDAmuWFK%2B4Q2zPWqSvs2oZwpd%2Br9QdeJ1hnJUb8IcbyKqxyPlMIOJJAyxJUfd0OqlciaAuYtSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90qGC6XXtfwAHRAKA39iyk%2Fm9LsY8cf%2F60hs8XvL9mZS4qPwgCPexrDXV1A5Nm2JZrakjJ%2Be%2BLN1QnGgujDb20vlNUs4k%2B9ywsi1BloYvlX2jLNtGh9vXMb9sjNdKkMxfFHX4XsE3dCy2Ne40CBorDKUUfWUqyR4Sy8rrilkKmEQWvrmizMJktzovfxnS6RmoL3qMn6lVZ%2F9we1KbuLagAZZXKUOHq1HU4us9CZfEJ%2BkQaJUp2JGQubDA%2BNEA42ydc%3D.bee2c3ce5b6a4e551e08a7493ec41ca067b075e7eaba0fc4c659ae63c0801a81"
};

const APP_STATE = {
    nohu: { history: [], stats: { win: 0, loss: 0, total: 0, lossStreak: 0 }, processed: new Set(), lastPred: null },
    md5:  { history: [], stats: { win: 0, loss: 0, total: 0, lossStreak: 0 }, processed: new Set(), lastPred: null }
};

// ====================== 2. THUẬT TOÁN NHẬY CẦU (SMART ENGINE) ======================
const Algorithms = {

    // Chuyển lịch sử thành chuỗi ký tự để so sánh pattern
    toPattern: function(history, len) {
        return history.slice(-len).map(h => h.result === 'Tài' ? 'T' : 'X').join('');
    },

    getStreak: function(history) {
        if (history.length === 0) return { length: 0, result: null };
        const last = history[history.length - 1].result;
        let count = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].result === last) count++; else break;
        }
        return { length: count, result: last };
    },

    // Logic "Nhảy cầu" - Tìm kiếm các mẫu hình kinh điển
    findPattern: function(history) {
        const p6 = this.toPattern(history, 6);
        const p4 = this.toPattern(history, 4);
        const p3 = this.toPattern(history, 3);

        // 1. Cầu 1-1 (Zigzag) -> Nhảy nhịp
        if (p4 === "TXTX" || p4 === "XTXT") return { res: p4.endsWith("T") ? "Xỉu" : "Tài", name: "Nhảy 1-1" };

        // 2. Cầu 2-2 (Double) -> Nhảy nhịp đôi
        if (p4 === "TTXX") return { res: "Tài", name: "Cầu 2-2" };
        if (p4 === "XXTT") return { res: "Xỉu", name: "Cầu 2-2" };

        // 3. Cầu 1-2 / 2-1
        if (p3 === "TXX") return { res: "Tài", name: "Cầu 1-2" };
        if (p3 === "XTT") return { res: "Xỉu", name: "Cầu 2-1" };
        
        // 4. Cầu 3-1
        if (p4 === "TTTX") return { res: "Tài", name: "Nhảy 3-1-1" };
        if (p4 === "XXXT") return { res: "Xỉu", name: "Nhảy 3-1-1" };

        return null;
    }
};

// ====================== 3. HÀM DỰ ĐOÁN (ACTIVE PREDICT) ======================
function predictNext(type) {
    const state = APP_STATE[type];
    const history = state.history;

    // Chỉ chờ khi tool vừa bật, chưa đủ dữ liệu tối thiểu
    if (history.length < CONFIG.MIN_HISTORY) {
        return { ketqua: "CHỜ", tin_cay: "0%", logic: `Đang nạp dữ liệu (${history.length}/${CONFIG.MIN_HISTORY})` };
    }

    const streak = Algorithms.getStreak(history);
    const patternMatch = Algorithms.findPattern(history);
    let votes = { "Tài": 0, "Xỉu": 0 };
    let logicLog = [];

    // CHIẾN THUẬT 1: NHẢY CẦU (Ưu tiên cao nhất)
    if (patternMatch) {
        votes[patternMatch.res] += 7.0;
        logicLog.push(patternMatch.name);
    }

    // CHIẾN THUẬT 2: ĐU BỆT (Nếu bệt dài >= 3)
    if (streak.length >= 3) {
        votes[streak.result] += 5.5;
        logicLog.push(`Đu Bệt ${streak.length} tay`);
    }

    // CHIẾN THUẬT 3: HỒI MÃ (Dựa trên xác suất 15 phiên)
    const p15 = Algorithms.toPattern(history, 15);
    const taiCount = (p15.match(/T/g) || []).length;
    if (taiCount >= 10) { votes["Xỉu"] += 2.0; logicLog.push("Hồi mã Xỉu"); }
    if (taiCount <= 5) { votes["Tài"] += 2.0; logicLog.push("Hồi mã Tài"); }

    // TỔNG HỢP KẾT QUẢ
    const finalRes = votes["Tài"] >= votes["Xỉu"] ? "Tài" : "Xỉu";
    
    // Tính độ tin cậy động
    let confidence = 52 + (Math.abs(votes["Tài"] - votes["Xỉu"]) * 6.5);
    if (state.stats.lossStreak >= 2) confidence -= 10; // Giảm tin cậy nếu đang dây đen
    confidence = Math.min(98, Math.max(45, confidence));

    let resultString = finalRes.toUpperCase();
    if (confidence >= CONFIG.SNIPER_CONF) resultString += " 🔥";

    return {
        ketqua: resultString,
        tin_cay: `${Math.round(confidence)}%`,
        logic: logicLog.length > 0 ? logicLog.join(" + ") : "Bắt nhịp tự do"
    };
}

// ====================== 4. ĐỒNG BỘ DỮ LIỆU & API ======================
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

        // Xử lý thống kê Thắng/Thua
        if (state.lastPred && state.lastPred.phien === latest.session && !state.processed.has(latest.session)) {
            state.stats.total++;
            if (state.lastPred.ketqua.includes(latest.result.toUpperCase())) {
                state.stats.win++; state.stats.lossStreak = 0;
            } else {
                state.stats.loss++; state.stats.lossStreak++;
            }
            state.processed.add(latest.session);
        }

        state.history = clean.slice(-CONFIG.MAX_HISTORY);
    } catch (err) { console.log(`[!] Lỗi kết nối ${type.toUpperCase()}`); }
}

// API Endpoints
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
            logic: state.lastPred.logic,
            winrate: state.stats.total > 0 ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + "%" : "0%"
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
    console.log(`\n🚀 TUANX3000 V14.0 ĐÃ SẴN SÀNG`);
    console.log(`- Port: ${PORT}\n- Chế độ: Nhảy cầu & Đu bệt liên tục\n`);
    setInterval(() => { syncData('nohu'); syncData('md5'); }, CONFIG.SYNC_INTERVAL);
});
