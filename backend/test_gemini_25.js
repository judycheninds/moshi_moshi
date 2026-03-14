const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testKey() {
    const key = 'AIzaSyCoWowKRRsO8RpO7WQ4EnVoX7NICWdSnjE';
    try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent("Say 'API Key Works on Gemini 2.5'");
        const response = await result.response;
        console.log('Gemini Response:', response.text());
        console.log('✅ Success: The API key is valid and working on Gemini 2.5.');
    } catch (error) {
        console.error('❌ Error Detail:', error);
    }
}

testKey();
