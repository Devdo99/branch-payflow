-- ============================================================================
-- MULTI-TANGGAL CUTI: dukung pemilihan tanggal terpisah dalam 1 permohonan
-- ----------------------------------------------------------------------------
-- tambah kolom tanggal_list JSONB (array YYYY-MM-DD)
-- trigger untuk auto-fill tanggal_mulai/tanggal_selesai dari min/max
-- update RPC cek_kuota_cuti & cek_duplikat_cuti untuk dukung tanggal_list
-- ============================================================================

-- ---------- 1. Kolom tanggal_list ----------
ALTER TABLE public.cuti
  ADD COLUMN IF NOT EXISTS tanggal_list JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Isi tanggal_list dari data lama (range -> array)
UPDATE public.cuti
SET tanggal_list = (
  SELECT jsonb_agg(d::text ORDER BY d::text)
  FROM generate_series(tanggal_mulai, tanggal_selesai, '1 day'::interval) AS d(dt)
)
WHERE tanggal_list = '[]'::jsonb OR tanggal_list IS NULL;

-- ---------- 2. Trigger: auto-fill tanggal_mulai/selesai dari tanggal_list ----------
CREATE OR REPLACE FUNCTION public.set_cuti_tanggal_range()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  arr jsonb;
BEGIN
  arr := NEW.tanggal_list;
  IF arr IS NULL OR jsonb_array_length(arr) = 0 THEN
    -- fallback ke tanggal_mulai/selesai (untuk kompatibilitas form lama)
    IF NEW.tanggal_mulai IS NOT NULL AND NEW.tanggal_selesai IS NOT NULL THEN
      arr := (
        SELECT jsonb_agg(d::text ORDER BY d::text)
        FROM generate_series(NEW.tanggal_mulai, NEW.tanggal_selesai, '1 day'::interval) AS d(dt)
      );
      NEW.tanggal_list := arr;
    END IF;
  ELSE
    -- Hitung min/max dari array
    SELECT min(d::date), max(d::date)
    INTO NEW.tanggal_mulai, NEW.tanggal_selesai
    FROM jsonb_array_elements_text(arr) AS d(d);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cuti_tanggal_range ON public.cuti;
CREATE TRIGGER trg_cuti_tanggal_range
  BEFORE INSERT OR UPDATE ON public.cuti
  FOR EACH ROW EXECUTE FUNCTION public.set_cuti_tanggal_range();

-- ---------- 3. Update RPC cek_kuota_cuti: pakai tanggal_list ----------
DROP FUNCTION IF EXISTS public.cek_kuota_cuti(DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION public.cek_kuota_cuti(p_mulai DATE, p_selesai DATE, p_branch UUID DEFAULT NULL)
RETURNS TABLE (tanggal DATE, kuota INTEGER, terpakai INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  d DATE;
  max_kuota INTEGER;
  dipakai INTEGER;
  b_kerja INTEGER;
  b_pekan INTEGER;
BEGIN
  SELECT kuota_cuti_hari_kerja, kuota_cuti_akhir_pekan INTO b_kerja, b_pekan
  FROM public.branches WHERE id = p_branch;

  d := p_mulai;
  WHILE d <= p_selesai LOOP
    IF EXTRACT(ISODOW FROM d) IN (6, 7) THEN
      max_kuota := COALESCE(b_pekan, 1);
    ELSE
      max_kuota := COALESCE(b_kerja, 2);
    END IF;

    -- Cek kuota memakai tanggal_list (atau range untuk data lama)
    SELECT count(*) INTO dipakai
    FROM public.cuti c
    WHERE c.status = 'disetujui'
      AND (p_branch IS NULL OR c.branch_id = p_branch)
      AND (
        -- Cek via tanggal_list (pendekatan baru)
        EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(c.tanggal_list) AS t
          WHERE t::date = d
        )
        -- Fallback ke range (data lama yg belum punya tanggal_list)
        OR (c.tanggal_mulai <= d AND c.tanggal_selesai >= d)
      );

    tanggal := d;
    kuota := max_kuota;
    terpakai := dipakai;
    RETURN NEXT;
    d := d + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.cek_kuota_cuti(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cek_kuota_cuti(DATE, DATE, UUID) TO anon, authenticated;

-- ---------- 4. Update cek_duplikat_cuti ----------
CREATE OR REPLACE FUNCTION public.cek_duplikat_cuti(p_emp UUID, p_mulai DATE, p_selesai DATE)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cuti c
    WHERE c.employee_id = p_emp
      AND c.status IN ('diajukan', 'disetujui')
      AND c.tanggal_mulai <= p_selesai
      AND c.tanggal_selesai >= p_mulai
  );
$$;

REVOKE ALL ON FUNCTION public.cek_duplikat_cuti(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cek_duplikat_cuti(UUID, DATE, DATE) TO anon, authenticated;

-- ---------- 5. Update sync_absensi_dari_cuti trigger untuk pakai tanggal_list ----------
CREATE OR REPLACE FUNCTION public.sync_absensi_dari_cuti()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE;
  label TEXT;
  arr jsonb;
BEGIN
  DELETE FROM public.absensi
  WHERE cuti_id = COALESCE(NEW.id, OLD.id)
    AND sumber = 'cuti'
    AND (TG_OP <> 'UPDATE' OR NEW.status <> 'disetujui'
         OR tanggal < NEW.tanggal_mulai OR tanggal > NEW.tanggal_selesai);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.status = 'disetujui' THEN
    label := CASE NEW.jenis
      WHEN 'tahunan'   THEN 'Cuti Tahunan'
      WHEN 'sakit'     THEN 'Cuti Sakit'
      WHEN 'izin'      THEN 'Cuti Izin'
      WHEN 'besar'     THEN 'Cuti Besar'
      WHEN 'melahirkan' THEN 'Cuti Melahirkan'
      ELSE 'Cuti Lainnya'
    END;

    arr := NEW.tanggal_list;
    IF jsonb_array_length(arr) > 0 THEN
      -- Iterasi dari tanggal_list (multi-tanggal)
      FOR d IN
        SELECT d::date FROM jsonb_array_elements_text(arr) AS t(d)
        ORDER BY d::date
      LOOP
        INSERT INTO public.absensi (employee_id, tanggal, status, keterangan, sumber, cuti_id)
        VALUES (NEW.employee_id, d, 'cuti', label, 'cuti', NEW.id)
        ON CONFLICT (employee_id, tanggal) DO UPDATE
          SET status = 'cuti',
              keterangan = EXCLUDED.keterangan,
              sumber = 'cuti',
              cuti_id = EXCLUDED.cuti_id
          WHERE public.absensi.sumber = 'cuti'
            AND public.absensi.cuti_id = EXCLUDED.cuti_id;
      END LOOP;
    ELSE
      -- Fallback ke range
      d := NEW.tanggal_mulai;
      WHILE d <= NEW.tanggal_selesai LOOP
        INSERT INTO public.absensi (employee_id, tanggal, status, keterangan, sumber, cuti_id)
        VALUES (NEW.employee_id, d, 'cuti', label, 'cuti', NEW.id)
        ON CONFLICT (employee_id, tanggal) DO UPDATE
          SET status = 'cuti',
              keterangan = EXCLUDED.keterangan,
              sumber = 'cuti',
              cuti_id = EXCLUDED.cuti_id
          WHERE public.absensi.sumber = 'cuti'
            AND public.absensi.cuti_id = EXCLUDED.cuti_id;
        d := d + 1;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;