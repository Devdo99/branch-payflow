import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cabang")({
  head: () => ({ meta: [{ title: "Cabang — Penggajian" }] }),
  component: CabangPage,
});

type Branch = {
  id: string;
  nama: string;
  alamat: string | null;
  catatan: string | null;
  aktif: boolean;
  created_at: string;
};

function CabangPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Branch | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Branch | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("nama");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const filtered = (data ?? []).filter((b) => b.nama.toLowerCase().includes(q.toLowerCase()));

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (b: Branch) => {
    setEditing(b);
    setOpen(true);
  };

  const onDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("branches").delete().eq("id", toDelete.id);
    if (error) {
      toast.error("Gagal menghapus", { description: error.message });
    } else {
      toast.success("Cabang dihapus");
      qc.invalidateQueries({ queryKey: ["branches"] });
    }
    setToDelete(null);
  };

  return (
    <>
      <PageHeader
        title="Cabang"
        description="Kelola data cabang usaha"
        actions={
          <Button 
            size="sm" 
            onClick={openNew}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" /> Tambah Cabang
          </Button>
        }
      />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama cabang..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 h-10 bg-white/50 backdrop-blur-sm border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl shadow-sm"
            />
          </div>
        </div>

        <div className="premium-card overflow-hidden border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">Nama Cabang</TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">Alamat</TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">Status</TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">Dibuat</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <svg className="animate-spin h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Memuat data cabang...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">
                    Belum ada cabang. Klik "Tambah Cabang" untuk memulai.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">{b.nama}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{b.alamat || "-"}</TableCell>
                    <TableCell>
                      {b.aktif ? (
                        <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm rounded-lg">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 shadow-sm rounded-lg">
                          Nonaktif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400">
                      {formatDate(b.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors"
                          onClick={() => openEdit(b)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg transition-colors"
                          onClick={() => setToDelete(b)}
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

      <BranchDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["branches"] })}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus cabang?</AlertDialogTitle>
            <AlertDialogDescription>
              Cabang "{toDelete?.nama}" akan dihapus permanen. Jika cabang sudah memiliki karyawan,
              proses akan gagal. Pertimbangkan menonaktifkan cabang sebagai gantinya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BranchDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Branch | null;
  onSaved: () => void;
}) {
  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");
  const [catatan, setCatatan] = useState("");
  const [aktif, setAktif] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useState(() => {});
  // sync when editing changes
  if (open && editing && nama === "" && alamat === "" && catatan === "") {
    // initial fill — only when fields blank
  }

  // safer: reset whenever dialog opens
  // (we use a key trick instead — see below)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;
    setSaving(true);
    const payload = { nama: nama.trim(), alamat: alamat || null, catatan: catatan || null, aktif };
    const res = editing
      ? await supabase.from("branches").update(payload).eq("id", editing.id)
      : await supabase.from("branches").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error("Gagal menyimpan", { description: res.error.message });
      return;
    }
    toast.success(editing ? "Cabang diperbarui" : "Cabang ditambahkan");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setNama(editing?.nama ?? "");
          setAlamat(editing?.alamat ?? "");
          setCatatan(editing?.catatan ?? "");
          setAktif(editing?.aktif ?? true);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Cabang" : "Tambah Cabang"}</DialogTitle>
          <DialogDescription>Isi data cabang dengan lengkap.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nama">
              Nama cabang <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nama"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alamat">Alamat</Label>
            <Textarea
              id="alamat"
              rows={2}
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catatan">Catatan</Label>
            <Textarea
              id="catatan"
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Status Aktif</div>
              <div className="text-xs text-muted-foreground">
                Cabang nonaktif tidak muncul di filter penggajian.
              </div>
            </div>
            <Switch checked={aktif} onCheckedChange={setAktif} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
