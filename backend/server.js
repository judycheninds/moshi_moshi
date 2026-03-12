require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilio = require('twilio');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase (persistent DB)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
console.log('✅ Supabase connected:', process.env.SUPABASE_URL);

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
const callLogClients = new Map();

function broadcastLog(callSid, role, content) {
    const clients = callLogClients.get(callSid) || [];
    clients.forEach(res => {
        res.write(`data: ${JSON.stringify({ role, content })}\n\n`);
    });
}

// Initialize Twilio conditionally (prevents crashing if not set up yet)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}
const publicUrl = process.env.PUBLIC_URL || '';

// ==========================================
// AUTH & CRM — Supabase PostgreSQL
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || 'moshi-moshi-secret-2025';

// Auth Middleware
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name are required.' });

    // Check duplicate
    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single();
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const id = `user_${Date.now()}`;
    const { error } = await supabase.from('users').insert({
        id, email: email.toLowerCase(), password_hash: passwordHash, name, phone: phone || ''
    });
    if (error) return res.status(500).json({ error: error.message });

    const token = jwt.sign({ id, email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id, email: email.toLowerCase(), name, phone: phone || '' } });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
    if (error || !user) return res.status(401).json({ error: 'Invalid email or password.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, phone: user.phone } });
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    const { data: user, error } = await supabase.from('users').select('id,email,name,phone,created_at').eq('id', req.user.id).single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

// PATCH /api/auth/profile
app.patch('/api/auth/profile', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    const { data, error } = await supabase.from('users').update(updates).eq('id', req.user.id).select('id,email,name,phone').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, user: data });
});

// GET /api/reservations
app.get('/api/reservations', authMiddleware, async (req, res) => {
    const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    // Map snake_case DB columns back to camelCase for the frontend
    res.json((data || []).map(r => ({
        id: r.id,
        restaurantPhone: r.restaurant_phone,
        date: r.date,
        time: r.time,
        people: r.people,
        guestName: r.guest_name,
        status: r.status,
        createdAt: r.created_at
    })));
});

// Helper to save a completed reservation to Supabase
async function saveReservation(userId, data) {
    if (!userId) return;
    const { error } = await supabase.from('reservations').insert({
        id: `res_${Date.now()}`,
        user_id: userId,
        restaurant_phone: data.restaurantPhone,
        date: data.date,
        time: data.time,
        people: String(data.people),
        guest_name: data.guestName,
        status: data.status || 'confirmed'
    });
    if (error) console.error('❌ Failed to save reservation:', error.message);
    else console.log(`✅ Reservation saved to Supabase for user ${userId}`);
}

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

app.get('/api/call-stream/:callSid', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const callSid = req.params.callSid;
    if (!callLogClients.has(callSid)) {
        callLogClients.set(callSid, []);
    }
    callLogClients.get(callSid).push(res);

    req.on('close', () => {
        const clients = callLogClients.get(callSid) || [];
        callLogClients.set(callSid, clients.filter(c => c !== res));
    });
});

// ==========================================
// 2. REAL TWILIO + GEMINI PHONE PIPELINE
// ==========================================

// Route called by Frontend to trigger a REAL out-bound call
app.post('/api/real-call', async (req, res) => {
    let { phone, date, time, altTime1, altTime2, people, language, userName, userPhone } = req.body;

    // Optionally link this call to a logged-in user
    let userId = null;
    try {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
            userId = decoded.id;
        }
    } catch (e) { /* anonymous call is fine */ }

    // Helper to silently fix non-E164 local phone numbers (like 0912... -> +886912...)
    const formatPhone = (ph, langStr) => {
        if (!ph) return ph;
        let digits = String(ph).replace(/\D/g, ''); // Strip EVERYTHING non-numeric
        if (!digits) return ph;

        if (String(ph).trim().startsWith('+')) {
            return '+' + digits; // Perfectly clean +E164
        }

        const langInfo = langStr ? langStr.toLowerCase() : '';
        const isTaiwan = langInfo.includes('tw') || langInfo.includes('hant') || langInfo === 'zh';
        const defaultCode = isTaiwan ? '886' : '81'; // Default TW or JP

        // If it looks like a US number
        if (digits.startsWith('1') && digits.length === 11) return '+' + digits;
        if (digits.length === 10 && !digits.startsWith('0')) return '+1' + digits;

        // If they already typed 886... without the +
        if (digits.startsWith('886') && digits.length > 10) return '+' + digits;
        if (digits.startsWith('81') && digits.length > 9) return '+' + digits;

        if (digits.startsWith('0')) {
            return `+${defaultCode}${digits.substring(1)}`;
        }
        return `+${defaultCode}${digits}`;
    };

    phone = formatPhone(phone, language || 'en-US');
    userPhone = formatPhone(userPhone, language || 'en-US');

    if (!process.env.PUBLIC_URL || process.env.PUBLIC_URL.includes('your-ngrok')) {
        return res.status(500).json({ error: 'Please set up an ngrok PUBLIC_URL in .env before making real calls.' });
    }

    try {
        const call = await twilioClient.calls.create({
            url: `${publicUrl}/twilio/voice`, // Twilio will ping this when call connects
            statusCallback: `${publicUrl}/twilio/call-status`,
            statusCallbackEvent: ['completed'],
            to: phone,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        let fallbackText = '';
        if (altTime1 || altTime2) {
            fallbackText = ` If ${time} is unavailable, you MUST ask for available fallback times. The user specifically approved ${[altTime1, altTime2].filter(Boolean).join(' or ')} as acceptable alternative times. Attempt to book these if offered.`;
        }

        let friendlyDate = date;
        try {
            const dateObj = new Date(date);
            // Formats to just Month and Day, like "March 14" or "March 8"
            friendlyDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        } catch (e) { }

        // Store the goal state of this call ID
        activeCalls.set(call.sid, {
            goal: `Book a table for ${people} people under the name "${userName}" on ${friendlyDate} at ${time}.${fallbackText} CRITICAL: Never speak the year out loud.`,
            language: language || 'en-US',
            userName: userName || 'User',
            userPhone: userPhone || 'Not provided',
            userId,           // for CRM history linking
            rawDate: date,    // original ISO date
            rawTime: time,
            rawPeople: people,
            restaurantPhone: phone,
            history: []
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

    // Helper to map browser language to explicit Twilio engines
    let sayLang = targetLang;
    let gatherLang = targetLang;
    let twilioVoice = 'alice';

    if (targetLang.toLowerCase().includes('tw') || targetLang.toLowerCase().includes('hant') || targetLang === 'zh') {
        sayLang = 'zh-TW';
        gatherLang = 'cmn-Hant-TW'; // Specific STT for Taiwan
        twilioVoice = 'Google.cmn-TW-Wavenet-A'; // Google Wavenet (best available for TW Mandarin)
    } else if (targetLang.startsWith('zh')) {
        sayLang = 'zh-CN';
        gatherLang = 'cmn-Hans-CN';
        twilioVoice = 'Google.cmn-CN-Neural2-D'; // Google Neural2 Mandarin CN female
    } else if (targetLang.startsWith('ja')) {
        sayLang = 'ja-JP';
        gatherLang = 'ja-JP';
        twilioVoice = 'Google.ja-JP-Neural2-B'; // Google Neural2 Japanese female
    } else {
        sayLang = 'en-US';
        gatherLang = 'en-US';
        twilioVoice = 'Google.en-US-Neural2-F'; // Google Neural2 English female
    }

    // The initial thing the AI says to start the conversation — warm, human, personal
    const name = callState ? callState.userName : 'my friend';
    let greeting = `Hi there! I'm calling on behalf of ${name} to make a dinner reservation. Is this a good time?`;
    if (targetLang.startsWith('ja')) {
        greeting = `もしもし、${name}の代わりにご予約のお電話をさせていただいております。今、少しよろしいでしょうか？`;
    }
    if (targetLang.toLowerCase().includes('tw') || (targetLang.startsWith('zh') && targetLang.toLowerCase().includes('tw'))) {
        greeting = `您好，我是代替 ${name} 打電話來預訂座位的。請問現在方便說話嗎？`;
    } else if (targetLang.startsWith('zh')) {
        greeting = `您好，我是代 ${name} 打电话预订座位的。请问现在方便吗？`;
    }

    // Save to history
    if (callState) {
        callState.history.push({ role: 'user', content: greeting }); // AI plays "user" role to the model
        broadcastLog(callSid, 'agent', greeting);
    }

    // Use Twilio's reliable voice mapped to local language
    twiml.say({ voice: twilioVoice, language: sayLang }, greeting);

    // Now actively listen and wait for the restaurant to answer
    const gather = twiml.gather({
        input: 'speech',
        language: gatherLang,
        action: publicUrl + '/twilio/gather-result',
        speechTimeout: 'auto',
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

    let sayLang = targetLang;
    let gatherLang = targetLang;
    let twilioVoice = 'alice';
    if (targetLang.toLowerCase().includes('tw') || targetLang.toLowerCase().includes('hant') || targetLang === 'zh') {
        sayLang = 'zh-TW';
        gatherLang = 'cmn-Hant-TW';
        twilioVoice = 'Google.cmn-TW-Wavenet-A'; // Google Wavenet (best available for TW Mandarin)
    } else if (targetLang.startsWith('zh')) {
        sayLang = 'zh-CN';
        gatherLang = 'cmn-Hans-CN';
        twilioVoice = 'Google.cmn-CN-Neural2-D'; // Google Neural2 Mandarin CN female
    } else if (targetLang.startsWith('ja')) {
        sayLang = 'ja-JP';
        gatherLang = 'ja-JP';
        twilioVoice = 'Google.ja-JP-Neural2-B'; // Google Neural2 Japanese female
    } else {
        sayLang = 'en-US';
        gatherLang = 'en-US';
        twilioVoice = 'Google.en-US-Neural2-F'; // Google Neural2 English female
    }

    if (transcribedText && callState) {
        console.log(`[Restaurant] ${transcribedText}`);
        callState.history.push({ role: 'model', content: transcribedText }); // The restaurant is playing the "prompt"
        broadcastLog(callSid, 'restaurant', transcribedText);

        // Build the prompt for Gemini to decide what the AI should say next
        const prompt = `
            You are a warm, friendly personal assistant making a phone call on behalf of your user, ${callState.userName}.
            You are NOT a robot or AI — you speak naturally, like a real human assistant would on the phone.

            [YOUR TASK]
            ${callState.goal}

            [CONVERSATION SO FAR]
            ${callState.history.map(m => '[' + (m.role === 'user' ? 'You' : 'Restaurant') + ']: ' + m.content).join('\n')}

            [THE RESTAURANT JUST SAID]
            "${transcribedText}"

            [HOW TO RESPOND — READ CAREFULLY]
            1. Respond warmly and naturally, exactly as a real human assistant would on the phone. You are calling on behalf of ${callState.userName}.
            2. Use natural conversational phrases. It's totally fine to say things like "Of course!", "Sure thing!", "Oh wonderful!", "Let me check...", "That sounds perfect!", "Great, thank you so much!" — but only when it fits naturally.
            3. When confirming the reservation details (date, time, party size, name), do it clearly but warmly. For example: "It would be for ${callState.userName}, party of X, on [date] at [time]."
            4. If they ask for a contact name, say the reservation is under the name "${callState.userName}".
            5. If they ask for a callback number, give them: "${callState.userPhone}".
            6. If the requested time is unavailable, stay calm and politely ask what other times are available, or suggest the fallback times from the objective.
            7. Once the reservation is fully confirmed, warmly thank them and say a natural goodbye.
            8. CRITICAL: Output ONLY the raw spoken text — no quotes, no stage directions, no emojis, no markdown. Just the words to speak.
            9. CRITICAL: Speak exclusively in the language for BCP-47 code: '${targetLang}'. Do NOT mix languages or include translations.
            10. Keep your response concise — this is a phone call, not an essay. Speak naturally and don't ramble.
        `;

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const aiResponse = await model.generateContent(prompt);
            const responseText = aiResponse.response.text().trim();

            console.log(`[AI Agent] ${responseText}`);
            callState.history.push({ role: 'user', content: responseText });
            broadcastLog(callSid, 'agent', responseText);

            twiml.say({ voice: twilioVoice, language: sayLang }, responseText);
            twiml.gather({
                input: 'speech',
                language: gatherLang,
                action: publicUrl + '/twilio/gather-result',
                speechTimeout: 'auto',
                timeout: 10
            });
        } catch (e) {
            console.error("Gemini failed:", e);
            let errMsg = "I'm sorry, please say that again.";
            if (targetLang.startsWith('ja')) errMsg = "すみません、もう一度お願いします。";
            if (targetLang.startsWith('zh')) errMsg = "不好意思，可以請您再說一次嗎？";
            twiml.say({ voice: twilioVoice, language: sayLang }, errMsg);

            // CRITICAL: We must re-initiate the gather block even if Gemini fails! 
            // If we don't, Twilio hits the end of the instructions and drops the call.
            twiml.gather({
                input: 'speech',
                language: gatherLang,
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
        twiml.say({ voice: twilioVoice, language: sayLang }, hangupMsg);
        twiml.hangup();
        // The /twilio/call-status webhook will automatically trigger evaluation when this hangs up.
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

// Twilio calls this when the physical phone call disconnects
app.post('/twilio/call-status', async (req, res) => {
    const callSid = req.body.CallSid;
    const callState = activeCalls.get(callSid);

    if (callState && req.body.CallStatus === 'completed') {
        broadcastLog(callSid, 'system', 'Call Ended. Evaluating success...');

        try {
            const prompt = `
                Review the following phone conversation between an AI assistant acting on behalf of a user and a restaurant.
                Did the restaurant explicitly confirm and accept the reservation? Keep in mind they might have said "no", "we are full", or just hung up.
                Conversation:
                ${callState.history.map(m => '[' + m.role + ']: ' + m.content).join('\n')}
                
                Reply with strictly a JSON object: {"success": true} if booked successfully, or {"success": false} if it failed.
            `;
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim().toLowerCase();

            const isSuccess = text.includes('"success": true') || text.includes('"success":true');
            broadcastLog(callSid, 'status', isSuccess ? 'success' : 'failed');

            // Save to CRM history if user was logged in
            if (isSuccess && callState.userId) {
                saveReservation(callState.userId, {
                    restaurantPhone: callState.restaurantPhone,
                    date: callState.rawDate,
                    time: callState.rawTime,
                    people: callState.rawPeople,
                    guestName: callState.userName,
                    status: 'confirmed'
                });
            }
        } catch (e) {
            console.error(e);
            broadcastLog(callSid, 'status', 'failed');
        }

        activeCalls.delete(callSid);
    }

    res.sendStatus(200);
});

// ==========================================
// 3. SMS CONFIRMATION
// ==========================================
app.post('/api/send-sms', async (req, res) => {
    let { userName, userPhone, date, time, people, language } = req.body;

    const formatPhone = (ph, langStr) => {
        if (!ph) return ph;
        let digits = String(ph).replace(/\D/g, '');
        if (!digits) return ph;

        if (String(ph).trim().startsWith('+')) {
            return '+' + digits;
        }

        const langInfo = langStr ? langStr.toLowerCase() : '';
        const isTaiwan = langInfo.includes('tw') || langInfo.includes('hant') || langInfo === 'zh';
        const defaultCode = isTaiwan ? '886' : '81';

        // If it looks like a US number
        if (digits.startsWith('1') && digits.length === 11) return '+' + digits;
        if (digits.length === 10 && !digits.startsWith('0')) return '+1' + digits;

        if (digits.startsWith('886') && digits.length > 10) return '+' + digits;
        if (digits.startsWith('81') && digits.length > 9) return '+' + digits;

        if (digits.startsWith('0')) return `+${defaultCode}${digits.substring(1)}`;
        return `+${defaultCode}${digits}`;
    };

    userPhone = formatPhone(userPhone, language || 'en-US');

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
