const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename IN ('sales', 'commission_report', 'user_profiles');
    `);
    console.log('RLS Status:', res.rows);

    const res2 = await client.query(`
      SELECT * 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `);
    console.log('All public policies:', res2.rows.map(p => ({
      table: p.tablename,
      name: p.policyname,
      cmd: p.cmd,
      qual: p.qual
    })));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
run();
