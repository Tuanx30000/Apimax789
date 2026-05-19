const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==================== API LINKS (Token nhúng) ====================
const NOHU_URL = 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7';

const MD5_URL = 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7';

let txHistory = [];

// ==================== UTILITIES ====================
function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function avg(nums) { return nums.length ? sum(nums) / nums.length : 0; }

function entropy(arr) {
    if (!arr.length) return 0;
    const freq = {};
    for (const v of arr) freq[v] = (freq[v] || 0) + 1;
    let e = 0, n = arr.length;
    for (const k in freq) {
        const p = freq[k] / n;
        e -= p * Math.log2(p);
    }
    return e;
}

function lastN(arr, n) {
    return arr.slice(Math.max(0, arr.length - n));
}

// ==================== FEATURE EXTRACTION ====================
function extractFeatures(history) {
    const tx = history.map(h => h.tx);
    const totals = history.map(h => h.total);
    const dice1 = history.map(h => h.dice[0]);
    const dice2 = history.map(h => h.dice[1]);
    const dice3 = history.map(h => h.dice[2]);

    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
        if (tx[i] === cur) len++;
        else {
            runs.push({ val: cur, len });
            cur = tx[i];
            len = 1;
        }
    }
    if (tx.length) runs.push({ val: cur, len });

    return {
        tx, totals, runs,
        meanTotal: avg(totals),
        entropy: entropy(tx),
        last3: tx.slice(-3).join(''),
        last5: tx.slice(-5).join(''),
        lastRun: runs[runs.length - 1] || { len: 0, val: 'T' }
    };
}

// ==================== 15+ THUẬT TOÁN CHÍNH (Rút gọn nhưng mạnh) ====================
function getAllPredictions(history) {
    if (history.length < 15) return [];
    const features = extractFeatures(history);
    const predictions = [];

    // 1. Frequency Rebalance
    const tCount = features.tx.filter(x => x === 'T').length;
    const xCount = features.tx.length - tCount;
    if (Math.abs(tCount - xCount) > 5) {
        predictions.push(tCount > xCount ? 'X' : 'T');
    }

    // 2. Markov-like + Pattern
    if (features.last3 === 'TTT') predictions.push('X');
    if (features.last3 === 'XXX') predictions.push('T');
    if (features.lastRun.len >= 4) predictions.push(features.lastRun.val === 'T' ? 'X' : 'T');

    // 3. Total Bias
    if (features.meanTotal > 12.5) predictions.push('X');
    if (features.meanTotal < 9.5) predictions.push('T');

    // 4. Entropy
    if (features.entropy < 0.6) predictions.push(features.tx[features.tx.length-1] === 'T' ? 'X' : 'T');

    // Thêm nhiều pattern khác...
    const recent = lastN(features.tx, 8).join('');
    if (recent.includes('TTTX') || recent.includes('XXXT')) predictions.push('T');
    if (recent.includes('TXXT')) predictions.push('X');

    return predictions;
}

// ==================== GODLIKE ENSEMBLE ====================
function godlikePredict(history) {
    const preds = getAllPredictions(history);
    if (preds.length === 0) {
        return { du_doan: "Tài", do_tin_cay: "52%", pattern: "Thu thập dữ liệu" };
    }

    let tVotes = preds.filter(p => p === 'T').length;
    let xVotes = preds.length - tVotes;

    const final = tVotes >= xVotes ? 'Tài' : 'Xỉu';
    const confidence = Math.min(88, 55 + Math.abs(tVotes - xVotes) * 8);

    const features = extractFeatures(history);
    return {
        du_doan: final,
        do_tin_cay: `${confidence}%`,
        pattern: features.last3 ? `Last3: ${features.last3} | Run: ${features.lastRun.len}` : "Normal",
        votes_t: tVotes,
        votes_x: xVotes,
        algorithm_used: preds.length
    };
}

// ==================== FETCH DATA ====================
async function fetchHistory(type = 'nohu') {
    const url = type === 'md5' ? MD5_URL : NOHU_URL;
    try {
        const res = await fetch(url);
        const raw = await res.json();
        const list = Array.isArray(raw) ? raw : (raw.list || raw.data || []);

        return list.map(item => {
            const dice = [
                item.FirstDice || item.dice?.[0] || 0,
                item.SecondDice || item.dice?.[1] || 0,
                item.ThirdDice || item.dice?.[2] || 0
            ];
            const total = item.DiceSum || sum(dice);
            return {
                session: item.SessionId || item.id,
                dice: dice,
                total: total,
                result: total >= 11 ? "Tài" : "Xỉu",
                tx: total >= 11 ? 'T' : 'X',
                time: item.CreatedDate || item.time
            };
        }).reverse();
    } catch (e) {
        console.error("Fetch error:", e.message);
        return txHistory;
    }
}

// ==================== API ROUTES ====================
app.get('/api/history', async (req, res) => {
    const type = req.query.type?.toLowerCase() || 'nohu';
    const limit = parseInt(req.query.limit) || 30;

    const data = await fetchHistory(type);
    txHistory = data;

    res.json({
        success: true,
        type: type === 'md5' ? 'MD5' : 'Nổ Hũ',
        data: data.slice(0, limit),
        total: data.length,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/predict', async (req, res) => {
    const type = req.query.type?.toLowerCase() || 'nohu';
    const data = await fetchHistory(type);
    
    if (data.length > 0) txHistory = data;

    const prediction = godlikePredict(txHistory);
    const last = txHistory[0] || {};

    res.json({
        id: "GODLIKE AI v4.0 - Full Version",
        phien_truoc: last.session,
        xuc_xac1: last.dice?.[0],
        xuc_xac2: last.dice?.[1],
        xuc_xac3: last.dice?.[2],
        tong: last.total,
        ket_qua: last.result?.toLowerCase() || "chờ",
        phien_hien_tai: last.session ? last.session + 1 : null,
        ...prediction,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        status: "ok",
        version: "GODLIKE AI v4.0 Full",
        message: "Server Tài Xỉu Nổ Hũ + MD5 đang chạy",
        endpoints: ["/api/predict", "/api/predict?type=md5", "/api/history"]
    });
});

app.listen(PORT, () => {
    console.log(`🚀 GODLIKE AI v4.0 FULL đang chạy tại port ${PORT}`);
});