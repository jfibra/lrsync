const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');

    // Update all encrypted_passwords to use $2a$ instead of $2b$
    const result = await client.query(`
      UPDATE auth.users 
      SET encrypted_password = regexp_replace(encrypted_password, '^\\$2b\\$', '$2a$')
      WHERE encrypted_password LIKE '$2b$%';
    `);
    console.log(`Successfully updated prefix for ${result.rowCount} users in auth.users!`);

  } catch (err) {
    console.error('Error fixing bcrypt prefix:', err);
  } finally {
    await client.end();
  }
}
run();
