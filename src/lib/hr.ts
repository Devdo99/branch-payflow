export const JENIS_CUTI: { value: string; label: string; color: string; bg: string; dot: string }[] = [
  { value: "tahunan", label: "Cuti Tahunan", color: "#10b981", bg: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  { value: "sakit", label: "Cuti Sakit", color: "#f43f5e", bg: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-500" },
  { value: "izin", label: "Cuti Izin", color: "#f59e0b", bg: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  { value: "besar", label: "Cuti Besar", color: "#8b5cf6", bg: "bg-violet-100 text-violet-800 border-violet-200", dot: "bg-violet-500" },
  { value: "melahirkan", label: "Cuti Melahirkan", color: "#0ea5e9", bg: "bg-sky-100 text-sky-800 border-sky-200", dot: "bg-sky-500" },
  { value: "lainnya", label: "Cuti Lainnya", color: "#64748b", bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" },
];

export const getJenisCuti = (value?: string | null) =>
  JENIS_CUTI.find((j) => j.value === value) || { ...JENIS_CUTI[JENIS_CUTI.length - 1], label: value || "Lainnya" };

export const STATUS_CUTI: { value: string; label: string; variant: "secondary" | "default" | "destructive" }[] = [
  { value: "diajukan", label: "Diajukan", variant: "secondary" },
  { value: "disetujui", label: "Disetujui", variant: "default" },
  { value: "ditolak", label: "Ditolak", variant: "destructive" },
];

export const getStatusCuti = (value?: string | null) =>
  STATUS_CUTI.find((s) => s.value === value) || { value: value || "diajukan", label: value || "Diajukan", variant: "secondary" as const };

// Status absensi — sesuai kebutuhan user: Hadir, Izin Masuk, Sakit, Telat, Absen, Resign
export const STATUS_ABSEN: { value: string; label: string; short: string; color: string; bg: string; dot: string }[] = [
  { value: "hadir", label: "Hadir", short: "H", color: "#10b981", bg: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  { value: "izin_masuk", label: "Izin Masuk", short: "IM", color: "#f59e0b", bg: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  { value: "sakit", label: "Sakit", short: "S", color: "#f43f5e", bg: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-500" },
  { value: "telat", label: "Telat", short: "T", color: "#f97316", bg: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  { value: "absen", label: "Absen", short: "A", color: "#ef4444", bg: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  { value: "resign", label: "Resign", short: "R", color: "#8b5cf6", bg: "bg-violet-100 text-violet-800 border-violet-200", dot: "bg-violet-500" },
];

export const getStatusAbsen = (value?: string | null) =>
  STATUS_ABSEN.find((s) => s.value === value) || {
    value: value || "hadir",
    label: value || "Hadir",
    short: "-",
    color: "#94a3b8",
    bg: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  };

export const BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export const BULAN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Urutan hari dimulai Senin — sesuai grid kalender (startWeekday = (getDay()+6)%7)
export const HARI_PENDEK = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export const formatTanggalHR = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

export const toISODate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export const countDays = (start: string, end: string) => {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
};
