import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Loader2, Building2 } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type BankStatus = Database["public"]["Enums"]["bank_status"];

export const Route = createFileRoute("/_authenticated/rekening-bank")({
  component: RekeningBankPage,
});

const statusLabels: Record<BankStatus, string> = {
  valid: "Valid (Siap Transfer)",
  belum_dicek: "Belum Dicek",
  perlu_dicek_ulang: "Perlu Dicek Ulang",
};

function getStatusBadge(status: BankStatus) {
  switch (status) {
    case "valid":
      return <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm rounded-lg py-1 px-2.5">Valid</Badge>;
    case "belum_dicek":
      return <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 shadow-sm rounded-lg py-1 px-2.5">Belum Dicek</Badge>;
    case "perlu_dicek_ulang":
      return <Badge className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm rounded-lg py-1 px-2.5">Perlu Cek Ulang</Badge>;
  }
}

function RekeningBankPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editItem, setEditItem] = useState<Employee | null>(null);

  // Form State
  const [namaBank, setNamaBank] = useState("");
  const [nomorRekening, setNomorRekening] = useState("");
  const [namaPemilik, setNamaPemilik] = useState("");
  const [statusRekening, setStatusRekening] = useState<BankStatus>("belum_dicek");
  const [catatan, setCatatan] = useState("");

  // Fetch Data - Hanya ambil karyawan aktif
  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees_bank"],
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

  // Mutation
  const updateMutation = useMutation({
    mutationFn: async (newData: Partial<Employee>) => {
      if (!editItem) return;
      const { error } = await supabase.from("employees").update(newData).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees_bank"] });
      toast.success("Data rekening berhasil diperbarui!");
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error("Gagal menyimpan data: " + error.message);
    },
  });

  const handleEdit = (item: Employee) => {
    setEditItem(item);
    setNamaBank(item.nama_bank || "");
    setNomorRekening(item.nomor_rekening || "");
    // Default ke nama karyawan jika nama pemilik masih kosong
    setNamaPemilik(item.nama_pemilik_rekening || item.nama);
    setStatusRekening(item.status_rekening);
    setCatatan(item.catatan_rekening || "");
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      nama_bank: namaBank,
      nomor_rekening: nomorRekening,
      nama_pemilik_rekening: namaPemilik,
      status_rekening: statusRekening,
      catatan_rekening: catatan,
    });
  };

  return (
    <>
      <PageHeader
        title="Data Rekening Bank"
        description="Kelola informasi pencairan gaji (bank & e-wallet) untuk karyawan aktif"
      />
      <div className="p-4 sm:p-6 space-y-4">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Update Rekening: {editItem?.nama}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bank" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nama Bank / E-Wallet</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="bank"
                      className="pl-9 h-10 border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                      placeholder="BCA, Mandiri, DANA..."
                      value={namaBank}
                      onChange={(e) => setNamaBank(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="norek" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nomor Rekening</Label>
                  <Input
                    id="norek"
                    className="h-10 border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                    placeholder="1234567890"
                    value={nomorRekening}
                    onChange={(e) => setNomorRekening(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pemilik" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Atas Nama (Pemilik Rekening)</Label>
                <Input
                  id="pemilik"
                  className="h-10 border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                  placeholder="Nama sesuai buku tabungan"
                  value={namaPemilik}
                  onChange={(e) => setNamaPemilik(e.target.value)}
                />
                <p className="text-[10px] text-slate-500 leading-tight">
                  Pastikan nama di sini sama persis dengan nama di buku tabungan untuk menghindari retur/gagal transfer.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status Validasi</Label>
                <Select
                  value={statusRekening}
                  onValueChange={(val) => setStatusRekening(val as BankStatus)}
                >
                  <SelectTrigger id="status" className="h-10 border-slate-200 rounded-xl">
                    <SelectValue placeholder="Pilih status validasi" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="catatan" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Catatan</Label>
                <Textarea
                  id="catatan"
                  placeholder="Misal: Nomor rekening sedang diurus, atau e-wallet belum premium..."
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  className="border-slate-200 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                  rows={2}
                />
              </div>

              <Button type="submit" className="mt-4 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl shadow-md border-none font-semibold active:scale-[0.98] transition-all cursor-pointer" disabled={updateMutation.isPending}>
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
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">Karyawan</TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">Bank / E-Wallet</TableHead>
                <TableHead className="font-semibold text-slate-900 dark:text-slate-100">No. Rekening & Atas Nama</TableHead>
                <TableHead className="text-center font-semibold text-slate-900 dark:text-slate-100">Status</TableHead>
                <TableHead className="text-right font-semibold text-slate-900 dark:text-slate-100">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : employees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500 py-12">
                    Belum ada data karyawan aktif.
                  </TableCell>
                </TableRow>
              ) : (
                employees?.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.nama}
                      {item.kode_karyawan && (
                        <span className="block text-[11px] text-slate-400 font-normal">
                          ID: {item.kode_karyawan}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                      {item.nama_bank || (
                        <span className="text-slate-400 italic font-normal text-xs">- Belum diisi -</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.nomor_rekening ? (
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-semibold text-slate-950 dark:text-slate-100">{item.nomor_rekening}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                            A.N. {item.nama_pemilik_rekening}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">- Belum diisi -</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(item.status_rekening)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(item)}
                        className="gap-2 border-slate-200 hover:bg-slate-50 rounded-xl text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Update
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
