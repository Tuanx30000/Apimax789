/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V10.3 - FINAL STABLE VERSION
 * ĐÃ DÒ SOÁT KỸ - SỬA LỖI SYNTAX - CODE DÀI & RÕ RÀNG
 * TỔNG HỢP ĐA THUẬT TOÁN + SNIPER + LOW THRESHOLD 62%
 * ADMIN: TUANX3000
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
    VERSION: "10.3 - FINAL STABLE",
    SYNC_INTERVAL: 4000,
    MIN_DISPLAY_CONF: 62,      // Ngưỡng hiển thị tối thiểu
    SNIPER_CONF: 82,           // Ngưỡng sniper cao
    CLEAN_INTERVAL: 3600000,   // Reset thống kê mỗi 1 tiếng
    MAX_HISTORY: 350,
    MIN_HISTORY: 30
};

const API_CONFIG = {
    NOHU: "https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGx%2F%2BEp1KITyrOSx3mDcMtc5B3UwDAmuWFK%2B4Q2zPWqSvs2oZwpd%2Br9QdeJ1hnJUb8IcbyKqxyPlMIOJJAyxJUfd0OqlciaAuYtSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90qGC6XXtfwAHRAKA39iyk%2Fm9LsY8cf%2F60hs8XvL9mZS4qPwgCPexrDXV1A5Nm2JZrakjJ%2Be%2BLN1QnGgujDb20vlNUs4k%2B9ywsi1BloYvlX2jLNtGh9vXMb9sjNdKkMxfFHX4XsE3dCy2Ne40CBorDKUUfWUqyR4Sy8rrilkKmEQWvrmizMJktzovfxnS6RmoL3qMn6lVZ%2F9we1KbuLagAZZXKUOHq1HU4us9CZfEJ%2BkQaJUp2JGQubDA%2BNEA42ydc%3D.beê2c3ce5b6a4e551e08a7493ec41ca067b075e7eaba0fc4c659ae63c0801a81",
    
    MD5: "https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7"
};

// ====================== 2. TRẠNG THÁI ỨNG DỤNG ======================
const APP_STATE = {
    nohu: {
        history: [],
        stats: { win: 0, loss: 0, total: 0, lossStreak: 0 },
        processed: new Set(),
        lastPred: null
    },
    md5: {
        history: [],
        stats: { win: 0, loss: 0, total: 0, lossStreak: 0 },
        processed: new Set(),
        lastPred: null
    }
};

// Auto reset thống kê mỗi 1 tiếng
setInterval(() => {
    ['nohu', 'md5'].forEach(key => {
        APP_STATE[key].stats = { win: 0, loss: 0, total: 0, lossStreak: 0 };
        APP_STATE[key].processed.clear();
        APP_STATE[key].lastPred = null;
    });
    console.log(`🔄 [TUANX3000 V10.3] Auto Clean System Completed`);
}, CONFIG.CLEAN_INTERVAL);

// ====================== 3. HỆ THỐNG THUẬT TOÁN ĐA LỚP ======================
const Algorithms = {

    getStreak: function(history) {
        if (history.length === 0) return { length: 0, result: null };
        const lastResult = history[history.length - 1].result;
        let streakLength = 1;
        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i].result === lastResult) {
                streakLength++;
            } else {
                break;
            }
        }
        return { length: streakLength, result: lastResult };
    },

    isZigzag: function(history) {
        const recent = history.slice(-10);
        for (let i = 1; i < recent.length; i++) {
            if (recent[i].result === recent[i - 1].result) return false;
        }
        return recent.length >= 6;
    },

    isDoublePattern: function(history) {
        const recent = history.slice(-12).map(h => h.result);
        for (let i = 2; i < recent.length; i += 2) {
            if (recent[i] !== recent[i - 2]) return false;
        }
        return recent.length >= 8;
    },

    markovPattern: function(history) {
        const seq = history.slice(-7).map(h => h.result === 'Tài' ? 'T' : 'X').join('');
        const patterns = {
            'TTTTT': 'X', 'XXXXX': 'T',
            'TXTXT': 'T', 'XTXTX': 'X',
            'TTXXT': 'X'
        };
        return patterns[seq] || null;
    },

    frequencyBias: function(history) {
        const recent = history.slice(-18);
        const taiCount = recent.filter(h => h.result === 'Tài').length;
        if (taiCount >= 13) return 'Xỉu';
        if (taiCount <= 5) return 'Tài';
        return null;
    },

    momentum: function(history) {
        if (history.length < 6) return null;
        let score = 0;
        history.slice(-6).forEach((item, index) => {
            score += (item.result === 'Tài' ? 1 : -1) * (index + 1);
        });
        if (score >= 13) return 'Xỉu';
        if (score <= -13) return 'Tài';
        return null;
    }
};

// ====================== 4. HÀM DỰ ĐOÁN CHÍNH ======================
function predictNext(type) {
    const state = APP_STATE[type];
    const history = state.history;

    // Kiểm tra điều kiện dừng
    if (history.length < CONFIG.MIN_HISTORY) {
        return {
            ketqua: "CHỜ",
            tin_cay: "0%",
            logic: "Đang thu thập dữ liệu..."
        };
    }

    if (state.stats.lossStreak >= 3) {
        return {
            ketqua: "CHỜ",
            tin_cay: "0%",
            logic: "🔴 Gãy 3 tay liên tiếp - Chờ nhịp mới"
        };
    }

    const lastResult = history[history.length - 1].result;
    const streak = Algorithms.getStreak(history);

    let votes = { "Tài": 0, "Xỉu": 0 };
    let logicParts = [];

    // Dynamic Streak
    if (streak.length >= 3) {
        const shouldBreakStreak = streak.length >= 5;
        const predicted = shouldBreakStreak 
            ? (streak.result === "Tài" ? "Xỉu" : "Tài") 
            : streak.result;

        votes[predicted] += shouldBreakStreak ? 3.5 : 2.8;
        logicParts.push(`Bệt ${streak.length} tay`);
    }

    // Pattern Analysis
    if (Algorithms.isZigzag(history)) {
        votes[lastResult === "Tài" ? "Xỉu" : "Tài"] += 2.8;
        logicParts.push("Zigzag 1-1");
    }

    if (Algorithms.isDoublePattern(history)) {
        votes[lastResult === "Tài" ? "Xỉu" : "Tài"] += 2.2;
        logicParts.push("Nhịp đôi");
    }

    // Additional Algorithms
    const markov = Algorithms.markovPattern(history);
    if (markov) {
        votes[markov === "T" ? "Tài" : "Xỉu"] += 2.0;
        logicParts.push("Markov");
    }

    const freq = Algorithms.frequencyBias(history);
    if (freq) {
        votes[freq] += 1.7;
        logicParts.push("Tần suất");
    }

    const momentumResult = Algorithms.momentum(history);
    if (momentumResult) {
        votes[momentumResult] += 1.6;
        logicParts.push("Momentum");
    }

    // Final Decision
    const finalPrediction = votes["Tài"] > votes["Xỉu"] ? "Tài" : "Xỉu";
    let confidence = Math.min(94, 60 + Math.floor(Math.max(votes["Tài"], votes["Xỉu"]) * 7));

    if (confidence < CONFIG.MIN_DISPLAY_CONF) {
        return {
            ketqua: "CHỜ",
            tin_cay: "0%",
            logic: "Cầu chưa đủ mạnh để dự đoán"
        };
    }

    let displayResult = finalPrediction === "Tài" ? "TÀI" : "XỈU";
    if (confidence < CONFIG.SNIPER_CONF) {
        displayResult += " (Thấp)";
    }

    return {
        ketqua: displayResult,
        tin_cay: confidence + "%",
        logic: logicParts.length > 0 ? logicParts.join(" + ") : "Phân tích tổng hợp"
    };
}

// ====================== 5. ĐỒNG BỘ DỮ LIỆU ======================
async function syncGameData(type) {
    try {
        const response = await fetch(API_CONFIG[type.toUpperCase()]);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const rawData = await response.json();
        if (!Array.isArray(rawData)) return;

        const cleanedHistory = rawData.map(item => ({
            session: Number(item.SessionId || 0),
            result: (item.BetSide === 0 || item.BetSide === "0") ? "Tài" : "Xỉu"
        })).filter(item => item.session > 0)
          .sort((a, b) => a.session - b.session);

        if (cleanedHistory.length === 0) return;

        const state = APP_STATE[type];
        const latestSession = cleanedHistory[cleanedHistory.length - 1];

        // Cập nhật thống kê
        if (state.lastPred && 
            state.lastPred.phien === latestSession.session && 
            !state.processed.has(latestSession.session)) {
            
            state.stats.total++;
            if (state.lastPred.ketqua.includes(latestSession.result)) {
                state.stats.win++;
                state.stats.lossStreak = 0;
            } else {
                state.stats.loss++;
                state.stats.lossStreak++;
            }
            state.processed.add(latestSession.session);
        }

        state.history = cleanedHistory.slice(-CONFIG.MAX_HISTORY);

        console.log(`[SYNC] ${type.toUpperCase()} synced successfully - ${cleanedHistory.length} sessions`);
    } catch (error) {
        console.error(`[SYNC ERROR ${type.toUpperCase()}]`, error.message);
    }
}

// Khởi tạo đồng bộ
setInterval(() => {
    syncGameData('nohu');
    syncGameData('md5');
}, CONFIG.SYNC_INTERVAL);

// ====================== 6. API ENDPOINTS ======================
app.get('/api/all', (req, res) => {
    try {
        const createResponse = (type) => {
            const state = APP_STATE[type];
            const lastSession = state.history.length > 0 
                ? state.history[state.history.length - 1].session 
                : 0;
            const nextSession = lastSession + 1;

            let currentPred = state.lastPred;
            if (!currentPred || currentPred.phien !== nextSession) {
                currentPred = predictNext(type);
                state.lastPred = { phien: nextSession, ...currentPred };
            }

            return {
                phien_tiep: nextSession,
                du_doan: currentPred.ketqua,
                tin_cay: currentPred.tin_cay,
                logic: currentPred.logic,
                lich_su: state.history.slice(-15).map(h => h.result[0]).join('-'),
                thong_ke: {
                    thang: state.stats.win,
                    thua: state.stats.loss,
                    loss_streak: state.stats.lossStreak,
                    winrate: state.stats.total > 0 
                        ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + "%" 
                        : "0%"
                }
            };
        };

        res.json({
            system: `TUANX3000 V${CONFIG.VERSION}`,
            admin: CONFIG.ADMIN,
            server_time: new Date().toLocaleString('vi-VN'),
            nohu: createResponse('nohu'),
            md5: createResponse('md5')
        });
    } catch (err) {
        console.error("[API ERROR]", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ====================== 7. DASHBOARD ======================
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TUANX3000 V10.3</title>
    <style>
        body { 
            background: #0a0a0a; 
            color: #0f0; 
            font-family: monospace; 
            margin: 0; 
            padding: 20px; 
        }
        h1 { 
            color: #00ffcc; 
            text-align: center; 
            text-shadow: 0 0 15px #00ffcc; 
        }
        .container { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 25px; 
            justify-content: center; 
            max-width: 1100px; 
            margin: auto; 
        }
        .card { 
            background: #111; 
            border: 2px solid #00ff88; 
            border-radius: 15px; 
            padding: 25px; 
            width: 500px; 
        }
        .md5-card { 
            border-color: #ff00ff; 
        }
        .result { 
            font-size: 52px; 
            font-weight: bold; 
            margin: 15px 0; 
        }
        .low { color: #ffaa00 !important; }
        .info { margin: 8px 0; line-height: 1.6; }
    </style>
</head>
<body>
    <h1>🚀 TUANX3000 V10.3 - FINAL STABLE</h1>
    <div class="container">
        <div class="card">
            <h2 style="color:#00ffcc">🔥 NỔ HŨ</h2>
            <div id="nohu"></div>
        </div>
        <div class="card md5-card">
            <h2 style="color:#ff00ff">💎 MD5</h2>
            <div id="md5"></div>
        </div>
    </div>

    <script>
        async function updateDashboard() {
            try {
                const response = await fetch('/api/all');
                const data = await response.json();

                function renderCard(id, item, mainColor) {
                    const isLow = item.du_doan.includes("(Thấp)");
                    document.getElementById(id).innerHTML = 
                        '<div class="result ' + (isLow ? "low" : "") + '" style="color:' + mainColor + '">' + 
                        item.du_doan + '</div>' +
                        '<div class="info">Phiên tiếp: <b>' + item.phien_tiep + '</b></div>' +
                        '<div class="info">Tin cậy: <b>' + item.tin_cay + '</b></div>' +
                        '<div class="info">Logic: <i>' + item.logic + '</i></div>' +
                        '<div class="info">Lịch sử: ' + item.lich_su + '</div>' +
                        '<div class="info">Loss streak: <span style="color:#ff5555">' + item.thong_ke.loss_streak + '</span></div>';
                }

                renderCard('nohu', data.nohu, '#00ff88');
                renderCard('md5', data.md5, '#ff00ff');
            } catch (error) {
                console.log("Không thể tải dữ liệu dashboard");
            }
        }

        setInterval(updateDashboard, 2000);
        updateDashboard();
    </script>
</body>
</html>
    `);
});

// Reset thống kê
app.get('/reset', (req, res) => {
    ['nohu', 'md5'].forEach(key => {
        APP_STATE[key].stats = { win: 0, loss: 0, total: 0, lossStreak: 0 };
        APP_STATE[key].processed.clear();
        APP_STATE[key].lastPred = null;
    });
    res.json({ success: true, message: "Đã reset thống kê thành công" });
});

// ====================== KHỞI ĐỘNG SERVER ======================
app.listen(PORT, () => {
    console.log(`🚀 TUANX3000 V10.3 FINAL STABLE ĐÃ KHỞI ĐỘNG`);
    console.log(`   Port → ${PORT}`);
    console.log(`   Min Display → ${CONFIG.MIN_DISPLAY_CONF}%`);
    
    // Sync dữ liệu lần đầu
    syncGameData('nohu');
    syncGameData('md5');
});