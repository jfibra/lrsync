const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Let's test with service role first, and then with anon key (authenticating first)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testWithAdmin() {
  console.log('--- Testing query with Admin/Service Role client ---');
  try {
    const totalCount = await supabaseAdmin.from("sales").select("*", { count: "exact", head: true });
    console.log('Total sales count in DB:', totalCount.count);

    const { data, error } = await supabaseAdmin
      .from("sales")
      .select(`
        *,
        taxpayer_listings (
          registered_name,
          substreet_street_brgy,
          district_city_zip
        )
      `)
      .limit(1);

    if (error) {
      console.error('❌ sales query error:', error);
    } else {
      console.log('✅ sales query succeeded! Rows:', data.length);
      if (data.length > 0) {
        console.log('Sample sale:', data[0]);
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

async function testWithAnon() {
  console.log('\n--- Testing query with Authenticated Anon client ---');
  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
  
  // Sign in as johnryfibra2@gmail.com
  const { data: sessionData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email: 'johnryfibra2@gmail.com',
    password: 'Temp123'
  });

  if (signInError) {
    console.error('❌ Sign in failed:', signInError);
    return;
  }
  console.log('✅ Signed in successfully.');

  try {
    const { data, error } = await supabaseAnon
      .from("sales")
      .select(`
        *,
        taxpayer_listings (
          registered_name,
          substreet_street_brgy,
          district_city_zip
        )
      `)
      .eq("is_deleted", false)
      .limit(1);

    if (error) {
      console.error('❌ sales query error:', error);
    } else {
      console.log('✅ sales query succeeded! Rows:', data.length);
    }

    // Check commission report query
    if (data && data.length > 0) {
      const saleId = data[0].id;
      const { data: reportsData, error: reportsError } = await supabaseAnon
        .from("commission_report")
        .select("report_number, sales_uuids, created_by, created_at, status, deleted_at")
        .overlaps("sales_uuids", [saleId]);

      if (reportsError) {
        console.error('❌ commission_report query error:', reportsError);
      } else {
        console.log('✅ commission_report query succeeded! Rows:', reportsData.length);
      }
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

async function run() {
  await testWithAdmin();
  await testWithAnon();
}

run();
