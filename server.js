/**
 * =========================================================================================
 * 🛠️ TUANX3000 ULTIMATE V4.3 - SNIPER ENGINE (FINAL + DASHBOARD)
 * 📱 Optimized for iPhone 12 Pro Max / AShell / Node.js
 * 🔥 Dynamic Streak + Advanced Pattern + Markov Chain + Entropy + Safety System
 * =========================================================================================
 */

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ================== [1] CẤU HÌNH VIP ==================
const VIP_CONFIG = {
    NAME: "Tuanx3000",
    VERSION: "V4.3-FINAL",
    MIN_CONFIDENCE: 71,           // Ngưỡng ra lệnh tối thiểu
    CAP_MIN: 63,                  // Giới hạn confidence hiển thị thấp nhất
    CAP_MAX: 94,                  // Giới hạn confidence hiển thị cao nhất (tránh soi)
    MAX_HISTORY: 200,             // Số phiên tối đa dùng để phân tích
    STREAK_WINDOW: 130,           // Cửa sổ tính streak gần nhất
    SYNC_INTERVAL: 2300,          // Đồng bộ dữ liệu mỗi 2.3 giây
    CLEAN_INTERVAL: 3600000,      // Reset thống kê mỗi 1 giờ
    ENTROPY_THRESHOLD: 0.92,      // Ngưỡng entropy cao → bàn nhiễu nhiều
};

// ================== [2] DATABASE STORE ==================
const DATA_STORE = {
    nohu: {
        history: [],
        stats: { win: 0, loss: 0, total: 0, lossStreak: 0, winStreak: 0, maxWinStreak: 0 },
        lastProcessedId: 0,
        lastPrediction: null
    },
    md5: {
        history: [],
        stats: { win: 0, loss: 0, total: 0, lossStreak: 0, winStreak: 0, maxWinStreak: 0 },
        lastProcessedId: 0,
        lastPrediction: null
    }
};

// Auto reset statistics mỗi giờ
setInterval(() => {
    Object.keys(DATA_STORE).forEach(mode => {
        DATA_STORE[mode].stats = { win: 0, loss: 0, total: 0, lossStreak: 0, winStreak: 0, maxWinStreak: 0 };
        DATA_STORE[mode].lastProcessedId = 0;
        console.log(`🔄 [AUTO CLEAN] Reset statistics cho ${mode.toUpperCase()}`);
    });
}, VIP_CONFIG.CLEAN_INTERVAL);

// ================== [3] SNIPER CORE - THUẬT TOÁN CHI TIẾT ==================
const SniperCore = {

    /** MARKOV CHAIN - Tính xác suất chuyển tiếp */
    calculateMarkov: (sequence) => {
        if (sequence.length < 6) return { probT: 0.5, strength: 0.3 };

        const trans = {
            TT: { T: 0, X: 0 },
            TX: { T: 0, X: 0 },
            XT: { T: 0, X: 0 },
            XX: { T: 0, X: 0 }
        };

        for (let i = 0; i < sequence.length - 2; i++) {
            const pair = sequence[i] + sequence[i + 1];
            const next = sequence[i + 2];
            if (trans[pair]) trans[pair][next]++;
        }

        const lastPair = sequence.slice(-2);
        const current = trans[lastPair] || { T: 2, X: 2 };

        const total = current.T + current.X + 2; // Laplace smoothing
        let probT = (current.T + 1) / total;

        // Kết hợp bias từ 30 phiên gần nhất
        const recent30 = sequence.slice(-30);
        const biasT = (recent30.match(/T/g) || []).length / 30;
        probT = (probT * 0.65) + (biasT * 0.35);

        const strength = Math.abs(probT - 0.5) * 2;

        return {
            probT: Math.max(0.12, Math.min(0.88, probT)),
            strength: Math.min(1, strength)
        };
    },

    /** ENTROPY - Đo độ nhiễu / ngẫu nhiên của bàn */
    calculateEntropy: (sequence) => {
        const sample = sequence.slice(-40);
        if (sample.length === 0) return 1.0;
        const countT = (sample.match(/T/g) || []).length;
        const p = Math.max(0.01, Math.min(0.99, countT / sample.length));
        return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
    },

    /** DYNAMIC STREAK ANALYSIS - Phát hiện bệt và bẻ bệt */
    analyzeDynamicStreak: (sequence) => {
        const chunks = sequence.match(/(.)\1*/g) || [];
        if (chunks.length === 0) return null;

        const currentChunk = chunks[chunks.length - 1];
        const currStreak = currentChunk.length;
        const currType = currentChunk[0];

        if (currStreak < 3) return null;

        const windowSeq = sequence.slice(-VIP_CONFIG.STREAK_WINDOW);
        const windowChunks = windowSeq.match(/(.)\1*/g) || [];
        const sameStreaks = windowChunks
            .filter(c => c[0] === currType)
            .map(c => c.length);

        const maxPast = sameStreaks.length ? Math.max(...sameStreaks) : 4;
        const isBreak = currStreak > maxPast + 1;

        return {
            result: isBreak ? (currType === 'T' ? 'X' : 'T') : currType,
            confidence: isBreak 
                ? Math.min(94, 84 + (currStreak - maxPast) * 3.5)
                : 79 + Math.min(9, currStreak),
            log: isBreak 
                ? `🔥 BẺ BỆT MẠNH (${currStreak} > ${maxPast})`
                : `📈 Theo bệt (${currStreak}/${maxPast})`,
            streakInfo: `${currType}${currStreak}`,
            isStrongBreak: isBreak && currStreak >= 5
        };
    },

    /** PATTERN MATCHER - Nhận diện các cầu phổ biến */
    patternMatcher: (sequence, lastResult) => {
        const patterns = [
            { regex: /TXTX$|XTXT$|TXTTXT$/, result: lastResult === 'T' ? 'X' : 'T', conf: 91, log: "Cầu nhảy 1-1 / Chop" },
            { regex: /TXXTXX$|XTTXTT$/,     result: lastResult === 'T' ? 'T' : 'X', conf: 90, log: "Cầu 1-2 nối" },
            { regex: /TXX$|XTT$/,           result: lastResult === 'T' ? 'X' : 'T', conf: 85, log: "Cầu 1-2 nhảy" },
            { regex: /TXXX$|XTTT$/,         result: lastResult === 'T' ? 'X' : 'T', conf: 92, log: "Cầu 1-3 nhảy" },
            { regex: /TTXX$|XXTT$/,         result: lastResult === 'T' ? 'X' : 'T', conf: 93, log: "Khối 2-2" },
            { regex: /TTTXXX$|XXXTTT$/,     result: lastResult === 'T' ? 'X' : 'T', conf: 94, log: "Đối xứng 3-3" },
            { regex: /TXXXX$|XTTTT$/,       result: lastResult === 'T' ? 'X' : 'T', conf: 93, log: "Cầu 1-4" },
            { regex: /TTXXX$|XXTTT$/,       result: lastResult === 'T' ? 'X' : 'T', conf: 88, log: "Gãy 2-3" },
            { regex: /TTTXX$|XXXTT$/,       result: lastResult === 'T' ? 'T' : 'X', conf: 87, log: "Nối 3-2" },
            { regex: /T{4,}X|X{4,}T/,       result: lastResult === 'T' ? 'X' : 'T', conf: 90, log: "Bẻ bệt dài" },
        ];

        for (const p of patterns) {
            if (p.regex.test(sequence)) {
                return { result: p.result, confidence: p.conf, log: p.log };
            }
        }
        return null;
    },

    /** HÀM PHÂN TÍCH CHÍNH */
    analyze: (mode) => {
        const state = DATA_STORE[mode];
        const history = state.history.slice(-VIP_CONFIG.MAX_HISTORY);

        if (history.length < 45) {
            return {
                res: "CHỜ",
                conf: "0%",
                log: `Đang thu thập dữ liệu (${history.length}/45)...`,
                suggestion: "Vui lòng đợi thêm phiên",
                streak: "N/A"
            };
        }

        const results = history.map(h => h.result);
        const sequence = results.map(r => r === 'Tài' ? 'T' : 'X').join('');
        const lastResult = results[results.length - 1];

        // SAFETY LAYER - 3 Loss Kill Switch
        if (state.stats.lossStreak >= 3) {
            return {
                res: "CHỜ",
                conf: "0%",
                log: "🚨 3 TAY THUA LIÊN TIẾP - RESET NHỊP MỚI",
                suggestion: "Nghỉ 10-15 tay trước khi vào lại",
                streak: "Reset"
            };
        }

        const entropy = SniperCore.calculateEntropy(sequence);
        const streakAnalysis = SniperCore.analyzeDynamicStreak(sequence);
        const patternResult = SniperCore.patternMatcher(sequence, lastResult);
        const markov = SniperCore.calculateMarkov(sequence);

        let finalResult = '';
        let finalConfidence = 68;
        let finalLog = '';

        // Ưu tiên Layer 1: Bẻ bệt mạnh
        if (streakAnalysis && streakAnalysis.isStrongBreak) {
            finalResult = streakAnalysis.result;
            finalConfidence = streakAnalysis.confidence;
            finalLog = streakAnalysis.log;
        }
        // Layer 2: Pattern rõ ràng
        else if (patternResult) {
            finalResult = patternResult.result;
            finalConfidence = patternResult.confidence;
            finalLog = patternResult.log;
        }
        // Layer 3: Markov Ensemble
        else {
            finalResult = markov.probT > 0.515 ? 'T' : 'X';
            finalConfidence = 68 + Math.floor(markov.strength * 32);
            finalLog = `Markov Ensemble (${Math.round(markov.probT * 100)}% Tài)`;
        }

        // Điều chỉnh theo Entropy (bàn càng nhiễu → giảm confidence)
        if (entropy > VIP_CONFIG.ENTROPY_THRESHOLD) {
            finalConfidence = Math.max(60, finalConfidence - 12);
            finalLog += " [Entropy cao]";
        }

        // Lọc lệnh chất lượng thấp
        if (finalConfidence < VIP_CONFIG.MIN_CONFIDENCE) {
            return {
                res: "CHỜ",
                conf: "0%",
                log: `Cầu chưa rõ ràng hoặc nhiễu (${Math.floor(finalConfidence)}%)`,
                suggestion: "Bỏ qua lệnh này",
                streak: streakAnalysis ? streakAnalysis.streakInfo : "N/A"
            };
        }

        // Áp dụng giới hạn confidence
        let displayConf = Math.max(VIP_CONFIG.CAP_MIN, Math.min(VIP_CONFIG.CAP_MAX, Math.floor(finalConfidence)));
        if (streakAnalysis && streakAnalysis.isStrongBreak) displayConf = Math.min(VIP_CONFIG.CAP_MAX, displayConf + 3);

        const resultText = finalResult === 'T' ? 'TÀI' : 'XỈU';

        // Gợi ý mức cược
        let suggestion = "Cược nhẹ (20-30%)";
        if (displayConf >= 88) suggestion = "CƯỢC MẠNH (70-90%)";
        else if (displayConf >= 82) suggestion = "Cược vừa (45-65%)";
        else if (displayConf >= 75) suggestion = "Cược trung bình (30-45%)";

        return {
            res: resultText,
            conf: `${displayConf}%`,
            log: finalLog,
            suggestion: suggestion,
            streak: streakAnalysis ? streakAnalysis.streakInfo : "N/A",
            entropy: entropy.toFixed(2),
            winrate: state.stats.total ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + '%' : "0%"
        };
    }
};

// ================== [4] SYNC DATA ENGINE ==================
async function syncData() {
    const urls = {
        nohu: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
        md5:  'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d77'
    };

    for (const mode of ['nohu', 'md5']) {
        try {
            const response = await fetch(urls[mode]);
            const json = await response.json();
            const raw = Array.isArray(json) ? json : (json.list || json.data || []);

            const cleanData = raw
                .map(item => ({
                    id: Number(item.id || item.SessionId || item.session || 0),
                    result: (Number(item.DiceSum || 0) >= 11 ||
                             String(item.result || item.outcome || '').toUpperCase().includes('TAI') ||
                             String(item.result || '').includes('Tài')) ? 'Tài' : 'Xỉu'
                }))
                .filter(item => item.id > 0)
                .sort((a, b) => a.id - b.id);

            if (cleanData.length === 0) continue;

            const state = DATA_STORE[mode];
            const latest = cleanData[cleanData.length - 1];

            // Cập nhật thống kê thắng thua
            if (state.lastPrediction && 
                state.lastPrediction.id === latest.id && 
                state.lastProcessedId < latest.id) {

                const isWin = state.lastPrediction.res === latest.result;
                if (isWin) {
                    state.stats.win++;
                    state.stats.winStreak++;
                    state.stats.maxWinStreak = Math.max(state.stats.maxWinStreak, state.stats.winStreak);
                    state.stats.lossStreak = 0;
                } else {
                    state.stats.loss++;
                    state.stats.lossStreak++;
                    state.stats.winStreak = 0;
                }
                state.stats.total++;
                state.lastProcessedId = latest.id;
            }

            state.history = cleanData;
        } catch (error) {
            // Silent catch - không log lỗi để tránh spam console
        }
    }
}

// ================== [5] API JSON ==================
app.get('/api/v4.3/predict', (req, res) => {
    const output = {};

    ['nohu', 'md5'].forEach(mode => {
        const prediction = SniperCore.analyze(mode);
        const lastSessionId = DATA_STORE[mode].history.length 
            ? DATA_STORE[mode].history[DATA_STORE[mode].history.length - 1].id 
            : 0;

        DATA_STORE[mode].lastPrediction = {
            id: lastSessionId,
            res: prediction.res === "CHỜ" ? null : (prediction.res === "TÀI" ? "Tài" : "Xỉu")
        };

        output[mode] = {
            ...prediction,
            session: lastSessionId + 1,
            mode: mode.toUpperCase()
        };
    });

    res.json({
        developer: VIP_CONFIG.NAME,
        version: VIP_CONFIG.VERSION,
        status: "ONLINE",
        timestamp: new Date().toISOString(),
        results: output
    });
});

// ================== [6] GIAO DIỆN HTML ĐẸP (Trang chính) ==================
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>TUANX3000 V4.3</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
        body { font-family: 'Roboto', sans-serif; background:#0a0a14; color:#0ff; margin:0; padding:10px; }
        .header { text-align:center; padding:15px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:15px; margin-bottom:15px; }
        .card { background:#1a1a2e; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 4px 20px rgba(0,255,255,0.15); }
        .mode { font-size:1.15em; font-weight:700; color:#ffd700; }
        .result { font-size:2.4em; font-weight:700; text-align:center; margin:12px 0; }
        .tai { color:#00ff88; }
        .xiu { color:#ff3366; }
        .conf { font-size:1.5em; color:#ffd700; text-align:center; }
        .info { font-size:0.95em; line-height:1.7; color:#bbb; }
        .suggestion { background:#16213e; padding:12px; border-radius:10px; margin-top:12px; font-weight:500; color:#0ff; }
        .footer { text-align:center; font-size:0.85em; color:#555; margin-top:20px; }
        .refresh { color:#0f0; animation:pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    </style>
</head>
<body>
    <div class="header">
        <h1>TUANX3000 <span style="color:#ffd700;">V4.3 FINAL</span></h1>
        <p>Sniper Engine • Real-time Prediction</p>
    </div>

    <div id="content">Đang tải dữ liệu...</div>

    <div class="footer">
        <span class="refresh">●</span> Tự động cập nhật mỗi 3 giây • ${new Date().toLocaleTimeString('vi-VN')}
    </div>

    <script>
        async function loadDashboard() {
            try {
                const response = await fetch('/api/v4.3/predict');
                const data = await response.json();

                let html = '';
                Object.keys(data.results).forEach(key => {
                    const p = data.results[key];
                    const isTai = p.res === 'TÀI';
                    const color = isTai ? 'tai' : 'xiu';

                    html += \`
                    <div class="card">
                        <div class="mode">\${p.mode} • Session \${p.session}</div>
                        <div class="result \${color}">\${p.res}</div>
                        <div class="conf">\${p.conf}</div>
                        <div class="info">
                            <strong>Phân tích:</strong> \${p.log}<br>
                            <strong>Streak:</strong> \${p.streak} | <strong>Winrate:</strong> \${p.winrate}<br>
                            <strong>Entropy:</strong> \${p.entropy}
                        </div>
                        \${p.res !== 'CHỜ' ? \`<div class="suggestion">💰 \${p.suggestion}</div>\` : ''}
                    </div>\`;
                });

                document.getElementById('content').innerHTML = html;
            } catch (err) {
                document.getElementById('content').innerHTML = 
                    '<div class="card" style="color:#ff6666;text-align:center;">Không kết nối được server.<br>Đang thử lại...</div>';
            }
        }

        // Load ngay và refresh định kỳ
        loadDashboard();
        setInterval(loadDashboard, 3000);
    </script>
</body>
</html>
    `);
});

// ================== [7] KHỞI CHẠY SERVER ==================
app.listen(PORT, () => {
    console.log(`\n🚀 TUANX3000 ${VIP_CONFIG.VERSION} + DASHBOARD đã khởi động thành công!`);
    console.log(`🌐 Giao diện: http://localhost:${PORT}`);
    console.log(`📡 API JSON: http://localhost:${PORT}/api/v4.3/predict\n`);

    // Bắt đầu đồng bộ dữ liệu
    setInterval(syncData, VIP_CONFIG.SYNC_INTERVAL);
});

console.log("TUANX3000 V4.3 Final - Ready");