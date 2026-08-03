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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { Pencil, Loader2, Banknote } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type Employee = Database["public"]["Tables"]["employees"]["Row"];

export const Route = createFileRoute("/_authenticated/gaji-pokok")({
  component: GajiPokokPage,
});

function GajiPokokPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editItem, setEditItem] = useState<Employee | null>(null);
  const [nominal, setNominal] = useState<number | "">("");

  // Fetch Karyawan Aktif
  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees_gaji"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("aktif", true)
        .order("nama", { ascending: true });
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Mutation Update Gaji
  const updateMutation = useMutation({
    mutationFn: async (newGaji: number) => {
      if (!editItem) return;
      const { error } = await supabase
        .from("employees")
        .update({ gaji_pokok: newGaji })
        .eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees_gaji"] });
      toast.success("Gaji pokok berhasil diperbarui!");
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error("Gagal memperbarui gaji: " + error.message);
    },
  });

  const handleEdit = (item: Employee) => {
    setEditItem(item);
    setNominal(item.gaji_pokok || 0);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nominal === "" || nominal < 0) {
      toast.error("Masukkan nominal gaji yang valid!");
      return;
    }
    updateMutation.mutate(Number(nominal));
  };
  return (
    <>
      <PageHeader
        title="Data Gaji Pokok"
        description="Atur besaran gaji dasar bulanan untuk masing-masing karyawan aktif."
      />
      <div className="p-4 sm:p-6 space-y-4">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Update Gaji: {editItem?.nama}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="nominal"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Gaji Pokok Bulanan (Rp)
                </Label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="nominal"
                    type="number"
                    className="pl-9 h-10 border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                    placeholder="0"
                    value={nominal}
                    onChange={(e) => setNominal(Number(e.target.value))}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Nominal ini akan menjadi angka dasar sebelum ditambah tunjangan dan dikurangi
                  potongan pada saat proses generate gaji.
                </p>
              </div>

              <Button
                type="submit"
                className="mt-4 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl shadow-md border-none font-semibold active:scale-[0.98] transition-all cursor-pointer"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Perubahan
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <div className="premium-card overflow-hidden border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">
                  Nama Karyawan
                </TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">
                  Jabatan
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">
                  Gaji Pokok Saat Ini
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : employees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Belum ada karyawan aktif. Tambahkan di menu Data Karyawan.
                  </TableCell>
                </TableRow>
              ) : (
                employees?.map((item) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                      {item.nama}
                      {item.kode_karyawan && (
                        <span className="block text-[11px] text-slate-400 font-normal">
                          ID: {item.kode_karyawan}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {item.jabatan || "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatIDR(item.gaji_pokok || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(item)}
                        className="gap-2 border-slate-200 hover:bg-slate-50 rounded-xl text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Atur Nominal
                      </Button>
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
