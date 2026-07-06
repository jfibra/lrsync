const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: limitData, error: limitError } = await supabase
    .from("sales")
    .select("id")
    .limit(10000);

  if (limitError) {
    console.error('limit error:', limitError);
  } else {
    console.log('Rows returned with .limit(10000):', limitData.length);
  }

  const { data: rangeData, error: rangeError } = await supabase
    .from("sales")
    .select("id")
    .range(0, 9999);

  if (rangeError) {
    console.error('range error:', rangeError);
  } else {
    console.log('Rows returned with .range(0, 9999):', rangeData.length);
  }
}
run();
