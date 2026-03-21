require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilio = require('twilio');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const stripe = process.env.STRIPE_SECRET_KEY
    ? require('stripe')(process.env.STRIPE_SECRET_KEY)
    : null;
if (!stripe) console.warn('⚠️  STRIPE_SECRET_KEY not set — Stripe features disabled.');
// Initialize Supabase (persistent DB)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
console.log('✅ Supabase connected:', process.env.SUPABASE_URL);

const app = express();
app.use(cors());
app.use(express.json());
// Must parse urlencoded forms for Twilio webhooks
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ──────────────────────────────────────────────────────────────
// Global: 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' }
});

// Strict: max 5 real calls per hour per IP (Twilio costs money!)
const callLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { error: 'Call limit reached. You can make up to 5 reservation calls per hour.' }
});

// Auth: max 10 login/register attempts per 15 minutes (brute force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// Apply global limiter to all API routes
app.use('/api/', globalLimiter);

// ── End Rate Limiting ──────────────────────────────────────────────────────────

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
// Secret updated to forcefully expire old debug tokens
const JWT_SECRET = process.env.JWT_SECRET || 'moshi-moshi-secret-reset-777';

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

// Helper to reliably get a Stripe customer ID without requiring DB schema changes
async function getStripeCustomerId(email, name, metadata = {}) {
    if (!stripe) return null;
    try {
        const existing = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
        if (existing.data.length > 0) return existing.data[0].id;
        const customer = await stripe.customers.create({ email: email.toLowerCase(), name, metadata });
        return customer.id;
    } catch (err) {
        console.error("Stripe resolution error:", err);
        return null;
    }
}

// POST /api/auth/register
app.post('/api/auth/register', authLimiter, async (req, res) => {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name are required.' });

    // Check duplicate
    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single();
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const id = `user_${Date.now()}`;
    // Create a Stripe Customer right away implicitly
    try {
        await getStripeCustomerId(email, name, { app_user_id: id });
    } catch (err) { }

    const { error } = await supabase.from('users').insert({
        id, email: email.toLowerCase(), password_hash: passwordHash, name, phone: phone || ''
    });
    if (error) return res.status(500).json({ error: error.message });

    const token = jwt.sign({ id, email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id, email: email.toLowerCase(), name, phone: phone || '' } });
});

// POST /api/auth/login
app.post('/api/auth/login', authLimiter, async (req, res) => {
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

// DEPRECATED API removed to prevent duplicate conflicts

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
        notes: r.notes || null,
        createdAt: r.created_at
    })));
});


// GET /api/user/billing
app.get('/api/user/billing', authMiddleware, async (req, res) => {
    try {
        const customerId = await getStripeCustomerId(req.user.email, req.user.name);
        if (!customerId) return res.json({ paymentMethods: [] });



        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
        });

        // Return id + card details so frontend can display and remove cards
        res.json({
            paymentMethods: paymentMethods.data.map(pm => ({
                id: pm.id,
                name: pm.billing_details?.name || null,
                brand: pm.card.brand,
                last4: pm.card.last4,
                exp_month: pm.card.exp_month,
                exp_year: pm.card.exp_year,
            }))
        });
    } catch (error) {
        console.error('Error fetching billing info:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stripe-key — expose publishable key to frontend
app.get('/api/stripe-key', authMiddleware, (req, res) => {
    let pk = process.env.STRIPE_PUBLISHABLE_KEY;

    res.json({ publishableKey: pk });
});

// POST /api/user/setup-intent — create a SetupIntent to add a payment method
app.post('/api/user/setup-intent', authMiddleware, async (req, res) => {
    try {


        const customerId = await getStripeCustomerId(req.user.email, req.user.name, { supabase_id: req.user.id });
        if (!customerId) throw new Error("Could not initialize billing system");

        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
            usage: 'off_session',   // needed for restaurant deposits
        });

        res.json({ clientSecret: setupIntent.client_secret, customerId });
    } catch (err) {
        console.error('Setup intent error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/user/detach-payment-method — remove a saved card
app.post('/api/user/detach-payment-method', authMiddleware, async (req, res) => {
    try {
        const { paymentMethodId } = req.body;
        if (!paymentMethodId) return res.status(400).json({ error: 'paymentMethodId required' });

        await stripe.paymentMethods.detach(paymentMethodId);
        res.json({ success: true });
    } catch (err) {
        console.error('Detach error:', err);
        res.status(500).json({ error: err.message });
    }
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
async function placeCall({ phone, date, time, altTime1, altTime2, people, language, userName, userPhone, uiLanguage, userId, scheduledCallId }, attemptCount = 1) {
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
app.post('/api/schedule-call', callLimiter, async (req, res) => {
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
app.post('/api/simulate-call', authMiddleware, callLimiter, async (req, res) => {
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
app.post('/api/real-call', authMiddleware, callLimiter, async (req, res) => {
    let { phone, date, time, altTime1, altTime2, people, adults, kids, language, userName, userPhone, uiLanguage, isRebook, acceptedAltTime } = req.body;
    adults = parseInt(adults) || parseInt(people) || 2;
    kids = parseInt(kids) || 0;
    people = adults + kids;   // keep total in sync

    // Use logged in user ID
    let userId = req.user.id;

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

        // Build a natural party size description for the agent
        const partyParts = [];
        if (adults > 0) partyParts.push(`${adults} adult${adults !== 1 ? 's' : ''}`);
        if (kids > 0) partyParts.push(`${kids} child${kids !== 1 ? 'ren' : ''}`);
        const partyDesc = partyParts.join(' and ') || `${people} people`;

        let friendlyDate = date;
        try {
            const dateObj = new Date(date);
            friendlyDate = dateObj.toLocaleDateString(language || 'ja-JP', { month: 'long', day: 'numeric' });
        } catch (e) { }

        // Build the goal — different for rebook callback vs fresh call
        let goal;
        if (isRebook && acceptedAltTime) {
            goal = `You are calling back this restaurant. You called a few minutes ago and the restaurant said ${time} was unavailable and offered ${acceptedAltTime} instead. You have now confirmed with ${userName} and they ACCEPT the ${acceptedAltTime} slot. Your goal is to book a table for ${partyDesc} under the name "${userName}" on ${friendlyDate} at ${acceptedAltTime}. Be warm and reference that you called before. CRITICAL: Never speak the year out loud.`;
        } else {
            goal = `Book a table for ${partyDesc} under the name "${userName}" on ${friendlyDate} at ${time}.${fallbackText} CRITICAL: Never speak the year out loud.`;
        }

        // Store the goal state BEFORE creating the call to avoid race condition
        activeCalls.set(stateId, {
            goal,
            language: language || 'ja-JP',
            uiLanguage: uiLanguage || 'en',
            userName: userName || 'User',
            userPhone: userPhone || 'Not provided',
            userId,
            rawDate: date,
            rawTime: isRebook && acceptedAltTime ? acceptedAltTime : time,
            rawPeople: people,
            rawAdults: adults,
            rawKids: kids,
            restaurantPhone: phone,
            isRebook: !!isRebook,
            acceptedAltTime: acceptedAltTime || null,
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
        gatherLang = 'cmn-Hant-TW'; // Standard STT for Taiwan
        twilioVoice = 'Polly.Zhiyu-Neural'; // Upgraded to Premium Neural voice (avoids robotic scammer sound)
    } else if (targetLang.startsWith('zh')) {
        sayLang = 'zh-CN';
        gatherLang = 'cmn-Hans-CN';
        twilioVoice = 'Polly.Zhiyu-Neural'; // Amazon Polly Neural CN
    } else if (targetLang.startsWith('ja')) {
        sayLang = 'ja-JP';
        gatherLang = 'ja-JP';
        twilioVoice = 'Polly.Kazuha-Neural'; // Amazon Polly Neural Japanese
    } else if (targetLang.startsWith('ko')) {
        sayLang = 'ko-KR';
        gatherLang = 'ko-KR';
        twilioVoice = 'Polly.Seoyeon-Neural'; // Amazon Polly Neural Korean
    } else {
        sayLang = 'en-US';
        gatherLang = 'en-US';
        twilioVoice = 'Polly.Salli-Neural'; // Amazon Polly Neural English
    }

    // The initial thing the AI says to start the conversation — warm, human, personal
    const name = callState ? callState.userName : 'my friend';
    const isRebookCall = callState?.isRebook;
    const acceptedAlt = callState?.acceptedAltTime;
    let greeting;

    if (isRebookCall && acceptedAlt) {
        // Callback greetings — reference the prior call naturally
        if (targetLang.startsWith('ja')) {
            greeting = `もしもし、先ほどお電話させていただいた、${name}の代理人です。先ほどご提案いただいた${acceptedAlt}の件ですが、${name}に確認しましたところ、その時間でご予約させていただきたいとのことです。よろしいでしょうか？`;
        } else if (targetLang.toLowerCase().includes('tw') || (targetLang.startsWith('zh') && targetLang.toLowerCase().includes('tw'))) {
            greeting = `您好，我是剛才代替 ${name} 打電話的。我跟 ${name} 確認過了，我們很樂意接受您提議的 ${acceptedAlt} 這個時間。請問可以幫我們預訂嗎？`;
        } else if (targetLang.startsWith('ko')) {
            greeting = `안녕하세요, 조금 전에 ${name}님 대신 전화드렸던 사람입니다. ${name}님께 확인해보니 제안해주신 ${acceptedAlt} 시간에 예약하고 싶다고 하셔서요. 가능할까요?`;
        } else if (targetLang.startsWith('zh')) {
            greeting = `您好，我是刚才代 ${name} 打电话的。我和 ${name} 确认过了，我们很愿意接受您提议的 ${acceptedAlt} 这个时间。可以帮我们预订吗？`;
        } else {
            greeting = `Hi, I called a little while ago on behalf of ${name}. I've spoken with ${name} and we'd love to accept the ${acceptedAlt} slot you offered. Could you go ahead and book that for us?`;
        }
    } else {
        // Fresh call greetings
        greeting = `Hi there! I'm calling on behalf of ${name} to make a reservation. Is this a good time?`;
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
        speechTimeout: '2',
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
        twilioVoice = 'Polly.Zhiyu-Neural';
    } else if (targetLang.startsWith('zh')) {
        sayLang = 'zh-CN';
        gatherLang = 'cmn-Hans-CN';
        twilioVoice = 'Polly.Zhiyu-Neural';
    } else if (targetLang.startsWith('ja')) {
        sayLang = 'ja-JP';
        gatherLang = 'ja-JP';
        twilioVoice = 'Polly.Kazuha-Neural';
    } else if (targetLang.startsWith('ko')) {
        sayLang = 'ko-KR';
        gatherLang = 'ko-KR';
        twilioVoice = 'Polly.Seoyeon-Neural';
    } else {
        sayLang = 'en-US';
        gatherLang = 'en-US';
        twilioVoice = 'Polly.Salli-Neural';
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
            [YOUR IDENTITY]
            You are a warm, savvy human personal assistant on a live phone call. You are NOT an AI or robot. Your name is not important — you are calling on behalf of ${callState.userName}.

            [YOUR MISSION]
            ${callState.goal}

            [CONVERSATION HISTORY]
            ${callState.history.map(m => '[' + (m.role === 'user' ? 'You' : 'Restaurant') + ']: ' + m.content).join('\n')}

            [WHAT THE RESTAURANT JUST SAID]
            "${transcribedText}"

            [LANGUAGE — THIS IS NON-NEGOTIABLE]
            You MUST speak ONLY in ${langName} (BCP-47: ${targetLang}) for your ENTIRE response.
            Do NOT include even a single word in English or any other language.
            The restaurant may speak in a different language — that is fine, understand it and reply in ${langName}.

            [HOW TO HANDLE THE CONVERSATION]
            - Sound natural and warm, like a real human assistant. Use contractions, varied sentence lengths, and natural flow.
            - Keep each reply SHORT — this is a phone call. 1–3 sentences max.
            - If the restaurant says something unclear or you need a moment, say something like "稍等一下" or "すみません、もう一度" — keep it natural.
            - If the restaurant CONFIRMS the booking: thank them warmly and say goodbye. That means the reservation succeeded.
            - If the restaurant says the requested time is NOT available: ask what other times they have available. 
            - CRITICAL: When the restaurant proposes an alternative time, DO NOT ACCEPT IT. You MUST NOT book an alternative time. You must REPEAT that specific time back to confirm you heard it correctly (e.g. "So you have availability at 7:00 PM, correct?"), then immediately say you need to check with ${callState.userName} and END THE CALL POLITELY. This repetition is crucial so the user can review it later.
            - If you hear an automated voicemail, an answering machine, or a system message saying the number is "not available" (e.g., "The subscriber you have dialed is not available"), DO NOT treat it as a person talking. DO NOT treat random phone numbers in an automated message as alternative reservation times. Say a natural goodbye and end the call.
            - If the restaurant asks for the name: say "${callState.userName}".
            - If the restaurant asks for a phone number: your user's phone number is "${callState.userPhone}" and you are calling the restaurant at "${callState.restaurantPhone}". Compare their country codes. If they are in the SAME country, tell the restaurant the phone number WITHOUT the country code. If they are in DIFFERENT countries, explicitly state the country code and country name first (e.g. "The country code is +1 for the US"), and then provide the rest of the number.
            - If the restaurant asks for a credit card or deposit: politely decline and say you will provide that when you arrive.
            - If you hear hold music or silence: wait patiently and say nothing. If the hold seems very long, say "I'll hold" in ${langName} and wait.
            - **IVR / AUTOMATED PHONE MENU**: If an automated system answers and reads out a menu of options (e.g. "Press 1 for reservations, press 9 to connect to staff, press # to repeat"), you MUST:
              * LISTEN carefully to the full menu and identify which key the system says leads to reservations, the front desk, a human operator, or speaking to staff.
              * Output [PRESS:X] where X is EXACTLY the key the IVR announced (e.g. 1, 2, 9, 0, *, #) — do NOT guess or assume a number.
              * If the IVR says "press 0 for operator" → [PRESS:0]. If it says "press 9 to speak to staff" → [PRESS:9]. If it says "press # to connect" → [PRESS:#].
              * If the menu does NOT clearly offer a way to reach a human, press 0 as a universal fallback (most systems route 0 to an operator).
              * After pressing, say NOTHING — wait silently for a human to pick up before greeting them.
              * If you reach another automated layer, repeat the process: listen, identify the right key, press it.
              * Do NOT leave a voicemail — keep navigating until you reach a live person.
            - If there's background noise and the restaurant is hard to understand: ask them to repeat in ${langName}.
            - If the call seems complete (reservation confirmed OR ended politely): say a natural goodbye in ${langName} only. Nothing in English.

            [OUTPUT FORMAT]
            Output ONLY the words you want to say out loud — no quotes, no labels, no emojis, no markdown, no stage directions.
            Output [PRESS:X] only when pressing a phone button is needed.
            EVERYTHING must be in ${langName}. Zero exceptions.
        `;

        try {
            // System instruction has HIGHEST priority in Gemini — enforces language at model level
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: `You are a human phone assistant making a reservation call. You speak ONLY in ${langName} (BCP-47: ${targetLang}). Every word of your response must be in ${langName}. The restaurant may speak any language — you always reply in ${langName}. This is absolute and non-negotiable.`
            });
            const aiResponse = await model.generateContent(prompt);
            let responseText = aiResponse.response.text().trim();
            let digitsToPress = null;

            // Extract [PRESS:X] if the AI decided to press a button
            const pressMatch = responseText.match(/\[PRESS:([\d\*\#]+)\]/i);
            if (pressMatch) {
                digitsToPress = pressMatch[1];
                responseText = responseText.replace(pressMatch[0], '').trim();
            }

            // Post-process: detect if the model switched to English when it shouldn't have
            const isNonEnglishTarget = !targetLang.startsWith('en');
            if (isNonEnglishTarget && responseText.length > 5) {
                const latinChars = (responseText.match(/[a-zA-Z]/g) || []).length;
                const totalChars = responseText.replace(/\s/g, '').length;
                const latinRatio = latinChars / totalChars;
                if (latinRatio > 0.4) {
                    // More than 40% Latin chars in a non-English call — auto-correct language
                    console.log(`[Lang Fix] Detected language switch (${Math.round(latinRatio * 100)}% Latin). Auto-correcting to ${langName}...`);
                    const fixModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const fixResult = await fixModel.generateContent(
                        `Translate the following text to ${langName}. Keep the same natural, warm tone. Output ONLY the translation, nothing else:\n\n${responseText}`
                    );
                    responseText = fixResult.response.text().trim();
                    console.log(`[Lang Fix] Corrected response: ${responseText}`);
                }
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
                speechTimeout: '2',
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
                speechTimeout: '2',
                timeout: 10
            });
        }
    } else {
        // ── GATHER TIMEOUT / RESTAURANT HUNG UP ─────────────────────────
        // If we got nothing from gather, the restaurant likely hung up or went silent
        const attempt = callState ? (callState.attemptCount || 1) : 1;
        const MAX_ATTEMPTS = 3;

        if (callState && attempt < MAX_ATTEMPTS) {
            // Restaurant hung up mid-call — schedule a retry
            const nextAttempt = attempt + 1;
            const retryDelaySec = 30;
            broadcastLog(callSid, 'system',
                `📴 Restaurant disconnected (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${retryDelaySec}s…`);

            setTimeout(async () => {
                broadcastLog(callSid, 'system', `📞 Placing retry call (attempt ${nextAttempt}/${MAX_ATTEMPTS})…`);
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
                        uiLanguage: callState.uiLanguage,
                        userId: callState.userId,
                        scheduledCallId: callState.scheduledCallId
                    }, nextAttempt);
                } catch (e) {
                    console.error('Hangup retry failed:', e.message);
                    broadcastLog(callSid, 'system', `❌ Retry ${nextAttempt} failed: ${e.message}`);
                    broadcastLog(callSid, 'status', JSON.stringify({ type: 'failed', notes: e.message }));
                }
            }, retryDelaySec * 1000);
        } else {
            // All retries exhausted after repeated hangups
            const note = `Restaurant disconnected ${MAX_ATTEMPTS} times without completing the reservation.`;
            broadcastLog(callSid, 'system', `❌ Restaurant hung up ${MAX_ATTEMPTS} times. Giving up.`);
            broadcastLog(callSid, 'status', JSON.stringify({
                type: 'failed',
                notes: note
            }));
            if (callState?.userPhone) {
                await sendStatusSMS(callState.userPhone,
                    `The restaurant disconnected our call ${MAX_ATTEMPTS} times without completing the booking. Please try calling them directly.`);
            }
        }

        let hangupMsg = 'One moment please, I will try again shortly.';
        if (targetLang.startsWith('ja')) hangupMsg = '少々お待ちください、もう一度おかけします。';
        if (targetLang.startsWith('ko')) hangupMsg = '잠시만요, 다시 전화드리겠습니다.';
        if (targetLang.startsWith('zh')) hangupMsg = '請稍等，我馬上再撥。';
        twiml.say({ voice: twilioVoice, language: sayLang }, hangupMsg);
        twiml.hangup();
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
    const RETRY_DELAY_MS = 30 * 1000; // 30 seconds between retries

    // ── NO-ANSWER / BUSY / FAILED → Auto-Retry ──────────────────────────
    if (['no-answer', 'busy', 'failed'].includes(callStatus)) {
        const attempt = callState.attemptCount || 1;

        // Choose a clear, human-readable reason
        const reasonMap = {
            'no-answer': '📵 No one picked up',
            'busy': '🔴 Line was busy',
            'failed': '⚠️ Call could not be connected'
        };
        const reason = reasonMap[callStatus] || callStatus;

        broadcastLog(callSid, 'system', `${reason} (attempt ${attempt}/${MAX_ATTEMPTS})`);

        if (attempt < MAX_ATTEMPTS) {
            const nextAttempt = attempt + 1;
            const retryInSec = Math.round(RETRY_DELAY_MS / 1000);
            broadcastLog(callSid, 'system',
                `🔄 Retrying in ${retryInSec}s… (attempt ${nextAttempt}/${MAX_ATTEMPTS})`);

            setTimeout(async () => {
                broadcastLog(callSid, 'system', `📞 Placing retry call (attempt ${nextAttempt}/${MAX_ATTEMPTS})…`);
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
                        uiLanguage: callState.uiLanguage,
                        userId: callState.userId,
                        scheduledCallId: callState.scheduledCallId
                    }, nextAttempt);
                    console.log(`🔄 Retry ${nextAttempt} placed for ${callState.restaurantPhone}`);
                } catch (e) {
                    console.error('Retry failed:', e.message);
                    broadcastLog(callSid, 'system', `❌ Retry ${nextAttempt} failed: ${e.message}`);
                    broadcastLog(callSid, 'status', JSON.stringify({
                        type: 'failed',
                        notes: `Retry attempt ${nextAttempt} could not be placed: ${e.message}`
                    }));
                }
            }, RETRY_DELAY_MS);

        } else {
            // All attempts exhausted
            const finalNote = `Restaurant did not answer after ${MAX_ATTEMPTS} attempts (${reasonMap[callStatus]}). Please try again later or call manually.`;
            broadcastLog(callSid, 'system', `❌ All ${MAX_ATTEMPTS} attempts failed. Giving up.`);
            broadcastLog(callSid, 'status', JSON.stringify({
                type: 'failed',
                notes: finalNote
            }));

            await sendStatusSMS(callState.userPhone,
                `We tried calling ${callState.restaurantPhone} ${MAX_ATTEMPTS} times (${reason}) but couldn't reach them. ` +
                `Please try again later or schedule a call for a different time.`);

            if (callState.scheduledCallId) {
                await supabase.from('scheduled_calls').update({
                    status: 'no_answer_final',
                    notes: finalNote
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
                    notes: finalNote,
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
            // IMPORTANT: Roles are stored as 'user' (agent) and 'model' (restaurant) — re-label for clarity
            const conversation = callState.history.map(m => `[${m.role === 'user' ? 'Agent' : 'Restaurant'}]: ${m.content}`).join('\n');
            console.log('[Eval] Conversation transcript:\n', conversation);

            // ── PRE-CHECK: Scan last agent message for goodbye-without-booking phrases ──
            // This is more reliable than Gemini for multilingual calls
            const agentMessages = callState.history.filter(m => m.role === 'user').map(m => m.content);
            const lastAgentMsg = (agentMessages[agentMessages.length - 1] || '').toLowerCase();
            const restaurantMessages = callState.history.filter(m => m.role === 'model').map(m => m.content);
            const allRestaurantText = restaurantMessages.join(' ').toLowerCase();

            // Phrases the AGENT says when leaving WITHOUT a booking
            // Keep broad — 'check with' catches 'check with Judy', 'check with my client', etc.
            const noBookingPhrases = [
                'check with', 'get back to you', 'call back', 'will confirm', 'let you know',
                'need to confirm', 'need to check', 'will check',
                '需要確認', '確認後再', '再聯絡', '跟我的', '向客戶', '確認一下', '再打來', '回覆您',
                'また確認', 'また連絡', '確認して', '折り返し',
                '다시 연락', '확인하고', '확인 후'
            ];

            // Phrases the RESTAURANT says when they have NO availability
            // Broad to catch variants like "we don't have a table"
            const noAvailabilityPhrases = [
                "don't have", "do not have", 'no available', 'not available', 'fully booked',
                'no availability', 'unavailable', 'cannot accommodate', 'all booked', 'sold out',
                '満席', '予約が取れません', '空きがない', '空席なし', 'ご用意できません',
                '客滿', '沒有位子', '沒有空位', '無法預約', '沒有', '沒空位',
                '예약이 꽉 찼', '자리가 없', '만석', '없습니다'
            ];

            const agentSaidGoodbyeWithoutBooking = noBookingPhrases.some(p => lastAgentMsg.includes(p));
            const restaurantSaidFull = noAvailabilityPhrases.some(p => allRestaurantText.includes(p));

            console.log('[Eval] Last agent message:', lastAgentMsg);
            console.log('[Eval] All restaurant text:', allRestaurantText);
            console.log('[Eval] Agent said goodbye without booking:', agentSaidGoodbyeWithoutBooking);
            console.log('[Eval] Restaurant said unavailable:', restaurantSaidFull);

            if (!callState.isRebook && (agentSaidGoodbyeWithoutBooking || restaurantSaidFull)) {
                console.log('[Eval] PRE-CHECK: Agent ended call without booking or restaurant is full. Passing to Gemini to find alternatives.');
                // Do NOT return here. Continue downwards to run the Gemini `evalPrompt` so Gemini can use context to figure out if it's a real alternative or just a phone number.
            } else if (callState.isRebook && agentSaidGoodbyeWithoutBooking) {
                console.log('[Eval] PRE-CHECK: Agent ended rebook call without booking. Passing to Gemini.');
            }
            // ── END PRE-CHECK ──

            // Map uiLanguage code to a full language name for Gemini
            const uiLangNames = { 'en': 'English', 'ja': 'Japanese', 'zh-TW': 'Traditional Chinese', 'zh-CN': 'Simplified Chinese', 'ko': 'Korean' };
            const uiLangName = uiLangNames[callState.uiLanguage] || 'English';

            const evalPrompt = `
                You are evaluating a phone call where an AI assistant tried to book a restaurant reservation at ${callState.rawTime} on ${callState.rawDate}.
                The conversation may be in Japanese, Chinese, Korean, or English — handle all languages.
                The USER's preferred display language is: ${uiLangName}.
                
                ${callState.isRebook ? `\nCRITICAL CONTEXT: This is a REBOOK call to ACCEPT a previously proposed time (${callState.rawTime}). The user has already approved it.` : ''}

                CONVERSATION:
                ${conversation}
                
                Your task: determine whether the reservation was ACTUALLY CONFIRMED for the requested time (${callState.rawTime}).
                
                CRITICAL RULES — read carefully:
                - Set "success": TRUE if the restaurant explicitly said it is CONFIRMED/BOOKED for the requested time AND/OR the agent clearly accepted and confirmed the booking details.
                - If the conversation ends with the restaurant confirming the details and the agent saying "thank you" or "goodbye", treat it as a FIRM BOOKING and set "success": TRUE.
                - Set "success": FALSE if the restaurant said they are full, no availability, or proposed ANY different time WITHOUT the agent explicitly agreeing and finalizing a booking.
                - Set "success": FALSE if the agent said they need to "check with the client" or ended the call without a firm booking.
                                ALTERNATIVE TIME EXTRACTION — this is critical:
                - If the restaurant mentioned specific time(s) that they DO have available, extract ALL of them.
                - Normalize extracted times to a clear English format like "6:00 PM" or "6:00 PM and 7:30 PM".
                - DO NOT extract the requested time (${callState.rawTime}) as an alternative if the agent successfully booked it.
                - You MUST extract true alternatives even if the agent ultimately said "I will check with the client" and the overall success is false.
                - Set "alternatives" ALWAYS in English (e.g. "6:00 PM").
                - Set "alternativesLocalized" as the same time(s) written naturally in ${uiLangName} (e.g. for Traditional Chinese: "晚上6點", for Japanese: "午後6時").
                - Do NOT confuse voicemail messages or system error phone numbers as alternative times.
                - If no alternative was proposed, set both "alternatives" and "alternativesLocalized" to null.
                
                DEPOSIT: If the restaurant asked for any deposit, prepayment, or credit card hold, set "depositRequested": true and "depositAmount" to the amount in smallest currency unit (e.g. 1000 for $10.00). If no deposit was mentioned, set "depositRequested": false.
                
                Answer with ONLY a JSON object (no markdown, no explanation):
                {
                  "success": true or false,
                  "confirmedTime": "the actual confirmed time string if success=true, otherwise null",
                  "alternatives": "clear English string of alternative time(s) the restaurant offered, or null",
                  "alternativesLocalized": "same alternative time(s) written naturally in ${uiLangName}, or null",
                  "notes": "one sentence summary in English of what happened",
                  "notesLocalized": "same summary written naturally in ${uiLangName}",
                  "depositRequested": true or false,
                  "depositAmount": number in smallest currency unit or null
                }
            `;

            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const result = await model.generateContent(evalPrompt);
            let rawText = result.response.text().trim();

            // Strip markdown code fences if Gemini adds them
            rawText = rawText.replace(/```json|```/g, '').trim();

            console.log('[Eval] Raw Gemini evaluation result:', rawText);

            let jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) rawText = jsonMatch[0];

            let evalResult = { success: false, confirmedTime: null, alternatives: null, notes: '' };
            try {
                evalResult = JSON.parse(rawText);
            } catch (e) {
                console.error('[Eval] JSON parse failed, raw text was:', rawText);
                // Only fall back to text search if truly unparseable
                evalResult.success = false; // Default to failure — safer than false positives
            }

            // Hardcode network/voicemail error overrides to prevent any AI hallucination of alternatives
            if (allRestaurantText.match(/number you have reached|voicemail|answering machine|0\s*4\s*7\s*6\s*4\s*5|unallocated|leave a message/i)) {
                evalResult.alternatives = null;
                evalResult.success = false;
                evalResult.notes = "The restaurant's phone number was not available or reached an automated voicemail.";
            }

            // ── Regex fallback: scan full conversation for time patterns if Gemini missed them ──
            if (!evalResult.success && !evalResult.alternatives) {
                const fullConvo = conversation;
                // Match patterns like 18:00, 6pm, 6:30 PM, 午後6時, 下午6點, 18時, 六點, 等等
                const timePatterns = [
                    /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/g,       // 18:00, 6:30 PM
                    /\b(\d{1,2})\s*(AM|PM|am|pm)\b/g,                  // 6pm, 11am
                    /([0-9]{1,2})時(半)?/g,                              // Japanese: 18時、6時半
                    /([0-9]{1,2}|[一二三四五六七八九十兩]+)點(半|[0-9]{1,2}分|[一二三四五六七八九十]+分)?/g,                              // Chinese: 6點、六點、六點半
                    /오후\s*([0-9]{1,2})\s*시/g,                         // Korean: 오후 6시
                    /오전\s*([0-9]{1,2})\s*시/g,                         // Korean AM
                ];
                const foundTimes = new Set();
                for (const pat of timePatterns) {
                    const matches = [...fullConvo.matchAll(pat)];
                    for (const m of matches) {
                        const raw = m[0].trim();
                        // Skip the originally requested time to avoid false positives
                        if (!callState.rawTime || !raw.includes(callState.rawTime.replace(':', '').substring(0, 2))) {
                            foundTimes.add(raw);
                        }
                    }
                }
                if (foundTimes.size > 0) {
                    // Only use regex results if Gemini didn't find any — log and apply
                    const regexAlt = [...foundTimes].slice(0, 3).join(' or ');
                    console.log('[Eval] Regex fallback found times:', regexAlt);
                    evalResult.alternatives = regexAlt;
                }
            }
            // ── End fallback ──

            const isSuccess = evalResult.success === true;
            const statusType = isSuccess ? 'success' : (evalResult.alternatives ? 'alternative' : 'failed');

            // ── Service Fee Handling ──────────────────────────────────────────
            let depositResult = null;
            if (isSuccess) {
                const serviceFeeAmt = 500; // $5.00
                depositResult = { requested: true, amount: serviceFeeAmt, currency: 'usd', charged: false, error: null };
                broadcastLog(callSid, 'system', `💳 Reservation successful. Attempting to charge $5 service fee…`);

                try {
                    if (!stripe) throw new Error('Stripe not configured');

                    // We must fetch the user to get their email, since this runs in a callback without req.user
                    const { data: user } = await supabase.from('users').select('email, name, created_at').eq('id', callState.userId).single();
                    if (!user?.email) throw new Error('Could not find user info');

                    // ── 1-WEEK FREE TRIAL LOGIC ──
                    const trialDurationMs = 7 * 24 * 60 * 60 * 1000;
                    const isFreeTrial = user.created_at && (Date.now() - new Date(user.created_at).getTime() < trialDurationMs);

                    if (isFreeTrial) {
                        const daysLeft = Math.ceil((trialDurationMs - (Date.now() - new Date(user.created_at).getTime())) / (1000 * 60 * 60 * 24));
                        depositResult.amount = 0;
                        depositResult.charged = true;
                        depositResult.isFreeTrial = true;
                        broadcastLog(callSid, 'system', `🎁 Free trial active! $5 service fee waived. (${daysLeft} days remaining)`);
                    } else {
                        let customerId = await getStripeCustomerId(user.email, user.name);
                        let paymentMethodToUse = null;

                        if (!customerId) throw new Error('No mapping to stripe account');

                        if (stripe) {
                            const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
                            paymentMethodToUse = pms.data.length ? pms.data[0].id : null;
                        }

                        if (!paymentMethodToUse) throw new Error('No payment method found');

                        let pi = { status: 'failed' };
                        pi = await stripe.paymentIntents.create({
                            amount: serviceFeeAmt,
                            currency: 'usd',
                            customer: customerId,
                            payment_method: paymentMethodToUse,
                            off_session: true,
                            confirm: true,
                            description: `Service fee for reservation at ${callState.restaurantPhone} on ${callState.rawDate}`
                        });

                        if (pi.status === 'succeeded') {
                            depositResult.charged = true;
                            broadcastLog(callSid, 'system', `✅ Service fee of $${(serviceFeeAmt / 100).toFixed(2)} charged successfully.`);
                        } else {
                            depositResult.error = `Payment status: ${pi.status}`;
                            broadcastLog(callSid, 'system', `⚠️ Service fee charge incomplete: ${pi.status}`);
                        }
                    }
                } catch (depErr) {
                    depositResult.error = depErr.message;
                    broadcastLog(callSid, 'system', `⚠️ Service fee charge failed: ${depErr.message}`);
                }
            }
            // ── End Deposit ──────────────────────────────────────────────────

            broadcastLog(callSid, 'status', JSON.stringify({
                type: statusType,
                confirmedTime: evalResult.confirmedTime,
                alternatives: evalResult.alternatives,
                alternativesLocalized: evalResult.alternativesLocalized || null,
                notes: evalResult.notes,
                notesLocalized: evalResult.notesLocalized || null,
                deposit: depositResult
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
                    status: statusType === 'success' ? 'confirmed' : statusType,
                    attemptCount: callState.attemptCount || 1,
                    alternatives: evalResult.alternatives || null,
                    notes: evalResult.notes || null,
                    callSid
                });
            }

            // Update scheduled_calls status if applicable
            if (callState.scheduledCallId) {
                await supabase.from('scheduled_calls').update({
                    status: statusType === 'success' ? 'completed' : statusType,
                    alternatives: evalResult.alternatives,
                    notes: evalResult.notes
                }).eq('id', callState.scheduledCallId);
            }

            // SMS the user with the outcome
            if (isSuccess) {
                let textMsg = `✅ Reservation confirmed! Table for ${callState.rawPeople} on ${callState.rawDate} at ${callState.rawTime} under "${callState.userName}".`;
                if (depositResult && depositResult.isFreeTrial) {
                    textMsg += `\n🎁 Your 1-Week Free Trial is active! The $5.00 service fee has been completely waived.`;
                } else if (depositResult && depositResult.charged) {
                    textMsg += `\nThe $5.00 service fee has been successfully charged.`;
                } else if (depositResult && depositResult.error) {
                    textMsg += `\n⚠️ We couldn't process the $5 service fee, but your reservation is confirmed.`;
                }
                await sendStatusSMS(callState.userPhone, textMsg);
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




const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend is running on http://0.0.0.0:${PORT}`);
});
