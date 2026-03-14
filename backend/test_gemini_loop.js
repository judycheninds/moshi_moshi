require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
    for (let i=0; i<5; i++) {
        try {
            console.log("Req", i);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const aiResponse = await model.generateContent("Say hello");
            console.log(aiResponse.response.text());
        } catch(e) {
            console.error("Failed:", e.message);
        }
    }
}
test();
