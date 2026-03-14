const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testKey() {
    const key = 'AIzaSyCoWowKRRsO8RpO7WQ4EnVoX7NICWdSnjE';
    try {
        const genAI = new GoogleGenerativeAI(key);
        // Let's try gemini-1.5-flash-latest which is common
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        const response = await result.response;
        console.log('Gemini Response:', response.text());
        console.log('✅ Success: The API key is valid and working.');
    } catch (error) {
        console.error('❌ Error Detail:', error);
        console.error('Message:', error.message);
    }
}

testKey();
