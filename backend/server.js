require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilio = require('twilio');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
// Must parse urlencoded forms for Twilio webhooks
app.use(express.urlencoded({ extended: true }));

// Serve the frontend web files directly from this server to bypass Vercel
app.use(express.static(path.join(__dirname, '../')));

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Active Call State Storage (in-memory for demo purposes)
const activeCalls = new Map();

// Initialize Twilio conditionally (prevents crashing if not set up yet)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}
const publicUrl = process.env.PUBLIC_URL || '';

// ==========================================
// 1. FRONTEND SIMULATION ROUTE
// ==========================================
app.post('/api/simulate-call', async (req, res) => {
    // Keep the existing simulation code for the UI
    const { phone, date, time, people } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (speaker, text, englishTranslation, status, delay = 1000) => {
        return new Promise(resolve => {
            setTimeout(() => {
                res.write(`data: ${JSON.stringify({ speaker, text, english: englishTranslation, status })}\n\n`);
                resolve();
            }, delay);
        });
    };

    try {
        await sendLog('system', `Dialing ${phone}...`, '', 'Ringing...', 1000);
        await sendLog('system', 'Connection established.', '', 'Connected', 2000);

        const prompt = `
You are the brain of Moshi Moshi AI, an autonomous Japanese restaurant reservation agent.
I need you to generate a realistic, dynamic transcript of a phone call. 
The AI is trying to book a table for ${people} people on ${date} at ${time}.
The restaurant host is a polite Japanese speaker (using Keigo).
The AI should also speak fluent Japanese.

Output MUST be a JSON array of objects, with each object following this EXACT format. Do not return markdown, just the raw array:
[
  { "speaker": "restaurant", "text": "はい、黒猫レストランです。", "english": "Yes, Kuroneko Restaurant." },
  { "speaker": "agent", "text": "もしもし、予約をお願いしたいのですが。", "english": "Hello, I'd like to make a reservation." }
]
Make the dialog realistic (about 6-8 turns total), confirm the date/time/pax, and agree to a credit card deposit hold. End the dialog with the restaurant saying "Thank you, we'll see you then."
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        let textResult = result.response.text().trim();

        if (textResult.startsWith('\`\`\`')) {
            textResult = textResult.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        }

        const dialogSteps = JSON.parse(textResult);

        for (const step of dialogSteps) {
            let status = step.speaker === 'agent' ? 'Speaking...' : 'Listening...';
            let logMsg = step.speaker === 'system' ? step.text : `"${step.text}" (${step.english})`;
            await sendLog(step.speaker, logMsg, step.english, status, 2500);
        }

        await sendLog('system', 'Call disconnected.', '', 'Call Ended', 1500);
        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('Error with Gemini:', error);
        res.write(`data: ${JSON.stringify({ error: true, message: 'Failed to generate dialogue via Gemini AI.' })}\n\n`);
        res.end();
    }
});

// ==========================================
// 2. REAL TWILIO + GEMINI PHONE PIPELINE
// ==========================================

// Route called by Frontend to trigger a REAL out-bound call
app.post('/api/real-call', async (req, res) => {
    const { phone, date, time, people, language, userName, userPhone } = req.body;

    if (!process.env.PUBLIC_URL || process.env.PUBLIC_URL.includes('your-ngrok')) {
        return res.status(500).json({ error: 'Please set up an ngrok PUBLIC_URL in .env before making real calls.' });
    }

    try {
        const call = await twilioClient.calls.create({
            url: `${publicUrl}/twilio/voice`, // Twilio will ping this when call connects
            to: phone,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        // Store the goal state of this call ID
        activeCalls.set(call.sid, {
            goal: `Book a table for ${people} people under the name "${userName}" on ${date} at ${time}.`,
            language: language || 'en-US',
            userName: userName || 'User',
            userPhone: userPhone || 'Not provided',
            history: [] // We'll feed this context to Gemini
        });

        res.json({ success: true, callSid: call.sid });
    } catch (err) {
        console.error("Twilio Call Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Twilio calls this when the phone connects
app.post('/twilio/voice', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const callSid = req.body.CallSid;
    const callState = activeCalls.get(callSid);
    const targetLang = callState ? callState.language : 'en-US';

    // The initial thing the AI says to start the conversation
    let greeting = "Hello, I would like to make a reservation.";
    if (targetLang.startsWith('ja')) greeting = "もしもし、予約をお願いしたいのですが。";
    if (targetLang.startsWith('zh')) greeting = "你好，我想要預訂位子。";

    // Save to history
    if (callState) {
        callState.history.push({ role: 'user', content: greeting }); // AI plays "user" role to the model
    }

    // Use Twilio's neural voice mapped to local language
    twiml.say({ language: targetLang }, greeting);

    // Now actively listen and wait for the restaurant to answer
    const gather = twiml.gather({
        input: 'speech',
        language: targetLang,
        action: publicUrl + '/twilio/gather-result',
        speechTimeout: 'auto', // Wait until they stop talking
        timeout: 10
    });

    res.type('text/xml');
    res.send(twiml.toString());
});

// Twilio calls this when the restaurant host finishes saying something (Speech-To-Text result)
app.post('/twilio/gather-result', async (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const callSid = req.body.CallSid;
    const transcribedText = req.body.SpeechResult; // What the restaurant just said!

    const callState = activeCalls.get(callSid);
    const targetLang = callState ? callState.language : 'en-US';

    if (transcribedText && callState) {
        console.log(`[Restaurant] ${transcribedText}`);
        callState.history.push({ role: 'model', content: transcribedText }); // The restaurant is playing the "prompt"

        // Build the prompt for Gemini to decide what the AI should say next
        const prompt = `
            You are a super helpful AI assistant acting on a telephone on behalf of your user. You are speaking to a restaurant staff member.
            
            [OBJECTIVE]
            ${callState.goal}
            
            [CONVERSATION HISTORY]
            ${callState.history.map(m => '[' + m.role + ']: ' + m.content).join('\n')}
            
            [CURRENT SITUATION]
            The restaurant just said: "${transcribedText}"
            
            [INSTRUCTIONS]
            1. Directly answer their question or statement using the information in your [OBJECTIVE] (which contains the required date, time, name and number of people). Be explicit and helpful.
            2. Be conversational and natural, like a real person calling. Do not use robotic phrasing. 
            3. If they ask for your name (who the reservation is for), state loudly and clearly that the reservation is for "${callState.userName}".
            4. If they ask for a phone number, tell them they can reach you at: "${callState.userPhone}".
            5. Respond with ONLY the exact, raw text you want to say back on the phone to continue the booking.
            6. CRITICAL: Speak exclusively in the language corresponding to the BCP-47 code: '${targetLang}'.
            7. DO NOT output translations. DO NOT use quotes, emojis, markdown, or punctuation not native to the language. ONLY OUTPUT RAW TEXT so the Text-To-Speech engine reads it cleanly!
        `;

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const aiResponse = await model.generateContent(prompt);
            const responseText = aiResponse.response.text().trim();

            console.log(`[AI Agent] ${responseText}`);
            callState.history.push({ role: 'user', content: responseText });

            // Speak Gemini's answer, then go back to listening
            twiml.say({ language: targetLang }, responseText);
            twiml.gather({
                input: 'speech',
                language: targetLang,
                action: publicUrl + '/twilio/gather-result',
                speechTimeout: 'auto',
                timeout: 10
            });
        } catch (e) {
            console.error("Gemini failed:", e);
            let errMsg = "I'm sorry, please say that again.";
            if (targetLang.startsWith('ja')) errMsg = "すみません、もう一度お願いします。";
            if (targetLang.startsWith('zh')) errMsg = "不好意思，可以請您再說一次嗎？";
            twiml.say({ language: targetLang }, errMsg);

            // CRITICAL: We must re-initiate the gather block even if Gemini fails! 
            // If we don't, Twilio hits the end of the instructions and drops the call.
            twiml.gather({
                input: 'speech',
                language: targetLang,
                action: publicUrl + '/twilio/gather-result',
                speechTimeout: 'auto',
                timeout: 10
            });
        }
    } else {
        // If the gather timed out or got nothing, just end the call gracefully
        let hangupMsg = "I will call back later. Goodbye.";
        if (targetLang.startsWith('ja')) hangupMsg = "また後でかけ直します。失礼します。";
        if (targetLang.startsWith('zh')) hangupMsg = "我晚點再打來。再見。";
        twiml.say({ language: targetLang }, hangupMsg);
        twiml.hangup();
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

// ==========================================
// 3. SMS CONFIRMATION
// ==========================================
app.post('/api/send-sms', async (req, res) => {
    const { userName, userPhone, date, time, people } = req.body;

    if (!twilioClient) {
        return res.status(500).json({ error: 'Twilio Client not initialized.' });
    }

    try {
        await twilioClient.messages.create({
            body: `Moshi Moshi ${userName}! 🍱 Your table for ${people} on ${date} at ${time} is officially confirmed!`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: userPhone
        });
        res.json({ success: true });
    } catch (err) {
        console.error("SMS Error:", err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend is running on http://0.0.0.0:${PORT}`);
});
