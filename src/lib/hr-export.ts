import { jsPDF } from "jspdf";
import { toast } from "sonner";

export const safeFileName = (value: unknown) =>
  String(value || "Laporan")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .trim();

/**
 * Download CSV yang bisa dibuka di Excel (dengan BOM UTF-8).
 */
export function downloadCSV(
  fileName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((val) => {
          const str = String(val ?? "");
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("File Excel berhasil diunduh");
}

/**
 * Buat PDF tabel sederhana dengan jsPDF (portrait A4).
 * Column widths dibagi proporsional berdasarkan jumlah kolom.
 */
export function downloadPDFTable(
  fileName: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const accent: [number, number, number] = [16, 101, 52];
  const muted: [number, number, number] = [100, 116, 139];

  // Header
  pdf.setFillColor(accent[0], accent[1], accent[2]);
  pdf.roundedRect(margin, 16, contentWidth, 26, 3, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(title, margin + 6, 28);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(220, 252, 231);
  pdf.text(subtitle, margin + 6, 36);

  let y = 54;
  const rowHeight = 7;

  const colWidths = headers.map(() => contentWidth / headers.length);

  const drawHeader = () => {
    pdf.setFillColor(240, 253, 244);
    pdf.rect(margin, y - 5.5, contentWidth, rowHeight, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(accent[0], accent[1], accent[2]);
    let x = margin;
    headers.forEach((h, i) => {
      pdf.text(h, x + 2, y, { maxWidth: colWidths[i] - 4 });
      x += colWidths[i];
    });
    y += rowHeight;
  };

  drawHeader();

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(30, 41, 59);

  rows.forEach((row) => {
    if (y > pageHeight - 20) {
      pdf.addPage();
      y = 20;
      drawHeader();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);
    }
    let x = margin;
    row.forEach((val, i) => {
      const str = String(val ?? "");
      pdf.text(str, x + 2, y, { maxWidth: colWidths[i] - 4 });
      x += colWidths[i];
    });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + 2.5, pageWidth - margin, y + 2.5);
    y += rowHeight;
  });

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(muted[0], muted[1], muted[2]);
  pdf.text("Dokumen ini dibuat otomatis dari sistem PayFlow HR.", margin, pageHeight - 8);
  pdf.text(
    new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    pageWidth - margin,
    pageHeight - 8,
    { align: "right" },
  );

  pdf.save(fileName);
  toast.success("File PDF berhasil diunduh");
}
