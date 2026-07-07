const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT id, email, raw_app_meta_data, raw_user_meta_data FROM auth.users LIMIT 5;
  `);
  console.log('users rows:', res.rows);
  
  const res2 = await client.query(`
    SELECT * FROM auth.identities LIMIT 5;
  `);
  console.log('identities rows:', res2.rows);
  await client.end();
}
run();
