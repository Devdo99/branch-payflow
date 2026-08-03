import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileDown,
  CalendarCheck2,
  ClipboardCheck,
  Hourglass,
  XCircle,
  Users,
  FileBarChart2,
  CalendarSync,
} from "lucide-react";
import {
  JENIS_CUTI,
  getJenisCuti,
  getStatusCuti,
  BULAN_PANJANG,
  formatTanggalHR,
  getDaysInMonth,
} from "@/lib/hr";
import { downloadCSV, downloadPDFTable, safeFileName } from "@/lib/hr-export";

export const Route = createFileRoute("/_authenticated/hr/rekap-cuti")({
  component: RekapCutiPage,
});

type CutiRecord = {
  id: string;
  employee_id: string;
  jenis: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  tanggal_list?: string[] | null;
  alasan?: string | null;
  status: string;
  created_at?: string;
  employees?: {
    nama?: string | null;
    kode_karyawan?: string | null;
    branch_id?: string | null;
    branches?: { nama?: string } | null;
  } | null;
};

const STATUS_FILTER = [
  { value: "all", label: "Semua Status" },
  { value: "disetujui", label: "Disetujui" },
  { value: "diajukan", label: "Diajukan" },
  { value: "ditolak", label: "Ditolak" },
];

/** Hitung jumlah hari cuti yang jatuh dalam bulan tampilan. */
function countDaysInMonth(
  tanggalList: string[] | null | undefined,
  mulai: string,
  selesai: string,
  monthStart: string,
  monthEnd: string,
): number {
  if (tanggalList && tanggalList.length > 0) {
    return tanggalList.filter((t) => t >= monthStart && t <= monthEnd).length;
  }
  const s = new Date(`${mulai}T00:00:00`);
  const e = new Date(`${selesai}T00:00:00`);
  const ms = new Date(`${monthStart}T00:00:00`);
  const me = new Date(`${monthEnd}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const start = s > ms ? s : ms;
  const end = e < me ? e : me;
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function RekapCutiPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(
    daysInMonth,
  ).padStart(2, "0")}`;

  const { data: branches = [] } = useQuery({
    queryKey: ["branches_hr_rekap"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, nama").order("nama");
      return (data as { id: string; nama: string }[]) || [];
    },
  });

  const { data: cutiList = [], isLoading } = useQuery<CutiRecord[]>({
    queryKey: ["cuti_rekap", viewYear, viewMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cuti")
        .select(
          "id, employee_id, jenis, tanggal_mulai, tanggal_selesai, tanggal_list, alasan, status, created_at, employees ( nama, kode_karyawan, branch_id, branches ( nama ) )",
        )
        .lte("tanggal_mulai", monthEnd)
        .gte("tanggal_selesai", monthStart)
        .order("tanggal_mulai");
      if (error) throw error;
      return (data || []) as CutiRecord[];
    },
  });

  const filteredCuti = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return cutiList.filter((c) => {
      if (selectedBranch !== "all" && c.employees?.branch_id !== selectedBranch) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (term !== "") {
        const hay = `${c.employees?.nama || ""} ${c.employees?.kode_karyawan || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [cutiList, selectedBranch, statusFilter, searchTerm]);

  // Hari cuti per karyawan per jenis (hanya yang disetujui, dalam bulan ini)
  const matrixPerEmployee = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    cutiList.forEach((c) => {
      if (c.status !== "disetujui") return;
      if (selectedBranch !== "all" && c.employees?.branch_id !== selectedBranch) return;
      const empId = c.employee_id;
      if (!map[empId]) {
        map[empId] = { total: 0 };
        JENIS_CUTI.forEach((j) => (map[empId][j.value] = 0));
      }
      const n = countDaysInMonth(
        c.tanggal_list,
        c.tanggal_mulai,
        c.tanggal_selesai,
        monthStart,
        monthEnd,
      );
      map[empId][c.jenis] = (map[empId][c.jenis] || 0) + n;
      map[empId].total = (map[empId].total || 0) + n;
    });
    return map;
  }, [cutiList, selectedBranch, monthStart, monthEnd]);

  const empRows = useMemo(() => {
    const empMap = new Map<string, CutiRecord["employees"]>();
    cutiList.forEach((c) => {
      if (!empMap.has(c.employee_id)) empMap.set(c.employee_id, c.employees);
    });
    return Array.from(empMap.entries())
      .filter(([empId]) => {
        if (selectedBranch !== "all") return empMap.get(empId)?.branch_id === selectedBranch;
        return true;
      })
      .map(([empId, emp]) => {
        const counts = matrixPerEmployee[empId] || {};
        const total = counts.total || 0;
        return {
          empId,
          emp,
          counts,
          total,
          hasApproved: total > 0,
          permohonan: cutiList.filter(
            (c) =>
              c.employee_id === empId &&
              (selectedBranch === "all" || c.employees?.branch_id === selectedBranch),
          ).length,
        };
      })
      .sort((a, b) => Number(b.total) - Number(a.total));
  }, [cutiList, matrixPerEmployee, selectedBranch]);

  const empRowsWithApproved = useMemo(() => empRows.filter((r) => r.hasApproved), [empRows]);

  const stats = useMemo(() => {
    const s = { diajukan: 0, disetujui: 0, ditolak: 0, totalHari: 0, karyawan: 0 };
    cutiList.forEach((c) => {
      if (selectedBranch !== "all" && c.employees?.branch_id !== selectedBranch) return;
      if (c.status === "diajukan") s.diajukan += 1;
      else if (c.status === "disetujui") s.disetujui += 1;
      else if (c.status === "ditolak") s.ditolak += 1;
      if (c.status === "disetujui") {
        s.totalHari += countDaysInMonth(
          c.tanggal_list,
          c.tanggal_mulai,
          c.tanggal_selesai,
          monthStart,
          monthEnd,
        );
      }
    });
    s.karyawan = empRowsWithApproved.length;
    return s;
  }, [cutiList, selectedBranch, empRowsWithApproved, monthStart, monthEnd]);

  const changeMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const selectedBranchName =
    selectedBranch === "all"
      ? "Semua Cabang"
      : branches.find((b) => b.id === selectedBranch)?.nama || selectedBranch;

  const exportExcel = () => {
    if (empRowsWithApproved.length === 0) return toast.error("Tidak ada data cuti untuk diekspor.");
    const headers = [
      "Kode",
      "Nama Karyawan",
      "Cabang",
      ...JENIS_CUTI.map((j) => j.label),
      "Total Hari Cuti",
      "Total Permohonan",
    ];
    const rows = empRowsWithApproved.map((r) => [
      r.emp?.kode_karyawan || "-",
      r.emp?.nama || "-",
      r.emp?.branches?.nama || "-",
      ...JENIS_CUTI.map((j) => r.counts[j.value] || 0),
      r.total,
      r.permohonan,
    ]);
    downloadCSV(
      `Rekap_Cuti_${safeFileName(BULAN_PANJANG[viewMonth])}_${viewYear}.csv`,
      headers,
      rows,
    );
  };

  const exportPDF = () => {
    if (empRowsWithApproved.length === 0) return toast.error("Tidak ada data cuti untuk diekspor.");
    const headers = ["Kode", "Nama", ...JENIS_CUTI.map((j) => j.label), "Total"];
    const rows = empRowsWithApproved.map((r) => [
      r.emp?.kode_karyawan || "-",
      r.emp?.nama || "-",
      ...JENIS_CUTI.map((j) => r.counts[j.value] || 0),
      r.total,
    ]);
    downloadPDFTable(
      `Rekap_Cuti_${safeFileName(BULAN_PANJANG[viewMonth])}_${viewYear}.pdf`,
      "Rekap Cuti Karyawan",
      `${selectedBranchName} • ${BULAN_PANJANG[viewMonth]} ${viewYear}`,
      headers,
      rows,
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Rekap Cuti Karyawan"
        description="Ringkasan penggunaan cuti per karyawan per jenis dalam satu bulan."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={exportExcel}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" /> Excel
            </Button>
            <Button
              variant="outline"
              className="border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={exportPDF}
            >
              <FileDown className="mr-2 h-4 w-4 text-emerald-600" /> PDF
            </Button>
          </div>
        }
      />

      {/* Statistik */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: "Permohonan Diajukan",
            value: stats.diajukan,
            icon: Hourglass,
            cls: "text-amber-600 bg-amber-500/10 border-amber-500/20",
          },
          {
            label: "Cuti Disetujui",
            value: stats.disetujui,
            icon: CalendarCheck2,
            cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
          },
          {
            label: "Cuti Ditolak",
            value: stats.ditolak,
            icon: XCircle,
            cls: "text-rose-600 bg-rose-500/10 border-rose-500/20",
          },
          {
            label: "Hari Cuti Terpakai",
            value: stats.totalHari,
            icon: ClipboardCheck,
            cls: "text-sky-600 bg-sky-500/10 border-sky-500/20",
          },
          {
            label: "Karyawan Cuti",
            value: stats.karyawan,
            icon: Users,
            cls: "text-violet-600 bg-violet-500/10 border-violet-500/20",
          },
        ].map((s) => (
          <Card key={s.label} className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${s.cls}`}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {s.label}
                </p>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="w-44 text-center">
            <p className="text-base font-bold text-slate-900">{BULAN_PANJANG[viewMonth]}</p>
            <p className="text-xs text-slate-400">{viewYear}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => changeMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="ml-1 text-emerald-600"
            onClick={() => {
              setViewMonth(today.getMonth());
              setViewYear(today.getFullYear());
            }}
          >
            Bulan Ini
          </Button>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <Input
            placeholder="Cari nama / kode karyawan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full lg:w-56"
          />
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Semua Cabang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Matriks Rekap Cuti per Karyawan */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <FileBarChart2 className="h-4 w-4 text-emerald-600" />
              Matriks Cuti Terpakai — {BULAN_PANJANG[viewMonth]} {viewYear}
            </h3>
            <p className="text-xs text-slate-500">
              {empRowsWithApproved.length} karyawan dengan cuti disetujui • hanya hari yang jatuh
              dalam bulan ini
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 min-w-52 bg-slate-50 shadow-[1px_0_0_#f1f5f9]">
                  Karyawan
                </TableHead>
                {JENIS_CUTI.map((j) => (
                  <TableHead key={j.value} className="min-w-24 text-center text-xs">
                    {j.label}
                  </TableHead>
                ))}
                <TableHead className="min-w-24 text-center text-emerald-700">Total Hari</TableHead>
                <TableHead className="min-w-24 text-center">Permohonan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={JENIS_CUTI.length + 3}
                    className="h-32 text-center text-slate-500"
                  >
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : empRowsWithApproved.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={JENIS_CUTI.length + 3}
                    className="p-12 text-center text-slate-500"
                  >
                    Tidak ada cuti disetujui pada bulan ini.
                  </TableCell>
                </TableRow>
              ) : (
                empRowsWithApproved.map((r) => (
                  <TableRow key={r.empId} className="transition-colors hover:bg-slate-50/60">
                    <TableCell className="sticky left-0 z-10 bg-white shadow-[1px_0_0_#f1f5f9]">
                      <div className="font-medium text-slate-900">{r.emp?.nama || "-"}</div>
                      <div className="text-xs text-slate-400">
                        {r.emp?.kode_karyawan || "-"} • {r.emp?.branches?.nama || "-"}
                      </div>
                    </TableCell>
                    {JENIS_CUTI.map((j) => {
                      const n = r.counts[j.value] || 0;
                      return (
                        <TableCell key={j.value} className="text-center">
                          <span
                            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-xs font-bold ${
                              n > 0 ? j.bg : "border-slate-100 text-slate-300"
                            }`}
                          >
                            {n || 0}
                          </span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold text-emerald-700">
                      {r.total}
                    </TableCell>
                    <TableCell className="text-center text-slate-500">{r.permohonan}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail permohonan bulan ini */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-950">Daftar Permohonan Cuti Bulan Ini</h3>
          <p className="text-xs text-slate-500">{filteredCuti.length} permohonan</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-transparent">
                <TableHead>Karyawan</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-center">Hari (bulan ini)</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : filteredCuti.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-10 text-center text-slate-500">
                    Belum ada permohonan cuti pada bulan ini.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCuti.map((c) => {
                  const jenisCuti = getJenisCuti(c.jenis);
                  const statusCuti = getStatusCuti(c.status);
                  const hariBulanIni = countDaysInMonth(
                    c.tanggal_list,
                    c.tanggal_mulai,
                    c.tanggal_selesai,
                    monthStart,
                    monthEnd,
                  );
                  return (
                    <TableRow key={c.id} className="transition-colors hover:bg-slate-50">
                      <TableCell>
                        <div className="font-medium text-slate-900">{c.employees?.nama || "-"}</div>
                        <div className="text-xs text-slate-400">
                          {c.employees?.kode_karyawan || "-"} • {c.employees?.branches?.nama || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${jenisCuti.bg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${jenisCuti.dot}`} />
                          {jenisCuti.label}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-600">
                        {formatTanggalHR(c.tanggal_mulai)} → {formatTanggalHR(c.tanggal_selesai)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{hariBulanIni}</Badge>
                      </TableCell>
                      <TableCell className="max-w-56">
                        <span className="line-clamp-2 text-xs text-slate-500">
                          {c.alasan || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCuti.variant}>{statusCuti.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Info cara kerja */}
      <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 text-sm text-sky-900">
        <p className="flex items-center gap-1.5 font-semibold">
          <CalendarSync className="h-4 w-4" /> Terhubung dengan Rekap Absen
        </p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-sky-800">
          <li>
            Cuti yang <b>disetujui</b> otomatis tercatat sebagai status "Cuti" di halaman Rekap
            Absen (tombol "Sinkron Cuti → Absen").
          </li>
          <li>
            "Hari Cuti Terpakai" dihitung dari hari yang benar-benar jatuh dalam bulan tampilan —
            permohonan lintas bulan dihitung per bagian.
          </li>
          <li>
            Permohonan multi-tanggal dihitung dari daftar tanggal terpilih, bukan rentang penuh.
          </li>
        </ul>
      </div>
    </div>
  );
}
