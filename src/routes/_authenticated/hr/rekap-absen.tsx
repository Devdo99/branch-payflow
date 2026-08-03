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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileDown,
  ClipboardCheck,
} from "lucide-react";
import {
  STATUS_ABSEN,
  getStatusAbsen,
  BULAN_PANJANG,
  formatTanggalHR,
  toISODate,
  getDaysInMonth,
} from "@/lib/hr";
import { downloadCSV, downloadPDFTable, safeFileName } from "@/lib/hr-export";

export const Route = createFileRoute("/_authenticated/hr/rekap-absen")({
  component: RekapAbsenPage,
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

type AbsenRecord = {
  id: string;
  employee_id: string;
  tanggal: string;
  status: string;
  keterangan?: string | null;
  employees?: { nama?: string; kode_karyawan?: string | null } | null;
};

function RekapAbsenPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [empId, setEmpId] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [status, setStatus] = useState("hadir");
  const [keterangan, setKeterangan] = useState("");

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: branches = [] } = useQuery({
    queryKey: ["branches_hr_absen"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, nama").order("nama");
      return (data as { id: string; nama: string }[]) || [];
    },
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees_hr_absen", selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("id, nama, kode_karyawan, jabatan, aktif, branch_id, branches ( nama )")
        .order("nama");
      if (selectedBranch !== "all") query = query.eq("branch_id", selectedBranch);
      const { data } = await query;
      return (data || []) as Employee[];
    },
  });

  const { data: absenList = [], isLoading } = useQuery<AbsenRecord[]>({
    queryKey: ["absen_list", viewYear, viewMonth, selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from("absensi")
        .select(
          "id, employee_id, tanggal, status, keterangan, employees ( nama, kode_karyawan, branch_id )",
        )
        .gte("tanggal", monthStart)
        .lte("tanggal", monthEnd);
      if (selectedBranch !== "all") query = query.eq("employees.branch_id", selectedBranch);
      const { data, error } = await query.order("tanggal");
      if (error) throw error;
      return (data || []) as AbsenRecord[];
    },
  });

  // Peta absen: employee_id|tanggal -> record
  const absenMap = useMemo(() => {
    const map: Record<string, AbsenRecord> = {};
    absenList.forEach((a) => {
      map[`${a.employee_id}|${a.tanggal}`] = a;
    });
    return map;
  }, [absenList]);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return employees.filter(
      (e) =>
        term === "" ||
        e.nama.toLowerCase().includes(term) ||
        e.kode_karyawan?.toLowerCase().includes(term),
    );
  }, [employees, searchTerm]);

  // Statistik bulan ini
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_ABSEN.forEach((s) => (counts[s.value] = 0));
    absenList.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [absenList]);

  const summaryPerEmployee = useMemo(() => {
    const summary: Record<string, Record<string, number>> = {};
    filteredEmployees.forEach((e) => {
      const base: Record<string, number> = {};
      STATUS_ABSEN.forEach((s) => (base[s.value] = 0));
      summary[e.id] = base;
    });
    absenList.forEach((a) => {
      if (summary[a.employee_id]) {
        summary[a.employee_id][a.status] = (summary[a.employee_id][a.status] || 0) + 1;
      }
    });
    return summary;
  }, [absenList, filteredEmployees]);

  const handleClose = () => {
    setIsOpen(false);
    setIsEditing(false);
    setEditId(null);
    setEmpId("");
    setTanggal("");
    setStatus("hadir");
    setKeterangan("");
  };

  const openAdd = (prefillEmpId = "", prefillTanggal = "") => {
    setIsEditing(false);
    setEditId(null);
    setEmpId(prefillEmpId);
    setTanggal(prefillTanggal || monthStart);
    setStatus("hadir");
    setKeterangan("");
    setIsOpen(true);
  };

  const openEdit = (a: AbsenRecord) => {
    setIsEditing(true);
    setEditId(a.id);
    setEmpId(a.employee_id);
    setTanggal(a.tanggal);
    setStatus(a.status);
    setKeterangan(a.keterangan || "");
    setIsOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Setiap input manual dianggap sumber='manual' (bukan otomatis dari cuti),
      // sehingga tidak akan ditimpa ulang oleh sinkronisasi jadwal cuti.
      const payload = {
        employee_id: empId,
        tanggal,
        status,
        keterangan: keterangan || null,
        sumber: "manual",
        cuti_id: null,
      };
      if (isEditing && editId) {
        const { error } = await supabase.from("absensi").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        // Hindari duplikat (employee_id + tanggal) dengan upsert
        const { error } = await supabase
          .from("absensi")
          .upsert([payload], { onConflict: "employee_id,tanggal" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absen_list"] });
      toast.success(isEditing ? "Data absen diperbarui!" : "Data absen disimpan!");
      handleClose();
    },
    onError: (err) => toast.error(`Gagal menyimpan: ${(err as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("absensi").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absen_list"] });
      toast.success("Data absen dihapus!");
    },
    onError: (err) => toast.error(`Gagal menghapus: ${(err as Error).message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId) return toast.error("Pilih karyawan terlebih dahulu.");
    if (!tanggal) return toast.error("Lengkapi tanggal.");
    saveMutation.mutate();
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

  const exportExcel = () => {
    if (filteredEmployees.length === 0) return toast.error("Tidak ada data untuk diekspor.");
    const headers = [
      "Kode",
      "Nama Karyawan",
      "Cabang",
      "Jabatan",
      ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
      "Hadir",
      "Izin Masuk",
      "Sakit",
      "Telat",
      "Absen",
      "Resign",
      "Cuti",
    ];
    const rows = filteredEmployees.map((e) => {
      const sum = summaryPerEmployee[e.id] || {};
      const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
        const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
        const rec = absenMap[`${e.id}|${key}`];
        return rec ? getStatusAbsen(rec.status).short : "";
      });
      return [
        e.kode_karyawan || "-",
        e.nama,
        e.branches?.nama || "-",
        e.jabatan || "-",
        ...dayCells,
        sum.hadir || 0,
        sum.izin_masuk || 0,
        sum.sakit || 0,
        sum.telat || 0,
        sum.absen || 0,
        sum.resign || 0,
        sum.cuti || 0,
      ];
    });
    downloadCSV(
      `Rekap_Absen_${safeFileName(BULAN_PANJANG[viewMonth])}_${viewYear}.csv`,
      headers,
      rows,
    );
  };

  const exportPDF = () => {
    if (filteredEmployees.length === 0) return toast.error("Tidak ada data untuk diekspor.");
    const headers = ["Kode", "Nama", "Hadir", "Izin", "Sakit", "Telat", "Absen", "Resign", "Cuti"];
    const rows = filteredEmployees.map((e) => {
      const sum = summaryPerEmployee[e.id] || {};
      return [
        e.kode_karyawan || "-",
        e.nama,
        sum.hadir || 0,
        sum.izin_masuk || 0,
        sum.sakit || 0,
        sum.telat || 0,
        sum.absen || 0,
        sum.resign || 0,
        sum.cuti || 0,
      ];
    });
    downloadPDFTable(
      `Rekap_Absen_${safeFileName(BULAN_PANJANG[viewMonth])}_${viewYear}.pdf`,
      "Rekap Absen Karyawan",
      `${selectedBranch === "all" ? "Semua Cabang" : branches.find((b) => b.id === selectedBranch)?.nama} • ${BULAN_PANJANG[viewMonth]} ${viewYear}`,
      headers,
      rows,
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Rekap Absen Karyawan"
        description="Rekap kehadiran, izin masuk, sakit, telat, absen, dan status resign karyawan."
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
            <Dialog
              open={isOpen}
              onOpenChange={(open) => (!open ? handleClose() : setIsOpen(true))}
            >
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer">
                  <Plus className="w-4 h-4 mr-2" /> Tambah Absen
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {isEditing ? "Edit Absen" : "Tambah Absen"}
                  </DialogTitle>
                  <DialogDescription>
                    Catat status kehadiran karyawan untuk tanggal tertentu.
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
                        {employees.map((e) => (
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
                        Tanggal
                      </Label>
                      <Input
                        type="date"
                        value={tanggal}
                        onChange={(e) => setTanggal(e.target.value)}
                        min={monthStart}
                        max={monthEnd}
                      />
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
                          {STATUS_ABSEN.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Keterangan
                    </Label>
                    <Textarea
                      placeholder="Contoh: izin masuk terlambat 1 jam, sakit demam, dll."
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" type="button" onClick={handleClose}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Simpan"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Statistik */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {STATUS_ABSEN.map((s) => (
          <Card key={s.value} className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={`h-3 w-3 shrink-0 rounded-full ${s.dot}`} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {s.label}
                </p>
                <p className="text-xl font-bold text-slate-900">{stats[s.value] || 0}</p>
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
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border/60 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Legenda:</span>
        {STATUS_ABSEN.map((s) => (
          <span key={s.value} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto hidden text-xs text-slate-400 sm:block">
          Klik sel untuk mengubah status. Status Cuti dibuat otomatis dari jadwal cuti yang
          disetujui, tetapi tetap bisa diedit manual.
        </span>
      </div>

      {/* Matriks Rekap */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ClipboardCheck className="h-4 w-4 text-emerald-600" />
              Matriks Kehadiran — {BULAN_PANJANG[viewMonth]} {viewYear}
            </h3>
            <p className="text-xs text-slate-500">
              {filteredEmployees.length} karyawan • {daysInMonth} hari kerja
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
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <TableHead
                    key={i}
                    className={`min-w-9 px-1 text-center text-xs ${
                      toISODate(new Date(viewYear, viewMonth, i + 1)) === toISODate(today)
                        ? "bg-emerald-50 text-emerald-700"
                        : ""
                    }`}
                  >
                    {i + 1}
                  </TableHead>
                ))}
                <TableHead className="min-w-28 text-center">Total Hadir</TableHead>
                <TableHead className="min-w-28 text-center">Izin</TableHead>
                <TableHead className="min-w-24 text-center">Sakit</TableHead>
                <TableHead className="min-w-24 text-center">Telat</TableHead>
                <TableHead className="min-w-24 text-center">Absen</TableHead>
                <TableHead className="min-w-24 text-center">Resign</TableHead>
                <TableHead className="min-w-24 text-center text-sky-700">Cuti</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={daysInMonth + 8} className="h-32 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={daysInMonth + 8} className="p-12 text-center text-slate-500">
                    Tidak ada karyawan untuk filter ini.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((e) => {
                  const sum = summaryPerEmployee[e.id] || {};
                  return (
                    <TableRow key={e.id} className="transition-colors hover:bg-slate-50/60">
                      <TableCell className="sticky left-0 z-10 bg-white shadow-[1px_0_0_#f1f5f9]">
                        <div className="font-medium text-slate-900">{e.nama}</div>
                        <div className="text-xs text-slate-400">
                          {e.kode_karyawan || "-"} • {e.branches?.nama || "-"}
                        </div>
                      </TableCell>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                        const rec = absenMap[`${e.id}|${key}`];
                        const isToday = key === toISODate(today);
                        const st = rec ? getStatusAbsen(rec.status) : null;
                        return (
                          <TableCell key={i} className="px-1 py-1.5 text-center">
                            {st ? (
                              <button
                                type="button"
                                title={`${e.nama} — ${st.label}${rec.keterangan ? `: ${rec.keterangan}` : ""} (klik untuk edit)`}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[10px] font-bold transition-transform hover:scale-110 ${st.bg}`}
                                onClick={() => openEdit(rec)}
                              >
                                {st.short}
                              </button>
                            ) : (
                              <button
                                type="button"
                                title={`Klik untuk catat ${e.nama}`}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[10px] text-slate-300 transition-colors hover:border-emerald-300 hover:text-emerald-500 ${
                                  isToday ? "bg-emerald-50" : ""
                                }`}
                                onClick={() => openAdd(e.id, key)}
                              >
                                +
                              </button>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-semibold text-emerald-700">
                        {sum.hadir || 0}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-amber-700">
                        {sum.izin_masuk || 0}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-rose-700">
                        {sum.sakit || 0}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-orange-700">
                        {sum.telat || 0}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-red-700">
                        {sum.absen || 0}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-violet-700">
                        {sum.resign || 0}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-sky-700">
                        {sum.cuti || 0}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Daftar detail absen bulan ini */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-950">Riwayat Absen Bulan Ini</h3>
          <p className="text-xs text-slate-500">{absenList.length} catatan</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-transparent">
                <TableHead>Tanggal</TableHead>
                <TableHead>Karyawan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {absenList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-10 text-center text-slate-500">
                    Belum ada catatan absen pada bulan ini.
                  </TableCell>
                </TableRow>
              ) : (
                absenList.map((a) => {
                  const st = getStatusAbsen(a.status);
                  return (
                    <TableRow key={a.id} className="transition-colors hover:bg-slate-50">
                      <TableCell className="whitespace-nowrap font-medium">
                        {formatTanggalHR(a.tanggal)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{a.employees?.nama || "-"}</div>
                        <div className="text-xs text-slate-400">
                          {a.employees?.kode_karyawan || ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${st.bg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-64 text-xs text-slate-500">
                        {a.keterangan || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-600"
                            onClick={() => openEdit(a)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-500 hover:bg-rose-500/10"
                            onClick={() => {
                              if (window.confirm("Hapus catatan absen ini?"))
                                deleteMutation.mutate(a.id);
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
