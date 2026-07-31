import fs from 'fs';
import path from 'path';

// Load .env variables if not present in process.env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remove surrounding quotes if any
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from environment/config.");
  process.exit(1);
}

const targetUrl = `${url.replace(/\/$/, '')}/rest/v1/branches?limit=1`;

console.log(`Pinging Supabase at: ${url}`);
console.log(`Target endpoint: ${targetUrl}`);

fetch(targetUrl, {
  method: 'GET',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(res => {
  if (res.ok) {
    console.log(`Success! Supabase returned HTTP ${res.status}. Database is active.`);
    process.exit(0);
  } else {
    return res.text().then(text => {
      console.error(`Failed! Supabase returned HTTP ${res.status}. Error: ${text}`);
      process.exit(1);
    });
  }
})
.catch(err => {
  console.error(`Network Error: ${err.message}`);
  process.exit(1);
});
