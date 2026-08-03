-- ============ FUNGSI DASAR (defensif) ============
-- Di beberapa database, migrasi dasar tidak sempat membuat fungsi trigger ini
-- (mis. skema dibuat lewat jalur lain). CREATE OR REPLACE aman dijalankan ulang.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ HR: CUTI (CUTI KARYAWAN) ============
CREATE TABLE public.cuti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  jenis TEXT NOT NULL DEFAULT 'tahunan', -- tahunan, sakit, izin, besar, melahirkan, lainnya
  tanggal_mulai DATE NOT NULL,
  tanggal_selesai DATE NOT NULL,
  alasan TEXT,
  status TEXT NOT NULL DEFAULT 'diajukan', -- diajukan, disetujui, ditolak
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cuti_emp ON public.cuti(employee_id);
CREATE INDEX idx_cuti_tanggal ON public.cuti(tanggal_mulai, tanggal_selesai);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuti TO authenticated;
GRANT ALL ON public.cuti TO service_role;
ALTER TABLE public.cuti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cuti" ON public.cuti FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ HR: ABSENSI (REKAP ABSEN KARYAWAN) ============
CREATE TABLE public.absensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'hadir', -- hadir, izin_masuk, sakit, telat, absen, resign
  keterangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_absensi_emp_tanggal UNIQUE (employee_id, tanggal)
);
CREATE INDEX idx_absensi_emp ON public.absensi(employee_id);
CREATE INDEX idx_absensi_tanggal ON public.absensi(tanggal);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi TO authenticated;
GRANT ALL ON public.absensi TO service_role;
ALTER TABLE public.absensi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all absensi" ON public.absensi FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ HR: RESIGN (RESIGN KARYAWAN + LAPORAN) ============
CREATE TABLE public.resign (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tanggal_resign DATE NOT NULL,
  alasan TEXT,
  laporan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resign_emp ON public.resign(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resign TO authenticated;
GRANT ALL ON public.resign TO service_role;
ALTER TABLE public.resign ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all resign" ON public.resign FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ TRIGGERS ============
CREATE TRIGGER trg_cuti_updated BEFORE UPDATE ON public.cuti FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_absensi_updated BEFORE UPDATE ON public.absensi FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_resign_updated BEFORE UPDATE ON public.resign FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
