ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS periode_evaluasi_default public.evaluation_period NOT NULL DEFAULT '12_bulan';

