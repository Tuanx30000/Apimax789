/**
 * =========================================================================================
 * 🚀 TUANX3000 ULTIMATE V2.1 - ALGORITHM ONLY (NÂNG CẤP)
 * Phiên bản thuần thuật toán - Đã dò soát & tối ưu
 * =========================================================================================
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ================== ⚙️ CẤU HÌNH ==================
const CONFIG = {
    ADMIN: "TUANX3000",
    VERSION: "2.1",
    SYNC_INTERVAL: 3000,           // ms
    ENDPOINTS: {
        NOHU: process.env.NOHU_API || 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
        MD5:  process.env.MD5_API  || 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
    }
};

// ================== KHO DỮ LIỆU ==================
const DATA_STORE = {
    nohu: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() },
    md5:  { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() }
};

// ================== 🛠️ UTILS ==================
const Utils = {
    standardizeResult: (item) => {
        const raw = String(item.resultTruyenThong || item.result || item.BetSide || '').toUpperCase().trim();
        if (raw.includes('TAI') || raw.includes('TÀI') || (item.DiceSum && Number(item.DiceSum) >= 11)) {
            return 'Tài';
        }
        return 'Xỉu';
    },

    calculateWinRate: (stats) => {
        return stats.total === 0 ? '0%' : ((stats.win / stats.total) * 100).toFixed(1) + '%';
    }
};

// ================== 🔬 THUẬT TOÁN NÂNG CẤP V2.1 ==================
const Algos = {
    predict: (mode) => {
        const history = DATA_STORE[mode].history;
        if (history.length < 8) {
            return { res: 'TÀI', conf: '58%', log: 'Đang thu thập dữ liệu...' };
        }

        const results = history.map(h => h.result);
        const lastResult = results[results.length - 1];
        const total = results.length;

        // 1. Streak hiện tại
        let streak = 1;
        for (let i = results.length - 2; i >= 0; i--) {
            if (results[i] === lastResult) streak++;
            else break;
        }

        // 2. Tần suất Tài
        const countTai = results.filter(r => r === 'Tài').length;
        const taiRatio = countTai / total;

        // 3. Transition probabilities (xác suất chuyển tiếp)
        let tAfterT = 0, xAfterT = 0, tAfterX = 0, xAfterX = 0;
        for (let i = 1; i < results.length; i++) {
            if (results[i-1] === 'Tài') {
                results[i] === 'Tài' ? tAfterT++ : xAfterT++;
            } else {
                results[i] === 'Tài' ? tAfterX++ : xAfterX++;
            }
        }

        const pTaiAfterTai = (tAfterT / (tAfterT + xAfterT)) || 0.5;
        const pTaiAfterXiu = (tAfterX / (tAfterX + xAfterX)) || 0.5;

        // ================== QUYẾT ĐỊNH ==================
        let res = 'Tài';
        let conf = 65;
        let log = '';

        if (streak >= 4) {
            res = lastResult === 'Tài' ? 'Xỉu' : 'Tài';
            conf = 87;
            log = `Streak ${streak} ${lastResult} → Ngắt chuỗi`;
        } 
        else if (taiRatio >= 0.67) {
            res = 'Xỉu';
            conf = 84;
            log = `Tài chiếm ${(taiRatio * 100).toFixed(0)}% → Reset cân bằng`;
        } 
        else if (taiRatio <= 0.37) {
            res = 'Tài';
            conf = 82;
            log = `Xỉu chiếm ${((1 - taiRatio) * 100).toFixed(0)}% → Reset cân bằng`;
        } 
        else if (lastResult === 'Tài') {
            res = pTaiAfterTai > 0.52 ? 'Tài' : 'Xỉu';
            conf = pTaiAfterTai > 0.52 ? 76 : 70;
            log = `Sau Tài → Tài: ${(pTaiAfterTai * 100).toFixed(0)}%`;
        } 
        else {
            res = pTaiAfterXiu > 0.49 ? 'Tài' : 'Xỉu';
            conf = pTaiAfterXiu > 0.49 ? 73 : 68;
            log = `Sau Xỉu → Tài: ${(pTaiAfterXiu * 100).toFixed(0)}%`;
        }

        return { res, conf: `${conf}%`, log };
    }
};

// ================== 🔄 SYNC ENGINE (An toàn hơn) ==================
async function syncData() {
    console.log(`[${new Date().toLocaleTimeString('vi-VN')}] Đang đồng bộ dữ liệu...`);

    for (const mode of ['nohu', 'md5']) {
        try {
            const res = await fetch(CONFIG.ENDPOINTS[mode.toUpperCase()], { timeout: 8000 });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = await res.json();
            const rawList = Array.isArray(json) ? json : (json.list || json.data || []);

            const cleanList = rawList
                .map(item => ({
                    session: Number(item.id || item.SessionId || 0),
                    result: Utils.standardizeResult(item)
                }))
                .filter(item => item.session > 0)
                .sort((a, b) => a.session - b.session);

            if (cleanList.length === 0) continue;

            const state = DATA_STORE[mode];
            const latest = cleanList[cleanList.length - 1];

            // Tính win/loss
            if (state.lastPrediction && 
                state.lastPrediction.session === latest.session && 
                !state.processedSessions.has(latest.session)) {

                const correct = state.lastPrediction.res === latest.result;
                if (correct) state.stats.win++;
                else state.stats.loss++;

                state.stats.total++;
                state.processedSessions.add(latest.session);
            }

            state.history = cleanList;

            if (state.processedSessions.size > 200) state.processedSessions.clear();

            console.log(`✅ ${mode.toUpperCase()} synced: ${cleanList.length} sessions`);

        } catch (err) {
            console.error(`❌ Sync lỗi ${mode.toUpperCase()}:`, err.message);
        }
    }
}

// ================== 🖥️ DASHBOARD ==================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TUANX3000 ULTIMATE V2.1</title>
            <style>
                :root { --neon: #00ff41; --bg: #0a0a0a; }
                body { background: var(--bg); color: var(--neon); font-family: system-ui, sans-serif; margin:0; padding:20px; }
                .container { max-width: 540px; margin: 40px auto; background:#111; border:2px solid var(--neon); border-radius:20px; padding:35px; text-align:center; box-shadow:0 0 50px rgba(0,255,65,0.2); }
                h1 { margin:0 0 10px 0; }
                .btn { display:block; margin:18px 0; padding:18px; background:transparent; border:2px solid var(--neon); color:var(--neon); font-weight:bold; border-radius:12px; text-decoration:none; transition:0.3s; }
                .btn:hover { background:var(--neon); color:#000; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>TUANX3000</h1>
                <p>ULTIMATE V2.1 • THUẬT TOÁN NÂNG CẤP</p>
                <a href="/api/prediction" class="btn">📊 XEM DỰ ĐOÁN NOHU & MD5</a>
                <a href="/api/status" class="btn">📈 TRẠNG THÁI SERVER</a>
                <a href="/api/history" class="btn">📜 XEM LỊCH SỬ</a>
            </div>
        </body>
        </html>
    `);
});

// ================== ⚡ API ROUTES ==================
app.get('/api/prediction', (req, res) => {
    const results = {};

    for (const mode of ['nohu', 'md5']) {
        const state = DATA_STORE[mode];
        const lastSession = state.history.length ? state.history[state.history.length-1].session : 0;

        const pred = Algos.predict(mode);

        state.lastPrediction = { session: lastSession + 1, res: pred.res };

        results[mode.toUpperCase()] = {
            current_session: lastSession,
            next_session: lastSession + 1,
            predict: pred.res,
            confidence: pred.conf,
            analysis: pred.log,
            accuracy: {
                win: state.stats.win,
                loss: state.stats.loss,
                rate: Utils.calculateWinRate(state.stats)
            }
        };
    }

    res.json({
        author: CONFIG.ADMIN,
        version: CONFIG.VERSION,
        server_time: new Date().toLocaleString('vi-VN'),
        results
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: "online",
        version: CONFIG.VERSION,
        uptime: Math.floor(process.uptime()) + " giây",
        nohu: { sessions: DATA_STORE.nohu.history.length, accuracy: Utils.calculateWinRate(DATA_STORE.nohu.stats) },
        md5:  { sessions: DATA_STORE.md5.history.length,  accuracy: Utils.calculateWinRate(DATA_STORE.md5.stats) }
    });
});

app.get('/api/history', (req, res) => {
    res.json({
        nohu: DATA_STORE.nohu.history.slice(-30),   // 30 phiên gần nhất
        md5:  DATA_STORE.md5.history.slice(-30)
    });
});

// ================== 🚀 KHỞI ĐỘNG ==================
app.listen(PORT, () => {
    console.log(`\n🚀 TUANX3000 ULTIMATE V2.1 KHỞI ĐỘNG THÀNH CÔNG`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🔄 Sync mỗi ${CONFIG.SYNC_INTERVAL / 1000} giây\n`);

    syncData();                    // Sync ngay khi khởi động
    setInterval(syncData, CONFIG.SYNC_INTERVAL);
});