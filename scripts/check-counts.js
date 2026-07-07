const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');

    const tables = [
      'user_profiles',
      'taxpayer_listings',
      'sales',
      'notifications',
      'purchases_categories',
      'purchases',
      'invoices',
      'commission_report',
      'commission_agent_breakdown',
      'user_activity_logs',
      'user_login_history'
    ];

    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM public.${table}`);
      console.log(`${table}: ${res.rows[0].count}`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
run();
