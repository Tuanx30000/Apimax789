// server.js - PHIÊN BẢN V3.2.0
// Bản quyền: tuanx3000 - Tổng hợp dữ liệu Tài Xỉu từ 2 nguồn mới

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const seedrandom = require('seedrandom');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CẤU HÌNH ====================
const HISTORY_LIMIT = 200;
const FETCH_INTERVAL = 5000;
const FETCH_TIMEOUT = 10000;
const MAX_RETRY = 3;
const RETRY_DELAY = 1000;
const BACKUP_INTERVAL = 30000;
const BACKUP_FILE = 'backup.json';

// ==================== BRAND ====================
const BRAND = {
    name: 'tuanx3000',
    version: '3.2.0',
    author: 'tuanx3000',
    contact: 'https://t.me/tuanx3000'
};

// ==================== CORS ====================
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==================== RATE LIMIT ====================
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 100;

function simpleRateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const record = rateLimitStore.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + RATE_LIMIT_WINDOW;
    }
    record.count++;
    rateLimitStore.set(ip, record);
    if (record.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Quá tải, thử lại sau 60 giây' });
    }
    next();
}
app.use('/api/', simpleRateLimiter);

// ==================== DATA SOURCES MỚI ====================
const NOHU_URL = 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7';

const MD5_URL = 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7';

const SOURCES = {
    NOHU: { name: 'NOHU', url: NOHU_URL },
    MD5: { name: 'MD5', url: MD5_URL }
};

// ==================== DATA STORE ====================
const dataStore = {
    NOHU: { history: [], latest: null, lastUpdate: null, errorCount: 0 },
    MD5: { history: [], latest: null, lastUpdate: null, errorCount: 0 }
};
let aggregatedHistory = [];
let aggregatedLatest = null;
let lastAggregationTime = null;

// ==================== HELPER ====================
function createEmptyRecord(source = 'Tổng hợp') {
    return {
        Phien: null,
        Xuc_xac_1: null,
        Xuc_xac_2: null,
        Xuc_xac_3: null,
        Tong: null,
        Ket_qua: '',
        nguon: source,
        brand: BRAND.name,
        server_time: new Date().toISOString(),
        update_count: 0
    };
}

// ==================== FETCH VỚI RETRY ====================
async function fetchWithRetry(url, retries = MAX_RETRY) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        let timeoutHandle = null;
        try {
            const controller = new AbortController();
            timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json'
                }
            });
            clearTimeout(timeoutHandle);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            return json;
        } catch (error) {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
            } else {
                return null;
            }
        }
    }
    return null;
}

// ==================== CHUYỂN ĐỔI DỮ LIỆU (CẤU TRÚC MỚI) ====================
function convertToStandard(rawData, sourceName) {
    // Kiểm tra rawData có phải mảng không
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const validItems = [];
    const fetchTime = new Date().toISOString();

    for (const item of rawData) {
        try {
            // Lấy SessionId
            const sessionId = String(item.SessionId || '').trim();
            if (!sessionId) continue;

            // Lấy 3 mặt xúc xắc
            const d1 = parseInt(item.FirstDice, 10) || 0;
            const d2 = parseInt(item.SecondDice, 10) || 0;
            const d3 = parseInt(item.ThirdDice, 10) || 0;

            // Tổng điểm (DiceSum)
            const sum = parseInt(item.DiceSum, 10) || (d1 + d2 + d3);

            // BetSide: 0 = Tài, 1 = Xỉu
            const betSide = parseInt(item.BetSide, 10);
            let result = '';
            if (betSide === 0) result = 'Tài';
            else if (betSide === 1) result = 'Xỉu';
            else result = 'Không xác định';

            validItems.push({
                Phien: sessionId,
                Xuc_xac_1: d1,
                Xuc_xac_2: d2,
                Xuc_xac_3: d3,
                Tong: sum,
                Ket_qua: result,
                nguon: sourceName,
                server_time: fetchTime,
                created_date: item.CreatedDate || null
            });
        } catch (error) {
            // Bỏ qua item lỗi
        }
    }
    return validItems;
}

// ==================== LỌC TRÙNG LẶP ====================
function deduplicateByPhienAndSource(items) {
    const seen = new Map();
    const result = [];
    for (const item of items) {
        const key = `${item.Phien}#${item.nguon}`;
        if (!seen.has(key)) {
            result.push(item);
            seen.set(key, item);
        }
    }
    return result;
}

// ==================== CẬP NHẬT NGUỒN ====================
async function refreshSource(sourceKey) {
    const source = SOURCES[sourceKey];
    const store = dataStore[sourceKey];
    try {
        const raw = await fetchWithRetry(source.url);
        if (!raw) { store.errorCount++; return; }
        let converted = convertToStandard(raw, sourceKey);
        if (converted.length === 0) return;
        // Sắp xếp theo SessionId giảm dần
        converted.sort((a, b) => parseInt(b.Phien) - parseInt(a.Phien));
        const unique = deduplicateByPhienAndSource(converted);
        store.history = unique.slice(0, HISTORY_LIMIT);
        store.lastUpdate = new Date().toISOString();
        store.errorCount = 0;
        if (store.history.length > 0) {
            store.latest = { ...store.history[0], brand: BRAND.name, update_count: (store.latest?.update_count || 0) + 1 };
        }
    } catch (error) {
        store.errorCount++;
    }
}

// ==================== TỔNG HỢP DỮ LIỆU ====================
function updateAggregated() {
    const all = [...dataStore.NOHU.history, ...dataStore.MD5.history];
    if (all.length === 0) return;
    all.sort((a, b) => parseInt(b.Phien) - parseInt(a.Phien));
    const unique = deduplicateByPhienAndSource(all);
    aggregatedHistory = unique.slice(0, HISTORY_LIMIT);
    lastAggregationTime = new Date().toISOString();
    if (aggregatedHistory.length > 0) {
        aggregatedLatest = { ...aggregatedHistory[0], brand: BRAND.name, update_count: (aggregatedLatest?.update_count || 0) + 1 };
    }
}

// ==================== REFRESH ALL ====================
async function refreshAll() {
    try {
        await Promise.all([refreshSource('NOHU'), refreshSource('MD5')]);
        updateAggregated();
    } catch (e) { /* ignore */ }
}

// ==================== BACKUP & RESTORE ====================
const fs = require('fs').promises;
async function backup() {
    try {
        const data = { store: dataStore, aggregatedHistory, aggregatedLatest, lastAggregationTime };
        await fs.writeFile(BACKUP_FILE, JSON.stringify(data, null, 2));
    } catch (e) { /* ignore */ }
}
async function restore() {
    try {
        const content = await fs.readFile(BACKUP_FILE, 'utf8');
        const data = JSON.parse(content);
        Object.assign(dataStore, data.store);
        aggregatedHistory = data.aggregatedHistory || [];
        aggregatedLatest = data.aggregatedLatest || null;
        lastAggregationTime = data.lastAggregationTime || null;
    } catch (e) { /* không có backup */ }
}

// ==================== ENDPOINT DỰ ĐOÁN ====================
app.get('/api/predict', (req, res) => {
    const history = aggregatedHistory;
    if (history.length < 5) {
        return res.json({ error: 'Chưa đủ dữ liệu để dự đoán (cần ít nhất 5 phiên)' });
    }
    const recent = history.slice(0, 10);
    let taiCount = 0, xiuCount = 0;
    recent.forEach(item => {
        if (item.Ket_qua === 'Tài') taiCount++;
        else if (item.Ket_qua === 'Xỉu') xiuCount++;
    });
    const total = recent.length;
    const pTai = taiCount / total;
    const pXiu = xiuCount / total;
    const seed = crypto.createHash('sha256')
        .update(recent.map(i => i.Phien).join(','))
        .digest('hex')
        .slice(0, 10);
    const rng = seedrandom(seed);
    const rand = rng();
    let prediction = '';
    if (rand < pTai) prediction = 'Tài';
    else if (rand < pTai + pXiu) prediction = 'Xỉu';
    else prediction = 'Không xác định';
    res.json({
        brand: BRAND.name,
        prediction: prediction,
        probability: { Tai: pTai, Xiu: pXiu },
        based_on: recent.length,
        seed: seed
    });
});

// ==================== ENDPOINTS API ====================
app.get('/', (req, res) => {
    res.json({
        brand: BRAND.name,
        version: BRAND.version,
        description: 'API tổng hợp kết quả Tài Xỉu từ NOHU và MD5 (cấu trúc mới)',
        endpoints: {
            '/': 'Hướng dẫn này',
            '/health': 'Trạng thái server',
            '/api/latest': 'Phiên mới nhất tổng hợp',
            '/api/history?limit=N': 'Lịch sử tổng hợp (mặc định 50, tối đa 500)',
            '/api/source/:name?limit=N': 'Lịch sử riêng (NOHU hoặc MD5)',
            '/api/predict': 'Dự đoán kết quả dựa trên xu hướng'
        },
        examples: {
            latest: '/api/latest',
            history: '/api/history?limit=10',
            source: '/api/source/NOHU?limit=20',
            predict: '/api/predict'
        },
        note: 'Rate limit: 100 request/phút/IP. Dữ liệu cập nhật mỗi 5 giây.'
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        NOHU: {
            records: dataStore.NOHU.history.length,
            latest: dataStore.NOHU.latest?.Phien || null,
            errors: dataStore.NOHU.errorCount,
            lastUpdate: dataStore.NOHU.lastUpdate
        },
        MD5: {
            records: dataStore.MD5.history.length,
            latest: dataStore.MD5.latest?.Phien || null,
            errors: dataStore.MD5.errorCount,
            lastUpdate: dataStore.MD5.lastUpdate
        },
        aggregated: {
            total: aggregatedHistory.length,
            latest: aggregatedLatest?.Phien || null,
            lastAggregation: lastAggregationTime
        }
    });
});

app.get('/api/latest', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json(aggregatedLatest || createEmptyRecord('Tổng hợp'));
});

app.get('/api/history', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    res.setHeader('Cache-Control', 'no-cache');
    res.json({
        brand: BRAND.name,
        total: aggregatedHistory.length,
        limit: limit,
        data: aggregatedHistory.slice(0, limit)
    });
});

app.get('/api/source/:name', (req, res) => {
    const sourceName = req.params.name.toUpperCase();
    const store = dataStore[sourceName];
    if (!store) {
        return res.status(404).json({ error: 'Nguồn không tồn tại. Chỉ chấp nhận NOHU hoặc MD5' });
    }
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    res.setHeader('Cache-Control', 'no-cache');
    res.json({
        brand: BRAND.name,
        source: sourceName,
        total: store.history.length,
        limit: limit,
        data: store.history.slice(0, limit)
    });
});

// ==================== KHỞI CHẠY SERVER ====================
(async function start() {
    await restore();
    await refreshAll();
    setInterval(refreshAll, FETCH_INTERVAL);
    setInterval(backup, BACKUP_INTERVAL);
    process.on('SIGINT', () => { backup().finally(() => process.exit(0)); });
    process.on('SIGTERM', () => { backup().finally(() => process.exit(0)); });
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n[tuanx3000] ✅ Server chạy tại cổng ${PORT}`);
        console.log(`[tuanx3000] Hướng dẫn: http://localhost:${PORT}/\n`);
    });
})();