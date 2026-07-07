const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: missing Supabase URL or Anon Key.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/test-signin.js <email>');
    process.exit(1);
  }

  console.log(`Attempting to sign in user: ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: 'Temp123'
  });

  if (error) {
    console.error('❌ Sign in failed:', error);
  } else {
    console.log('✅ Sign in successful!', data.session ? 'Session created' : 'No session');
  }
}
run();
