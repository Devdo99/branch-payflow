import { getJenisCuti, formatTanggalHR } from "./hr";

/**
 * Aturan kuota cuti per hari (default fallback jika tidak ada data dari cabang):
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

/**
 * Dapatkan kuota maksimal per hari. Gunakan nilai dari cabang jika tersedia,
 * fallback ke konstanta default.
 */
export function getKuotaMax(dateStr: string, branchKuota?: { hariKerja: number; akhirPekan: number }): number {
  if (branchKuota) {
    return isAkhirPekan(dateStr) ? branchKuota.akhirPekan : branchKuota.hariKerja;
  }
  return isAkhirPekan(dateStr) ? KUOTA_CUTI.akhirPekan : KUOTA_CUTI.hariKerja;
}

export function getKuotaLabel(dateStr: string, branchKuota?: { hariKerja: number; akhirPekan: number }): string {
  const max = getKuotaMax(dateStr, branchKuota);
  return isAkhirPekan(dateStr) ? `Sabtu/Minggu (maks ${max} orang)` : `Hari kerja (maks ${max} orang)`;
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

/** Format daftar tanggal untuk pesan: "1 Jan, 6 Jan, 7-8 Jan" atau "1-8 Jan" */
export function formatPeriodeList(tanggalList: string[]): string {
  if (!tanggalList || tanggalList.length === 0) return "-";
  if (tanggalList.length === 1) return formatTanggalHR(tanggalList[0]);

  // Cek apakah membentuk range berurutan penuh
  const sorted = [...tanggalList].sort();
  const isConsecutive = sorted.every((t, i) => {
    if (i === 0) return true;
    const prev = new Date(`${sorted[i - 1]}T00:00:00`);
    const curr = new Date(`${t}T00:00:00`);
    return (curr.getTime() - prev.getTime()) / 86400000 === 1;
  });

  if (isConsecutive) {
    return `${formatTanggalHR(sorted[0])} s/d ${formatTanggalHR(sorted[sorted.length - 1])}`;
  }

  // Tanggal terpisah: format pendek
  return sorted
    .map((t) => {
      const d = new Date(`${t}T00:00:00`);
      return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    })
    .join(", ");
}

export function buildCutiApprovedMessage(
  emp: EmployeeInfo,
  c: CutiInfo & { tanggal_list?: string[] | null },
): string {
  const jenis = getJenisCuti(c.jenis).label;
  const periode = c.tanggal_list
    ? formatPeriodeList(c.tanggal_list)
    : `${formatTanggalHR(c.tanggal_mulai)} s/d ${formatTanggalHR(c.tanggal_selesai)}`;
  const lines = [
    `Halo ${emp.nama || "Karyawan"},`,
    "",
    `Permohonan cuti *${jenis}* Anda (${periode}) telah *DISETUJUI*.`,
  ];
  if (c.alasan) lines.push(`Keterangan: ${c.alasan}`);
  lines.push("", "Terima kasih 🙏");
  return lines.join("\n");
}

export function buildCutiRejectedMessage(
  emp: EmployeeInfo,
  c: CutiInfo & { tanggal_list?: string[] | null },
): string {
  const jenis = getJenisCuti(c.jenis).label;
  const periode = c.tanggal_list
    ? formatPeriodeList(c.tanggal_list)
    : `${formatTanggalHR(c.tanggal_mulai)} s/d ${formatTanggalHR(c.tanggal_selesai)}`;
  const lines = [
    `Halo ${emp.nama || "Karyawan"},`,
    "",
    `Mohon maaf, permohonan cuti *${jenis}* Anda (${periode}) *DITOLAK*.`,
  ];
  if (c.alasan) lines.push(`Alasan: ${c.alasan}`);
  lines.push("", "Terima kasih.");
  return lines.join("\n");
}

export type KalenderCutiItem = {
  tanggal: string; // YYYY-MM-DD
  nama: string;
  jenis: string; // nilai mentah jenis cuti
  status: string; // diajukan | disetujui | ditolak
};

/**
 * Bangun pesan ringkasan jadwal cuti untuk dibagikan ke grup WhatsApp.
 * Dikelompokkan per tanggal, dengan penanda status cuti.
 */
export function buildKalenderCutiMessage(opts: {
  bulan: string;
  tahun: number;
  cabang: string;
  items: KalenderCutiItem[];
}): string {
  const { bulan, tahun, cabang, items } = opts;
  const lines: string[] = [];
  lines.push(`*JADWAL CUTI ${bulan.toUpperCase()} ${tahun}*`);
  lines.push(`Cabang: ${cabang}`);

  if (items.length === 0) {
    lines.push("", "Tidak ada jadwal cuti pada bulan ini. 🎉");
    return lines.join("\n");
  }

  const byDate = new Map<string, KalenderCutiItem[]>();
  for (const it of items) {
    const arr = byDate.get(it.tanggal) || [];
    arr.push(it);
    byDate.set(it.tanggal, arr);
  }

  const orangSet = new Set<string>();
  for (const tgl of [...byDate.keys()].sort()) {
    const arr = byDate.get(tgl)!;
    const labelTanggal = formatTanggalHR(tgl);
    const labelHari = isAkhirPekan(tgl) ? "Sabtu/Minggu" : "Hari kerja";
    lines.push("", `📅 ${labelTanggal} (${labelHari})`);
    for (const it of arr) {
      const jenis = getJenisCuti(it.jenis).label;
      const mark =
        it.status === "disetujui"
          ? "✅ Disetujui"
          : it.status === "ditolak"
            ? "❌ Ditolak"
            : "⏳ Diajukan";
      lines.push(`• ${it.nama} — ${jenis} (${mark})`);
      orangSet.add(it.nama);
    }
  }

  lines.push(
    "",
    `Total: ${orangSet.size} karyawan • ${items.length} catatan cuti`,
    "",
    "_Dikirim otomatis dari sistem PayFlow._",
  );
  return lines.join("\n");
}
