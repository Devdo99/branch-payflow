-- ============================================================
-- MIGRASI SUPABASE TERBARU — Jalankan di SQL Editor (dashboard)
-- ============================================================
-- Gabungan dari:
--   1) 20260803140000_jadwal_cuti_cabang.sql
--   2) 20260803150000_cuti_multi_tanggal.sql
--   3) 20260803160000_rekap_cuti_dan_sinkron.sql (BAGIAN 3 di bawah)
-- Buka: https://supabase.com/dashboard/project/fbnjacadlbpmvxtgmyzl/sql/new
-- ============================================================

-- ============================================================================
-- JADWAL CUTI PER CABANG + SINKRON ABSENSI + SHARE KALENDER KE GRUP WA
-- ----------------------------------------------------------------------------
-- 1. Cabang: kuota cuti per cabang (bisa berbeda antar cabang) + grup WA
--    untuk berbagi kalender cuti.
-- 2. Cuti: branch_id diisi otomatis dari karyawan -> jadwal per cabang.
-- 3. Absensi: status 'cuti' dibuat otomatis dari cuti yang DISETUJUI
--    (bisa dioverride manual dari halaman Rekap Absen).
-- 4. RPC kuota mendukung filter per cabang + nilai kuota dari cabang.
-- ============================================================================

-- ---------- 1. CABANG: kuota & grup WA ----------
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS kuota_cuti_hari_kerja INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS kuota_cuti_akhir_pekan INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS wa_group_jid TEXT,
  ADD COLUMN IF NOT EXISTS wa_group_nama TEXT;

-- ---------- 2. CUTI: branch_id ----------
ALTER TABLE public.cuti
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cuti_branch ON public.cuti(branch_id);

-- Isi branch_id dari karyawan untuk data lama
UPDATE public.cuti c
SET branch_id = e.branch_id
FROM public.employees e
WHERE c.employee_id = e.id
  AND c.branch_id IS NULL;

-- Trigger: set branch_id otomatis saat insert/update cuti
-- SECURITY DEFINER: form publik (anon) insert ke cuti, tapi tidak boleh gagal
-- saat membaca employees (hanya dibaca dari tabel karyawan).
CREATE OR REPLACE FUNCTION public.set_cuti_branch_id()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM public.employees WHERE id = NEW.employee_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cuti_branch ON public.cuti;
CREATE TRIGGER trg_cuti_branch
  BEFORE INSERT OR UPDATE ON public.cuti
  FOR EACH ROW EXECUTE FUNCTION public.set_cuti_branch_id();

-- ---------- 3. ABSENSI: sinkron otomatis dari cuti yang disetujui ----------
ALTER TABLE public.absensi
  ADD COLUMN IF NOT EXISTS sumber TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'cuti'
  ADD COLUMN IF NOT EXISTS cuti_id UUID REFERENCES public.cuti(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_absensi_cuti ON public.absensi(cuti_id);

CREATE OR REPLACE FUNCTION public.sync_absensi_dari_cuti()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE;
  label TEXT;
BEGIN
  -- Hapus baris otomatis milik cuti ini yang tidak lagi relevan
  -- (baris yang sudah dioverride manual dengan sumber='manual' tidak disentuh)
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_absensi_cuti ON public.cuti;
CREATE TRIGGER trg_sync_absensi_cuti
  AFTER INSERT OR UPDATE OR DELETE ON public.cuti
  FOR EACH ROW EXECUTE FUNCTION public.sync_absensi_dari_cuti();

-- Backfill absensi 'cuti' untuk cuti yang sudah disetujui
-- (baris manual yang sudah ada tidak ditimpa)
INSERT INTO public.absensi (employee_id, tanggal, status, keterangan, sumber, cuti_id)
SELECT c.employee_id, d.dt::date, 'cuti',
       CASE c.jenis
         WHEN 'tahunan'   THEN 'Cuti Tahunan'
         WHEN 'sakit'     THEN 'Cuti Sakit'
         WHEN 'izin'      THEN 'Cuti Izin'
         WHEN 'besar'     THEN 'Cuti Besar'
         WHEN 'melahirkan' THEN 'Cuti Melahirkan'
         ELSE 'Cuti Lainnya'
       END,
       'cuti', c.id
FROM public.cuti c
CROSS JOIN LATERAL generate_series(c.tanggal_mulai, c.tanggal_selesai, '1 day'::interval) AS d(dt)
WHERE c.status = 'disetujui'
ON CONFLICT (employee_id, tanggal) DO NOTHING;

-- ---------- 4. RPC kuota per cabang ----------
-- Buang versi lama (2 argumen, kuota global) agar tidak tertinggal sebagai overload
DROP FUNCTION IF EXISTS public.cek_kuota_cuti(DATE, DATE);

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
  -- Kuota default (2 hari kerja / 1 akhir pekan) bila cabang tidak diatur
  SELECT kuota_cuti_hari_kerja, kuota_cuti_akhir_pekan INTO b_kerja, b_pekan
  FROM public.branches
  WHERE id = p_branch;

  d := p_mulai;
  WHILE d <= p_selesai LOOP
    -- ISODOW: 1=Sen .. 7=Minggu, sehingga 6=Sabtu, 7=Minggu
    IF EXTRACT(ISODOW FROM d) IN (6, 7) THEN
      max_kuota := COALESCE(b_pekan, 1);
    ELSE
      max_kuota := COALESCE(b_kerja, 2);
    END IF;

    SELECT count(*) INTO dipakai
    FROM public.cuti c
    WHERE c.status = 'disetujui'
      AND c.tanggal_mulai <= d
      AND c.tanggal_selesai >= d
      AND (p_branch IS NULL OR c.branch_id = p_branch);

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

-- ---------- 5. RPC pencarian karyawan ikut mengembalikan cabang ----------
-- Tipe return berubah (tambah branch_id) -> DROP dulu sebelum CREATE ulang
DROP FUNCTION IF EXISTS public.cari_karyawan_oleh_wa(TEXT);

CREATE OR REPLACE FUNCTION public.cari_karyawan_oleh_wa(p_wa TEXT)
RETURNS TABLE (id UUID, nama TEXT, whatsapp TEXT, branch_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH input AS (
    SELECT regexp_replace(p_wa, '[^0-9]', '', 'g') AS digits
  ),
  normalized AS (
    SELECT
      e.id,
      e.nama,
      e.whatsapp,
      e.branch_id,
      CASE
        WHEN regexp_replace(e.whatsapp, '[^0-9]', '', 'g') LIKE '0%'
          THEN '62' || substr(regexp_replace(e.whatsapp, '[^0-9]', '', 'g'), 2)
        ELSE regexp_replace(e.whatsapp, '[^0-9]', '', 'g')
      END AS emp_wa,
      CASE
        WHEN input.digits LIKE '0%' THEN '62' || substr(input.digits, 2)
        ELSE input.digits
      END AS in_wa
    FROM public.employees e
    CROSS JOIN input
    WHERE e.aktif = true
      AND e.whatsapp IS NOT NULL
  )
  SELECT n.id, n.nama, n.whatsapp, n.branch_id
  FROM normalized n
  WHERE n.emp_wa = n.in_wa
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.cari_karyawan_oleh_wa(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cari_karyawan_oleh_wa(TEXT) TO anon, authenticated;

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
      -- Iterasi dari tanggal_list (multi-tanggal).
      -- Alias kolom 'dt' (bukan 'd') agar tidak bentrok dgn variabel PL/pgSQL d.
      FOR d IN
        SELECT dt::date FROM jsonb_array_elements_text(arr) AS t(dt)
        ORDER BY dt::date
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
-- ============================================================
-- BAGIAN 3: REKAP CUTI + SINKRON ABSENSI MANUAL
-- ============================================================
-- RPC sinkron_absen_cuti untuk tombol "Sinkron Cuti -> Absen"
-- di halaman Rekap Absen. Baris absensi manual tidak ditimpa.

CREATE OR REPLACE FUNCTION public.sinkron_absen_cuti(p_mulai DATE DEFAULT NULL, p_selesai DATE DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  d DATE;
  label TEXT;
  arr jsonb;
  total INTEGER := 0;
  mulai DATE := COALESCE(p_mulai, '1900-01-01'::date);
  selesai DATE := COALESCE(p_selesai, '2999-12-31'::date);
BEGIN
  DELETE FROM public.absensi
  WHERE sumber = 'cuti'
    AND (
      cuti_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.cuti cc
        WHERE cc.id = public.absensi.cuti_id
          AND cc.status = 'disetujui'
      )
    );

  FOR c IN
    SELECT * FROM public.cuti
    WHERE status = 'disetujui'
      AND tanggal_mulai <= selesai
      AND tanggal_selesai >= mulai
  LOOP
    label := CASE c.jenis
      WHEN 'tahunan'   THEN 'Cuti Tahunan'
      WHEN 'sakit'     THEN 'Cuti Sakit'
      WHEN 'izin'      THEN 'Cuti Izin'
      WHEN 'besar'     THEN 'Cuti Besar'
      WHEN 'melahirkan' THEN 'Cuti Melahirkan'
      ELSE 'Cuti Lainnya'
    END;

    arr := COALESCE(c.tanggal_list, '[]'::jsonb);

    DELETE FROM public.absensi
    WHERE cuti_id = c.id AND sumber = 'cuti'
      AND NOT (tanggal BETWEEN c.tanggal_mulai AND c.tanggal_selesai);

    IF jsonb_array_length(arr) > 0 THEN
      DELETE FROM public.absensi
      WHERE cuti_id = c.id AND sumber = 'cuti'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(arr) AS t(dt)
          WHERE t.dt::date = public.absensi.tanggal
        );
    END IF;

    IF jsonb_array_length(arr) > 0 THEN
      FOR d IN
        SELECT dt::date FROM jsonb_array_elements_text(arr) AS t(dt)
        WHERE dt::date BETWEEN GREATEST(mulai, c.tanggal_mulai)
                          AND LEAST(selesai, c.tanggal_selesai)
        ORDER BY dt::date
      LOOP
        INSERT INTO public.absensi (employee_id, tanggal, status, keterangan, sumber, cuti_id)
        VALUES (c.employee_id, d, 'cuti', label, 'cuti', c.id)
        ON CONFLICT (employee_id, tanggal) DO UPDATE
          SET status = 'cuti',
              keterangan = EXCLUDED.keterangan,
              sumber = 'cuti',
              cuti_id = EXCLUDED.cuti_id
          WHERE public.absensi.sumber = 'cuti'
            AND public.absensi.cuti_id = EXCLUDED.cuti_id;
        total := total + 1;
      END LOOP;
    ELSE
      d := GREATEST(mulai, c.tanggal_mulai);
      WHILE d <= LEAST(selesai, c.tanggal_selesai) LOOP
        INSERT INTO public.absensi (employee_id, tanggal, status, keterangan, sumber, cuti_id)
        VALUES (c.employee_id, d, 'cuti', label, 'cuti', c.id)
        ON CONFLICT (employee_id, tanggal) DO UPDATE
          SET status = 'cuti',
              keterangan = EXCLUDED.keterangan,
              sumber = 'cuti',
              cuti_id = EXCLUDED.cuti_id
          WHERE public.absensi.sumber = 'cuti'
            AND public.absensi.cuti_id = EXCLUDED.cuti_id;
        total := total + 1;
        d := d + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.sinkron_absen_cuti(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sinkron_absen_cuti(DATE, DATE) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_cuti_status_tanggal ON public.cuti(status, tanggal_mulai, tanggal_selesai);

-- ============================================================================
-- BAGIAN 4: JADWAL KERJA & ISTIRAHAT KARYAWAN
-- (halaman HR > Jadwal Kerja — auto generate + drag & drop)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jadwal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT 'kerja', -- 'kerja' | 'istirahat'
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  warna TEXT DEFAULT '#10b981',
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jadwal_templates TO authenticated;
GRANT ALL ON public.jadwal_templates TO service_role;
ALTER TABLE public.jadwal_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all jadwal_templates" ON public.jadwal_templates;
CREATE POLICY "auth all jadwal_templates" ON public.jadwal_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.jadwal_kerja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  hari INTEGER NOT NULL CHECK (hari BETWEEN 0 AND 6), -- 0=Senin .. 6=Minggu
  jenis TEXT NOT NULL DEFAULT 'kerja', -- 'kerja' | 'istirahat'
  nama TEXT,
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  warna TEXT DEFAULT '#10b981',
  template_id UUID REFERENCES public.jadwal_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jadwal_emp ON public.jadwal_kerja(employee_id, hari);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jadwal_kerja TO authenticated;
GRANT ALL ON public.jadwal_kerja TO service_role;
ALTER TABLE public.jadwal_kerja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all jadwal_kerja" ON public.jadwal_kerja;
CREATE POLICY "auth all jadwal_kerja" ON public.jadwal_kerja FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_jadwal_templates_updated ON public.jadwal_templates;
CREATE TRIGGER trg_jadwal_templates_updated BEFORE UPDATE ON public.jadwal_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_jadwal_kerja_updated ON public.jadwal_kerja;
CREATE TRIGGER trg_jadwal_kerja_updated BEFORE UPDATE ON public.jadwal_kerja FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Hapus duplikat nama template (jika migrasi sempat dijalankan berulang)
DELETE FROM public.jadwal_templates a
USING public.jadwal_templates b
WHERE a.nama = b.nama AND a.id > b.id;

-- Pastikan nama template unik (dipakai ON CONFLICT di bawah)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_jadwal_templates_nama') THEN
    ALTER TABLE public.jadwal_templates ADD CONSTRAINT uq_jadwal_templates_nama UNIQUE (nama);
  END IF;
END
$$;

INSERT INTO public.jadwal_templates (nama, jenis, jam_mulai, jam_selesai, warna) VALUES
  ('Shift Pagi',     'kerja',     '08:00', '16:00', '#10b981'),
  ('Shift Siang',    'kerja',     '12:00', '20:00', '#0ea5e9'),
  ('Shift Malam',    'kerja',     '22:00', '06:00', '#8b5cf6'),
  ('Istirahat Siang', 'istirahat', '12:00', '13:00', '#f59e0b'),
  ('Istirahat Sore', 'istirahat', '16:00', '17:00', '#f97316')
ON CONFLICT (nama) DO NOTHING;

CREATE OR REPLACE FUNCTION public.generate_jadwal_kerja(
  p_branch UUID DEFAULT NULL,
  p_hari_kerja INTEGER[] DEFAULT ARRAY[0,1,2,3,4],
  p_jam_mulai TIME DEFAULT '08:00',
  p_jam_selesai TIME DEFAULT '16:00',
  p_istirahat_mulai TIME DEFAULT NULL,
  p_istirahat_selesai TIME DEFAULT NULL,
  p_nama_kerja TEXT DEFAULT 'Shift Utama',
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
  total INTEGER := 0;
BEGIN
  FOR e IN
    SELECT id FROM public.employees
    WHERE aktif = true
      AND (p_branch IS NULL OR branch_id = p_branch)
  LOOP
    DELETE FROM public.jadwal_kerja WHERE employee_id = e.id;

    FOR h IN SELECT unnest(p_hari_kerja) LOOP
      INSERT INTO public.jadwal_kerja (employee_id, hari, jenis, nama, jam_mulai, jam_selesai, warna)
      VALUES (e.id, h, 'kerja', p_nama_kerja, p_jam_mulai, p_jam_selesai, '#10b981');
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

REVOKE ALL ON FUNCTION public.generate_jadwal_kerja(UUID, INTEGER[], TIME, TIME, TIME, TIME, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_jadwal_kerja(UUID, INTEGER[], TIME, TIME, TIME, TIME, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.copy_jadwal_kerja(p_dari UUID, p_branch UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e RECORD;
  b RECORD;
  total INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_dari) THEN
    RAISE EXCEPTION 'Karyawan sumber tidak ditemukan';
  END IF;

  FOR e IN
    SELECT id FROM public.employees
    WHERE aktif = true
      AND (p_branch IS NULL OR branch_id = p_branch)
      AND id <> p_dari
  LOOP
    DELETE FROM public.jadwal_kerja WHERE employee_id = e.id;

    FOR b IN
      SELECT hari, jenis, nama, jam_mulai, jam_selesai, warna
      FROM public.jadwal_kerja
      WHERE employee_id = p_dari
      ORDER BY hari, jam_mulai
    LOOP
      INSERT INTO public.jadwal_kerja (employee_id, hari, jenis, nama, jam_mulai, jam_selesai, warna)
      VALUES (e.id, b.hari, b.jenis, b.nama, b.jam_mulai, b.jam_selesai, b.warna);
      total := total + 1;
    END LOOP;
  END LOOP;

  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_jadwal_kerja(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_jadwal_kerja(UUID, UUID) TO authenticated, service_role;

-- ============================================================================
-- BAGIAN 5: ROTASI SHIFT + MAN POWER PLANNING + INTEGRASI JADWAL -> ABSENSI
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_jadwal_shift(
  p_branch UUID DEFAULT NULL,
  p_hari_kerja INTEGER[] DEFAULT ARRAY[0,1,2,3,4],
  p_shift_ids UUID[] DEFAULT NULL,
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
    SELECT t2.nama INTO emp_shift
    FROM public.jadwal_kerja j
    JOIN public.jadwal_templates t2 ON t2.nama = j.nama AND t2.jenis = 'kerja' AND t2.aktif = true
    WHERE j.employee_id = e.id AND j.jenis = 'kerja'
    ORDER BY j.jam_mulai
    LIMIT 1;

    IF emp_shift IS NULL THEN CONTINUE; END IF;

    cur_idx := 0;
    idx := 0;
    FOR t IN
      SELECT * FROM public.jadwal_templates WHERE jenis = 'kerja' AND aktif = true ORDER BY jam_mulai
    LOOP
      IF t.nama = emp_shift THEN cur_idx := idx; END IF;
      idx := idx + 1;
    END LOOP;

    SELECT * INTO t
    FROM (
      SELECT * FROM public.jadwal_templates
      WHERE jenis = 'kerja' AND aktif = true
      ORDER BY jam_mulai
      OFFSET ((cur_idx + 1) % n)
    ) sub
    LIMIT 1;

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

CREATE TABLE IF NOT EXISTS public.man_power_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  hari INTEGER NOT NULL CHECK (hari BETWEEN 0 AND 6),
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
    WHERE j.hari = EXTRACT(ISODOW FROM d)::INTEGER - 1
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
