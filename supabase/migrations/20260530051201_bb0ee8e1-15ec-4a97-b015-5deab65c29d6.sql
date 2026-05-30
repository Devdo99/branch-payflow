ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS alamat text,
  ADD COLUMN IF NOT EXISTS footer_slip text;

INSERT INTO public.app_settings (id, nama_perusahaan)
VALUES (1, 'Nama Perusahaan')
ON CONFLICT (id) DO NOTHING;