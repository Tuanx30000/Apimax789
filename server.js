/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V10.1 - FINAL CLEAN VERSION
 * TỔNG HỢP TOÀN BỘ THUẬT TOÁN + DASHBOARD + SNIPER + LOW THRESHOLD
 * ĐÃ DÒ SOÁT & TỐI ƯU HOÁ TOÀN BỘ CODE
 * ADMIN: TUANX3000 | VERSION: 10.1
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
    VERSION: "10.1 - FINAL CLEAN",
    SYNC_INTERVAL: 4000,        // Đồng bộ mỗi 4 giây
    MIN_DISPLAY_CONF: 62,       // Ngưỡng hiển thị tối thiểu
    SNIPER_CONF: 82,            // Ngưỡng sniper (đánh dấu cao)
    CLEAN_INTERVAL: 3600000,    // Reset thống kê mỗi 1 tiếng
    MAX_HISTORY: 350,
    MIN_HISTORY: 30
};

const API_CONFIG = {
    NOHU: "https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGx%2F%2BEp1KITyrOSx3mDcMtc5B3UwDAmuWFK%2B4Q2zPWqSvs2oZwpd%2Br9QdeJ1hnJUb8IcbyKqxyPlMIOJJAyxJUfd0OqlciaAuYtSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90qGC6XXtfwAHRAKA39iyk%2Fm9LsY8cf%2F60hs8XvL9mZS4qPwgCPexrDXV1A5Nm2JZrakjJ%2Be%2BLN1QnGgujDb20vlNUs4k%2B9ywsi1BloYvlX2jLNtGh9vXMb9sjNdKkMxfFHX4XsE3dCy2Ne40CBorDKUUfWUqyR4Sy8rrilkKmEQWvrmizMJktzovfxnS6RmoL3qMn6lVZ%2F9we1KbuLagAZZXKUOHq1HU4us9CZfEJ%2BkQaJUp2JGQubDA%2BNEA42ydc%3D.beê2c3ce5b6a4e551e08a7493ec41ca067b075e7eaba0fc4c659ae63c0801a81",
    
    MD5: "https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7"
};

// ====================== 2. TRẠNG THÁI HỆ THỐNG ======================
let APP_STATE = {
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

// Auto Reset thống kê mỗi 1 tiếng
setInterval(() => {
    Object.keys(APP_STATE).forEach(key => {
        APP_STATE[key].stats = { win: 0, loss: 0, total: 0, lossStreak: 0 };
        APP_STATE[key].processed.clear();
        APP_STATE[key].lastPred = null;
    });
    console.log(`🔄 [V10.1] Auto Clean System - Reset thống kê thành công`);
}, CONFIG.CLEAN_INTERVAL);

// ====================== 3. THUẬT TOÁN SIÊU TỔNG HỢP ======================
const Algorithms = {

    // Bệt hiện tại
    getStreak: (history) => {
        if (history.length === 0) return { length: 0, result: null };
        const last = history[history.length - 1].result;
        let length = 1;
        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i].result === last) length++;
            else break;
        }
        return { length, result: last };
    },

    // Cầu 1-1 (Zigzag)
    isZigzag: (history) => {
        const seq = history.slice(-10).map(h => h.result);
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] === seq[i - 1]) return false;
        }
        return seq.length >= 6;
    },

    // Cầu nhịp đôi
    isDoublePattern: (history) => {
        const seq = history.slice(-12).map(h => h.result);
        for (let i = 2; i < seq.length; i += 2) {
            if (seq[i] !== seq[i - 2]) return false;
        }
        return seq.length >= 8;
    },

    // Markov Chain
    markovPattern: (history) => {
        const seq = history.slice(-7).map(h => h.result === 'Tài' ? 'T' : 'X').join('');
        const map = {
            'TTTTTTT': 'X', 'XXXXXXX': 'T',
            'TTXXTTX': 'X', 'XXTTXXT': 'T',
            'TXTXTXT': 'T', 'XTXTXTX': 'X'
        };
        return map[seq] || null;
    },

    // Tần suất lệch
    frequencyBias: (history) => {
        const recent = history.slice(-18);
        const taiCount = recent.filter(h => h.result === 'Tài').length;
        if (taiCount >= 13) return 'Xỉu';
        if (taiCount <= 5) return 'Tài';
        return null;
    },

    // Momentum (Đà)
    momentum: (history) => {
        if (history.length < 6) return null;
        let score = 0;
        history.slice(-6).forEach((h, i) => {
            score += (h.result === 'Tài' ? 1 : -1) * (i + 1);
        });
        if (score >= 13) return 'Xỉu';
        if (score <= -13) return 'Tài';
        return null;
    },

    // Cân bằng Entropy
    entropyBalance: (history) => {
        const recent = history.slice(-20);
        const tai = recent.filter(h => h.result === 'Tài').length;
        const diff = Math.abs(tai - (recent.length - tai));
        if (diff <= 3) return null;
        return tai > (recent.length - tai) ? 'Xỉu' : 'Tài';
    }
};

// ====================== 4. BỘ NÃO DỰ ĐOÁN CHÍNH ======================
function predictNext(type) {
    const state = APP_STATE[type];
    const history = state.history;

    // Điều kiện dừng
    if (history.length < CONFIG.MIN_HISTORY) {
        return { ketqua: 'CHỜ', tin_cay: '0%', logic: 'Đang thu thập dữ liệu...' };
    }

    if (state.stats.lossStreak >= 3) {
        return { ketqua: 'CHỜ', tin_cay: '0%', logic: '🔴 Gãy 3 tay liên tiếp - Chờ nhịp mới' };
    }

    const lastResult = history[history.length - 1].result;
    const streak = Algorithms.getStreak(history);

    let votes = { 'Tài': 0, 'Xỉu': 0 };
    let logs = [];

    // 1. Dynamic Streak Analysis
    if (streak.length >= 3) {
        const shouldBreak = streak.length >= 5 || (streak.length === 4 && Math.random() > 0.35);
        const prediction = shouldBreak ? (streak.result === 'Tài' ? 'Xỉu' : 'Tài') : streak.result;
        const confidence = shouldBreak ? 89 : 77;

        votes[prediction] += 3.2;
        logs.push(`Bệt ${streak.length} tay → ${shouldBreak ? 'Bẻ cầu' : 'Theo bệt'}`);
    }

    // 2. Pattern Recognition
    if (Algorithms.isZigzag(history)) {
        votes[lastResult === 'Tài' ? 'Xỉu' : 'Tài'] += 2.8;
        logs.push('Cầu Zigzag 1-1 mạnh');
    }

    if (Algorithms.isDoublePattern(history)) {
        votes[lastResult === 'Tài' ? 'Xỉu' : 'Tài'] += 2.2;
        logs.push('Cầu nhịp đôi');
    }

    // 3. Các thuật toán phụ
    const markov = Algorithms.markovPattern(history);
    if (markov) {
        votes[markov === 'T' ? 'Tài' : 'Xỉu'] += 2.0;
        logs.push('Markov Pattern');
    }

    const freq = Algorithms.frequencyBias(history);
    if (freq) {
        votes[freq] += 1.7;
        logs.push('Tần suất lệch');
    }

    const momentumRes = Algorithms.momentum(history);
    if (momentumRes) {
        votes[momentumRes] += 1.6;
        logs.push('Momentum');
    }

    const entropyRes = Algorithms.entropyBalance(history);
    if (entropyRes) {
        votes[entropyRes] += 1.4;
        logs.push('Entropy Balance');
    }

    // Quyết định cuối cùng từ Voting System
    const finalKetqua = votes['Tài'] > votes['Xỉu'] ? 'Tài' : 'Xỉu';
    let finalConf = Math.floor(62 + (Math.max(votes['Tài'], votes['Xỉu']) * 7));
    finalConf = Math.min(94, finalConf);

    let displayResult = finalKetqua === 'Tài' ? 'TÀI' : 'XỈU';
    let displayLogic = logs.length > 0 ? logs.join(' + ') : 'Phân tích tổng hợp';

    // Áp dụng ngưỡng hiển thị
    if (finalConf < CONFIG.MIN_DISPLAY_CONF) {
        return { ketqua: 'CHỜ', tin_cay: '0%', logic: 'Cầu chưa đủ mạnh' };
    }

    // Đánh dấu tỉ lệ thấp
    if (finalConf < CONFIG.SNIPER_CONF) {
        displayResult += ' (Thấp)';
    }

    return {
        ketqua: displayResult,
        tin_cay: `${finalConf}%`,
        logic: displayLogic
    };
}

// ====================== 5. ĐỒNG BỘ DỮ LIỆU ======================
async function syncGameData(type) {
    try {
        const response = await fetch(API_CONFIG[type.toUpperCase()]);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const rawList = await response.json();
        if (!Array.isArray(rawList) || rawList.length === 0) return;

        const newHistory = rawList.map(item => ({
            session: Number(item.SessionId || 0),
            result: (item.BetSide === 0 || item.BetSide === "0") ? 'Tài' : 'Xỉu'
        })).filter(h => h.session > 0)
          .sort((a, b) => a.session - b.session);

        const state = APP_STATE[type];
        const latest = newHistory[newHistory.length - 1];

        // Cập nhật thống kê thắng thua
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

        state.history = newHistory.slice(-CONFIG.MAX_HISTORY);

    } catch (error) {
        console.error(`[SYNC ERROR - ${type.toUpperCase()}]:`, error.message);
    }
}

// Đồng bộ định kỳ
setInterval(() => {
    syncGameData('nohu');
    syncGameData('md5');
}, CONFIG.SYNC_INTERVAL);

// ====================== 6. API ROUTES ======================
app.get('/api/all', (req, res) => {
    try {
        const buildResponse = (type) => {
            const state = APP_STATE[type];
            const lastSession = state.history.length > 0 ? state.history[state.history.length - 1].session : 0;
            const nextSession = lastSession + 1;

            let prediction = state.lastPred;
            if (!prediction || prediction.phien !== nextSession) {
                prediction = predictNext(type);
                state.lastPred = { phien: nextSession, ...prediction };
            }

            return {
                phien_tiep: nextSession,
                du_doan: prediction.ketqua,
                tin_cay: prediction.tin_cay,
                logic: prediction.logic,
                lich_su: state.history.slice(-15).map(h => h.result[0]).join('-'),
                thong_ke: {
                    thang: state.stats.win,
                    thua: state.stats.loss,
                    loss_streak: state.stats.lossStreak,
                    winrate: state.stats.total > 0 ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + '%' : '0%'
                }
            };
        };

        res.json({
            system: `TUANX3000 V${CONFIG.VERSION}`,
            admin: CONFIG.ADMIN,
            server_time: new Date().toLocaleString('vi-VN'),
            nohu: buildResponse('nohu'),
            md5: buildResponse('md5')
        });
    } catch (err) {
        console.error('[API ERROR]', err);
        res.status(500).json({ error: "Lỗi server" });
    }
});

// ====================== 7. GIAO DIỆN DASHBOARD ======================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TUANX3000 V10.1</title>
            <style>
                body { background: #0a0a0a; color: #0f0; font-family: monospace; margin: 0; padding: 20px; }
                h1 { color: #00ffcc; text-align: center; text-shadow: 0 0 15px #00ffcc; }
                .container { display: flex; flex-wrap: wrap; gap: 25px; justify-content: center; max-width: 1200px; margin: auto; }
                .card { background: #111; border: 2px solid #00ff88; border-radius: 15px; padding: 25px; width: 500px; box-shadow: 0 0 20px rgba(0, 255, 136, 0.2); }
                .md5-card { border-color: #ff00ff; box-shadow: 0 0 20px rgba(255, 0, 255, 0.2); }
                .result { font-size: 54px; font-weight: bold; margin: 15px 0; }
                .low { color: #ffaa00 !important; }
                .info { margin: 8px 0; line-height: 1.5; }
            </style>
        </head>
        <body>
            <h1>🚀 TUANX3000 V10.1 - FINAL CLEAN</h1>
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
                async function refresh() {
                    try {
                        const response = await fetch('/api/all');
                        const data = await response.json();

                        const render = (id, item, color) => {
                            const isLow = item.du_doan.includes('(Thấp)');
                            document.getElementById(id).innerHTML = `
                                <div class="result ${isLow ? 'low' : ''}" style="color:${color}">${item.du_doan}</div>
                                <div class="info">Phiên tiếp theo: <b>${item.phien_tiep}</b></div>
                                <div class="info">Độ tin cậy: <b>${item.tin_cay}</b></div>
                                <div class="info">Logic: <i>${item.logic}</i></div>
                                <div class="info">Lịch sử: ${item.lich_su}</div>
                                <div class="info">Loss streak: <span style="color:#ff5555">${item.thong_ke.loss_streak}</span></div>
                            `;
                        };

                        render('nohu', data.nohu, '#00ff88');
                        render('md5', data.md5, '#ff00ff');
                    } catch (e) {
                        console.log("Lỗi kết nối dashboard");
                    }
                }

                setInterval(refresh, 2000);
                refresh();
            </script>
        </body>
        </html>
    `);
});

// Reset thống kê thủ công
app.get('/reset', (req, res) => {
    Object.keys(APP_STATE).forEach(key => {
        APP_STATE[key].stats = { win: 0, loss: 0, total: 0, lossStreak: 0 };
        APP_STATE[key].processed.clear();
        APP_STATE[key].lastPred = null;
    });
    res.json({ success: true, message: "Đã reset thống kê thành công" });
});

// ====================== KHỞI ĐỘNG SERVER ======================
app.listen(PORT, () => {
    console.log(`🚀 TUANX3000 V10.1 FINAL CLEAN ĐÃ KHỞI ĐỘNG`);
    console.log(`   Port: ${PORT} | Sync: ${CONFIG.SYNC_INTERVAL}ms | Min Display: ${CONFIG.MIN_DISPLAY_CONF}%`);
    
    // Sync lần đầu
    syncGameData('nohu');
    syncGameData('md5');
});