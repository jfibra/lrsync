const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();

  console.log('--- TEST USER (WORKING) ---');
  const testRes = await client.query("SELECT * FROM auth.users WHERE email LIKE 'test_%' ORDER BY created_at DESC LIMIT 1");
  console.log(testRes.rows[0]);

  console.log('\n--- IMPORTED USER (FAILING) ---');
  const impRes = await client.query("SELECT * FROM auth.users WHERE email = 'johnryfibra2@gmail.com'");
  console.log(impRes.rows[0]);

  console.log('\n--- TEST IDENTITY (WORKING) ---');
  const testIdRes = await client.query("SELECT * FROM auth.identities WHERE email LIKE 'test_%' ORDER BY created_at DESC LIMIT 1");
  console.log(testIdRes.rows[0]);

  console.log('\n--- IMPORTED IDENTITY (FAILING) ---');
  const impIdRes = await client.query("SELECT * FROM auth.identities WHERE email = 'johnryfibra2@gmail.com'");
  console.log(impIdRes.rows[0]);

  await client.end();
}
run();
