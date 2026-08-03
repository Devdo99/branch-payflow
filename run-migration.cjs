const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const sqlPath = path.resolve('MIGRASI_TERBARU.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new Client({
  host: 'db.fbnjacadlbpmvxtgmyzl.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DBPASS,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

(async () => {
  await client.connect();
  console.log('CONNECTED_OK');
  await client.query(sql);
  console.log('MIGRATION_DONE');
  await client.end();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
