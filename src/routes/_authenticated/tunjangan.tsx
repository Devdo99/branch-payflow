import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { Plus, Pencil, Trash2, Loader2, Users, UserCog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tunjangan")({
  component: TunjanganPage,
});

const LIST_JOBDESK = [
  "Kasir",
  "Cook / Dapur",
  "Server / Pelayan",
  "Barista",
  "Piket Kebersihan",
  "Staf Inti",
];

function TunjanganPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    nama: string;
  } | null>(null);

  const [nama, setNama] = useState("");
  const [nominal, setNominal] = useState<number | "">("");
  const [metode, setMetode] = useState<"fixed" | "per_day" | "per_hour" | "per_event" | "manual">(
    "fixed",
  );
  const [aktif, setAktif] = useState(true);

  // Relasi Jobdesk Explicit
  const [isGlobal, setIsGlobal] = useState(true);
  const [targetJobdesks, setTargetJobdesks] = useState<string[]>([]);

  const { data: allowances, isLoading } = useQuery({
    queryKey: ["allowance_types_v6"],
    queryFn: async () => {
      const { data, error } = await supabase.from("allowance_types").select("*").order("nama");
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation<
    void,
    Error,
    Database["public"]["Tables"]["allowance_types"]["Insert"]
  >({
    mutationFn: async (newData) => {
      if (isEditing && editId) {
        const { error } = await supabase.from("allowance_types").update(newData).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("allowance_types").insert([newData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowance_types_v6"] });
      queryClient.invalidateQueries({ queryKey: ["employees_payroll_v6"] });
      toast.success(isEditing ? "Tunjangan diperbarui!" : "Tunjangan ditambahkan!");
      handleClose();
    },
    onError: (error) => toast.error(`Gagal: ${error.message}`),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from("allowance_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowance_types_v6"] });
      toast.success("Tunjangan berhasil dihapus!");
    },
    onError: (error) => toast.error(`Gagal menghapus: ${error.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama) return toast.error("Nama wajib diisi!");

    // Menyimpan target relasi ke dalam kolom 'catatan' sebagai string comma-separated
    const catatanRelasi = isGlobal ? "GLOBAL" : targetJobdesks.join(",");

    saveMutation.mutate({
      nama,
      nominal_default: Number(nominal) || 0,
      metode,
      aktif,
      catatan: catatanRelasi,
    });
  };

  const handleEdit = (item: Database["public"]["Tables"]["allowance_types"]["Row"]) => {
    setIsEditing(true);
    setEditId(item.id);
    setNama(item.nama);
    setNominal(item.nominal_default);
    setMetode(item.metode || "fixed");
    setAktif(item.aktif);

    if (!item.catatan || item.catatan === "GLOBAL") {
      setIsGlobal(true);
      setTargetJobdesks([]);
    } else {
      setIsGlobal(false);
      setTargetJobdesks(item.catatan.split(","));
    }

    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsEditing(false);
    setEditId(null);
    setNama("");
    setNominal("");
    setMetode("fixed");
    setAktif(true);
    setIsGlobal(true);
    setTargetJobdesks([]);
  };

  const getMetodeLabel = (m: string) => {
    if (m === "manual") return "Input Manual (Rp)";
    if (m === "per_day") return "Faktor Kali (Hari)";
    if (m === "per_hour") return "Faktor Kali (Jam)";
    return "Nominal Tetap";
  };

  return (
    <>
      <PageHeader
        title="Master Tunjangan"
        description="Atur komponen tunjangan dan hubungkan dengan spesifik Jobdesk."
        actions={
          <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : setIsOpen(true))}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer">
                <Plus className="w-4 h-4 mr-2" /> Tambah Tunjangan
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {isEditing ? "Edit Tunjangan" : "Tambah Tunjangan"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="nama"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Nama Tunjangan
                  </Label>
                  <Input
                    id="nama"
                    placeholder="Contoh: Tunjangan Dapur"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    required
                    className="h-10 border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="metode"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Model Perhitungan
                  </Label>
                  <Select value={metode} onValueChange={(val) => setMetode(val as any)}>
                    <SelectTrigger id="metode" className="h-10 border-slate-200 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Nominal Tetap (Otomatis)</SelectItem>
                      <SelectItem value="per_day">Dikali Jumlah Hari Kerja</SelectItem>
                      <SelectItem value="per_hour">Dikali Jumlah Jam (Mis: Lembur)</SelectItem>
                      <SelectItem value="manual">Input Bebas Nominal di Proses Gaji</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {metode !== "manual" && (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="nominal"
                      className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Nominal Default (Rp)
                    </Label>
                    <Input
                      id="nominal"
                      type="number"
                      value={nominal}
                      placeholder="0"
                      onChange={(e) => setNominal(Number(e.target.value) || "")}
                      required
                      className="h-10 border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                    />
                  </div>
                )}

                {/* RELASI JOBDESK EXPLICIT */}
                <div className="flex items-center justify-between border border-slate-100 rounded-xl p-3 bg-slate-50/30">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Berlaku Global</Label>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Aktif = Semua karyawan dapat.
                    </p>
                  </div>
                  <Switch checked={isGlobal} onCheckedChange={setIsGlobal} />
                </div>

                {!isGlobal && (
                  <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Pilih Jobdesk Penerima:
                    </Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {LIST_JOBDESK.map((job) => (
                        <div
                          key={job}
                          className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-150 px-2.5 py-2 rounded-xl"
                        >
                          <Checkbox
                            id={`job-${job}`}
                            checked={targetJobdesks.includes(job)}
                            onCheckedChange={(checked) => {
                              if (checked) setTargetJobdesks((prev) => [...prev, job]);
                              else setTargetJobdesks((prev) => prev.filter((j) => j !== job));
                            }}
                          />
                          <label
                            htmlFor={`job-${job}`}
                            className="text-xs font-medium cursor-pointer flex-1 select-none text-slate-700 dark:text-slate-300"
                          >
                            {job}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border border-slate-100 rounded-xl p-3">
                  <Label className="text-sm font-semibold">Status Aktif</Label>
                  <Switch checked={aktif} onCheckedChange={setAktif} />
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl shadow-md border-none font-semibold active:scale-[0.98] transition-all cursor-pointer"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin mx-auto" />
                  ) : (
                    "Simpan Tunjangan"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        <Dialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Hapus Tunjangan
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Apakah Anda yakin ingin menghapus tunjangan{" "}
                <strong className="text-slate-950 dark:text-white">{deleteTarget?.nama}</strong>?
                Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 mt-2">
              <Button
                variant="outline"
                className="rounded-xl h-10"
                onClick={() => setDeleteTarget(null)}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl h-10 bg-rose-600 hover:bg-rose-500 text-white border-none font-semibold"
                onClick={() => {
                  if (!deleteTarget) return;
                  deleteMutation.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Menghapus..." : "Hapus Tunjangan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="premium-card overflow-hidden border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">
                  Nama Tunjangan
                </TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">
                  Target Penerima
                </TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">
                  Model Perhitungan
                </TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">
                  Nominal Default
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <svg
                        className="animate-spin h-5 w-5 text-emerald-500"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Memuat data tunjangan...
                    </div>
                  </TableCell>
                </TableRow>
              ) : allowances?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-sm text-slate-500">
                    Belum ada tunjangan. Klik "Tambah Tunjangan" untuk membuat.
                  </TableCell>
                </TableRow>
              ) : (
                allowances?.map((item) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.nama}
                    </TableCell>
                    <TableCell>
                      {!item.catatan || item.catatan === "GLOBAL" ? (
                        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm rounded-lg py-1 px-2.5">
                          <Users className="w-3 h-3 mr-1" /> Global
                        </Badge>
                      ) : (
                        <div className="flex flex-col gap-1 items-start">
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm rounded-lg py-1 px-2.5">
                            <UserCog className="w-3 h-3 mr-1" /> Khusus
                          </Badge>
                          <span className="text-[10px] font-semibold text-slate-500 break-words max-w-[150px]">
                            {item.catatan}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-lg shadow-sm border border-slate-200/50 py-1 px-2.5">
                        {getMetodeLabel(item.metode)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.metode === "manual" ? "-" : formatIDR(item.nominal_default)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg transition-colors"
                          onClick={() => setDeleteTarget({ id: item.id, nama: item.nama })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
    </>
  );
}
