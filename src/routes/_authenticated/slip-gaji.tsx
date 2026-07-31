import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatIDR, formatNumberDots, parseNumberDots } from "@/lib/format";
import {
  ImageIcon,
  FileText,
  Send,
  Trash2,
  Eye,
  Loader2,
  MessageSquare,
  Store,
  MoreHorizontal,
  Search,
  Users,
  CheckCircle2,
  Clock,
  Download,
  Sliders,
  X,
  Play,
  Pause,
  Wallet,
  Sparkles,
  Plus
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
  slip_dibuat?: boolean | null;
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
  const [editingSlip, setEditingSlip] = useState<SlipItem | null>(null);
  const [originalSlip, setOriginalSlip] = useState<SlipItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [hasInitializedFilters, setHasInitializedFilters] = useState(false);
  const [selectedSlipIds, setSelectedSlipIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "pending" | "sent">("all");

  // State for bulk processing
  const [bulkProcess, setBulkProcess] = useState<{
    active: boolean;
    type: "wa-txt" | "wa-img" | "pdf" | "jpg" | null;
    items: SlipItem[];
    currentIndex: number;
    results: {
      slipId: string;
      employeeName: string;
      status: "pending" | "processing" | "success" | "error";
      error?: string;
    }[];
    isPaused: boolean;
  }>({
    active: false,
    type: null,
    items: [],
    currentIndex: 0,
    results: [],
    isPaused: false,
  });

  // State for template live customizer
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [tempTemplateConfig, setTempTemplateConfig] = useState<SlipTemplateConfig>(defaultSlipTemplateConfig);
  const [tempNamaPerusahaan, setTempNamaPerusahaan] = useState("");
  const [tempAlamat, setTempAlamat] = useState("");
  const [tempFooterSlip, setTempFooterSlip] = useState("");

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

  // Query untuk memantau status WhatsApp Gateway lokal
  const { data: gatewayStatus } = useQuery({
    queryKey: ["whatsapp_gateway_status"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:5000/api/status");
        if (!res.ok) throw new Error("Offline");
        return await res.json();
      } catch (err) {
        return { status: "offline", qr: null };
      }
    },
    refetchInterval: 10000, // Periksa status gateway setiap 10 detik
  });

  // Query untuk mengambil template pesan WhatsApp dari database Supabase
  const { data: waTemplate } = useQuery({
    queryKey: ["whatsapp_template_send"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("konten")
        .eq("jenis", "per_karyawan")
        .maybeSingle();

      if (error) throw error;
      return data?.konten || null;
    },
  });

  // Mutation untuk mengupdate status slip_dibuat menjadi true setelah berhasil dikirim
  const updateSlipStatusMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("payroll_items")
        .update({ slip_dibuat: true })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_items"] });
    },
  });

  // Fungsi formatter pesan berdasarkan template
  const formatWhatsAppMessage = (templateText: string | null, slip: SlipItem) => {
    const defaultTemplate = `Halo {{nama}},\n\nBerikut adalah rincian slip gaji Anda untuk periode {{periode}}:\n\nGaji Pokok: {{gaji_pokok}}\nTotal Tunjangan: {{total_tunjangan}}\nTotal Potongan: {{total_potongan}}\n\n*Take Home Pay: {{gaji_bersih}}*\n\nTerima kasih atas kerja keras Anda!\nSalam,\nManajemen.`;
    const template = templateText || defaultTemplate;

    const vars: Record<string, string> = {
      "{{nama}}": slip.employees?.nama || "",
      "{{periode}}": slip.payroll_runs?.periode || "",
      "{{gaji_pokok}}": formatIDR(toNumber(slip.gaji_pokok)),
      "{{total_tunjangan}}": formatIDR(toNumber(slip.total_tunjangan)),
      "{{total_potongan}}": formatIDR(toNumber(slip.total_potongan)),
      "{{gaji_bersih}}": formatIDR(toNumber(slip.gaji_bersih)),
      "{{nama_bank}}": slip.employees?.nama_bank || "-",
      "{{nomor_rekening}}": slip.employees?.nomor_rekening || "-",
    };

    let msg = template;
    Object.entries(vars).forEach(([key, val]) => {
      msg = msg.replaceAll(key, val);
    });
    return msg;
  };

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
      const name = slip.employees?.nama || "";
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());

      const periode = slip.payroll_runs?.periode || "";
      const runBranchId = slip.payroll_runs?.branch_id;
      const branchMatch = selectedBranch === "all" || runBranchId === selectedBranch;
      const periodMatch =
        selectedMonth === "all"
          ? periode.startsWith(`${selectedYear}-`)
          : periode === `${selectedYear}-${normalizedMonth}`;

      const isSent = slip.slip_dibuat === true;
      const matchesStatusTab =
        statusTab === "all" ||
        (statusTab === "sent" && isSent) ||
        (statusTab === "pending" && !isSent);

      return branchMatch && periodMatch && matchesSearch && matchesStatusTab;
    });
  }, [payrollItems, selectedBranch, selectedYear, selectedMonth, searchQuery, statusTab]);

  // Dynamic statistics calculations
  const stats = useMemo(() => {
    const totalItems = filteredPayrollItems.length;
    const sentCount = filteredPayrollItems.filter((item) => item.slip_dibuat).length;
    const pendingCount = totalItems - sentCount;
    const totalNetPay = filteredPayrollItems.reduce((acc, item) => acc + toNumber(item.gaji_bersih), 0);
    const sentPercentage = totalItems > 0 ? Math.round((sentCount / totalItems) * 100) : 0;

    return {
      totalItems,
      sentCount,
      pendingCount,
      totalNetPay,
      sentPercentage,
    };
  }, [filteredPayrollItems]);

  // Mock preview slip for customizer
  const mockPreviewSlip = useMemo(() => {
    if (filteredPayrollItems.length > 0) {
      return filteredPayrollItems[0];
    }
    if (payrollItems.length > 0) {
      return payrollItems[0];
    }
    return {
      id: "mock",
      gaji_pokok: 4500000,
      total_tunjangan: 750000,
      total_potongan: 150000,
      gaji_bersih: 5100000,
      jumlah_hari: 26,
      employees: {
        nama: "Ahmad Subarjo",
        jabatan: "Staff Operasional",
        branches: { nama: "Cabang Utama" },
        nama_bank: "BCA",
        nomor_rekening: "1234567890",
        whatsapp: "628123456789"
      },
      payroll_runs: {
        periode: "2026-08"
      },
      payroll_item_allowances: [
        { id: "1", nama: "Tunjangan Makan", subtotal: 500000, qty: 1, nominal: 500000, metode: "fixed" },
        { id: "2", nama: "Tunjangan Transport", subtotal: 250000, qty: 1, nominal: 250000, metode: "fixed" }
      ],
      payroll_item_deductions: [
        { id: "3", nama: "Potongan Keterlambatan", subtotal: 100000, qty: 2, nominal: 50000, metode: "fixed" },
        { id: "4", nama: "BPJS Kesehatan", subtotal: 50000, qty: 1, nominal: 50000, metode: "fixed" }
      ]
    } as SlipItem;
  }, [filteredPayrollItems, payrollItems]);

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

  const recalculateSlipTotals = (slip: SlipItem): SlipItem => {
    const allowances = slip.payroll_item_allowances || [];
    const deductions = slip.payroll_item_deductions || [];
    
    const updatedAllowances = allowances.map(alw => ({
      ...alw,
      subtotal: Number(alw.qty ?? 1) * Number(alw.nominal ?? 0)
    }));
    
    const updatedDeductions = deductions.map(ded => ({
      ...ded,
      subtotal: Number(ded.qty ?? 1) * Number(ded.nominal ?? 0)
    }));
    
    const total_tunjangan = updatedAllowances.reduce((acc, alw) => acc + (alw.subtotal ?? 0), 0);
    const total_potongan = updatedDeductions.reduce((acc, ded) => acc + (ded.subtotal ?? 0), 0);
    const gaji_pokok = Number(slip.gaji_pokok ?? 0);
    const gaji_bersih = gaji_pokok + total_tunjangan - total_potongan;
    
    return {
      ...slip,
      payroll_item_allowances: updatedAllowances,
      payroll_item_deductions: updatedDeductions,
      total_tunjangan,
      total_potongan,
      gaji_bersih
    };
  };

  const handleAllowanceChange = (index: number, field: "nama" | "qty" | "nominal", val: any) => {
    setEditingSlip(prev => {
      if (!prev) return null;
      const allowances = [...(prev.payroll_item_allowances || [])];
      allowances[index] = { ...allowances[index], [field]: val };
      return recalculateSlipTotals({ ...prev, payroll_item_allowances: allowances });
    });
  };

  const handleDeductionChange = (index: number, field: "nama" | "qty" | "nominal", val: any) => {
    setEditingSlip(prev => {
      if (!prev) return null;
      const deductions = [...(prev.payroll_item_deductions || [])];
      deductions[index] = { ...deductions[index], [field]: val };
      return recalculateSlipTotals({ ...prev, payroll_item_deductions: deductions });
    });
  };

  const handleAddAllowanceEdit = () => {
    setEditingSlip(prev => {
      if (!prev) return null;
      const allowances = [
        ...(prev.payroll_item_allowances || []),
        {
          id: `new-${Date.now()}`,
          payroll_item_id: prev.id,
          nama: "Tunjangan Baru",
          qty: 1,
          nominal: 0,
          subtotal: 0
        }
      ];
      return recalculateSlipTotals({ ...prev, payroll_item_allowances: allowances });
    });
  };

  const handleAddDeductionEdit = () => {
    setEditingSlip(prev => {
      if (!prev) return null;
      const deductions = [
        ...(prev.payroll_item_deductions || []),
        {
          id: `new-${Date.now()}`,
          payroll_item_id: prev.id,
          nama: "Potongan Baru",
          qty: 1,
          nominal: 0,
          subtotal: 0
        }
      ];
      return recalculateSlipTotals({ ...prev, payroll_item_deductions: deductions });
    });
  };

  const handleRemoveAllowanceEdit = (index: number) => {
    setEditingSlip(prev => {
      if (!prev) return null;
      const allowances = (prev.payroll_item_allowances || []).filter((_, idx) => idx !== index);
      return recalculateSlipTotals({ ...prev, payroll_item_allowances: allowances });
    });
  };

  const handleRemoveDeductionEdit = (index: number) => {
    setEditingSlip(prev => {
      if (!prev) return null;
      const deductions = (prev.payroll_item_deductions || []).filter((_, idx) => idx !== index);
      return recalculateSlipTotals({ ...prev, payroll_item_deductions: deductions });
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSlip || !originalSlip) return;
    
    setIsSavingEdit(true);
    try {
      const originalAllowanceIds = (originalSlip.payroll_item_allowances || [])
        .map(a => a.id)
        .filter((id): id is string => !!id && !id.startsWith("new-"));
      const currentAllowanceIds = (editingSlip.payroll_item_allowances || [])
        .map(a => a.id);
      const deletedAllowanceIds = originalAllowanceIds.filter(id => !currentAllowanceIds.includes(id));
      
      const originalDeductionIds = (originalSlip.payroll_item_deductions || [])
        .map(d => d.id)
        .filter((id): id is string => !!id && !id.startsWith("new-"));
      const currentDeductionIds = (editingSlip.payroll_item_deductions || [])
        .map(d => d.id);
      const deletedDeductionIds = originalDeductionIds.filter(id => !currentDeductionIds.includes(id));
      
      const promises = [];
      
      if (deletedAllowanceIds.length > 0) {
        promises.push(
          supabase.from("payroll_item_allowances").delete().in("id", deletedAllowanceIds)
        );
      }
      if (deletedDeductionIds.length > 0) {
        promises.push(
          supabase.from("payroll_item_deductions").delete().in("id", deletedDeductionIds)
        );
      }
      
      const allowancesToUpsert = (editingSlip.payroll_item_allowances || []).map(alw => {
        const { id, payroll_item_id, allowance_type_id, nama, metode, qty, nominal, subtotal } = alw as any;
        const isNew = !id || id.startsWith("new-");
        return {
          ...(isNew ? {} : { id }),
          payroll_item_id,
          allowance_type_id: allowance_type_id || null,
          nama,
          metode: metode || "manual",
          qty: Number(qty || 0),
          nominal: Number(nominal || 0),
          subtotal: Number(subtotal || 0)
        };
      });
      
      if (allowancesToUpsert.length > 0) {
        promises.push(
          supabase.from("payroll_item_allowances").upsert(allowancesToUpsert)
        );
      }
      
      const deductionsToUpsert = (editingSlip.payroll_item_deductions || []).map(ded => {
        const { id, payroll_item_id, deduction_type_id, nama, metode, qty, nominal, subtotal } = ded as any;
        const isNew = !id || id.startsWith("new-");
        return {
          ...(isNew ? {} : { id }),
          payroll_item_id,
          deduction_type_id: deduction_type_id || null,
          nama,
          metode: metode || "manual",
          qty: Number(qty || 0),
          nominal: Number(nominal || 0),
          subtotal: Number(subtotal || 0)
        };
      });
      
      if (deductionsToUpsert.length > 0) {
        promises.push(
          supabase.from("payroll_item_deductions").upsert(deductionsToUpsert)
        );
      }
      
      promises.push(
        supabase
          .from("payroll_items")
          .update({
            gaji_pokok: Number(editingSlip.gaji_pokok || 0),
            total_tunjangan: Number(editingSlip.total_tunjangan || 0),
            total_potongan: Number(editingSlip.total_potongan || 0),
            gaji_bersih: Number(editingSlip.gaji_bersih || 0)
          })
          .eq("id", editingSlip.id)
      );
      
      const results = await Promise.all(promises);
      
      for (const res of results) {
        if (res.error) {
          throw res.error;
        }
      }
      
      toast.success("Rincian payroll berhasil diperbarui!");
      queryClient.invalidateQueries({ queryKey: ["payroll_items"] });
      setIsEditOpen(false);
      setEditingSlip(null);
      setOriginalSlip(null);
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal menyimpan perubahan: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_items").delete().eq("id", id);

      if (error) throw error;

      return id;
    },
    onSuccess: (id) => {
      toast.success("Slip gaji berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["payroll_items"] });
      setSelectedSlipIds((prev) => prev.filter((prevId) => prevId !== id));
    },
    onError: (error) => {
      console.error(error);
      toast.error("Gagal menghapus slip gaji");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("payroll_items").delete().in("id", ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (ids) => {
      toast.success(`Berhasil menghapus ${ids.length} slip gaji.`);
      queryClient.invalidateQueries({ queryKey: ["payroll_items"] });
      setSelectedSlipIds((prev) => prev.filter((id) => !ids.includes(id)));
    },
    onError: (error) => {
      console.error(error);
      toast.error("Gagal menghapus slip gaji.");
    },
  });

  const handleBulkDelete = () => {
    if (selectedSlipIds.length === 0) {
      return toast.error("Pilih minimal satu slip gaji untuk dihapus.");
    }
    const confirmation = window.confirm(
      `Apakah Anda yakin ingin menghapus ${selectedSlipIds.length} slip gaji terpilih?`
    );
    if (!confirmation) return;

    bulkDeleteMutation.mutate(selectedSlipIds);
  };

  const allFilteredSlipIds = useMemo(
    () => filteredPayrollItems.map((slip: SlipItem) => slip.id),
    [filteredPayrollItems],
  );

  const isAllSelected = selectedSlipIds.length > 0 && selectedSlipIds.length === allFilteredSlipIds.length;

  useEffect(() => {
    setSelectedSlipIds((prev) => prev.filter((id) => allFilteredSlipIds.includes(id)));
  }, [allFilteredSlipIds]);

  const toggleSlipSelection = (slipId: string) => {
    setSelectedSlipIds((prev) =>
      prev.includes(slipId) ? prev.filter((id) => id !== slipId) : [...prev, slipId],
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSlipIds([]);
    } else {
      setSelectedSlipIds(allFilteredSlipIds);
    }
  };

  const handleExportJPG = async (slip: SlipItem, skipLoadingState = false) => {
    if (!skipLoadingState) setLoading(`JPG-${slip.id}`);

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

      if (!skipLoadingState) toast.success("JPG slip gaji berhasil diunduh");
    } catch (error) {
      console.error("Gagal membuat JPG:", error);
      if (skipLoadingState) throw error;
      toast.error("Gagal membuat JPG slip gaji");
    } finally {
      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }

      if (!skipLoadingState) setLoading(null);
    }
  };

  const handleExportPDF = async (slip: SlipItem, skipLoadingState = false) => {
    if (!skipLoadingState) setLoading(`PDF-${slip.id}`);

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

      if (!skipLoadingState) toast.success("PDF slip gaji berhasil diunduh");
    } catch (error) {
      console.error("Gagal membuat PDF:", error);
      if (skipLoadingState) throw error;
      toast.error("Gagal membuat PDF slip gaji");
    } finally {
      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }

      if (!skipLoadingState) setLoading(null);
    }
  };

  const handleWAText = async (slip: SlipItem, skipLoadingState = false) => {
    const phone = slip.employees?.whatsapp;
    const normalizedPhone = normalizeWhatsappNumber(phone);

    if (!normalizedPhone) {
      const errMsg = "Nomor WhatsApp karyawan belum diisi";
      if (skipLoadingState) throw new Error(errMsg);
      toast.error(errMsg);
      return;
    }

    const msg = formatWhatsAppMessage(waTemplate ?? null, slip);

    if (gatewayStatus?.status === "connected") {
      if (!skipLoadingState) setLoading(`WA-TXT-${slip.id}`);
      try {
        const response = await fetch("http://localhost:5000/api/send-message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: normalizedPhone,
            message: msg,
          }),
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
          if (!skipLoadingState) toast.success(`Slip gaji teks berhasil dikirim langsung ke ${slip.employees?.nama}`);
          await updateSlipStatusMutation.mutateAsync(slip.id);
        } else {
          throw new Error(resData.error || "Gagal mengirim pesan");
        }
      } catch (err: any) {
        console.error("Direct send failed, falling back to redirect:", err);
        if (skipLoadingState) throw err;
        toast.error(`Kirim langsung gagal: ${err.message}. Mengalihkan ke WhatsApp Web...`);
        // Fallback
        const waUrl = getWhatsappUrl(phone, msg);
        window.open(waUrl, "_blank", "noopener,noreferrer");
      } finally {
        if (!skipLoadingState) setLoading(null);
      }
    } else {
      // Fallback behavior (standard redirect)
      if (skipLoadingState) {
        const waUrl = getWhatsappUrl(phone, msg);
        window.open(waUrl, "_blank", "noopener,noreferrer");
        await updateSlipStatusMutation.mutateAsync(slip.id);
      } else {
        const waUrl = getWhatsappUrl(phone, msg);
        window.open(waUrl, "_blank", "noopener,noreferrer");
        toast.success(`WhatsApp dibuka ke nomor ${normalizedPhone} (Manual Redirect)`);
        updateSlipStatusMutation.mutate(slip.id);
      }
    }
  };

  const handleWAImage = async (slip: SlipItem, skipLoadingState = false) => {
    const phone = slip.employees?.whatsapp;
    const normalizedPhone = normalizeWhatsappNumber(phone);

    if (!normalizedPhone) {
      const errMsg = "Nomor WhatsApp karyawan belum diisi";
      if (skipLoadingState) throw new Error(errMsg);
      toast.error(errMsg);
      return;
    }

    if (!skipLoadingState) setLoading(`WA-IMG-${slip.id}`);

    // If not connected, open tab early to prevent popup block, otherwise we do direct fetch in background
    let waTab: Window | null = null;
    if (gatewayStatus?.status !== "connected" && !skipLoadingState) {
      waTab = window.open("", "_blank");
    }

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
      const msg = formatWhatsAppMessage(waTemplate ?? null, slip);

      if (gatewayStatus?.status === "connected") {
        // Direct Send via Local Gateway Backend
        const response = await fetch("http://localhost:5000/api/send-message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: normalizedPhone,
            message: msg,
            image: dataUrl,
          }),
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
          if (!skipLoadingState) toast.success(`Slip gaji gambar berhasil dikirim langsung ke ${slip.employees?.nama}`);
          await updateSlipStatusMutation.mutateAsync(slip.id);
        } else {
          throw new Error(resData.error || "Gagal mengirim pesan gambar");
        }
      } else {
        // Manual Redirect Fallback
        downloadDataUrl(dataUrl, getSlipFileName(slip, "jpg"));

        const manualMsg =
          msg + "\n\n" +
          `File JPG slip gaji sudah terunduh dari sistem. Silakan lampirkan gambar slip gaji tersebut di chat ini.`;

        const waUrl = getWhatsappUrl(phone, manualMsg);

        if (skipLoadingState) {
          window.open(waUrl, "_blank");
        } else {
          if (waTab) {
            waTab.location.href = waUrl;
          } else {
            window.open(waUrl, "_blank");
          }
        }

        if (!skipLoadingState) toast.success(`JPG diunduh dan WhatsApp dibuka ke nomor ${normalizedPhone}`);
        await updateSlipStatusMutation.mutateAsync(slip.id);
      }
    } catch (error: any) {
      console.error("Gagal membuat/mengirim slip untuk WA:", error);
      if (skipLoadingState) throw error;
      toast.error(`Gagal mengirim WhatsApp: ${error.message || error}`);

      if (waTab) {
        waTab.close();
      }
    } finally {
      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }

      if (!skipLoadingState) setLoading(null);
    }
  };

  // Bulk actions trigger
  const startBulkProcess = (type: "wa-txt" | "wa-img" | "pdf" | "jpg") => {
    if (selectedSlipIds.length === 0) {
      toast.error("Pilih minimal satu slip gaji untuk memproses massal.");
      return;
    }

    if (gatewayStatus?.status !== "connected" && (type === "wa-txt" || type === "wa-img")) {
      const confirm = window.confirm(
        "WhatsApp Gateway lokal belum terhubung. Pengiriman massal akan membuka tab browser WhatsApp Web satu per satu untuk setiap karyawan. Apakah Anda yakin ingin melanjutkan?"
      );
      if (!confirm) return;
    }

    const itemsToProcess = filteredPayrollItems.filter((slip) =>
      selectedSlipIds.includes(slip.id)
    );

    setBulkProcess({
      active: true,
      type,
      items: itemsToProcess,
      currentIndex: 0,
      isPaused: false,
      results: itemsToProcess.map((item) => ({
        slipId: item.id,
        employeeName: item.employees?.nama || "Karyawan",
        status: "pending",
      })),
    });
  };

  // Runner for bulk loop
  const runBulkProcess = async () => {
    if (!bulkProcess.active || bulkProcess.type === null || bulkProcess.isPaused) return;

    // Find the first pending item
    const index = bulkProcess.results.findIndex((r) => r.status === "pending");
    if (index === -1) {
      toast.success("Proses massal selesai!");
      return;
    }

    // Set this index to processing
    setBulkProcess((prev) => {
      const newResults = [...prev.results];
      newResults[index] = { ...newResults[index], status: "processing" };
      return {
        ...prev,
        currentIndex: index,
        results: newResults,
      };
    });

    const slip = bulkProcess.items[index];
    let success = false;
    let errorMsg = "";

    try {
      if (bulkProcess.type === "wa-txt") {
        await handleWAText(slip, true);
      } else if (bulkProcess.type === "wa-img") {
        await handleWAImage(slip, true);
      } else if (bulkProcess.type === "pdf") {
        await handleExportPDF(slip, true);
        await new Promise((resolve) => setTimeout(resolve, 800)); // Delay between downloads to prevent popup blocks
      } else if (bulkProcess.type === "jpg") {
        await handleExportJPG(slip, true);
        await new Promise((resolve) => setTimeout(resolve, 600)); // Delay between downloads
      }
      success = true;
    } catch (err: any) {
      console.error(err);
      errorMsg = err.message || "Gagal memproses";
    }

    setBulkProcess((prev) => {
      const newResults = [...prev.results];
      newResults[index] = {
        ...newResults[index],
        status: success ? "success" : "error",
        error: errorMsg || undefined,
      };
      return {
        ...prev,
        results: newResults,
      };
    });
  };

  // Trigger bulk execution whenever state changes
  useEffect(() => {
    if (bulkProcess.active && !bulkProcess.isPaused) {
      const nextPendingIndex = bulkProcess.results.findIndex((r) => r.status === "pending");
      const isCurrentlyProcessing = bulkProcess.results.some((r) => r.status === "processing");
      
      if (nextPendingIndex !== -1 && !isCurrentlyProcessing) {
        runBulkProcess();
      }
    }
  }, [bulkProcess.active, bulkProcess.results, bulkProcess.isPaused]);

  const cancelBulkProcess = () => {
    setBulkProcess({
      active: false,
      type: null,
      items: [],
      currentIndex: 0,
      results: [],
      isPaused: false
    });
    queryClient.invalidateQueries({ queryKey: ["payroll_items"] });
  };

  // Live Template Customizer
  const openTemplateDialog = () => {
    if (appSettings) {
      setTempTemplateConfig(getSlipTemplateConfig(appSettings.slip_template_config));
      setTempNamaPerusahaan(appSettings.nama_perusahaan ?? "");
      setTempAlamat(appSettings.alamat ?? "");
      setTempFooterSlip(appSettings.footer_slip ?? "");
    } else {
      setTempTemplateConfig(defaultSlipTemplateConfig);
      setTempNamaPerusahaan("Nama Perusahaan");
      setTempAlamat("");
      setTempFooterSlip("");
    }
    setIsTemplateDialogOpen(true);
  };

  const renderConfigCheckbox = (key: keyof SlipTemplateConfig, label: string) => {
    return (
      <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors cursor-pointer select-none">
        <Checkbox
          checked={Boolean(tempTemplateConfig[key])}
          onCheckedChange={(checked) =>
            setTempTemplateConfig((current) => ({ ...current, [key]: checked === true }))
          }
        />
        {label}
      </label>
    );
  };

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        id: 1,
        nama_perusahaan: tempNamaPerusahaan || "Nama Perusahaan",
        alamat: tempAlamat,
        footer_slip: tempFooterSlip,
        slip_template_config: tempTemplateConfig,
      } as any;

      const { error } = await supabase.from("app_settings").upsert(payload, {
        onConflict: "id",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Desain template slip gaji berhasil diperbarui!");
      setIsTemplateDialogOpen(false);
    },
    onError: (error) => {
      console.error("Gagal menyimpan template:", error);
      toast.error("Gagal menyimpan desain template slip gaji");
    }
  });

  const selectedBranchName =
    selectedBranch === "all"
      ? "Semua Cabang"
      : branches.find((branch) => branch.id === selectedBranch)?.nama || "Cabang Terpilih";
  const selectedMonthName = BULAN_LABELS[selectedMonth] || selectedMonth;

  return (
    <>
      <PageHeader
        title="Slip Gaji"
        description={`Kelola, preview, unduh, dan kirim slip gaji untuk ${selectedBranchName} periode ${selectedMonthName} ${selectedYear}.`}
        actions={
          <div className="flex items-center gap-2">
            {gatewayStatus?.status === "connected" ? (
              <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 flex items-center text-xs py-1 px-3 border-none shadow-sm font-semibold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Direct WA Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500 border-slate-200 gap-1.5 flex items-center text-xs py-1 px-3 bg-slate-50/50 font-semibold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                Redirect WA Mode
              </Badge>
            )}
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Statistics Panel */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
              <Wallet className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Gaji Bersih</p>
              <h3 className="text-lg font-bold text-slate-800">{formatIDR(stats.totalNetPay)}</h3>
              <p className="text-[10px] text-slate-400 font-medium">{stats.totalItems} Karyawan Terfilter</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
              <Users className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Jumlah Slip Gaji</p>
              <h3 className="text-lg font-bold text-slate-800">{stats.totalItems}</h3>
              <p className="text-[10px] text-slate-400 font-medium">Slip aktif periode ini</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Slip Terkirim</p>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{stats.sentPercentage}%</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{stats.sentCount}</h3>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.sentPercentage}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Belum Terkirim</p>
              <h3 className="text-lg font-bold text-slate-800">{stats.pendingCount}</h3>
              <p className="text-[10px] text-amber-600 font-semibold bg-amber-50 rounded-full px-2 py-0.5 inline-block">Butuh Tindakan</p>
            </div>
          </div>
        </div>

        {/* Filters and Actions Toolbar */}
        <div className="flex flex-col gap-4 bg-slate-50 border border-slate-200/80 rounded-xl p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-4 justify-between w-full">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 font-semibold uppercase">Tahun</Label>
                <Select
                  value={String(selectedYear)}
                  onValueChange={(val) => setSelectedYear(Number(val))}
                >
                  <SelectTrigger className="w-[110px] h-9 bg-white border border-slate-200 shadow-sm focus:ring-0 text-sm font-semibold text-slate-700">
                    <SelectValue placeholder="Pilih Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 font-semibold uppercase">Bulan</Label>
                <Select
                  value={selectedMonth}
                  onValueChange={setSelectedMonth}
                >
                  <SelectTrigger className="w-[140px] h-9 bg-white border border-slate-200 shadow-sm focus:ring-0 text-sm font-semibold text-slate-700">
                    <SelectValue placeholder="Pilih Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BULAN_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 font-semibold uppercase">Cabang</Label>
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 h-9 shadow-sm">
                  <Store className="w-4 h-4 text-slate-400 ml-1" />
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-[160px] h-8 border-0 bg-transparent shadow-none focus:ring-0 text-sm font-semibold text-slate-700">
                      <SelectValue placeholder="Semua Cabang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Cabang</SelectItem>
                      {branches.map((branch: Branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 font-semibold uppercase">Cari Karyawan</Label>
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-450" />
                  <Input
                    placeholder="Cari nama karyawan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 bg-white border border-slate-200 shadow-sm text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openTemplateDialog}
                className="h-9 gap-2 border border-slate-200 bg-white shadow-sm hover:bg-slate-50 font-semibold text-slate-700 transition-colors"
              >
                <Sliders className="h-4 w-4 text-slate-500" />
                Desain Slip
              </Button>
            </div>
          </div>

          <div className="border-t border-slate-200/60 pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={statusTab} onValueChange={(val) => setStatusTab(val as any)} className="w-full sm:w-auto">
              <TabsList className="bg-slate-200/50 p-0.5 border border-slate-200/50 rounded-lg">
                <TabsTrigger value="all" className="rounded-md text-xs py-1 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-slate-650 font-semibold">Semua</TabsTrigger>
                <TabsTrigger value="pending" className="rounded-md text-xs py-1 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-slate-650 font-semibold">Belum Terkirim</TabsTrigger>
                <TabsTrigger value="sent" className="rounded-md text-xs py-1 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-slate-650 font-semibold">Terkirim</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {selectedSlipIds.length > 0 && (
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 animate-in fade-in-50 slide-in-from-bottom-1">
                  <Badge variant="secondary" className="h-6 text-[10px] font-bold tracking-wider bg-indigo-100 text-indigo-700">
                    {selectedSlipIds.length} TERPILIH
                  </Badge>
                  
                  <div className="w-px h-5 bg-indigo-200/60" />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-3 gap-1.5 font-bold shadow-sm transition-colors"
                        disabled={!!loading || bulkProcess.active}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Kirim WA
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 border-slate-200">
                      <DropdownMenuItem
                        onClick={() => startBulkProcess("wa-txt")}
                        className="gap-2 text-xs font-semibold text-slate-700 cursor-pointer rounded-lg py-2"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-650" />
                        Kirim WA Teks Massal
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => startBulkProcess("wa-img")}
                        className="gap-2 text-xs font-semibold text-slate-700 cursor-pointer rounded-lg py-2"
                      >
                        <Send className="h-3.5 w-3.5 text-emerald-650" />
                        Kirim WA Gambar Massal
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-3 gap-1.5 border border-slate-200 bg-white shadow-sm hover:bg-slate-50 font-bold text-slate-700 transition-colors"
                        disabled={!!loading || bulkProcess.active}
                      >
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                        Unduh
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 border-slate-200">
                      <DropdownMenuItem
                        onClick={() => startBulkProcess("pdf")}
                        className="gap-2 text-xs font-semibold text-slate-700 cursor-pointer rounded-lg py-2"
                      >
                        <FileText className="h-3.5 w-3.5 text-blue-600" />
                        Unduh PDF Massal
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => startBulkProcess("jpg")}
                        className="gap-2 text-xs font-semibold text-slate-700 cursor-pointer rounded-lg py-2"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-purple-650" />
                        Unduh JPG Massal
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending || !!loading || bulkProcess.active}
                    className="h-7 text-xs px-3 gap-1 border border-rose-250 hover:bg-rose-50 text-rose-600 font-bold transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-base font-bold text-slate-800">Daftar Slip Gaji</div>
              <div className="text-xs text-slate-500 font-medium">
                Tampilan slip otomatis menyesuaikan dengan format template aktif.
              </div>
            </div>
          </div>

          <Table className="min-w-full border-separate border-spacing-0">
            <TableHeader>
              <TableRow className="bg-slate-50 text-slate-600">
                <TableHead className="w-12 px-4 py-3">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Pilih semua slip"
                  />
                </TableHead>
                <TableHead className="py-3 px-4 text-left text-xs uppercase tracking-[0.16em] text-slate-500 font-bold">
                  Nama Karyawan
                </TableHead>
                <TableHead className="py-3 px-4 text-left text-xs uppercase tracking-[0.16em] text-slate-500 font-bold">
                  Cabang
                </TableHead>
                <TableHead className="py-3 px-4 text-left text-xs uppercase tracking-[0.16em] text-slate-500 font-bold">
                  Periode
                </TableHead>
                <TableHead className="py-3 px-4 text-left text-xs uppercase tracking-[0.16em] text-slate-500 font-bold">
                  Status WA
                </TableHead>
                <TableHead className="py-3 px-4 text-right text-xs uppercase tracking-[0.16em] text-slate-500 font-bold">
                  THP
                </TableHead>
                <TableHead className="py-3 px-4 text-right text-xs uppercase tracking-[0.16em] text-slate-500 font-bold">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-500 font-medium text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memuat data slip gaji...
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {isError && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-red-500 font-semibold text-sm">
                    Gagal memuat data slip gaji.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !isError && filteredPayrollItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-slate-450 font-semibold text-sm">
                    {payrollItems.length === 0
                      ? "Belum ada data slip gaji."
                      : "Tidak ada slip gaji untuk filter yang dipilih. Coba cari nama lain atau ubah filter."}
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                !isError &&
                filteredPayrollItems.map((slip: SlipItem) => {
                  const isSelected = selectedSlipIds.includes(slip.id);
                  const isSlipLoading = !!loading && loading.includes(slip.id);

                  return (
                    <TableRow
                      key={slip.id}
                      className={`group transition-colors ${
                        isSelected ? "bg-indigo-50/20" : "hover:bg-slate-55/30"
                      }`}
                    >
                      <TableCell className="px-4 py-3.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSlipSelection(slip.id)}
                          aria-label={`Pilih slip ${slip.employees?.nama || "-"}`}
                        />
                      </TableCell>
                      <TableCell className="font-bold py-3.5 px-4 text-slate-700 text-sm">
                        {slip.employees?.nama || "-"}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-slate-600 text-sm">
                        {slip.employees?.branches?.nama || "-"}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-slate-650 text-sm font-medium">
                        {slip.payroll_runs?.periode || "-"}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-sm">
                        {slip.slip_dibuat ? (
                          <Badge variant="secondary" className="bg-emerald-50 hover:bg-emerald-50 text-emerald-700 border-emerald-250/50 font-bold gap-1 py-0.5 px-2 text-[11px] border">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Terkirim
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-55/60 hover:bg-amber-55/60 text-amber-700 border-amber-250/50 font-bold gap-1 py-0.5 px-2 text-[11px] border">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Belum Terkirim
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right font-extrabold py-3.5 px-4 text-slate-800 text-sm">
                        {formatIDR(toNumber(slip.gaji_bersih))}
                      </TableCell>

                      <TableCell className="px-4">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewSlip(slip)}
                            title="Preview slip"
                            className="h-8 w-8 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Eye className="h-4 w-4 text-slate-600" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-slate-100 rounded-lg transition-colors"
                                disabled={!!loading}
                              >
                                {isSlipLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4 text-slate-600" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-md border-slate-200">
                              <DropdownMenuItem
                                onClick={() => handleWAText(slip)}
                                disabled={!!loading}
                                className="gap-2.5 text-sm text-slate-700 cursor-pointer rounded-lg py-2 font-semibold"
                              >
                                <MessageSquare className="h-4 w-4 text-emerald-600" />
                                Kirim WA Teks
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleWAImage(slip)}
                                disabled={!!loading}
                                className="gap-2.5 text-sm text-slate-700 cursor-pointer rounded-lg py-2 font-semibold"
                              >
                                <Send className="h-4 w-4 text-emerald-600" />
                                Kirim WA Gambar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1 border-slate-100" />
                              <DropdownMenuItem
                                onClick={() => handleExportPDF(slip)}
                                disabled={!!loading}
                                className="gap-2.5 text-sm text-slate-700 cursor-pointer rounded-lg py-2 font-semibold"
                              >
                                <FileText className="h-4 w-4 text-blue-500" />
                                Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleExportJPG(slip)}
                                disabled={!!loading}
                                className="gap-2.5 text-sm text-slate-700 cursor-pointer rounded-lg py-2 font-semibold"
                              >
                                <ImageIcon className="h-4 w-4 text-purple-500" />
                                Download JPG
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1 border-slate-100" />
                              <DropdownMenuItem
                                onClick={() => {
                                  setOriginalSlip(slip);
                                  setEditingSlip(JSON.parse(JSON.stringify(slip)));
                                  setIsEditOpen(true);
                                }}
                                disabled={!!loading}
                                className="gap-2.5 text-sm text-slate-700 cursor-pointer rounded-lg py-2 font-semibold"
                              >
                                <Sliders className="h-4 w-4 text-amber-500" />
                                Edit Rincian
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  const confirmation = window.confirm(
                                    `Apakah Anda yakin ingin menghapus slip gaji ${slip.employees?.nama || "-"}?`
                                  );
                                  if (confirmation) {
                                    deleteMutation.mutate(slip.id);
                                  }
                                }}
                                disabled={!!loading}
                                className="gap-2.5 text-sm text-rose-600 focus:bg-rose-50 focus:text-rose-700 cursor-pointer rounded-lg py-2 font-semibold"
                              >
                                <Trash2 className="h-4 w-4" />
                                Hapus Slip
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        {/* Bulk processing Queue Dialog */}
        <Dialog open={bulkProcess.active} onOpenChange={() => {}}>
          <DialogContent className="max-w-md border-slate-200 shadow-xl rounded-xl p-0 overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  {bulkProcess.type?.startsWith("wa") ? (
                    <MessageSquare className="h-5 w-5" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold text-slate-800">
                    {bulkProcess.type === "wa-txt" && "Kirim WA Teks Massal"}
                    {bulkProcess.type === "wa-img" && "Kirim WA Gambar Massal"}
                    {bulkProcess.type === "pdf" && "Unduh PDF Massal"}
                    {bulkProcess.type === "jpg" && "Unduh JPG Massal"}
                  </DialogTitle>
                  <p className="text-[11px] text-slate-500 font-semibold">Memproses antrean slip gaji</p>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={cancelBulkProcess}
                className="h-8 w-8 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4">
              {/* Progress Summary */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>Progres Keseluruhan</span>
                  <span>
                    {bulkProcess.results.filter(r => r.status === "success" || r.status === "error").length} / {bulkProcess.items.length} Selesai
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{
                      width: `${(bulkProcess.results.filter(r => r.status === "success" || r.status === "error").length / bulkProcess.items.length) * 100}%`
                    }}
                  />
                </div>
              </div>

              {/* Status details scroll area */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 px-3.5 py-2 border-b border-slate-200 bg-slate-100/50">
                  Detail Antrean
                </div>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {bulkProcess.results.map((result, idx) => {
                    const isCurrent = idx === bulkProcess.currentIndex && result.status === "processing";
                    return (
                      <div
                        key={result.slipId}
                        className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors ${
                          isCurrent ? "bg-indigo-50/30" : ""
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-bold text-slate-705 truncate text-xs">{result.employeeName}</span>
                          {result.error && (
                            <span className="text-[10px] text-rose-500 font-semibold truncate mt-0.5">
                              Error: {result.error}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center">
                          {result.status === "pending" && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-full">
                              Antrean
                            </span>
                          )}
                          {result.status === "processing" && (
                            <span className="text-[10px] font-bold text-indigo-650 uppercase bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <Loader2 className="h-3 w-3 animate-spin" /> Proses
                            </span>
                          )}
                          {result.status === "success" && (
                            <span className="text-[10px] font-bold text-emerald-750 uppercase bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Sukses
                            </span>
                          )}
                          {result.status === "error" && (
                            <span className="text-[10px] font-bold text-rose-750 uppercase bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <X className="h-3 w-3 text-rose-500" /> Gagal
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2">
              {bulkProcess.results.some(r => r.status === "pending" || r.status === "processing") ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkProcess(prev => ({ ...prev, isPaused: !prev.isPaused }))}
                  className="h-8 gap-1.5 text-xs font-semibold transition-colors"
                >
                  {bulkProcess.isPaused ? (
                    <>
                      <Play className="h-3.5 w-3.5 text-emerald-600" />
                      Lanjutkan
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5 text-amber-600" />
                      Jeda
                    </>
                  )}
                </Button>
              ) : null}
              <Button
                onClick={cancelBulkProcess}
                size="sm"
                className="h-8 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white"
              >
                Tutup
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Live Template Customizer Dialog */}
        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden border-slate-200 shadow-xl rounded-xl">
            <DialogHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/50">
              <div>
                <DialogTitle className="text-base font-bold text-slate-800">Kustomisasi Template Slip Gaji</DialogTitle>
                <p className="text-xs text-slate-500 mt-1">Ubah tata letak, warna aksen, ukuran font, dan komponen slip gaji secara langsung.</p>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
              {/* Form Editor Column */}
              <div className="md:col-span-5 border-r border-slate-200 overflow-y-auto p-6 space-y-6 bg-white">
                
                {/* Tata Letak */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tata Letak & Gaya</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["classic", "compact", "borderless"] as const).map((lay) => (
                      <button
                        key={lay}
                        type="button"
                        onClick={() => setTempTemplateConfig(prev => ({ ...prev, layout: lay }))}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all text-center capitalize ${
                          tempTemplateConfig.layout === lay
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                            : "border-slate-200 hover:bg-slate-50 text-slate-650"
                        }`}
                      >
                        {lay}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ukuran Font */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Ukuran Font</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["small", "normal", "large"] as const).map((fs) => (
                      <button
                        key={fs}
                        type="button"
                        onClick={() => setTempTemplateConfig(prev => ({ ...prev, fontSize: fs }))}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all text-center capitalize ${
                          tempTemplateConfig.fontSize === fs
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                            : "border-slate-200 hover:bg-slate-50 text-slate-650"
                        }`}
                      >
                        {fs}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Warna Aksen */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Warna Aksen</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={tempTemplateConfig.accentColor}
                      onChange={(e) => setTempTemplateConfig(prev => ({ ...prev, accentColor: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {["#000000", "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setTempTemplateConfig(prev => ({ ...prev, accentColor: color }))}
                          className="w-6 h-6 rounded-full border border-slate-200 shadow-sm hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Checklist Komponen */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Komponen Slip</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {renderConfigCheckbox("showCompanyName", "Tampilkan Nama Perusahaan")}
                    {renderConfigCheckbox("showCompanyAddress", "Tampilkan Alamat Perusahaan")}
                    {renderConfigCheckbox("showEmployeeName", "Tampilkan Nama Karyawan")}
                    {renderConfigCheckbox("showBranch", "Tampilkan Cabang")}
                    {renderConfigCheckbox("showPeriod", "Tampilkan Periode")}
                    {renderConfigCheckbox("showBaseSalary", "Tampilkan Gaji Pokok")}
                    {renderConfigCheckbox("showAllowance", "Tampilkan Bagian Tunjangan")}
                    {renderConfigCheckbox("showAllowanceDetails", "Tampilkan Rincian Tunjangan")}
                    {renderConfigCheckbox("showDeduction", "Tampilkan Bagian Potongan")}
                    {renderConfigCheckbox("showDeductionDetails", "Tampilkan Rincian Potongan")}
                    {renderConfigCheckbox("showNetSalary", "Tampilkan Total Bersih (THP)")}
                    {renderConfigCheckbox("showSignature", "Tampilkan Kolom Tanda Tangan")}
                    {renderConfigCheckbox("showFooter", "Tampilkan Catatan Kaki (Footer)")}
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Teks Perusahaan */}
                <div className="space-y-4">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Informasi Perusahaan & Ttd</Label>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-650 font-bold">Nama Perusahaan</Label>
                    <Input
                      value={tempNamaPerusahaan}
                      onChange={(e) => setTempNamaPerusahaan(e.target.value)}
                      className="bg-white border-slate-200 h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-650 font-bold">Alamat Perusahaan</Label>
                    <textarea
                      rows={2}
                      value={tempAlamat}
                      onChange={(e) => setTempAlamat(e.target.value)}
                      className="w-full text-sm rounded-lg border border-slate-250 bg-white p-2.5 outline-none focus:border-slate-350"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-650 font-bold">Teks Kaki (Footer)</Label>
                    <textarea
                      rows={2}
                      value={tempFooterSlip}
                      onChange={(e) => setTempFooterSlip(e.target.value)}
                      className="w-full text-sm rounded-lg border border-slate-250 bg-white p-2.5 outline-none focus:border-slate-350"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-650 font-bold">Label Ttd Kiri</Label>
                      <Input
                        value={tempTemplateConfig.leftSignatureLabel}
                        onChange={(e) => setTempTemplateConfig(prev => ({ ...prev, leftSignatureLabel: e.target.value }))}
                        className="bg-white border-slate-200 h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-650 font-bold">Nama Ttd Kiri</Label>
                      <Input
                        value={tempTemplateConfig.leftSignatureName}
                        onChange={(e) => setTempTemplateConfig(prev => ({ ...prev, leftSignatureName: e.target.value }))}
                        className="bg-white border-slate-200 h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-650 font-bold">Label Ttd Kanan</Label>
                    <Input
                      value={tempTemplateConfig.rightSignatureLabel}
                      onChange={(e) => setTempTemplateConfig(prev => ({ ...prev, rightSignatureLabel: e.target.value }))}
                      className="bg-white border-slate-200 h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Column */}
              <div className="md:col-span-7 bg-slate-100 flex flex-col overflow-hidden">
                <div className="bg-slate-200/50 px-6 py-3 border-b border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" /> Live Preview
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold bg-slate-200 px-2 py-0.5 rounded-full">
                    A4/A5 Render Canvas
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
                  <div className="shadow-lg rounded-sm bg-white overflow-hidden border border-slate-200">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: getRawHtmlTemplate(mockPreviewSlip, {
                          nama_perusahaan: tempNamaPerusahaan,
                          alamat: tempAlamat,
                          footer_slip: tempFooterSlip,
                          slip_template_config: tempTemplateConfig
                        }),
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTemplateDialogOpen(false)}
                className="h-9 px-4 font-semibold border-slate-250 text-slate-700 bg-white"
              >
                Batal
              </Button>
              <Button
                onClick={() => saveTemplateMutation.mutate()}
                disabled={saveTemplateMutation.isPending}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-5 font-bold gap-1.5 shadow-sm"
              >
                {saveTemplateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Simpan & Terapkan
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Rincian Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl shadow-xl border border-slate-100 bg-white">
            <DialogHeader className="border-b border-slate-100 pb-4 mb-4">
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                Edit Rincian Payroll
              </DialogTitle>
              <div className="text-xs text-slate-500 mt-1">
                Karyawan: <strong className="text-slate-800">{editingSlip?.employees?.nama}</strong> | 
                Jabatan: <strong className="text-slate-800">{editingSlip?.employees?.jabatan}</strong> | 
                Periode: <strong className="text-slate-800">{editingSlip?.payroll_runs?.periode}</strong>
              </div>
            </DialogHeader>

            {editingSlip && (
              <div className="space-y-6">
                {/* Gaji Pokok Section */}
                <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl space-y-2">
                  <h3 className="text-sm font-semibold text-slate-800">Gaji Pokok</h3>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Rp</span>
                      <Input
                        type="text"
                        className="pl-9 h-10 text-sm font-semibold border-slate-200"
                        value={formatNumberDots(editingSlip.gaji_pokok)}
                        onChange={(e) => {
                          const parsed = parseNumberDots(e.target.value);
                          setEditingSlip(prev => prev ? recalculateSlipTotals({ ...prev, gaji_pokok: parsed }) : null);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tunjangan (Allowances) Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      Komponen Tunjangan
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={handleAddAllowanceEdit}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Tunjangan
                    </Button>
                  </div>

                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {(editingSlip.payroll_item_allowances || []).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4 bg-slate-50/30 rounded-lg border border-dashed">
                        Tidak ada komponen tunjangan.
                      </p>
                    ) : (
                      (editingSlip.payroll_item_allowances || []).map((alw, index) => (
                        <div key={alw.id} className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow transition-all group">
                          <Input
                            className="h-8 text-xs font-semibold border-slate-200 flex-[2]"
                            placeholder="Nama Tunjangan"
                            value={alw.nama || ""}
                            onChange={(e) => handleAllowanceChange(index, "nama", e.target.value)}
                          />
                          <div className="flex items-center gap-1 flex-1 min-w-[70px]">
                            <Input
                              type="number"
                              className="h-8 text-xs text-center border-slate-200"
                              placeholder="Qty"
                              value={alw.qty ?? ""}
                              onChange={(e) => handleAllowanceChange(index, "qty", Number(e.target.value))}
                            />
                            <span className="text-[10px] text-slate-400">x</span>
                          </div>
                          <div className="relative flex-1.5 min-w-[120px]">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">Rp</span>
                            <Input
                              type="text"
                              className="h-8 pl-7 text-xs font-medium border-slate-200 text-right"
                              placeholder="Nominal"
                              value={formatNumberDots(alw.nominal)}
                              onChange={(e) => handleAllowanceChange(index, "nominal", parseNumberDots(e.target.value))}
                            />
                          </div>
                          <div className="w-24 text-right text-xs font-semibold text-emerald-600">
                            {formatIDR(alw.subtotal ?? 0)}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveAllowanceEdit(index)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Potongan (Deductions) Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      Komponen Potongan
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={handleAddDeductionEdit}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Potongan
                    </Button>
                  </div>

                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {(editingSlip.payroll_item_deductions || []).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4 bg-slate-50/30 rounded-lg border border-dashed">
                        Tidak ada komponen potongan.
                      </p>
                    ) : (
                      (editingSlip.payroll_item_deductions || []).map((ded, index) => (
                        <div key={ded.id} className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow transition-all group">
                          <Input
                            className="h-8 text-xs font-semibold border-slate-200 flex-[2]"
                            placeholder="Nama Potongan"
                            value={ded.nama || ""}
                            onChange={(e) => handleDeductionChange(index, "nama", e.target.value)}
                          />
                          <div className="flex items-center gap-1 flex-1 min-w-[70px]">
                            <Input
                              type="number"
                              className="h-8 text-xs text-center border-slate-200"
                              placeholder="Qty"
                              value={ded.qty ?? ""}
                              onChange={(e) => handleDeductionChange(index, "qty", Number(e.target.value))}
                            />
                            <span className="text-[10px] text-slate-400">x</span>
                          </div>
                          <div className="relative flex-1.5 min-w-[120px]">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">Rp</span>
                            <Input
                              type="text"
                              className="h-8 pl-7 text-xs font-medium border-slate-200 text-right"
                              placeholder="Nominal"
                              value={formatNumberDots(ded.nominal)}
                              onChange={(e) => handleDeductionChange(index, "nominal", parseNumberDots(e.target.value))}
                            />
                          </div>
                          <div className="w-24 text-right text-xs font-semibold text-rose-600">
                            {formatIDR(ded.subtotal ?? 0)}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveDeductionEdit(index)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Total Summary Footer */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ikhtisar Perhitungan Baru</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-800 pb-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400">Gaji Pokok:</span>
                      <p className="font-bold">{formatIDR(editingSlip.gaji_pokok)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-emerald-400">Total Tunjangan (+):</span>
                      <p className="font-bold text-emerald-300">+{formatIDR(editingSlip.total_tunjangan)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-rose-400">Total Potongan (-):</span>
                      <p className="font-bold text-rose-300">-{formatIDR(editingSlip.total_potongan)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-300">Total Gaji Bersih (Net Salary):</span>
                      <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-white to-indigo-200 mt-1">
                        {formatIDR(editingSlip.gaji_bersih)}
                      </h2>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          setIsEditOpen(false);
                          setEditingSlip(null);
                          setOriginalSlip(null);
                        }}
                        disabled={isSavingEdit}
                        className="h-10 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
                      >
                        Batal
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={isSavingEdit}
                        className="h-10 text-xs font-bold bg-white text-slate-900 hover:bg-teal-50 border border-white/20 shadow-md flex items-center gap-1.5"
                      >
                        {isSavingEdit ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                          </>
                        ) : (
                          <>Simpan Perubahan</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Preview Slip Dialog */}
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
    </>
  );
}
