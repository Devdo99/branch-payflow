// ============================================================================
// Helper untuk modul Jadwal Kerja & Istirahat Karyawan (HR)
// ============================================================================

export type JenisJadwal = "kerja" | "istirahat";

export const JENIS_JADWAL: {
  value: JenisJadwal;
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}[] = [
  {
    value: "kerja",
    label: "Kerja",
    color: "#10b981",
    bg: "bg-emerald-100 text-emerald-900",
    border: "border-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    value: "istirahat",
    label: "Istirahat",
    color: "#f59e0b",
    bg: "bg-amber-100 text-amber-900",
    border: "border-amber-300",
    dot: "bg-amber-500",
  },
];

export const getJenisJadwal = (value?: string | null): (typeof JENIS_JADWAL)[number] =>
  JENIS_JADWAL.find((j) => j.value === value) || JENIS_JADWAL[0];

// Urutan hari Senin..Minggu (0=Senin .. 6=Minggu) — konsisten dengan HARI_PENDEK
export const HARI_JADWAL = [
  { hari: 0, pendek: "Sen", panjang: "Senin" },
  { hari: 1, pendek: "Sel", panjang: "Selasa" },
  { hari: 2, pendek: "Rab", panjang: "Rabu" },
  { hari: 3, pendek: "Kam", panjang: "Kamis" },
  { hari: 4, pendek: "Jum", panjang: "Jumat" },
  { hari: 5, pendek: "Sab", panjang: "Sabtu" },
  { hari: 6, pendek: "Min", panjang: "Minggu" },
];

export const getNamaHari = (hari: number) =>
  HARI_JADWAL.find((h) => h.hari === hari)?.panjang || "?";

/** Format jam "08:00:00" -> "08:00" */
export const formatJam = (t?: string | null) => (t ? t.slice(0, 5) : "-");

/** "08:00" -> "08:00:00" (TIME Postgres) */
export const toTime = (t: string) => (t ? `${t}:00` : t);

/** Warna preset untuk blok jadwal */
export const WARNA_JADWAL = [
  "#10b981", // emerald
  "#0ea5e9", // sky
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#f97316", // orange
  "#f43f5e", // rose
  "#64748b", // slate
];
