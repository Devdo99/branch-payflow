import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/potongan")({
  component: PotonganPage,
});

function PotonganPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [nama, setNama] = useState("");
  const [nominal, setNominal] = useState<number | "">("");
  const [metode, setMetode] = useState<string>("fixed");
  const [aktif, setAktif] = useState(true);

  const { data: deductions, isLoading } = useQuery({
    queryKey: ["deduction_types"],
    queryFn: async () => {
      const { data } = await supabase.from("deduction_types").select("*").order("nama");
      return data || [];
    },
  });

  // Fungsi untuk reset form
  const resetForm = () => {
    setNama("");
    setNominal("");
    setMetode("fixed");
    setAktif(true);
    setIsEditing(false);
    setEditId(null);
  };

  // Fungsi saat tombol Edit diklik
  const handleEdit = (item: any) => {
    setNama(item.nama);
    setNominal(item.nominal_default);
    setMetode(item.metode);
    setAktif(item.aktif);
    setIsEditing(true);
    setEditId(item.id);
    setIsOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (isEditing && editId) {
        await supabase.from("deduction_types").update(newData).eq("id", editId);
      } else {
        await supabase.from("deduction_types").insert([newData]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deduction_types"] });
      toast.success(isEditing ? "Potongan diperbarui!" : "Potongan ditambahkan!");
      setIsOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("deduction_types").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deduction_types"] });
      toast.success("Potongan berhasil dihapus!");
    },
  });

  return (
    <>
      <PageHeader 
        title="Master Potongan" 
        description="Atur logika pemotongan gaji karyawan." 
        actions={
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer">
                <Plus className="mr-2 h-4 w-4" /> Tambah Potongan
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {isEditing ? "Edit Potongan" : "Tambah Potongan"}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate({ nama, nominal_default: Number(nominal) || 0, metode, aktif });
                }}
                className="space-y-4 pt-2"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="nama" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nama Potongan</Label>
                  <Input
                    id="nama"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    required
                    placeholder="Contoh: Izin, Telat, Kasbon"
                    className="h-10 border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="metode" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Metode Perhitungan</Label>
                  <Select value={metode} onValueChange={setMetode}>
                    <SelectTrigger id="metode" className="h-10 border-slate-200 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Tetap (Otomatis memotong tiap bulan)</SelectItem>
                      <SelectItem value="per_day">Harian (Muncul Form "Jumlah Hari/Kali")</SelectItem>
                      <SelectItem value="manual">Manual (Muncul Form "Nominal Rupiah")</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nominal" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nominal Default (Rp)</Label>
                  <Input
                    id="nominal"
                    type="number"
                    value={nominal}
                    onChange={(e) => setNominal(Number(e.target.value))}
                    placeholder="Biarkan 0 jika dipotong proporsional"
                    className="h-10 border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                  />
                  {metode === "per_day" && (
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Untuk potongan harian, isi 0 agar sistem menghitung gaji pokok / 30 x jumlah hari/kali.
                    </p>
                  )}
                </div>
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
                    "Simpan Potongan"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="premium-card overflow-hidden border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">Nama Potongan</TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">Metode Perhitungan</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">Nominal Default</TableHead>
                <TableHead className="text-center font-semibold text-slate-900 dark:text-slate-100">Status</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : deductions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-sm text-slate-500">
                    Belum ada data potongan. Klik "Tambah Potongan" untuk membuat.
                  </TableCell>
                </TableRow>
              ) : (
                deductions?.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">{item.nama}</TableCell>
                    <TableCell>
                      <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-lg shadow-sm border border-slate-200/50 py-1 px-2.5">
                        {item.metode === "fixed"
                          ? "Tetap"
                          : item.metode === "per_day"
                            ? "Harian"
                            : "Manual"}
                      </Badge>
                      {item.metode === "per_day" && Number(item.nominal_default || 0) === 0 && (
                        <div className="mt-1 text-[10px] text-slate-400">Gaji pokok / 30</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-rose-600 dark:text-rose-400">
                      {formatIDR(item.nominal_default || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.aktif ? (
                        <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm rounded-lg py-1 px-2.5">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 shadow-sm rounded-lg py-1 px-2.5">
                          Non-Aktif
                        </Badge>
                      )}
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
                          onClick={() => {
                            if (window.confirm(`Yakin ingin menghapus ${item.nama}?`))
                              deleteMutation.mutate(item.id);
                          }}
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
