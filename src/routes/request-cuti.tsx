import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { JENIS_CUTI, getJenisCuti, getStatusCuti, BULAN_PANJANG, formatTanggalHR, toISODate } from "@/lib/hr";
import { getKuotaLabel, maskPhone } from "@/lib/cuti-request";
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
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Phone,
  Send,
  ShieldCheck,
  XCircle,
  Info,
  RotateCcw,
} from "lucide-react";
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

export const Route = createFileRoute("/request-cuti")({
  component: RequestCutiPage,
});

type KaryawanMatch = {
  id: string;
  nama: string;
  whatsapp: string | null;
  branch_id: string | null;
};

type BranchInfo = {
  nama: string;
  kuota_cuti_hari_kerja: number;
  kuota_cuti_akhir_pekan: number;
};

type HasilKirim =
  | { status: "diajukan" }
  | { status: "ditolak"; alasan: string }
  | { status: "error"; alasan: string };

const todayLocalISO = () => toISODate(new Date());

type CutiPreviewItem = {
  id: string;
  employee_id: string;
  jenis: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  status: string;
  employees?: { nama?: string | null } | null;
};

function DayDetailBody({
  detailDate,
  cutiPreview,
  employeeId,
  isSelected,
  onToggle,
}: {
  detailDate: string;
  cutiPreview: CutiPreviewItem[];
  employeeId?: string | null;
  isSelected: boolean;
  onToggle: (tgl: string) => void;
}) {
  const seen = new Set<string>();
  const dayCuti = cutiPreview.filter((c) => {
    if (detailDate < c.tanggal_mulai || detailDate > c.tanggal_selesai) return false;
    const k = c.employee_id + "|" + c.jenis;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const isPast = detailDate < todayLocalISO();
  return (
    <div className="space-y-3">
      {dayCuti.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Staf yang cuti hari ini ({dayCuti.length} orang)
          </p>
          {dayCuti.map((c) => {
            const jc = getJenisCuti(c.jenis);
            const sc = getStatusCuti(c.status);
            const isOwn = c.employee_id === employeeId;
            const cardClass = isOwn
              ? "border-emerald-300 bg-emerald-50"
              : "border-slate-200 bg-white";
            const nameClass = isOwn ? "text-emerald-800" : "text-slate-800";
            const badgeClass = c.status === "disetujui"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700";
            const periode = c.tanggal_mulai === c.tanggal_selesai
              ? "Sehari"
              : formatTanggalHR(c.tanggal_mulai) + " s/d " + formatTanggalHR(c.tanggal_selesai);
            return (
              <div
                key={c.id + "|" + c.jenis}
                className={"flex items-center gap-2 rounded-lg border px-3 py-2 " + cardClass}
              >
                <span className={"h-3 w-3 shrink-0 rounded-full " + jc.dot} />
                <div className="flex-1 min-w-0">
                  <p className={"text-sm font-semibold truncate " + nameClass}>
                    {isOwn ? "\uD83D\uDC64 Anda" : (c.employees?.nama || "-")}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {jc.label}
                    <span className="mx-1">\u2022</span>
                    {periode}
                  </p>
                </div>
                <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " + badgeClass}>
                  {sc.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-sm text-slate-400">Tidak ada cuti pada tanggal ini</p>
        </div>
      )}
      {!isPast && (
        <button
          type="button"
          onClick={() => onToggle(detailDate)}
          className={"w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] " +
            (isSelected
              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100")
          }
        >
          {isSelected ? "\u2715 Hapus dari Pilihan" : "+ Pilih Tanggal Ini untuk Cuti"}
        </button>
      )}
    </div>
  );
}

function RequestCutiPage() {
  const [step, setStep] = useState<"phone" | "form" | "done">("phone");

  // Langkah 1: pencarian akun
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [employee, setEmployee] = useState<KaryawanMatch | null>(null);
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null);

  // Langkah 2: form — multi-tanggal
  const [jenis, setJenis] = useState("tahunan");

  const [tglTerpilih, setTglTerpilih] = useState<string[]>([]);

  const [alasan, setAlasan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Langkah 3: hasil
  const [hasil, setHasil] = useState<HasilKirim | null>(null);

  // Confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Calendar navigation
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());

  // Day detail popup
  const [detailDate, setDetailDate] = useState<string | null>(null);

  // Employee leave preview data (all staff)
  type CutiPreview = {
    id: string;
    employee_id: string;
    jenis: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    status: string;
    tanggal_list?: string[] | null;
    employees?: { nama?: string | null; branch_id?: string | null } | null;
  };
  const [cutiPreview, setCutiPreview] = useState<CutiPreview[]>([]);

  const tanggalTerpakai = useMemo(() => {
    return [...tglTerpilih].sort();
  }, [tglTerpilih]);

  const jumlahHari = tanggalTerpakai.length;

  const toggleTanggal = (tgl: string) => {
    setTglTerpilih((prev) =>
      prev.includes(tgl) ? prev.filter((d) => d !== tgl) : [...prev, tgl].sort(),
    );
  };

  const cariAkun = async () => {
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 9) {
      setPhoneError("Masukkan nomor WhatsApp yang valid (min. 9 digit).");
      return;
    }
    setPhoneError("");
    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc("cari_karyawan_oleh_wa", {
        p_wa: phone,
      });
      if (error) throw error;
      if (!data || data.length === 0) {
        setPhoneError(
          "Nomor WhatsApp tidak terdaftar sebagai karyawan aktif. Hubungi admin jika menurut Anda ini salah.",
        );
        setEmployee(null);
        return;
      }
      setEmployee(data[0]);
      if (data[0].branch_id) {
        const { data: br } = await supabase
          .from("branches")
          .select("nama, kuota_cuti_hari_kerja, kuota_cuti_akhir_pekan")
          .eq("id", data[0].branch_id)
          .single();
        setBranchInfo(br || null);
      } else {
        setBranchInfo(null);
      }
      setTglTerpilih([]);
      setCalMonth(new Date().getMonth());
      setCalYear(new Date().getFullYear());
      setStep("form");
      // Fetch ALL staff leave for calendar preview
      try {
        const { data: leaveData } = await supabase
          .from("cuti")
          .select(
            "id, employee_id, jenis, tanggal_mulai, tanggal_selesai, status, tanggal_list, employees ( nama, branch_id )",
          )
          .in("status", ["diajukan", "disetujui"])
          .order("tanggal_mulai", { ascending: false });
        setCutiPreview((leaveData as CutiPreview[]) || []);
      } catch {
        setCutiPreview([]);
      }
    } catch (err) {
      console.error(err);
      setPhoneError("Gagal memeriksa nomor. Coba lagi beberapa saat.");
    } finally {
      setIsSearching(false);
    }
  };

  const kirimPermohonan = async () => {
    if (!employee) return;
    if (tanggalTerpakai.length === 0) {
      toast.error("Pilih minimal satu tanggal cuti.");
      return;
    }

    if (jenis === "izin" && alasan.trim().length < 5) {
      toast.error("Untuk cuti izin, wajib mencantumkan alasan (min. 5 karakter).");
      return;
    }

    // Validasi tanggal tidak boleh di masa lalu
    const today = todayLocalISO();
    if (tanggalTerpakai[0] < today) {
      toast.error("Tidak dapat mengajukan cuti untuk tanggal yang sudah lalu.");
      return;
    }

    // Tampilkan konfirmasi
    setShowConfirmation(true);
  };

  const prosesSimpanPermohonan = async () => {
    if (!employee) return;

    setIsSubmitting(true);
    try {
      const tglMulaiSimpan = tanggalTerpakai[0];
      const tglSelesaiSimpan = tanggalTerpakai[tanggalTerpakai.length - 1];

      // 1. Cek permohonan aktif yang tumpang tindih
      const { data: duplikat, error: errDup } = await supabase.rpc("cek_duplikat_cuti", {
        p_emp: employee.id,
        p_mulai: tglMulaiSimpan,
        p_selesai: tglSelesaiSimpan,
      });
      if (errDup) throw errDup;
      if (duplikat) {
        setHasil({
          status: "error",
          alasan:
            "Anda masih memiliki permohonan cuti aktif (diajukan/disetujui) pada periode yang tumpang tindih.",
        });
        setShowConfirmation(false);
        setStep("done");
        return;
      }

      // 2. Cek kuota harian (per cabang karyawan) — hanya untuk tanggal yang dipilih
      const { data: kuota, error: errKuota } = await supabase.rpc("cek_kuota_cuti", {
        p_mulai: tglMulaiSimpan,
        p_selesai: tglSelesaiSimpan,
        p_branch: employee.branch_id,
      });
      if (errKuota) throw errKuota;

      const penuh = (kuota || []).filter((r) => (r.terpakai || 0) >= (r.kuota || 0));
      const alasanPermohonan = alasan.trim();
      let status: "diajukan" | "ditolak" = "diajukan";
      let alasanFinal = alasanPermohonan || null;

      if (penuh.length > 0) {
        // Tolak otomatis — kuota sudah penuh (prioritas sesuai urutan pengajuan)
        status = "ditolak";
        const daftar = penuh
          .map((r) => `${formatTanggalHR(r.tanggal)} (maks ${r.kuota} orang)`)
          .join(", ");
        const catatanKuota = `Ditolak otomatis: kuota sudah penuh pada ${daftar}.`;
        alasanFinal = alasanPermohonan ? `${alasanPermohonan}. ${catatanKuota}` : catatanKuota;
      }

      // 3. Simpan permohonan dengan tanggal_list
      const { error: errInsert } = await supabase.from("cuti").insert([
        {
          employee_id: employee.id,
          jenis,
          tanggal_mulai: tglMulaiSimpan,
          tanggal_selesai: tglSelesaiSimpan,
          tanggal_list: tanggalTerpakai,
          alasan: alasanFinal,
          status,
        },
      ]);
      if (errInsert) throw errInsert;

      setHasil(
        status === "ditolak"
          ? { status: "ditolak", alasan: alasanFinal || "" }
          : { status: "diajukan" },
      );
      setShowConfirmation(false);
      setStep("done");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengirim permohonan. Coba lagi beberapa saat.");
      setShowConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep("phone");
    setPhone("");
    setPhoneError("");
    setEmployee(null);
    setBranchInfo(null);
    setJenis("tahunan");
    setTglTerpilih([]);
    setAlasan("");
    setHasil(null);
    setCutiPreview([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500 px-4 py-10 text-white">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur shadow-lg">
            <CalendarDays className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Permohonan Cuti</h1>
          <p className="mt-1 text-sm text-emerald-50/90">
            Isi data di bawah untuk mengajukan cuti atau izin. Persetujuan dikirim via WhatsApp.
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-lg px-4 pb-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          {step === "phone" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Cek Akun Anda</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Masukkan nomor WhatsApp yang terdaftar di perusahaan (contoh: 081234567890).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="phone"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Nomor WhatsApp
                </Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="08xxxxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && cariAkun()}
                    className="h-12 rounded-xl pl-10 text-base"
                  />
                </div>
                {phoneError && <p className="text-xs font-medium text-rose-600">{phoneError}</p>}
              </div>

              <Button
                onClick={cariAkun}
                disabled={isSearching}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] transition-all"
              >
                {isSearching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
                {isSearching ? "Memeriksa..." : "Lanjutkan"}
              </Button>
            </div>
          )}

          {step === "form" && employee && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Form Permohonan</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Diverifikasi untuk{" "}
                    <span className="font-semibold text-emerald-700">{employee.nama}</span>
                    <span className="ml-1 text-xs text-slate-400">
                      ({maskPhone(employee.whatsapp)})
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setEmployee(null);
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                >
                  Ganti nomor
                </button>
              </div>

              {/* Info kuota */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs leading-relaxed text-emerald-900">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Info className="h-3.5 w-3.5" /> Aturan kuota cuti per hari
                  {branchInfo && (
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                      {branchInfo.nama}
                    </span>
                  )}
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-emerald-800">
                  <li>
                    Hari kerja (Senin–Jumat): maksimal {branchInfo?.kuota_cuti_hari_kerja ?? 2}{" "}
                    orang.
                  </li>
                  <li>
                    Sabtu &amp; Minggu: maksimal {branchInfo?.kuota_cuti_akhir_pekan ?? 1} orang.
                  </li>
                  <li>Prioritas diberikan kepada pengaju lebih dulu.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Jenis Cuti <span className="text-rose-500">*</span>
                </Label>
                <Select value={jenis} onValueChange={setJenis}>
                  <SelectTrigger className="h-12 rounded-xl">
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

              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Klik tanggal untuk memilih cuti Anda
              </Label>
              <div className="space-y-2">
                  {/* Navigasi bulan */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (calMonth === 0) {
                            setCalMonth(11);
                            setCalYear(calYear - 1);
                          } else {
                            setCalMonth(calMonth - 1);
                          }
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <div className="min-w-[120px] text-center">
                        <p className="text-sm font-bold text-slate-800">
                          {BULAN_PANJANG[calMonth]} {calYear}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (calMonth === 11) {
                            setCalMonth(0);
                            setCalYear(calYear + 1);
                          } else {
                            setCalMonth(calMonth + 1);
                          }
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCalMonth(new Date().getMonth());
                        setCalYear(new Date().getFullYear());
                      }}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      Bulan Ini
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((h, i) => (
                      <div
                        key={h}
                        className={`text-center text-[10px] font-bold uppercase tracking-wider ${
                          i >= 5 ? "text-rose-400" : "text-slate-400"
                        }`}
                      >
                        {h}
                      </div>
                    ))}
                    {(() => {
                      const firstDay = new Date(calYear, calMonth, 1);
                      const startWeekday = (firstDay.getDay() + 6) % 7;
                      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                      const cells: (number | null)[] = [];
                      for (let i = 0; i < startWeekday; i++) cells.push(null);
                      for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                      while (cells.length % 7 !== 0) cells.push(null);

                      // Build map of cuti dates for preview with employee names
                      const cutiDateMap: Record<string, { nama: string; jenis: string; status: string; empId: string }[]> = {};
                      cutiPreview.forEach((c) => {
                        const s = new Date(`${c.tanggal_mulai}T00:00:00`);
                        const e = new Date(`${c.tanggal_selesai}T00:00:00`);
                        const mStart = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
                        const mEnd = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(
                          new Date(calYear, calMonth + 1, 0).getDate(),
                        ).padStart(2, "0")}`;
                        const nama = c.employees?.nama || "-";
                        for (let d2 = new Date(s); d2 <= e; d2.setDate(d2.getDate() + 1)) {
                          const key = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}-${String(d2.getDate()).padStart(2, "0")}`;
                          if (key >= mStart && key <= mEnd) {
                            if (!cutiDateMap[key]) cutiDateMap[key] = [];
                            // Dedup: skip if same employee already listed for this date
                            const alreadyListed = cutiDateMap[key].some((x) => x.nama === nama && x.jenis === c.jenis);
                            if (!alreadyListed) {
                              cutiDateMap[key].push({ nama, jenis: c.jenis, status: c.status, empId: c.employee_id });
                            }
                          }
                        }
                      });

                      return cells.map((day, i) => {
                        if (day === null) return <div key={i} className="min-h-[52px] rounded-lg border border-slate-50 bg-slate-50/30" />;
                        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const isPast = dateStr < todayLocalISO();
                        const isSelected = tglTerpilih.includes(dateStr);
                        const isSunday = i % 7 === 6;
                        const dayCuti = cutiDateMap[dateStr];
                        const hasCuti = dayCuti && dayCuti.length > 0;
                        const seenNames = new Set<string>();
                        const uniqueCuti = hasCuti ? dayCuti.filter((c) => {
                          const k = c.nama + "|" + c.jenis;
                          if (seenNames.has(k)) return false;
                          seenNames.add(k);
                          return true;
                        }) : [];
                        return (
                          <div
                            key={i}
                            className={`relative min-h-[52px] rounded-lg border p-1 transition-colors ${
                              isSelected
                                ? "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200"
                                : "border-slate-100 bg-white hover:bg-emerald-50/40"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                disabled={isPast}
                                onClick={() => setDetailDate(dateStr)}
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all active:scale-95 ${
                                  isPast
                                    ? "cursor-not-allowed text-slate-300"
                                    : isSelected
                                      ? "bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-sm shadow-emerald-500/20"
                                      : "text-slate-600 hover:bg-emerald-100"
                                } ${isSunday && !isSelected ? "text-rose-500" : ""}`}
                              >
                                {day}
                              </button>
                              {uniqueCuti.length > 0 && (
                                <span className="text-[9px] font-bold text-slate-400">
                                  {uniqueCuti.length}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 space-y-0.5">
                              {uniqueCuti.slice(0, 3).map((c, ci) => {
                                const jc = getJenisCuti(c.jenis);
                                const isOwn = c.empId === employee?.id;
                                return (
                                  <div
                                    key={ci}
                                    className={`flex items-center gap-0.5 truncate rounded px-1 py-px text-[9px] font-medium ${
                                      isOwn
                                        ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                                        : jc.bg
                                    }`}
                                    title={`${c.nama} — ${jc.label} (${c.status === "disetujui" ? "Disetujui" : "Diajukan"})`}
                                  >
                                    <span className={`h-1 w-1 shrink-0 rounded-full ${isOwn ? "bg-emerald-500" : jc.dot}`} />
                                    <span className="truncate">{isOwn ? "👤 Anda" : c.nama}</span>
                                  </div>
                                );
                              })}
                              {uniqueCuti.length > 3 && (
                                <p className="px-1 text-[8px] font-bold text-slate-400">
                                  +{uniqueCuti.length - 3} lainnya
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Legenda */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                    {JENIS_CUTI.slice(0, 4).map((j) => (
                      <span key={j.value} className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${j.dot}`} /> {j.label}
                      </span>
                    ))}
                    <span className="flex items-center gap-1">
                      <span className="h-4 w-4 rounded border border-emerald-300 bg-emerald-100 text-[7px] font-bold text-emerald-800 flex items-center justify-center">👤</span>
                      Anda
                    </span>
                  </div>
                  {tglTerpilih.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500">
                        Terpilih {tglTerpilih.length} hari:
                      </span>
                      {tglTerpilih.map((t) => {
                        const d = new Date(`${t}T00:00:00`);
                        return (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"
                          >
                            {d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                            <button
                              type="button"
                              onClick={() => toggleTanggal(t)}
                              className="text-emerald-500 hover:text-emerald-700"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {jumlahHari > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{jumlahHari} hari</span>
                  <span className="text-slate-300">•</span>
                  <span>{tanggalTerpakai.map((t) => getKuotaLabel(t)).join(", ")}</span>
                </div>
              )}

              {/* Ringkasan periode: tanggal berapa saja yang diminta */}
              {jumlahHari > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Periode Permohonan — {jumlahHari} hari
                    </p>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {formatTanggalHR(tanggalTerpakai[0])} s/d{" "}
                      {formatTanggalHR(tanggalTerpakai[tanggalTerpakai.length - 1])}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tanggalTerpakai.map((t) => {
                      const d = new Date(`${t}T00:00:00`);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <span
                          key={t}
                          className={`inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                            isWeekend
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-emerald-200 bg-white text-slate-700"
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
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Alasan{" "}
                  {jenis === "izin" ? (
                    <span className="text-rose-500">(wajib untuk izin)</span>
                  ) : (
                    "(opsional)"
                  )}
                </Label>
                <Textarea
                  rows={4}
                  placeholder="Tuliskan alasan permohonan cuti/izin Anda..."
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="h-12 flex-1 rounded-xl"
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Batal
                </Button>
                <Button
                  onClick={kirimPermohonan}
                  disabled={isSubmitting}
                  className="h-12 flex-[2] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                  {isSubmitting ? "Mengirim..." : "Kirim Permohonan"}
                </Button>
              </div>
            </div>
          )}

          {step === "done" && hasil && (
            <div className="space-y-5 text-center">
              {hasil.status === "diajukan" && (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Permohonan Terkirim</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Permohonan cuti{" "}
                      <span className="font-semibold">{getJenisCuti(jenis).label}</span> Anda (
                      {jumlahHari} hari) sedang{" "}
                      <span className="font-semibold text-amber-600">menunggu persetujuan</span>{" "}
                      admin.
                      <br />
                      Status akan dikonfirmasi melalui WhatsApp.
                    </p>
                    {tanggalTerpakai.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                        {tanggalTerpakai.map((t) => {
                          const d = new Date(`${t}T00:00:00`);
                          return (
                            <span
                              key={t}
                              className="inline-flex items-center rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-slate-700"
                            >
                              {d.toLocaleDateString("id-ID", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {hasil.status === "ditolak" && (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
                    <XCircle className="h-9 w-9 text-rose-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Ditolak Otomatis</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Mohon maaf, permohonan cuti Anda{" "}
                      <span className="font-semibold text-rose-600">ditolak otomatis</span> karena
                      kuota harian sudah penuh.
                    </p>
                    <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-left text-xs text-slate-600">
                      {hasil.alasan}
                    </p>
                  </div>
                </>
              )}

              {hasil.status === "error" && (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                    <Info className="h-9 w-9 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Permohonan Tidak Dikirim</h2>
                    <p className="mt-1 text-sm text-slate-500">{hasil.alasan}</p>
                  </div>
                </>
              )}

              <Button
                onClick={resetForm}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-semibold shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] transition-all"
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Buat Permohonan Baru
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Dibuat otomatis oleh sistem penggajian — hubungi admin untuk pertanyaan.
        </p>

        {/* Day Detail Popup */}
        <Dialog open={!!detailDate} onOpenChange={(open) => !open && setDetailDate(null)}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {detailDate ? (
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-emerald-600" />
                    {formatTanggalHR(detailDate)}
                  </span>
                ) : null}
              </DialogTitle>
            </DialogHeader>
            {detailDate && (
              <DayDetailBody
                detailDate={detailDate}
                cutiPreview={cutiPreview}
                employeeId={employee?.id}
                isSelected={tglTerpilih.includes(detailDate)}
                onToggle={toggleTanggal}
              />
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-bold text-slate-900">
                Konfirmasi Permohonan Cuti
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 text-left">
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{employee?.nama}</p>
                  <p className="mt-1 text-xs text-slate-600">{employee?.whatsapp}</p>
                </div>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-semibold text-slate-700">Jenis:</span>{" "}
                    {getJenisCuti(jenis).label}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Tanggal:</span> {jumlahHari} hari
                    ({tanggalTerpakai[0] ? formatTanggalHR(tanggalTerpakai[0]) : "?"} s/d{" "}
                    {tanggalTerpakai[tanggalTerpakai.length - 1]
                      ? formatTanggalHR(tanggalTerpakai[tanggalTerpakai.length - 1])
                      : "?"})
                  </p>
                  {alasan && (
                    <p>
                      <span className="font-semibold text-slate-700">Alasan:</span> {alasan}
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Permohonan ini akan dikirim ke admin untuk diverifikasi. Hasil persetujuan akan
                  dikirim via WhatsApp.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={isSubmitting}
                onClick={prosesSimpanPermohonan}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Kirim Permohonan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </main>
    </div>
  );
}
