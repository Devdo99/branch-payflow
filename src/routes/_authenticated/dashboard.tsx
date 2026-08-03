import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { formatIDR, currentPeriode, formatPeriode } from "@/lib/format";
import { Building2, Users, Wallet, FileText, AlertCircle, Landmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Penggajian" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const periode = currentPeriode();

  const { data } = useQuery({
    queryKey: ["dashboard", periode],
    queryFn: async () => {
      const [branches, employees, items, rek] = await Promise.all([
        supabase.from("branches").select("id", { count: "exact", head: true }).eq("aktif", true),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("aktif", true),
        supabase
          .from("payroll_items")
          .select(
            "gaji_pokok,total_tunjangan,total_potongan,gaji_bersih,kasbon,slip_dibuat,payroll_run_id,payroll_run:payroll_runs!inner(periode,branch_id)",
          )
          .eq("payroll_run.periode", periode),
        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .neq("status_rekening", "valid")
          .eq("aktif", true),
      ]);

      const it = (items.data ?? []) as Array<{
        gaji_pokok: number;
        total_tunjangan: number;
        total_potongan: number;
        gaji_bersih: number;
        kasbon: number | null;
        slip_dibuat: boolean;
      }>;

      return {
        totalCabang: branches.count ?? 0,
        totalKaryawan: employees.count ?? 0,
        totalGaji: it.reduce((s, x) => s + Number(x.gaji_bersih || 0), 0),
        totalTunjangan: it.reduce((s, x) => s + Number(x.total_tunjangan || 0), 0),
        totalPotongan: it.reduce((s, x) => s + Number(x.total_potongan || 0), 0),
        totalKasbon: it.reduce((s, x) => s + Number(x.kasbon || 0), 0),
        slipDibuat: it.filter((x) => x.slip_dibuat).length,
        rekeningPerluCek: rek.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "Cabang Aktif", value: data?.totalCabang ?? 0, icon: Building2, format: false },
    { label: "Karyawan Aktif", value: data?.totalKaryawan ?? 0, icon: Users, format: false },
    {
      label: `Total Gaji ${formatPeriode(periode)}`,
      value: data?.totalGaji ?? 0,
      icon: Wallet,
      format: true,
    },
    { label: "Total Tunjangan", value: data?.totalTunjangan ?? 0, icon: Wallet, format: true },
    { label: "Total Potongan", value: data?.totalPotongan ?? 0, icon: Wallet, format: true },
    { label: "Total Kasbon", value: data?.totalKasbon ?? 0, icon: Wallet, format: true },
    { label: "Slip Dibuat", value: data?.slipDibuat ?? 0, icon: FileText, format: false },
    {
      label: "Rekening Perlu Dicek",
      value: data?.rekeningPerluCek ?? 0,
      icon: Landmark,
      format: false,
      warn: true,
    },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description={`Ringkasan periode ${formatPeriode(periode)}`} />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Quick Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => {
            const isWarn = c.warn && Number(c.value) > 0;
            return (
              <div
                key={c.label}
                className={`premium-card p-5 relative overflow-hidden group border border-border/60 ${
                  isWarn ? "border-rose-500/20 bg-rose-500/5 shadow-sm shadow-rose-500/5" : ""
                }`}
              >
                {/* Hover decorative glowing aura */}
                <div
                  className={`absolute -right-6 -bottom-6 w-20 h-20 rounded-full opacity-0 group-hover:opacity-10 blur-xl scale-75 group-hover:scale-150 transition-all duration-300 ${
                    isWarn ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                />

                <div className="flex items-start justify-between relative z-10">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {c.label}
                  </span>
                  <div
                    className={`p-2 rounded-xl transition-colors duration-200 ${
                      isWarn
                        ? "bg-rose-500/10 text-rose-500"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20"
                    }`}
                  >
                    <c.icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div
                  className={`mt-4 text-xl font-bold tracking-tight relative z-10 tabular-nums ${
                    isWarn
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {c.format ? formatIDR(Number(c.value)) : c.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Development Note Banner */}
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-3 text-blue-700 dark:text-blue-400 font-semibold text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            Catatan Pengembangan Sistem
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Fitur peringatan kenaikan gaji otomatis, peninjauan visualisasi analitis performa per
            cabang, dan ekspor laporan grafis mutakhir akan diaktifkan secara bertahap pada modul
            iterasi berikutnya.
          </p>
        </div>
      </div>
    </>
  );
}
