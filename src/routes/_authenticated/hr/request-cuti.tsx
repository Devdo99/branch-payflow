import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  Link2,
  ExternalLink,
  ClipboardList,
  Inbox,
  Wifi,
  WifiOff,
  RefreshCw,
  FileText,
} from "lucide-react";
import { JENIS_CUTI, getJenisCuti, getStatusCuti, formatTanggalHR, countDays } from "@/lib/hr";
import {
  buildCutiApprovedMessage,
  buildCutiRejectedMessage,
  enumerateDates,
  getKuotaMax,
  maskPhone,
} from "@/lib/cuti-request";
import { getWaGatewayStatus, sendWaMessage } from "@/lib/wa-gateway";

export const Route = createFileRoute("/_authenticated/hr/request-cuti")({
  component: RequestCutiAdminPage,
});

type CutiRequest = {
  id: string;
  employee_id: string;
  jenis: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  tanggal_list?: string[] | null;
  alasan?: string | null;
  status: string;
  created_at?: string;
  employees?: {
    nama?: string | null;
    kode_karyawan?: string | null;
    whatsapp?: string | null;
    branch_id?: string | null;
    branches?: { nama?: string } | null;
  } | null;
};

type NotifRow = {
  id: string;
  cuti_id: string;
  employee_id: string;
  tipe: string;
  pesan: string;
  status: string;
  error?: string | null;
  created_at?: string;
  sent_at?: string | null;
  employees?: { nama?: string | null; whatsapp?: string | null } | null;
};

const STATUS_FILTER = [
  { value: "all", label: "Semua Status" },
  { value: "diajukan", label: "Diajukan" },
  { value: "disetujui", label: "Disetujui" },
  { value: "ditolak", label: "Ditolak" },
];

function RequestCutiAdminPage() {
  const queryClient = useQueryClient();

  // Filter
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog tolak
  const [tolakTarget, setTolakTarget] = useState<CutiRequest | null>(null);
  const [alasanTolak, setAlasanTolak] = useState("");

  const { data: branches = [] } = useQuery({
    queryKey: ["branches_hr_request"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, nama").order("nama");
      return (data as { id: string; nama: string }[]) || [];
    },
  });

  // Status gateway WhatsApp
  const { data: gateway, refetch: refetchGateway } = useQuery({
    queryKey: ["wa_gateway_request"],
    queryFn: getWaGatewayStatus,
    refetchInterval: 8000,
  });

  const {
    data: cutiList = [],
    isLoading,
    refetch: refetchCuti,
  } = useQuery<CutiRequest[]>({
    queryKey: ["cuti_requests_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cuti")
        .select(
          "id, employee_id, jenis, tanggal_mulai, tanggal_selesai, tanggal_list, alasan, status, created_at, employees ( nama, kode_karyawan, whatsapp, branch_id, branches ( nama ) )",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CutiRequest[];
    },
  });

  const { data: notifList = [], refetch: refetchNotifs } = useQuery<NotifRow[]>({
    queryKey: ["cuti_notifikasi_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cuti_notifikasi")
        .select(
          "id, cuti_id, employee_id, tipe, pesan, status, error, created_at, sent_at, employees ( nama, whatsapp )",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as NotifRow[];
    },
  });

  // Sinkronkan notifikasi: setiap cuti disetujui/ditolak tanpa notifikasi dibuatkan antrean
  const syncNotifications = async () => {
    const { data: rows } = await supabase
      .from("cuti")
      .select(
        "id, employee_id, jenis, tanggal_mulai, tanggal_selesai, alasan, status, employees ( nama )",
      )
      .in("status", ["disetujui", "ditolak"]);
    if (!rows || rows.length === 0) return;

    const { data: existing } = await supabase.from("cuti_notifikasi").select("cuti_id");
    const already = new Set((existing || []).map((n) => n.cuti_id));
    const missing = rows.filter((c) => !already.has(c.id));
    if (missing.length === 0) return;

    const payload = missing.map((c) => ({
      cuti_id: c.id,
      employee_id: c.employee_id,
      tipe: c.status,
      pesan:
        c.status === "disetujui"
          ? buildCutiApprovedMessage(c.employees as { nama?: string | null }, c as CutiRequest)
          : buildCutiRejectedMessage(c.employees as { nama?: string | null }, c as CutiRequest),
    }));
    const { error } = await supabase.from("cuti_notifikasi").insert(payload);
    if (error) console.error("Gagal sinkronisasi notifikasi:", error);
    else queryClient.invalidateQueries({ queryKey: ["cuti_notifikasi_admin"] });
  };

  useEffect(() => {
    if (!isLoading && cutiList.length > 0) syncNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Peta notifikasi per cuti (yang terbaru)
  const notifByCuti = useMemo(() => {
    const map: Record<string, NotifRow> = {};
    notifList.forEach((n) => {
      if (
        !map[n.cuti_id] ||
        new Date(n.created_at || 0) > new Date(map[n.cuti_id].created_at || 0)
      ) {
        map[n.cuti_id] = n;
      }
    });
    return map;
  }, [notifList]);

  const filteredCuti = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return cutiList.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (branchFilter !== "all" && c.employees?.branches?.nama !== branchFilter) return false;
      if (term !== "") {
        const hay = `${c.employees?.nama || ""} ${c.employees?.kode_karyawan || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [cutiList, statusFilter, branchFilter, searchTerm]);

  const stats = useMemo(() => {
    const s = { diajukan: 0, disetujui: 0, ditolak: 0, belumKirim: 0 };
    cutiList.forEach((c) => {
      if (c.status === "diajukan") s.diajukan += 1;
      else if (c.status === "disetujui") s.disetujui += 1;
      else if (c.status === "ditolak") s.ditolak += 1;
    });
    notifList.forEach((n) => {
      if (n.status !== "terkirim") s.belumKirim += 1;
    });
    return s;
  }, [cutiList, notifList]);

  const isGatewayConnected = gateway?.status === "connected";

  const approveMutation = useMutation({
    mutationFn: async (c: CutiRequest) => {
      // FCFS: slot diisi oleh (a) permohonan disetujui + (b) permohonan diajukan yang lebih dulu
      const { data: kuota, error: errKuota } = await supabase.rpc("cek_kuota_cuti", {
        p_mulai: c.tanggal_mulai,
        p_selesai: c.tanggal_selesai,
        p_branch: c.employees?.branch_id ?? null,
      });
      if (errKuota) throw errKuota;

      let earlierQuery = supabase
        .from("cuti")
        .select("id, tanggal_mulai, tanggal_selesai")
        .eq("status", "diajukan")
        .lt("created_at", c.created_at || new Date().toISOString())
        .lte("tanggal_mulai", c.tanggal_selesai)
        .gte("tanggal_selesai", c.tanggal_mulai);
      // FCFS dihitung dalam lingkup cabang yang sama
      if (c.employees?.branch_id)
        earlierQuery = earlierQuery.eq("branch_id", c.employees.branch_id);
      const { data: earlierPending, error: errEarlier } = await earlierQuery;
      if (errEarlier) throw errEarlier;

      const dates = enumerateDates(c.tanggal_mulai, c.tanggal_selesai);
      const occupancy: Record<string, number> = {};
      (kuota || []).forEach((r) => {
        occupancy[r.tanggal] = (occupancy[r.tanggal] || 0) + (r.terpakai || 0);
      });
      dates.forEach((date) => {
        (earlierPending || []).forEach((e) => {
          if (e.tanggal_mulai <= date && e.tanggal_selesai >= date) {
            occupancy[date] = (occupancy[date] || 0) + 1;
          }
        });
      });

      const penuh = dates.filter((date) => (occupancy[date] || 0) >= getKuotaMax(date));
      if (penuh.length > 0) {
        const daftar = penuh
          .map((t) => `${formatTanggalHR(t)} (maks ${getKuotaMax(t)} orang)`)
          .join(", ");
        throw new Error(
          `Kuota penuh pada ${daftar}. Ada permohonan yang diajukan lebih awal — setujui sesuai urutan pengajuan.`,
        );
      }

      const { error } = await supabase.from("cuti").update({ status: "disetujui" }).eq("id", c.id);
      if (error) throw error;
      try {
        await syncNotifications();
      } catch (err) {
        console.error("Sinkronisasi notifikasi gagal (status sudah disetujui):", err);
      }
    },
    onSuccess: () => {
      toast.success("Permohonan cuti disetujui. Notifikasi ditambahkan ke antrean.");
      refetchCuti();
      refetchNotifs();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ cuti, alasan }: { cuti: CutiRequest; alasan: string }) => {
      const alasanFinal = cuti.alasan
        ? `${cuti.alasan}. [Ditolak admin: ${alasan}]`
        : `Ditolak admin: ${alasan}`;
      const { error } = await supabase
        .from("cuti")
        .update({ status: "ditolak", alasan: alasanFinal })
        .eq("id", cuti.id);
      if (error) throw error;
      try {
        await syncNotifications();
      } catch (err) {
        console.error("Sinkronisasi notifikasi gagal (status sudah ditolak):", err);
      }
    },
    onSuccess: () => {
      toast.success("Permohonan cuti ditolak. Notifikasi ditambahkan ke antrean.");
      setTolakTarget(null);
      setAlasanTolak("");
      refetchCuti();
      refetchNotifs();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const sendNotifMutation = useMutation({
    mutationFn: async (n: NotifRow) => {
      const phone = n.employees?.whatsapp;
      if (!phone) throw new Error("Karyawan tidak memiliki nomor WhatsApp.");
      const res = await sendWaMessage(phone, n.pesan);
      if (!res.ok) throw new Error(res.error || "Gagal mengirim pesan.");
      const { error } = await supabase
        .from("cuti_notifikasi")
        .update({ status: "terkirim", sent_at: new Date().toISOString(), error: null })
        .eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pesan WhatsApp berhasil dikirim!");
      refetchNotifs();
    },
    onError: (err) => {
      toast.error(`Kirim gagal: ${(err as Error).message}`);
      refetchNotifs();
    },
  });

  const salinLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/request-cuti`);
      toast.success("Link form permohonan disalin ke clipboard.");
    } catch {
      toast.error("Gagal menyalin link.");
    }
  };

  const statusBadge = (status: string) => {
    const s = getStatusCuti(status);
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const notifBadge = (n?: NotifRow) => {
    if (!n) return <span className="text-xs text-slate-400">—</span>;
    if (n.status === "terkirim")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> Terkirim
        </span>
      );
    if (n.status === "gagal")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
          <XCircle className="h-3.5 w-3.5" /> Gagal
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
        <Inbox className="h-3.5 w-3.5" /> Menunggu
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Request Cuti Karyawan"
        description="Kelola permohonan cuti staf, setujui/tolak, dan kirim notifikasi WhatsApp."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                isGatewayConnected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              {isGatewayConnected ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {isGatewayConnected ? "Gateway WA Terhubung" : "Gateway WA Offline"}
            </span>
            <Button
              variant="outline"
              className="border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={salinLink}
            >
              <Link2 className="mr-2 h-4 w-4 text-emerald-600" /> Salin Link Form
            </Button>
            <Button
              variant="outline"
              className="border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={() => window.open("/request-cuti", "_blank")}
            >
              <ExternalLink className="mr-2 h-4 w-4 text-emerald-600" /> Buka Form
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                refetchCuti();
                refetchNotifs();
                refetchGateway();
                syncNotifications();
                toast.success("Data disegarkan.");
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Segarkan
            </Button>
          </div>
        }
      />

      {/* Statistik */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Diajukan",
            value: stats.diajukan,
            icon: ClipboardList,
            cls: "text-amber-600 bg-amber-500/10 border-amber-500/20",
          },
          {
            label: "Disetujui",
            value: stats.disetujui,
            icon: CheckCircle2,
            cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
          },
          {
            label: "Ditolak",
            value: stats.ditolak,
            icon: XCircle,
            cls: "text-rose-600 bg-rose-500/10 border-rose-500/20",
          },
          {
            label: "Notif Belum Kirim",
            value: stats.belumKirim,
            icon: Send,
            cls: "text-sky-600 bg-sky-500/10 border-sky-500/20",
          },
        ].map((s) => (
          <Card key={s.label} className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${s.cls}`}
              >
                <s.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {s.label}
                </p>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Semua Cabang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.nama}>
                  {b.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Cari nama / kode karyawan..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full lg:w-60"
        />
      </div>

      {/* Tabel permohonan */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Daftar Permohonan Cuti</h3>
            <p className="text-xs text-slate-500">
              Diurutkan dari pengajuan terlama (prioritas pertama) • {filteredCuti.length}{" "}
              permohonan
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-transparent">
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-center">Hari</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notif WA</TableHead>
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
              ) : filteredCuti.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-12 text-center text-slate-500">
                    Belum ada permohonan. Bagikan link form kepada staf.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCuti.map((c) => {
                  const notif = notifByCuti[c.id];
                  const jenisCuti = getJenisCuti(c.jenis);
                  return (
                    <TableRow key={c.id} className="transition-colors hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-400">
                        {c.employees?.kode_karyawan || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{c.employees?.nama || "-"}</div>
                        <div className="text-xs text-slate-400">
                          {c.employees?.branches?.nama || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${jenisCuti.bg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${jenisCuti.dot}`} />
                          {jenisCuti.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-slate-700">
                          {formatTanggalHR(c.tanggal_mulai)}
                        </span>
                        <span className="text-slate-400"> → </span>
                        <span className="font-medium text-slate-700">
                          {formatTanggalHR(c.tanggal_selesai)}
                        </span>
                        {c.tanggal_list && c.tanggal_list.length > 0 && (
                          <div className="mt-1 flex max-w-56 flex-wrap gap-1">
                            {c.tanggal_list.slice(0, 6).map((t) => {
                              const d = new Date(`${t}T00:00:00`);
                              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                              return (
                                <span
                                  key={t}
                                  title={formatTanggalHR(t)}
                                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                                    isWeekend
                                      ? "border-rose-200 bg-rose-50 text-rose-600"
                                      : "border-slate-200 bg-slate-50 text-slate-600"
                                  }`}
                                >
                                  {d.toLocaleDateString("id-ID", {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                              );
                            })}
                            {c.tanggal_list.length > 6 && (
                              <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                                +{c.tanggal_list.length - 6}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {countDays(c.tanggal_mulai, c.tanggal_selesai)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48">
                        <span className="line-clamp-2 text-xs text-slate-500">
                          {c.alasan || "-"}
                        </span>
                      </TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell>{notifBadge(notif)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          {c.status === "diajukan" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => approveMutation.mutate(c)}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Setujui
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50"
                                onClick={() => {
                                  setTolakTarget(c);
                                  setAlasanTolak("");
                                }}
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" /> Tolak
                              </Button>
                            </>
                          ) : (
                            <>
                              {notif && notif.status !== "terkirim" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-sky-200 text-sky-600 hover:bg-sky-50"
                                  onClick={() => sendNotifMutation.mutate(notif)}
                                  disabled={sendNotifMutation.isPending}
                                >
                                  <Send className="mr-1 h-3.5 w-3.5" /> Kirim WA
                                </Button>
                              )}
                              {notif && notif.status === "terkirim" && (
                                <span className="text-xs text-slate-400">
                                  {maskPhone(notif.employees?.whatsapp)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Antrean notifikasi */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Send className="h-4 w-4 text-emerald-600" /> Antrean Notifikasi WhatsApp
            </h3>
            <p className="text-xs text-slate-500">
              {notifList.filter((n) => n.status !== "terkirim").length} pesan menunggu dikirim •{" "}
              {notifList.filter((n) => n.status === "terkirim").length} terkirim
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-transparent">
                <TableHead>Nama</TableHead>
                <TableHead>No. WA</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Pesan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-10 text-center text-slate-500">
                    Belum ada notifikasi. Notifikasi dibuat otomatis saat permohonan
                    disetujui/ditolak.
                  </TableCell>
                </TableRow>
              ) : (
                notifList.map((n) => (
                  <TableRow key={n.id} className="transition-colors hover:bg-slate-50">
                    <TableCell className="font-medium text-slate-900">
                      {n.employees?.nama || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {maskPhone(n.employees?.whatsapp)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={n.tipe === "disetujui" ? "default" : "destructive"}>
                        {n.tipe === "disetujui" ? "Disetujui" : "Ditolak"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-80">
                      <p className="line-clamp-2 text-xs text-slate-500">{n.pesan}</p>
                      {n.error && (
                        <p className="mt-0.5 text-[10px] text-rose-500">Error: {n.error}</p>
                      )}
                    </TableCell>
                    <TableCell>{notifBadge(n)}</TableCell>
                    <TableCell className="text-right">
                      {n.status === "terkirim" ? (
                        <span className="text-xs text-slate-400">
                          {n.sent_at
                            ? new Date(n.sent_at).toLocaleString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Terkirim"}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-sky-200 text-sky-600 hover:bg-sky-50"
                          onClick={() => sendNotifMutation.mutate(n)}
                          disabled={sendNotifMutation.isPending}
                        >
                          <Send className="mr-1 h-3.5 w-3.5" /> Kirim
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog tolak */}
      <Dialog open={!!tolakTarget} onOpenChange={(open) => !open && setTolakTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Tolak Permohonan Cuti
            </DialogTitle>
            <DialogDescription>
              {tolakTarget?.employees?.nama || "-"} —{" "}
              {tolakTarget ? getJenisCuti(tolakTarget.jenis).label : ""} (
              {tolakTarget ? formatTanggalHR(tolakTarget.tanggal_mulai) : ""} s/d{" "}
              {tolakTarget ? formatTanggalHR(tolakTarget.tanggal_selesai) : ""})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Alasan Penolakan <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              rows={4}
              placeholder="Contoh: kuota sudah penuh, alasan kurang jelas, dll."
              value={alasanTolak}
              onChange={(e) => setAlasanTolak(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTolakTarget(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={alasanTolak.trim().length < 5 || rejectMutation.isPending}
              onClick={() => {
                if (tolakTarget)
                  rejectMutation.mutate({ cuti: tolakTarget, alasan: alasanTolak.trim() });
              }}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Tolak & Buat Notifikasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info cara kerja */}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-900">
        <p className="flex items-center gap-1.5 font-semibold">
          <FileText className="h-4 w-4" /> Cara kerja kuota & prioritas
        </p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-emerald-800">
          <li>
            Kuota harian dihitung per cabang (bisa berbeda antar cabang) dari permohonan berstatus
            Disetujui — nilai kuota diatur di menu Cabang.
          </li>
          <li>
            Staf yang mengajukan saat kuota penuh otomatis ditolak oleh sistem (first come, first
            served).
          </li>
          <li>
            Saat menyetujui, sistem menolak bila kuota tanggal sudah penuh — prioritas ikut urutan
            pengajuan.
          </li>
          <li>
            Pesan WA dikirim dari antrean di atas; pastikan Gateway WA terhubung (kartu status di
            pojok kanan).
          </li>
        </ul>
      </div>
    </div>
  );
}
