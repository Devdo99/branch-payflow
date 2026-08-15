-- ============================================================================
-- JADWAL KERJA & ISTIRAHAT KARYAWAN
-- ----------------------------------------------------------------------------
-- 1. jadwal_templates : blok kerja/istirahat yang bisa dipakai ulang
--    (chip template bisa di-drag langsung ke grid jadwal).
-- 2. jadwal_kerja      : jadwal per karyawan per hari dalam seminggu
--    (hari 0=Senin .. 6=Minggu, sesuai urutan HARI_PENDEK di aplikasi).
-- 3. RPC generate_jadwal_kerja : buat jadwal standar otomatis untuk seluruh
--    karyawan aktif pada cabang (tombol "Auto Generate").
-- 4. RPC copy_jadwal_kerja     : salin jadwal satu karyawan ke karyawan lain
--    pada cabang tertentu (tombol "Salin Jadwal").
-- ============================================================================

-- ---------- 1. TABEL: JADWAL TEMPLATE (blok reusable) ----------
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

-- ---------- 2. TABEL: JADWAL KERJA KARYAWAN ----------
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

-- ---------- 3. TRIGGERS ----------
DROP TRIGGER IF EXISTS trg_jadwal_templates_updated ON public.jadwal_templates;
CREATE TRIGGER trg_jadwal_templates_updated BEFORE UPDATE ON public.jadwal_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_jadwal_kerja_updated ON public.jadwal_kerja;
CREATE TRIGGER trg_jadwal_kerja_updated BEFORE UPDATE ON public.jadwal_kerja FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 4. SEED TEMPLATE DEFAULT (idempotent) ----------
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

-- ---------- 5. RPC: GENERATE JADWAL STANDAR OTOMATIS ----------
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
  -- Timpa seluruh jadwal karyawan aktif pada cabang (semua hari) dengan pola baru
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

-- ---------- 6. RPC: SALIN JADWAL DARI SATU KARYAWAN ----------
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
