require('dotenv').config({ path: 'backend/.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello, what is 2+2?");
        console.log("Success:", result.response.text());
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
