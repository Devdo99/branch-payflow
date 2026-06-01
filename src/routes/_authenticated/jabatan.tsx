import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Master Jabatan"
        description="Kelola daftar jabatan dan besaran tunjangan."
      />

      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : setIsOpen(true))}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Tambah Jabatan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit Jabatan" : "Tambah Jabatan"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate({ nama_jabatan: namaJabatan, tunjangan_jabatan: tunjangan });
              }}
              className="space-y-4 pt-4"
            >
              <Input
                placeholder="Nama Jabatan"
                value={namaJabatan}
                onChange={(e) => setNamaJabatan(e.target.value)}
                required
              />
              <Input
                type="number"
                placeholder="Nominal Tunjangan"
                value={tunjangan}
                onChange={(e) => setTunjangan(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="animate-spin" /> : "Simpan"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="w-full overflow-x-auto border rounded-md">
        <Table className="min-w-[500px]">
          <TableHeader>
            <TableRow>
              <TableHead>Nama Jabatan</TableHead>
              <TableHead>Tunjangan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  Memuat...
                </TableCell>
              </TableRow>
            ) : (
              listJabatan.map((j: any) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.nama_jabatan}</TableCell>
                  <TableCell>Rp {Number(j.tunjangan_jabatan).toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(j)}>
                      <Pencil className="w-4 h-4 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(j.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
