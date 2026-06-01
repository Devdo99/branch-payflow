import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { Download, FileDown, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const Route = createFileRoute("/_authenticated/laporan")({
  component: LaporanPage,
});

const BULAN_LABELS: Record<string, string> = {
  "01": "Januari",
  "02": "Februari",
  "03": "Maret",
  "04": "April",
  "05": "Mei",
  "06": "Juni",
  "07": "Juli",
  "08": "Agustus",
  "09": "September",
  "10": "Oktober",
  "11": "November",
  "12": "Desember",
};

const getPeriodeRange = (year: number, month: string) => {
  if (month === "all") {
    return {
      start: `${year}-01`,
      end: `${year + 1}-01`,
    };
  }

  const normalizedMonth = String(month).padStart(2, "0");
  const monthNumber = Number(normalizedMonth);
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const nextYear = monthNumber === 12 ? year + 1 : year;

  return {
    start: `${year}-${normalizedMonth}`,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}`,
  };
};

const safeFileName = (value: unknown) => {
  return String(value || "Rincian_Gaji")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .trim();
};

type Branch = {
  id: string;
  nama: string;
};

type Employee = {
  id?: string;
  nama?: string;
  jabatan?: string;
  branch_id?: string;
  nama_bank?: string;
  nomor_rekening?: string;
  branches?: Branch | null;
};

type PayrollRun = {
  id?: string;
  periode?: string;
  status?: string;
  branch_id?: string | null;
};

type PayrollItem = {
  id?: string;
  payroll_runs?: PayrollRun | null;
  employees?: Employee | null;
  gaji_pokok?: number;
  total_tunjangan?: number;
  total_potongan?: number;
  gaji_bersih?: number;
  jumlah_hari?: number;
  jumlah_izin?: number;
  jumlah_absen?: number;
  jumlah_telat?: number;
  kasbon?: number;
  bonus_manual?: number;
  catatan?: string;
  payroll_item_allowances?: Array<{
    nama?: string;
    subtotal?: number;
    nominal?: number;
    jumlah?: number;
  }>;
  payroll_item_deductions?: Array<{
    nama?: string;
    subtotal?: number;
    nominal?: number;
    jumlah?: number;
  }>;
};

type PayrollReportRun = {
  id: string;
  periode: string;
  status?: string;
  items: PayrollItem[];
  total_karyawan: number;
  sum_gaji_pokok: number;
  sum_tunjangan: number;
  sum_potongan: number;
  sum_thp: number;
};

type EmployeeSummary = {
  id: string;
  nama: string;
  nama_bank: string;
  nomor_rekening: string;
  total_gaji: number;
};

type ComponentItem = {
  payroll_item_id?: string;
  nama?: string;
  subtotal?: number;
  nominal?: number;
  jumlah?: number;
};

type DetailRow = {
  id: string;
  periode: string;
  nama: string;
  jabatan: string;
  branch_id: string | null;
  nama_bank: string;
  nomor_rekening: string;
  gaji_pokok: number;
  total_tunjangan: number;
  total_potongan: number;
  gaji_bersih: number;
  jumlah_hari: number;
  jumlah_izin: number;
  jumlah_absen: number;
  jumlah_telat: number;
  kasbon: number;
  bonus_manual: number;
  catatan: string;
  allowances: ComponentItem[];
  deductions: ComponentItem[];
};

const toNumber = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getComponentRows = (items: ComponentItem[], fallbackLabel: string, fallbackValue: number) => {
  if (items.length > 0) {
    return items.map((item) => ({
      label: item.nama || fallbackLabel,
      value: toNumber(item.subtotal ?? item.nominal ?? item.jumlah),
    }));
  }

  return fallbackValue > 0 ? [{ label: fallbackLabel, value: fallbackValue }] : [];
};

const isMissingComponentTableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: string }).code : "";
  return code === "PGRST200" || code === "PGRST205";
};

function LaporanPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedCabang, setSelectedCabang] = useState<string>("all");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingDetailId, setDownloadingDetailId] = useState<string | null>(null);
  const [hasLoadedDefaultFilters, setHasLoadedDefaultFilters] = useState(false);

  // 1. Fetch Daftar Cabang untuk filter
  const { data: cabangList = [] } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").order("nama");
      return (data || []) as Branch[];
    },
  });

  const { data: latestPayrollRun = null } = useQuery<PayrollRun | null>({
    queryKey: ["latest_payroll_run"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("id, periode, branch_id")
        .order("periode", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  useEffect(() => {
    if (latestPayrollRun && !hasLoadedDefaultFilters) {
      const [year, month] = (latestPayrollRun.periode || "").split("-");
      if (year && month) {
        setSelectedYear(Number(year));
        setSelectedMonth(String(month).padStart(2, "0"));
      }
      setSelectedCabang(latestPayrollRun.branch_id || "all");
      setHasLoadedDefaultFilters(true);
    }
  }, [latestPayrollRun, hasLoadedDefaultFilters]);

  // 2. Fetch data payroll
  const { data: reportData, isLoading } = useQuery<PayrollReportRun[]>({
    queryKey: ["payroll_report", selectedYear, selectedMonth, selectedCabang],
    queryFn: async () => {
      const periodeRange = getPeriodeRange(selectedYear, selectedMonth);
      const { data, error } = await supabase.from("payroll_items").select(`
          *,
          payroll_runs (*),
          employees (*, branches (*))
        `);

      if (error) throw error;

      const payrollItems = (data || []) as PayrollItem[];

      const filteredItems = payrollItems.filter((item: PayrollItem) => {
        const periode = item.payroll_runs?.periode || "";
        const matchesPeriod = periode >= periodeRange.start && periode < periodeRange.end;
        const runBranchId = item.payroll_runs?.branch_id;
        const matchesBranch = selectedCabang === "all" || runBranchId === selectedCabang;

        return matchesPeriod && matchesBranch;
      });

      const payrollItemIds = filteredItems
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id));

      let itemsWithComponents = filteredItems;

      if (payrollItemIds.length > 0) {
        const [
          { data: allowanceRows, error: allowanceError },
          { data: deductionRows, error: deductionError },
        ] = await Promise.all([
          supabase
            .from("payroll_item_allowances")
            .select("*")
            .in("payroll_item_id", payrollItemIds),
          supabase
            .from("payroll_item_deductions")
            .select("*")
            .in("payroll_item_id", payrollItemIds),
        ]);

        if (allowanceError && !isMissingComponentTableError(allowanceError)) {
          throw allowanceError;
        }
        if (deductionError && !isMissingComponentTableError(deductionError)) {
          throw deductionError;
        }

        const allowancesByItem = (
          allowanceError ? [] : ((allowanceRows || []) as ComponentItem[])
        ).reduce(
          (
            acc: Record<string, ComponentItem[]>,
            row: ComponentItem & { payroll_item_id?: string },
          ) => {
            if (!row.payroll_item_id) return acc;
            acc[row.payroll_item_id] = [...(acc[row.payroll_item_id] || []), row];
            return acc;
          },
          {},
        );

        const deductionsByItem = (
          deductionError ? [] : ((deductionRows || []) as ComponentItem[])
        ).reduce(
          (
            acc: Record<string, ComponentItem[]>,
            row: ComponentItem & { payroll_item_id?: string },
          ) => {
            if (!row.payroll_item_id) return acc;
            acc[row.payroll_item_id] = [...(acc[row.payroll_item_id] || []), row];
            return acc;
          },
          {},
        );

        itemsWithComponents = filteredItems.map((item) => ({
          ...item,
          payroll_item_allowances: item.id ? allowancesByItem[item.id] || [] : [],
          payroll_item_deductions: item.id ? deductionsByItem[item.id] || [] : [],
        }));
      }

      const groupedRuns = itemsWithComponents.reduce(
        (acc: Record<string, PayrollReportRun>, item: PayrollItem) => {
          const run = item.payroll_runs;
          if (!run?.id) return acc;

          if (!acc[run.id]) {
            acc[run.id] = {
              id: run.id,
              periode: run.periode || "",
              status: run.status,
              items: [],
              total_karyawan: 0,
              sum_gaji_pokok: 0,
              sum_tunjangan: 0,
              sum_potongan: 0,
              sum_thp: 0,
            };
          }

          acc[run.id].items.push(item);
          return acc;
        },
        {} as Record<string, PayrollReportRun>,
      );

      return Object.values(groupedRuns)
        .map((run) => {
          const items = run.items || [];

          return {
            id: run.id,
            periode: run.periode,
            status: run.status,
            items,
            total_karyawan: items.length,
            sum_gaji_pokok: items.reduce(
              (acc: number, curr: PayrollItem) => acc + (curr.gaji_pokok || 0),
              0,
            ),
            sum_tunjangan: items.reduce(
              (acc: number, curr: PayrollItem) => acc + (curr.total_tunjangan || 0),
              0,
            ),
            sum_potongan: items.reduce(
              (acc: number, curr: PayrollItem) => acc + (curr.total_potongan || 0),
              0,
            ),
            sum_thp: items.reduce(
              (acc: number, curr: PayrollItem) => acc + (curr.gaji_bersih || 0),
              0,
            ),
          };
        })
        .sort((a, b) => a.periode.localeCompare(b.periode));
    },
  });

  const grandTotal = reportData?.reduce(
    (acc, curr) => {
      acc.thp += curr.sum_thp;
      acc.gaji_pokok += curr.sum_gaji_pokok;
      acc.tunjangan += curr.sum_tunjangan;
      acc.potongan += curr.sum_potongan;
      return acc;
    },
    { thp: 0, gaji_pokok: 0, tunjangan: 0, potongan: 0 },
  ) || { thp: 0, gaji_pokok: 0, tunjangan: 0, potongan: 0 };

  const employeeSummaries = (reportData ?? [])
    .flatMap((run) => run.items || [])
    .reduce(
      (acc: Record<string, EmployeeSummary>, item: PayrollItem) => {
        const employee = item.employees;
        if (!employee?.id) return acc;

        if (!acc[employee.id]) {
          acc[employee.id] = {
            id: employee.id,
            nama: employee.nama || "-",
            nama_bank: employee.nama_bank || "-",
            nomor_rekening: employee.nomor_rekening || "-",
            total_gaji: 0,
          };
        }

        acc[employee.id].total_gaji += item.gaji_bersih || 0;
        return acc;
      },
      {} as Record<string, EmployeeSummary>,
    );

  const employeeSummaryList = Object.values(employeeSummaries).sort((a, b) =>
    a.nama.localeCompare(b.nama),
  );

  const detailRows = (reportData ?? [])
    .flatMap((run) =>
      (run.items || []).map((item: PayrollItem) => ({
        id: item.id || `${run.id}-${item.employees?.id || item.employees?.nama || "employee"}`,
        periode: run.periode,
        nama: item.employees?.nama || "-",
        jabatan: item.employees?.jabatan || "-",
        branch_id: item.employees?.branch_id || null,
        nama_bank: item.employees?.nama_bank || "-",
        nomor_rekening: item.employees?.nomor_rekening || "-",
        gaji_pokok: item.gaji_pokok || 0,
        total_tunjangan: item.total_tunjangan || 0,
        total_potongan: item.total_potongan || 0,
        gaji_bersih: item.gaji_bersih || 0,
        jumlah_hari: item.jumlah_hari || 0,
        jumlah_izin: item.jumlah_izin || 0,
        jumlah_absen: item.jumlah_absen || 0,
        jumlah_telat: item.jumlah_telat || 0,
        kasbon: item.kasbon || 0,
        bonus_manual: item.bonus_manual || 0,
        catatan: item.catatan || "",
        allowances: item.payroll_item_allowances || [],
        deductions: item.payroll_item_deductions || [],
      })),
    )
    .sort((a: DetailRow, b: DetailRow) => {
      const periodCompare = a.periode.localeCompare(b.periode);
      if (periodCompare !== 0) return periodCompare;
      return a.nama.localeCompare(b.nama);
    });

  const selectedBranchName =
    selectedCabang === "all"
      ? "Semua Cabang"
      : cabangList.find((branch: Branch) => branch.id === selectedCabang)?.nama ||
        "Cabang tidak diketahui";

  const selectedMonthName =
    selectedMonth === "all" ? "Semua Bulan" : BULAN_LABELS[selectedMonth] || selectedMonth;

  const reportEmptyMessage =
    !isLoading && (!reportData || reportData.length === 0)
      ? latestPayrollRun
        ? "Tidak ada data laporan untuk filter yang dipilih. Coba ubah cabang atau periode, atau jalankan payroll di menu Proses Gaji."
        : "Belum ada payroll yang dibuat. Gunakan menu Proses Gaji untuk membuat payroll terlebih dahulu."
      : "";

  const yearOptions = useMemo(() => {
    const years = new Set<number>([currentYear, currentYear - 1]);
    if (latestPayrollRun?.periode) {
      const latestYear = Number(latestPayrollRun.periode.split("-")[0]);
      if (!Number.isNaN(latestYear)) {
        years.add(latestYear);
      }
    }
    if (!Number.isNaN(selectedYear)) {
      years.add(selectedYear);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, latestPayrollRun, selectedYear]);

  const totalEmployees = employeeSummaryList.length;
  const totalPeriods = reportData?.length || 0;

  const handleDownload = async () => {
    if (!reportData || reportData.length === 0) {
      toast.error("Tidak ada data laporan untuk diunduh.");
      return;
    }

    setIsDownloading(true);
    const element = document.getElementById("report-container");

    if (!element) {
      toast.error("Tidak dapat menemukan konten laporan untuk diunduh.");
      setIsDownloading(false);
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 1.5,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let remainingHeight = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
      remainingHeight -= usableHeight;

      while (remainingHeight > 0) {
        position = margin - (imgHeight - remainingHeight);
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
        remainingHeight -= usableHeight;
      }

      const monthSuffix = selectedMonth === "all" ? "Semua_Bulan" : selectedMonth;
      pdf.save(
        `Laporan_Gaji_${selectedBranchName.replace(/\s+/g, "_")}_${selectedYear}_${monthSuffix}.pdf`,
      );
      toast.success("Laporan PDF berhasil diunduh");
    } catch (error) {
      console.error("Gagal membuat PDF laporan:", error);
      toast.error("Gagal membuat PDF laporan");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendWhatsApp = () => {
    const employeeLines = employeeSummaryList.map(
      (employee) =>
        `${employee.nama}: ${formatIDR(employee.total_gaji)} | ${employee.nomor_rekening} | ${employee.nama_bank}`,
    );

    if (employeeLines.length === 0) {
      toast.error("Tidak ada data karyawan untuk dikirim.");
      return;
    }

    const summaryText = `Daftar ringkasan karyawan:\n${employeeLines.join("\n")}`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
    window.open(waUrl, "_blank");
  };

  const formatBulan = (periode: string) => {
    if (!periode) return "-";
    const [_, month] = periode.split("-");
    return BULAN_LABELS[month] || month;
  };

  const handleDownloadDetail = (row: DetailRow) => {
    setDownloadingDetailId(row.id);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      const accent = { r: 22, g: 101, b: 52 };
      const muted = { r: 100, g: 116, b: 139 };
      let y = 18;

      const addText = (
        text: string,
        x: number,
        currentY: number,
        options: {
          size?: number;
          style?: "normal" | "bold";
          color?: { r: number; g: number; b: number };
          align?: "left" | "center" | "right";
        } = {},
      ) => {
        pdf.setFont("helvetica", options.style || "normal");
        pdf.setFontSize(options.size || 10);
        const color = options.color || { r: 15, g: 23, b: 42 };
        pdf.setTextColor(color.r, color.g, color.b);
        pdf.text(text, x, currentY, { align: options.align || "left" });
      };

      const drawAmountRow = (label: string, value: number, currentY: number, isTotal = false) => {
        if (isTotal) {
          pdf.setFillColor(240, 253, 244);
          pdf.roundedRect(margin, currentY - 6, contentWidth, 12, 2, 2, "F");
          addText(label, margin + 4, currentY + 1.5, { size: 11, style: "bold", color: accent });
          addText(formatIDR(value), pageWidth - margin - 4, currentY + 1.5, {
            size: 12,
            style: "bold",
            color: accent,
            align: "right",
          });
          return currentY + 15;
        }

        addText(label, margin + 2, currentY, { size: 10 });
        addText(formatIDR(value), pageWidth - margin - 2, currentY, { size: 10, align: "right" });
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, currentY + 5, pageWidth - margin, currentY + 5);
        return currentY + 11;
      };

      const drawComponentSection = (
        title: string,
        rows: { label: string; value: number }[],
        currentY: number,
      ) => {
        addText(title, margin, currentY, { size: 11, style: "bold" });
        currentY += 8;

        if (rows.length === 0) {
          addText("Tidak ada komponen tambahan.", margin, currentY, { size: 9, color: muted });
          return currentY + 8;
        }

        rows.forEach((item) => {
          const wrappedLabel = pdf.splitTextToSize(item.label, contentWidth - 58);
          addText(wrappedLabel[0], margin, currentY, { size: 9 });
          for (let i = 1; i < wrappedLabel.length; i += 1) {
            currentY += 5;
            addText(wrappedLabel[i], margin, currentY, { size: 9 });
          }
          addText(formatIDR(item.value), pageWidth - margin, currentY, { size: 9, align: "right" });
          currentY += 7;
        });

        return currentY + 2;
      };

      pdf.setFillColor(accent.r, accent.g, accent.b);
      pdf.roundedRect(margin, y, contentWidth, 28, 3, 3, "F");
      addText("Rincian Gaji Karyawan", margin + 6, y + 11, {
        size: 16,
        style: "bold",
        color: { r: 255, g: 255, b: 255 },
      });
      addText(
        `${formatPeriode(row.periode)} • ${getBranchName(row.branch_id)}`,
        margin + 6,
        y + 21,
        {
          size: 10,
          color: { r: 220, g: 252, b: 231 },
        },
      );

      y += 42;
      addText(row.nama, margin, y, { size: 15, style: "bold" });
      addText(row.jabatan, pageWidth - margin, y, { size: 10, color: muted, align: "right" });
      y += 8;
      addText(`Cabang: ${getBranchName(row.branch_id)}`, margin, y, { size: 10, color: muted });
      addText(`Rekening: ${row.nomor_rekening} (${row.nama_bank})`, pageWidth - margin, y, {
        size: 10,
        color: muted,
        align: "right",
      });

      y += 15;
      pdf.setDrawColor(203, 213, 225);
      pdf.roundedRect(margin, y - 4, contentWidth, 58, 3, 3);
      y += 7;
      y = drawAmountRow("Gaji Pokok", row.gaji_pokok, y);
      y = drawAmountRow("Total Tunjangan", row.total_tunjangan, y);
      y = drawAmountRow("Total Potongan", row.total_potongan, y);
      y = drawAmountRow("Take Home Pay", row.gaji_bersih, y, true);

      const allowanceRows = getComponentRows(row.allowances, "Tunjangan", row.total_tunjangan);
      const deductionRows = getComponentRows(row.deductions, "Potongan", row.total_potongan);

      y += 5;
      y = drawComponentSection("Rincian Tunjangan", allowanceRows, y);
      y = drawComponentSection("Rincian Potongan", deductionRows, y);

      y += 4;
      addText("Kehadiran dan Catatan", margin, y, { size: 11, style: "bold" });
      y += 8;
      addText(
        `Hari kerja ${row.jumlah_hari || 0} • Izin ${row.jumlah_izin || 0} • Absen ${row.jumlah_absen || 0} • Telat ${row.jumlah_telat || 0}`,
        margin,
        y,
        { size: 9, color: muted },
      );
      y += 7;
      if (row.kasbon > 0 || row.bonus_manual > 0) {
        addText(
          `Kasbon ${formatIDR(row.kasbon)} • Bonus manual ${formatIDR(row.bonus_manual)}`,
          margin,
          y,
          {
            size: 9,
            color: muted,
          },
        );
        y += 7;
      }
      if (row.catatan) {
        const notes = pdf.splitTextToSize(`Catatan: ${row.catatan}`, contentWidth);
        addText(notes.join("\n"), margin, y, { size: 9, color: muted });
      }

      addText(
        "Dokumen ini dibuat dari menu Laporan Penggajian Branch Payflow.",
        margin,
        pageHeight - 12,
        {
          size: 8,
          color: muted,
        },
      );

      const fileName = `Rincian_Gaji_${safeFileName(row.nama)}_${safeFileName(formatPeriode(row.periode))}.pdf`;
      pdf.save(fileName);
      toast.success("Rincian gaji PDF berhasil diunduh");
    } catch (error) {
      console.error("Gagal membuat PDF rincian gaji:", error);
      toast.error("Gagal membuat PDF rincian gaji");
    } finally {
      setDownloadingDetailId(null);
    }
  };

  const formatPeriode = (periode: string) => {
    if (!periode) return "-";
    const [year, month] = periode.split("-");
    return `${BULAN_LABELS[month] || month} ${year || ""}`.trim();
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return "-";
    return cabangList.find((branch: Branch) => branch.id === branchId)?.nama || "-";
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title="Laporan Penggajian"
          description={`${selectedBranchName} • ${selectedMonthName} ${selectedYear}`}
        />

        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 shadow-sm">
          <Button onClick={handleDownload} variant="outline" disabled={isDownloading || isLoading}>
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download Laporan
          </Button>
          <Button
            onClick={handleSendWhatsApp}
            variant="secondary"
            disabled={isLoading || isDownloading}
          >
            <Send className="mr-2 h-4 w-4" /> Kirim WhatsApp
          </Button>
          <Select
            value={selectedYear.toString()}
            onValueChange={(val) => setSelectedYear(Number(val))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 rounded-md border bg-card p-4 shadow-sm md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cabang
          </span>
          <Select value={selectedCabang} onValueChange={setSelectedCabang}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua Cabang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang</SelectItem>
              {cabangList.map((branch: Branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bulan
          </span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua Bulan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Bulan</SelectItem>
              {Object.entries(BULAN_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div id="report-container" className="space-y-5 bg-white p-1">
        <div className="rounded-md border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Ringkasan Penggajian</h2>
              <p className="text-sm text-slate-600">
                {selectedBranchName} • {selectedMonthName} • {selectedYear}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-md bg-white/80 p-3">
                <span className="block text-xs text-slate-500">Periode</span>
                <span className="font-semibold text-slate-950">{totalPeriods}</span>
              </div>
              <div className="rounded-md bg-white/80 p-3">
                <span className="block text-xs text-slate-500">Karyawan</span>
                <span className="font-semibold text-slate-950">{totalEmployees}</span>
              </div>
              <div className="rounded-md bg-white/80 p-3">
                <span className="block text-xs text-slate-500">Total THP</span>
                <span className="font-semibold text-emerald-800">{formatIDR(grandTotal.thp)}</span>
              </div>
              <div className="rounded-md bg-white/80 p-3">
                <span className="block text-xs text-slate-500">Tunjangan</span>
                <span className="font-semibold text-slate-950">
                  {formatIDR(grandTotal.tunjangan)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {reportEmptyMessage ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {reportEmptyMessage}
          </div>
        ) : null}

        {/* Summary Cards */}
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Total THP", value: grandTotal.thp, tone: "text-emerald-700" },
            { label: "Gaji Pokok", value: grandTotal.gaji_pokok, tone: "text-slate-950" },
            { label: "Tunjangan", value: grandTotal.tunjangan, tone: "text-emerald-700" },
            { label: "Potongan", value: grandTotal.potongan, tone: "text-rose-700" },
          ].map((item) => (
            <Card key={item.label} className="rounded-md shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold ${item.tone}`}>{formatIDR(item.value)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ringkasan Per Karyawan */}
        <div className="overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-950">Ringkasan Per Karyawan</h3>
            <p className="text-xs text-muted-foreground">
              Nama, Total Gaji, No. Rekening, Nama Bank
            </p>
          </div>
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Total Gaji</TableHead>
                <TableHead>No. Rekening</TableHead>
                <TableHead>Bank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeSummaryList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Tidak ada data karyawan untuk cabang ini.
                  </TableCell>
                </TableRow>
              ) : (
                employeeSummaryList.map((employee: EmployeeSummary) => (
                  <TableRow key={employee.id} className="odd:bg-white even:bg-slate-50/60">
                    <TableCell>{employee.nama}</TableCell>
                    <TableCell className="text-right">{formatIDR(employee.total_gaji)}</TableCell>
                    <TableCell>{employee.nomor_rekening}</TableCell>
                    <TableCell>{employee.nama_bank}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Rincian Per Karyawan */}
        <div className="overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Rincian Gaji Per Karyawan</h3>
              <p className="text-xs text-muted-foreground">
                Periode, cabang, jabatan, komponen gaji, dan rekening pembayaran
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{detailRows.length} baris</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead className="text-right">Gaji Pokok</TableHead>
                  <TableHead className="text-right">Tunjangan</TableHead>
                  <TableHead className="text-right">Potongan</TableHead>
                  <TableHead className="text-right">THP</TableHead>
                  <TableHead>Komponen</TableHead>
                  <TableHead>Rekening</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                      Tidak ada rincian gaji untuk filter ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  detailRows.map((row: DetailRow) => (
                    <TableRow key={row.id} className="odd:bg-white even:bg-slate-50/60">
                      <TableCell className="whitespace-nowrap">
                        {formatPeriode(row.periode)}
                      </TableCell>
                      <TableCell className="font-medium">{row.nama}</TableCell>
                      <TableCell>{getBranchName(row.branch_id)}</TableCell>
                      <TableCell>{row.jabatan}</TableCell>
                      <TableCell className="text-right">{formatIDR(row.gaji_pokok)}</TableCell>
                      <TableCell className="text-right">{formatIDR(row.total_tunjangan)}</TableCell>
                      <TableCell className="text-right">{formatIDR(row.total_potongan)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatIDR(row.gaji_bersih)}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[220px] space-y-1 text-xs leading-tight">
                          {row.allowances.length > 0 ? (
                            <div>
                              <span className="font-semibold text-emerald-700">Tunjangan: </span>
                              {row.allowances
                                .map(
                                  (item: ComponentItem) =>
                                    `${item.nama} ${formatIDR(item.subtotal || 0)}`,
                                )
                                .join(", ")}
                            </div>
                          ) : (
                            <div>
                              <span className="font-semibold text-emerald-700">Tunjangan: </span>
                              {formatIDR(row.total_tunjangan)}
                            </div>
                          )}
                          {row.deductions.length > 0 ? (
                            <div>
                              <span className="font-semibold text-rose-700">Potongan: </span>
                              {row.deductions
                                .map(
                                  (item: ComponentItem) =>
                                    `${item.nama} ${formatIDR(item.subtotal || 0)}`,
                                )
                                .join(", ")}
                            </div>
                          ) : (
                            <div>
                              <span className="font-semibold text-rose-700">Potongan: </span>
                              {formatIDR(row.total_potongan)}
                            </div>
                          )}
                          {(row.jumlah_izin > 0 ||
                            row.jumlah_absen > 0 ||
                            row.jumlah_telat > 0) && (
                            <div className="text-muted-foreground">
                              Izin {row.jumlah_izin}, sakit/absen {row.jumlah_absen}, telat{" "}
                              {row.jumlah_telat}
                            </div>
                          )}
                          {row.catatan && (
                            <div className="text-muted-foreground">{row.catatan}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs leading-tight">
                          <div>{row.nomor_rekening}</div>
                          <div className="text-muted-foreground">{row.nama_bank}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => handleDownloadDetail(row)}
                          disabled={downloadingDetailId === row.id}
                        >
                          {downloadingDetailId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4" />
                          )}
                          <span className="sr-only">Unduh rincian gaji {row.nama}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Tabel Detail */}
        <div className="overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-950">Rekap Bulanan</h3>
            <p className="text-xs text-muted-foreground">
              Akumulasi nilai payroll berdasarkan periode proses gaji
            </p>
          </div>
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Bulan</TableHead>
                <TableHead className="text-right">Gaji Pokok</TableHead>
                <TableHead className="text-right">Tunjangan</TableHead>
                <TableHead className="text-right">Potongan</TableHead>
                <TableHead className="text-right font-bold">Total THP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData?.map((row) => (
                <TableRow key={row.id} className="odd:bg-white even:bg-slate-50/60">
                  <TableCell>{formatBulan(row.periode)}</TableCell>
                  <TableCell className="text-right">{formatIDR(row.sum_gaji_pokok)}</TableCell>
                  <TableCell className="text-right">{formatIDR(row.sum_tunjangan)}</TableCell>
                  <TableCell className="text-right">{formatIDR(row.sum_potongan)}</TableCell>
                  <TableCell className="text-right font-bold">{formatIDR(row.sum_thp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
