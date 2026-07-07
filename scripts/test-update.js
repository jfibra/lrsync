const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');

    console.log('Attempting manual update of last_sign_in_at on imported user...');
    await client.query("UPDATE auth.users SET last_sign_in_at = NOW() WHERE id = 'cf82f7ac-8f88-4b93-8da4-d24db6b87984'");
    console.log('✅ Update successful!');
  } catch (err) {
    console.error('❌ Update failed:', err);
  } finally {
    await client.end();
  }
}
run();
