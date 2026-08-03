import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jabatan")({
  component: JabatanPage,
});

function JabatanPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // State untuk form
  const [namaJabatan, setNamaJabatan] = useState("");
  const [tunjangan, setTunjangan] = useState("");

  // 1. READ: Mengambil data
  const { data: listJabatan = [], isLoading } = useQuery({
    queryKey: ["jabatan_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jabatan" as any)
        .select("*")
        .order("nama_jabatan");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // 2. CREATE & UPDATE: Fungsi Simpan
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing && editId) {
        await supabase
          .from("jabatan" as any)
          .update(payload)
          .eq("id", editId);
      } else {
        await supabase.from("jabatan" as any).insert([payload]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jabatan_list"] }); // Penting: ini membuat data langsung muncul
      toast.success(isEditing ? "Jabatan diupdate!" : "Jabatan disimpan!");
      handleClose();
    },
  });

  // 3. DELETE: Fungsi Hapus
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("jabatan" as any)
        .delete()
        .eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jabatan_list"] });
      toast.success("Jabatan dihapus!");
    },
  });

  const handleEdit = (item: any) => {
    setIsEditing(true);
    setEditId(item.id);
    setNamaJabatan(item.nama_jabatan);
    setTunjangan(item.tunjangan_jabatan);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsEditing(false);
    setEditId(null);
    setNamaJabatan("");
    setTunjangan("");
  };
  return (
    <>
      <PageHeader
        title="Master Jabatan"
        description="Kelola daftar jabatan dan besaran tunjangan."
        actions={
          <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : setIsOpen(true))}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer">
                <Plus className="w-4 h-4 mr-2" /> Tambah Jabatan
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {isEditing ? "Edit Jabatan" : "Tambah Jabatan"}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate({
                    nama_jabatan: namaJabatan,
                    tunjangan_jabatan: Number(tunjangan),
                  });
                }}
                className="space-y-4 pt-2"
              >
                <div className="space-y-1.5">
                  <Label
                    htmlFor="nama_jabatan"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Nama Jabatan
                  </Label>
                  <Input
                    id="nama_jabatan"
                    placeholder="Contoh: Senior Developer"
                    value={namaJabatan}
                    onChange={(e) => setNamaJabatan(e.target.value)}
                    required
                    className="h-10 border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="tunjangan_jabatan"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Nominal Tunjangan (Rp)
                  </Label>
                  <Input
                    id="tunjangan_jabatan"
                    type="number"
                    placeholder="Contoh: 1500000"
                    value={tunjangan}
                    onChange={(e) => setTunjangan(e.target.value)}
                    required
                    className="h-10 border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-10 mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl shadow-md border-none font-semibold active:scale-[0.98] transition-all cursor-pointer"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="animate-spin h-5 w-5 mx-auto" />
                  ) : (
                    "Simpan Jabatan"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="premium-card overflow-hidden border border-border/60">
          <Table className="min-w-[500px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">
                  Nama Jabatan
                </TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">
                  Tunjangan Jabatan
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
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
                      Memuat data jabatan...
                    </div>
                  </TableCell>
                </TableRow>
              ) : listJabatan.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-sm text-slate-500">
                    Belum ada jabatan. Klik "Tambah Jabatan" di atas untuk membuat.
                  </TableCell>
                </TableRow>
              ) : (
                listJabatan.map((j: any) => (
                  <TableRow
                    key={j.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                      {j.nama_jabatan}
                    </TableCell>
                    <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                      Rp {Number(j.tunjangan_jabatan).toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors"
                          onClick={() => handleEdit(j)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg transition-colors"
                          onClick={() => deleteMutation.mutate(j.id)}
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
