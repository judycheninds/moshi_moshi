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

// Serve the frontend from the www/ directory (synced with root on every deploy)
app.use(express.static(path.join(__dirname, '../www')));

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

// Helper to translate and then broadcast. Since transcription comes in fast, this is done asynchronously to not block Twilio
async function translateAndBroadcastLog({ callSid, role, content, callState }) {
    if (!content || ["system", "status"].includes(role)) {
        return broadcastLog(callSid, role, content);
    }

    const tLang = (callState?.language || 'ja').toLowerCase().split('-')[0];
    const uiLang = (callState?.uiLanguage || 'en').toLowerCase().split('-')[0];

    // If they already speak the UI language, skip translation
    if (tLang === uiLang) {
        return broadcastLog(callSid, role, content);
    }

    try {
        const uiLangCode = callState?.uiLanguage || 'en';
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Translate the following conversational text into the language code/locale '${uiLangCode}'. Respond ONLY with the exact translated text, nothing else. No markdown, no quotes.\n\nText: "${content}"`;
        const result = await model.generateContent(prompt);
        let translatedText = result.response.text().trim();

        // Broadcast the original text alongside the translated version
        broadcastLog(callSid, role, `${content}\n\n[Translation]: ${translatedText}`);
    } catch (e) {
        console.error("Translation failed:", e.message);
        broadcastLog(callSid, role, content);
    }
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
        status: data.status || 'confirmed',
        attempt_count: data.attemptCount || 1,
        alternatives: data.alternatives || null,
        notes: data.notes || null,
        call_sid: data.callSid || null
    });
    if (error) console.error('❌ Failed to save reservation:', error.message);
    else console.log(`✅ Reservation saved to Supabase for user ${userId}`);
}

// Helper to send SMS status back to user
async function sendStatusSMS(userPhone, message) {
    if (!twilioClient || !userPhone || userPhone === 'Not provided') return;
    try {
        await twilioClient.messages.create({
            body: `🍱 Moshi Moshi Agent: ${message}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: userPhone
        });
        console.log(`✅ SMS sent to ${userPhone}`);
    } catch (e) { console.error('❌ SMS failed:', e.message); }
}

// Core function: place an outbound Twilio call
async function placeCall(params, attemptCount = 1) {
    const targetLang = language || 'ja-JP';
    let friendlyDate = date;
    try {
        friendlyDate = new Date(date).toLocaleDateString(targetLang, { month: 'long', day: 'numeric' });
    } catch (e) { }

    let fallbackText = '';
    if (altTime1 || altTime2) {
        fallbackText = ` If ${time} is unavailable, also try: ${[altTime1, altTime2].filter(Boolean).join(' or ')}.`;
    }

    const stateId = scheduledCallId || `call_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    activeCalls.set(stateId, {
        goal: `Book a table for ${people} people under the name "${userName}" on ${friendlyDate} at ${time}.${fallbackText} CRITICAL: Never speak the year out loud. If the time is unavailable, ask what times they DO have available.`,
        language: language || 'ja-JP',
        uiLanguage: uiLanguage || 'en',
        userName: userName || 'Guest',
        userPhone: userPhone || 'Not provided',
        userId, scheduledCallId: scheduledCallId || null,
        rawDate: date, rawTime: time, rawPeople: people,
        restaurantPhone: phone, altTime1, altTime2,
        attemptCount, history: []
    });

    const call = await twilioClient.calls.create({
        url: `${publicUrl}/twilio/voice?stateId=${stateId}`,
        statusCallback: `${publicUrl}/twilio/call-status?stateId=${stateId}`,
        statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
        to: phone,
        from: process.env.TWILIO_PHONE_NUMBER
    });

    console.log(`📞 Call attempt ${attemptCount} placed: ${call.sid} (State: ${stateId}) → ${phone}`);
    return call;
}

// POST /api/schedule-call
app.post('/api/schedule-call', async (req, res) => {
    let { phone, date, time, altTime1, altTime2, people, language, userName, userPhone, scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt is required.' });

    let userId = null;
    try {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer '))
            userId = jwt.verify(authHeader.split(' ')[1], JWT_SECRET).id;
    } catch (e) { }

    const schedId = `sched_${Date.now()}`;
    const { error } = await supabase.from('scheduled_calls').insert({
        id: schedId, user_id: userId,
        restaurant_phone: phone, user_name: userName, user_phone: userPhone,
        date, time, alt_time1: altTime1, alt_time2: altTime2,
        people: String(people), language: language || 'ja-JP',
        scheduled_at: new Date(scheduledAt).toISOString(),
        attempt_count: 0, status: 'pending'
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, schedId, message: `Call scheduled for ${new Date(scheduledAt).toLocaleString()}` });
});

// GET /api/scheduled-calls
app.get('/api/scheduled-calls', authMiddleware, async (req, res) => {
    const { data, error } = await supabase
        .from('scheduled_calls').select('*')
        .eq('user_id', req.user.id)
        .order('scheduled_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// Background scheduler — fires every 30s, triggers pending calls
setInterval(async () => {
    if (!twilioClient) return;
    try {
        const now = new Date().toISOString();
        const { data: pending } = await supabase
            .from('scheduled_calls').select('*')
            .eq('status', 'pending').lte('scheduled_at', now);

        for (const sc of (pending || [])) {
            console.log(`⏰ Scheduler firing call for: ${sc.restaurant_phone}`);
            await supabase.from('scheduled_calls').update({ status: 'calling', attempt_count: 1 }).eq('id', sc.id);
            try {
                await placeCall({
                    phone: sc.restaurant_phone, userName: sc.user_name, userPhone: sc.user_phone,
                    date: sc.date, time: sc.time, altTime1: sc.alt_time1, altTime2: sc.alt_time2,
                    people: sc.people, language: sc.language, userId: sc.user_id, scheduledCallId: sc.id
                }, 1);
            } catch (e) {
                console.error('Scheduler call error:', e.message);
                await supabase.from('scheduled_calls').update({ status: 'error', notes: e.message }).eq('id', sc.id);
            }
        }
    } catch (e) { console.error('Scheduler error:', e.message); }
}, 30000);


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
    let { phone, date, time, altTime1, altTime2, people, language, userName, userPhone, uiLanguage } = req.body;

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

    phone = formatPhone(phone, language || 'ja-JP');
    userPhone = formatPhone(userPhone, language || 'ja-JP');

    if (!process.env.PUBLIC_URL || process.env.PUBLIC_URL.includes('your-ngrok')) {
        return res.status(500).json({ error: 'Please set up an ngrok PUBLIC_URL in .env before making real calls.' });
    }

    const stateId = `call_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
        let fallbackText = '';
        if (altTime1 || altTime2) {
            fallbackText = ` If ${time} is unavailable, you MUST ask for available fallback times. The user specifically approved ${[altTime1, altTime2].filter(Boolean).join(' or ')} as acceptable alternative times. Attempt to book these if offered.`;
        }

        let friendlyDate = date;
        try {
            const dateObj = new Date(date);
            friendlyDate = dateObj.toLocaleDateString(language || 'ja-JP', { month: 'long', day: 'numeric' });
        } catch (e) { }

        // Store the goal state BEFORE creating the call to avoid race condition
        activeCalls.set(stateId, {
            goal: `Book a table for ${people} people under the name "${userName}" on ${friendlyDate} at ${time}.${fallbackText} CRITICAL: Never speak the year out loud.`,
            language: language || 'ja-JP',
            uiLanguage: uiLanguage || 'en',
            userName: userName || 'User',
            userPhone: userPhone || 'Not provided',
            userId,
            rawDate: date,
            rawTime: time,
            rawPeople: people,
            restaurantPhone: phone,
            history: []
        });

        const call = await twilioClient.calls.create({
            url: `${publicUrl}/twilio/voice?stateId=${stateId}`,
            statusCallback: `${publicUrl}/twilio/call-status?stateId=${stateId}`,
            statusCallbackEvent: ['completed'],
            to: phone,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        res.json({ success: true, callSid: call.sid, stateId });
    } catch (err) {
        console.error("Twilio Call Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Twilio calls this when the phone connects
app.post('/twilio/voice', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const callSid = req.body.CallSid;
    const stateId = req.query.stateId;
    let callState = activeCalls.get(stateId) || activeCalls.get(callSid);

    // If we found it via stateId, map it to callSid so future webhooks (without query params) can find it
    if (stateId && callState && !activeCalls.has(callSid)) {
        activeCalls.set(callSid, callState);
    }

    const targetLang = callState ? callState.language : 'ja-JP';

    // Helper to map browser language to explicit Twilio engines
    let sayLang = targetLang;
    let gatherLang = targetLang;
    let twilioVoice = 'alice';

    if (targetLang.toLowerCase().includes('tw') || targetLang.toLowerCase().includes('hant') || targetLang === 'zh') {
        sayLang = 'zh-TW';
        gatherLang = 'cmn-Hant-TW'; // Specific STT for Taiwan
        twilioVoice = 'Google.cmn-TW-Wavenet-A'; // Google Wavenet for Taiwan
    } else if (targetLang.startsWith('zh')) {
        sayLang = 'zh-CN';
        gatherLang = 'cmn-Hans-CN';
        twilioVoice = 'Google.cmn-CN-Wavenet-D'; // Google Wavenet for Mainland China
    } else if (targetLang.startsWith('ja')) {
        sayLang = 'ja-JP';
        gatherLang = 'ja-JP';
        twilioVoice = 'Polly.Kazuha-Neural'; // Amazon Polly Neural
    } else if (targetLang.startsWith('ko')) {
        sayLang = 'ko-KR';
        gatherLang = 'ko-KR';
        twilioVoice = 'Polly.Seoyeon-Neural'; // Amazon Polly Neural
    } else {
        sayLang = 'en-US';
        gatherLang = 'en-US';
        twilioVoice = 'Polly.Salli-Neural'; // Amazon Polly Neural
    }

    // The initial thing the AI says to start the conversation — warm, human, personal
    const name = callState ? callState.userName : 'my friend';
    let greeting = `Hi there! I'm calling on behalf of ${name} to make a dinner reservation. Is this a good time?`;
    if (targetLang.startsWith('ja')) {
        greeting = `もしもし、${name}の代わりにご予約のお電話をさせていただいております。今、少しよろしいでしょうか？`;
    }
    if (targetLang.toLowerCase().includes('tw') || (targetLang.startsWith('zh') && targetLang.toLowerCase().includes('tw'))) {
        greeting = `您好，我是代替 ${name} 打電話來預訂座位的。請問現在方便說話嗎？`;
    } else if (targetLang.startsWith('ko')) {
        greeting = `안녕하세요, ${name}님을 대신하여 예약 전화를 드렸습니다. 지금 통화 가능하신가요?`;
    } else if (targetLang.startsWith('zh')) {
        greeting = `您好，我是代 ${name} 打电话预订座位的。请问现在方便吗？`;
    }

    // Save to history
    if (callState) {
        callState.history.push({ role: 'user', content: greeting }); // AI plays "user" role to the model
        translateAndBroadcastLog({ callSid, role: 'agent', content: greeting, callState });
    }

    // Use Twilio's reliable voice mapped to local language
    twiml.say({ voice: twilioVoice, language: sayLang }, greeting);

    // Now actively listen and wait for the restaurant to answer
    const gather = twiml.gather({
        input: 'speech',
        language: gatherLang,
        action: publicUrl + '/twilio/gather-result',
        speechTimeout: '1',
        timeout: 10
    });

    res.type('text/xml');
    res.send(twiml.toString());
});

// Twilio calls this when the restaurant host finishes saying something (Speech-To-Text result)
app.post('/twilio/gather-result', async (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const callSid = req.body.CallSid;
    const stateId = req.query.stateId;
    const transcribedText = req.body.SpeechResult; // What the restaurant just said!

    const callState = activeCalls.get(stateId) || activeCalls.get(callSid);
    const targetLang = callState ? callState.language : 'ja-JP';

    let sayLang = targetLang;
    let gatherLang = targetLang;
    let twilioVoice = 'alice';
    if (targetLang.toLowerCase().includes('tw') || targetLang.toLowerCase().includes('hant') || targetLang === 'zh') {
        sayLang = 'zh-TW';
        gatherLang = 'cmn-Hant-TW';
        twilioVoice = 'Google.cmn-TW-Wavenet-A'; // Google Wavenet for Taiwan
    } else if (targetLang.startsWith('zh')) {
        sayLang = 'zh-CN';
        gatherLang = 'cmn-Hans-CN';
        twilioVoice = 'Google.cmn-CN-Wavenet-D'; // Google Wavenet for Mainland China
    } else if (targetLang.startsWith('ja')) {
        sayLang = 'ja-JP';
        gatherLang = 'ja-JP';
        twilioVoice = 'Polly.Kazuha-Neural'; // Amazon Polly Neural
    } else if (targetLang.startsWith('ko')) {
        sayLang = 'ko-KR';
        gatherLang = 'ko-KR';
        twilioVoice = 'Polly.Seoyeon-Neural'; // Amazon Polly Neural
    } else {
        sayLang = 'en-US';
        gatherLang = 'en-US';
        twilioVoice = 'Polly.Salli-Neural'; // Amazon Polly Neural
    }

    const langNames = {
        'ja-JP': 'Japanese',
        'en-US': 'English',
        'ko-KR': 'Korean',
        'zh-TW': 'Mandarin Chinese (Taiwan, Traditional characters)',
        'zh-CN': 'Mandarin Chinese (Mainland, Simplified characters)'
    };
    const langName = langNames[targetLang] || targetLang;

    if (transcribedText && callState) {
        console.log(`[Restaurant] ${transcribedText}`);
        callState.history.push({ role: 'model', content: transcribedText }); // The restaurant is playing the "prompt"
        translateAndBroadcastLog({ callSid, role: 'restaurant', content: transcribedText, callState });

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
            2. Use natural conversational phrases. In English, use things like "Of course!", "Let me check...". If speaking in Chinese, you MUST use native, conversational idioms like "好的没问题" (Okay, no problem), "稍等一下我看看" (Let me check), "好的太感谢了" (Okay, thank you so much), instead of awkward literal translations of English idioms. Do not be overly formal or robotic.
            3. NEVER start sentences with filler words like "Oh", "Um", or "Ah" (e.g., do not say "Oh, okay" or "Oh, I see"). Be direct and precise in your conversation.
            4. When confirming the reservation details (date, time, party size, name), do it clearly but warmly. For example: "It would be for ${callState.userName}, party of X, on [date] at [time]."
            5. If they ask for a contact name, say the reservation is under the name "${callState.userName}".
            6. If they ask for a callback number, give them: "${callState.userPhone}".
            7. If the requested time is unavailable, politely ask what other times are available. DO NOT confirm a different time unless it was explicitly provided in your instructions as an acceptable alternative from the user. If they propose a different time/day that was not approved, politely say you need to check with your client and end the call smoothly.
            8. Once the reservation is fully confirmed (either original or approved alternative time), warmly thank them and say a natural goodbye.
            9. CRITICAL: Output ONLY the raw spoken text — no quotes, no stage directions, no emojis, no markdown. Just the words to speak.
            10. CRITICAL: You MUST speak exclusively in ${langName} for this entire turn. BCP-47: '${targetLang}'. Do NOT mix languages or include translations.
            11. If the restaurant has an automated system (IVR) that asks you to press a number (e.g., "Press 1 to speak to a representative"), you MUST output the exact command [PRESS:X] where X is the number to press. For example, output [PRESS:1] to press 1. You can still speak normally before or after the command if needed.
            12. Keep your response concise — this is a phone call, not an essay. Speak naturally and don't ramble.
        `;

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const aiResponse = await model.generateContent(prompt);
            let responseText = aiResponse.response.text().trim();
            let digitsToPress = null;

            // Extract [PRESS:X] if the AI decided to press a button
            const pressMatch = responseText.match(/\[PRESS:([\d\*\#]+)\]/i);
            if (pressMatch) {
                digitsToPress = pressMatch[1];
                responseText = responseText.replace(pressMatch[0], '').trim();
            }

            console.log(`[AI Agent] ${responseText} ${digitsToPress ? `(Pressing ${digitsToPress})` : ''}`);
            callState.history.push({ role: 'user', content: responseText + (digitsToPress ? ` [Pressed ${digitsToPress}]` : '') });
            translateAndBroadcastLog({ callSid, role: 'agent', content: responseText + (digitsToPress ? ` [Pressed ${digitsToPress}]` : ''), callState });

            if (responseText) {
                twiml.say({ voice: twilioVoice, language: sayLang }, responseText);
            }

            if (digitsToPress) {
                twiml.play({ digits: digitsToPress });
            }

            // Pass the stateId forward to the next gather result
            const actionUrl = stateId ? `${publicUrl}/twilio/gather-result?stateId=${stateId}` : `${publicUrl}/twilio/gather-result`;

            twiml.gather({
                input: 'speech',
                language: gatherLang,
                action: actionUrl,
                speechTimeout: '1',
                timeout: 10
            });
        } catch (e) {
            console.error("Gemini failed:", e);
            let errMsg = "I'm sorry, please say that again.";
            if (targetLang.startsWith('ja')) errMsg = "すみません、もう一度お願いします。";
            if (targetLang.startsWith('ko')) errMsg = "죄송합니다, 다시 한번 말씀해 주시겠어요?";
            if (targetLang.startsWith('zh')) errMsg = "不好意思，可以請您再說一次嗎？";
            twiml.say({ voice: twilioVoice, language: sayLang }, errMsg);

            // CRITICAL: We must re-initiate the gather block even if Gemini fails! 
            // If we don't, Twilio hits the end of the instructions and drops the call.
            // Pass the stateId forward to the next gather result
            const actionUrl = stateId ? `${publicUrl}/twilio/gather-result?stateId=${stateId}` : `${publicUrl}/twilio/gather-result`;

            twiml.gather({
                input: 'speech',
                language: gatherLang,
                action: actionUrl,
                speechTimeout: '1',
                timeout: 10
            });
        }
    } else {
        // If the gather timed out or got nothing, just end the call gracefully
        let hangupMsg = "I will call back later. Goodbye.";
        if (targetLang.startsWith('ja')) hangupMsg = "また後でかけ直します。失礼します。";
        if (targetLang.startsWith('ko')) hangupMsg = "나중에 다시 전화드리겠습니다. 감사합니다.";
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
    const callStatus = req.body.CallStatus;
    const stateId = req.query.stateId;
    const callState = activeCalls.get(stateId) || activeCalls.get(callSid);

    if (!callState) { res.sendStatus(200); return; }

    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 3 * 60 * 1000; // 3 minutes

    // ── NO-ANSWER / BUSY / FAILED → Auto-Retry ──────────────────────────
    if (['no-answer', 'busy', 'failed'].includes(callStatus)) {
        const attempt = callState.attemptCount || 1;
        broadcastLog(callSid, 'system', `Call ${callStatus} (attempt ${attempt}/${MAX_ATTEMPTS})`);

        if (attempt < MAX_ATTEMPTS) {
            const nextAttempt = attempt + 1;
            await sendStatusSMS(callState.userPhone,
                `Attempt ${attempt}/${MAX_ATTEMPTS}: Restaurant didn't answer. Retrying in 3 minutes...`);

            setTimeout(async () => {
                try {
                    await placeCall({
                        phone: callState.restaurantPhone,
                        userName: callState.userName,
                        userPhone: callState.userPhone,
                        date: callState.rawDate,
                        time: callState.rawTime,
                        altTime1: callState.altTime1,
                        altTime2: callState.altTime2,
                        people: callState.rawPeople,
                        language: callState.language,
                        userId: callState.userId,
                        scheduledCallId: callState.scheduledCallId
                    }, nextAttempt);
                    console.log(`🔄 Retry ${nextAttempt} scheduled for ${callState.restaurantPhone}`);
                } catch (e) {
                    console.error('Retry failed:', e.message);
                }
            }, RETRY_DELAY_MS);

        } else {
            // All 3 attempts exhausted
            broadcastLog(callSid, 'status', 'failed');
            await sendStatusSMS(callState.userPhone,
                `We tried calling ${callState.restaurantPhone} 3 times but couldn't reach them. ` +
                `Please try calling manually or let us know a new time to try.`);

            if (callState.scheduledCallId) {
                await supabase.from('scheduled_calls').update({
                    status: 'no_answer_final',
                    notes: 'Restaurant did not answer after 3 attempts.'
                }).eq('id', callState.scheduledCallId);
            }
            if (callState.userId) {
                saveReservation(callState.userId, {
                    restaurantPhone: callState.restaurantPhone,
                    date: callState.rawDate,
                    time: callState.rawTime,
                    people: callState.rawPeople,
                    guestName: callState.userName,
                    status: 'no_answer',
                    attemptCount: MAX_ATTEMPTS,
                    notes: 'Restaurant did not answer after 3 attempts.',
                    callSid
                });
            }
        }

        activeCalls.delete(callSid);
        res.sendStatus(200);
        return;
    }

    // ── COMPLETED → Evaluate with Gemini ────────────────────────────────
    if (callStatus === 'completed') {
        broadcastLog(callSid, 'system', 'Call ended. Evaluating outcome...');

        try {
            const conversation = callState.history.map(m => `[${m.role}]: ${m.content}`).join('\n');

            // Gemini evaluates outcome AND extracts alternatives
            const evalPrompt = `
                You are evaluating a phone call where an AI assistant tried to book a restaurant reservation at ${callState.rawTime}.
                
                CONVERSATION:
                ${conversation}
                
                Answer with ONLY a JSON object (no markdown, no explanation):
                {
                  "success": true or false,
                  "confirmedTime": "string of the final confirmed time if it was successfully booked (e.g. '19:30'), or null",
                  "alternatives": "string describing any alternative times/dates the restaurant mentioned, or null if none",
                  "notes": "one sentence summary of what happened"
                }
                
                Set "success": true ONLY if the restaurant explicitly confirmed the booking.
            `;

            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const result = await model.generateContent(evalPrompt);
            let rawText = result.response.text().trim();

            // Strip markdown code fences if Gemini adds them
            rawText = rawText.replace(/```json|```/g, '').trim();

            let evalResult = { success: false, confirmedTime: null, alternatives: null, notes: '' };
            try { evalResult = JSON.parse(rawText); } catch (e) {
                evalResult.success = rawText.includes('"success":true') || rawText.includes('"success": true');
            }

            const isSuccess = evalResult.success === true;
            const statusType = isSuccess ? 'success' : (evalResult.alternatives ? 'alternative' : 'failed');

            broadcastLog(callSid, 'status', JSON.stringify({
                type: statusType,
                confirmedTime: evalResult.confirmedTime,
                alternatives: evalResult.alternatives,
                notes: evalResult.notes
            }));

            if (evalResult.alternatives) broadcastLog(callSid, 'agent', `💡 Alternatives: ${evalResult.alternatives}`);

            // Save to CRM
            if (callState.userId) {
                saveReservation(callState.userId, {
                    restaurantPhone: callState.restaurantPhone,
                    date: callState.rawDate,
                    time: callState.rawTime,
                    people: callState.rawPeople,
                    guestName: callState.userName,
                    status: isSuccess ? 'confirmed' : 'failed',
                    attemptCount: callState.attemptCount || 1,
                    alternatives: evalResult.alternatives || null,
                    notes: evalResult.notes || null,
                    callSid
                });
            }

            // Update scheduled_calls status if applicable
            if (callState.scheduledCallId) {
                await supabase.from('scheduled_calls').update({
                    status: isSuccess ? 'completed' : 'failed',
                    alternatives: evalResult.alternatives,
                    notes: evalResult.notes
                }).eq('id', callState.scheduledCallId);
            }

            // SMS the user with the outcome
            if (isSuccess) {
                await sendStatusSMS(callState.userPhone,
                    `✅ Reservation confirmed! Table for ${callState.rawPeople} on ${callState.rawDate} at ${callState.rawTime} under "${callState.userName}".`);
            } else if (evalResult.alternatives) {
                await sendStatusSMS(callState.userPhone,
                    `❌ Your requested time wasn't available. The restaurant offered: ${evalResult.alternatives}. Reply to rebook!`);
            } else {
                await sendStatusSMS(callState.userPhone,
                    `❌ Booking attempt was unsuccessful. ${evalResult.notes || 'Please try a different time.'}`);
            }

        } catch (e) {
            console.error('Gemini evaluation error:', e);
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
