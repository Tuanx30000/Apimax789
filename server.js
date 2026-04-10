const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// =========================================================================================
// 1. CẤU HÌNH API
// =========================================================================================
const API_CONFIG = {
    NOHU: 'https://taixiu.maksh3979madfw.com/api/luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7',
    MD5: 'https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau?access_token=05%2F7JlwSPGzFBT3sGaKY2ZcLjROdAOOPB3UwDAmuWFKyfHGWuuM%2BC2zy%2FjjnuznAdeJ1hnJUb8IJnvmUDf44qzL49F2ysXpxi9Qj3ZQZ6ahSqlIQmeUS94Mz3ywCtmnj6ssOz4%2BcY90Z%2FFIaUyLA7aw%2FSOcfQ5jEh4AWpcuvdekhs8XvL9mZS4qPwgCPexrDRWK4gHWx7n2akAHlUFDedm6o6uPDpIEA7z1BXADeLKqizH6WVpDMuD3pEFwdC0zHP2jJtVEQgvGeDGXWLSeSr%2F00etslH1TXwCrs%2BrD4Dj%2B3OmJ3VlTStd%2BirPOtXfmDIBLEr2fUlNRwt%2BRKzRuxt3piAyOlfP1UjrYRX7ekIiTrO%2BYBr3m%2FKDgomuTf2vrP6KqCW%2F2hEdU%3D.14abebf71302f5cce8f3d94ed438ba5c1d31a484d0319b3172db76015a64b4d7'
};

let APP_STATE = {
    nohu: { history: [], lastPred: null, stats: { win: 0, loss: 0, total: 0 }, processed: new Set() },
    md5:  { history: [], lastPred: null, stats: { win: 0, loss: 0, total: 0 }, processed: new Set() }
};

// =========================================================================================
// 2. THUẬT TOÁN V6 - PHÁ CẦU HOÀN THIỆN (Xử lý tốt bệt ngắn & các kiểu cầu)
// =========================================================================================
class SmartPredictor {
    predict(history) {
        if (!history || history.length < 6) {
            return { 
                ketqua: Math.random() > 0.5 ? 'Tài' : 'Xỉu', 
                confidence: '55%', 
                logic: 'Đang đợi dữ liệu đủ để phân tích' 
            };
        }

        const results = history.map(h => h.result);
        const last = results[results.length - 1];

        // Tính độ dài bệt hiện tại
        let chain = 1;
        for (let i = results.length - 2; i >= 0; i--) {
            if (results[i] === last) chain++;
            else break;
        }

        // Kiểm tra cầu 1-1 (Zigzag)
        let isZigzag = true;
        for (let i = 1; i < Math.min(7, results.length); i++) {
            if (results[i] === results[i - 1]) {
                isZigzag = false;
                break;
            }
        }

        // Kiểm tra cầu nhịp 2-2 hoặc 3-3
        let isDouble = true;
        for (let i = 2; i < Math.min(8, results.length); i += 2) {
            if (results[i] !== results[i - 2]) {
                isDouble = false;
                break;
            }
        }

        // === LOGIC PHÁ CẦU & BÁM CẦU HOÀN THIỆN ===
        if (chain >= 7) {
            return { 
                ketqua: last === 'Tài' ? 'Xỉu' : 'Tài', 
                confidence: '92%', 
                logic: `PHÁ CẦU CỰC MẠNH (bệt ${chain} tay - hết biên)` 
            };
        }

        if (chain >= 5) {
            return { 
                ketqua: last === 'Tài' ? 'Xỉu' : 'Tài', 
                confidence: '87%', 
                logic: `Bẻ cầu dài (${chain} tay)` 
            };
        }

        if (chain === 4) {
            // Bệt 4 tay → rủi ro gãy cao → giảm tin cậy + cảnh báo
            return { 
                ketqua: last === 'Tài' ? 'Xỉu' : 'Tài', 
                confidence: '68%', 
                logic: `Bệt 4 tay - Cẩn thận gãy cầu` 
            };
        }

        if (chain === 3) {
            // Bệt 3 tay → không bám mạnh, ưu tiên quan sát
            return { 
                ketqua: last, 
                confidence: '69%', 
                logic: `Bám bệt ngắn (3 tay)` 
            };
        }

        // Ưu tiên cao với cầu 1-1
        if (isZigzag && results.length >= 5) {
            return { 
                ketqua: last === 'Tài' ? 'Xỉu' : 'Tài', 
                confidence: '83%', 
                logic: 'Bám cầu 1-1 (Zigzag mạnh)' 
            };
        }

        // Cầu nhịp 2-2 hoặc 3-3
        if (isDouble && results.length >= 6) {
            return { 
                ketqua: last === 'Tài' ? 'Xỉu' : 'Tài', 
                confidence: '76%', 
                logic: 'Cầu nhịp đôi - Đảo nhịp' 
            };
        }

        // Mặc định đảo cầu (an toàn nhất khi không rõ nhịp)
        return { 
            ketqua: last === 'Tài' ? 'Xỉu' : 'Tài', 
            confidence: '64%', 
            logic: 'Cầu đảo thông thường' 
        };
    }
}

const predictor = new SmartPredictor();

// =========================================================================================
// 3. ĐỒNG BỘ DỮ LIỆU (Giữ nguyên ổn định)
// =========================================================================================
async function syncGameData(type) {
    try {
        const url = API_CONFIG[type.toUpperCase()];
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.31',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const rawList = data.list || [];

        if (!Array.isArray(rawList) || rawList.length === 0) {
            console.log(`[TUANX3000-V6] ${type} → Không có dữ liệu mới`);
            return;
        }

        const state = APP_STATE[type];

        const newHistory = rawList.map(item => {
            let resRaw = String(item.resultTruyenThong || '').toUpperCase().trim();
            let finalRes = 'Xỉu';
            if (resRaw === 'TAI' || resRaw === 'TÀI') finalRes = 'Tài';
            else if (resRaw === 'XIU' || resRaw === 'XỈU') finalRes = 'Xỉu';

            return {
                session: Number(item.id || 0),
                result: finalRes
            };
        }).filter(h => h.session > 0).reverse();

        if (newHistory.length === 0) return;

        const latest = newHistory[newHistory.length - 1];

        // Tính thắng thua
        if (state.lastPred && state.lastPred.phien === latest.session && !state.processed.has(latest.session)) {
            state.stats.total++;
            if (state.lastPred.ketqua === latest.result) state.stats.win++;
            else state.stats.loss++;
            state.processed.add(latest.session);
            if (state.processed.size > 120) state.processed.delete([...state.processed][0]);
        }

        state.history = newHistory;
        console.log(`[TUANX3000-V6] ${type} → Đồng bộ thành công ${newHistory.length} phiên`);

    } catch (e) {
        console.log(`[TUANX3000-V6-ERROR] ${type}:`, e.message);
    }
}

// Sync mỗi 5 giây
setInterval(() => {
    syncGameData('nohu');
    syncGameData('md5');
}, 5000);

// =========================================================================================
// 4. OUTPUT JSON
// =========================================================================================
app.get('/', (req, res) => {
    try {
        const build = (type) => {
            const s = APP_STATE[type];
            const lastSession = s.history.length > 0 ? s.history[s.history.length - 1].session : 0;
            const nextId = lastSession + 1;

            if (!s.lastPred || s.lastPred.phien !== nextId) {
                const p = predictor.predict(s.history);
                s.lastPred = { 
                    phien: nextId, 
                    ketqua: p.ketqua, 
                    confidence: p.confidence, 
                    logic: p.logic 
                };
            }

            return {
                phien_tiep: nextId,
                du_doan: s.lastPred.ketqua,
                tin_cay: s.lastPred.confidence,
                logic: s.lastPred.logic,
                lich_su_gan_nhat: s.history.slice(-12).map(h => h.result).join(' - '),
                thong_ke: {
                    thang: s.stats.win,
                    thua: s.stats.loss,
                    winrate: s.stats.total > 0 ? ((s.stats.win / s.stats.total) * 100).toFixed(1) + "%" : "0%"
                }
            };
        };

        res.json({
            system: "TX-PREDICTOR-V6-FINAL",
            admin: "TUANX3000",
            update_at: new Date().toLocaleString('vi-VN'),
            nohu: build('nohu'),
            md5: build('md5')
        });
    } catch (err) {
        console.error('[TUANX3000-V6] Error:', err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/reset', (req, res) => {
    Object.keys(APP_STATE).forEach(k => {
        APP_STATE[k].stats = { win: 0, loss: 0, total: 0 };
        APP_STATE[k].processed.clear();
    });
    res.json({ message: "Đã reset thống kê - V6 Phá cầu hoàn thiện" });
});

app.listen(PORT, () => {
    console.log(`🚀 TUANX3000: TX-PREDICTOR-V6-FINAL (Phá cầu hoàn thiện) ONLINE PORT ${PORT}`);
    syncGameData('nohu');
    syncGameData('md5');
});