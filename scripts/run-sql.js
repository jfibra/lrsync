const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/run-sql.js <path-to-sql-file>');
    process.exit(1);
  }

  try {
    await client.connect();
    const sql = fs.readFileSync(filePath, 'utf8');
    await client.query(sql);
    console.log(`Executed SQL file ${filePath} successfully.`);
  } catch (err) {
    console.error('Error executing SQL file:', err);
  } finally {
    await client.end();
  }
}
run();
