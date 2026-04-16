'use strict';

/**
 * TUANX3000 ULTIMATE V11.3 FIXED - SINGLE FILE FULL
 * - Đã fix lỗi 50% treo trên Railway
 * - Sync engine chống deadlock
 * - Global error handling
 * - Bind 0.0.0.0 chuẩn production
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
  VERSION: '11.3 FIXED',
  SYNC_MS: 3000,
  FETCH_TIMEOUT_MS: 7000,
  GROK_MODEL: 'grok-4.20-reasoning',

  // === ENDPOINTS (đã dán sẵn) ===
  ENDPOINTS: {
    NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
    MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
  },

  GROK_API_KEY: (process.env.GROK_API_KEY || '').trim()
};

if (!CONFIG.GROK_API_KEY) {
  console.warn('⚠️ GROK_API_KEY chưa set trong Railway Variables → Grok fallback 50%');
}

// ================== FETCH & DATA STORE ==================
const fetchFn = global.fetch || null;
if (!fetchFn) {
  console.error('Node.js 18+ required');
  process.exit(1);
}

const DATA_STORE = {
  nohu: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set(), lastSyncAt: null, lastError: null },
  md5:  { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set(), lastSyncAt: null, lastError: null }
};

let isSyncing = false;

// ================== UTILS ==================
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
  for (const item of existing) if (item?.session > 0) map.set(item.session, item);
  for (const item of incoming) if (item?.session > 0) map.set(item.session, item);
  return Array.from(map.values())
    .sort((a, b) => a.session - b.session)
    .slice(-200);
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

// ================== RAILWAY CORE ALGO ==================
const Algos = {
  railwayCore(mode) {
    const h = DATA_STORE[mode].history;
    if (h.length < 10) {
      return { res: 'N/A', conf: '0%', log: 'Đang nạp dữ liệu sảnh...' };
    }

    const last6 = h.slice(-6).map(x => (x.result === 'Tài' ? 'T' : 'X')).join('');
    const patterns = {
      TTTTTT: 'X', XXXXXX: 'T', TXTXTX: 'T', XTXTXT: 'X',
      TTXXTT: 'X', XXTTXX: 'T', TTTXXX: 'T', XXXTTT: 'X'
    };

    if (patterns[last6]) {
      return {
        res: patterns[last6] === 'T' ? 'Tài' : 'Xỉu',
        conf: '92%',
        log: `Pattern Markov: ${last6}`
      };
    }

    const countT = h.slice(-20).filter(x => x.result === 'Tài').length;
    if (countT >= 13) return { res: 'Xỉu', conf: '84%', log: 'High Frequency Reset' };
    if (countT <= 7) return { res: 'Tài', conf: '84%', log: 'Low Frequency Reset' };

    return {
      res: h[h.length - 1].result === 'Tài' ? 'Xỉu' : 'Tài',
      conf: '70%',
      log: 'Counter-Trend Default'
    };
  }
};

// ================== GROK AI ==================
async function callGrok(mode) {
  if (!CONFIG.GROK_API_KEY) {
    return { du_doan: 'XỈU', tin_cay: '50%', phan_tich: 'No Grok API Key' };
  }

  const sequence = DATA_STORE[mode].history.slice(-15).map(x => x.result).join('->');

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
          { role: 'system', content: 'Expert Data Analyst. Return JSON only.' },
          { role: 'user', content: `History ${mode}: ${sequence}. Predict next. Return only JSON: {"du_doan":"TÀI","tin_cay":"89%","phan_tich":"..."}` }
        ],
        temperature: 0.4
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
      tin_cay: parsed.tin_cay || '50%',
      phan_tich: parsed.phan_tich || 'AI analysis completed'
    };
  } catch (err) {
    console.error(`Grok API error (${mode}):`, err.message);
    return { du_doan: 'XỈU', tin_cay: '50%', phan_tich: 'AI Error → Fallback' };
  }
}

// ================== SYNC ENGINE (ANTI-DEADLOCK) ==================
async function runSync() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    for (const key of ['nohu', 'md5']) {
      const endpoint = CONFIG.ENDPOINTS[key.toUpperCase()];
      const state = DATA_STORE[key];

      if (!endpoint || endpoint.includes('PASTE_')) {
        state.lastError = 'Endpoint not configured';
        continue;
      }

      try {
        const json = await fetchJsonWithTimeout(endpoint);
        const list = Array.isArray(json) ? json : (json?.list || json?.data || []);

        if (!Array.isArray(list) || list.length === 0) {
          state.lastSyncAt = new Date().toISOString();
          continue;
        }

        const incoming = list
          .map(item => ({
            session: toNumber(item.id ?? item.SessionId ?? item.session ?? item.SessionID),
            result: standardizeResult(item)
          }))
          .filter(i => i.session > 0)
          .sort((a, b) => a.session - b.session);

        state.history = mergeHistory(state.history, incoming);

        // Update stats
        if (state.lastPrediction && !state.processedSessions.has(state.lastPrediction.session)) {
          const matched = state.history.find(x => x.session === state.lastPrediction.session);
          if (matched) {
            if (normalizePrediction(state.lastPrediction.res) === matched.result) state.stats.win++;
            else state.stats.loss++;
            state.stats.total++;
            state.processedSessions.add(state.lastPrediction.session);

            if (state.processedSessions.size > 100) {
              state.processedSessions = new Set(Array.from(state.processedSessions).slice(-50));
            }
          }
        }

        state.lastSyncAt = new Date().toISOString();
        state.lastError = null;
      } catch (err) {
        state.lastError = err.message || String(err);
        state.lastSyncAt = new Date().toISOString();
        console.error(`Sync fail ${key}:`, err.message);
      }
    }
  } catch (globalErr) {
    console.error('Global sync error:', globalErr);
  } finally {
    isSyncing = false;
  }
}

// ================== GLOBAL ERROR HANDLING ==================
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

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
    :root { --neon-g: #00ff41; --neon-p: #bc13fe; --bg: #080808; --card: #121212; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; background: var(--bg); color: var(--neon-g);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .container {
      width: 100%; max-width: 560px; background: var(--card);
      border: 1px solid rgba(0,255,65,0.9); border-radius: 20px; padding: 26px;
      box-shadow: 0 0 30px rgba(0,255,65,0.18); position: relative; text-align: center;
    }
    .container::before {
      content: ''; position: absolute; inset: -2px; border-radius: 22px;
      background: linear-gradient(45deg, var(--neon-g), transparent, var(--neon-p)); opacity: 0.25; z-index: -1;
    }
    h1 { margin: 0 0 6px; color: #fff; font-size: 1.5rem; text-shadow: 0 0 10px var(--neon-g); }
    .tagline { font-size: 0.78rem; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-bottom: 24px; }
    .grid { display: grid; gap: 14px; }
    .btn {
      display: block; padding: 16px 18px; border-radius: 14px; border: 1px solid var(--neon-g);
      color: var(--neon-g); text-decoration: none; font-weight: 700; transition: 0.25s ease;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 0 20px rgba(0,255,65,0.35); background: var(--neon-g); color: #000; }
    .btn.special { border-color: var(--neon-p); color: var(--neon-p); }
    .btn.special:hover { background: var(--neon-p); color: #fff; box-shadow: 0 0 20px rgba(188,19,254,0.35); }
    .panel { margin-top: 18px; padding: 14px; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; color: #bbb; text-align: left; font-size: 0.92rem; background: rgba(255,255,255,0.02); }
    .footer { margin-top: 18px; color: #444; font-size: 0.72rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(CONFIG.ADMIN)} <span style="color:var(--neon-p)">ULTIMATE</span></h1>
    <div class="tagline">System Engine Version ${escapeHtml(CONFIG.VERSION)}</div>
    <div class="grid">
      <a href="/api/dual-engine?provider=railway" class="btn">1. RAILWAY CORE ENGINE</a>
      <a href="/api/dual-engine?provider=grok" class="btn">2. GROK AI MASTER</a>
      <a href="/api/dual-engine?provider=hybrid" class="btn special">3. HYBRID CONSENSUS (VIP)</a>
    </div>
    <div class="panel">
      <div><strong>Health:</strong> <a href="/health" style="color:var(--neon-g)">/health</a></div>
      <div><strong>Stats:</strong> <a href="/api/stats" style="color:var(--neon-g)">/api/stats</a></div>
      <div>Endpoints & GROK_API_KEY quản lý qua Railway Variables</div>
    </div>
    <div class="footer">ADMIN: ${escapeHtml(CONFIG.ADMIN)} | STATUS: ONLINE</div>
  </div>
</body>
</html>
  `);
});

// ================== API ROUTES ==================
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString(), syncing: isSyncing, version: CONFIG.VERSION, grok_key_set: !!CONFIG.GROK_API_KEY }));

app.get('/api/stats', (req, res) => {
  res.json({
    author: CONFIG.ADMIN,
    version: CONFIG.VERSION,
    server_time: new Date().toISOString(),
    data: {
      nohu: { history_length: DATA_STORE.nohu.history.length, last_sync_at: DATA_STORE.nohu.lastSyncAt, last_error: DATA_STORE.nohu.lastError, stats: DATA_STORE.nohu.stats },
      md5:  { history_length: DATA_STORE.md5.history.length,  last_sync_at: DATA_STORE.md5.lastSyncAt,  last_error: DATA_STORE.md5.lastError,  stats: DATA_STORE.md5.stats }
    }
  });
});

app.get('/api/dual-engine', async (req, res) => {
  const provider = String(req.query.provider || 'railway').toLowerCase();
  const finalResults = {};

  for (const mode of ['nohu', 'md5']) {
    const state = DATA_STORE[mode];
    const lastSes = state.history.length > 0 ? state.history[state.history.length - 1].session : 0;
    let prediction;

    if (provider === 'grok') {
      const g = await callGrok(mode);
      prediction = { res: g.du_doan, conf: g.tin_cay, log: `Grok AI: ${g.phan_tich}` };
    } else if (provider === 'hybrid') {
      const a = Algos.railwayCore(mode);
      const g = await callGrok(mode);
      if (normalizePrediction(a.res) === normalizePrediction(g.du_doan)) {
        prediction = { res: a.res, conf: '96%', log: 'Consensus Met (Code & AI Agree)' };
      } else {
        const confA = parseFloat(String(a.conf).replace('%', '')) || 0;
        const confG = parseFloat(String(g.tin_cay).replace('%', '')) || 0;
        prediction = confA >= confG ? a : { res: g.du_doan, conf: g.tin_cay, log: 'AI Primary Analysis' };
      }
    } else {
      prediction = Algos.railwayCore(mode);
    }

    const nextSession = lastSes + 1;
    state.lastPrediction = { session: nextSession, res: normalizePrediction(prediction.res) };

    finalResults[mode.toUpperCase()] = {
      current_session: lastSes,
      next_session: nextSession,
      predict: normalizePrediction(prediction.res).toUpperCase(),
      confidence: prediction.conf,
      analysis: prediction.log,
      accuracy: {
        win: state.stats.win,
        loss: state.stats.loss,
        total: state.stats.total,
        rate: formatRate(state.stats.win, state.stats.total)
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ${CONFIG.ADMIN} ${CONFIG.VERSION} ONLINE tại port ${PORT}`);

  // Chạy sync sau khi server đã listen (fix 50% crash)
  setTimeout(() => {
    runSync();
    setInterval(runSync, CONFIG.SYNC_MS);
  }, 1500);
});