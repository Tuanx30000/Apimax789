/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V14.0 - ENHANCED PATTERNS FULL VERSION
 * Đã nâng cấp thêm nhiều loại cầu: 2-2, 1-2, Hot/Cold Bias, Repeat Pattern...
 * Tính theo DiceSum: Tài 11~18 | Xỉu 3~10
 * Bắt đầu phân tích từ 10 phiên - Code chi tiết & rõ ràng
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
    VERSION: "14.0 - Enhanced Multi-Patterns",
    SYNC_INTERVAL: 3500,
    MIN_DISPLAY_CONF: 62,
    SNIPER_CONF: 86,               // Tăng nhẹ ngưỡng Sniper
    CLEAN_INTERVAL: 3600000,
    MAX_HISTORY: 700,
    MIN_HISTORY: 10                // Bắt đầu dự đoán từ 10 phiên
};

// ====================== 2. API LINK GỐC ======================
const API_CONFIG = {
    nohu: "https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGx%2F%2BEp1KITyrOSx3mDcMtc5B3UwDAmuWFK%2B4Q2zPWqSvs2oZwpd%2Br9QdeJ1hnJUb8IcbyKqxyPlMIOJJAyxJUfd0OqlciaAuYtSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90qGC6XXtfwAHRAKA39iyk%2Fm9LsY8cf%2F60hs8XvL9mZS4qPwgCPexrDXV1A5Nm2JZrakjJ%2Be%2BLN1QnGgujDb20vlNUs4k%2B9ywsi1BloYvlX2jLNtGh9vXMb9sjNdKkMxfFHX4XsE3dCy2Ne40CBorDKUUfWUqyR4Sy8rrilkKmEQWvrmizMJktzovfxnS6RmoL3qMn6lVZ%2F9we1KbuLagAZZXKUOHq1HU4us9CZfEJ%2BkQaJUp2JGQubDA%2BNEA42ydc%3D.beê2c3ce5b6a4e551e08a7493ec41ca067b075e7eaba0fc4c659ae63c0801a81",
    
    md5: "https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7"
};

// ====================== 3. TRẠNG THÁI ỨNG DỤNG ======================
const APP_STATE = {
    nohu: { history: [], stats: { win: 0, loss: 0, total: 0, lossStreak: 0 }, processed: new Set(), lastPred: null },
    md5:  { history: [], stats: { win: 0, loss: 0, total: 0, lossStreak: 0 }, processed: new Set(), lastPred: null }
};

// Auto reset thống kê
setInterval(() => {
    ['nohu', 'md5'].forEach(key => {
        APP_STATE[key].stats = { win: 0, loss: 0, total: 0, lossStreak: 0 };
        APP_STATE[key].processed.clear();
        APP_STATE[key].lastPred = null;
    });
    console.log(`🔄 [TUANX3000 V14.0] Auto Clean System Completed`);
}, CONFIG.CLEAN_INTERVAL);

// ====================== 4. ALGORITHM - ĐÃ NÂNG CẤP THÊM NHIỀU LOẠI CẦU ======================
const Algorithms = {

    getStreak: function(history) {
        if (history.length === 0) return { length: 0, result: null };
        const lastResult = history[history.length - 1].result;
        let streakLength = 1;
        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i].result === lastResult) streakLength++;
            else break;
        }
        return { length: streakLength, result: lastResult };
    },

    isZigzag: function(history) {  // Cầu 1-1
        const recent = history.slice(-10);
        for (let i = 1; i < recent.length; i++) {
            if (recent[i].result === recent[i - 1].result) return false;
        }
        return recent.length >= 6;
    },

    isDoublePattern: function(history) {  // Cầu 2-2 mới thêm
        const recent = history.slice(-12).map(h => h.result);
        for (let i = 2; i < recent.length; i += 2) {
            if (recent[i] !== recent[i - 2]) return false;
        }
        return recent.length >= 8;
    },

    isOneTwoPattern: function(history) {  // Cầu 1-2 hoặc 2-1
        const recent = history.slice(-8).map(h => h.result);
        let patternScore = 0;
        for (let i = 2; i < recent.length; i++) {
            const group1 = recent[i-2] === recent[i-1] ? 2 : 1;
            const group2 = recent[i] === recent[i-1] ? 1 : 2; // logic đơn giản hóa
            if (group1 !== group2) patternScore++;
        }
        return patternScore >= 3;
    },

    reversalAfterStreak: function(history) {  // Phá bệt
        const streak = this.getStreak(history);
        if (streak.length >= 4 && history.length > streak.length) {
            const prev = history[history.length - streak.length - 1];
            if (prev && prev.result !== streak.result) {
                return streak.result === 'Tài' ? 'Xỉu' : 'Tài';
            }
        }
        return null;
    },

    triplePattern: function(history) {  // 3-1 pattern
        const recent = history.slice(-7).map(h => h.result);
        const taiCount = recent.filter(r => r === 'Tài').length;
        if ([6,1].includes(taiCount)) return taiCount === 6 ? 'Xỉu' : 'Tài';
        if ([5,2].includes(taiCount)) return taiCount === 5 ? 'Xỉu' : 'Tài';
        return null;
    },

    strongBreakPattern: function(history) {
        const streak = this.getStreak(history);
        if (streak.length >= 6) return streak.result === 'Tài' ? 'Xỉu' : 'Tài';
        return null;
    },

    repeatPattern: function(history) {  // Cầu lặp ngắn
        const recent = history.slice(-6).map(h => h.result).join('');
        const patterns = ['TXTXTX', 'XTXTXT', 'TTXXTT', 'XXTTXX'];
        return patterns.some(p => recent.includes(p));
    },

    hotColdBias: function(history) {  // Bias nóng/lạnh
        const recent = history.slice(-15);
        const taiCount = recent.filter(h => h.result === 'Tài').length;
        if (taiCount >= 11) return 'Xỉu';      // Quá nóng Tài → dự Xỉu
        if (taiCount <= 4) return 'Tài';       // Quá lạnh Tài → dự Tài
        return null;
    },

    entropyCheck: function(history) {  // Độ hỗn loạn
        if (history.length < 15) return 0.5;
        const recent = history.slice(-25);
        let changes = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i].result !== recent[i-1].result) changes++;
        }
        return changes / (recent.length - 1);
    },

    momentum: function(history) {
        if (history.length < 10) return null;
        let score = 0;
        history.slice(-10).forEach((item, i) => {
            score += (item.result === 'Tài' ? 1.5 : -1.5) * (i + 1);
        });
        if (score >= 32) return 'Xỉu';
        if (score <= -32) return 'Tài';
        return null;
    }
};

// ====================== 5. HÀM DỰ ĐOÁN - TÍNH TOÁN CHI TIẾT ======================
function predictNext(type) {
    const state = APP_STATE[type];
    const history = state.history;

    if (history.length < CONFIG.MIN_HISTORY) {
        return {
            ketqua: "CHỜ",
            tin_cay: "0%",
            logic: `Đang thu thập dữ liệu... (\( {history.length}/ \){CONFIG.MIN_HISTORY} phiên)`
        };
    }

    if (state.stats.lossStreak >= 3) {
        return { ketqua: "CHỜ", tin_cay: "0%", logic: "🔴 Loss streak ≥ 3 - Chờ nhịp mới" };
    }

    const streak = Algorithms.getStreak(history);
    let votes = { "Tài": 0, "Xỉu": 0 };
    let logicParts = [];

    const historyFactor = Math.min(1.3, history.length / 120);
    const entropy = Algorithms.entropyCheck(history);
    const isChaotic = entropy > 0.68;

    // === Đa dạng loại cầu ===
    if (streak.length >= 3) {
        const shouldBreak = streak.length >= 5;
        const pred = shouldBreak ? (streak.result === "Tài" ? "Xỉu" : "Tài") : streak.result;
        votes[pred] += shouldBreak ? 5.4 : 4.1;
        logicParts.push(`Bệt ${streak.length} tay`);
    }

    if (Algorithms.isZigzag(history)) {
        const pred = history[history.length-1].result === "Tài" ? "Xỉu" : "Tài";
        votes[pred] += 3.9 * historyFactor;
        logicParts.push("Cầu 1-1 (Zigzag)");
    }

    if (Algorithms.isDoublePattern(history)) {
        const pred = history[history.length-1].result === "Tài" ? "Xỉu" : "Tài";
        votes[pred] += 3.5 * historyFactor;
        logicParts.push("Cầu 2-2 (Nhịp đôi)");
    }

    if (Algorithms.isOneTwoPattern(history)) {
        const pred = history[history.length-1].result === "Tài" ? "Xỉu" : "Tài"; // đơn giản hóa
        votes[pred] += 3.2 * historyFactor;
        logicParts.push("Cầu 1-2 / 2-1");
    }

    const reversal = Algorithms.reversalAfterStreak(history);
    if (reversal) { votes[reversal] += 4.7 * historyFactor; logicParts.push("Phá bệt ngược"); }

    const triple = Algorithms.triplePattern(history);
    if (triple) { votes[triple] += 4.0 * historyFactor; logicParts.push("Triple 3-1"); }

    const strongBreak = Algorithms.strongBreakPattern(history);
    if (strongBreak) { votes[strongBreak] += 5.2 * historyFactor; logicParts.push("Strong Break"); }

    if (Algorithms.repeatPattern(history)) {
        const pred = history[history.length-1].result === "Tài" ? "Xỉu" : "Tài";
        votes[pred] += 3.3 * historyFactor;
        logicParts.push("Repeat Pattern");
    }

    const bias = Algorithms.hotColdBias(history);
    if (bias) { votes[bias] += 3.6 * historyFactor; logicParts.push("Hot/Cold Bias"); }

    const mom = Algorithms.momentum(history);
    if (mom) { votes[mom] += 2.9 * historyFactor; logicParts.push("Momentum"); }

    // Final Decision
    const finalPrediction = votes["Tài"] > votes["Xỉu"] ? "Tài" : "Xỉu";
    let confidence = 48 + Math.floor(Math.max(votes["Tài"], votes["Xỉu"]) * 8.0);
    confidence = Math.min(98, confidence);

    if (isChaotic) confidence -= 16;
    if (state.stats.lossStreak >= 2) confidence -= 18;
    if (history.length < 25) confidence = Math.max(52, confidence - 9);

    confidence = Math.max(45, confidence);

    if (confidence < CONFIG.MIN_DISPLAY_CONF) {
        return { ketqua: "CHỜ", tin_cay: "0%", logic: "Cầu chưa đủ mạnh hoặc đang hỗn loạn" };
    }

    let displayResult = finalPrediction === "Tài" ? "TÀI" : "XỈU";
    if (confidence < CONFIG.SNIPER_CONF) displayResult += " (Thấp)";

    return {
        ketqua: displayResult,
        tin_cay: `${Math.round(confidence)}%`,
        logic: logicParts.length > 0 ? logicParts.join(" + ") : "Phân tích tổng hợp đa cầu"
    };
}

// ====================== 6. SYNC DATA - TÍNH TỔNG DiceSum ======================
async function syncGameData(type) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(API_CONFIG[type], { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const rawData = await response.json();
        if (!Array.isArray(rawData)) return;

        const cleanedHistory = rawData.map(item => {
            const diceSum = Number(item.DiceSum || 0);
            const result = (diceSum >= 11 && diceSum <= 18) ? "Tài" : "Xỉu";

            return {
                session: Number(item.SessionId || 0),
                diceSum: diceSum,
                result: result
            };
        }).filter(item => item.session > 0)
          .sort((a, b) => a.session - b.session);

        if (cleanedHistory.length === 0) return;

        const state = APP_STATE[type];
        const latest = cleanedHistory[cleanedHistory.length - 1];

        if (state.lastPred && state.lastPred.phien === latest.session && !state.processed.has(latest.session)) {
            state.stats.total++;
            if (state.lastPred.ketqua.includes(latest.result)) {
                state.stats.win++;
                state.stats.lossStreak = 0;
            } else {
                state.stats.loss++;
                state.stats.lossStreak++;
            }
            state.processed.add(latest.session);
        }

        state.history = cleanedHistory.slice(-CONFIG.MAX_HISTORY);
        console.log(`[SYNC OK] ${type.toUpperCase()} → ${cleanedHistory.length} phiên | Latest DiceSum: ${latest.diceSum} → ${latest.result}`);
    } catch (error) {
        console.error(`[SYNC ERROR ${type.toUpperCase()}]`, error.message);
    }
}

// ====================== 7. API ENDPOINTS ======================
app.get('/api/all', (req, res) => {
    try {
        const createResponse = (type) => {
            const state = APP_STATE[type];
            const lastSession = state.history.length > 0 ? state.history[state.history.length - 1].session : 0;
            const nextSession = lastSession + 1;

            let pred = state.lastPred;
            if (!pred || pred.phien !== nextSession) {
                pred = predictNext(type);
                state.lastPred = { phien: nextSession, ...pred };
            }

            return {
                phien_tiep: nextSession,
                du_doan: pred.ketqua,
                tin_cay: pred.tin_cay,
                logic: pred.logic,
                lich_su: state.history.slice(-15).map(h => h.result[0]).join('-'),
                thong_ke: {
                    thang: state.stats.win,
                    thua: state.stats.loss,
                    loss_streak: state.stats.lossStreak,
                    winrate: state.stats.total > 0 ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + "%" : "0%"
                }
            };
        };

        res.json({
            system: `TUANX3000 V${CONFIG.VERSION}`,
            admin: CONFIG.ADMIN,
            server_time: new Date().toLocaleString('vi-VN'),
            rule: "Tài: 11~18 | Xỉu: 3~10 (DiceSum)",
            nohu: createResponse('nohu'),
            md5: createResponse('md5')
        });
    } catch (err) {
        console.error("[API ERROR]", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/health', (req, res) => res.json({ status: "ok", version: CONFIG.VERSION }));

app.get('/reset', (req, res) => {
    ['nohu', 'md5'].forEach(key => {
        APP_STATE[key].stats = { win: 0, loss: 0, total: 0, lossStreak: 0 };
        APP_STATE[key].processed.clear();
        APP_STATE[key].lastPred = null;
    });
    res.json({ success: true, message: "Reset thống kê thành công" });
});

// ====================== KHỞI ĐỘNG ======================
app.listen(PORT, () => {
    console.log(`\n🚀 TUANX3000 V14.0 - ENHANCED MULTI PATTERNS`);
    console.log(`   Port → ${PORT}`);
    console.log(`   Min History → ${CONFIG.MIN_HISTORY} phiên`);
    console.log(`   Sniper ≥ ${CONFIG.SNIPER_CONF}%\n`);
    syncGameData('nohu');
    syncGameData('md5');
});

setInterval(() => {
    syncGameData('nohu');
    syncGameData('md5');
}, CONFIG.SYNC_INTERVAL);