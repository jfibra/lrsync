const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: 'johnryfibra2@gmail.com',
    password: 'Temp123'
  });
  if (signInError) {
    console.error('Sign in failed:', signInError);
    return;
  }
  console.log('✅ Sign in successful.');

  try {
    // Step 1: Query sales
    console.log('\n--- Step 1: Querying Sales ---');
    const { data: salesData, error: salesError } = await supabase
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
      .order("created_at", { ascending: true });

    if (salesError) {
      console.error('❌ Step 1 failed:', salesError);
      return;
    }
    console.log(`✅ Step 1 succeeded. Found ${salesData.length} sales.`);

    // Step 2: Query user profiles
    console.log('\n--- Step 2: Querying User Profiles ---');
    const userUuids = [...new Set(salesData.map((sale) => sale.user_uuid).filter(Boolean))];
    console.log('Unique user UUIDs:', userUuids);

    let userProfiles = [];
    if (userUuids.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("user_profiles")
        .select("auth_user_id, assigned_area, full_name")
        .in("auth_user_id", userUuids);

      if (profilesError) {
        console.error('❌ Step 2 failed:', profilesError);
        return;
      }
      userProfiles = profilesData || [];
      console.log(`✅ Step 2 succeeded. Found ${userProfiles.length} profiles.`);
    } else {
      console.log('No user UUIDs to fetch.');
    }

    // Step 3: Query commission report
    console.log('\n--- Step 3: Querying Commission Reports ---');
    const saleIds = salesData.map((sale) => sale.id);
    console.log(`Total sale IDs to check overlaps: ${saleIds.length}`);

    if (saleIds.length > 0) {
      // Chunk saleIds to avoid massive array size in one query if needed,
      // but let's test the exact overlaps query first
      const { data: reportsData, error: reportsError } = await supabase
        .from("commission_report")
        .select("report_number, sales_uuids, created_by, created_at, status, deleted_at")
        .overlaps("sales_uuids", saleIds);

      if (reportsError) {
        console.error('❌ Step 3 failed:', reportsError);
        return;
      }
      console.log(`✅ Step 3 succeeded. Found ${reportsData.length} reports.`);
    } else {
      console.log('No sale IDs to check.');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

run();
