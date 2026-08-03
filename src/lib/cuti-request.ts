import { getJenisCuti, formatTanggalHR } from "./hr";

/**
 * Aturan kuota cuti per hari:
 * - Hari kerja (Senin–Jumat): maksimal 2 orang
 * - Sabtu & Minggu: maksimal 1 orang
 */
export const KUOTA_CUTI = {
  hariKerja: 2,
  akhirPekan: 1,
} as const;

export function isAkhirPekan(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getDay(); // 0 = Minggu, 6 = Sabtu
  return day === 0 || day === 6;
}

export function getKuotaMax(dateStr: string): number {
  return isAkhirPekan(dateStr) ? KUOTA_CUTI.akhirPekan : KUOTA_CUTI.hariKerja;
}

export function getKuotaLabel(dateStr: string): string {
  return isAkhirPekan(dateStr) ? "Sabtu/Minggu (maks 1 orang)" : "Hari kerja (maks 2 orang)";
}

/** Daftar semua tanggal (YYYY-MM-DD) dalam rentang mulai–selesai (inklusif). */
export function enumerateDates(mulai: string, selesai: string): string[] {
  const start = new Date(`${mulai}T00:00:00`);
  const end = new Date(`${selesai}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(toISO(d));
  }
  return dates;
}

function toISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Masking nomor untuk tampilan, mis. 0812****1234 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return "-";
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 6) return digits;
  return `${digits.slice(0, 4)}****${digits.slice(-4)}`;
}

type EmployeeInfo = { nama?: string | null };
type CutiInfo = {
  jenis: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  alasan?: string | null;
};

export function buildCutiApprovedMessage(emp: EmployeeInfo, c: CutiInfo): string {
  const jenis = getJenisCuti(c.jenis).label;
  const periode = `${formatTanggalHR(c.tanggal_mulai)} s/d ${formatTanggalHR(c.tanggal_selesai)}`;
  const lines = [
    `Halo ${emp.nama || "Karyawan"},`,
    "",
    `Permohonan cuti *${jenis}* Anda (${periode}) telah *DISETUJUI*.`,
  ];
  if (c.alasan) lines.push(`Keterangan: ${c.alasan}`);
  lines.push("", "Terima kasih 🙏");
  return lines.join("\n");
}

export function buildCutiRejectedMessage(emp: EmployeeInfo, c: CutiInfo): string {
  const jenis = getJenisCuti(c.jenis).label;
  const periode = `${formatTanggalHR(c.tanggal_mulai)} s/d ${formatTanggalHR(c.tanggal_selesai)}`;
  const lines = [
    `Halo ${emp.nama || "Karyawan"},`,
    "",
    `Mohon maaf, permohonan cuti *${jenis}* Anda (${periode}) *DITOLAK*.`,
  ];
  if (c.alasan) lines.push(`Alasan: ${c.alasan}`);
  lines.push("", "Terima kasih.");
  return lines.join("\n");
}
