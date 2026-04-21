'use strict';

/**
 * TUANX3000 ULTIMATE V11. HYBRID VOTING FULL - FIXED
 * - Multi-AI: Grok + OpenAI + Gemini
 * - Hybrid Voting: Gom tất cả AI + thuật toán
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
  VERSION: '12.1 HYBRID VOTING FULL',
  SYNC_MS: 8000,
  FETCH_TIMEOUT_MS: 15000,

  GROK_MODEL: 'grok-beta', // Đã fix tên model
  OPENAI_MODEL: 'gpt-4o-mini',
  GEMINI_MODEL: 'gemini-1.5-flash', // Đã fix tên model

  ENDPOINTS: {
    NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
    MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
  },

  GROK_API_KEY: (process.env.GROK_API_KEY || '').trim(),
  OPENAI_API_KEY: (process.env.OPENAI_API_KEY || '').trim(),
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || '').trim()
};

console.log('🔧 Multi-AI Voting System Loaded');
console.log('Grok:', CONFIG.GROK_API_KEY ? '✅' : '❌');
console.log('OpenAI:', CONFIG.OPENAI_API_KEY ? '✅' : '❌');
console.log('Gemini:', CONFIG.GEMINI_API_KEY ? '✅' : '❌');

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
  return 'Xỉu';
}

function standardizeResult(item = {}) {
  const text = [item.resultTruyenThong, item.result, item.BetSide, item.side, item.betSide, item.name]
    .filter(Boolean).join(' ').toUpperCase();
  const diceSum = toNumber(item.DiceSum ?? item.diceSum ?? item.sum);
  if (text.includes('TÀI') || text.includes('TAI')) return 'Tài';
  if (text.includes('XỈU') || text.includes('XIU')) return 'Xỉu';
  return diceSum >= 11 ? 'Tài' : 'Xỉu';
}

function mergeHistory(existing, incoming) {
  const map = new Map();
  for (const item of existing) if (item?.session > 0) map.set(item.session, item);
  for (const item of incoming) if (item?.session > 0) map.set(item.session, item);
  return Array.from(map.values()).sort((a, b) => a.session - b.session).slice(-200);
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
    if (h.length < 10) return { res: 'N/A', conf: '0%', log: 'Đang nạp dữ liệu sảnh...' };

    const last6 = h.slice(-6).map(x => (x.result === 'Tài' ? 'T' : 'X')).join('');
    const patterns = { TTTTTT: 'X', XXXXXX: 'T', TXTXTX: 'T', XTXTXT: 'X', TTXXTT: 'X', XXTTXX: 'T', TTTXXX: 'T', XXXTTT: 'X' };
    if (patterns[last6]) return { res: patterns[last6] === 'T' ? 'Tài' : 'Xỉu', conf: '92%', log: `Pattern Markov: ${last6}` };

    const countT = h.slice(-20).filter(x => x.result === 'Tài').length;
    if (countT >= 13) return { res: 'Xỉu', conf: '84%', log: 'High Frequency Reset' };
    if (countT <= 7) return { res: 'Tài', conf: '84%', log: 'Low Frequency Reset' };

    return { res: h[h.length - 1].result === 'Tài' ? 'Xỉu' : 'Tài', conf: '70%', log: 'Counter-Trend Default' };
  }
};

// ================== CALL SINGLE AI ==================
async function callSingleAI(name, apiKey, model, endpoint, body) {
  if (!apiKey) return null;
  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: name !== 'gemini' ? `Bearer ${apiKey}` : undefined },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      console.error(`[${name}] Error HTTP:`, res.status, await res.text());
      return null;
    }

    const data = await res.json();
    let content = '';
    if (name === 'grok' || name === 'openai') content = data?.choices?.[0]?.message?.content || '';
    if (name === 'gemini') content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    content = content.replace(/```json|```/gi, '').trim();
    const match = content.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    return {
      du_doan: normalizePrediction(parsed.du_doan || parsed.predict),
      tin_cay: parsed.tin_cay || parsed.confidence || '75%',
      phan_tich: parsed.phan_tich || parsed.reason || name
    };
  } catch (err) {
    console.error(`[${name}] Parse Fail:`, err.message);
    return null;
  }
}

// ================== HYBRID VOTING ==================
async function hybridVoting(mode) {
  if (DATA_STORE[mode].history.length < 10) return Algos.railwayCore(mode); // Fix lỗi gửi data rỗng

  const core = Algos.railwayCore(mode);
  const votes = [{ source: 'Core', prediction: normalizePrediction(core.res), confidence: parseFloat(core.conf) || 70 }];

  const sequence = DATA_STORE[mode].history.slice(-12).map(x => x.result).join(' → ');
  const prompt = `History ${mode.toUpperCase()}: ${sequence}\nPredict next. Return exactly JSON format: {"du_doan":"TÀI","tin_cay":"82%","phan_tich":"reason"}`;

  const promises = [];

  if (CONFIG.GROK_API_KEY) {
    promises.push(callSingleAI('grok', CONFIG.GROK_API_KEY, CONFIG.GROK_MODEL,
      'https://api.x.ai/v1/chat/completions',
      { model: CONFIG.GROK_MODEL, messages: [{role:'system', content:'Reply ONLY JSON'}, {role:'user', content: prompt}], temperature: 0.2, max_tokens: 180, response_format: { type: "json_object" } })
      .then(r => r ? { source: 'Grok', prediction: r.du_doan, confidence: parseFloat(r.tin_cay) || 80 } : null));
  }

  if (CONFIG.OPENAI_API_KEY) {
    promises.push(callSingleAI('openai', CONFIG.OPENAI_API_KEY, CONFIG.OPENAI_MODEL,
      'https://api.openai.com/v1/chat/completions',
      { model: CONFIG.OPENAI_MODEL, messages: [{role:'system', content:'Reply ONLY JSON'}, {role:'user', content: prompt}], temperature: 0.2, max_tokens: 180, response_format: { type: "json_object" } })
      .then(r => r ? { source: 'OpenAI', prediction: r.du_doan, confidence: parseFloat(r.tin_cay) || 80 } : null));
  }

  if (CONFIG.GEMINI_API_KEY) {
    promises.push(callSingleAI('gemini', CONFIG.GEMINI_API_KEY, CONFIG.GEMINI_MODEL,
      `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] })
      .then(r => r ? { source: 'Gemini', prediction: r.du_doan, confidence: parseFloat(r.tin_cay) || 80 } : null));
  }

  const aiResults = (await Promise.all(promises)).filter(Boolean);
  votes.push(...aiResults);

  const tally = {};
  votes.forEach(v => {
    const key = v.prediction;
    if (!tally[key]) tally[key] = { count: 0, totalConf: 0 };
    tally[key].count++;
    tally[key].totalConf += v.confidence;
  });

  let winner = { prediction: 'Xỉu', confidence: 70, sources: ['Core'] };
  let maxScore = 0;

  Object.keys(tally).forEach(key => {
    const score = tally[key].count * 100 + (tally[key].totalConf / tally[key].count);
    if (score > maxScore) {
      maxScore = score;
      winner = {
        prediction: key,
        confidence: Math.round(tally[key].totalConf / tally[key].count),
        sources: votes.filter(v => v.prediction === key).map(v => v.source)
      };
    }
  });

  const sourceList = winner.sources.join(' + ');
  return {
    res: winner.prediction,
    conf: `${winner.confidence}%`,
    log: `Voting (${sourceList}) → ${winner.prediction} thắng`
  };
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
          .map(item => ({ session: toNumber(item.id ?? item.SessionId ?? item.session), result: standardizeResult(item) }))
          .filter(i => i.session > 0)
          .sort((a, b) => a.session - b.session);

        state.history = mergeHistory(state.history, incoming);

        if (state.lastPrediction && !state.processedSessions.has(state.lastPrediction.session)) {
          const matched = state.history.find(x => x.session === state.lastPrediction.session);
          if (matched) {
            if (normalizePrediction(state.lastPrediction.res) === matched.result) state.stats.win++;
            else state.stats.loss++;
            state.stats.total++;
            state.processedSessions.add(state.lastPrediction.session);
            if (state.processedSessions.size > 100) state.processedSessions = new Set(Array.from(state.processedSessions).slice(-50));
          }
        }
        state.lastSyncAt = new Date().toISOString();
        state.lastError = null;
      } catch (err) {
        state.lastError = err.message;
      }
    }
  } finally {
    isSyncing = false;
  }
}

process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));

// ================== UI DASHBOARD ==================
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
    body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--neon-g); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { width: 100%; max-width: 560px; background: var(--card); border: 1px solid rgba(0,255,65,0.9); border-radius: 20px; padding: 26px; box-shadow: 0 0 30px rgba(0,255,65,0.18); position: relative; text-align: center; overflow: hidden; }
    .container::before { content: ''; position: absolute; inset: -2px; border-radius: 22px; background: linear-gradient(45deg, var(--neon-g), transparent, var(--neon-p)); opacity: 0.25; z-index: -1; }
    h1 { margin: 0 0 6px; color: #fff; font-size: 1.5rem; text-shadow: 0 0 10px var(--neon-g); }
    .tagline { font-size: 0.78rem; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-bottom: 24px; }
    .grid { display: grid; gap: 14px; }
    .btn { display: block; padding: 16px 18px; border-radius: 14px; border: 1px solid var(--neon-g); color: var(--neon-g); text-decoration: none; font-weight: 700; transition: 0.25s ease; background: transparent; }
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
      <a href="/api/dual-engine?provider=grok" class="btn">2. GROK AI</a>
      <a href="/api/dual-engine?provider=openai" class="btn">3. OPENAI</a>
      <a href="/api/dual-engine?provider=gemini" class="btn">4. GEMINI</a>
      <a href="/api/dual-engine?provider=hybrid" class="btn special">5. HYBRID VOTING (VIP)</a>
    </div>
    <div class="panel">
      <div><strong>Health:</strong> <a href="/health" style="color:var(--neon-g)">/health</a></div>
      <div><strong>Stats:</strong> <a href="/api/stats" style="color:var(--neon-g)">/api/stats</a></div>
      <div>Multi-AI Voting - Tất cả AI cùng vote, kết quả tốt nhất thắng</div>
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
      nohu: { history_length: DATA_STORE.nohu.history.length, last_sync_at: DATA_STORE.nohu.lastSyncAt, stats: DATA_STORE.nohu.stats },
      md5:  { history_length: DATA_STORE.md5.history.length,  last_sync_at: DATA_STORE.md5.lastSyncAt,  stats: DATA_STORE.md5.stats }
    }
  });
});

app.get('/api/dual-engine', async (req, res) => {
  const provider = String(req.query.provider || 'railway').toLowerCase();
  const finalResults = {};

  for (const mode of ['nohu', 'md5']) {
    const state = DATA_STORE[mode];
    const lastSes = state.history.length > 0 ? state.history[state.history.length - 1].session : 0;
    
    // Fix lỗi gọi AI khi chưa có lịch sử
    if (state.history.length < 10) {
      const coreRes = Algos.railwayCore(mode);
      finalResults[mode.toUpperCase()] = { current_session: lastSes, next_session: lastSes + 1, predict: coreRes.res.toUpperCase(), confidence: coreRes.conf, analysis: coreRes.log, accuracy: { rate: '0%', win: 0, loss: 0, total: 0 }};
      continue;
    }

    let prediction;
    const promptData = `History ${mode.toUpperCase()}: ${state.history.slice(-12).map(x => x.result).join(' → ')}\nPredict next. Return exactly JSON: {"du_doan":"TÀI","tin_cay":"82%","phan_tich":"reason"}`;

    if (provider === 'hybrid') {
      prediction = await hybridVoting(mode);
    } else if (provider === 'grok') {
      const g = await callSingleAI('grok', CONFIG.GROK_API_KEY, CONFIG.GROK_MODEL, 'https://api.x.ai/v1/chat/completions', {
        model: CONFIG.GROK_MODEL, messages: [{role:'system', content:'Reply ONLY JSON'}, {role:'user', content: promptData}], temperature: 0.2, max_tokens: 180, response_format: { type: "json_object" }
      });
      prediction = g ? { res: g.du_doan, conf: g.tin_cay, log: `Grok: ${g.phan_tich}` } : Algos.railwayCore(mode);
    } else if (provider === 'openai') {
      const o = await callSingleAI('openai', CONFIG.OPENAI_API_KEY, CONFIG.OPENAI_MODEL, 'https://api.openai.com/v1/chat/completions', {
        model: CONFIG.OPENAI_MODEL, messages: [{role:'system', content:'Reply ONLY JSON'}, {role:'user', content: promptData}], temperature: 0.2, max_tokens: 180, response_format: { type: "json_object" }
      });
      prediction = o ? { res: o.du_doan, conf: o.tin_cay, log: `OpenAI: ${o.phan_tich}` } : Algos.railwayCore(mode);
    } else if (provider === 'gemini') {
      const ge = await callSingleAI('gemini', CONFIG.GEMINI_API_KEY, CONFIG.GEMINI_MODEL, `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`, {
        contents: [{ parts: [{ text: promptData }] }]
      });
      prediction = ge ? { res: ge.du_doan, conf: ge.tin_cay, log: `Gemini: ${ge.phan_tich}` } : Algos.railwayCore(mode);
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
  setTimeout(() => {
    runSync();
    setInterval(runSync, CONFIG.SYNC_MS);
  }, 2500);
});
