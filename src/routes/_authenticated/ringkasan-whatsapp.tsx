import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Search, QrCode, LogOut, RefreshCw, Wifi, WifiOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ringkasan-whatsapp")({
  component: RingkasanWhatsappPage,
});

// Fungsi utilitas untuk menerjemahkan YYYY-MM ke bulan yang mudah dibaca
const formatPeriodeDisplay = (periodeStr: string) => {
  if (!periodeStr) return "-";
  const [year, month] = periodeStr.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

function RingkasanWhatsappPage() {
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const queryClient = useQueryClient();

  // Query untuk memantau status WhatsApp Gateway lokal
  const { data: gatewayStatus, isLoading: isLoadingGateway, refetch: refetchGateway } = useQuery({
    queryKey: ["whatsapp_gateway_status"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:5000/api/status");
        if (!res.ok) throw new Error("Offline");
        return await res.json();
      } catch (err) {
        return { status: "offline", qr: null };
      }
    },
    refetchInterval: 5000, // Check status every 5 seconds
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const res = await fetch("http://localhost:5000/api/logout", {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Berhasil memutuskan koneksi WhatsApp Gateway");
        refetchGateway();
      } else {
        toast.error("Gagal memutuskan koneksi");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server WhatsApp Gateway");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Ambil data payroll_runs beserta payroll_items untuk menghitung statistik pengiriman
  const { data: runs, isLoading } = useQuery({
    queryKey: ["whatsapp_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select(
          `
          id,
          periode,
          status,
          payroll_items (
            id,
            slip_dibuat,
            employees ( nama, whatsapp )
          )
        `,
        )
        .order("periode", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const openDetail = (run: any) => {
    setSelectedRun(run);
    setIsDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Ringkasan Pengiriman WA"
        description="Pantau status pengiriman slip gaji via WhatsApp ke seluruh karyawan."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Tabel Ringkasan */}
        <div className="lg:col-span-2 rounded-md border bg-card h-fit">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periode Gaji</TableHead>
                <TableHead className="text-center">Total Karyawan</TableHead>
                <TableHead className="text-center">Status Pengiriman</TableHead>
                <TableHead className="w-[30%]">Progress</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : runs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Belum ada riwayat proses gaji yang tercatat.
                  </TableCell>
                </TableRow>
              ) : (
                runs?.map((run) => {
                  const totalItems = run.payroll_items?.length || 0;
                  const sentItems = run.payroll_items?.filter((i: any) => i.slip_dibuat).length || 0;
                  const progressPercent =
                    totalItems === 0 ? 0 : Math.round((sentItems / totalItems) * 100);
                  const isAllSent = totalItems > 0 && sentItems === totalItems;

                  return (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {formatPeriodeDisplay(run.periode)}
                      </TableCell>
                      <TableCell className="text-center">{totalItems}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={isAllSent ? "default" : "secondary"}
                          className={isAllSent ? "bg-green-500 hover:bg-green-600 text-white animate-none" : ""}
                        >
                          {sentItems} / {totalItems} Terkirim
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Progress value={progressPercent} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {progressPercent}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => openDetail(run)}
                        >
                          <Search className="h-4 w-4" />
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Kolom Kanan: Status WhatsApp Gateway */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <QrCode className="h-5 w-5 text-primary" />
                WhatsApp Gateway
              </CardTitle>
              <CardDescription>
                Hubungkan WhatsApp Anda untuk mengirim slip langsung.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Status Indicator */}
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-sm font-medium text-muted-foreground">Status Server:</span>
                {gatewayStatus?.status === "connected" ? (
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white gap-1 flex items-center py-1 animate-none border-none">
                    <Wifi className="h-3.5 w-3.5" /> Terhubung (Online)
                  </Badge>
                ) : gatewayStatus?.status === "connecting" ? (
                  <Badge variant="secondary" className="bg-amber-500 hover:bg-amber-600 text-white gap-1 flex items-center py-1 animate-none border-none">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Menghubungkan...
                  </Badge>
                ) : gatewayStatus?.status === "disconnected" ? (
                  <Badge variant="outline" className="text-amber-500 border-amber-500 gap-1 flex items-center py-1">
                    <WifiOff className="h-3.5 w-3.5" /> Terputus (Offline)
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1 flex items-center py-1">
                    <XCircle className="h-3.5 w-3.5" /> Server Mati
                  </Badge>
                )}
              </div>

              {/* Status Content */}
              {gatewayStatus?.status === "connected" ? (
                <div className="text-center py-6 flex flex-col items-center gap-3">
                  <div className="bg-green-100 p-4 rounded-full text-green-600">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Gateway Siap Digunakan</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">
                      Slip gaji akan dikirim langsung secara otomatis di latar belakang menggunakan akun WhatsApp Anda.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4 gap-2 text-destructive hover:bg-destructive/10"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    <LogOut className="h-4 w-4" />
                    Putuskan Perangkat
                  </Button>
                </div>
              ) : gatewayStatus?.status === "disconnected" ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  {gatewayStatus.qr ? (
                    <div className="text-center space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Pindai QR code ini melalui menu <strong>Perangkat Tertaut</strong> di WhatsApp HP Anda:
                      </p>
                      <div className="bg-white p-3 rounded-lg border max-w-[200px] mx-auto shadow-sm">
                        <img src={gatewayStatus.qr} className="w-full aspect-square" alt="Scan QR Code" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Sedang memuat QR Code...</p>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchGateway()} 
                    className="gap-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Segarkan Status
                  </Button>
                </div>
              ) : gatewayStatus?.status === "connecting" ? (
                <div className="text-center py-10">
                  <Loader2 className="h-10 w-10 animate-spin text-amber-500 mx-auto mb-3" />
                  <p className="text-sm font-medium">Menghubungkan ke WhatsApp Web...</p>
                  <p className="text-xs text-muted-foreground mt-1">Harap tunggu beberapa saat.</p>
                </div>
              ) : (
                <div className="py-6 text-center space-y-4">
                  <div className="bg-red-50 p-3 rounded-lg text-red-600 text-xs text-left leading-relaxed space-y-2">
                    <p className="font-semibold">Langkah Mengaktifkan Server:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Buka folder proyek <code>D:\kreatif\branch-payflow</code></li>
                      <li>Double-click berkas <strong><code>start_payflow.bat</code></strong></li>
                      <li>Atau jalankan <code>npm start</code> di dalam folder <code>/backend</code> lewat terminal</li>
                    </ol>
                  </div>
                  <Button 
                    variant="default" 
                    onClick={() => refetchGateway()} 
                    className="w-full gap-2"
                  >
                    <RefreshCw className="h-4 w-4" /> Coba Hubungkan Kembali
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Modal Detail Pengiriman per Karyawan */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detail Pengiriman - {selectedRun ? formatPeriodeDisplay(selectedRun.periode) : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Karyawan</TableHead>
                  <TableHead>No. WhatsApp</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedRun?.payroll_items?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Tidak ada karyawan di periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedRun?.payroll_items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.employees?.nama}</TableCell>
                      <TableCell>
                        {item.employees?.whatsapp || (
                          <span className="text-muted-foreground italic">Kosong</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.slip_dibuat ? (
                          <div className="flex items-center justify-center gap-2 text-green-600 text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Terkirim</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                            <XCircle className="h-4 w-4" />
                            <span>Belum</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
