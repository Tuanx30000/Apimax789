const express = require('express');
const axios = require('axios');
const app = express();

const CONFIG = {
    AUTHOR: "TUANX3000",
    VERSION: "13.0 HYBRID AI + ALGO",
    PORT: process.env.PORT || 3000,
    MODELS: {
        GROK: "grok-2-1212",
        OPENAI: "gpt-4o-mini",
        GEMINI: "gemini-1.5-flash"
    },
    KEYS: {
        GROK: process.env.GROK_API_KEY || "",
        OPENAI: process.env.OPENAI_API_KEY || "",
        GEMINI: process.env.GEMINI_API_KEY || ""
    }
};

// --- PHẦN 1: THUẬT TOÁN TOÁN HỌC (PATTERN SCANNER) ---
function analyzePattern(history) {
    // Giả lập dữ liệu nếu không lấy được API nguồn
    const data = history || ["TÀI", "XỈU", "TÀI", "TÀI", "XỈU"];
    const last = data[data.length - 1];
    const secondLast = data[data.length - 2];

    let algoPredict = "";
    let reason = "";

    // Thuật toán 1: Đánh bệt (Streak)
    if (last === secondLast) {
        algoPredict = last;
        reason = "Pattern: Streak (Bệt)";
    } 
    // Thuật toán 2: Đánh bẻ (Counter-Trend)
    else {
        algoPredict = last === "TÀI" ? "XỈU" : "TÀI";
        reason = "Pattern: Alternating (Cầu 1-1)";
    }

    return { predict: algoPredict, analysis: reason, confidence: 70 };
}

// --- PHẦN 2: TRÍ TUỆ NHÂN TẠO (AI VOTING) ---
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
            return JSON.parse(res.data.choices[0].message.content.match(/\{.*\}/s)[0]);
        }

        if (provider === 'GEMINI') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODELS.GEMINI}:generateContent?key=${CONFIG.KEYS.GEMINI}`;
            const res = await axios.post(url, {
                contents: [{ parts: [{ text: prompt + " (Return JSON: {prediction: 'TÀI', confidence: 80})" }] }]
            }, { timeout });
            return JSON.parse(res.data.candidates[0].content.parts[0].text.match(/\{.*\}/s)[0]);
        }
    } catch (e) {
        console.log(`[LOG] ${provider} skipped due to error.`);
        return null;
    }
}

// --- PHẦN 3: KẾT HỢP (HYBRID ENGINE) ---
app.get('/api/predict', async (req, res) => {
    const historyData = ["TÀI", "TÀI", "XỈU"]; // Giả định data từ API game
    const prompt = `Dữ liệu cầu: ${historyData.join(', ')}. Dự đoán phiên kế tiếp {prediction: 'TÀI' hoặc 'XỈU', confidence: 85}`;

    // Chạy song song cả Thuật toán và 3 AI
    const [algoResult, ...aiResults] = await Promise.all([
        analyzePattern(historyData),
        callAI('OPENAI', prompt),
        callAI('GROK', prompt),
        callAI('GEMINI', prompt)
    ]);

    // Lọc các AI chạy thành công
    const validAI = aiResults.filter(r => r !== null);
    
    let finalPredict = "";
    let finalAnalysis = "";
    let finalConf = 0;

    if (validAI.length > 0) {
        // Ưu tiên AI nếu AI Online
        const taiVotes = validAI.filter(v => v.prediction === "TÀI").length;
        const xiuVotes = validAI.filter(v => v.prediction === "XỈU").length;
        
        finalPredict = taiVotes >= xiuVotes ? "TÀI" : "XỈU";
        finalAnalysis = `AI Voting (${taiVotes} vs ${xiuVotes}) + ${algoResult.analysis}`;
        finalConf = Math.floor((taiVotes / validAI.length) * 100);
    } else {
        // Dùng 100% thuật toán nếu AI Offline
        finalPredict = algoResult.predict;
        finalAnalysis = `AI Offline - Using ${algoResult.analysis}`;
        finalConf = algoResult.confidence;
    }

    res.json({
        author: CONFIG.AUTHOR,
        version: CONFIG.VERSION,
        server_time: new Date().toLocaleString(),
        results: {
            predict: finalPredict,
            confidence: finalConf + "%",
            analysis: finalAnalysis,
            ai_status: {
                openai: !!aiResults[0],
                grok: !!aiResults[1],
                gemini: !!aiResults[2]
            }
        }
    });
});

// Giao diện Cyber-Tech
app.get('/', (req, res) => {
    res.send(`
    <html>
    <body style="background:#000; color:#0f0; font-family:monospace; text-align:center; padding-top:50px;">
        <h1 style="text-shadow:0 0 10px #0f0;">TUANX3000 HYBRID V13</h1>
        <div id="out" style="border:1px solid #0f0; display:inline-block; padding:20px; border-radius:10px;">
            Scanning Systems...
        </div>
        <script>
            async function load() {
                const r = await fetch('/api/predict');
                const d = await r.json();
                document.getElementById('out').innerHTML = \`
                    <h2 style="color:#ff0055">\${d.results.predict}</h2>
                    <p>CONFIDENCE: \${d.results.confidence}</p>
                    <p style="font-size:12px; color:#aaa">\${d.results.analysis}</p>
                    <hr/>
                    <div style="font-size:10px;">
                        GPT: \${d.results.ai_status.openai ? '✅' : '❌'} | 
                        GROK: \${d.results.ai_status.grok ? '✅' : '❌'} | 
                        GEMINI: \${d.results.ai_status.gemini ? '✅' : '❌'}
                    </div>
                \`;
            }
            setInterval(load, 5000); load();
        </script>
    </body>
    </html>
    `);
});

app.listen(CONFIG.PORT, () => console.log('System V13 Online'));
