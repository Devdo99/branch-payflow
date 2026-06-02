import { type ComponentPropsWithoutRef } from "react";

export function AppLogo({ className }: { className?: string }) {
  return (
    <div className={className ? className : ""}>
      <div className="inline-flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-sm">
          <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="36" height="36" rx="12" fill="#f8fafc" />
            <path d="M18 20h10a4 4 0 0 1 0 8h-6" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
            <path d="M18 28V18" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <div className="space-y-0.5">
          <div className="text-lg font-semibold tracking-tight text-slate-900">PayFlow</div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Payroll with confidence</div>
        </div>
      </div>
    </div>
  );
}
