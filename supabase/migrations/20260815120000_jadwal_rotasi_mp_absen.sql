-- ============================================================================
-- JADWAL KERJA v2: ROTASI SHIFT + MAN POWER PLANNING + INTEGRASI ABSENSI
-- ----------------------------------------------------------------------------
-- 1. generate_jadwal_shift : Auto Generate dengan distribusi merata antar
--    beberapa shift (rotasi) untuk seluruh karyawan aktif pada cabang.
-- 2. rotate_jadwal_kerja   : "Putar Rotasi" — setiap karyawan naik satu shift
--    (urutan shift kerja diurutkan dari jam mulai: Pagi -> Siang -> Malam -> Pagi).
-- 3. man_power_plan        : kebutuhan jumlah karyawan per shift per hari.
--    save_man_power_plan   : simpan seluruh grid kebutuhan sekaligus.
-- 4. sinkron_absen_dari_jadwal : isi absensi 'hadir' untuk hari kerja sesuai
--    jadwal (sumber='jadwal'), tanpa menimpa catatan yang sudah ada.
-- ============================================================================

-- ---------- 1. RPC: GENERATE JADWAL DENGAN DISTRIBUSI SHIFT (ROTASI) ----------
CREATE OR REPLACE FUNCTION public.generate_jadwal_shift(
  p_branch UUID DEFAULT NULL,
  p_hari_kerja INTEGER[] DEFAULT ARRAY[0,1,2,3,4],
  p_shift_ids UUID[] DEFAULT NULL, -- template kerja yang dipakai rotasi (urut = urutan)
  p_istirahat_mulai TIME DEFAULT NULL,
  p_istirahat_selesai TIME DEFAULT NULL,
  p_nama_istirahat TEXT DEFAULT 'Istirahat'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e RECORD;
  h INTEGER;
  shift RECORD;
  i INTEGER := 0;
  n INTEGER;
  total INTEGER := 0;
BEGIN
  -- Jika tidak ada shift dipilih, pakai semua template kerja (urut jam mulai)
  IF p_shift_ids IS NULL OR array_length(p_shift_ids, 1) IS NULL OR array_length(p_shift_ids, 1) = 0 THEN
    SELECT array_agg(id ORDER BY jam_mulai) INTO p_shift_ids
    FROM public.jadwal_templates WHERE jenis = 'kerja' AND aktif = true;
  END IF;

  n := array_length(p_shift_ids, 1);
  IF n IS NULL OR n = 0 THEN
    RAISE EXCEPTION 'Tidak ada template shift kerja. Buat template kerja terlebih dahulu.';
  END IF;

  FOR e IN
    SELECT id FROM public.employees
    WHERE aktif = true AND (p_branch IS NULL OR branch_id = p_branch)
    ORDER BY nama
  LOOP
    -- Distribusi merata: karyawan ke-i mendapat shift ke-(i mod n) sesuai urutan
    SELECT * INTO shift FROM public.jadwal_templates WHERE id = p_shift_ids[(i % n) + 1];
    i := i + 1;

    DELETE FROM public.jadwal_kerja WHERE employee_id = e.id;

    FOR h IN SELECT unnest(p_hari_kerja) LOOP
      INSERT INTO public.jadwal_kerja (employee_id, hari, jenis, nama, jam_mulai, jam_selesai, warna, template_id)
      VALUES (e.id, h, 'kerja', shift.nama, shift.jam_mulai, shift.jam_selesai, shift.warna, shift.id);
      total := total + 1;

      IF p_istirahat_mulai IS NOT NULL AND p_istirahat_selesai IS NOT NULL THEN
        INSERT INTO public.jadwal_kerja (employee_id, hari, jenis, nama, jam_mulai, jam_selesai, warna)
        VALUES (e.id, h, 'istirahat', p_nama_istirahat, p_istirahat_mulai, p_istirahat_selesai, '#f59e0b');
        total := total + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_jadwal_shift(UUID, INTEGER[], UUID[], TIME, TIME, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_jadwal_shift(UUID, INTEGER[], UUID[], TIME, TIME, TEXT) TO authenticated, service_role;

-- ---------- 2. RPC: PUTAR ROTASI SHIFT ----------
CREATE OR REPLACE FUNCTION public.rotate_jadwal_kerja(p_branch UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e RECORD;
  t RECORD;
  n INTEGER;
  cur_idx INTEGER;
  idx INTEGER;
  emp_shift TEXT;
  d RECORD;
  total INTEGER := 0;
BEGIN
  SELECT count(*) INTO n FROM public.jadwal_templates WHERE jenis = 'kerja' AND aktif = true;
  IF n = 0 THEN
    RAISE EXCEPTION 'Tidak ada template shift kerja untuk rotasi.';
  END IF;

  FOR e IN
    SELECT id, nama FROM public.employees
    WHERE aktif = true AND (p_branch IS NULL OR branch_id = p_branch)
    ORDER BY nama
  LOOP
    -- Shift saat ini = nama blok kerja pertama karyawan yang cocok template
    SELECT t2.nama INTO emp_shift
    FROM public.jadwal_kerja j
    JOIN public.jadwal_templates t2 ON t2.nama = j.nama AND t2.jenis = 'kerja' AND t2.aktif = true
    WHERE j.employee_id = e.id AND j.jenis = 'kerja'
    ORDER BY j.jam_mulai
    LIMIT 1;

    IF emp_shift IS NULL THEN CONTINUE; END IF;

    -- Cari posisi shift saat ini dalam urutan rotasi (urut jam mulai)
    cur_idx := 0;
    idx := 0;
    FOR t IN
      SELECT * FROM public.jadwal_templates WHERE jenis = 'kerja' AND aktif = true ORDER BY jam_mulai
    LOOP
      IF t.nama = emp_shift THEN cur_idx := idx; END IF;
      idx := idx + 1;
    END LOOP;

    -- Shift berikutnya (wrap around)
    SELECT * INTO t
    FROM (
      SELECT * FROM public.jadwal_templates
      WHERE jenis = 'kerja' AND aktif = true
      ORDER BY jam_mulai
      OFFSET ((cur_idx + 1) % n)
    ) sub
    LIMIT 1;

    -- Ganti blok kerja karyawan (hari yang sama) dengan blok shift berikutnya
    FOR d IN
      SELECT DISTINCT hari FROM public.jadwal_kerja WHERE employee_id = e.id AND jenis = 'kerja'
    LOOP
      DELETE FROM public.jadwal_kerja WHERE employee_id = e.id AND jenis = 'kerja' AND hari = d.hari;
      INSERT INTO public.jadwal_kerja (employee_id, hari, jenis, nama, jam_mulai, jam_selesai, warna, template_id)
      VALUES (e.id, d.hari, 'kerja', t.nama, t.jam_mulai, t.jam_selesai, t.warna, t.id);
      total := total + 1;
    END LOOP;
  END LOOP;

  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_jadwal_kerja(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_jadwal_kerja(UUID) TO authenticated, service_role;

-- ---------- 3. TABEL: MAN POWER PLANNING ----------
CREATE TABLE IF NOT EXISTS public.man_power_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  hari INTEGER NOT NULL CHECK (hari BETWEEN 0 AND 6), -- 0=Senin .. 6=Minggu
  shift_nama TEXT NOT NULL,
  kebutuhan INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_mp_plan UNIQUE (branch_id, hari, shift_nama)
);
CREATE INDEX IF NOT EXISTS idx_mp_branch ON public.man_power_plan(branch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.man_power_plan TO authenticated;
GRANT ALL ON public.man_power_plan TO service_role;
ALTER TABLE public.man_power_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all man_power_plan" ON public.man_power_plan;
CREATE POLICY "auth all man_power_plan" ON public.man_power_plan FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_man_power_plan_updated ON public.man_power_plan;
CREATE TRIGGER trg_man_power_plan_updated BEFORE UPDATE ON public.man_power_plan FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 4. RPC: SIMPAN MAN POWER PLANNING (grid sekaligus) ----------
CREATE OR REPLACE FUNCTION public.save_man_power_plan(p_branch UUID, p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total INTEGER := 0;
BEGIN
  IF p_branch IS NULL THEN
    RAISE EXCEPTION 'Cabang wajib diisi untuk man power planning.';
  END IF;

  DELETE FROM public.man_power_plan WHERE branch_id = p_branch;

  INSERT INTO public.man_power_plan (branch_id, hari, shift_nama, kebutuhan)
  SELECT p_branch, (r->>'hari')::INTEGER, r->>'shift_nama', GREATEST(0, (r->>'kebutuhan')::INTEGER)
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS r
  WHERE r->>'shift_nama' IS NOT NULL;

  GET DIAGNOSTICS total = ROW_COUNT;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.save_man_power_plan(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_man_power_plan(UUID, JSONB) TO authenticated, service_role;

-- ---------- 5. RPC: SINKRON JADWAL -> ABSENSI ----------
-- Isi absensi status 'hadir' (sumber='jadwal') untuk tanggal yang merupakan
-- hari kerja sesuai jadwal. Catatan absensi yang sudah ada TIDAK ditimpa.
CREATE OR REPLACE FUNCTION public.sinkron_absen_dari_jadwal(
  p_mulai DATE DEFAULT NULL,
  p_selesai DATE DEFAULT NULL,
  p_branch UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE;
  x INTEGER;
  total INTEGER := 0;
  mulai DATE := COALESCE(p_mulai, current_date);
  selesai DATE := COALESCE(p_selesai, current_date);
BEGIN
  d := mulai;
  WHILE d <= selesai LOOP
    INSERT INTO public.absensi (employee_id, tanggal, status, keterangan, sumber)
    SELECT DISTINCT j.employee_id, d, 'hadir', 'Otomatis dari jadwal kerja', 'jadwal'
    FROM public.jadwal_kerja j
    JOIN public.employees em ON em.id = j.employee_id
    WHERE j.hari = EXTRACT(ISODOW FROM d)::INTEGER - 1 -- 0=Senin .. 6=Minggu
      AND j.jenis = 'kerja'
      AND em.aktif = true
      AND (p_branch IS NULL OR em.branch_id = p_branch)
      AND NOT EXISTS (
        SELECT 1 FROM public.absensi a
        WHERE a.employee_id = j.employee_id AND a.tanggal = d
      );

    GET DIAGNOSTICS x = ROW_COUNT;
    total := total + x;
    d := d + 1;
  END LOOP;

  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.sinkron_absen_dari_jadwal(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sinkron_absen_dari_jadwal(DATE, DATE, UUID) TO authenticated, service_role;
