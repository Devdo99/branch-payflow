const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('missing env', { url, key });
  process.exit(1);
}
const supabase = createClient(url, key);
(async () => {
  const { data: runs, error: runErr } = await supabase.from('payroll_runs').select('*').order('periode', { ascending: false }).limit(5);
  console.log('runs count', runs?.length, 'err', JSON.stringify(runErr));
  console.log(JSON.stringify(runs?.slice(0,5), null, 2));
  const q = await supabase.from('payroll_items').select('*, payroll_runs (*), employees (*, branches (*))').limit(5);
  console.log('items err', JSON.stringify(q.error));
  console.log(JSON.stringify(q.data?.slice(0,5), null, 2));
  process.exit(0);
})();
