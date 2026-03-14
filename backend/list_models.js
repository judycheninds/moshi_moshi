const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    const key = 'AIzaSyCoWowKRRsO8RpO7WQ4EnVoX7NICWdSnjE';
    try {
        const genAI = new GoogleGenerativeAI(key);
        // This is a direct fetch for models
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        console.log('Available Models:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

listModels();
