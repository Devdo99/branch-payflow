import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Loader2, CheckCircle2, XCircle, Search } from "lucide-react";

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

      <div className="rounded-md border bg-card">
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
                        className={isAllSent ? "bg-green-500" : ""}
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
