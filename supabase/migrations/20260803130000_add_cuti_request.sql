-- ============================================================================
-- FITUR REQUEST CUTI PUBLIK + ANTREAN NOTIFIKASI WHATSAPP
-- ----------------------------------------------------------------------------
-- 1. RPC pencocokan karyawan berdasarkan nomor WhatsApp (SECURITY DEFINER)
-- 2. RPC pengecekan kuota harian & duplikat permohonan (SECURITY DEFINER)
-- 3. Policy RLS khusus anon untuk INSERT ke tabel cuti (form publik)
-- 4. Tabel cuti_notifikasi untuk antrean pesan WA (disetujui / ditolak)
-- ============================================================================

-- ---------- RPC 1: Cari karyawan aktif dari nomor WhatsApp ----------
-- Hanya mengembalikan id, nama, whatsapp dari SATU karyawan yang cocok.
-- Menormalkan 08xxx menjadi 62xxx agar format "0" dan "62" sama-sama cocok.
-- SECURITY DEFINER: tidak mengekspos seluruh tabel employees ke publik.
CREATE OR REPLACE FUNCTION public.cari_karyawan_oleh_wa(p_wa TEXT)
RETURNS TABLE (id UUID, nama TEXT, whatsapp TEXT)
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
  SELECT n.id, n.nama, n.whatsapp
  FROM normalized n
  WHERE n.emp_wa = n.in_wa
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.cari_karyawan_oleh_wa(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cari_karyawan_oleh_wa(TEXT) TO anon, authenticated;

-- ---------- RPC 2: Cek kuota harian dalam rentang tanggal ----------
-- Kuota: Sabtu & Minggu maks 1 orang, hari kerja (Senin-Jumat) maks 2 orang.
-- Terpakai dihitung dari cuti berstatus 'disetujui'.
CREATE OR REPLACE FUNCTION public.cek_kuota_cuti(p_mulai DATE, p_selesai DATE)
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
BEGIN
  d := p_mulai;
  WHILE d <= p_selesai LOOP
    -- ISODOW: 1=Sen .. 7=Minggu, sehingga 6=Sabtu, 7=Minggu
    IF EXTRACT(ISODOW FROM d) IN (6, 7) THEN
      max_kuota := 1;
    ELSE
      max_kuota := 2;
    END IF;

    SELECT count(*) INTO dipakai
    FROM public.cuti c
    WHERE c.status = 'disetujui'
      AND c.tanggal_mulai <= d
      AND c.tanggal_selesai >= d;

    tanggal := d;
    kuota := max_kuota;
    terpakai := dipakai;
    RETURN NEXT;
    d := d + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.cek_kuota_cuti(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cek_kuota_cuti(DATE, DATE) TO anon, authenticated;

-- ---------- RPC 3: Cek permohonan aktif yang tumpang tindih ----------
-- Mengembalikan true bila karyawan masih punya cuti 'diajukan'/'disetujui'
-- yang periodenya tumpang tindih dengan rentang yang diminta.
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

-- ---------- RLS: izinkan anon mengirim permohonan (INSERT) ----------
-- Publik TIDAK bisa membaca/mengubah/menghapus data cuti.
-- Status hanya boleh 'diajukan' atau 'ditolak' (tidak bisa setujui sendiri).
GRANT INSERT ON public.cuti TO anon;
CREATE POLICY "anon insert cuti" ON public.cuti
  FOR INSERT TO anon
  WITH CHECK (status IN ('diajukan', 'ditolak'));

-- ---------- TABEL: cuti_notifikasi (antrean pesan WA) ----------
CREATE TABLE public.cuti_notifikasi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuti_id UUID NOT NULL REFERENCES public.cuti(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL DEFAULT 'info',          -- 'disetujui' | 'ditolak' | 'info'
  pesan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'terkirim' | 'gagal'
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cuti_notif_cuti ON public.cuti_notifikasi(cuti_id);
CREATE INDEX idx_cuti_notif_status ON public.cuti_notifikasi(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuti_notifikasi TO authenticated;
GRANT ALL ON public.cuti_notifikasi TO service_role;
ALTER TABLE public.cuti_notifikasi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cuti_notifikasi" ON public.cuti_notifikasi
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cuti_notifikasi_updated
  BEFORE UPDATE ON public.cuti_notifikasi
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- INDEX pendukung untuk cek kuota ----------
CREATE INDEX IF NOT EXISTS idx_cuti_status ON public.cuti(status);
