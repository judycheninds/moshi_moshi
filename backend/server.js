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

        const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro" });
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
    const { phone, date, time, people } = req.body;

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
            goal: `Book a table for ${people} people on ${date} at ${time}.`,
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

    // The initial thing the AI says to start the conversation
    const greeting = "もしもし、予約をお願いしたいのですが。"; // "Hello, I'd like to make a reservation."

    // Save to history
    if (activeCalls.has(callSid)) {
        activeCalls.get(callSid).history.push({ role: 'user', content: greeting }); // AI plays "user" role to the model
    }

    // Use Twilio's neural Japanese voice
    twiml.say({ language: 'ja-JP' }, greeting);

    // Now actively listen and wait for the restaurant to answer
    const gather = twiml.gather({
        input: 'speech',
        language: 'ja-JP',
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

    if (transcribedText && callState) {
        console.log(`[Restaurant] ${transcribedText}`);
        callState.history.push({ role: 'model', content: transcribedText }); // The restaurant is playing the "prompt"

        // Build the prompt for Gemini to decide what the AI should say next
        const prompt = `
            You are a super helpful AI assistant acting on a telephone on behalf of your user. You are speaking to a Japanese restaurant staff member.
            Your Goal: ${callState.goal}
            
            Conversation History:
            ${callState.history.map(m => '[' + m.role + ']: ' + m.content).join('\n')}
            
            The restaurant just said: "${transcribedText}"
            
            Respond with ONLY the exact, raw Japanese text you want to say back on the phone to continue the booking. Speak exclusively in natural, polite Japanese (Keigo).
            DO NOT output English translations. DO NOT use quotes, emojis, or punctuation not native to Japanese. ONLY OUTPUT RAW JAPANESE TEXT so the Text-To-Speech engine reads it cleanly!
        `;

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro" });
            const aiResponse = await model.generateContent(prompt);
            const responseText = aiResponse.response.text().trim();

            console.log(`[AI Agent] ${responseText}`);
            callState.history.push({ role: 'user', content: responseText });

            // Speak Gemini's answer, then go back to listening
            twiml.say({ language: 'ja-JP' }, responseText);
            twiml.gather({
                input: 'speech',
                language: 'ja-JP',
                action: publicUrl + '/twilio/gather-result',
                speechTimeout: 'auto',
                timeout: 10
            });
        } catch (e) {
            console.error("Gemini failed:", e);
            twiml.say({ language: 'ja-JP' }, "すみません、もう一度お願いします。"); // Sorry, say again
        }
    } else {
        // If the gather timed out or got nothing, just end the call gracefully
        twiml.say({ language: 'ja-JP' }, "また後でかけ直します。失礼します。"); // Will call back later
        twiml.hangup();
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

// ==========================================
// 3. SMS CONFIRMATION
// ==========================================
app.post('/api/send-sms', async (req, res) => {
    const { userPhone, date, time, people } = req.body;

    if (!twilioClient) {
        return res.status(500).json({ error: 'Twilio Client not initialized.' });
    }

    try {
        await twilioClient.messages.create({
            body: `Moshi Moshi! 🍱 Your table for ${people} on ${date} at ${time} is officially confirmed!`,
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
