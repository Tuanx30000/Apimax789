const express = require('express');
const cors = require('cors');
const fetch = global.fetch ? global.fetch.bind(global) : require('node-fetch');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const CONFIG = {
  ADMIN: process.env.ADMIN_NAME || 'TUANX3000',
  VERSION: '11.1 CLEAN',
  SYNC_MS: Number(process.env.SYNC_MS || 3000),
  GROK_MODEL: process.env.GROK_MODEL || 'grok-4.20-reasoning',
  FETCH_TIMEOUT_MS: Number(process.env.FETCH_TIMEOUT_MS || 7000),
  ENDPOINTS: {
    NOHU: process.env.NOHU_ENDPOINT || '',
    MD5: process.env.MD5_ENDPOINT || ''
  }
};

const GROK_API_KEY = process.env.GROK_API_KEY || '';

const DATA_STORE = {
  nohu: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() },
  md5: { history: [], lastPrediction: null, stats: { win: 0, loss: 0, total: 0 }, processedSessions: new Set() }
};

let isSyncing = false;

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
  const text = [item.resultTruyenThong, item.result, item.BetSide, item.side, item.betSide, item.name]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  const diceSum = toNumber(item.DiceSum ?? item.diceSum ?? item.sum);

  if (text.includes('TÀI') || text.includes('TAI')) return 'Tài';
  if (text.includes('XỈU') || text.includes('XIU')) return 'Xỉu';
  if (diceSum >= 11) return 'Tài';
  if (diceSum > 0) return 'Xỉu';
  return 'Xỉu';
}

function mergeHistory(existing, incoming) {
  const map = new Map();

  for (const item of existing) {
    if (item && item.session > 0) map.set(item.session, item);
  }
  for (const item of incoming) {
    if (item && item.session > 0) map.set(item.session, item);
  }

  return Array.from(map.values()).sort((a, b) => a.session - b.session).slice(-200);
}

async function fetchJsonWithTimeout(url, timeoutMs = CONFIG.FETCH_TIMEOUT_MS) {
  if (!url) throw new Error('Missing endpoint');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const Algos = {
  railwayCore: (mode) => {
    const h = DATA_STORE[mode].history;
    if (h.length < 10) return { res: 'N/A', conf: '0%', log: 'Đang nạp dữ liệu sảnh...' };

    const last6 = h.slice(-6).map(x => (x.result === 'Tài' ? 'T' : 'X')).join('');
    const patterns = {
      TTTTTT: 'X',
      XXXXXX: 'T',
      TXTXTX: 'T',
      XTXTXT: 'X',
      TTXXTT: 'X',
      XXTTXX: 'T',
      TTTXXX: 'T',
      XXXTTT: 'X'
    };

    if (patterns[last6]) {
      return {
        res: patterns[last6] === 'T' ? 'Tài' : 'Xỉu',
        conf: '92%',
        log: 'Pattern Markov detected'
      };
    }

    const countT = h.slice(-20).filter(x => x.result === 'Tài').length;
    if (countT >= 13) return { res: 'Xỉu', conf: '84%', log: 'High Frequency Reset' };
    if (countT <= 7) return { res: 'Tài', conf: '84%', log: 'Low Frequency Reset' };

    return { res: h[h.length - 1].result === 'Tài' ? 'Xỉu' : 'Tài', conf: '70%', log: 'Counter-Trend Default' };
  }
};

async function callGrok(mode) {
  if (!GROK_API_KEY) {
    return { du_doan: 'XỈU', tin_cay: '50%', phan_tich: 'No Key Configured' };
  }

  const sequence = DATA_STORE[mode].history.slice(-15).map(x => x.result).join('->');

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: CONFIG.GROK_MODEL,
        messages: [
          { role: 'system', content: 'Expert Data Analyst.' },
          {
            role: 'user',
            content: `History ${mode}: ${sequence}. Predict next. Return JSON only: {"du_doan":"TÀI","tin_cay":"89%","phan_tich":"..."}`
          }
        ],
        temperature: 0.4
      })
    });

    if (!res.ok) throw new Error(`Grok HTTP ${res.status}`);

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Invalid AI response format');

    const parsed = JSON.parse(match[0]);
    return {
      du_doan: normalizePrediction(parsed.du_doan),
      tin_cay: parsed.tin_cay || '50%',
      phan_tich: parsed.phan_tich || 'AI analysis'
    };
  } catch (e) {
    return { du_doan: 'XỈU', tin_cay: '50%', phan_tich: 'AI API Timeout' };
  }
}

async function runSync() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    for (const key of ['nohu', 'md5']) {
      const endpoint = CONFIG.ENDPOINTS[key.toUpperCase()];
      if (!endpoint) continue;

      try {
        const json = await fetchJsonWithTimeout(endpoint);
        const list = Array.isArray(json) ? json : (json?.list || json?.data || []);
        if (!Array.isArray(list) || list.length === 0) continue;

        const incoming = list
          .map(item => ({
            session: toNumber(item.id ?? item.SessionId ?? item.session ?? item.SessionID),
            result: standardizeResult(item)
          }))
          .filter(i => i.session > 0)
          .sort((a, b) => a.session - b.session);

        if (incoming.length === 0) continue;

        const state = DATA_STORE[key];
        state.history = mergeHistory(state.history, incoming);

        if (state.lastPrediction && !state.processedSessions.has(state.lastPrediction.session)) {
          const matched = state.history.find(x => x.session === state.lastPrediction.session);
          if (matched) {
            if (normalizePrediction(state.lastPrediction.res) === matched.result) state.stats.win++;
            else state.stats.loss++;
            state.stats.total++;
            state.processedSessions.add(state.lastPrediction.session);

            if (state.processedSessions.size > 100) {
              const keep = Array.from(state.processedSessions).slice(-50);
              state.processedSessions = new Set(keep);
            }
          }
        }
      } catch (err) {
        console.error(`Sync fail: ${key}`, err.message);
      }
    }
  } finally {
    isSyncing = false;
  }
}

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${CONFIG.ADMIN} ${CONFIG.VERSION}</title>
      <style>
        :root { --neon-g: #00ff41; --neon-p: #bc13fe; --bg: #080808; }
        body { background: var(--bg); color: var(--neon-g); font-family: 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; overflow: hidden; }
        .container { width: 90%; max-width: 480px; background: #121212; border: 1px solid var(--neon-g); border-radius: 20px; padding: 30px; box-shadow: 0 0 30px rgba(0,255,65,0.2); text-align: center; position: relative; }
        .container::before { content: ''; position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; border-radius: 22px; background: linear-gradient(45deg, var(--neon-g), transparent, var(--neon-p)); z-index: -1; opacity: 0.3; }
        h1 { font-size: 1.6rem; color: #fff; text-shadow: 0 0 10px var(--neon-g); margin-bottom: 5px; }
        .tagline { font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px; }
        .btn-group { display: flex; flex-direction: column; gap: 15px; }
        .btn { padding: 18px; border: 1px solid var(--neon-g); color: var(--neon-g); background: transparent; border-radius: 12px; cursor: pointer; text-decoration: none; font-weight: bold; transition: 0.3s; font-size: 0.9rem; }
        .btn:hover { background: var(--neon-g); color: #000; box-shadow: 0 0 20px var(--neon-g); transform: translateY(-2px); }
        .btn span { display: block; font-size: 0.7rem; font-weight: normal; opacity: 0.7; margin-top: 4px; }
        .btn.special { border-color: var(--neon-p); color: var(--neon-p); }
        .btn.special:hover { background: var(--neon-p); color: #fff; box-shadow: 0 0 20px var(--neon-p); }
        .footer { margin-top: 30px; font-size: 0.7rem; color: #333; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${CONFIG.ADMIN} <span style="color:var(--neon-p)">ULTIMATE</span></h1>
        <div class="tagline">System Engine Version ${CONFIG.VERSION}</div>
        <div class="btn-group">
          <a href="/api/dual-engine?provider=railway" class="btn">
            1. RAILWAY CORE ENGINE
            <span>Phân tích NoHu & MD5 bằng thuật toán Code</span>
          </a>
          <a href="/api/dual-engine?provider=grok" class="btn">
            2. GROK AI MASTER
            <span>Phân tích NoHu & MD5 bằng trí tuệ nhân tạo</span>
          </a>
          <a href="/api/dual-engine?provider=hybrid" class="btn special">
            3. HYBRID CONSENSUS (VIP)
            <span>Kết hợp Code + AI để tối ưu độ nhất quán</span>
          </a>
        </div>
        <div class="footer">ADMIN: ${CONFIG.ADMIN} | STATUS: ONLINE</div>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
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
        const confA = parseFloat(a.conf) || 0;
        const confG = parseFloat(g.tin_cay) || 0;
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
        rate: state.stats.total > 0 ? `${((state.stats.win / state.stats.total) * 100).toFixed(1)}%` : '0%'
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

app.listen(PORT, () => {
  console.log(`🚀 ${CONFIG.ADMIN} ${CONFIG.VERSION} ONLINE PORT ${PORT}`);
  runSync();
  setInterval(runSync, CONFIG.SYNC_MS);
});