/**
 * =========================================================================================
 * 🛠️ TUANX3000 ULTIMATE V5 - JSON CLEAN FULL
 * ✅ Sửa lệch phiên dự đoán
 * ✅ Chống trùng pending
 * ✅ Chấm kết quả đúng session
 * ✅ JSON trả về gọn: phiên dự đoán + tỉ lệ Tài/Xỉu
 * ✅ Ẩn phần nội bộ không cần thiết
 * =========================================================================================
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

let fetchFn = global.fetch;
if (!fetchFn) {
    fetchFn = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
}

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

app.use(rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT || 100),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            ok: false,
            error: 'Too many requests',
            status: 429
        });
    }
}));

// ================== [1] CẤU HÌNH ==================
const CONFIG = {
    NAME: 'Tuanx3000',
    VERSION: 'V5',
    MIN_CONFIDENCE: 71,
    CAP_MIN: 63,
    CAP_MAX: 94,
    MAX_HISTORY: 200,
    STREAK_WINDOW: 130,
    SYNC_INTERVAL: 2300,
    CLEAN_INTERVAL: 3600000,
    ENTROPY_THRESHOLD: 0.92,
    RETRY_FETCH_LIMIT: 2,
    FETCH_TIMEOUT_MS: 12000,
    MAX_PENDING_AGE_MS: 30 * 60 * 1000
};

const SOURCE_URLS = {
    nohu: process.env.NOHU_URL || '',
    md5: process.env.MD5_URL || ''
};

// ================== [2] BỘ NHỚ ==================
function createState() {
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
        pendingPredictions: {} // key = sessionId
    };
}

const DATA_STORE = {
    nohu: createState(),
    md5: createState()
};

// Reset stats mỗi giờ
setInterval(() => {
    for (const mode of ['nohu', 'md5']) {
        DATA_STORE[mode].stats = {
            win: 0,
            loss: 0,
            total: 0,
            lossStreak: 0,
            winStreak: 0,
            maxWinStreak: 0
        };
        DATA_STORE[mode].lastProcessedId = 0;
    }
    console.log('[SYSTEM] Reset statistics done');
}, CONFIG.CLEAN_INTERVAL);

// ================== [3] CORE PHÂN TÍCH ==================
const SniperCore = {
    normalizeResult(value) {
        const s = String(value || '').trim().toLowerCase();
        if (
            s.includes('tài') ||
            s.includes('tai') ||
            s === 't' ||
            s.includes('high')
        ) return 'Tài';
        return 'Xỉu';
    },

    calculateMarkov(sequence) {
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

        const tail = sequence.slice(-30);
        const biasT = (tail.match(/T/g) || []).length / Math.max(1, tail.length);
        probT = (probT * 0.65) + (biasT * 0.35);

        const strength = Math.abs(probT - 0.5) * 2;

        return {
            probT: Math.max(0.12, Math.min(0.88, probT)),
            strength: Math.min(1, strength)
        };
    },

    calculateEntropy(sequence) {
        const sample = sequence.slice(-40);
        if (!sample.length) return 1.0;

        const countT = (sample.match(/T/g) || []).length;
        const p = Math.max(0.01, Math.min(0.99, countT / sample.length));
        return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
    },

    analyzeDynamicStreak(sequence) {
        const chunks = sequence.match(/(.)\1*/g) || [];
        if (!chunks.length) return null;

        const currentChunk = chunks[chunks.length - 1];
        const currStreak = currentChunk.length;
        const currType = currentChunk[0];

        if (currStreak < 3) return null;

        const windowSeq = sequence.slice(-CONFIG.STREAK_WINDOW);
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
            streakInfo: `${currType}${currStreak}`,
            isStrongBreak: isBreak && currStreak >= 5
        };
    },

    patternMatcher(sequence, lastResult) {
        const patterns = [
            { regex: /TXTX$|XTXT$|TXTTXT$/, result: lastResult === 'T' ? 'X' : 'T', conf: 91 },
            { regex: /TXXTXX$|XTTXTT$/,     result: lastResult === 'T' ? 'T' : 'X', conf: 90 },
            { regex: /TXX$|XTT$/,           result: lastResult === 'T' ? 'X' : 'T', conf: 85 },
            { regex: /TXXX$|XTTT$/,         result: lastResult === 'T' ? 'X' : 'T', conf: 92 },
            { regex: /TTXX$|XXTT$/,         result: lastResult === 'T' ? 'X' : 'T', conf: 93 },
            { regex: /TTTXXX$|XXXTTT$/,     result: lastResult === 'T' ? 'X' : 'T', conf: 94 },
            { regex: /TXXXX$|XTTTT$/,       result: lastResult === 'T' ? 'X' : 'T', conf: 93 },
            { regex: /T{4,}X|X{4,}T/,       result: lastResult === 'T' ? 'X' : 'T', conf: 90 }
        ];

        for (const p of patterns) {
            if (p.regex.test(sequence)) return p;
        }
        return null;
    },

    analyze(mode) {
        const state = DATA_STORE[mode];
        const history = state.history.slice(-CONFIG.MAX_HISTORY);

        if (history.length < 45) {
            return {
                res: 'CHỜ',
                conf: '0%',
                rawConfidence: 0,
                txRate: { tai: 50, xiu: 50 },
                streak: 'N/A',
                suggestion: 'Vui lòng chờ thêm phiên',
                diagnostics: {
                    reason: 'INSUFFICIENT_HISTORY',
                    historyCount: history.length
                }
            };
        }

        const results = history.map(h => h.result);
        const sequence = results.map(r => r === 'Tài' ? 'T' : 'X').join('');
        const lastResult = results[results.length - 1];

        if (state.stats.lossStreak >= 3) {
            return {
                res: 'CHỜ',
                conf: '0%',
                rawConfidence: 0,
                txRate: { tai: 50, xiu: 50 },
                streak: 'Reset',
                suggestion: 'Nghỉ thêm vài tay trước khi vào lại',
                diagnostics: {
                    reason: 'LOSS_STREAK_KILL_SWITCH',
                    lossStreak: state.stats.lossStreak
                }
            };
        }

        const entropy = SniperCore.calculateEntropy(sequence);
        const streakAnalysis = SniperCore.analyzeDynamicStreak(sequence);
        const patternResult = SniperCore.patternMatcher(sequence, lastResult);
        const markov = SniperCore.calculateMarkov(sequence);

        let finalResult = '';
        let finalConfidence = 68;
        let finalSource = 'MARKOV';

        if (streakAnalysis && streakAnalysis.isStrongBreak) {
            finalResult = streakAnalysis.result;
            finalConfidence = streakAnalysis.confidence;
            finalSource = 'STREAK_BREAK';
        } else if (patternResult) {
            finalResult = patternResult.result;
            finalConfidence = patternResult.conf;
            finalSource = 'PATTERN';
        } else {
            finalResult = markov.probT > 0.515 ? 'T' : 'X';
            finalConfidence = 68 + Math.floor(markov.strength * 32);
            finalSource = 'MARKOV';
        }

        const entropyPenalty = entropy > CONFIG.ENTROPY_THRESHOLD ? 12 : 0;
        if (entropyPenalty) {
            finalConfidence = Math.max(60, finalConfidence - entropyPenalty);
        }

        if (finalConfidence < CONFIG.MIN_CONFIDENCE) {
            const tai = Math.round(markov.probT * 100);
            const xiu = Math.max(0, 100 - tai);

            return {
                res: 'CHỜ',
                conf: '0%',
                rawConfidence: Math.floor(finalConfidence),
                txRate: { tai, xiu },
                streak: streakAnalysis ? streakAnalysis.streakInfo : 'N/A',
                suggestion: 'Bỏ qua lệnh này',
                diagnostics: {
                    reason: 'LOW_CONFIDENCE',
                    source: finalSource,
                    entropy: Number(entropy.toFixed(4)),
                    markov: {
                        probT: Number(markov.probT.toFixed(4)),
                        strength: Number(markov.strength.toFixed(4))
                    }
                }
            };
        }

        let displayConf = Math.max(
            CONFIG.CAP_MIN,
            Math.min(CONFIG.CAP_MAX, Math.floor(finalConfidence))
        );

        if (streakAnalysis && streakAnalysis.isStrongBreak) {
            displayConf = Math.min(CONFIG.CAP_MAX, displayConf + 3);
        }

        const resultText = finalResult === 'T' ? 'TÀI' : 'XỈU';

        let suggestion = 'Cược nhẹ';
        if (displayConf >= 88) suggestion = 'Cược mạnh';
        else if (displayConf >= 80) suggestion = 'Cược vừa';

        const taiRate = resultText === 'TÀI' ? displayConf : 100 - displayConf;
        const xiuRate = 100 - taiRate;

        return {
            res: resultText,
            conf: `${displayConf}%`,
            rawConfidence: Math.floor(finalConfidence),
            txRate: {
                tai: Math.max(0, Math.min(100, taiRate)),
                xiu: Math.max(0, Math.min(100, xiuRate))
            },
            streak: streakAnalysis ? streakAnalysis.streakInfo : 'N/A',
            suggestion,
            diagnostics: {
                source: finalSource,
                entropy: Number(entropy.toFixed(4)),
                entropyPenalty,
                markov: {
                    probT: Number(markov.probT.toFixed(4)),
                    strength: Number(markov.strength.toFixed(4))
                },
                patternHit: patternResult ? true : false,
                strongBreak: streakAnalysis ? !!streakAnalysis.isStrongBreak : false
            }
        };
    }
};

// ================== [4] TIỆN ÍCH ==================
function safeNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function parseIncomingData(json) {
    const raw = Array.isArray(json) ? json : (json?.list || json?.data || []);
    return raw
        .map(item => {
            const id = safeNum(item.id || item.SessionId || item.sessionId || item.roundId || 0);
            if (id <= 0) return null;

            const diceSum = safeNum(item.DiceSum || item.diceSum || item.sum || 0);
            const text = String(item.result || item.outcome || item.type || '').toLowerCase();

            const result = (diceSum >= 11 || text.includes('tai') || text.includes('tài'))
                ? 'Tài'
                : 'Xỉu';

            return { id, result };
        })
        .filter(Boolean)
        .sort((a, b) => a.id - b.id);
}

function getLastHistoryId(mode) {
    const hist = DATA_STORE[mode].history;
    return hist.length ? hist[hist.length - 1].id : 0;
}

function pushPendingPrediction(mode, sessionId, res) {
    const state = DATA_STORE[mode];
    const key = String(sessionId);

    if (!state.pendingPredictions[key]) {
        state.pendingPredictions[key] = {
            sessionId,
            res,
            createdAt: Date.now(),
            scored: false
        };
    }
}

function prunePendingPredictions(mode) {
    const state = DATA_STORE[mode];
    const now = Date.now();

    for (const key of Object.keys(state.pendingPredictions)) {
        const p = state.pendingPredictions[key];
        if (!p) {
            delete state.pendingPredictions[key];
            continue;
        }
        if (now - p.createdAt > CONFIG.MAX_PENDING_AGE_MS) {
            delete state.pendingPredictions[key];
        }
    }
}

function scorePendingPredictions(mode, cleanData) {
    const state = DATA_STORE[mode];

    for (const key of Object.keys(state.pendingPredictions)) {
        const pending = state.pendingPredictions[key];
        if (!pending || pending.scored) continue;

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

        delete state.pendingPredictions[key];
    }
}

async function fetchJsonWithRetry(url, retries = CONFIG.RETRY_FETCH_LIMIT) {
    let lastError = null;

    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

            const response = await fetchFn(url, {
                method: 'GET',
                headers: { accept: 'application/json' },
                signal: controller.signal
            });

            clearTimeout(timer);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            lastError = err;
            console.error(`[fetchJsonWithRetry] attempt=${i + 1} url=${url} error=${err.message}`);
            if (i < retries) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }

    throw lastError || new Error('Fetch failed');
}

// ================== [5] ĐỒNG BỘ ==================
async function syncData() {
    for (const mode of ['nohu', 'md5']) {
        const url = SOURCE_URLS[mode];

        if (!url) {
            DATA_STORE[mode].lastSyncError = 'Missing source URL';
            continue;
        }

        try {
            const json = await fetchJsonWithRetry(url);
            const cleanData = parseIncomingData(json);

            if (!cleanData.length) {
                DATA_STORE[mode].lastSyncError = 'No valid data';
                console.error(`[syncData] mode=${mode} error=No valid data`);
                continue;
            }

            DATA_STORE[mode].history = cleanData;
            DATA_STORE[mode].lastSyncAt = new Date().toISOString();
            DATA_STORE[mode].lastSyncError = null;

            prunePendingPredictions(mode);
            scorePendingPredictions(mode, cleanData);
        } catch (error) {
            DATA_STORE[mode].lastSyncError = error?.message || String(error);
            console.error(`[syncData] mode=${mode} error=${DATA_STORE[mode].lastSyncError}`);
        }
    }
}

// ================== [6] RESPONSE GỌN ==================
function buildModePayload(mode) {
    const state = DATA_STORE[mode];
    const prediction = SniperCore.analyze(mode);
    const lastResultSession = getLastHistoryId(mode);
    const predictedSessionId = lastResultSession + 1;

    const predictedResult = prediction.res === 'CHỜ' ? 'CHỜ' : prediction.res;

    if (predictedResult !== 'CHỜ') {
        pushPendingPrediction(
            mode,
            predictedSessionId,
            predictedResult === 'TÀI' ? 'Tài' : 'Xỉu'
        );
    }

    return {
        mode,
        predictedSessionId,
        predictedFor: predictedSessionId,
        lastResultSession,
        predictedResult,
        txRate: prediction.txRate || { tai: 50, xiu: 50 },
        confidence: prediction.conf,
        rawConfidence: prediction.rawConfidence ?? 0,
        streak: prediction.streak || 'N/A',
        suggestion: prediction.suggestion || 'N/A',
        historyCount: state.history.length,
        pendingCount: Object.keys(state.pendingPredictions).length,
        lastSyncAt: state.lastSyncAt,
        lastSyncError: state.lastSyncError || null
    };
}

function buildResponse() {
    return {
        developer: CONFIG.NAME,
        version: CONFIG.VERSION,
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
        results: {
            nohu: buildModePayload('nohu'),
            md5: buildModePayload('md5')
        }
    };
}

// ================== [7] ROUTES ==================
app.get('/', (req, res) => {
    res.json(buildResponse());
});

app.get('/api/v5/predict', (req, res) => {
    res.json(buildResponse());
});

app.get('/api/v5/status', (req, res) => {
    res.json({
        developer: CONFIG.NAME,
        version: CONFIG.VERSION,
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage()
        },
        results: {
            nohu: {
                stats: DATA_STORE.nohu.stats,
                historyCount: DATA_STORE.nohu.history.length,
                pendingCount: Object.keys(DATA_STORE.nohu.pendingPredictions).length,
                lastProcessedId: DATA_STORE.nohu.lastProcessedId,
                lastSyncAt: DATA_STORE.nohu.lastSyncAt,
                lastSyncError: DATA_STORE.nohu.lastSyncError
            },
            md5: {
                stats: DATA_STORE.md5.stats,
                historyCount: DATA_STORE.md5.history.length,
                pendingCount: Object.keys(DATA_STORE.md5.pendingPredictions).length,
                lastProcessedId: DATA_STORE.md5.lastProcessedId,
                lastSyncAt: DATA_STORE.md5.lastSyncAt,
                lastSyncError: DATA_STORE.md5.lastSyncError
            }
        }
    });
});

app.get('/api/v5/history/:mode', (req, res) => {
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
        history: DATA_STORE[mode].history
    });
});

// ================== [8] GLOBAL ERRORS ==================
process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
});

process.on('unhandledRejection', (err) => {
    console.error('[unhandledRejection]', err);
});

// ================== [9] START ==================
app.listen(PORT, () => {
    console.log(`TUANX3000 ${CONFIG.VERSION} started`);
    console.log(`Root: http://localhost:${PORT}/`);
    console.log(`API:  http://localhost:${PORT}/api/v5/predict`);
    console.log(`STAT: http://localhost:${PORT}/api/v5/status`);
});

setInterval(syncData, CONFIG.SYNC_INTERVAL);
syncData();