const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: missing Supabase URL or Service Key.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const pgClient = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'Temp123';

    console.log(`Signing up test user: ${testEmail}...`);
    // Sign up using admin API to avoid email confirmation requirements
    const customId = '99999999-9999-9999-9999-999999999999';
    const { data, error } = await supabase.auth.admin.createUser({
      id: customId,
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (error) {
      console.error('❌ Sign up error:', error);
      process.exit(1);
    }

    const userId = data.user.id;
    console.log(`✅ Test user created in Supabase with ID: ${userId}`);

    // Query database directly to see the row contents for users and identities
    await pgClient.connect();
    
    console.log('\n--- Querying auth.users row ---');
    const userRes = await pgClient.query('SELECT * FROM auth.users WHERE id = $1', [userId]);
    console.log(userRes.rows[0]);

    console.log('\n--- Querying auth.identities row ---');
    const identityRes = await pgClient.query('SELECT * FROM auth.identities WHERE user_id = $1', [userId]);
    console.log(identityRes.rows[0]);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pgClient.end();
  }
}
run();
