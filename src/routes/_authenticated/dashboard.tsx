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
        supabase.from("payroll_items").select("gaji_pokok,total_tunjangan,total_potongan,gaji_bersih,kasbon,slip_dibuat,payroll_run_id,payroll_run:payroll_runs!inner(periode,branch_id)").eq("payroll_run.periode", periode),
        supabase.from("employees").select("id", { count: "exact", head: true }).neq("status_rekening", "valid").eq("aktif", true),
      ]);

      const it = (items.data ?? []) as Array<{
        gaji_pokok: number; total_tunjangan: number; total_potongan: number;
        gaji_bersih: number; kasbon: number | null; slip_dibuat: boolean;
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
    { label: `Total Gaji ${formatPeriode(periode)}`, value: data?.totalGaji ?? 0, icon: Wallet, format: true },
    { label: "Total Tunjangan", value: data?.totalTunjangan ?? 0, icon: Wallet, format: true },
    { label: "Total Potongan", value: data?.totalPotongan ?? 0, icon: Wallet, format: true },
    { label: "Total Kasbon", value: data?.totalKasbon ?? 0, icon: Wallet, format: true },
    { label: "Slip Dibuat", value: data?.slipDibuat ?? 0, icon: FileText, format: false },
    { label: "Rekening Perlu Dicek", value: data?.rekeningPerluCek ?? 0, icon: Landmark, format: false, warn: true },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description={`Ringkasan periode ${formatPeriode(periode)}`} />
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <c.icon className={"h-4 w-4 " + (c.warn ? "text-warning" : "text-muted-foreground")} />
              </div>
              <div className="mt-2 text-lg font-semibold tabular-nums">
                {c.format ? formatIDR(Number(c.value)) : c.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Catatan
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Fitur peringatan kenaikan gaji, laporan per cabang, dan ringkasan lainnya akan diaktifkan
            setelah modul terkait selesai dibangun di iterasi berikutnya.
          </p>
        </div>
      </div>
    </>
  );
}
