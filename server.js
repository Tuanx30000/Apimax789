'use strict';

/**
 * TUANX3000 ULTIMATE V11.4 FINAL FIXED - SINGLE FILE
 * - Fix Grok AI luôn fallback 50%
 * - Model cập nhật 2026 + fallback model
 * - Parse JSON mạnh hơn
 * - Log lỗi chi tiết
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
  VERSION: '11.4 FINAL FIXED',
  SYNC_MS: 3000,
  FETCH_TIMEOUT_MS: 8000,                    // Tăng nhẹ timeout
  GROK_MODEL_PRIMARY: 'grok-4.20-non-reasoning',   // Model nhanh & ổn định hơn
  GROK_MODEL_FALLBACK: 'grok-4.20-reasoning',

  ENDPOINTS: {
    NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
    MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
  },

  GROK_API_KEY: (process.env.GROK_API_KEY || '').trim()
};

if (!CONFIG.GROK_API_KEY) {
  console.warn('⚠️ GROK_API_KEY CHƯA ĐƯỢC SET trong Railway Variables!');
  console.warn('   → Grok AI sẽ luôn fallback về 50%. Hãy thêm key ngay!');
}

// ================== FETCH & DATA ==================
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

// ================== UTILS (giữ nguyên) ==================
function escapeHtml(value) {
  return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

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
  return Array.from(map.values()).sort((a,b)=>a.session-b.session).slice(-200);
}

function formatRate(win, total) {
  return total ? `${((win / total) * 100).toFixed(1)}%` : '0%';
}

async function fetchJsonWithTimeout(url, timeoutMs = CONFIG.FETCH_TIMEOUT_MS) {
  if (!url || url.includes('PASTE_')) throw new Error('Missing endpoint');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

// ================== RAILWAY CORE (giữ nguyên) ==================
const Algos = {
  railwayCore(mode) {
    const h = DATA_STORE[mode].history;
    if (h.length < 10) return { res: 'N/A', conf: '0%', log: 'Đang nạp dữ liệu...' };
    // ... (giữ nguyên phần logic pattern như bản cũ)
    const last6 = h.slice(-6).map(x => (x.result === 'Tài' ? 'T' : 'X')).join('');
    const patterns = { TTTTTT: 'X', XXXXXX: 'T', TXTXTX: 'T', XTXTXT: 'X', TTXXTT: 'X', XXTTXX: 'T', TTTXXX: 'T', XXXTTT: 'X' };
    if (patterns[last6]) return { res: patterns[last6]==='T'?'Tài':'Xỉu', conf:'92%', log:`Pattern: ${last6}` };
    const countT = h.slice(-20).filter(x => x.result==='Tài').length;
    if (countT >= 13) return { res: 'Xỉu', conf: '84%', log: 'High Frequency Reset' };
    if (countT <= 7) return { res: 'Tài', conf: '84%', log: 'Low Frequency Reset' };
    return { res: h[h.length-1].result==='Tài'?'Xỉu':'Tài', conf:'70%', log:'Counter-Trend' };
  }
};

// ================== GROK AI - ĐÃ FIX ==================
async function callGrok(mode) {
  if (!CONFIG.GROK_API_KEY) {
    return { du_doan: 'XỈU', tin_cay: '50%', phan_tich: 'GROK_API_KEY chưa được thiết lập' };
  }

  const sequence = DATA_STORE[mode].history.slice(-15).map(x => x.result).join(' → ');
  const modelsToTry = [CONFIG.GROK_MODEL_PRIMARY, CONFIG.GROK_MODEL_FALLBACK];

  for (const model of modelsToTry) {
    try {
      console.log(`[Grok] Trying model: ${model} for ${mode}`);

      const response = await fetchFn('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CONFIG.GROK_API_KEY}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'You are an expert gambling analyst. Always reply with valid JSON only, no extra text.' },
            { role: 'user', content: `History ${mode.toUpperCase()}: ${sequence}\nPredict next (TÀI or XỈU). Return ONLY this JSON format:\n{"du_doan":"TÀI","tin_cay":"85%","phan_tich":"short reason"}` }
          ],
          temperature: 0.3,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(()=> '');
        throw new Error(`HTTP ${response.status} - ${errText}`);
      }

      const data = await response.json();
      let content = data?.choices?.[0]?.message?.content || '';

      // Cải thiện parse: bỏ markdown, lấy block JSON
      content = content.replace(/```json|```/g, '').trim();
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON block found');

      const parsed = JSON.parse(match[0]);

      console.log(`[Grok Success] ${mode} with ${model}`);
      return {
        du_doan: normalizePrediction(parsed.du_doan),
        tin_cay: parsed.tin_cay || '75%',
        phan_tich: parsed.phan_tich || 'AI analysis'
      };

    } catch (err) {
      console.error(`[Grok Fail] Model ${model} - ${mode}:`, err.message);
    }
  }

  // Nếu cả 2 model đều fail
  return { du_doan: 'XỈU', tin_cay: '50%', phan_tich: 'Grok API Error → Fallback (check key & model)' };
}

// ================== SYNC & ROUTES (giữ nguyên phần còn lại) ==================
async function runSync() { /* giữ nguyên như bản V11.3 */ 
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
        const incoming = list.map(item => ({
          session: toNumber(item.id ?? item.SessionId ?? item.session),
          result: standardizeResult(item)
        })).filter(i => i.session > 0);

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
      } catch (e) {
        state.lastError = e.message;
        console.error(`Sync ${key} error:`, e.message);
      }
    }
  } finally { isSyncing = false; }
}

// Global error
process.on('unhandledRejection', r => console.error('Unhandled:', r));
process.on('uncaughtException', e => console.error('Exception:', e));

// UI & API routes giữ nguyên như bản trước (để ngắn gọn, bạn copy phần này từ bản V11.3)

// ================== START SERVER ==================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ${CONFIG.ADMIN} ${CONFIG.VERSION} ONLINE tại port ${PORT}`);
  setTimeout(() => {
    runSync();
    setInterval(runSync, CONFIG.SYNC_MS);
  }, 2000);
});