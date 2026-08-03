-- ============================================================================
-- REKAP CUTI + SINKRON ABSENSI MANUAL
-- ----------------------------------------------------------------------------
-- 1. RPC sinkron_absen_cuti: isi ulang absensi berstatus 'cuti' dari jadwal
--    cuti yang DISETUJUI. Baris absensi manual (sumber='manual') tidak ditimpa.
--    Tombol "Sinkron Cuti → Absen" di halaman Rekap Absen memanggil fungsi ini.
-- 2. Index pendukung untuk halaman Rekap Cuti.
-- ============================================================================

-- ---------- RPC: sinkron_absen_cuti ----------
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
  -- 1. Hapus baris otomatis yang sudah tidak relevan:
  --    - cuti_id hilang (cuti dihapus)
  --    - cuti terkait tidak lagi berstatus disetujui
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

  -- 2. Isi ulang dari cuti yang disetujui yang menabrak rentang bulan
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

    -- Bersihkan baris otomatis milik cuti ini yang di luar rentang
    DELETE FROM public.absensi
    WHERE cuti_id = c.id AND sumber = 'cuti'
      AND NOT (tanggal BETWEEN c.tanggal_mulai AND c.tanggal_selesai);

    -- Untuk multi-tanggal: hapus yang bukan bagian dari tanggal_list
    IF jsonb_array_length(arr) > 0 THEN
      DELETE FROM public.absensi
      WHERE cuti_id = c.id AND sumber = 'cuti'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(arr) AS t(dt)
          WHERE t.dt::date = public.absensi.tanggal
        );
    END IF;

    -- Upsert tanggal-tanggal cuti ke absensi
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
      -- Fallback ke range (data lama yang belum punya tanggal_list)
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

-- ---------- Index pendukung rekap cuti ----------
CREATE INDEX IF NOT EXISTS idx_cuti_status_tanggal ON public.cuti(status, tanggal_mulai, tanggal_selesai);
