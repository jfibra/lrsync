const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');

    console.log('Clearing all users from auth.users (cascading)...');
    await client.query('TRUNCATE auth.users CASCADE');
    console.log('✅ Users cleared successfully!');

  } catch (err) {
    console.error('Error clearing users:', err);
  } finally {
    await client.end();
  }
}
run();
