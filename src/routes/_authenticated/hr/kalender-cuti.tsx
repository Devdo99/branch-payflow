import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileSpreadsheet,
  FileDown,
  Users,
} from "lucide-react";
import {
  JENIS_CUTI,
  STATUS_CUTI,
  getJenisCuti,
  getStatusCuti,
  BULAN_PANJANG,
  HARI_PENDEK,
  formatTanggalHR,
  toISODate,
  getDaysInMonth,
  countDays,
} from "@/lib/hr";
import { downloadCSV, downloadPDFTable, safeFileName } from "@/lib/hr-export";

export const Route = createFileRoute("/_authenticated/hr/kalender-cuti")({
  component: KalenderCutiPage,
});

type Employee = {
  id: string;
  nama: string;
  kode_karyawan?: string | null;
  jabatan?: string | null;
  aktif?: boolean;
  branch_id?: string | null;
  branches?: { nama?: string } | null;
};

type CutiRecord = {
  id: string;
  employee_id: string;
  jenis: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  alasan?: string | null;
  status: string;
  employees?: Employee | null;
};

function KalenderCutiPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  const [selectedBranch, setSelectedBranch] = useState("all");

  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [empId, setEmpId] = useState("");
  const [jenis, setJenis] = useState("tahunan");
  const [tglMulai, setTglMulai] = useState("");
  const [tglSelesai, setTglSelesai] = useState("");
  const [alasan, setAlasan] = useState("");
  const [status, setStatus] = useState("diajukan");

  const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(
    getDaysInMonth(viewYear, viewMonth),
  ).padStart(2, "0")}`;

  // Data cabang & karyawan
  const { data: branches = [] } = useQuery({
    queryKey: ["branches_hr"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, nama").order("nama");
      return (data as { id: string; nama: string }[]) || [];
    },
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees_hr_cuti"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nama, kode_karyawan, jabatan, aktif, branch_id, branches ( nama )")
        .order("nama");
      return (data || []) as Employee[];
    },
  });

  // Data cuti yang menabrak bulan tampilan
  const { data: cutiList = [], isLoading } = useQuery<CutiRecord[]>({
    queryKey: ["cuti_list", viewYear, viewMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cuti")
        .select(
          "id, employee_id, jenis, tanggal_mulai, tanggal_selesai, alasan, status, employees ( id, nama, kode_karyawan, jabatan, aktif, branch_id, branches ( nama ) )",
        )
        .lte("tanggal_mulai", monthEnd)
        .gte("tanggal_selesai", monthStart)
        .order("tanggal_mulai");
      if (error) throw error;
      return (data || []) as CutiRecord[];
    },
  });

  const filteredCuti = useMemo(() => {
    return cutiList.filter((c) => {
      if (selectedBranch === "all") return true;
      return c.employees?.branch_id === selectedBranch;
    });
  }, [cutiList, selectedBranch]);

  const selectedBranchName =
    selectedBranch === "all"
      ? "Semua Cabang"
      : branches.find((b) => b.id === selectedBranch)?.nama || selectedBranch;

  // Bangun grid kalender (dimulai hari Senin)
  const grid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // Senin = 0
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const cutiByDate = useMemo(() => {
    const map: Record<string, CutiRecord[]> = {};
    filteredCuti.forEach((c) => {
      const s = new Date(`${c.tanggal_mulai}T00:00:00`);
      const e = new Date(`${c.tanggal_selesai}T00:00:00`);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const key = toISODate(d);
        if (key >= monthStart && key <= monthEnd) {
          if (!map[key]) map[key] = [];
          map[key].push(c);
        }
      }
    });
    return map;
  }, [filteredCuti, monthStart, monthEnd]);

  const stats = useMemo(() => {
    const total = filteredCuti.length;
    const disetujui = filteredCuti.filter((c) => c.status === "disetujui").length;
    const todayKey = toISODate(today);
    const cutiHariIni = (cutiByDate[todayKey] || []).length;
    return { total, disetujui, cutiHariIni };
  }, [filteredCuti, cutiByDate, today]);

  const handleClose = () => {
    setIsOpen(false);
    setIsEditing(false);
    setEditId(null);
    setEmpId("");
    setJenis("tahunan");
    setTglMulai("");
    setTglSelesai("");
    setAlasan("");
    setStatus("diajukan");
  };

  const openAdd = () => {
    setEmpId("");
    setJenis("tahunan");
    setTglMulai(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`);
    setTglSelesai("");
    setAlasan("");
    setStatus("diajukan");
    setIsEditing(false);
    setIsOpen(true);
  };

  const openEdit = (c: CutiRecord) => {
    setIsEditing(true);
    setEditId(c.id);
    setEmpId(c.employee_id);
    setJenis(c.jenis);
    setTglMulai(c.tanggal_mulai);
    setTglSelesai(c.tanggal_selesai);
    setAlasan(c.alasan || "");
    setStatus(c.status);
    setIsOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        employee_id: empId,
        jenis,
        tanggal_mulai: tglMulai,
        tanggal_selesai: tglSelesai,
        alasan,
        status,
      };
      if (isEditing && editId) {
        const { error } = await supabase.from("cuti").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cuti").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuti_list"] });
      toast.success(isEditing ? "Data cuti berhasil diperbarui!" : "Data cuti berhasil disimpan!");
      handleClose();
    },
    onError: (err) => toast.error(`Gagal menyimpan: ${(err as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cuti").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuti_list"] });
      toast.success("Data cuti dihapus!");
    },
    onError: (err) => toast.error(`Gagal menghapus: ${(err as Error).message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId) return toast.error("Pilih karyawan terlebih dahulu.");
    if (!tglMulai || !tglSelesai) return toast.error("Lengkapi tanggal cuti.");
    if (tglSelesai < tglMulai)
      return toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    saveMutation.mutate();
  };

  const exportExcel = () => {
    if (filteredCuti.length === 0) return toast.error("Tidak ada data cuti untuk diekspor.");
    const headers = [
      "Kode",
      "Nama Karyawan",
      "Cabang",
      "Jabatan",
      "Jenis Cuti",
      "Tanggal Mulai",
      "Tanggal Selesai",
      "Jumlah Hari",
      "Alasan",
      "Status",
    ];
    const rows = filteredCuti.map((c) => [
      c.employees?.kode_karyawan || "-",
      c.employees?.nama || "-",
      c.employees?.branches?.nama || "-",
      c.employees?.jabatan || "-",
      getJenisCuti(c.jenis).label,
      c.tanggal_mulai,
      c.tanggal_selesai,
      countDays(c.tanggal_mulai, c.tanggal_selesai),
      c.alasan || "-",
      getStatusCuti(c.status).label,
    ]);
    downloadCSV(
      `Kalender_Cuti_${safeFileName(BULAN_PANJANG[viewMonth])}_${viewYear}.csv`,
      headers,
      rows,
    );
  };

  const exportPDF = () => {
    if (filteredCuti.length === 0) return toast.error("Tidak ada data cuti untuk diekspor.");
    const headers = [
      "Kode",
      "Nama Karyawan",
      "Cabang",
      "Jenis Cuti",
      "Tanggal Mulai",
      "Tanggal Selesai",
      "Hari",
      "Status",
    ];
    const rows = filteredCuti.map((c) => [
      c.employees?.kode_karyawan || "-",
      c.employees?.nama || "-",
      c.employees?.branches?.nama || "-",
      getJenisCuti(c.jenis).label,
      c.tanggal_mulai,
      c.tanggal_selesai,
      countDays(c.tanggal_mulai, c.tanggal_selesai),
      getStatusCuti(c.status).label,
    ]);
    downloadPDFTable(
      `Kalender_Cuti_${safeFileName(BULAN_PANJANG[viewMonth])}_${viewYear}.pdf`,
      "Kalender Cuti Karyawan",
      `${selectedBranchName} • ${BULAN_PANJANG[viewMonth]} ${viewYear}`,
      headers,
      rows,
    );
  };

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

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Kalender Cuti Staf"
        description="Pantau jadwal cuti seluruh staf dalam tampilan kalender yang mudah dibaca."
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
            <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : setIsOpen(true))}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer">
                  <Plus className="w-4 h-4 mr-2" /> Tambah Cuti
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {isEditing ? "Edit Cuti" : "Tambah Cuti"}
                  </DialogTitle>
                  <DialogDescription>
                    Catat jadwal cuti karyawan. Karyawan diambil dari data panel gaji.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Karyawan
                    </Label>
                    <Select value={empId} onValueChange={setEmpId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih karyawan" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter((e) => e.aktif || e.id === empId)
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nama} {e.kode_karyawan ? `(${e.kode_karyawan})` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Jenis Cuti
                      </Label>
                      <Select value={jenis} onValueChange={setJenis}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {JENIS_CUTI.map((j) => (
                            <SelectItem key={j.value} value={j.value}>
                              {j.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Status
                      </Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_CUTI.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Tanggal Mulai
                      </Label>
                      <Input type="date" value={tglMulai} onChange={(e) => setTglMulai(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Tanggal Selesai
                      </Label>
                      <Input
                        type="date"
                        value={tglSelesai}
                        onChange={(e) => setTglSelesai(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Alasan
                    </Label>
                    <Textarea
                      placeholder="Tuliskan alasan cuti..."
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" type="button" onClick={handleClose}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Statistik */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Cuti Bulan Ini", value: stats.total, icon: CalendarDays },
          { label: "Cuti Disetujui", value: stats.disetujui, icon: Users },
          { label: "Staf Cuti Hari Ini", value: stats.cutiHariIni, icon: Users },
        ].map((s) => (
          <Card key={s.label} className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500/15 to-teal-400/15 border border-emerald-500/20">
                <s.icon className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {s.label}
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + Navigasi Bulan */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
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
        <div className="w-full sm:w-64">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full">
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
        </div>
      </div>

      {/* Grid Kalender */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
          {HARI_PENDEK.map((h) => (
            <div
              key={h}
              className={`px-2 py-2.5 text-center text-xs font-bold uppercase tracking-wider ${
                h === "Min" ? "text-rose-500" : "text-slate-500"
              }`}
            >
              {h}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {isLoading
            ? Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-24 border-b border-r border-slate-50 p-1.5" />
              ))
            : grid.map((day, i) => {
                if (day === null) return <div key={i} className="min-h-24 border-b border-r border-slate-50 bg-slate-50/40 p-1.5" />;
                const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = dateKey === toISODate(today);
                const isSunday = i % 7 === 6;
                const dayCuti = cutiByDate[dateKey] || [];
                return (
                  <div
                    key={i}
                    className={`min-h-24 border-b border-r border-slate-50 p-1.5 transition-colors hover:bg-emerald-50/40 ${
                      isSunday ? "bg-rose-50/30" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          isToday
                            ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20"
                            : "text-slate-600"
                        }`}
                      >
                        {day}
                      </span>
                      {dayCuti.length > 0 && (
                        <span className="text-[10px] font-semibold text-emerald-600">
                          {dayCuti.length} cuti
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {dayCuti.slice(0, 3).map((c) => {
                        const jenisCuti = getJenisCuti(c.jenis);
                        return (
                          <div
                            key={c.id}
                            className={`flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${jenisCuti.bg}`}
                            title={`${c.employees?.nama} • ${jenisCuti.label} • ${formatTanggalHR(c.tanggal_mulai)} - ${formatTanggalHR(c.tanggal_selesai)}`}
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${jenisCuti.dot}`} />
                            <span className="truncate">{c.employees?.nama}</span>
                          </div>
                        );
                      })}
                      {dayCuti.length > 3 && (
                        <p className="px-1 text-[10px] font-semibold text-slate-400">
                          +{dayCuti.length - 3} lainnya
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Legenda:
          </span>
          {JENIS_CUTI.map((j) => (
            <span key={j.value} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${j.dot}`} />
              {j.label}
            </span>
          ))}
        </div>
      </div>

      {/* Daftar Detail */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              Daftar Detail Cuti — {BULAN_PANJANG[viewMonth]} {viewYear}
            </h3>
            <p className="text-xs text-slate-500">
              {selectedBranchName} • {filteredCuti.length} catatan cuti
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-transparent">
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-center">Hari</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : filteredCuti.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-12 text-center text-slate-500">
                    Belum ada data cuti pada bulan ini. Klik "Tambah Cuti" untuk mencatat.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCuti.map((c) => {
                  const jenisCuti = getJenisCuti(c.jenis);
                  const statusCuti = getStatusCuti(c.status);
                  return (
                    <TableRow key={c.id} className="transition-colors hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-400">
                        {c.employees?.kode_karyawan || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{c.employees?.nama || "-"}</div>
                        {c.alasan && (
                          <div className="text-xs text-slate-400 line-clamp-1">{c.alasan}</div>
                        )}
                      </TableCell>
                      <TableCell>{c.employees?.branches?.nama || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${jenisCuti.bg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${jenisCuti.dot}`} />
                          {jenisCuti.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <span className="font-medium text-slate-700">
                            {formatTanggalHR(c.tanggal_mulai)}
                          </span>
                          <span className="text-slate-400"> → </span>
                          <span className="font-medium text-slate-700">
                            {formatTanggalHR(c.tanggal_selesai)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{countDays(c.tanggal_mulai, c.tanggal_selesai)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCuti.variant}>{statusCuti.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-600"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-500 hover:bg-rose-500/10"
                            onClick={() => {
                              if (window.confirm("Hapus data cuti ini?")) deleteMutation.mutate(c.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
