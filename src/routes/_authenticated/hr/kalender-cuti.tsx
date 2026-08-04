import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileSpreadsheet,
  FileDown,
  Users,
  Send,
  Share2,
  Wifi,
  WifiOff,
  Image as ImageIcon,
  UserRound,
  UsersRound,
  RefreshCw,
} from "lucide-react";
import html2canvas from "html2canvas";
import {
  JENIS_CUTI,
  STATUS_CUTI,
  getJenisCuti,
  getStatusCuti,
  BULAN_PANJANG,
  HARI_PENDEK,
  formatTanggalHR,
  toISODate,
  getDaysInMonth,
  countDays,
} from "@/lib/hr";
import { buildKalenderCutiMessage, type KalenderCutiItem } from "@/lib/cuti-request";
import {
  getWaGatewayStatus,
  getWaGroups,
  sendWaMessageToJid,
  sendWaImageToJid,
} from "@/lib/wa-gateway";
import { downloadCSV, downloadPDFTable, safeFileName } from "@/lib/hr-export";

export const Route = createFileRoute("/_authenticated/hr/kalender-cuti")({
  component: KalenderCutiPage,
});

type Employee = {
  id: string;
  nama: string;
  kode_karyawan?: string | null;
  jabatan?: string | null;
  aktif?: boolean;
  branch_id?: string | null;
  whatsapp?: string | null;
  branches?: { nama?: string } | null;
};

type CutiRecord = {
  id: string;
  employee_id: string;
  jenis: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  alasan?: string | null;
  status: string;
  employees?: Employee | null;
};

type BranchOption = {
  id: string;
  nama: string;
  wa_group_jid?: string | null;
  wa_group_nama?: string | null;
  kuota_cuti_hari_kerja?: number;
  kuota_cuti_akhir_pekan?: number;
};

/**
 * Poster kalender yang dirender di luar layar (posisi fixed -9999px)
 * lalu ditangkap menjadi gambar PNG via html2canvas untuk dibagikan ke WhatsApp.
 * Semua gaya memakai inline style agar html2canvas merendernya konsisten.
 */
function KalenderPoster({
  bulan,
  tahun,
  month,
  cabang,
  grid,
  items,
}: {
  bulan: string;
  tahun: number;
  month: number; // 0-based
  cabang: string;
  grid: (number | null)[];
  items: KalenderCutiItem[];
}) {
  const todayKey = toISODate(new Date());

  const byDate = useMemo(() => {
    const map: Record<string, KalenderCutiItem[]> = {};
    items.forEach((it) => {
      if (!map[it.tanggal]) map[it.tanggal] = [];
      map[it.tanggal].push(it);
    });
    return map;
  }, [items]);

  const totalDisetujui = items.filter((it) => it.status === "disetujui").length;
  const orangSet = new Set(items.map((it) => it.nama));

  const headerCell = (h: string) => (
    <div
      key={h}
      style={{
        textAlign: "center",
        fontSize: 12,
        fontWeight: 700,
        color: h === "Min" ? "#e11d48" : "#64748b",
        padding: "6px 0",
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      {h}
    </div>
  );

  const cell = (day: number, i: number) => {
    const dateKey = `${tahun}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = dateKey === todayKey;
    const isSunday = i % 7 === 6;
    const dayCuti = byDate[dateKey] || [];
    const seen = new Set<string>();
    const unique = dayCuti.filter((c) => {
      const k = `${c.nama}|${c.jenis}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return (
      <div
        key={i}
        style={{
          minHeight: 96,
          borderRadius: 10,
          border: isToday
            ? "2px solid #10b981"
            : isSunday
              ? "1px solid #ffe4e6"
              : "1px solid #e2e8f0",
          background: isToday ? "#ecfdf5" : isSunday ? "#fff1f2" : "#ffffff",
          padding: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: isToday ? "#047857" : "#334155",
            marginBottom: 4,
          }}
        >
          {day}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {unique.slice(0, 3).map((c, ci) => {
            const jenisCuti = getJenisCuti(c.jenis);
            return (
              <div
                key={ci}
                style={{
                  borderRadius: 6,
                  background: `${jenisCuti.color}1F`,
                  color: "#0f172a",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "3px 6px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: jenisCuti.color,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.nama}</span>
              </div>
            );
          })}
          {unique.length > 3 && (
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, paddingLeft: 2 }}>
              +{unique.length - 3} lainnya
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: 1080,
        background: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg,#047857,#0d9488)",
          padding: "26px 36px",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: 0.5 }}>
            JADWAL CUTI KARYAWAN
          </div>
          <div style={{ fontSize: 14, marginTop: 4, opacity: 0.9 }}>
            {bulan} {tahun} • {cabang}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, opacity: 0.92, lineHeight: 1.7 }}>
          Total: {items.length} catatan cuti
          <br />
          Disetujui: {totalDisetujui} • {orangSet.size} karyawan
        </div>
      </div>

      {/* Legenda */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          padding: "12px 36px",
          borderBottom: "2px solid #e2e8f0",
        }}
      >
        {JENIS_CUTI.map((j) => (
          <span
            key={j.value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#334155",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: j.color,
                display: "inline-block",
              }}
            />
            {j.label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div style={{ padding: "16px 36px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {HARI_PENDEK.map(headerCell)}
          {grid.map((day, i) =>
            day === null ? (
              <div
                key={i}
                style={{
                  minHeight: 96,
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid #f1f5f9",
                }}
              />
            ) : (
              cell(day, i)
            ),
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 36px",
          borderTop: "2px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#94a3b8",
        }}
      >
        <span>Dibuat otomatis dari sistem PayFlow HR</span>
        <span>
          {new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

function KalenderCutiPage() {
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // 0-based
  const [selectedBranch, setSelectedBranch] = useState("all");

  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [empId, setEmpId] = useState("");
  const [jenis, setJenis] = useState("tahunan");
  const [tglMulai, setTglMulai] = useState("");
  const [tglSelesai, setTglSelesai] = useState("");
  const [tglTerpilih, setTglTerpilih] = useState<string[]>([]);
  const [multiView, setMultiView] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [status, setStatus] = useState("diajukan");

  // Share ke grup WA / personal
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMode, setShareMode] = useState<"group" | "personal">("group");
  const [shareBranchId, setShareBranchId] = useState("");
  const [shareGroupJid, setShareGroupJid] = useState("");
  const [sharePhone, setSharePhone] = useState("");
  const [shareSending, setShareSending] = useState(false);

  // Export loading state
  const [exporting, setExporting] = useState(false);

  // Poster gambar kalender (html2canvas)
  const posterRef = useRef<HTMLDivElement>(null);
  const [posterData, setPosterData] = useState<string | null>(null);
  const [posterBuilding, setPosterBuilding] = useState(false);

  const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(
    getDaysInMonth(viewYear, viewMonth),
  ).padStart(2, "0")}`;

  // Data cabang & karyawan
  const { data: branches = [] } = useQuery<BranchOption[]>({
    queryKey: ["branches_hr"],
    queryFn: async () => {
      const { data } = await supabase
        .from("branches")
        .select(
          "id, nama, wa_group_jid, wa_group_nama, kuota_cuti_hari_kerja, kuota_cuti_akhir_pekan",
        )
        .order("nama");
      return (data as BranchOption[]) || [];
    },
  });

  // Status gateway WhatsApp & daftar grup bot
  const { data: gateway } = useQuery({
    queryKey: ["wa_gateway_kalender"],
    queryFn: getWaGatewayStatus,
    refetchInterval: 8000,
  });

  const { data: waGroups = [] } = useQuery({
    queryKey: ["wa_groups_kalender"],
    queryFn: getWaGroups,
    enabled: shareOpen,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees_hr_cuti"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nama, kode_karyawan, jabatan, aktif, branch_id, whatsapp, branches ( nama )")
        .order("nama");
      return (data || []) as Employee[];
    },
  });

  // Data cuti yang menabrak bulan tampilan
  const { data: cutiList = [], isLoading } = useQuery<CutiRecord[]>({
    queryKey: ["cuti_list", viewYear, viewMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cuti")
        .select(
          "id, employee_id, jenis, tanggal_mulai, tanggal_selesai, alasan, status, employees ( id, nama, kode_karyawan, jabatan, aktif, branch_id, branches ( nama ) )",
        )
        .lte("tanggal_mulai", monthEnd)
        .gte("tanggal_selesai", monthStart)
        .order("tanggal_mulai");
      if (error) throw error;
      return (data || []) as CutiRecord[];
    },
  });

  const filteredCuti = useMemo(() => {
    return cutiList.filter((c) => {
      if (selectedBranch === "all") return true;
      return c.employees?.branch_id === selectedBranch;
    });
  }, [cutiList, selectedBranch]);

  const selectedBranchName =
    selectedBranch === "all"
      ? "Semua Cabang"
      : branches.find((b) => b.id === selectedBranch)?.nama || selectedBranch;

  // Bangun grid kalender (dimulai hari Senin)
  const grid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // Senin = 0
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const cutiByDate = useMemo(() => {
    const map: Record<string, CutiRecord[]> = {};
    filteredCuti.forEach((c) => {
      const s = new Date(`${c.tanggal_mulai}T00:00:00`);
      const e = new Date(`${c.tanggal_selesai}T00:00:00`);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const key = toISODate(d);
        if (key >= monthStart && key <= monthEnd) {
          if (!map[key]) map[key] = [];
          map[key].push(c);
        }
      }
    });
    return map;
  }, [filteredCuti, monthStart, monthEnd]);

  const stats = useMemo(() => {
    const total = filteredCuti.length;
    const disetujui = filteredCuti.filter((c) => c.status === "disetujui").length;
    const todayKey = toISODate(today);
    const cutiHariIni = (cutiByDate[todayKey] || []).length;
    return { total, disetujui, cutiHariIni };
  }, [filteredCuti, cutiByDate, today]);

  const handleClose = () => {
    setIsOpen(false);
    setIsEditing(false);
    setEditId(null);
    setEmpId("");
    setJenis("tahunan");
    setTglMulai("");
    setTglSelesai("");
    setTglTerpilih([]);
    setMultiView(false);
    setAlasan("");
    setStatus("diajukan");
  };

  const openAdd = () => {
    setEmpId("");
    setJenis("tahunan");
    setTglMulai(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`);
    setTglSelesai("");
    setTglTerpilih([]);
    setMultiView(false);
    setAlasan("");
    setStatus("diajukan");
    setIsEditing(false);
    setIsOpen(true);
  };

  const openEdit = (c: CutiRecord) => {
    setIsEditing(true);
    setEditId(c.id);
    setEmpId(c.employee_id);
    setJenis(c.jenis);
    setTglMulai(c.tanggal_mulai);
    setTglSelesai(c.tanggal_selesai);
    setTglTerpilih([]);
    setMultiView(false);
    setAlasan(c.alasan || "");
    setStatus(c.status);
    setIsOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tanggal_list = multiView && tglTerpilih.length > 0 ? tglTerpilih : null;
      // Ambil branch_id dari employee yang dipilih
      const selectedEmp = employees.find((e) => e.id === empId);
      const payload: {
        employee_id: string;
        jenis: string;
        tanggal_mulai: string;
        tanggal_selesai: string;
        alasan: string;
        status: string;
        branch_id?: string;
        tanggal_list?: string[];
      } = {
        employee_id: empId,
        jenis,
        tanggal_mulai: tglMulai,
        tanggal_selesai: tglSelesai,
        alasan,
        status,
        branch_id: selectedEmp?.branch_id || null,
      };
      if (tanggal_list) {
        payload.tanggal_list = tanggal_list;
      }
      if (isEditing && editId) {
        const { error } = await supabase.from("cuti").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cuti").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuti_list"] });
      toast.success(isEditing ? "Data cuti berhasil diperbarui!" : "Data cuti berhasil disimpan!");
      handleClose();
    },
    onError: (err) => toast.error(`Gagal menyimpan: ${(err as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cuti").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuti_list"] });
      toast.success("Data cuti dihapus!");
    },
    onError: (err) => toast.error(`Gagal menghapus: ${(err as Error).message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId) return toast.error("Pilih karyawan terlebih dahulu.");
    if (!tglMulai || !tglSelesai) return toast.error("Lengkapi tanggal cuti.");
    if (tglSelesai < tglMulai)
      return toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    saveMutation.mutate();
  };

  const exportExcel = async () => {
    if (filteredCuti.length === 0) return toast.error("Tidak ada data cuti untuk diekspor.");
    setExporting(true);
    try {
      const headers = [
        "Kode",
        "Nama Karyawan",
        "Cabang",
        "Jabatan",
        "Jenis Cuti",
        "Tanggal Mulai",
        "Tanggal Selesai",
        "Jumlah Hari",
        "Alasan",
        "Status",
      ];
      const rows = filteredCuti.map((c) => [
        c.employees?.kode_karyawan || "-",
        c.employees?.nama || "-",
        c.employees?.branches?.nama || "-",
        c.employees?.jabatan || "-",
        getJenisCuti(c.jenis).label,
        c.tanggal_mulai,
        c.tanggal_selesai,
        countDays(c.tanggal_mulai, c.tanggal_selesai),
        c.alasan || "-",
        getStatusCuti(c.status).label,
      ]);
      downloadCSV(
        `Kalender_Cuti_${safeFileName(BULAN_PANJANG[viewMonth])}_${viewYear}.csv`,
        headers,
        rows,
      );
      toast.success("Data berhasil diekspor ke Excel.");
    } catch (err) {
      toast.error("Gagal mengekspor data.");
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    if (filteredCuti.length === 0) return toast.error("Tidak ada data cuti untuk diekspor.");
    setExporting(true);
    try {
      const headers = [
        "Kode",
        "Nama Karyawan",
        "Cabang",
        "Jenis Cuti",
        "Tanggal Mulai",
        "Tanggal Selesai",
        "Hari",
        "Status",
      ];
      const rows = filteredCuti.map((c) => [
        c.employees?.kode_karyawan || "-",
        c.employees?.nama || "-",
        c.employees?.branches?.nama || "-",
        getJenisCuti(c.jenis).label,
        c.tanggal_mulai,
        c.tanggal_selesai,
        countDays(c.tanggal_mulai, c.tanggal_selesai),
        getStatusCuti(c.status).label,
      ]);
      downloadPDFTable(
        `Kalender_Cuti_${safeFileName(BULAN_PANJANG[viewMonth])}_${viewYear}.pdf`,
        "Kalender Cuti Karyawan",
        `${selectedBranchName} • ${BULAN_PANJANG[viewMonth]} ${viewYear}`,
        headers,
        rows,
      );
      toast.success("Data berhasil diekspor ke PDF.");
    } catch (err) {
      toast.error("Gagal mengekspor data.");
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const changeMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  // ---- Share kalender ke grup WhatsApp / personal ----
  const buildShareItems = () => {
    const scope = shareBranchId || selectedBranch;
    const items: KalenderCutiItem[] = [];
    cutiList.forEach((c) => {
      if (c.status === "ditolak") return; // jangan share yang ditolak
      if (scope !== "all" && c.employees?.branch_id !== scope) return;
      const s = new Date(`${c.tanggal_mulai}T00:00:00`);
      const e = new Date(`${c.tanggal_selesai}T00:00:00`);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const key = toISODate(d);
        if (key >= monthStart && key <= monthEnd) {
          items.push({
            tanggal: key,
            nama: c.employees?.nama || "-",
            jenis: c.jenis,
            status: c.status,
          });
        }
      }
    });
    return items;
  };

  const shareMessage = useMemo(() => {
    const scope = shareBranchId || selectedBranch;
    const cabangName =
      scope === "all" ? "Semua Cabang" : branches.find((b) => b.id === scope)?.nama || scope;
    return buildKalenderCutiMessage({
      bulan: BULAN_PANJANG[viewMonth],
      tahun: viewYear,
      cabang: cabangName,
      items: buildShareItems(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shareBranchId,
    selectedBranch,
    cutiList,
    branches,
    viewMonth,
    viewYear,
    monthStart,
    monthEnd,
  ]);

  // Bangun gambar poster kalender untuk scope saat ini
  const buildPoster = useCallback(async () => {
    if (!posterRef.current) return;
    setPosterBuilding(true);
    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      setPosterData(canvas.toDataURL("image/png"));
    } catch (err) {
      console.error("Gagal membuat gambar kalender:", err);
      setPosterData(null);
      toast.error("Gagal membuat gambar kalender. Kirim akan memakai pesan teks.");
    } finally {
      setPosterBuilding(false);
    }
  }, []);

  // Rebuild gambar setiap kali dialog dibuka / scope bulan-cabang berubah
  useEffect(() => {
    if (!shareOpen) return;
    setPosterData(null);
    const t = setTimeout(buildPoster, 80);
    return () => clearTimeout(t);
  }, [shareOpen, shareBranchId, viewMonth, viewYear, buildPoster]);

  const openShare = () => {
    if (buildShareItems().length === 0) {
      toast.error("Tidak ada jadwal cuti untuk dibagikan pada bulan ini.");
      return;
    }
    setShareBranchId(selectedBranch === "all" ? "" : selectedBranch);
    const initial =
      selectedBranch === "all"
        ? ""
        : branches.find((b) => b.id === selectedBranch)?.wa_group_jid || "";
    setShareGroupJid(initial);
    setSharePhone("");
    setShareMode("group");
    setShareOpen(true);
  };

  const handleShare = async () => {
    const scope = shareBranchId || selectedBranch;
    if (!scope || scope === "all") {
      toast.error("Pilih cabang terlebih dahulu.");
      return;
    }
    const items = buildShareItems();
    if (items.length === 0) {
      toast.error("Tidak ada jadwal cuti untuk dibagikan.");
      return;
    }

    // Tentukan tujuan: grup (JID) atau personal (nomor HP)
    let target = "";
    if (shareMode === "group") {
      target = shareGroupJid.trim();
      if (!target) {
        toast.error("Pilih grup WhatsApp tujuan terlebih dahulu.");
        return;
      }
    } else {
      target = sharePhone.trim();
      const digits = target.replace(/[^0-9]/g, "");
      if (digits.length < 9) {
        toast.error("Masukkan nomor WhatsApp tujuan (min. 9 digit).");
        return;
      }
    }

    setShareSending(true);
    try {
      const branch = branches.find((b) => b.id === scope);
      const cabangNama = branch?.nama || scope;
      // Simpan grup pilihan ke cabang agar dipakai lagi nanti (hanya mode grup)
      if (shareMode === "group" && branch && branch.wa_group_jid !== target) {
        const groupName = waGroups.find((g) => g.id === target)?.subject || null;
        const { error } = await supabase
          .from("branches")
          .update({ wa_group_jid: target, wa_group_nama: groupName })
          .eq("id", scope);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["branches_hr"] });
      }
      const message = buildKalenderCutiMessage({
        bulan: BULAN_PANJANG[viewMonth],
        tahun: viewYear,
        cabang: cabangNama,
        items,
      });
      // Kirim gambar kalender (fallback ke teks bila gambar gagal dibuat)
      const res = posterData
        ? await sendWaImageToJid(target, message, posterData)
        : await sendWaMessageToJid(target, message);
      if (!res.ok) throw new Error(res.error || "Gagal mengirim pesan.");
      toast.success(
        shareMode === "group"
          ? "Gambar kalender cuti berhasil dikirim ke grup WhatsApp!"
          : "Gambar kalender cuti berhasil dikirim ke personal WhatsApp!",
      );
      setShareOpen(false);
    } catch (err) {
      toast.error(`Gagal mengirim: ${(err as Error).message}`);
    } finally {
      setShareSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Poster tersembunyi untuk di-capture jadi gambar (kirim via WA) */}
      {(() => {
        const scope = shareBranchId || selectedBranch;
        const cabangNama =
          scope === "all" ? "Semua Cabang" : branches.find((b) => b.id === scope)?.nama || scope;
        return (
          <div
            ref={posterRef}
            aria-hidden
            className="pointer-events-none fixed top-0 z-[-1]"
            style={{ left: -9999 }}
          >
            <KalenderPoster
              bulan={BULAN_PANJANG[viewMonth]}
              tahun={viewYear}
              month={viewMonth}
              cabang={cabangNama}
              grid={grid}
              items={buildShareItems()}
            />
          </div>
        );
      })()}

      <PageHeader
        title="Kalender Cuti Staf"
        description="Pantau jadwal cuti seluruh staf dalam tampilan kalender yang mudah dibaca."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={exportExcel}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
              )}
              {exporting ? "Mengekspor..." : "Excel"}
            </Button>
            <Button
              variant="outline"
              className="border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={exportPDF}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" />
              ) : (
                <FileDown className="mr-2 h-4 w-4 text-emerald-600" />
              )}
              {exporting ? "Mengekspor..." : "PDF"}
            </Button>
            <Button
              variant="outline"
              className="border-sky-200 hover:bg-sky-50 hover:text-sky-700"
              onClick={openShare}
            >
              <Share2 className="mr-2 h-4 w-4 text-sky-600" /> Share ke WhatsApp
            </Button>
            <Dialog
              open={isOpen}
              onOpenChange={(open) => (!open ? handleClose() : setIsOpen(true))}
            >
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer">
                  <Plus className="w-4 h-4 mr-2" /> Tambah Cuti
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {isEditing ? "Edit Cuti" : "Tambah Cuti"}
                  </DialogTitle>
                  <DialogDescription>
                    Catat jadwal cuti karyawan. Karyawan diambil dari data panel gaji.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Karyawan
                    </Label>
                    <Select value={empId} onValueChange={setEmpId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih karyawan" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter((e) => e.aktif || e.id === empId)
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nama} {e.kode_karyawan ? `(${e.kode_karyawan})` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Jenis Cuti
                      </Label>
                      <Select value={jenis} onValueChange={setJenis}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {JENIS_CUTI.map((j) => (
                            <SelectItem key={j.value} value={j.value}>
                              {j.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Status
                      </Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_CUTI.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Tanggal Mulai
                      </Label>
                      <Input
                        type="date"
                        value={tglMulai}
                        onChange={(e) => setTglMulai(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Tanggal Selesai
                      </Label>
                      <Input
                        type="date"
                        value={tglSelesai}
                        onChange={(e) => setTglSelesai(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Alasan
                    </Label>
                    <Textarea
                      placeholder="Tuliskan alasan cuti..."
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" type="button" onClick={handleClose}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Simpan"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Statistik */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Cuti Bulan Ini", value: stats.total, icon: CalendarDays },
          { label: "Cuti Disetujui", value: stats.disetujui, icon: Users },
          { label: "Staf Cuti Hari Ini", value: stats.cutiHariIni, icon: Users },
        ].map((s) => (
          <Card key={s.label} className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500/15 to-teal-400/15 border border-emerald-500/20">
                <s.icon className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {s.label}
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + Navigasi Bulan */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="w-44 text-center">
            <p className="text-base font-bold text-slate-900">{BULAN_PANJANG[viewMonth]}</p>
            <p className="text-xs text-slate-400">{viewYear}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => changeMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="ml-1 text-emerald-600"
            onClick={() => {
              setViewMonth(today.getMonth());
              setViewYear(today.getFullYear());
            }}
          >
            Bulan Ini
          </Button>
        </div>
        <div className="flex w-full flex-col gap-1 sm:w-64">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua Cabang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedBranch !== "all" &&
            (() => {
              const b = branches.find((x) => x.id === selectedBranch);
              return b ? (
                <p className="truncate text-[11px] text-slate-400">
                  Kuota cuti: {b.kuota_cuti_hari_kerja ?? 2} org/hari kerja •{" "}
                  {b.kuota_cuti_akhir_pekan ?? 1} org Sabtu/Minggu
                </p>
              ) : null;
            })()}
        </div>
      </div>

      {/* Grid Kalender */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
          {HARI_PENDEK.map((h) => (
            <div
              key={h}
              className={`px-2 py-2.5 text-center text-xs font-bold uppercase tracking-wider ${
                h === "Min" ? "text-rose-500" : "text-slate-500"
              }`}
            >
              {h}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {isLoading
            ? Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-24 border-b border-r border-slate-50 p-1.5" />
              ))
            : grid.map((day, i) => {
                if (day === null)
                  return (
                    <div
                      key={i}
                      className="min-h-24 border-b border-r border-slate-50 bg-slate-50/40 p-1.5"
                    />
                  );
                const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = dateKey === toISODate(today);
                const isSunday = i % 7 === 6;
                const dayCuti = cutiByDate[dateKey] || [];
                return (
                  <div
                    key={i}
                    className={`min-h-24 border-b border-r border-slate-50 p-1.5 transition-colors hover:bg-emerald-50/40 ${
                      isSunday ? "bg-rose-50/30" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          isToday
                            ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20"
                            : "text-slate-600"
                        }`}
                      >
                        {day}
                      </span>
                      {dayCuti.length > 0 && (
                        <span className="text-[10px] font-semibold text-emerald-600">
                          {dayCuti.length} cuti
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {dayCuti.slice(0, 3).map((c) => {
                        const jenisCuti = getJenisCuti(c.jenis);
                        return (
                          <div
                            key={c.id}
                            className={`flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${jenisCuti.bg}`}
                            title={`${c.employees?.nama} • ${jenisCuti.label} • ${formatTanggalHR(c.tanggal_mulai)} - ${formatTanggalHR(c.tanggal_selesai)}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${jenisCuti.dot}`}
                            />
                            <span className="truncate">{c.employees?.nama}</span>
                          </div>
                        );
                      })}
                      {dayCuti.length > 3 && (
                        <p className="px-1 text-[10px] font-semibold text-slate-400">
                          +{dayCuti.length - 3} lainnya
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Legenda:
          </span>
          {JENIS_CUTI.map((j) => (
            <span key={j.value} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${j.dot}`} />
              {j.label}
            </span>
          ))}
        </div>
      </div>

      {/* Dialog share kalender ke WhatsApp (grup / personal) */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Share Kalender Cuti via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Kirim gambar jadwal cuti {BULAN_PANJANG[viewMonth]} {viewYear} ke grup WhatsApp atau
              personal tim.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Status gateway */}
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                gateway?.status === "connected"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {gateway?.status === "connected" ? (
                <Wifi className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
              )}
              {gateway?.status === "connected"
                ? "Gateway WhatsApp terhubung — gambar siap dikirim."
                : "Gateway WhatsApp offline — pastikan backend WA berjalan & terhubung."}
            </div>

            {/* Pilih mode: grup / personal */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-1">
              <button
                type="button"
                onClick={() => setShareMode("group")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  shareMode === "group"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <UsersRound className="h-3.5 w-3.5" /> Grup WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setShareMode("personal")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  shareMode === "personal"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <UserRound className="h-3.5 w-3.5" /> Personal / Tim
              </button>
            </div>

            {/* Pilih cabang (lingkup data kalender) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cabang
              </Label>
              <Select
                value={shareBranchId || "all"}
                onValueChange={(v) => {
                  if (v === "all") {
                    setShareBranchId("");
                    setShareGroupJid("");
                  } else {
                    setShareBranchId(v);
                    setShareGroupJid(branches.find((x) => x.id === v)?.wa_group_jid || "");
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Cabang</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {shareMode === "group" ? (
              /* Pilih grup */
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Grup WhatsApp Tujuan
                </Label>
                {waGroups.length > 0 ? (
                  <Select value={shareGroupJid} onValueChange={setShareGroupJid}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih grup..." />
                    </SelectTrigger>
                    <SelectContent>
                      {waGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.subject || g.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Paste JID grup (contoh: 120363347759137613@g.us)"
                    value={shareGroupJid}
                    onChange={(e) => setShareGroupJid(e.target.value)}
                  />
                )}
                <p className="text-[11px] text-slate-400">
                  {shareGroupJid
                    ? `ID grup: ${shareGroupJid}`
                    : "Pilih grup yang diikuti bot gateway, atau tempel JID grup secara manual."}
                </p>
              </div>
            ) : (
              /* Pilih personal / tim */
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Pilih Tim (opsional)
                  </Label>
                  <Select value={sharePhone} onValueChange={(v) => setSharePhone(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih karyawan tim..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees
                        .filter((e) => e.whatsapp)
                        .map((e) => (
                          <SelectItem key={e.id} value={e.whatsapp || ""}>
                            {e.nama} {e.branches?.nama ? `(${e.branches.nama})` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Nomor WhatsApp Tujuan <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="08xxxxxxxxxx atau 628xxxxxxxxxx"
                    value={sharePhone}
                    onChange={(e) => setSharePhone(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-400">
                    Gambar kalender akan dikirim langsung ke nomor WhatsApp tersebut.
                  </p>
                </div>
              </div>
            )}

            {/* Pratinjau gambar kalender */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pratinjau Gambar Kalender
                </Label>
                {posterData && (
                  <button
                    type="button"
                    onClick={buildPoster}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
                  >
                    <RefreshCw className="h-3 w-3" /> Buat ulang gambar
                  </button>
                )}
              </div>
              <div className="flex min-h-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {posterBuilding ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-xs text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                    Menyiapkan gambar kalender...
                  </div>
                ) : posterData ? (
                  <img
                    src={posterData}
                    alt="Pratinjau kalender cuti"
                    className="max-h-80 w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-xs text-slate-400">
                    <ImageIcon className="h-5 w-5" />
                    Gambar gagal dibuat — pesan teks akan dikirim sebagai pengganti.
                  </div>
                )}
              </div>
            </div>

            {/* Pratinjau caption pesan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Caption Pesan
              </Label>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700">
                {shareMessage}
              </pre>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <div className="flex items-center text-[11px] text-slate-400">
              {shareMode === "group" ? (
                shareGroupJid ? (
                  <span className="truncate">→ {shareGroupJid}</span>
                ) : (
                  "Pilih grup tujuan"
                )
              ) : sharePhone ? (
                <span className="truncate">→ {sharePhone}</span>
              ) : (
                "Masukkan nomor tujuan"
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShareOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={handleShare}
                disabled={shareSending}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none rounded-xl shadow-md shadow-emerald-500/10 active:scale-[0.98] transition-all"
              >
                {shareSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {shareSending
                  ? "Mengirim..."
                  : shareMode === "group"
                    ? "Kirim Gambar ke Grup"
                    : "Kirim Gambar ke Personal"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Daftar Detail */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              Daftar Detail Cuti — {BULAN_PANJANG[viewMonth]} {viewYear}
            </h3>
            <p className="text-xs text-slate-500">
              {selectedBranchName} • {filteredCuti.length} catatan cuti
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-transparent">
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-center">Hari</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : filteredCuti.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-12 text-center text-slate-500">
                    Belum ada data cuti pada bulan ini. Klik "Tambah Cuti" untuk mencatat.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCuti.map((c) => {
                  const jenisCuti = getJenisCuti(c.jenis);
                  const statusCuti = getStatusCuti(c.status);
                  return (
                    <TableRow key={c.id} className="transition-colors hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-400">
                        {c.employees?.kode_karyawan || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{c.employees?.nama || "-"}</div>
                        {c.alasan && (
                          <div className="text-xs text-slate-400 line-clamp-1">{c.alasan}</div>
                        )}
                      </TableCell>
                      <TableCell>{c.employees?.branches?.nama || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${jenisCuti.bg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${jenisCuti.dot}`} />
                          {jenisCuti.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <span className="font-medium text-slate-700">
                            {formatTanggalHR(c.tanggal_mulai)}
                          </span>
                          <span className="text-slate-400"> → </span>
                          <span className="font-medium text-slate-700">
                            {formatTanggalHR(c.tanggal_selesai)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {countDays(c.tanggal_mulai, c.tanggal_selesai)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCuti.variant}>{statusCuti.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-600"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-500 hover:bg-rose-500/10"
                            onClick={() => {
                              if (window.confirm("Hapus data cuti ini?"))
                                deleteMutation.mutate(c.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
    </div>
  );
}
