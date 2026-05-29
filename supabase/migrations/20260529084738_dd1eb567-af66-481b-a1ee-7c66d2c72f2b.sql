
-- ============ ENUMS ============
CREATE TYPE public.calc_method AS ENUM ('fixed','per_day','per_hour','per_event','manual');
CREATE TYPE public.bank_status AS ENUM ('valid','belum_dicek','perlu_dicek_ulang');
CREATE TYPE public.evaluation_period AS ENUM ('3_bulan','6_bulan','12_bulan','manual');
CREATE TYPE public.evaluation_status AS ENUM ('belum_waktunya','perlu_evaluasi','disetujui','ditunda','sudah_dinaikkan');
CREATE TYPE public.payroll_status AS ENUM ('draft','final');

-- ============ BRANCHES ============
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  alamat TEXT,
  catatan TEXT,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all branches" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ EMPLOYEES ============
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
  kode_karyawan TEXT UNIQUE,
  nama TEXT NOT NULL,
  jabatan TEXT,
  whatsapp TEXT,
  email TEXT,
  nama_bank TEXT,
  nomor_rekening TEXT,
  nama_pemilik_rekening TEXT,
  status_rekening public.bank_status NOT NULL DEFAULT 'belum_dicek',
  catatan_rekening TEXT,
  tanggal_masuk DATE,
  gaji_pokok NUMERIC(15,2) NOT NULL DEFAULT 0,
  periode_evaluasi public.evaluation_period NOT NULL DEFAULT '12_bulan',
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_branch ON public.employees(branch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all employees" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ SALARY HISTORY ============
CREATE TABLE public.salary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  gaji_lama NUMERIC(15,2) NOT NULL,
  gaji_baru NUMERIC(15,2) NOT NULL,
  nominal_kenaikan NUMERIC(15,2),
  persentase NUMERIC(6,2),
  tanggal_berlaku DATE NOT NULL,
  alasan TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_salary_history_emp ON public.salary_history(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_history TO authenticated;
GRANT ALL ON public.salary_history TO service_role;
ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all sh" ON public.salary_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ SALARY INCREASE EVALUATIONS ============
CREATE TABLE public.salary_increase_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  periode_evaluasi DATE NOT NULL,
  status public.evaluation_status NOT NULL DEFAULT 'perlu_evaluasi',
  nominal_kenaikan NUMERIC(15,2),
  persentase NUMERIC(6,2),
  tanggal_berlaku DATE,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sie_emp ON public.salary_increase_evaluations(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_increase_evaluations TO authenticated;
GRANT ALL ON public.salary_increase_evaluations TO service_role;
ALTER TABLE public.salary_increase_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all sie" ON public.salary_increase_evaluations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ ALLOWANCE TYPES ============
CREATE TABLE public.allowance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  metode public.calc_method NOT NULL DEFAULT 'fixed',
  nominal_default NUMERIC(15,2) NOT NULL DEFAULT 0,
  catatan TEXT,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowance_types TO authenticated;
GRANT ALL ON public.allowance_types TO service_role;
ALTER TABLE public.allowance_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all at" ON public.allowance_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ DEDUCTION TYPES ============
CREATE TABLE public.deduction_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  metode public.calc_method NOT NULL DEFAULT 'fixed',
  nominal_default NUMERIC(15,2) NOT NULL DEFAULT 0,
  catatan TEXT,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deduction_types TO authenticated;
GRANT ALL ON public.deduction_types TO service_role;
ALTER TABLE public.deduction_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all dt" ON public.deduction_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PAYROLL RUNS ============
CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
  periode TEXT NOT NULL, -- format YYYY-MM
  status public.payroll_status NOT NULL DEFAULT 'draft',
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pr_branch_period ON public.payroll_runs(branch_id, periode);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all pr" ON public.payroll_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PAYROLL ITEMS ============
CREATE TABLE public.payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  gaji_pokok NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_tunjangan NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_potongan NUMERIC(15,2) NOT NULL DEFAULT 0,
  gaji_bersih NUMERIC(15,2) NOT NULL DEFAULT 0,
  jumlah_hari INTEGER DEFAULT 0,
  jumlah_jam_lembur NUMERIC(6,2) DEFAULT 0,
  jumlah_telat INTEGER DEFAULT 0,
  jumlah_izin INTEGER DEFAULT 0,
  jumlah_absen INTEGER DEFAULT 0,
  kasbon NUMERIC(15,2) DEFAULT 0,
  bonus_manual NUMERIC(15,2) DEFAULT 0,
  catatan TEXT,
  slip_dibuat BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pi_run ON public.payroll_items(payroll_run_id);
CREATE INDEX idx_pi_emp ON public.payroll_items(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_items TO authenticated;
GRANT ALL ON public.payroll_items TO service_role;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all pi" ON public.payroll_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PAYROLL ITEM ALLOWANCES ============
CREATE TABLE public.payroll_item_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id UUID NOT NULL REFERENCES public.payroll_items(id) ON DELETE CASCADE,
  allowance_type_id UUID REFERENCES public.allowance_types(id) ON DELETE SET NULL,
  nama TEXT NOT NULL,
  metode public.calc_method NOT NULL,
  qty NUMERIC(10,2) NOT NULL DEFAULT 1,
  nominal NUMERIC(15,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_pia_item ON public.payroll_item_allowances(payroll_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_item_allowances TO authenticated;
GRANT ALL ON public.payroll_item_allowances TO service_role;
ALTER TABLE public.payroll_item_allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all pia" ON public.payroll_item_allowances FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.payroll_item_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id UUID NOT NULL REFERENCES public.payroll_items(id) ON DELETE CASCADE,
  deduction_type_id UUID REFERENCES public.deduction_types(id) ON DELETE SET NULL,
  nama TEXT NOT NULL,
  metode public.calc_method NOT NULL,
  qty NUMERIC(10,2) NOT NULL DEFAULT 1,
  nominal NUMERIC(15,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_pid_item ON public.payroll_item_deductions(payroll_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_item_deductions TO authenticated;
GRANT ALL ON public.payroll_item_deductions TO service_role;
ALTER TABLE public.payroll_item_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all pid" ON public.payroll_item_deductions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ WHATSAPP TEMPLATES ============
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis TEXT NOT NULL UNIQUE, -- 'per_karyawan' atau 'seluruh_karyawan'
  konten TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all wt" ON public.whatsapp_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Default templates
INSERT INTO public.whatsapp_templates (jenis, konten) VALUES
('per_karyawan',
'*SLIP GAJI*
Periode: [PERIODE_GAJI]

Nama: [NAMA_KARYAWAN]
Jabatan: [JABATAN]
Cabang: [CABANG]

Gaji Pokok: Rp [GAJI_POKOK]
Total Tunjangan: Rp [TOTAL_TUNJANGAN]
Total Potongan: Rp [TOTAL_POTONGAN]
-----------------------
*Gaji Bersih: Rp [GAJI_BERSIH]*

Transfer ke:
[NAMA_BANK] - [NOMOR_REKENING]
a/n [NAMA_PEMILIK_REKENING]

[CATATAN]'),
('seluruh_karyawan',
'*REKAP GAJI [PERIODE_GAJI]*
Cabang: [CABANG]
Jumlah Karyawan: [JUMLAH_KARYAWAN]

[DAFTAR_GAJI_KARYAWAN]

-----------------------
*Total Gaji: Rp [TOTAL_GAJI]*');

-- ============ APP SETTINGS ============
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  nama_perusahaan TEXT NOT NULL DEFAULT 'Nama Perusahaan',
  periode_evaluasi_default public.evaluation_period NOT NULL DEFAULT '12_bulan',
  catatan TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all as" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.app_settings (id) VALUES (1);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sie_updated BEFORE UPDATE ON public.salary_increase_evaluations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pr_updated BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pi_updated BEFORE UPDATE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: catat riwayat saat gaji_pokok berubah
CREATE OR REPLACE FUNCTION public.log_salary_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.gaji_pokok IS DISTINCT FROM OLD.gaji_pokok THEN
    INSERT INTO public.salary_history (employee_id, gaji_lama, gaji_baru, nominal_kenaikan, persentase, tanggal_berlaku, alasan)
    VALUES (
      NEW.id, OLD.gaji_pokok, NEW.gaji_pokok,
      NEW.gaji_pokok - OLD.gaji_pokok,
      CASE WHEN OLD.gaji_pokok > 0 THEN ROUND(((NEW.gaji_pokok - OLD.gaji_pokok)/OLD.gaji_pokok)*100, 2) ELSE NULL END,
      CURRENT_DATE,
      'Perubahan gaji pokok'
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_log_salary AFTER UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.log_salary_change();
