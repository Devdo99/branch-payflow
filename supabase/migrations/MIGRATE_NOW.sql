-- ============================================================================
-- FIX: Kalender Cuti Kosong untuk User Publik
-- Jalankan SQL ini di Supabase Dashboard > SQL Editor
-- https://supabase.com/dashboard/project/fbnjacadlbpmvxtgmyzl/sql/new
-- ============================================================================

-- ---------- get_cuti_preview: calendar preview for public form ----------
-- SECURITY DEFINER function bypasses RLS so the anon (public) form can
-- read leave data for the calendar preview.
CREATE OR REPLACE FUNCTION public.get_cuti_preview()
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  jenis TEXT,
  tanggal_mulai DATE,
  tanggal_selesai DATE,
  status TEXT,
  tanggal_list JSONB,
  nama TEXT,
  branch_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    c.id,
    c.employee_id,
    c.jenis,
    c.tanggal_mulai,
    c.tanggal_selesai,
    c.status,
    c.tanggal_list,
    e.nama,
    e.branch_id
  FROM public.cuti c
  JOIN public.employees e ON e.id = c.employee_id
  WHERE c.status IN ('diajukan', 'disetujui')
  ORDER BY c.tanggal_mulai DESC;
$$;

REVOKE ALL ON FUNCTION public.get_cuti_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cuti_preview() TO anon, authenticated;

-- ---------- get_branch_info: kuota info for public form ----------
-- SECURITY DEFINER function to read branch kuota data (RLS blocks anon).
CREATE OR REPLACE FUNCTION public.get_branch_info(p_branch_id UUID)
RETURNS TABLE (
  nama TEXT,
  kuota_cuti_hari_kerja INTEGER,
  kuota_cuti_akhir_pekan INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT b.nama, b.kuota_cuti_hari_kerja, b.kuota_cuti_akhir_pekan
  FROM public.branches b
  WHERE b.id = p_branch_id;
$$;

REVOKE ALL ON FUNCTION public.get_branch_info(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_branch_info(UUID) TO anon, authenticated;
