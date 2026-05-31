ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS branch_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_runs_branch_id_fkey'
      AND conrelid = 'public.payroll_runs'::regclass
  ) THEN
    ALTER TABLE public.payroll_runs
      ADD CONSTRAINT payroll_runs_branch_id_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.branches(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pr_branch_period
  ON public.payroll_runs(branch_id, periode);

NOTIFY pgrst, 'reload schema';
