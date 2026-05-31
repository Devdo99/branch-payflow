ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS slip_template_config jsonb NOT NULL DEFAULT '{
    "layout": "classic",
    "accentColor": "#000000",
    "fontSize": "normal",
    "showCompanyName": true,
    "showCompanyAddress": true,
    "showEmployeeName": true,
    "showBranch": true,
    "showPeriod": true,
    "showBaseSalary": true,
    "showAllowance": true,
    "showDeduction": true,
    "showNetSalary": true,
    "showSignature": true,
    "showFooter": true,
    "leftSignatureLabel": "Dibuat oleh,",
    "leftSignatureName": "Admin",
    "rightSignatureLabel": "Diterima oleh,"
  }'::jsonb;
