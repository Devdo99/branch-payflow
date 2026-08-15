const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ============================================================================
// MIGRASI DATABASE SUPABASE — setup permanen
// ----------------------------------------------------------------------------
// Cara pakai (kapan saja, tanpa tempel kunci):
//   1) Simpan password postgres sekali saja di file .env.local (TIDAK di-commit):
//        DBPASS=password_postgres_anda
//   2) Jalankan:  npm run migrate
// Script ini otomatis membaca .env / .env.local lalu menerapkan MIGRASI_TERBARU.sql.
// ============================================================================

// Muat .env / .env.local ke process.env (tanpa menimpa variabel yang sudah ada)
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!m) return;
      const key = m[1];
      let value = m[2] || '';
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    });
}
loadEnvFile(path.resolve('.env'));
loadEnvFile(path.resolve('.env.local'));

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
  if (!process.env.DBPASS) {
    console.error('FAILED: DBPASS tidak ditemukan.');
    console.error('Buat file .env.local berisi:  DBPASS=password_postgres_anda');
    process.exit(1);
  }
  await client.connect();
  console.log('CONNECTED_OK');
  await client.query(sql);
  console.log('MIGRATION_DONE');
  await client.end();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
