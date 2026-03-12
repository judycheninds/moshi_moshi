// One-time DB setup script — run with: node setup_db.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function setup() {
    console.log('🔧 Verifying Supabase tables...\n');

    const { error: usersErr } = await supabase.from('users').select('id').limit(1);
    const { error: resErr } = await supabase.from('reservations').select('id').limit(1);
    const { error: schErr } = await supabase.from('scheduled_calls').select('id').limit(1);

    if (!usersErr) console.log('✅ users table exists');
    else console.log('❌ users table missing');

    if (!resErr) console.log('✅ reservations table exists');
    else console.log('❌ reservations table missing');

    if (!schErr) console.log('✅ scheduled_calls table exists');
    else console.log('⚠️  scheduled_calls table missing — run the SQL below in Supabase SQL Editor\n');

    console.log('\n-- ===== RUN THIS IN SUPABASE SQL EDITOR IF NEEDED =====\n');
    console.log(`
-- Add smart-agent columns to reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 1;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS alternatives TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS call_sid TEXT;

-- Scheduled calls table
CREATE TABLE IF NOT EXISTS scheduled_calls (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    restaurant_phone TEXT NOT NULL,
    user_name TEXT,
    user_phone TEXT,
    date TEXT,
    time TEXT,
    alt_time1 TEXT,
    alt_time2 TEXT,
    people TEXT,
    language TEXT DEFAULT 'ja-JP',
    scheduled_at TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending',
    alternatives TEXT,
    notes TEXT,
    call_sid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
`);
    console.log('-- =====================================================\n');
}

setup().catch(console.error);
