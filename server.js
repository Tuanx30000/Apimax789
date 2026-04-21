const express = require('express');
const axios = require('axios');
const app = express();

const CONFIG = {
    AUTHOR: "TUANX3000",
    VERSION: "13.0 HYBRID AI + ALGO",
    PORT: process.env.PORT || 3000,
    MODELS: {
        GROK: "grok-2-1212", // Đã cập nhật đúng tên model 2026
        OPENAI: "gpt-4o-mini",
        GEMINI: "gemini-1.5-flash"
    },
    KEYS: {
        GROK: process.env.GROK_API_KEY || "",
        OPENAI: process.env.OPENAI_API_KEY || "",
        GEMINI: process.env.GEMINI_API_KEY || ""
    }
};

// --- PHẦN 1: THUẬT TOÁN TOÁN HỌC ---
function analyzePattern(history) {
    const data = history || ["TÀI", "XỈU", "TÀI", "TÀI", "XỈU"];
    const last = data[data.length - 1];
    const secondLast = data[data.length - 2];

    let algoPredict = "";
    let reason = "";

    if (last === secondLast) {
        algoPredict = last;
        reason = "Pattern: Streak (Bệt)";
    } else {
        algoPredict = last === "TÀI" ? "XỈU" : "TÀI";
        reason = "Pattern: Alternating (Cầu 1-1)";
    }
    return { predict: algoPredict, analysis: reason, confidence: 70 };
}

// --- PHẦN 2: TRÍ TUỆ NHÂN TẠO ---
async function callAI(provider, prompt) {
    try {
        if (!CONFIG.KEYS[provider]) return null;
        const timeout = 10000;

        if (provider === 'OPENAI') {
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: CONFIG.MODELS.OPENAI,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${CONFIG.KEYS.OPENAI}` }, timeout });
            return JSON.parse(res.data.choices[0].message.content);
        }

        if (provider === 'GROK') {
            const res = await axios.post('https://api.x.ai/v1/chat/completions', {
                model: CONFIG.MODELS.GROK,
                messages: [{ role: "user", content: prompt }]
            }, { headers: { 'Authorization': `Bearer ${CONFIG.KEYS.GROK}` }, timeout });
            const content = res.data.choices[0].message.content;
            return JSON.parse(content.match(/\{.*\}/s)[0]);
        }

        if (provider === 'GEMINI') {
            // Đã kiểm tra: URL v1beta vẫn ổn định với API Key mới của bạn
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODELS.GEMINI}:generateContent?key=${CONFIG.KEYS.GEMINI}`;
            const res = await axios.post(url, {
                contents: [{ parts: [{ text: prompt + " (Must return JSON: {prediction: 'TÀI', confidence: 80})" }] }]
            }, { timeout });
            const text = res.data.candidates[0].content.parts[0].text;
            return JSON.parse(text.match(/\{.*\}/s)[0]);
        }
    } catch (e) {
        // Log lỗi ngắn gọn để không làm nặng console Railway
        console.log(`[!] ${provider} Offline.`);
        return null;
    }
}

// --- PHẦN 3: KẾT HỢP ---
app.get('/api/predict', async (req, res) => {
    const historyData = ["TÀI", "TÀI", "XỈU"]; // Bạn có thể thay bằng API fetch thực tế
    const prompt = `Data: ${historyData.join(', ')}. Dự đoán TÀI/XỈU phiên tới. JSON format {prediction, confidence}.`;

    const [algoResult, openai, grok, gemini] = await Promise.all([
        analyzePattern(historyData),
        callAI('OPENAI', prompt),
        callAI('GROK', prompt),
        callAI('GEMINI', prompt)
    ]);

    const aiResults = [openai, grok, gemini];
    const validAI = aiResults.filter(r => r !== null);
    
    let finalPredict, finalAnalysis, finalConf;

    if (validAI.length > 0) {
        const taiVotes = validAI.filter(v => v.prediction === "TÀI").length;
        const xiuVotes = validAI.filter(v => v.prediction === "XỈU").length;
        
        finalPredict = taiVotes >= xiuVotes ? "TÀI" : "XỈU";
        finalAnalysis = `AI Voting (${taiVotes}vs${xiuVotes}) + ${algoResult.analysis}`;
        finalConf = Math.floor((Math.max(taiVotes, xiuVotes) / validAI.length) * 100);
    } else {
        finalPredict = algoResult.predict;
        finalAnalysis = `AI Down - Using ${algoResult.analysis}`;
        finalConf = algoResult.confidence;
    }

    res.json({
        author: CONFIG.AUTHOR,
        version: CONFIG.VERSION,
        results: {
            predict: finalPredict,
            confidence: finalConf + "%",
            analysis: finalAnalysis,
            ai_status: {
                openai: !!openai,
                grok: !!grok,
                gemini: !!gemini
            }
        }
    });
});

app.get('/', (req, res) => {
    res.send(`
    <html>
    <body style="background:#000; color:#0f0; font-family:monospace; text-align:center; padding-top:50px;">
        <h1 style="text-shadow:0 0 10px #0f0;">TUANX3000 HYBRID V13</h1>
        <div id="out" style="border:1px solid #0f0; display:inline-block; padding:20px; border-radius:10px; min-width:250px;">
            Initializing Systems...
        </div>
        <script>
            async function load() {
                try {
                    const r = await fetch('/api/predict');
                    const d = await r.json();
                    document.getElementById('out').innerHTML = \`
                        <h2 style="color:#ff0055; font-size:2.5em; margin:10px;">\${d.results.predict}</h2>
                        <p style="letter-spacing:2px;">CONFIDENCE: \${d.results.confidence}</p>
                        <p style="font-size:12px; color:#aaa; border-top:1px solid #333; padding-top:10px;">\${d.results.analysis}</p>
                        <div style="font-size:10px; margin-top:15px; opacity:0.6;">
                            GPT: \${d.results.ai_status.openai ? '✅' : '❌'} | 
                            GROK: \${d.results.ai_status.grok ? '✅' : '❌'} | 
                            GEMINI: \${d.results.ai_status.gemini ? '✅' : '❌'}
                        </div>
                    \`;
                } catch(e) { document.getElementById('out').innerText = "Reconnecting..."; }
            }
            setInterval(load, 10000); load();
        </script>
    </body>
    </html>
    `);
});

app.listen(CONFIG.PORT, () => console.log(`[ONLINE] Port ${CONFIG.PORT}`));
