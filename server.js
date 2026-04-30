/**
 * =========================================================================================
 * 🛠️ TUANX3000 ULTIMATE V4.5 - SNIPER ENGINE (JSON FULL)
 * 📱 Xuất JSON đầy đủ cho Tool / AShell / iPhone / App / API
 * ✅ Sửa lỗi session, thêm diagnostics, pending queue, status đầy đủ
 * =========================================================================================
 */

const express = require('express');
const cors = require('cors');

let fetchFn = global.fetch;
if (!fetchFn) {
    fetchFn = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
}

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ================== [1] CẤU HÌNH CHÍNH ==================
const VIP_CONFIG = {
    NAME: "Tuanx3000",
    VERSION: "V4.5-JSON-FULL",
    MIN_CONFIDENCE: 71,
    CAP_MIN: 63,
    CAP_MAX: 94,
    MAX_HISTORY: 200,
    STREAK_WINDOW: 130,
    SYNC_INTERVAL: 2300,
    CLEAN_INTERVAL: 3600000,
    ENTROPY_THRESHOLD: 0.92,
    MAX_PENDING_PREDICTIONS: 50,
    RETRY_FETCH_LIMIT: 2
};

// ================== [2] LINK API ==================
const SOURCE_URLS = {
    nohu: process.env.NOHU_URL || 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=YOUR_TOKEN_HERE',
    md5: process.env.MD5_URL || 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=YOUR_TOKEN_HERE'
};

// ================== [3] BỘ NHỚ DỮ LIỆU ==================
function createModeState() {
    return {
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
        lastSyncAt: null,
        lastSyncError: null,
        pendingPredictions: []
    };
}

const DATA_STORE = {
    nohu: createModeState(),
    md5: createModeState()
};

// Reset thống kê mỗi giờ
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
        DATA_STORE[mode].pendingPredictions = [];
    });
    console.log(`🔄 [SYSTEM] Đã reset thống kê tự động`);
}, VIP_CONFIG.CLEAN_INTERVAL);

// ================== [4] CORE PHÂN TÍCH ==================
const SniperCore = {
    normalizeResult: (value) => {
        const s = String(value || '').trim().toLowerCase();
        if (s.includes('tài') || s.includes('tai') || s.includes('t')) return 'Tài';
        return 'Xỉu';
    },

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
            if (trans[pair] && (next === 'T' || next === 'X')) {
                trans[pair][next]++;
            }
        }

        const lastPair = sequence.slice(-2);
        const current = trans[lastPair] || { T: 2, X: 2 };
        const total = current.T + current.X + 2;

        let probT = (current.T + 1) / total;

        const biasT = (sequence.slice(-30).match(/T/g) || []).length / Math.max(1, Math.min(30, sequence.slice(-30).length));
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
            { regex: /T{4,}X|X{4,}T/,       result: lastResult === 'T' ? 'X' : 'T', conf: 90, log: "Bẻ bệt dài" }
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
                rawConfidence: 0,
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
                rawConfidence: 0,
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
                rawConfidence: Math.floor(finalConfidence),
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
            rawConfidence: Math.floor(finalConfidence),
            log: finalLog,
            suggestion: suggestion,
            streak: streakAnalysis ? streakAnalysis.streakInfo : "N/A",
            winrate: state.stats.total ? ((state.stats.win / state.stats.total) * 100).toFixed(1) + '%' : "0%"
        };
    }
};

// ================== [5] HÀM TIỆN ÍCH ==================
function safeNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function parseIncomingData(json) {
    const raw = Array.isArray(json) ? json : (json?.list || json?.data || []);
    return raw
        .map(item => {
            const id = safeNum(item.id || item.SessionId || item.sessionId || item.roundId || 0);
            const diceSum = safeNum(item.DiceSum || item.diceSum || item.sum || 0);
            const resultText = String(item.result || item.outcome || item.type || '').toLowerCase();

            const result = (
                diceSum >= 11 ||
                resultText.includes('tai') ||
                resultText.includes('tài') ||
                resultText === 't'
            ) ? 'Tài' : 'Xỉu';

            return { id, result };
        })
        .filter(item => item.id > 0)
        .sort((a, b) => a.id - b.id);
}

function getLastHistoryId(mode) {
    const hist = DATA_STORE[mode].history;
    return hist.length ? hist[hist.length - 1].id : 0;
}

function pushPendingPrediction(mode, sessionId, res) {
    const state = DATA_STORE[mode];
    state.pendingPredictions.push({
        sessionId,
        res,
        createdAt: Date.now(),
        scored: false,
        scoreResult: null
    });

    if (state.pendingPredictions.length > VIP_CONFIG.MAX_PENDING_PREDICTIONS) {
        state.pendingPredictions = state.pendingPredictions.slice(-VIP_CONFIG.MAX_PENDING_PREDICTIONS);
    }
}

function scorePendingPredictions(mode, cleanData) {
    const state = DATA_STORE[mode];

    for (const pending of state.pendingPredictions) {
        if (pending.scored) continue;

        const target = cleanData.find(x => x.id === pending.sessionId);
        if (!target) continue;

        const isWin = pending.res === target.result;
        pending.scored = true;
        pending.scoreResult = {
            actual: target.result,
            win: isWin
        };

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
        state.lastProcessedId = Math.max(state.lastProcessedId, target.id);
    }

    state.pendingPredictions = state.pendingPredictions.filter(p => !p.scored);
}

async function fetchJsonWithRetry(url, retries = VIP_CONFIG.RETRY_FETCH_LIMIT) {
    let lastError = null;

    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetchFn(url, {
                method: 'GET',
                headers: {
                    'accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error('Fetch failed');
}

// ================== [6] ĐỒNG BỘ DỮ LIỆU ==================
async function syncData() {
    for (const mode of ['nohu', 'md5']) {
        try {
            const json = await fetchJsonWithRetry(SOURCE_URLS[mode]);
            const cleanData = parseIncomingData(json);

            if (cleanData.length === 0) {
                DATA_STORE[mode].lastSyncError = 'No data returned';
                continue;
            }

            DATA_STORE[mode].history = cleanData;
            DATA_STORE[mode].lastSyncAt = new Date().toISOString();
            DATA_STORE[mode].lastSyncError = null;

            scorePendingPredictions(mode, cleanData);
        } catch (error) {
            DATA_STORE[mode].lastSyncError = error?.message || String(error);
        }
    }
}

// ================== [7] BUILD JSON RESPONSE ==================
function buildModePayload(mode) {
    const state = DATA_STORE[mode];
    const pred = SniperCore.analyze(mode);
    const lastId = getLastHistoryId(mode);
    const sessionId = lastId + 1;

    return {
        mode,
        currentSession: sessionId,
        lastResultSession: lastId,
        prediction: pred,
        stats: state.stats,
        historyCount: state.history.length,
        pendingCount: state.pendingPredictions.length,
        lastSyncAt: state.lastSyncAt,
        lastSyncError: state.lastSyncError
    };
}

function buildFullResponse() {
    return {
        developer: VIP_CONFIG.NAME,
        version: VIP_CONFIG.VERSION,
        status: "ONLINE",
        timestamp: new Date().toISOString(),
        config: {
            minConfidence: VIP_CONFIG.MIN_CONFIDENCE,
            capMin: VIP_CONFIG.CAP_MIN,
            capMax: VIP_CONFIG.CAP_MAX,
            maxHistory: VIP_CONFIG.MAX_HISTORY,
            streakWindow: VIP_CONFIG.STREAK_WINDOW,
            entropyThreshold: VIP_CONFIG.ENTROPY_THRESHOLD
        },
        results: {
            nohu: buildModePayload('nohu'),
            md5: buildModePayload('md5')
        }
    };
}

// ================== [8] ROUTES JSON ==================
app.get('/', (req, res) => {
    res.json(buildFullResponse());
});

app.get('/api/v4.5/predict', (req, res) => {
    const output = {};

    ['nohu', 'md5'].forEach(mode => {
        const pred = SniperCore.analyze(mode);
        const lastId = getLastHistoryId(mode);
        const sessionId = lastId + 1;
        const normalizedRes =
            pred.res === "CHỜ" ? null :
            (pred.res === "TÀI" ? "Tài" : "Xỉu");

        if (normalizedRes) {
            pushPendingPrediction(mode, sessionId, normalizedRes);
        }

        output[mode] = {
            ...pred,
            sessionId,
            predictedFor: sessionId,
            historySession: lastId
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

app.get('/api/v4.5/status', (req, res) => {
    res.json({
        developer: VIP_CONFIG.NAME,
        version: VIP_CONFIG.VERSION,
        status: "ONLINE",
        timestamp: new Date().toISOString(),
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage()
        },
        store: {
            nohu: {
                stats: DATA_STORE.nohu.stats,
                historyCount: DATA_STORE.nohu.history.length,
                pendingCount: DATA_STORE.nohu.pendingPredictions.length,
                lastProcessedId: DATA_STORE.nohu.lastProcessedId,
                lastSyncAt: DATA_STORE.nohu.lastSyncAt,
                lastSyncError: DATA_STORE.nohu.lastSyncError
            },
            md5: {
                stats: DATA_STORE.md5.stats,
                historyCount: DATA_STORE.md5.history.length,
                pendingCount: DATA_STORE.md5.pendingPredictions.length,
                lastProcessedId: DATA_STORE.md5.lastProcessedId,
                lastSyncAt: DATA_STORE.md5.lastSyncAt,
                lastSyncError: DATA_STORE.md5.lastSyncError
            }
        }
    });
});

app.get('/api/v4.5/history/:mode', (req, res) => {
    const mode = req.params.mode;
    if (!DATA_STORE[mode]) {
        return res.status(400).json({
            ok: false,
            error: 'Invalid mode',
            allowed: ['nohu', 'md5']
        });
    }

    res.json({
        ok: true,
        mode,
        count: DATA_STORE[mode].history.length,
        history: DATA_STORE[mode].history,
        pendingPredictions: DATA_STORE[mode].pendingPredictions
    });
});

app.get('/api/v4.5/raw/:mode', (req, res) => {
    const mode = req.params.mode;
    if (!DATA_STORE[mode]) {
        return res.status(400).json({
            ok: false,
            error: 'Invalid mode',
            allowed: ['nohu', 'md5']
        });
    }

    const payload = buildModePayload(mode);
    res.json({
        ok: true,
        mode,
        ...payload
    });
});

// ================== [9] KHỞI ĐỘNG SERVER ==================
app.listen(PORT, () => {
    console.log(`\n🚀 TUANX3000 ${VIP_CONFIG.VERSION} - JSON FULL đã khởi động`);
    console.log(`🌐 Root JSON: http://localhost:${PORT}/`);
    console.log(`📡 Predict:   http://localhost:${PORT}/api/v4.5/predict`);
    console.log(`📊 Status:    http://localhost:${PORT}/api/v4.5/status`);
    console.log(`🗂️ History:   http://localhost:${PORT}/api/v4.5/history/nohu`);
    console.log(`\n⚠️ Hãy thay NOHU_URL / MD5_URL bằng link thật qua biến môi trường.\n`);
});

// Bắt đầu đồng bộ dữ liệu
setInterval(syncData, VIP_CONFIG.SYNC_INTERVAL);

// Sync lần đầu
syncData();

console.log("TUANX3000 V4.5 JSON FULL - Ready");