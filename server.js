'use strict';

/**
 * TUANX3000 ULTIMATE V11.4 FULL - WIN/LOSS SEPARATED & ENHANCED
 * - Tách biệt hoàn toàn Win/Loss cho từng thuật toán: Railway, Grok, Hybrid
 * - Stats độc lập theo từng provider
 * - Railway Core cải tiến với streak + pattern + balance
 * - Grok AI prompt tối ưu hơn
 * - Hybrid logic thông minh
 * - Dashboard UI đẹp + thông tin chi tiết
 * - Key lấy từ Environment Variables (Railway)
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 8000);

app.use(cors());
app.use(express.json());

// ================== CONFIG ==================
const CONFIG = {
  ADMIN: 'TUANX3000',
  VERSION: '11.4 FULL - WIN/LOSS SEPARATED',
  SYNC_MS: 3000,
  FETCH_TIMEOUT_MS: 8000,
  GROK_MODEL: 'grok-4.20-reasoning',

  ENDPOINTS: {
    NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
    MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
  },

  GROK_API_KEY: (process.env.GROK_API_KEY || '').trim()
};

if (!CONFIG.GROK_API_KEY) {
  console.warn('⚠️ GROK_API_KEY chưa được thiết lập. Hybrid & Grok AI sẽ dùng fallback.');
}

// ================== FETCH SETUP ==================
const fetchFn = global.fetch ? global.fetch.bind(global) : null;
if (!fetchFn) {
  throw new Error('Node.js 18+ is required (global fetch missing)');
}

// ================== DATA STORE ==================
const DATA_STORE = {
  nohu: {
    history: [],
    lastPrediction: { railway: null, grok: null, hybrid: null },
    stats: {
      railway: { win: 0, loss: 0, total: 0 },
      grok:     { win: 0, loss: 0, total: 0 },
      hybrid:   { win: 0, loss: 0, total: 0 }
    },
    processedSessions: new Set(),
    lastSyncAt: null,
    lastError: null
  },
  md5: {
    history: [],
    lastPrediction: { railway: null, grok: null, hybrid: null },
    stats: {
      railway: { win: 0, loss: 0, total: 0 },
      grok:     { win: 0, loss: 0, total: 0 },
      hybrid:   { win: 0, loss: 0, total: 0 }
    },
    processedSessions: new Set(),
    lastSyncAt: null,
    lastError: null
  }
};

let isSyncing = false;

// ================== UTILS ==================
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizePrediction(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw.includes('TÀI') || raw === 'TAI' || raw.startsWith('T')) return 'Tài';
  if (raw.includes('XỈU') || raw === 'XIU' || raw.startsWith('X')) return 'Xỉu';
  return 'Xỉu';
}

function standardizeResult(item = {}) {
  const text = [
    item.resultTruyenThong, item.result, item.BetSide,
    item.side, item.betSide, item.name
  ].filter(Boolean).join(' ').toUpperCase();

  const diceSum = toNumber(item.DiceSum ?? item.diceSum ?? item.sum);

  if (text.includes('TÀI') || text.includes('TAI')) return 'Tài';
  if (text.includes('XỈU') || text.includes('XIU')) return 'Xỉu';
  if (diceSum >= 11) return 'Tài';
  if (diceSum > 0) return 'Xỉu';
  return 'Xỉu';
}

function mergeHistory(existing, incoming) {
  const map = new Map();
  [...existing, ...incoming].forEach(item => {
    if (item && item.session > 0) map.set(item.session, item);
  });
  return Array.from(map.values()).sort((a, b) => a.session - b.session).slice(-250);
}

function formatRate(win, total) {
  if (!total) return '0%';
  return `${((win / total) * 100).toFixed(1)}%`;
}

async function fetchJsonWithTimeout(url, timeoutMs = CONFIG.FETCH_TIMEOUT_MS) {
  if (!url || url.includes('PASTE_')) throw new Error('Missing endpoint');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// ================== RAILWAY CORE ENGINE ==================
const Algos = {
  railwayCore(mode) {
    const h = DATA_STORE[mode].history;
    if (h.length < 12) {
      return { res: 'N/A', conf: '0%', log: 'Đang thu thập dữ liệu...', streak: 0, balance: '0/20' };
    }

    // Tính streak
    let streak = 1;
    const lastResult = h[h.length - 1].result;
    for (let i = h.length - 2; i >= 0; i--) {
      if (h[i].result === lastResult) streak++;
      else break;
    }

    const last6 = h.slice(-6).map(x => x.result === 'Tài' ? 'T' : 'X').join('');
    const patterns = {
      'TTTTTT': 'Xỉu', 'XXXXXX': 'Tài',
      'TXTXTX': 'Tài', 'XTXTXT': 'Xỉu',
      'TTXXTT': 'Xỉu', 'XXTTXX': 'Tài',
      'TTTXXX': 'Tài', 'XXXTTT': 'Xỉu',
      'TTTXTT': 'Xỉu', 'XXXTXX': 'Tài'
    };

    if (patterns[last6]) {
      return {
        res: patterns[last6],
        conf: streak >= 4 ? '90%' : '85%',
        log: `Pattern mạnh: ${last6} | Streak ${streak} ${lastResult}`,
        streak,
        balance: `${h.slice(-20).filter(x => x.result === 'Tài').length}/20`
      };
    }

    const countT = h.slice(-20).filter(x => x.result === 'Tài').length;
    if (countT >= 14) return { res: 'Xỉu', conf: '87%', log: `Tài nóng (${countT}/20)`, streak, balance: `${countT}/20` };
    if (countT <= 6)  return { res: 'Tài', conf: '87%', log: `Xỉu nóng (${countT}/20)`, streak, balance: `${countT}/20` };

    const defaultRes = lastResult === 'Tài' ? 'Xỉu' : 'Tài';
    return {
      res: defaultRes,
      conf: streak >= 5 ? '78%' : '70%',
      log: `Counter Trend | Streak ${streak}`,
      streak,
      balance: `${countT}/20`
    };
  }
};

// ================== GROK AI ==================
async function callGrok(mode) {
  if (!CONFIG.GROK_API_KEY) {
    return { du_doan: 'XỈU', tin_cay: '50%', phan_tich: 'No Grok API Key' };
  }

  const sequence = DATA_STORE[mode].history.slice(-20).map(x => x.result).join(' → ');

  try {
    const response = await fetchFn('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONFIG.GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: CONFIG.GROK_MODEL,
        messages: [
          { role: 'system', content: 'Bạn là chuyên gia phân tích Tài Xỉu. Phân tích streak, tần suất và dự đoán logic. Trả về JSON chính xác.' },
          {
            role: 'user',
            content: `Lịch sử ${mode}: ${sequence}\nDự đoán ván tiếp theo.\nTrả về đúng JSON: {"du_doan":"TÀI","tin_cay":"82%","phan_tich":"Lý do phân tích..."}`
          }
        ],
        temperature: 0.35
      })
    });

    if (!response.ok) throw new Error(`Grok HTTP ${response.status}`);

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Invalid AI format');

    const parsed = JSON.parse(match[0]);

    return {
      du_doan: normalizePrediction(parsed.du_doan),
      tin_cay: parsed.tin_cay || '60%',
      phan_tich: parsed.phan_tich || 'AI Analysis'
    };
  } catch (err) {
    console.error(`Grok error (${mode}):`, err.message);
    return { du_doan: 'XỈU', tin_cay: '50%', phan_tich: 'AI Timeout / Error' };
  }
}

// ================== SYNC ENGINE ==================
async function runSync() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    for (const key of ['nohu', 'md5']) {
      const endpoint = CONFIG.ENDPOINTS[key.toUpperCase()];
      const state = DATA_STORE[key];

      if (!endpoint) continue;

      try {
        const json = await fetchJsonWithTimeout(endpoint);
        const list = Array.isArray(json) ? json : (json?.list || json?.data || []);

        const incoming = list
          .map(item => ({
            session: toNumber(item.id ?? item.SessionId ?? item.session ?? item.SessionID),
            result: standardizeResult(item)
          }))
          .filter(i => i.session > 0)
          .sort((a, b) => a.session - b.session);

        if (incoming.length === 0) continue;

        state.history = mergeHistory(state.history, incoming);

        // Kiểm tra win/lose cho tất cả provider
        ['railway', 'grok', 'hybrid'].forEach(provider => {
          const pred = state.lastPrediction[provider];
          if (pred && !state.processedSessions.has(pred.session)) {
            const matched = state.history.find(x => x.session === pred.session);
            if (matched) {
              const isWin = normalizePrediction(pred.res) === matched.result;
              state.stats[provider][isWin ? 'win' : 'loss']++;
              state.stats[provider].total++;
              state.processedSessions.add(pred.session);
            }
          }
        });

        if (state.processedSessions.size > 150) {
          state.processedSessions = new Set(Array.from(state.processedSessions).slice(-100));
        }

        state.lastSyncAt = new Date().toISOString();
        state.lastError = null;
      } catch (err) {
        state.lastError = err.message || String(err);
        console.error(`Sync error ${key}:`, err.message);
      }
    }
  } finally {
    isSyncing = false;
  }
}

// ================== DASHBOARD UI ==================
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(CONFIG.ADMIN)} ${escapeHtml(CONFIG.VERSION)}</title>
  <style>
    :root {
      --neon-g: #00ff41;
      --neon-p: #bc13fe;
      --bg: #080808;
      --card: #121212;
    }
    body {
      margin: 0; min-height: 100vh; background: var(--bg); color: var(--neon-g);
      font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; padding: 15px;
    }
    .container {
      width: 100%; max-width: 580px; background: var(--card);
      border: 1px solid rgba(0,255,65,0.9); border-radius: 20px;
      padding: 25px; box-shadow: 0 0 35px rgba(0,255,65,0.2);
    }
    h1 { margin: 0 0 8px; font-size: 1.65rem; text-shadow: 0 0 12px var(--neon-g); }
    .tagline { font-size: 0.8rem; color: #888; letter-spacing: 1.5px; margin-bottom: 25px; }
    .grid { display: grid; gap: 12px; }
    .btn {
      padding: 17px 20px; border-radius: 14px; border: 1px solid var(--neon-g);
      color: var(--neon-g); text-decoration: none; font-weight: 700;
      transition: all 0.3s; background: transparent; text-align: left;
    }
    .btn:hover { transform: translateY(-3px); box-shadow: 0 0 25px rgba(0,255,65,0.4); background: var(--neon-g); color: #000; }
    .btn.special { border-color: var(--neon-p); color: var(--neon-p); }
    .btn.special:hover { background: var(--neon-p); color: white; box-shadow: 0 0 25px rgba(188,19,254,0.4); }
    .panel {
      margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; font-size: 0.93rem;
    }
    .footer { margin-top: 20px; text-align: center; color: #555; font-size: 0.75rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(CONFIG.ADMIN)} <span style="color:var(--neon-p)">ULTIMATE</span></h1>
    <div class="tagline">VERSION ${escapeHtml(CONFIG.VERSION)}</div>

    <div class="grid">
      <a href="/api/dual-engine?provider=railway" class="btn">1. RAILWAY CORE ENGINE<br><span style="font-weight:400;opacity:0.8">Logic + Streak Analysis</span></a>
      <a href="/api/dual-engine?provider=grok" class="btn">2. GROK AI MASTER<br><span style="font-weight:400;opacity:0.8">Phân tích bằng Grok AI</span></a>
      <a href="/api/dual-engine?provider=hybrid" class="btn special">3. HYBRID CONSENSUS (VIP)<br><span style="font-weight:400;opacity:0.8">Kết hợp Code + AI - Tốt nhất</span></a>
    </div>

    <div class="panel">
      <strong>Health:</strong> <a href="/health" style="color:var(--neon-g)">/health</a><br>
      <strong>Stats Win/Loss:</strong> <a href="/api/stats" style="color:var(--neon-g)">/api/stats</a><br>
      <strong>Config:</strong> GROK_API_KEY được quản lý qua Railway Variables.
    </div>

    <div class="footer">
      ADMIN: ${escapeHtml(CONFIG.ADMIN)} | STATUS: ONLINE | ${new Date().toLocaleDateString('vi-VN')}
    </div>
  </div>
</body>
</html>
  `);
});

// ================== API ROUTES ==================
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    syncing: isSyncing,
    version: CONFIG.VERSION,
    grok_key_set: !!CONFIG.GROK_API_KEY
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    author: CONFIG.ADMIN,
    version: CONFIG.VERSION,
    server_time: new Date().toISOString(),
    data: {
      nohu: {
        history_length: DATA_STORE.nohu.history.length,
        last_sync: DATA_STORE.nohu.lastSyncAt,
        stats: DATA_STORE.nohu.stats
      },
      md5: {
        history_length: DATA_STORE.md5.history.length,
        last_sync: DATA_STORE.md5.lastSyncAt,
        stats: DATA_STORE.md5.stats
      }
    }
  });
});

app.get('/api/dual-engine', async (req, res) => {
  const provider = String(req.query.provider || 'railway').toLowerCase();
  const finalResults = {};

  for (const mode of ['nohu', 'md5']) {
    const state = DATA_STORE[mode];
    const lastSes = state.history.length ? state.history[state.history.length - 1].session : 0;

    let predictionData;

    if (provider === 'grok') {
      const g = await callGrok(mode);
      predictionData = {
        res: g.du_doan,
        conf: g.tin_cay,
        log: `Grok AI: ${g.phan_tich}`
      };
    } else if (provider === 'hybrid') {
      const core = Algos.railwayCore(mode);
      const grok = await callGrok(mode);

      if (normalizePrediction(core.res) === normalizePrediction(grok.du_doan)) {
        predictionData = {
          res: core.res,
          conf: '96%',
          log: `Hybrid Consensus - Đồng thuận mạnh | ${core.log}`
        };
      } else {
        const coreConf = parseFloat(core.conf) || 0;
        const grokConf = parseFloat(grok.tin_cay) || 0;
        predictionData = coreConf >= grokConf ? core : {
          res: grok.du_doan,
          conf: grok.tin_cay,
          log: `AI ưu tiên: ${grok.phan_tich}`
        };
      }
    } else {
      predictionData = Algos.railwayCore(mode);
    }

    const nextSession = lastSes + 1;

    // Lưu dự đoán theo provider
    state.lastPrediction[provider] = {
      session: nextSession,
      res: normalizePrediction(predictionData.res)
    };

    finalResults[mode.toUpperCase()] = {
      current_session: lastSes,
      next_session: nextSession,
      predict: normalizePrediction(predictionData.res).toUpperCase(),
      confidence: predictionData.conf,
      analysis: predictionData.log,
      streak: predictionData.streak || 0,
      balance: predictionData.balance || 'N/A',
      accuracy: {
        win: state.stats[provider].win,
        loss: state.stats[provider].loss,
        total: state.stats[provider].total,
        rate: formatRate(state.stats[provider].win, state.stats[provider].total)
      }
    };
  }

  res.json({
    author: CONFIG.ADMIN,
    version: CONFIG.VERSION,
    provider: provider.toUpperCase(),
    server_time: new Date().toLocaleString('vi-VN'),
    results: finalResults
  });
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 ${CONFIG.ADMIN} ${CONFIG.VERSION} ONLINE tại port ${PORT}`);
  runSync();
  setInterval(runSync, CONFIG.SYNC_MS);
});