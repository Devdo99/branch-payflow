import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { formatIDR, currentPeriode, formatPeriode } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  Wallet,
  FileText,
  Landmark,
  TrendingUp,
  ArrowRight,
  Calculator,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  Coins,
  Percent,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Penggajian" }] }),
  component: DashboardPage,
});

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function DashboardPage() {
  const periode = currentPeriode();

  const { data } = useQuery({
    queryKey: ["dashboard_v2", periode],
    queryFn: async () => {
      const [branches, employees, items, rek, allPayrollRuns] = await Promise.all([
        supabase.from("branches").select("id, nama", { count: "exact" }).eq("aktif", true),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("aktif", true),
        supabase
          .from("payroll_items")
          .select(
            "gaji_pokok,total_tunjangan,total_potongan,gaji_bersih,kasbon,slip_dibuat,payroll_run_id,employee_id,payroll_run:payroll_runs!inner(periode,branch_id)",
          )
          .eq("payroll_run.periode", periode),
        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .neq("status_rekening", "valid")
          .eq("aktif", true),
        supabase
          .from("payroll_runs")
          .select("id, periode, status, branch_id")
          .order("periode", { ascending: false })
          .limit(6),
      ]);

      const it = (items.data ?? []) as Array<{
        gaji_pokok: number;
        total_tunjangan: number;
        total_potongan: number;
        gaji_bersih: number;
        kasbon: number | null;
        slip_dibuat: boolean;
        employee_id: string;
        payroll_run: { periode: string; branch_id: string | null } | null;
      }>;

      const branchList = (branches.data ?? []) as Array<{ id: string; nama: string }>;

      // Calculate branch totals
      const branchTotals: Record<string, { nama: string; total: number; count: number }> = {};
      it.forEach((item) => {
        const branchId = item.payroll_run?.branch_id || "unknown";
        const branchName = branchList.find((b) => b.id === branchId)?.nama || "Tanpa Cabang";
        if (!branchTotals[branchId]) {
          branchTotals[branchId] = { nama: branchName, total: 0, count: 0 };
        }
        branchTotals[branchId].total += Number(item.gaji_bersih || 0);
        branchTotals[branchId].count += 1;
      });

      // Monthly trend from payroll runs
      const monthlyData: Record<string, { gaji_pokok: number; tunjangan: number; potongan: number; thp: number }> = {};
      (allPayrollRuns.data ?? []).forEach((run) => {
        if (!monthlyData[run.periode]) {
          monthlyData[run.periode] = { gaji_pokok: 0, tunjangan: 0, potongan: 0, thp: 0 };
        }
      });

      // Get all payroll items for trend
      const { data: allItems } = await supabase
        .from("payroll_items")
        .select("gaji_pokok,total_tunjangan,total_potongan,gaji_bersih,payroll_run:payroll_runs!inner(periode)")
        .in("payroll_run.periode", Object.keys(monthlyData));

      (allItems ?? []).forEach((item: any) => {
        const p = item.payroll_run?.periode;
        if (p && monthlyData[p]) {
          monthlyData[p].gaji_pokok += Number(item.gaji_pokok || 0);
          monthlyData[p].tunjangan += Number(item.total_tunjangan || 0);
          monthlyData[p].potongan += Number(item.total_potongan || 0);
          monthlyData[p].thp += Number(item.gaji_bersih || 0);
        }
      });

      return {
        totalCabang: branches.count ?? 0,
        totalKaryawan: employees.count ?? 0,
        totalGaji: it.reduce((s, x) => s + Number(x.gaji_bersih || 0), 0),
        totalTunjangan: it.reduce((s, x) => s + Number(x.total_tunjangan || 0), 0),
        totalPotongan: it.reduce((s, x) => s + Number(x.total_potongan || 0), 0),
        totalKasbon: it.reduce((s, x) => s + Number(x.kasbon || 0), 0),
        totalGajiPokok: it.reduce((s, x) => s + Number(x.gaji_pokok || 0), 0),
        slipDibuat: it.filter((x) => x.slip_dibuat).length,
        rekeningPerluCek: rek.count ?? 0,
        branchTotals: Object.values(branchTotals).sort((a, b) => b.total - a.total),
        monthlyData: Object.entries(monthlyData)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([periode, val]) => ({
            name: formatPeriode(periode),
            shortName: periode.split("-")[1] + "/" + periode.split("-")[0].slice(2),
            ...val,
          })),
      };
    },
  });

  const summaryCards = [
    {
      label: "Cabang Aktif",
      value: data?.totalCabang ?? 0,
      icon: Building2,
      format: false,
      color: "from-sky-50 to-blue-50",
      iconColor: "text-sky-500",
      borderColor: "border-sky-100",
    },
    {
      label: "Karyawan Aktif",
      value: data?.totalKaryawan ?? 0,
      icon: Users,
      format: false,
      color: "from-emerald-50 to-teal-50",
      iconColor: "text-emerald-500",
      borderColor: "border-emerald-100",
    },
    {
      label: `Total Gaji ${formatPeriode(periode)}`,
      value: data?.totalGaji ?? 0,
      icon: Wallet,
      format: true,
      color: "from-violet-50 to-purple-50",
      iconColor: "text-violet-500",
      borderColor: "border-violet-100",
    },
    {
      label: "Slip Dibuat",
      value: data?.slipDibuat ?? 0,
      icon: FileText,
      format: false,
      color: "from-amber-50 to-yellow-50",
      iconColor: "text-amber-500",
      borderColor: "border-amber-100",
    },
  ];

  const pieData = [
    { name: "Gaji Pokok", value: data?.totalGajiPokok ?? 0, color: "#10b981" },
    { name: "Tunjangan", value: data?.totalTunjangan ?? 0, color: "#3b82f6" },
    { name: "Potongan", value: data?.totalPotongan ?? 0, color: "#ef4444" },
  ].filter((item) => item.value > 0);

  const totalAll = (data?.totalGajiPokok ?? 0) + (data?.totalTunjangan ?? 0) + (data?.totalPotongan ?? 0);

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <PageHeader
          title="Dashboard"
          description={`Ringkasan periode ${formatPeriode(periode)}`}
        />
        <div className="flex flex-wrap gap-2">
          <Link to="/proses-gaji">
            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
              <Calculator className="w-3.5 h-3.5 mr-1" /> Proses Gaji
            </Button>
          </Link>
          <Link to="/laporan">
            <Button size="sm" variant="outline" className="h-8 text-xs">
              <BarChart3 className="w-3.5 h-3.5 mr-1" /> Laporan
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className={`relative overflow-hidden bg-white border ${c.borderColor}/60 rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200`}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.label}</span>
                <h3 className="text-lg font-extrabold text-slate-800 truncate">
                  {c.format ? formatIDR(Number(c.value)) : c.value}
                </h3>
              </div>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${c.color} border ${c.borderColor}`}>
                <c.icon className={`h-3.5 w-3.5 ${c.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Monthly Trend Chart */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-950 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                Tren Payroll Bulanan
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Perbandingan gaji pokok, tunjangan, dan potongan
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.monthlyData ?? []}
                  margin={{ top: 5, right: 5, left: 5, bottom: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="shortName"
                    tickLine={false}
                    axisLine={false}
                    fontSize={9}
                    tick={{ fill: "#64748b" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={8}
                    tick={{ fill: "#64748b" }}
                    tickFormatter={(val) => `${(val / 1000000).toFixed(0)}jt`}
                  />
                  <RechartsTooltip
                    formatter={(value: any, name: string) => [formatIDR(Number(value)), name]}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      fontSize: "10px",
                    }}
                  />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: "9px", paddingTop: "8px" }}
                  />
                  <Bar dataKey="gaji_pokok" name="Gaji Pokok" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="tunjangan" name="Tunjangan" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="potongan" name="Potongan" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Composition */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-950 flex items-center gap-1.5">
                <PieChartIcon className="h-3.5 w-3.5 text-blue-500" />
                Komponen Biaya Payroll
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Proporsi gaji pokok, tunjangan, dan potongan
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-0">
            <div className="h-[180px] w-[180px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: any, name: string) => [formatIDR(Number(value)), name]}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      fontSize: "10px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-[11px]">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="grid gap-0">
                    <span className="font-medium text-slate-700">{item.name}</span>
                    <span className="text-muted-foreground font-semibold">
                      {formatIDR(item.value)} (
                      {((item.value / totalAll) * 100 || 0).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-3 md:grid-cols-3">
        {/* Top Branches */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-950 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-violet-500" />
                Top Cabang berdasarkan Total Gaji
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Ranking cabang periode {formatPeriode(periode)}
              </p>
            </div>
            <Link to="/laporan" className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-0.5">
              Lihat semua <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {(data?.branchTotals ?? []).slice(0, 5).map((branch, idx) => {
                const maxTotal = data?.branchTotals?.[0]?.total ?? 1;
                const percentage = (branch.total / maxTotal) * 100;
                return (
                  <div key={branch.nama} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-slate-700 truncate">{branch.nama}</span>
                        <span className="text-[10px] font-bold text-slate-900">{formatIDR(branch.total)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400 shrink-0">{branch.count} org</span>
                  </div>
                );
              })}
              {(!data?.branchTotals || data.branchTotals.length === 0) && (
                <div className="text-center py-6 text-[11px] text-slate-400">
                  Belum ada data payroll untuk periode ini
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Info & Alerts */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-950 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              Ringkasan Keuangan
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-[10px] text-slate-500">Gaji Pokok</span>
              <span className="text-[11px] font-bold text-slate-800">{formatIDR(data?.totalGajiPokok ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-[10px] text-emerald-600">+ Tunjangan</span>
              <span className="text-[11px] font-bold text-emerald-700">+{formatIDR(data?.totalTunjangan ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-[10px] text-rose-500">- Potongan</span>
              <span className="text-[11px] font-bold text-rose-600">-{formatIDR(data?.totalPotongan ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between py-2 bg-emerald-50 rounded-lg px-2">
              <span className="text-[10px] font-bold text-emerald-700">Total Net Transfer</span>
              <span className="text-[12px] font-extrabold text-emerald-700">{formatIDR(data?.totalGaji ?? 0)}</span>
            </div>

            {data?.rekeningPerluCek ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 mt-2">
                <Landmark className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[10px] text-amber-700">
                  {data.rekeningPerluCek} karyawan perlu cek rekening
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Link to="/proses-gaji" className="block">
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-emerald-200/60 bg-emerald-50/30 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-200 cursor-pointer group">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200 transition-colors">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-800">Proses Gaji</div>
              <div className="text-[9px] text-slate-500">Hitung payroll</div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 ml-auto group-hover:text-emerald-500 transition-colors" />
          </div>
        </Link>
        <Link to="/slip-gaji" className="block">
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-blue-200/60 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 cursor-pointer group">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-800">Slip Gaji</div>
              <div className="text-[9px] text-slate-500">Download slip</div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 ml-auto group-hover:text-blue-500 transition-colors" />
          </div>
        </Link>
        <Link to="/laporan" className="block">
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-violet-200/60 bg-violet-50/30 hover:bg-violet-50 hover:border-violet-300 transition-all duration-200 cursor-pointer group">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 group-hover:bg-violet-200 transition-colors">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-800">Laporan</div>
              <div className="text-[9px] text-slate-500">Analitik payroll</div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 ml-auto group-hover:text-violet-500 transition-colors" />
          </div>
        </Link>
        <Link to="/karyawan" className="block">
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-200/60 bg-amber-50/30 hover:bg-amber-50 hover:border-amber-300 transition-all duration-200 cursor-pointer group">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-800">Karyawan</div>
              <div className="text-[9px] text-slate-500">Kelola data</div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 ml-auto group-hover:text-amber-500 transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
