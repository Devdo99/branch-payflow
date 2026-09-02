-- ============================================================================
-- FIX: Allow the public request-cuti form to read leave data for calendar preview
-- The public form uses the anon key, but the cuti table only has RLS policies
-- for authenticated users. This SECURITY DEFINER function bypasses RLS to
-- return the fields needed for the calendar preview (no sensitive data exposed).
-- ============================================================================

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

-- Allow anon and authenticated to call this function
REVOKE ALL ON FUNCTION public.get_cuti_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cuti_preview() TO anon, authenticated;

-- ---------- SECURITY DEFINER: Get branch info for public form ----------
-- The branches table has RLS for authenticated only, so the public form
-- cannot read branch data (kuota, nama). This function bypasses RLS.
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
