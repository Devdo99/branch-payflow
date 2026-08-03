export function formatIDR(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatPeriode(yyyymm: string | null | undefined): string {
  if (!yyyymm) return "-";
  const [y, m] = yyyymm.split("-");
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${months[Number(m) - 1] ?? m} ${y}`;
}

export function currentPeriode(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatNumberDots(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  // Strip non-digits to handle existing dots or formatted strings
  const cleanValue = String(value).replace(/\D/g, "");
  if (!cleanValue) return "";
  const num = parseInt(cleanValue, 10);
  return num.toLocaleString("id-ID");
}

export function parseNumberDots(value: string): number {
  if (!value) return 0;
  const cleanValue = value.replace(/\./g, "");
  const num = parseInt(cleanValue, 10);
  return isNaN(num) ? 0 : num;
}
