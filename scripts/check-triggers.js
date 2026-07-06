const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(`
      SELECT 
        trigger_name, 
        event_manipulation, 
        action_statement, 
        action_timing
      FROM information_schema.triggers
      WHERE event_object_schema = 'auth' AND event_object_table = 'users';
    `);
    console.log('Triggers on auth.users:', res.rows);

    const res2 = await client.query(`
      SELECT 
        proname, 
        prosrc 
      FROM pg_proc 
      WHERE pronamespace = 'auth'::regnamespace OR proname LIKE '%profile%';
    `);
    console.log('Functions related to profile/auth:', res2.rows);

  } catch (err) {
    console.error('Error checking triggers:', err);
  } finally {
    await client.end();
  }
}
run();
