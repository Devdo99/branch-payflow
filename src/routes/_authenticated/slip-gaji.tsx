import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import {
  ImageIcon,
  FileText,
  Send,
  Trash2,
  Eye,
  Loader2,
  MessageSquare,
  Store,
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const Route = createFileRoute("/_authenticated/slip-gaji")({
  component: SlipGajiPage,
});

type Branch = {
  id: string;
  nama: string;
};

type Employee = {
  id?: string;
  nama?: string | null;
  jabatan?: string | null;
  branch_id?: string | null;
  nama_bank?: string | null;
  nomor_rekening?: string | null;
  whatsapp?: string | null;
  branches?: {
    nama?: string | null;
  } | null;
};

type PayrollRun = {
  periode?: string | null;
  branch_id?: string | null;
};

type PayrollComponent = {
  payroll_item_id?: string | null;
  id?: string;
  nama?: string | null;
  metode?: string | null;
  qty?: number | null;
  nominal?: number | null;
  subtotal?: number | null;
};

type SlipItem = {
  id: string;
  gaji_pokok?: number | null;
  total_tunjangan?: number | null;
  total_potongan?: number | null;
  gaji_bersih?: number | null;
  payroll_runs?: PayrollRun | null;
  employees?: Employee | null;
  jumlah_hari?: number | null;
  jumlah_izin?: number | null;
  jumlah_absen?: number | null;
  jumlah_telat?: number | null;
  kasbon?: number | null;
  bonus_manual?: number | null;
  catatan?: string | null;
  payroll_item_allowances?: PayrollComponent[] | null;
  payroll_item_deductions?: PayrollComponent[] | null;
};

type AppSettings = {
  nama_perusahaan?: string | null;
  alamat?: string | null;
  footer_slip?: string | null;
  slip_template_config?: unknown;
} | null;

type SlipTemplateConfig = {
  layout: "classic" | "compact" | "borderless";
  accentColor: string;
  fontSize: "small" | "normal" | "large";
  showCompanyName: boolean;
  showCompanyAddress: boolean;
  showEmployeeName: boolean;
  showBranch: boolean;
  showPeriod: boolean;
  showBaseSalary: boolean;
  showAllowance: boolean;
  showAllowanceDetails: boolean;
  showDeduction: boolean;
  showDeductionDetails: boolean;
  showNetSalary: boolean;
  showSignature: boolean;
  showFooter: boolean;
  leftSignatureLabel: string;
  leftSignatureName: string;
  rightSignatureLabel: string;
};

const defaultSlipTemplateConfig: SlipTemplateConfig = {
  layout: "classic",
  accentColor: "#000000",
  fontSize: "normal",
  showCompanyName: true,
  showCompanyAddress: true,
  showEmployeeName: true,
  showBranch: true,
  showPeriod: true,
  showBaseSalary: true,
  showAllowance: true,
  showAllowanceDetails: true,
  showDeduction: true,
  showDeductionDetails: true,
  showNetSalary: true,
  showSignature: true,
  showFooter: true,
  leftSignatureLabel: "Dibuat oleh,",
  leftSignatureName: "Admin",
  rightSignatureLabel: "Diterima oleh,",
};

const getSlipTemplateConfig = (value: unknown): SlipTemplateConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultSlipTemplateConfig;
  }

  return { ...defaultSlipTemplateConfig, ...(value as Partial<SlipTemplateConfig>) };
};

const toNumber = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const isMissingComponentTableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: string }).code : "";
  return code === "PGRST200" || code === "PGRST205";
};

const escapeHtml = (value: unknown) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const escapeHtmlWithBreaks = (value: unknown) => {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
};

const sanitizeHexColor = (value: unknown) => {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000";
};

const safeFileName = (value: unknown) => {
  return String(value || "Karyawan")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .trim();
};

const normalizeWhatsappNumber = (phone: unknown) => {
  let cleanPhone = String(phone || "").replace(/\D/g, "");

  if (!cleanPhone) return "";

  if (cleanPhone.startsWith("08")) {
    cleanPhone = `62${cleanPhone.slice(1)}`;
  }

  if (cleanPhone.startsWith("8")) {
    cleanPhone = `62${cleanPhone}`;
  }

  if (cleanPhone.startsWith("620")) {
    cleanPhone = `62${cleanPhone.slice(3)}`;
  }

  return cleanPhone;
};

const getWhatsappUrl = (phone: unknown, message: string) => {
  const normalizedPhone = normalizeWhatsappNumber(phone);
  if (!normalizedPhone) return "";

  return `https://api.whatsapp.com/send?phone=${normalizedPhone}&text=${encodeURIComponent(message)}`;
};

const getSlipFileName = (slip: SlipItem, extension: "jpg" | "pdf") => {
  const nama = safeFileName(slip.employees?.nama);
  const periode = safeFileName(slip.payroll_runs?.periode || "Periode");
  return `Slip_Gaji_${nama}_${periode}.${extension}`;
};

const getComponentDescription = (component: PayrollComponent) => {
  const metode = String(component.metode || "");
  const qty = toNumber(component.qty);
  const nominal = toNumber(component.nominal);

  if (metode === "fixed" || metode === "manual" || qty <= 1) {
    return "";
  }

  return `${qty} x ${formatIDR(nominal)}`;
};

const BULAN_LABELS: Record<string, string> = {
  all: "Semua Bulan",
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

const getRawHtmlTemplate = (slip: SlipItem, settings?: AppSettings) => {
  const config = getSlipTemplateConfig(settings?.slip_template_config);
  const accentColor = sanitizeHexColor(config.accentColor);
  const baseFontSize = config.fontSize === "small" ? 12 : config.fontSize === "large" ? 15 : 14;
  const titleFontSize = config.fontSize === "small" ? 18 : config.fontSize === "large" ? 23 : 20;
  const companyFontSize = config.fontSize === "small" ? 20 : config.fontSize === "large" ? 25 : 22;
  const isCompact = config.layout === "compact";
  const isBorderless = config.layout === "borderless";
  const namaPerusahaan = escapeHtml(settings?.nama_perusahaan || "Nama Perusahaan");
  const alamat = escapeHtmlWithBreaks(settings?.alamat || "");
  const footerSlip = escapeHtmlWithBreaks(
    settings?.footer_slip || "Dokumen ini dibuat otomatis oleh sistem penggajian.",
  );
  const nama = escapeHtml(slip.employees?.nama || "-");
  const cabang = escapeHtml(slip.employees?.branches?.nama || "-");
  const periode = escapeHtml(slip.payroll_runs?.periode || "-");

  const gajiPokok = toNumber(slip.gaji_pokok);
  const totalTunjangan = toNumber(slip.total_tunjangan);
  const totalPotongan = toNumber(slip.total_potongan);
  const gajiBersih = toNumber(slip.gaji_bersih);
  const allowanceComponents = (slip.payroll_item_allowances || []).filter(
    (component) => toNumber(component.subtotal) > 0,
  );
  const deductionComponents = (slip.payroll_item_deductions || []).filter(
    (component) => toNumber(component.subtotal) > 0,
  );
  const componentRows = (components: PayrollComponent[]) =>
    components
      .map((component) => {
        const description = getComponentDescription(component);
        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0 8px 14px;">
              <div>${escapeHtml(component.nama || "-")}</div>
              ${
                description
                  ? `<div style="font-size: ${Math.max(baseFontSize - 2, 10)}px; color: #4b5563;">${escapeHtml(
                      description,
                    )}</div>`
                  : ""
              }
            </td>
            <td style="text-align: right; padding: 8px 0;">
              ${formatIDR(toNumber(component.subtotal))}
            </td>
          </tr>
        `;
      })
      .join("");
  const infoRows = [
    config.showEmployeeName ? `<p style="margin: 4px 0;"><strong>Nama:</strong> ${nama}</p>` : "",
    config.showBranch ? `<p style="margin: 4px 0;"><strong>Cabang:</strong> ${cabang}</p>` : "",
    config.showPeriod ? `<p style="margin: 4px 0;"><strong>Periode:</strong> ${periode}</p>` : "",
  ]
    .filter(Boolean)
    .join("");

  const salaryRows = [
    config.showBaseSalary
      ? `
          <tr style="border-bottom: 1px solid ${accentColor};">
            <td style="padding: 12px 0;">Gaji Pokok</td>
            <td style="text-align: right; padding: 12px 0;">
              ${formatIDR(gajiPokok)}
            </td>
          </tr>
        `
      : "",
    config.showAllowance
      ? `
          <tr style="border-bottom: 1px solid ${accentColor};">
            <td colspan="2" style="
              padding: 14px 0 8px 0;
              font-weight: bold;
              text-transform: uppercase;
              color: ${accentColor};
            ">Tunjangan</td>
          </tr>
          ${config.showAllowanceDetails ? componentRows(allowanceComponents) : ""}
          <tr style="border-bottom: 1px solid ${accentColor};">
            <td style="padding: 12px 0; font-weight: bold;">Total Tunjangan</td>
            <td style="text-align: right; padding: 12px 0;">
              ${formatIDR(totalTunjangan)}
            </td>
          </tr>
        `
      : "",
    config.showDeduction
      ? `
          <tr style="border-bottom: 1px solid ${accentColor};">
            <td colspan="2" style="
              padding: 14px 0 8px 0;
              font-weight: bold;
              text-transform: uppercase;
              color: ${accentColor};
            ">Potongan</td>
          </tr>
          ${config.showDeductionDetails ? componentRows(deductionComponents) : ""}
          <tr style="border-bottom: 1px solid ${accentColor};">
            <td style="padding: 12px 0; font-weight: bold;">Total Potongan</td>
            <td style="text-align: right; padding: 12px 0;">
              ${formatIDR(totalPotongan)}
            </td>
          </tr>
        `
      : "",
    config.showNetSalary
      ? `
          <tr style="border-top: 2px solid ${accentColor};">
            <td style="
              padding: 18px 0 8px 0;
              font-weight: bold;
              font-size: ${baseFontSize + 2}px;
              text-transform: uppercase;
            ">
              Total Bersih
            </td>
            <td style="
              text-align: right;
              padding: 18px 0 8px 0;
              font-weight: bold;
              font-size: ${baseFontSize + 2}px;
            ">
              ${formatIDR(gajiBersih)}
            </td>
          </tr>
        `
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <div id="slip-gaji-render" style="
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      background-color: #ffffff;
      width: 600px;
      min-height: ${isCompact ? 620 : 760}px;
      padding: ${isCompact ? 28 : 40}px;
      box-sizing: border-box;
      border: ${isBorderless ? "0" : `1px solid ${accentColor}`};
    ">
      ${
        config.showCompanyName || (config.showCompanyAddress && alamat)
          ? `
      <div style="
        margin: 0 0 ${isCompact ? 12 : 18}px 0;
        padding-bottom: ${isCompact ? 10 : 14}px;
        border-bottom: 2px solid ${accentColor};
        text-align: center;
        color: #000000;
        background-color: #ffffff;
      ">
        <div style="
          margin: 0;
          text-transform: uppercase;
          font-size: ${companyFontSize}px;
          font-weight: bold;
          letter-spacing: 1px;
        ">
          ${config.showCompanyName ? namaPerusahaan : ""}
        </div>
        ${
          config.showCompanyAddress && alamat
            ? `<div style="
                margin-top: 6px;
                font-size: 12px;
                line-height: 1.5;
                font-weight: normal;
              ">${alamat}</div>`
            : ""
        }
      </div>
          `
          : ""
      }

      <h1 style="
        margin: 0;
        text-align: center;
        text-transform: uppercase;
        font-size: ${titleFontSize}px;
        letter-spacing: 1px;
        color: ${accentColor};
        background-color: #ffffff;
      ">
        Slip Gaji
      </h1>

      ${
        infoRows
          ? `
      <div style="
        margin: ${isCompact ? 16 : 24}px 0;
        font-size: ${baseFontSize}px;
        line-height: 1.7;
        color: #000000;
        background-color: #ffffff;
      ">
        ${infoRows}
      </div>
          `
          : ""
      }

      ${
        salaryRows
          ? `
      <table style="
        width: 100%;
        border-collapse: collapse;
        margin-top: ${isCompact ? 16 : 24}px;
        font-size: ${baseFontSize}px;
        color: #000000;
        background-color: #ffffff;
      ">
        <tbody>
          ${salaryRows}
        </tbody>
      </table>
          `
          : ""
      }

      ${
        config.showSignature
          ? `
      <div style="
        margin-top: ${isCompact ? 32 : 48}px;
        display: flex;
        justify-content: space-between;
        font-size: ${Math.max(baseFontSize - 1, 11)}px;
        color: #000000;
        background-color: #ffffff;
      ">
        <div style="width: 45%; text-align: center;">
          <p style="margin-bottom: ${isCompact ? 54 : 72}px;">${escapeHtml(config.leftSignatureLabel)}</p>
          <p style="border-top: 1px solid ${accentColor}; padding-top: 8px;">
            ${escapeHtml(config.leftSignatureName || "-")}
          </p>
        </div>

        <div style="width: 45%; text-align: center;">
          <p style="margin-bottom: ${isCompact ? 54 : 72}px;">${escapeHtml(config.rightSignatureLabel)}</p>
          <p style="border-top: 1px solid ${accentColor}; padding-top: 8px;">
            ${nama}
          </p>
        </div>
      </div>
          `
          : ""
      }

      ${
        config.showFooter && footerSlip
          ? `
      <div style="
        margin-top: 28px;
        font-size: 11px;
        color: #000000;
        text-align: center;
        border-top: 1px solid ${accentColor};
        padding-top: 12px;
        background-color: #ffffff;
      ">
        ${footerSlip}
      </div>
          `
          : ""
      }
    </div>
  `;
};

const waitForRender = () => {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
};

const createIsolatedSlipFrame = async (slip: SlipItem, settings?: AppSettings) => {
  const iframe = document.createElement("iframe");

  iframe.style.position = "fixed";
  iframe.style.left = "0";
  iframe.style.top = "0";
  iframe.style.width = "700px";
  iframe.style.height = "1000px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-1";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;

  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error("Gagal membuat iframe dokumen slip");
  }

  doc.open();
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          html,
          body {
            margin: 0;
            padding: 0;
            width: 700px;
            min-height: 1000px;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: hidden;
          }

          * {
            box-sizing: border-box;
            color: #000000;
            background-color: transparent;
          }

          table,
          tbody,
          tr,
          td {
            color: #000000;
            background-color: #ffffff;
          }
        </style>
      </head>
      <body>
        ${getRawHtmlTemplate(slip, settings)}
      </body>
    </html>
  `);
  doc.close();

  await waitForRender();

  const target = doc.getElementById("slip-gaji-render") as HTMLElement | null;

  if (!target) {
    document.body.removeChild(iframe);
    throw new Error("Template slip gaji tidak ditemukan");
  }

  if (doc.fonts?.ready) {
    await doc.fonts.ready;
  }

  await waitForRender();

  return { iframe, target };
};

const downloadDataUrl = (dataUrl: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function SlipGajiPage() {
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState<string | null>(null);
  const [previewSlip, setPreviewSlip] = useState<SlipItem | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [hasInitializedFilters, setHasInitializedFilters] = useState(false);

  const { data: appSettings = null } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("nama_perusahaan, alamat, footer_slip, slip_template_config")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, nama").order("nama");
      if (error) throw error;
      return (data || []) as Branch[];
    },
  });

  const { data: latestPayrollRun = null } = useQuery({
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
    if (latestPayrollRun && !hasInitializedFilters) {
      const [year, month] = (latestPayrollRun.periode || "").split("-");
      if (year && month) {
        setSelectedYear(Number(year));
        setSelectedMonth(String(month).padStart(2, "0"));
      }
      setSelectedBranch(latestPayrollRun.branch_id || "all");
      setHasInitializedFilters(true);
    }
  }, [latestPayrollRun, hasInitializedFilters]);

  const {
    data: payrollItems = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["payroll_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_items").select(`
          *,
          payroll_runs (*),
          employees (*, branches (*))
        `);

      if (error) throw error;

      const payrollItems = (data || []) as SlipItem[];
      const payrollItemIds = payrollItems.map((item) => item.id).filter(Boolean);

      if (payrollItemIds.length === 0) {
        return payrollItems;
      }

      const [
        { data: allowanceRows, error: allowanceError },
        { data: deductionRows, error: deductionError },
      ] = await Promise.all([
        supabase.from("payroll_item_allowances").select("*").in("payroll_item_id", payrollItemIds),
        supabase.from("payroll_item_deductions").select("*").in("payroll_item_id", payrollItemIds),
      ]);

      if (allowanceError && !isMissingComponentTableError(allowanceError)) {
        throw allowanceError;
      }
      if (deductionError && !isMissingComponentTableError(deductionError)) {
        throw deductionError;
      }

      const allowancesByItem = (
        allowanceError ? [] : ((allowanceRows || []) as PayrollComponent[])
      ).reduce((acc: Record<string, PayrollComponent[]>, row) => {
        if (!row.payroll_item_id) return acc;
        acc[row.payroll_item_id] = [...(acc[row.payroll_item_id] || []), row];
        return acc;
      }, {});

      const deductionsByItem = (
        deductionError ? [] : ((deductionRows || []) as PayrollComponent[])
      ).reduce((acc: Record<string, PayrollComponent[]>, row) => {
        if (!row.payroll_item_id) return acc;
        acc[row.payroll_item_id] = [...(acc[row.payroll_item_id] || []), row];
        return acc;
      }, {});

      return payrollItems.map((item) => ({
        ...item,
        payroll_item_allowances: allowancesByItem[item.id] || [],
        payroll_item_deductions: deductionsByItem[item.id] || [],
      }));
    },
  });

  const filteredPayrollItems = useMemo(() => {
    const normalizedMonth = String(selectedMonth).padStart(2, "0");
    return payrollItems.filter((slip: SlipItem) => {
      const periode = slip.payroll_runs?.periode || "";
      const runBranchId = slip.payroll_runs?.branch_id;
      const branchMatch = selectedBranch === "all" || runBranchId === selectedBranch;
      const periodMatch =
        selectedMonth === "all"
          ? periode.startsWith(`${selectedYear}-`)
          : periode === `${selectedYear}-${normalizedMonth}`;

      return branchMatch && periodMatch;
    });
  }, [payrollItems, selectedBranch, selectedYear, selectedMonth]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    if (latestPayrollRun?.periode) {
      const year = Number(latestPayrollRun.periode.split("-")[0]);
      if (!Number.isNaN(year)) {
        years.add(year);
      }
    }
    payrollItems.forEach((slip: SlipItem) => {
      const year = Number(slip.payroll_runs?.periode?.split("-")[0]);
      if (!Number.isNaN(year)) {
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [latestPayrollRun, payrollItems]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_items").delete().eq("id", id);

      if (error) throw error;

      return id;
    },
    onSuccess: () => {
      toast.success("Slip gaji berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["payroll_items"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Gagal menghapus slip gaji");
    },
  });

  const handleExportJPG = async (slip: SlipItem) => {
    setLoading(`JPG-${slip.id}`);

    let iframe: HTMLIFrameElement | null = null;

    try {
      const created = await createIsolatedSlipFrame(slip, appSettings);
      iframe = created.iframe;

      const canvas = await html2canvas(created.target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: created.target.offsetWidth,
        height: created.target.offsetHeight,
        windowWidth: 700,
        windowHeight: 1000,
      });

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      downloadDataUrl(dataUrl, getSlipFileName(slip, "jpg"));

      toast.success("JPG slip gaji berhasil diunduh");
    } catch (error) {
      console.error("Gagal membuat JPG:", error);
      toast.error("Gagal membuat JPG slip gaji");
    } finally {
      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }

      setLoading(null);
    }
  };

  const handleExportPDF = async (slip: SlipItem) => {
    setLoading(`PDF-${slip.id}`);

    let iframe: HTMLIFrameElement | null = null;

    try {
      const created = await createIsolatedSlipFrame(slip, appSettings);
      iframe = created.iframe;

      const canvas = await html2canvas(created.target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: created.target.offsetWidth,
        height: created.target.offsetHeight,
        windowWidth: 700,
        windowHeight: 1000,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const pdf = new jsPDF({
        orientation: "portrait",
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

      // Jika tinggi gambar masih muat di 1 halaman.
      if (imgHeight <= usableHeight) {
        pdf.addImage(imgData, "JPEG", margin, margin, imgWidth, imgHeight);
      } else {
        const scaledHeight = usableHeight;
        const scaledWidth = (canvas.width * scaledHeight) / canvas.height;
        const x = (pageWidth - scaledWidth) / 2;

        pdf.addImage(imgData, "JPEG", x, margin, scaledWidth, scaledHeight);
      }

      pdf.save(getSlipFileName(slip, "pdf"));

      toast.success("PDF slip gaji berhasil diunduh");
    } catch (error) {
      console.error("Gagal membuat PDF:", error);
      toast.error("Gagal membuat PDF slip gaji");
    } finally {
      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }

      setLoading(null);
    }
  };

  const handleWAText = (slip: SlipItem) => {
    const phone = slip.employees?.whatsapp;
    const normalizedPhone = normalizeWhatsappNumber(phone);

    if (!normalizedPhone) {
      toast.error("Nomor WhatsApp karyawan belum diisi");
      return;
    }

    const nama = slip.employees?.nama || "";
    const periode = slip.payroll_runs?.periode || "-";
    const gajiBersih = formatIDR(toNumber(slip.gaji_bersih));

    const msg = `Halo ${nama}, berikut ringkasan gaji Anda periode ${periode}.\n\nTHP: ${gajiBersih}`;
    const waUrl = getWhatsappUrl(phone, msg);

    window.open(waUrl, "_blank", "noopener,noreferrer");
    toast.success(`WhatsApp dibuka ke nomor ${normalizedPhone}`);
  };

  const handleWAImage = async (slip: SlipItem) => {
    const phone = slip.employees?.whatsapp;
    const normalizedPhone = normalizeWhatsappNumber(phone);

    if (!normalizedPhone) {
      toast.error("Nomor WhatsApp karyawan belum diisi");
      return;
    }

    setLoading(`WA-IMG-${slip.id}`);

    const waTab = window.open("", "_blank");
    let iframe: HTMLIFrameElement | null = null;

    try {
      const created = await createIsolatedSlipFrame(slip, appSettings);
      iframe = created.iframe;

      const canvas = await html2canvas(created.target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: created.target.offsetWidth,
        height: created.target.offsetHeight,
        windowWidth: 700,
        windowHeight: 1000,
      });

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      downloadDataUrl(dataUrl, getSlipFileName(slip, "jpg"));

      const nama = slip.employees?.nama || "";
      const periode = slip.payroll_runs?.periode || "-";

      const msg =
        `Halo ${nama}, berikut slip gaji Anda periode ${periode}.\n\n` +
        `File JPG slip gaji sudah terunduh dari sistem. Silakan lampirkan gambar slip gaji tersebut di chat ini.`;

      const waUrl = getWhatsappUrl(phone, msg);

      if (waTab) {
        waTab.location.href = waUrl;
      } else {
        window.open(waUrl, "_blank");
      }

      toast.success(`JPG diunduh dan WhatsApp dibuka ke nomor ${normalizedPhone}`);
    } catch (error) {
      console.error("Gagal membuat slip untuk WA:", error);
      toast.error("Gagal membuat slip gaji untuk WhatsApp");

      if (waTab) {
        waTab.close();
      }
    } finally {
      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }

      setLoading(null);
    }
  };

  const isButtonLoading = (key: string) => loading === key;
  const selectedBranchName =
    selectedBranch === "all"
      ? "Semua Cabang"
      : branches.find((branch) => branch.id === selectedBranch)?.nama || "Cabang Terpilih";
  const selectedMonthName = BULAN_LABELS[selectedMonth] || selectedMonth;
  const activeSlipConfig = getSlipTemplateConfig(appSettings?.slip_template_config);
  const activeSections = [
    activeSlipConfig.showCompanyName ? "Perusahaan" : null,
    activeSlipConfig.showCompanyAddress ? "Alamat" : null,
    activeSlipConfig.showEmployeeName ? "Karyawan" : null,
    activeSlipConfig.showBranch ? "Cabang" : null,
    activeSlipConfig.showPeriod ? "Periode" : null,
    activeSlipConfig.showBaseSalary ? "Gaji Pokok" : null,
    activeSlipConfig.showAllowance
      ? activeSlipConfig.showAllowanceDetails
        ? "Rincian Tunjangan"
        : "Total Tunjangan"
      : null,
    activeSlipConfig.showDeduction
      ? activeSlipConfig.showDeductionDetails
        ? "Rincian Potongan"
        : "Total Potongan"
      : null,
    activeSlipConfig.showNetSalary ? "THP" : null,
    activeSlipConfig.showSignature ? "TTD" : null,
    activeSlipConfig.showFooter ? "Footer" : null,
  ].filter((section): section is string => Boolean(section));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Slip Gaji</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Kelola, preview, unduh, dan kirim slip gaji untuk {selectedBranchName} periode{" "}
            {selectedMonthName} {selectedYear}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Tahun</Label>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.currentTarget.value))}
              className="h-9 w-[120px] rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Bulan</Label>
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.currentTarget.value)}
              className="h-9 w-[150px] rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
            >
              {Object.entries(BULAN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Cabang</Label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 shadow-sm">
              <Store className="ml-1 h-4 w-4 text-slate-500" />
              <select
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.currentTarget.value)}
                className="h-8 w-[180px] border-0 bg-transparent text-sm font-medium shadow-none outline-none"
              >
                <option value="all">Semua Cabang</option>
                {branches.map((branch: Branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">Daftar Slip Gaji</div>
            <div className="text-xs text-slate-500">
              Tampilan slip mengikuti konfigurasi aktif dari halaman Pengaturan.
            </div>
          </div>
          <div className="flex max-w-2xl flex-wrap justify-start gap-1.5 sm:justify-end">
            {activeSections.map((section) => (
              <span
                key={section}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
              >
                {section}
              </span>
            ))}
            {activeSections.length === 0 && (
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
                Belum ada bagian aktif
              </span>
            )}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Karyawan</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead className="text-right">THP</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data slip gaji...
                  </div>
                </TableCell>
              </TableRow>
            )}

            {isError && !isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-red-500">
                  Gagal memuat data slip gaji.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && filteredPayrollItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {payrollItems.length === 0
                    ? "Belum ada data slip gaji."
                    : "Tidak ada slip gaji untuk filter yang dipilih. Pilih cabang, tahun, atau bulan lain."}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !isError &&
              filteredPayrollItems.map((slip: SlipItem) => {
                const jpgLoading = isButtonLoading(`JPG-${slip.id}`);
                const pdfLoading = isButtonLoading(`PDF-${slip.id}`);
                const waImageLoading = isButtonLoading(`WA-IMG-${slip.id}`);

                return (
                  <TableRow key={slip.id}>
                    <TableCell className="font-medium">{slip.employees?.nama || "-"}</TableCell>

                    <TableCell>{slip.employees?.branches?.nama || "-"}</TableCell>

                    <TableCell>{slip.payroll_runs?.periode || "-"}</TableCell>

                    <TableCell className="text-right font-medium">
                      {formatIDR(toNumber(slip.gaji_bersih))}
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewSlip(slip)}
                          title="Preview slip"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportJPG(slip)}
                          disabled={!!loading}
                          title="Download JPG"
                        >
                          {jpgLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportPDF(slip)}
                          disabled={!!loading}
                          title="Download PDF"
                        >
                          {pdfLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWAText(slip)}
                          disabled={!!loading}
                          title="Kirim WA teks"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWAImage(slip)}
                          disabled={!!loading}
                          title="Download JPG dan buka WhatsApp Web"
                        >
                          {waImageLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(slip.id)}
                          disabled={!!loading}
                          title="Hapus slip"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!previewSlip} onOpenChange={() => setPreviewSlip(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Slip Gaji</DialogTitle>
          </DialogHeader>

          {previewSlip && (
            <div className="flex justify-center overflow-auto rounded-md bg-white p-4">
              <div
                dangerouslySetInnerHTML={{
                  __html: getRawHtmlTemplate(previewSlip, appSettings),
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
