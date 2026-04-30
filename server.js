/**
 * =========================================================================================
 * 🛠️ TUANX3000 ULTIMATE V4.4 - SNIPER ENGINE (JSON MODE)
 * 📱 Xuất dữ liệu JSON cho Tool / AShell / App gọi API
 * =========================================================================================
 */

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ================== [1] CẤU HÌNH CHÍNH V4.4 ==================
const VIP_CONFIG = {
    NAME: "Tuanx3000",
    VERSION: "V4.4-JSON",
    MIN_CONFIDENCE: 71,
    CAP_MIN: 63,
    CAP_MAX: 94,
    MAX_HISTORY: 200,
    STREAK_WINDOW: 130,
    SYNC_INTERVAL: 2300,
    CLEAN_INTERVAL: 3600000,
    ENTROPY_THRESHOLD: 0.92,
};

// ================== [2] BỘ NHỚ DỮ LIỆU ==================
const DATA_STORE = {
    nohu: {
        history: [],
        stats: {
            win: 0,
            loss: 0,
            total: 0,
            lossStreak: 0,
            winStreak: 0,
            maxWinStreak: 0
        },
        lastProcessedId: 0,
        lastPrediction: null
    },
    md5: {
        history: [],
        stats: {
            win: 0,
            loss: 0,
            total: 0,
            lossStreak: 0,
            winStreak: 0,
            maxWinStreak: 0
        },
        lastProcessedId: 0,
        lastPrediction: null
    }
};

// Tự động reset thống kê mỗi giờ
setInterval(() => {
    Object.keys(DATA_STORE).forEach(mode => {
        DATA_STORE[mode].stats = {
            win: 0,
            loss: 0,
            total: 0,
            lossStreak: 0,
            winStreak: 0,
            maxWinStreak: 0
        };
        DATA_STORE[mode].lastProcessedId = 0;
    });
    console.log(`🔄 [SYSTEM] Đã reset thống kê tự động`);
}, VIP_CONFIG.CLEAN_INTERVAL);

// ================== [3] THUẬT TOÁN SNIPER CORE ==================
const SniperCore = {
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
        const total = current.T + current.X + 2;

        let probT = (current.T + 1) / total;

        const biasT = (sequence.slice(-30).match(/T/g) || []).length / 30;
        probT = (probT * 0.65) + (biasT * 0.35);

        const strength = Math.abs(probT - 0.5) * 2;

        return {
            probT: Math.max(0.12, Math.min(0.88, probT)),
            strength: Math.min(1, strength)
        };
    },

    calculateEntropy: (sequence) => {
        const sample = sequence.slice(-40);
        if (sample.length === 0) return 1.0;
        const countT = (sample.match(/T/g) || []).length;
        const p = Math.max(0.01, Math.min(0.99, countT / sample.length));
        return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
    },

    analyzeDynamicStreak: (sequence) => {
        const chunks = sequence.match(/(.)\1*/g) || [];
        if (chunks.length === 0) return null;

        const currentChunk = chunks[chunks.length - 1];
        const currStreak = currentChunk.length;
        const currType = currentChunk[0];

        if (currStreak < 3) return null;

        const windowSeq = sequence.slice(-VIP_CONFIG.STREAK_WINDOW);
        const windowChunks = windowSeq.match(/(.)\1*/g) || [];
        const sameTypeStreaks = windowChunks
            .filter(c => c[0] === currType)
            .map(c => c.length);

        const maxPast = sameTypeStreaks.length ? Math.max(...sameTypeStreaks) : 4;
        const isBreak = currStreak > maxPast + 1;

        return {
            result: isBreak ? (currType === 'T' ? 'X' : 'T') : currType,
            confidence: isBreak
                ? Math.min(94, 84 + (currStreak - maxPast) * 3.5)
                : 79 + Math.min(9, currStreak),
            log: isBreak
                ? `BẺ BỆT MẠNH (${currStreak} > ${maxPast})`
                : `Theo bệt (${currStreak}/${maxPast})`,
            streakInfo: `${currType}${currStreak}`,
            isStrongBreak: isBreak && currStreak >= 5
        };
    },

    patternMatcher: (sequence, lastResult) => {
        const patterns = [
            { regex: /TXTX$|XTXT$|TXTTXT$/, result: lastResult === 'T' ? 'X' : 'T', conf: 91, log: "Cầu nhảy 1-1 (Chop)" },
            { regex: /TXXTXX$|XTTXTT$/,     result: lastResult === 'T' ? 'T' : 'X', conf: 90, log: "Cầu 1-2 nối tiếp" },
            { regex: /TXX$|XTT$/,           result: lastResult === 'T' ? 'X' : 'T', conf: 85, log: "Cầu 1-2 nhảy" },
            { regex: /TXXX$|XTTT$/,         result: lastResult === 'T' ? 'X' : 'T', conf: 92, log: "Cầu 1-3 nhảy" },
            { regex: /TTXX$|XXTT$/,         result: lastResult === 'T' ? 'X' : 'T', conf: 93, log: "Cầu khối 2-2" },
            { regex: /TTTXXX$|XXXTTT$/,     result: lastResult === 'T' ? 'X' : 'T', conf: 94, log: "Cầu đối xứng 3-3" },
            { regex: /TXXXX$|XTTTT$/,       result: lastResult === 'T' ? 'X' : 'T', conf: 93, log: "Cầu 1-4" },
            { regex: /T{4,}X|X{4,}T/,       result: lastResult === 'T' ? 'X' : 'T', conf: 90, log: "Bẻ bệt dài" },
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
            return {
                res: "CHỜ",
                conf: "0%",
                log: `Đang thu thập dữ liệu (${history.length}/45)...`,
                suggestion: "Vui lòng chờ thêm phiên",
                streak: "N/A"
            };
        }

        const results = history.map(h => h.result);
        const sequence = results.map(r => r === 'Tài' ? 'T' : 'X').join('');
        const lastResult = results[results.length - 1];

        if (state.stats.lossStreak >= 3) {
            return {
                res: "CHỜ",
                conf: "0%",
                log: "🚨 3 TAY THUA LIÊN TIẾP - ĐANG RESET NHỊP MỚI",
                suggestion: "Nghỉ 10-15 tay trước khi tiếp tục",
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

        if (streakAnalysis && streakAnalysis.isStrongBreak) {
            finalResult = streakAnalysis.result;
            finalConfidence = streakAnalysis.confidence;
            finalLog = streakAnalysis.log;
        } else if (patternResult) {
            finalResult = patternResult.result;
            finalConfidence = patternResult.conf;
            finalLog = patternResult.log;
        } else {
            finalResult = markov.probT > 0.515 ? 'T' : 'X';
            finalConfidence = 68 + Math.floor(markov.strength * 32);
            finalLog = `Markov Ensemble (${Math.round(markov.probT * 100)}% Tài)`;
        }

        if (entropy > VIP_CONFIG.ENTROPY_THRESHOLD) {
            finalConfidence = Math.max(60, finalConfidence - 12);
            finalLog += " [Bàn nhiễu cao]";
        }

        if (finalConfidence < VIP_CONFIG.MIN_CONFIDENCE) {
            return {
                res: "CHỜ",
                conf: "0%",
                log: `Cầu chưa đủ mạnh (${Math.floor(finalConfidence)}%)`,
                suggestion: "Bỏ qua lệnh này",
                streak: streakAnalysis ? streakAnalysis.streakInfo : "N/A"
            };
        }

        let displayConf = Math.max(VIP_CONFIG.CAP_MIN, Math.min(VIP_CONFIG.CAP_MAX, Math.floor(finalConfidence)));
        if (streakAnalysis && streakAnalysis.isStrongBreak) {
            displayConf = Math.min(VIP_CONFIG.CAP_MAX, displayConf + 3);
        }

        const resultText = finalResult === 'T' ? 'TÀI' : 'XỈU';

        let suggestion = "Cược nhẹ (20-30%)";
        if (displayConf >= 88) suggestion = "CƯỢC MẠNH (70-90%)";
        else if (displayConf >= 80) suggestion = "Cược vừa (45-65%)";

        return {
            res: resultText,
            conf: `${displayConf}%`,
            log: finalLog,
            suggestion: suggestion,
            streak: streakAnalysis ? streakAnalysis.streakInfo : "N/A",
            winrate: state.stats.total ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + '%' : "0%"
        };
    }
};

// ================== [4] ĐỒNG BỘ DỮ LIỆU ==================
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
                    id: Number(item.id || item.SessionId || 0),
                    result: (Number(item.DiceSum || 0) >= 11 ||
                        String(item.result || item.outcome || '').toUpperCase().includes('TAI') ||
                        String(item.result || '').includes('Tài')) ? 'Tài' : 'Xỉu'
                }))
                .filter(item => item.id > 0)
                .sort((a, b) => a.id - b.id);

            if (cleanData.length === 0) continue;

            const state = DATA_STORE[mode];
            const latest = cleanData[cleanData.length - 1];

            if (
                state.lastPrediction &&
                state.lastPrediction.id === latest.id &&
                state.lastProcessedId < latest.id
            ) {
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
            // Silent catch
        }
    }
}

// ================== [5] HÀM TẠO JSON CHUNG ==================
function buildJsonResponse() {
    const nohu = SniperCore.analyze('nohu');
    const md5 = SniperCore.analyze('md5');

    return {
        developer: VIP_CONFIG.NAME,
        version: VIP_CONFIG.VERSION,
        status: "ONLINE",
        timestamp: new Date().toISOString(),
        results: {
            nohu,
            md5
        }
    };
}

// ================== [6] ROUTE JSON ==================
app.get('/', (req, res) => {
    res.json(buildJsonResponse());
});

app.get('/api/v4.4/predict', (req, res) => {
    const output = {};

    ['nohu', 'md5'].forEach(mode => {
        const pred = SniperCore.analyze(mode);
        const lastId = DATA_STORE[mode].history.length
            ? DATA_STORE[mode].history[DATA_STORE[mode].history.length - 1].id
            : 0;

        DATA_STORE[mode].lastPrediction = {
            id: lastId,
            res: pred.res === "CHỜ" ? null : (pred.res === "TÀI" ? "Tài" : "Xỉu")
        };

        output[mode] = {
            ...pred,
            session: lastId + 1
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

// JSON xem trạng thái nhanh
app.get('/api/v4.4/status', (req, res) => {
    res.json({
        developer: VIP_CONFIG.NAME,
        version: VIP_CONFIG.VERSION,
        status: "ONLINE",
        timestamp: new Date().toISOString(),
        store: {
            nohu: {
                stats: DATA_STORE.nohu.stats,
                historyCount: DATA_STORE.nohu.history.length,
                lastProcessedId: DATA_STORE.nohu.lastProcessedId
            },
            md5: {
                stats: DATA_STORE.md5.stats,
                historyCount: DATA_STORE.md5.history.length,
                lastProcessedId: DATA_STORE.md5.lastProcessedId
            }
        }
    });
});

// ================== [7] KHỞI CHẠY SERVER ==================
app.listen(PORT, () => {
    console.log(`\n🚀 TUANX3000 ${VIP_CONFIG.VERSION} - JSON MODE đã khởi động`);
    console.log(`🌐 JSON Root: http://localhost:${PORT}/`);
    console.log(`📡 API JSON: http://localhost:${PORT}/api/v4.4/predict`);
    console.log(`📊 STATUS: http://localhost:${PORT}/api/v4.4/status\n`);
});

// Bắt đầu đồng bộ dữ liệu
setInterval(syncData, VIP_CONFIG.SYNC_INTERVAL);

console.log("TUANX3000 V4.4 JSON MODE - Ready");