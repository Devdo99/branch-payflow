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
  FileSpreadsheet,
  FileDown,
  UserX,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { BULAN_PANJANG, formatTanggalHR } from "@/lib/hr";
import { downloadCSV, downloadPDFTable, safeFileName } from "@/lib/hr-export";

export const Route = createFileRoute("/_authenticated/hr/resign")({
  component: ResignPage,
});

type Employee = {
  id: string;
  nama: string;
  kode_karyawan?: string | null;
  jabatan?: string | null;
  aktif?: boolean;
  tanggal_masuk?: string | null;
  branches?: { nama?: string } | null;
};

type ResignRecord = {
  id: string;
  employee_id: string;
  tanggal_resign: string;
  alasan?: string | null;
  laporan?: string | null;
  created_at?: string;
  employees?: Employee | null;
};

function ResignPage() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [empId, setEmpId] = useState("");
  const [tanggalResign, setTanggalResign] = useState("");
  const [alasan, setAlasan] = useState("");
  const [laporan, setLaporan] = useState("");
  const [viewLaporan, setViewLaporan] = useState<ResignRecord | null>(null);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees_hr_resign"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nama, kode_karyawan, jabatan, aktif, tanggal_masuk, branches ( nama )")
        .order("nama");
      return (data || []) as Employee[];
    },
  });

  const { data: resignList = [], isLoading } = useQuery<ResignRecord[]>({
    queryKey: ["resign_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resign")
        .select(
          "id, employee_id, tanggal_resign, alasan, laporan, created_at, employees ( id, nama, kode_karyawan, jabatan, aktif, tanggal_masuk, branches ( nama ) )",
        )
        .order("tanggal_resign", { ascending: false });
      if (error) throw error;
      return (data || []) as ResignRecord[];
    },
  });

  const aktifEmployees = useMemo(() => employees.filter((e) => e.aktif), [employees]);

  const stats = useMemo(() => {
    const total = resignList.length;
    const tahunIni = resignList.filter((r) =>
      r.tanggal_resign?.startsWith(String(currentYear)),
    ).length;
    const bulanIni = resignList.filter((r) =>
      r.tanggal_resign?.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`),
    ).length;
    return { total, tahunIni, bulanIni };
  }, [resignList, currentYear, currentMonth]);

  const handleClose = () => {
    setIsOpen(false);
    setIsEditing(false);
    setEditId(null);
    setEmpId("");
    setTanggalResign("");
    setAlasan("");
    setLaporan("");
  };

  const openAdd = () => {
    setIsEditing(false);
    setEditId(null);
    setEmpId("");
    setTanggalResign(new Date().toISOString().slice(0, 10));
    setAlasan("");
    setLaporan("");
    setIsOpen(true);
  };

  const openEdit = (r: ResignRecord) => {
    setIsEditing(true);
    setEditId(r.id);
    setEmpId(r.employee_id);
    setTanggalResign(r.tanggal_resign);
    setAlasan(r.alasan || "");
    setLaporan(r.laporan || "");
    setIsOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        employee_id: empId,
        tanggal_resign: tanggalResign,
        alasan,
        laporan,
      };
      if (isEditing && editId) {
        const { error } = await supabase.from("resign").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resign").insert([payload]);
        if (error) throw error;
        // Otomatis nonaktifkan karyawan di panel gaji
        const { error: empError } = await supabase
          .from("employees")
          .update({ aktif: false })
          .eq("id", empId);
        if (empError) throw empError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resign_list"] });
      queryClient.invalidateQueries({ queryKey: ["employees_hr_resign"] });
      queryClient.invalidateQueries({ queryKey: ["employees_list"] });
      toast.success(
        isEditing
          ? "Data resign berhasil diperbarui!"
          : "Data resign disimpan. Karyawan otomatis dinonaktifkan di panel gaji.",
      );
      handleClose();
    },
    onError: (err) => toast.error(`Gagal menyimpan: ${(err as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: ResignRecord) => {
      const { error } = await supabase.from("resign").delete().eq("id", r.id);
      if (error) throw error;
      // Cek apakah masih ada catatan resign lain untuk karyawan ini
      const { data: remaining, error: checkError } = await supabase
        .from("resign")
        .select("id")
        .eq("employee_id", r.employee_id);
      if (checkError) throw checkError;
      if (!remaining || remaining.length === 0) {
        const { error: empError } = await supabase
          .from("employees")
          .update({ aktif: true })
          .eq("id", r.employee_id);
        if (empError) throw empError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resign_list"] });
      queryClient.invalidateQueries({ queryKey: ["employees_hr_resign"] });
      queryClient.invalidateQueries({ queryKey: ["employees_list"] });
      toast.success("Data resign dihapus. Karyawan dikembalikan ke status aktif.");
    },
    onError: (err) => toast.error(`Gagal menghapus: ${(err as Error).message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId) return toast.error("Pilih karyawan terlebih dahulu.");
    if (!tanggalResign) return toast.error("Lengkapi tanggal resign.");
    saveMutation.mutate();
  };

  const exportExcel = () => {
    if (resignList.length === 0) return toast.error("Tidak ada data resign untuk diekspor.");
    const headers = [
      "Kode",
      "Nama Karyawan",
      "Cabang",
      "Jabatan",
      "Tanggal Masuk",
      "Tanggal Resign",
      "Alasan",
      "Laporan",
    ];
    const rows = resignList.map((r) => [
      r.employees?.kode_karyawan || "-",
      r.employees?.nama || "-",
      r.employees?.branches?.nama || "-",
      r.employees?.jabatan || "-",
      r.employees?.tanggal_masuk || "-",
      r.tanggal_resign,
      r.alasan || "-",
      r.laporan || "-",
    ]);
    downloadCSV(`Laporan_Resign_Karyawan_${currentYear}.csv`, headers, rows);
  };

  const exportPDF = () => {
    if (resignList.length === 0) return toast.error("Tidak ada data resign untuk diekspor.");
    const headers = ["Kode", "Nama", "Cabang", "Jabatan", "Tgl Masuk", "Tgl Resign", "Alasan"];
    const rows = resignList.map((r) => [
      r.employees?.kode_karyawan || "-",
      r.employees?.nama || "-",
      r.employees?.branches?.nama || "-",
      r.employees?.jabatan || "-",
      r.employees?.tanggal_masuk || "-",
      r.tanggal_resign,
      r.alasan || "-",
    ]);
    downloadPDFTable(
      `Laporan_Resign_Karyawan_${currentYear}.pdf`,
      "Laporan Resign Karyawan",
      `Periode ${currentYear} • Total ${resignList.length} karyawan resign`,
      headers,
      rows,
    );
  };

  const getMasaKerja = (tanggalMasuk?: string | null, tanggalResign?: string) => {
    if (!tanggalMasuk || !tanggalResign) return "-";
    const start = new Date(`${tanggalMasuk}T00:00:00`);
    const end = new Date(`${tanggalResign}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
    let months =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) months -= 1;
    if (months < 0) months = 0;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    if (years <= 0) return `${rest} bulan`;
    return `${years} thn${rest > 0 ? ` ${rest} bln` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Resign Karyawan"
        description="Kelola status resign karyawan, tulis laporan, dan unduh laporan resign."
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
                  <Plus className="w-4 h-4 mr-2" /> Catat Resign
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {isEditing ? "Edit Data Resign" : "Catat Resign Karyawan"}
                  </DialogTitle>
                  <DialogDescription>
                    Karyawan akan otomatis dinonaktifkan dari panel gaji setelah resign dicatat.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Karyawan
                    </Label>
                    <Select value={empId} onValueChange={setEmpId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih karyawan aktif" />
                      </SelectTrigger>
                      <SelectContent>
                        {aktifEmployees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nama} {e.kode_karyawan ? `(${e.kode_karyawan})` : ""}
                          </SelectItem>
                        ))}
                        {aktifEmployees.length === 0 && (
                          <SelectItem value="__none__" disabled>
                            Tidak ada karyawan aktif
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tanggal Resign
                    </Label>
                    <Input
                      type="date"
                      value={tanggalResign}
                      onChange={(e) => setTanggalResign(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Alasan Resign
                    </Label>
                    <Input
                      placeholder="Contoh: mengundurkan diri, pindah kota, dll."
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Laporan Resign
                    </Label>
                    <Textarea
                      rows={5}
                      placeholder="Tuliskan laporan lengkap: kronologi, serah terima pekerjaan, catatan, dll."
                      value={laporan}
                      onChange={(e) => setLaporan(e.target.value)}
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
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Resign", value: stats.total, icon: UserX },
          { label: "Resign Tahun Ini", value: stats.tahunIni, icon: FileText },
          { label: "Resign Bulan Ini", value: stats.bulanIni, icon: AlertTriangle },
        ].map((s) => (
          <Card key={s.label} className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-500/15 to-fuchsia-400/15 border border-violet-500/20">
                <s.icon className="h-6 w-6 text-violet-600" />
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

      {/* Daftar Resign */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Daftar Karyawan Resign</h3>
            <p className="text-xs text-slate-500">
              {resignList.length} catatan • klik ikon dokumen untuk melihat laporan lengkap
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-transparent">
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Masa Kerja</TableHead>
                <TableHead>Tanggal Resign</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead className="text-center">Laporan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : resignList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-12 text-center text-slate-500">
                    Belum ada karyawan resign. Klik "Catat Resign" untuk menambahkan.
                  </TableCell>
                </TableRow>
              ) : (
                resignList.map((r) => (
                  <TableRow key={r.id} className="transition-colors hover:bg-slate-50">
                    <TableCell className="font-medium text-slate-400">
                      {r.employees?.kode_karyawan || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{r.employees?.nama || "-"}</div>
                    </TableCell>
                    <TableCell>{r.employees?.branches?.nama || "-"}</TableCell>
                    <TableCell>{r.employees?.jabatan || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getMasaKerja(r.employees?.tanggal_masuk, r.tanggal_resign)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatTanggalHR(r.tanggal_resign)}
                    </TableCell>
                    <TableCell className="max-w-48">
                      <span className="line-clamp-2 text-xs text-slate-500">{r.alasan || "-"}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-600"
                        disabled={!r.laporan}
                        onClick={() => setViewLaporan(r)}
                        title={r.laporan ? "Lihat laporan" : "Belum ada laporan"}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-600"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:bg-rose-500/10"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Hapus data resign ini? Karyawan akan dikembalikan ke status aktif.",
                              )
                            )
                              deleteMutation.mutate(r);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog Lihat Laporan */}
      <Dialog open={!!viewLaporan} onOpenChange={(open) => !open && setViewLaporan(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Laporan Resign — {viewLaporan?.employees?.nama || "-"}
            </DialogTitle>
            <DialogDescription>
              {viewLaporan?.employees?.kode_karyawan || "-"} •{" "}
              {formatTanggalHR(viewLaporan?.tanggal_resign)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {viewLaporan?.alasan && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Alasan</p>
                <p className="mt-1 text-sm text-amber-900">{viewLaporan.alasan}</p>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Laporan Lengkap
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {viewLaporan?.laporan || "Belum ada laporan ditulis."}
              </p>
            </div>
            <div className="flex items-center justify-end">
              <Button
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => {
                  if (!viewLaporan) return;
                  downloadPDFTable(
                    `Laporan_Resign_${safeFileName(viewLaporan.employees?.nama)}.pdf`,
                    "Laporan Resign Karyawan",
                    `${viewLaporan.employees?.nama} • ${viewLaporan.employees?.kode_karyawan || "-"}`,
                    ["Alasan", "Laporan"],
                    [[viewLaporan.alasan || "-"], [viewLaporan.laporan || "-"]],
                  );
                }}
              >
                <FileDown className="mr-2 h-4 w-4" /> Unduh Laporan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info cara kerja */}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">💡 Catatan:</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-emerald-800">
          <li>
            Saat mencatat resign, karyawan otomatis diubah menjadi <b>Nonaktif</b> sehingga tidak
            muncul lagi di proses gaji.
          </li>
          <li>
            Menghapus data resign akan mengembalikan karyawan ke status <b>Aktif</b> (kecuali masih
            ada catatan resign lain).
          </li>
          <li>Karyawan yang dipilih diambil dari data panel gaji (menu Karyawan).</li>
        </ul>
      </div>
    </div>
  );
}
