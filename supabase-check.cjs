const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('missing env', { url, key });
  process.exit(1);
}
const supabase = createClient(url, key);
(async () => {
  const [{ data: runs, error: runErr, count: runCount }, { data: items, error: itemErr, count: itemCount }] = await Promise.all([
    supabase.from('payroll_runs').select('*', { count: 'exact', head: true }),
    supabase
      .from('payroll_items')
      .select('*, payroll_runs (*), employees (*, branches (*))', { count: 'exact', head: true }),
  ]);
  console.log('runs count', runCount, 'err', JSON.stringify(runErr));
  console.log('items count', itemCount, 'err', JSON.stringify(itemErr));
  if (items) {
    const sample = await supabase
      .from('payroll_items')
      .select('*, payroll_runs (*), employees (*, branches (*))')
      .limit(5);
    console.log('sample items err', JSON.stringify(sample.error));
    console.log(JSON.stringify(sample.data?.slice(0,5), null, 2));
  }
  process.exit(0);
})();
