/**
 * =========================================================================================
 * 🛠️ TUANX3000 ULTIMATE V4.3 - SNIPER ENGINE (TOOL MODE)
 * 📱 Dành cho Tool / AShell / iPhone - Giao diện đơn giản, dễ đọc
 * =========================================================================================
 */

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ================== [1] CẤU HÌNH ==================
const VIP_CONFIG = {
    NAME: "Tuanx3000",
    VERSION: "V4.3-TOOL",
    MIN_CONFIDENCE: 71,
    CAP_MIN: 63,
    CAP_MAX: 94,
    MAX_HISTORY: 200,
    STREAK_WINDOW: 130,
    SYNC_INTERVAL: 2300,
    CLEAN_INTERVAL: 3600000,
    ENTROPY_THRESHOLD: 0.92,
};

// ================== [2] DATA STORE ==================
const DATA_STORE = {
    nohu: { history: [], stats: { win:0, loss:0, total:0, lossStreak:0, winStreak:0, maxWinStreak:0 }, lastProcessedId: 0, lastPrediction: null },
    md5:  { history: [], stats: { win:0, loss:0, total:0, lossStreak:0, winStreak:0, maxWinStreak:0 }, lastProcessedId: 0, lastPrediction: null }
};

// Auto clean
setInterval(() => {
    Object.keys(DATA_STORE).forEach(mode => {
        DATA_STORE[mode].stats = { win:0, loss:0, total:0, lossStreak:0, winStreak:0, maxWinStreak:0 };
        DATA_STORE[mode].lastProcessedId = 0;
    });
}, VIP_CONFIG.CLEAN_INTERVAL);

// ================== [3] SNIPER CORE (Giữ nguyên logic mạnh) ==================
const SniperCore = {
    calculateMarkov: (sequence) => {
        if (sequence.length < 6) return { probT: 0.5, strength: 0.3 };
        const trans = { TT:{T:0,X:0}, TX:{T:0,X:0}, XT:{T:0,X:0}, XX:{T:0,X:0} };
        for (let i = 0; i < sequence.length - 2; i++) {
            const pair = sequence[i] + sequence[i+1];
            const next = sequence[i+2];
            if (trans[pair]) trans[pair][next]++;
        }
        const lastPair = sequence.slice(-2);
        const current = trans[lastPair] || {T:2, X:2};
        const total = current.T + current.X + 2;
        let probT = (current.T + 1) / total;
        const biasT = (sequence.slice(-30).match(/T/g) || []).length / 30;
        probT = (probT * 0.65) + (biasT * 0.35);
        return { probT: Math.max(0.12, Math.min(0.88, probT)), strength: Math.min(1, Math.abs(probT-0.5)*2) };
    },

    calculateEntropy: (sequence) => {
        const sample = sequence.slice(-40);
        const countT = (sample.match(/T/g) || []).length;
        const p = Math.max(0.01, Math.min(0.99, countT / sample.length));
        return -(p * Math.log2(p) + (1-p) * Math.log2(1-p));
    },

    analyzeDynamicStreak: (sequence) => {
        const chunks = sequence.match(/(.)\1*/g) || [];
        if (chunks.length === 0) return null;
        const currentChunk = chunks[chunks.length-1];
        const currStreak = currentChunk.length;
        const currType = currentChunk[0];
        if (currStreak < 3) return null;

        const windowSeq = sequence.slice(-VIP_CONFIG.STREAK_WINDOW);
        const windowChunks = windowSeq.match(/(.)\1*/g) || [];
        const same = windowChunks.filter(c => c[0] === currType).map(c => c.length);
        const maxPast = same.length ? Math.max(...same) : 4;
        const isBreak = currStreak > maxPast + 1;

        return {
            result: isBreak ? (currType === 'T' ? 'X' : 'T') : currType,
            confidence: isBreak ? Math.min(94, 84 + (currStreak - maxPast)*3.5) : 79 + Math.min(9, currStreak),
            log: isBreak ? `BẺ BỆT MẠNH (${currStreak}/${maxPast})` : `Theo bệt (${currStreak}/${maxPast})`,
            streakInfo: `${currType}${currStreak}`,
            isStrongBreak: isBreak && currStreak >= 5
        };
    },

    patternMatcher: (sequence, lastResult) => {
        const patterns = [
            { regex: /TXTX$|XTXT$|TXTTXT$/, result: lastResult === 'T' ? 'X' : 'T', conf: 91, log: "Cầu 1-1 Chop" },
            { regex: /TXXTXX$|XTTXTT$/, result: lastResult === 'T' ? 'T' : 'X', conf: 90, log: "Cầu 1-2 nối" },
            { regex: /TXX$|XTT$/, result: lastResult === 'T' ? 'X' : 'T', conf: 85, log: "Cầu 1-2 nhảy" },
            { regex: /TXXX$|XTTT$/, result: lastResult === 'T' ? 'X' : 'T', conf: 92, log: "Cầu 1-3" },
            { regex: /TTXX$|XXTT$/, result: lastResult === 'T' ? 'X' : 'T', conf: 93, log: "Khối 2-2" },
            { regex: /TTTXXX$|XXXTTT$/, result: lastResult === 'T' ? 'X' : 'T', conf: 94, log: "Đối xứng 3-3" },
            { regex: /TXXXX$|XTTTT$/, result: lastResult === 'T' ? 'X' : 'T', conf: 93, log: "Cầu 1-4" },
        ];

        for (const p of patterns) {
            if (p.regex.test(sequence)) return p;
        }
        return null;
    },

    analyze: (mode) => {
        const state = DATA_STORE[mode];
        const history = state.history.slice(-VIP_CONFIG.MAX_HISTORY);

        if (history.length < 45) {
            return { res: "CHỜ", conf: "0%", log: `Đang load dữ liệu (${history.length}/45)`, suggestion: "Chờ thêm", streak: "N/A" };
        }

        const results = history.map(h => h.result);
        const sequence = results.map(r => r === 'Tài' ? 'T' : 'X').join('');
        const lastResult = results[results.length - 1];

        if (state.stats.lossStreak >= 3) {
            return { res: "CHỜ", conf: "0%", log: "🚨 3 LOSS - RESET NHỊP", suggestion: "Nghỉ tay", streak: "Reset" };
        }

        const entropy = SniperCore.calculateEntropy(sequence);
        const streak = SniperCore.analyzeDynamicStreak(sequence);
        const pattern = SniperCore.patternMatcher(sequence, lastResult);
        const markov = SniperCore.calculateMarkov(sequence);

        let res = '', conf = 68, log = '';

        if (streak && streak.isStrongBreak) {
            res = streak.result;
            conf = streak.confidence;
            log = streak.log;
        } else if (pattern) {
            res = pattern.result;
            conf = pattern.conf;
            log = pattern.log;
        } else {
            res = markov.probT > 0.515 ? 'T' : 'X';
            conf = 68 + Math.floor(markov.strength * 32);
            log = `Markov (${Math.round(markov.probT*100)}%)`;
        }

        if (entropy > VIP_CONFIG.ENTROPY_THRESHOLD) {
            conf = Math.max(60, conf - 12);
            log += " [Nhiễu]";
        }

        if (conf < VIP_CONFIG.MIN_CONFIDENCE) {
            return { res: "CHỜ", conf: "0%", log: `Cầu yếu (${Math.floor(conf)}%)`, suggestion: "Bỏ qua", streak: streak ? streak.streakInfo : "N/A" };
        }

        let displayConf = Math.max(VIP_CONFIG.CAP_MIN, Math.min(VIP_CONFIG.CAP_MAX, Math.floor(conf)));
        if (streak && streak.isStrongBreak) displayConf = Math.min(VIP_CONFIG.CAP_MAX, displayConf + 3);

        const resultText = res === 'T' ? 'TÀI' : 'XỈU';

        let suggestion = "Cược nhẹ";
        if (displayConf >= 88) suggestion = "CƯỢC MẠNH";
        else if (displayConf >= 80) suggestion = "Cược vừa";

        return {
            res: resultText,
            conf: `${displayConf}%`,
            log: log,
            suggestion: suggestion,
            streak: streak ? streak.streakInfo : "N/A",
            winrate: state.stats.total ? ((state.stats.win / state.stats.total)*100).toFixed(1) + '%' : "0%"
        };
    }
};

// ================== [4] SYNC DATA ==================
async function syncData() {
    const urls = {
        nohu: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=...',
        md5:  'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=...'
    };

    for (const mode of ['nohu', 'md5']) {
        try {
            const res = await fetch(urls[mode]);
            const json = await res.json();
            const raw = Array.isArray(json) ? json : (json.list || json.data || []);

            const cleanData = raw.map(item => ({
                id: Number(item.id || item.SessionId || 0),
                result: (Number(item.DiceSum || 0) >= 11 || 
                         String(item.result || '').toUpperCase().includes('TAI') || 
                         String(item.result || '').includes('Tài')) ? 'Tài' : 'Xỉu'
            })).filter(i => i.id > 0).sort((a,b) => a.id - b.id);

            if (!cleanData.length) continue;

            const state = DATA_STORE[mode];
            const latest = cleanData[cleanData.length - 1];

            if (state.lastPrediction && state.lastPrediction.id === latest.id && state.lastProcessedId < latest.id) {
                const win = state.lastPrediction.res === latest.result;
                if (win) {
                    state.stats.win++; state.stats.winStreak++; state.stats.maxWinStreak = Math.max(state.stats.maxWinStreak, state.stats.winStreak); state.stats.lossStreak = 0;
                } else {
                    state.stats.loss++; state.stats.lossStreak++; state.stats.winStreak = 0;
                }
                state.stats.total++;
                state.lastProcessedId = latest.id;
            }

            state.history = cleanData;
        } catch (e) {}
    }
}

// ================== [5] TOOL INTERFACE - ĐƠN GIẢN & DỄ ĐỌC ==================
app.get('/', (req, res) => {
    const nohu = SniperCore.analyze('nohu');
    const md5 = SniperCore.analyze('md5');

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TUANX3000 TOOL</title>
    <style>
        body { font-family: Arial, sans-serif; background: #111; color: #0f0; padding: 15px; margin: 0; }
        h1 { color: #0ff; text-align: center; }
        .box { background: #1a1a1a; border: 1px solid #0f0; border-radius: 8px; padding: 12px; margin: 12px 0; }
        .title { color: #ff0; font-weight: bold; }
        .tai { color: #00ff88; font-size: 1.8em; }
        .xiu { color: #ff4444; font-size: 1.8em; }
        .wait { color: #888; }
        .info { font-size: 0.9em; line-height: 1.6; }
        .strong { color: #ffff00; font-weight: bold; }
    </style>
</head>
<body>
    <h1>TUANX3000 V4.3 TOOL</h1>
    
    <div class="box">
        <div class="title">🔴 NOHU</div>
        <div class="${nohu.res === 'TÀI' ? 'tai' : nohu.res === 'XỈU' ? 'xiu' : 'wait'}">${nohu.res}</div>
        <div class="strong">${nohu.conf}</div>
        <div class="info">Streak: ${nohu.streak} | Winrate: ${nohu.winrate}<br>
        Phân tích: ${nohu.log}<br>
        Gợi ý: <span class="strong">${nohu.suggestion}</span></div>
    </div>

    <div class="box">
        <div class="title">🔵 MD5</div>
        <div class="${md5.res === 'TÀI' ? 'tai' : md5.res === 'XỈU' ? 'xiu' : 'wait'}">${md5.res}</div>
        <div class="strong">${md5.conf}</div>
        <div class="info">Streak: ${md5.streak} | Winrate: ${md5.winrate}<br>
        Phân tích: ${md5.log}<br>
        Gợi ý: <span class="strong">${md5.suggestion}</span></div>
    </div>

    <p style="text-align:center; color:#555; font-size:0.8em;">
        Tự động cập nhật • ${new Date().toLocaleString('vi-VN')}
    </p>

    <script>
        setInterval(() => location.reload(), 3000);
    </script>
</body>
</html>`;

    res.send(html);
});

// ================== [6] API JSON (cho tool gọi) ==================
app.get('/api/v4.3/predict', (req, res) => {
    const output = {};
    ['nohu', 'md5'].forEach(mode => {
        const p = SniperCore.analyze(mode);
        const lastId = DATA_STORE[mode].history.length ? DATA_STORE[mode].history.at(-1).id : 0;
        
        DATA_STORE[mode].lastPrediction = { id: lastId, res: p.res === "CHỜ" ? null : (p.res === "TÀI" ? "Tài" : "Xỉu") };
        
        output[mode] = { ...p, session: lastId + 1 };
    });
    res.json({ version: VIP_CONFIG.VERSION, results: output });
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n🚀 TUANX3000 ${VIP_CONFIG.VERSION} TOOL MODE đang chạy`);
    console.log(`🌐 Tool Interface: http://localhost:${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api/v4.3/predict\n`);
});

setInterval(syncData, VIP_CONFIG.SYNC_INTERVAL);q