import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs';
const url = 'https://fbnjacadlbpmvxtgmyzl.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibmphY2FkbGJwbXZ4dGdteXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTE4NTAsImV4cCI6MjA5NTY4Nzg1MH0.1IDmNKUCeOz-ELmIhecHZbSWlGJKAR22iivNTTQkzNg';
const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('payroll_items').select('id,payroll_run_id,gaji_bersih,payroll_runs!left(periode,branch_id)');
  console.log('error', error);
  console.log('count', data?.length);
  if (data) {
    for (const row of data.slice(0, 20)) {
      console.log(JSON.stringify(row));
    }
  }
}

main().catch((err) => {
  console.error('caught', err);
  process.exit(1);
});