require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    console.log("Data:", data);
    console.log("Error:", error);
}
check();
