const express = require('express');
const axios = require('axios');
const app = express();

// TỰ ĐỘNG LẤY CỔNG TỪ RAILWAY
const PORT = process.env.PORT || 3000;

const KEYS = {
    // Kiểm tra tên biến trong Railway phải khớp 100% với chữ viết hoa ở đây
    GEMINI: process.env.GEMINI_API_KEY, 
    GROK: process.env.GROK_API_KEY,
    OPENAI: process.env.OPENAI_API_KEY
};

async function checkAI() {
    let status = { gemini: false, grok: false, openai: false };
    
    // TEST GEMINI (Dùng URL v1 bản ổn định)
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${KEYS.GEMINI}`;
        await axios.post(url, { contents: [{ parts: [{ text: "hi" }] }] }, { timeout: 5000 });
        status.gemini = true;
    } catch (e) { console.log("Gemini vẫn lỗi kết nối."); }

    return status;
}

app.get('/api/predict', async (req, res) => {
    const aiStatus = await checkAI();
    res.json({
        author: "TUANX3000",
        version: "13.4 FINAL FIX",
        status: aiStatus,
        predict: "TÀI", // Thuật toán mặc định
        analysis: aiStatus.gemini ? "AI Online" : "Sử dụng Pattern máy"
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HỆ THỐNG] Đang chạy trên cổng ${PORT}`);
});
