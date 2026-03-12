// One-time DB setup script — run with: node setup_db.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function setup() {
    console.log('🔧 Setting up Supabase tables...\n');

    // Test connection first
    const { data: test, error: testErr } = await supabase.from('users').select('id').limit(1);
    if (testErr && testErr.code !== 'PGRST116' && !testErr.message.includes('does not exist')) {
        // Table might not exist yet — that's fine, we'll create them via SQL below
        console.log('ℹ️  Tables may not exist yet, will try to create them.');
    } else if (!testErr) {
        console.log('✅ users table already exists! Skipping creation.');
        await checkReservations();
        return;
    }

    // Use Supabase SQL API to create tables
    const SQL_USERS = `
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `;

    const SQL_RESERVATIONS = `
        CREATE TABLE IF NOT EXISTS reservations (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
            restaurant_phone TEXT,
            date TEXT,
            time TEXT,
            people TEXT,
            guest_name TEXT,
            status TEXT DEFAULT 'confirmed',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `;

    // Try via pg REST
    const res1 = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
        headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` }
    });

    console.log('📡 Supabase connection status:', res1.status);
    console.log('\n📋 Please run these SQL statements in your Supabase SQL Editor:');
    console.log('   Dashboard → SQL Editor → New Query\n');
    console.log('-- ===== COPY AND PASTE THIS INTO SUPABASE SQL EDITOR =====\n');
    console.log(SQL_USERS);
    console.log(SQL_RESERVATIONS);
    console.log('-- ==========================================================\n');
    console.log('After running, press Ctrl+C and restart the server.');
}

async function checkReservations() {
    const { error } = await supabase.from('reservations').select('id').limit(1);
    if (error && error.message.includes('does not exist')) {
        console.log('⚠️  reservations table missing. Add it in Supabase SQL Editor:\n');
        console.log(`CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    restaurant_phone TEXT,
    date TEXT,
    time TEXT,
    people TEXT,
    guest_name TEXT,
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);`);
    } else {
        console.log('✅ reservations table exists!');
        console.log('\n🎉 All tables ready. Your CRM system is persistent!');
    }
}

setup().catch(console.error);
