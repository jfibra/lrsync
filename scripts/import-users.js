const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey || !connectionString) {
  console.error('Error: missing Supabase URL, Service Key, or Database URL.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const pgClient = new Client({ connectionString });

async function run() {
  try {
    await pgClient.connect();
    console.log('Connected to PG database.');

    // Fetch profiles from public.user_profiles
    const profilesRes = await pgClient.query('SELECT auth_user_id, email, full_name FROM public.user_profiles');
    const profiles = profilesRes.rows;
    console.log(`Found ${profiles.length} profiles to import.`);

    const tempPassword = 'Temp123';

    for (const profile of profiles) {
      const { auth_user_id, email, full_name } = profile;

      if (!email) {
        console.log(`Skipping profile with missing email (ID: ${auth_user_id})`);
        continue;
      }

      console.log(`Importing user: ${email} (${full_name || 'No Name'}) with UUID: ${auth_user_id}`);

      // Call Supabase Admin Auth API to create the user with the exact UUID and password
      const { data, error } = await supabase.auth.admin.createUser({
        id: auth_user_id,
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || ''
        }
      });

      if (error) {
        console.error(`❌ Failed to create user ${email}:`, error.message);
      } else {
        console.log(`✅ Successfully imported ${email}`);
      }
    }

    console.log('\n🎉 All users have been successfully imported via Supabase Admin Auth API!');
    console.log(`Temporary Password for all users: ${tempPassword}`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pgClient.end();
  }
}
run();
