require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
    console.log("To add the necessary Stripe columns, please run this in your Supabase SQL Editor:");
    console.log("\nALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;");
    console.log("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';\n");
}
run();
