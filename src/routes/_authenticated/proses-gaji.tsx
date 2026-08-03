import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState, useEffect, useMemo, useRef, ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIDR, formatPeriode, formatNumberDots, parseNumberDots } from "@/lib/format";
import { toast } from "sonner";
import {
  Loader2,
  Calculator,
  Plus,
  Trash2,
  ArrowRight,
  Store,
  Search as SearchIcon,
  Users,
  Coins,
  Percent,
  Wallet,
  RefreshCw,
  Download,
  Upload,
} from "lucide-react";

const loadPayrollDraft = (periode: string) => {
  try {
    if (typeof window === "undefined") return {};
    const data = localStorage.getItem(`payroll_draft_${periode}`);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error("Error loading payroll draft from localStorage", e);
    return {};
  }
};

const savePayrollDraft = (periode: string, employeesData: any[]) => {
  try {
    if (typeof window === "undefined") return;
    const draft: Record<string, any> = {};
    (employeesData || []).forEach((emp) => {
      const hasComponentInputs =
        emp.component_inputs &&
        Object.keys(emp.component_inputs).some((k) => emp.component_inputs[k] !== "");
      const hasCustomAllowances = emp.custom_allowances && emp.custom_allowances.length > 0;
      const hasSalaryIncrease = Number(emp.salary_increase_manual) > 0;

      if (hasComponentInputs || hasCustomAllowances || hasSalaryIncrease) {
        draft[emp.id] = {
          component_inputs: emp.component_inputs || {},
          custom_allowances: emp.custom_allowances || [],
          salary_increase_manual: emp.salary_increase_manual || 0,
        };
      }
    });
    if (Object.keys(draft).length === 0) {
      localStorage.removeItem(`payroll_draft_${periode}`);
    } else {
      localStorage.setItem(`payroll_draft_${periode}`, JSON.stringify(draft));
    }
  } catch (e) {
    console.error("Error saving payroll draft to localStorage", e);
  }
};

const checkIsEligible = (catatan: any, empJabatan: any) => {
  if (!catatan || catatan === "GLOBAL") return true;
  if (typeof catatan !== "string") return true;
  const targetJobdesks = catatan.split(",").map((j) => j.toLowerCase().trim());
  if (typeof empJabatan !== "string") return false;
  return targetJobdesks.includes(empJabatan.toLowerCase().trim());
};

export const Route = createFileRoute("/_authenticated/proses-gaji")({
  component: AppProsesGajiPage,
});

const EVALUATION_PERIOD_MONTHS: Record<string, number> = {
  "3_bulan": 3,
  "6_bulan": 6,
  "12_bulan": 12,
};

const getCurrentPeriode = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getPeriodDate = (periode: string) => {
  if (!periode) return getPeriodDate(getCurrentPeriode());
  const [year, month] = periode.split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
};

const addMonths = (date: Date, months: number) => {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
};

const formatDateInput = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

// Helper function to parse CSV robustly (handling double quotes and commas/semicolons)
const parseCSV = (text: string, delimiter: string = ","): string[][] => {
  const lines: string[][] = [];
  let row: string[] = [""];
  let inQuotes = false;

  let startIndex = 0;
  const firstLineMatch = text.match(/^sep=.\r?\n/);
  if (firstLineMatch) {
    startIndex = firstLineMatch[0].length;
  }

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push("");
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
};

function AppProsesGajiPage() {
  const [employees, setEmployees] = useState<any[]>([]);

  // State Filter Cabang
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    try {
      return (typeof window !== "undefined" && localStorage.getItem("payroll_branch")) || "all";
    } catch {
      return "all";
    }
  });

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailEmp, setDetailEmp] = useState<any | null>(null);
  const [customAllowanceModalOpen, setCustomAllowanceModalOpen] = useState(false);
  const [customAllowanceEmployeeId, setCustomAllowanceEmployeeId] = useState<string | null>(null);
  const [customAllowanceName, setCustomAllowanceName] = useState("");
  const [customAllowanceNominal, setCustomAllowanceNominal] = useState<number | "">("");
  const [periodeGaji, setPeriodeGaji] = useState(() => {
    try {
      return (
        (typeof window !== "undefined" && localStorage.getItem("payroll_periode")) ||
        getCurrentPeriode()
      );
    } catch {
      return getCurrentPeriode();
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const prevPeriodeRef = useRef(periodeGaji);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("payroll_periode", periodeGaji);
      }
    } catch (e) {
      console.error("Error writing to localStorage", e);
    }
  }, [periodeGaji]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("payroll_branch", selectedBranchId);
      }
    } catch (e) {
      console.error("Error writing to localStorage", e);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (employees.length > 0) {
      savePayrollDraft(periodeGaji, employees);
    }
  }, [employees, periodeGaji]);

  const hasLocalDraft = useMemo(() => {
    return employees.some((emp) => {
      const hasComponentInputs =
        emp.component_inputs &&
        Object.keys(emp.component_inputs).some((k) => emp.component_inputs[k] !== "");
      const hasCustomAllowances = emp.custom_allowances && emp.custom_allowances.length > 0;
      const hasSalaryIncrease = Number(emp.salary_increase_manual) > 0;
      return hasComponentInputs || hasCustomAllowances || hasSalaryIncrease;
    });
  }, [employees]);

  const handleResetDraft = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus semua inputan draf untuk periode ini?")) {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem(`payroll_draft_${periodeGaji}`);
        }
        setEmployees((prev) =>
          prev.map((emp) => {
            const updatedEmp = {
              ...emp,
              component_inputs: {},
              custom_allowances: [],
              salary_increase_manual: 0,
            };
            updatedEmp.grandTotal = calculateTotal(updatedEmp);
            return updatedEmp;
          }),
        );
        toast.success("Draf payroll berhasil di-reset.");
      } catch (e) {
        console.error("Error resetting draft", e);
        toast.error("Gagal meriset draf.");
      }
    }
  };

  // Ambil Data Cabang untuk Filter
  const { data: branches = [] } = useQuery({
    queryKey: ["branches_payroll_filter"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("nama");
      if (error) throw error;
      return data || [];
    },
  });

  // Ambil daftar jabatan beserta tunjangan_jabatan
  const { data: listJabatan = [] } = useQuery<any[]>({
    queryKey: ["jabatan_list_payroll"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jabatan" as any)
        .select("*")
        .order("nama_jabatan");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: dbEmployees, isLoading: loadingEmp } = useQuery({
    queryKey: ["employees_payroll_v8"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("aktif", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: salaryEvaluations = [], isLoading: loadingSalaryEvaluations } = useQuery({
    queryKey: ["salary_evaluations_payroll_v1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_increase_evaluations")
        .select("*")
        .eq("status", "disetujui")
        .order("tanggal_berlaku", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: salaryHistory = [], isLoading: loadingSalaryHistory } = useQuery({
    queryKey: ["salary_history_payroll_v1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_history")
        .select("*")
        .order("tanggal_berlaku", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allowanceTypes = [], isLoading: loadingAllowances } = useQuery({
    queryKey: ["allowance_types_v7"],
    queryFn: async () => {
      const { data, error } = await supabase.from("allowance_types").select("*").eq("aktif", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: deductionTypes = [], isLoading: loadingDeductions } = useQuery({
    queryKey: ["deduction_types_v7"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deduction_types").select("*").eq("aktif", true);
      if (error) throw error;
      return data || [];
    },
  });

  const getApprovedSalaryEvaluations = (emp: any) => {
    const periodStart = getPeriodDate(periodeGaji);
    return (salaryEvaluations || []).filter((evaluation) => {
      if (evaluation.employee_id !== emp.id || !evaluation.tanggal_berlaku) return false;
      return new Date(evaluation.tanggal_berlaku) <= periodStart;
    });
  };

  const getApprovedSalaryAdjustment = (emp: any) => {
    return getApprovedSalaryEvaluations(emp).reduce((total, evaluation) => {
      const fixedIncrease = Number(evaluation.nominal_kenaikan || 0);
      if (fixedIncrease > 0) return total + fixedIncrease;

      const percentage = Number(evaluation.persentase || 0);
      if (percentage > 0) {
        return total + (Number(emp.gaji_pokok) || 0) * (percentage / 100);
      }

      return total;
    }, 0);
  };

  const getEvaluationInfo = (emp: any) => {
    const evaluationMonths = EVALUATION_PERIOD_MONTHS[emp.periode_evaluasi];
    if (!evaluationMonths || !emp.tanggal_masuk) {
      return {
        isDue: false,
        nextDate: null,
      };
    }

    const latestHistory = (salaryHistory || []).find((history) => history.employee_id === emp.id);
    const baseDate = new Date(latestHistory?.tanggal_berlaku || emp.tanggal_masuk);
    if (Number.isNaN(baseDate.getTime())) {
      return {
        isDue: false,
        nextDate: null,
      };
    }

    const nextDate = addMonths(baseDate, evaluationMonths);
    const periodStart = getPeriodDate(periodeGaji);

    return {
      isDue: nextDate <= periodStart,
      nextDate: formatDateInput(nextDate),
    };
  };

  useEffect(() => {
    if (dbEmployees) {
      const isPeriodChanged = prevPeriodeRef.current !== periodeGaji;
      prevPeriodeRef.current = periodeGaji;

      const draftData = loadPayrollDraft(periodeGaji);

      setEmployees((prevEmployees) =>
        dbEmployees.map((emp) => {
          const prevEmp =
            (!isPeriodChanged && (prevEmployees || []).find((prev) => prev.id === emp.id)) || {};

          const component_inputs: any =
            prevEmp.component_inputs ?? draftData[emp.id]?.component_inputs ?? {};
          const custom_allowances: any[] =
            prevEmp.custom_allowances ?? draftData[emp.id]?.custom_allowances ?? [];
          const salary_increase_manual = Number(
            prevEmp.salary_increase_manual ?? draftData[emp.id]?.salary_increase_manual ?? 0,
          );

          const salaryAdjustment = getApprovedSalaryAdjustment(emp);
          const evaluationInfo = getEvaluationInfo(emp);
          const gajiPokok = (Number(emp.gaji_pokok) || 0) + salaryAdjustment;

          // Map jabatan (by id or by name) ke nama jabatan & tunjangan_jabatan jika tersedia
          const empJabatanKey = (emp as any).jabatan_id ?? (emp as any).jabatan;
          const jab = (listJabatan || []).find(
            (j: any) => j.id === empJabatanKey || j.nama_jabatan === empJabatanKey,
          );
          const jabatanName = (jab as any)?.nama_jabatan || "";
          const jabatanTunjangan = Number((jab as any)?.tunjangan_jabatan || 0);

          // Hitung tunjangan tetap & potongan tetap yang sudah aktif untuk jabatan karyawan
          let totalTunjangan = 0;
          let totalPotongan = 0;

          // tambahkan tunjangan_jabatan dari master jabatan
          if (jabatanTunjangan > 0) totalTunjangan += jabatanTunjangan;

          (allowanceTypes || []).forEach((alw: any) => {
            const metode = alw.metode;
            const nominalDefault = Number(alw.nominal_default || 0);
            const isEligible = checkIsEligible(alw.catatan, jabatanName);
            if (!isEligible) return;
            if (metode === "fixed") totalTunjangan += nominalDefault;
          });

          (deductionTypes || []).forEach((ded: any) => {
            const metode = ded.metode;
            const nominalDefault = Number(ded.nominal_default || 0);
            const isEligible = checkIsEligible(ded.catatan, jabatanName);
            if (!isEligible) return;
            if (metode === "fixed") totalPotongan += nominalDefault;
          });

          const gajiBersih = gajiPokok + totalTunjangan - totalPotongan;

          return {
            ...emp,
            jabatan: jabatanName,
            jabatan_tunjangan: jabatanTunjangan,
            salary_adjustment: salaryAdjustment,
            salary_increase_manual,
            evaluation_info: evaluationInfo,
            component_inputs,
            custom_allowances,
            grandTotal: gajiBersih,
          };
        }),
      );
    }
  }, [
    dbEmployees,
    allowanceTypes,
    deductionTypes,
    listJabatan,
    salaryEvaluations,
    salaryHistory,
    periodeGaji,
  ]);

  // Filter Karyawan Berdasarkan Cabang yang Dipilih
  const getBranchName = (branchId: string | null | undefined) => {
    return (
      (branches || []).find((branch: any) => branch.id === branchId)?.nama || "Cabang belum diatur"
    );
  };

  const filteredEmployees = useMemo(() => {
    const searchTerm = searchQuery.trim().toLowerCase();
    return (employees || []).filter((emp) => {
      const branchMatch = selectedBranchId === "all" || emp.branch_id === selectedBranchId;
      const searchText =
        `${emp.nama ?? ""} ${emp.jabatan ?? ""} ${getBranchName(emp.branch_id)}`.toLowerCase();
      const searchMatch = !searchTerm || searchText.includes(searchTerm);

      return branchMatch && searchMatch;
    });
  }, [employees, selectedBranchId, searchQuery, branches]);

  const totalFilteredTHP = useMemo(
    () => (filteredEmployees || []).reduce((sum, emp) => sum + Number(emp.grandTotal || 0), 0),
    [filteredEmployees],
  );

  const selectedBranchName = useMemo(() => {
    if (selectedBranchId === "all") return "Semua Cabang";
    return (
      (branches || []).find((branch: any) => branch.id === selectedBranchId)?.nama ||
      "Cabang Terpilih"
    );
  }, [branches, selectedBranchId]);

  const periodeGajiLabel = periodeGaji ? formatPeriode(periodeGaji) : "";

  const getComponentCalculatedValue = (item: any, emp: any) => {
    if (!emp) return 0;
    const metode = item.metode;
    const nominalDefault = Number(item.nominal_default || 0);
    const inputVal = Number(emp.component_inputs?.[item.id]) || 0;
    const gajiPokok = getPayrollBaseSalary(emp);
    const isDeduction = deductionTypes.some((deduction: any) => deduction.id === item.id);

    const isEligible = checkIsEligible(item.catatan, emp.jabatan);
    if (!isEligible) return 0;

    if (metode === "fixed") return nominalDefault;
    if (metode === "manual") return inputVal;
    if (metode === "per_day") {
      const dailyRate = isDeduction && nominalDefault === 0 ? gajiPokok / 30 : nominalDefault;
      return inputVal * dailyRate;
    }
    if (metode === "per_hour") return inputVal * nominalDefault;

    return 0;
  };

  const getPayrollBreakdown = (emp: any) => {
    if (!emp) return { gajiPokok: 0, totalTunjangan: 0, totalPotongan: 0, gajiBersih: 0 };
    let totalTunjangan = 0;
    let totalPotongan = 0;

    // include jabatan_tunjangan (from master jabatan) if present
    totalTunjangan += Number(emp.jabatan_tunjangan || 0);
    (allowanceTypes || []).forEach((alw) => {
      totalTunjangan += getComponentCalculatedValue(alw, emp);
    });
    emp.custom_allowances?.forEach((c: any) => {
      totalTunjangan += Number(c.nominal) || 0;
    });
    (deductionTypes || []).forEach((ded) => {
      totalPotongan += getComponentCalculatedValue(ded, emp);
    });

    const gajiPokok = getPayrollBaseSalary(emp);
    const gajiBersih = gajiPokok + totalTunjangan - totalPotongan;

    return { gajiPokok, totalTunjangan, totalPotongan, gajiBersih };
  };

  const getPayrollBaseSalary = (emp: any) => {
    if (!emp) return 0;
    return (
      (Number(emp.gaji_pokok) || 0) +
      (Number(emp.salary_adjustment) || 0) +
      (Number(emp.salary_increase_manual) || 0)
    );
  };

  const getDeductionQtySummary = (emp: any) => {
    if (!emp) return { jumlah_hari: 0, jumlah_izin: 0, jumlah_absen: 0, jumlah_telat: 0 };
    return (deductionTypes || []).reduce(
      (summary, deduction: any) => {
        const qty = Number(emp.component_inputs?.[deduction.id]) || 0;
        if (qty <= 0 || deduction.metode === "manual" || deduction.metode === "fixed") {
          return summary;
        }

        const name = String(deduction.nama || "").toLowerCase();
        if (name.includes("izin")) summary.jumlah_izin += qty;
        if (name.includes("sakit") || name.includes("absen")) summary.jumlah_absen += qty;
        if (name.includes("telat") || name.includes("terlambat")) summary.jumlah_telat += qty;
        if (deduction.metode === "per_day") summary.jumlah_hari += qty;

        return summary;
      },
      { jumlah_hari: 0, jumlah_izin: 0, jumlah_absen: 0, jumlah_telat: 0 },
    );
  };

  const stats = useMemo(() => {
    const totalKaryawan = filteredEmployees.length;
    let totalGajiPokok = 0;
    let totalTunjangan = 0;
    let totalPotongan = 0;
    let totalTHP = 0;

    filteredEmployees.forEach((emp) => {
      const breakdown = getPayrollBreakdown(emp);
      totalGajiPokok += breakdown.gajiPokok;
      totalTunjangan += breakdown.totalTunjangan;
      totalPotongan += breakdown.totalPotongan;
      totalTHP += breakdown.gajiBersih;
    });

    return {
      totalKaryawan,
      totalGajiPokok,
      totalTunjangan,
      totalPotongan,
      totalTHP,
    };
  }, [filteredEmployees]);

  const buildPayrollItemComponents = (emp: any, payrollItemId: string) => {
    const allowances = [
      ...(Number(emp.jabatan_tunjangan || 0) > 0
        ? [
            {
              payroll_item_id: payrollItemId,
              allowance_type_id: null,
              nama: "Tunjangan Jabatan",
              metode: "fixed" as const,
              qty: 1,
              nominal: Number(emp.jabatan_tunjangan || 0),
              subtotal: Number(emp.jabatan_tunjangan || 0),
            },
          ]
        : []),
      ...(allowanceTypes || [])
        .map((allowance: any) => {
          const subtotal = getComponentCalculatedValue(allowance, emp);
          if (subtotal <= 0) return null;
          const qty =
            allowance.metode === "fixed" || allowance.metode === "manual"
              ? 1
              : Number(emp.component_inputs?.[allowance.id]) || 0;
          const nominal =
            allowance.metode === "manual" ? subtotal : Number(allowance.nominal_default || 0);
          return {
            payroll_item_id: payrollItemId,
            allowance_type_id: allowance.id,
            nama: allowance.nama,
            metode: allowance.metode,
            qty,
            nominal,
            subtotal,
          };
        })
        .filter(Boolean),
      ...(emp.custom_allowances || []).map((allowance: any) => ({
        payroll_item_id: payrollItemId,
        allowance_type_id: null,
        nama: allowance.nama,
        metode: "manual" as const,
        qty: 1,
        nominal: Number(allowance.nominal || 0),
        subtotal: Number(allowance.nominal || 0),
      })),
    ];

    const deductions = (deductionTypes || [])
      .map((deduction: any) => {
        const subtotal = getComponentCalculatedValue(deduction, emp);
        if (subtotal <= 0) return null;
        const qty =
          deduction.metode === "fixed" || deduction.metode === "manual"
            ? 1
            : Number(emp.component_inputs?.[deduction.id]) || 0;
        const nominal =
          deduction.metode === "manual"
            ? subtotal
            : deduction.metode === "per_day" && Number(deduction.nominal_default || 0) === 0
              ? getPayrollBaseSalary(emp) / 30
              : Number(deduction.nominal_default || 0);

        return {
          payroll_item_id: payrollItemId,
          deduction_type_id: deduction.id,
          nama: deduction.nama,
          metode: deduction.metode,
          qty,
          nominal,
          subtotal,
        };
      })
      .filter(Boolean);

    return { allowances, deductions };
  };

  const calculateTotal = (emp: any) => {
    return getPayrollBreakdown(emp).gajiBersih;
  };

  const handleInputChange = (empId: string, compId: string, value: string) => {
    setEmployees((prev) => {
      const updatedEmployees = prev.map((emp) => {
        if (emp.id === empId) {
          const updatedEmp = {
            ...emp,
            component_inputs: { ...emp.component_inputs, [compId]: value },
          };
          updatedEmp.grandTotal = calculateTotal(updatedEmp);
          return updatedEmp;
        }
        return emp;
      });
      if (detailEmp?.id === empId) {
        setDetailEmp(updatedEmployees.find((emp) => emp.id === empId) ?? null);
      }
      return updatedEmployees;
    });
  };

  const handleSalaryIncreaseChange = (empId: string, value: string) => {
    const numericValue = parseNumberDots(value);
    setEmployees((prev) => {
      const updatedEmployees = prev.map((emp) => {
        if (emp.id !== empId) return emp;

        const updatedEmp = {
          ...emp,
          salary_increase_manual: numericValue,
        };
        updatedEmp.grandTotal = calculateTotal(updatedEmp);
        return updatedEmp;
      });

      if (detailEmp?.id === empId) {
        setDetailEmp(updatedEmployees.find((emp) => emp.id === empId) ?? null);
      }

      return updatedEmployees;
    });
  };

  const handleExportCSV = () => {
    try {
      const activeAlws = (allowanceTypes || []).filter((alw: any) => alw.metode !== "fixed");
      const activeDeds = (deductionTypes || []).filter((ded: any) => ded.metode !== "fixed");

      const headers = [
        "id",
        "nik",
        "nama",
        "gaji_pokok",
        "kenaikan_gaji_manual",
        ...activeAlws.map((alw: any) => `Tunjangan: ${alw.nama} (${alw.id})`),
        ...activeDeds.map((ded: any) => `Potongan: ${ded.nama} (${ded.id})`),
        "penyesuaian_kustom",
      ];

      const csvLines = ["sep=,"];
      csvLines.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

      filteredEmployees.forEach((emp) => {
        const row = [
          emp.id,
          emp.nik || "",
          emp.nama || "",
          emp.gaji_pokok || 0,
          emp.salary_increase_manual || 0,
        ];

        activeAlws.forEach((alw: any) => {
          row.push(emp.component_inputs?.[alw.id] ?? "");
        });

        activeDeds.forEach((ded: any) => {
          row.push(emp.component_inputs?.[ded.id] ?? "");
        });

        const customString = (emp.custom_allowances || [])
          .map((c: any) => `${c.nama}:${c.nominal}`)
          .join(";");
        row.push(customString);

        csvLines.push(
          row
            .map((val) => {
              const stringVal = String(val);
              return `"${stringVal.replace(/"/g, '""')}"`;
            })
            .join(","),
        );
      });

      const csvContent = csvLines.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);

      const fileName = `payroll_draf_${periodeGaji}_${selectedBranchId === "all" ? "semua_cabang" : "cabang"}.csv`;
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Draf payroll berhasil diekspor ke CSV!");
    } catch (error: any) {
      console.error(error);
      toast.error("Gagal mengekspor CSV: " + error.message);
    }
  };

  const handleImportCSV = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          toast.error("File CSV kosong.");
          return;
        }

        let delimiter = ",";
        const firstLine = text.split(/\r?\n/)[0];
        if (firstLine.startsWith("sep=")) {
          delimiter = firstLine.charAt(4);
        } else {
          const semicolonCount = (firstLine.match(/;/g) || []).length;
          const commaCount = (firstLine.match(/,/g) || []).length;
          if (semicolonCount > commaCount) {
            delimiter = ";";
          }
        }

        const lines = parseCSV(text, delimiter);
        if (lines.length < 2) {
          toast.error("File CSV tidak memiliki data.");
          return;
        }

        const headers = lines[0].map((h) => h.trim());
        const dataRows = lines.slice(1);

        const idIndex = headers.indexOf("id");
        const nikIndex = headers.indexOf("nik");
        const salaryIncreaseIndex = headers.indexOf("kenaikan_gaji_manual");
        const customIndex = headers.indexOf("penyesuaian_kustom");

        if (idIndex === -1 && nikIndex === -1) {
          toast.error("File CSV harus memiliki kolom 'id' atau 'nik' untuk pemetaan karyawan.");
          return;
        }

        const componentHeaders: { index: number; id: string; type: "allowance" | "deduction" }[] =
          [];
        headers.forEach((header, index) => {
          const match = header.match(/\(([^)]+)\)$/);
          if (match) {
            const compId = match[1];
            const isAllowance = header.startsWith("Tunjangan:");
            const isDeduction = header.startsWith("Potongan:");
            if (isAllowance || isDeduction) {
              componentHeaders.push({
                index,
                id: compId,
                type: isAllowance ? "allowance" : "deduction",
              });
            }
          }
        });

        let successCount = 0;
        let skipCount = 0;

        setEmployees((prevEmployees) => {
          const updated = [...prevEmployees];

          dataRows.forEach((row) => {
            if (row.length === 0 || (row.length === 1 && row[0] === "")) return;

            const rowId = idIndex !== -1 ? row[idIndex] : "";
            const rowNik = nikIndex !== -1 ? row[nikIndex] : "";

            const empIndex = updated.findIndex(
              (emp) => (rowId && emp.id === rowId) || (rowNik && emp.nik === rowNik),
            );

            if (empIndex === -1) {
              skipCount++;
              return;
            }

            const emp = updated[empIndex];
            const component_inputs = { ...emp.component_inputs };

            componentHeaders.forEach(({ index, id }) => {
              if (row[index] !== undefined) {
                const val = row[index].trim();
                component_inputs[id] = val;
              }
            });

            let salary_increase_manual = emp.salary_increase_manual;
            if (salaryIncreaseIndex !== -1 && row[salaryIncreaseIndex] !== undefined) {
              salary_increase_manual = Number(row[salaryIncreaseIndex]) || 0;
            }

            let custom_allowances = [...(emp.custom_allowances || [])];
            if (customIndex !== -1 && row[customIndex] !== undefined) {
              const customVal = row[customIndex].trim();
              if (customVal === "") {
                custom_allowances = [];
              } else {
                custom_allowances = customVal.split(";").map((item, idx) => {
                  const parts = item.split(":");
                  const name = parts[0]?.trim() || "Penyesuaian " + (idx + 1);
                  const nominal = Number(parts[1]) || 0;
                  return {
                    id: `custom-import-${Math.random().toString(36).substring(2, 9)}`,
                    nama: name,
                    nominal: nominal,
                  };
                });
              }
            }

            const updatedEmp = {
              ...emp,
              component_inputs,
              salary_increase_manual,
              custom_allowances,
            };

            updatedEmp.grandTotal = calculateTotal(updatedEmp);
            updated[empIndex] = updatedEmp;
            successCount++;
          });

          return updated;
        });

        e.target.value = "";

        toast.success(
          `Berhasil mengimpor draf untuk ${successCount} karyawan!${skipCount > 0 ? ` (${skipCount} karyawan dilewati/tidak cocok)` : ""}`,
        );
      } catch (err: any) {
        console.error(err);
        toast.error("Gagal mengimpor file CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleAddCustomAllowance = (empId: string) => {
    setCustomAllowanceEmployeeId(empId);
    setCustomAllowanceName("");
    setCustomAllowanceNominal("");
    setCustomAllowanceModalOpen(true);
  };

  const handleConfirmCustomAllowance = () => {
    if (!customAllowanceEmployeeId) return;

    const trimmedName = customAllowanceName.trim();
    const nominal = Number(customAllowanceNominal);

    if (!trimmedName) {
      toast.error("Nama penyesuaian wajib diisi.");
      return;
    }
    if (Number.isNaN(nominal) || nominal <= 0) {
      toast.error("Nominal harus lebih besar dari nol.");
      return;
    }

    setEmployees((prev) => {
      const updatedEmployees = prev.map((emp) => {
        if (emp.id === customAllowanceEmployeeId) {
          const updatedEmp = {
            ...emp,
            custom_allowances: [
              ...(emp.custom_allowances || []),
              { id: `custom-${Date.now()}`, nama: trimmedName, nominal },
            ],
          };
          updatedEmp.grandTotal = calculateTotal(updatedEmp);
          return updatedEmp;
        }
        return emp;
      });
      if (detailEmp?.id === customAllowanceEmployeeId) {
        setDetailEmp(updatedEmployees.find((emp) => emp.id === customAllowanceEmployeeId) ?? null);
      }
      return updatedEmployees;
    });

    setCustomAllowanceModalOpen(false);
    setCustomAllowanceEmployeeId(null);
    setCustomAllowanceName("");
    setCustomAllowanceNominal("");
    toast.success("Penyesuaian berhasil ditambahkan.");
  };

  const openDetail = (emp: any) => {
    setDetailEmp(emp);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setDetailEmp(null);
  };

  const handleRemoveCustomAllowance = (empId: string, customId: string) => {
    setEmployees((prev) => {
      const updatedEmployees = prev.map((emp) => {
        if (emp.id === empId) {
          const updatedEmp = {
            ...emp,
            custom_allowances: (emp.custom_allowances || []).filter((c: any) => c.id !== customId),
          };
          updatedEmp.grandTotal = calculateTotal(updatedEmp);
          return updatedEmp;
        }
        return emp;
      });
      if (detailEmp?.id === empId) {
        setDetailEmp(updatedEmployees.find((emp) => emp.id === empId) ?? null);
      }
      return updatedEmployees;
    });
  };

  const executeSavePayroll = async () => {
    if (!periodeGaji) return toast.error("Periode penggajian wajib diisi.");
    if (filteredEmployees.length === 0)
      return toast.error("Belum ada data karyawan di cabang ini.");

    setIsSaving(true);
    try {
      const payrollRunPayload = {
        periode: periodeGaji,
        branch_id: selectedBranchId === "all" ? null : selectedBranchId,
        status: "draft" as const,
      };

      const { data: runData, error: runError } = await supabase
        .from("payroll_runs")
        .insert([payrollRunPayload])
        .select()
        .single();

      if (runError) throw runError;

      const payrollItemsToInsert = filteredEmployees.map((emp) => {
        const breakdown = getPayrollBreakdown(emp);
        const qtySummary = getDeductionQtySummary(emp);
        const increaseNote =
          Number(emp.salary_adjustment || 0) > 0 || Number(emp.salary_increase_manual || 0) > 0
            ? `Kenaikan gaji periode ini: ${formatIDR(
                Number(emp.salary_adjustment || 0) + Number(emp.salary_increase_manual || 0),
              )}`
            : null;
        return {
          payroll_run_id: runData.id,
          employee_id: emp.id,
          gaji_pokok: breakdown.gajiPokok,
          total_tunjangan: breakdown.totalTunjangan,
          total_potongan: breakdown.totalPotongan,
          gaji_bersih: breakdown.gajiBersih,
          jumlah_hari: qtySummary.jumlah_hari,
          jumlah_izin: qtySummary.jumlah_izin,
          jumlah_absen: qtySummary.jumlah_absen,
          jumlah_telat: qtySummary.jumlah_telat,
          catatan: increaseNote,
          slip_dibuat: true,
        };
      });

      const { data: insertedItems, error: itemsError } = await supabase
        .from("payroll_items")
        .insert(payrollItemsToInsert)
        .select("id, employee_id");
      if (itemsError) throw itemsError;

      const componentRows = (insertedItems || []).reduce(
        (rows, item: any) => {
          const emp = filteredEmployees.find((employee) => employee.id === item.employee_id);
          if (!emp) return rows;

          const components = buildPayrollItemComponents(emp, item.id);
          rows.allowances.push(...components.allowances);
          rows.deductions.push(...components.deductions);
          return rows;
        },
        { allowances: [] as any[], deductions: [] as any[] },
      );

      if (componentRows.allowances.length > 0) {
        const { error: allowanceItemsError } = await supabase
          .from("payroll_item_allowances")
          .insert(componentRows.allowances);
        if (allowanceItemsError) throw allowanceItemsError;
      }

      if (componentRows.deductions.length > 0) {
        const { error: deductionItemsError } = await supabase
          .from("payroll_item_deductions")
          .insert(componentRows.deductions);
        if (deductionItemsError) throw deductionItemsError;
      }

      const salaryUpdates = filteredEmployees
        .map((emp) => {
          const totalIncrease =
            Number(emp.salary_adjustment || 0) + Number(emp.salary_increase_manual || 0);
          if (totalIncrease <= 0) return null;
          return {
            id: emp.id,
            gaji_pokok: (Number(emp.gaji_pokok) || 0) + totalIncrease,
          };
        })
        .filter(Boolean) as { id: string; gaji_pokok: number }[];

      if (salaryUpdates.length > 0) {
        const salaryUpdateResults = await Promise.all(
          salaryUpdates.map((salaryUpdate) =>
            supabase
              .from("employees")
              .update({ gaji_pokok: salaryUpdate.gaji_pokok })
              .eq("id", salaryUpdate.id),
          ),
        );

        const salaryUpdateError = salaryUpdateResults.find((result) => result.error)?.error;
        if (salaryUpdateError) throw salaryUpdateError;
      }

      const appliedEvaluationIds = filteredEmployees.flatMap((emp) =>
        getApprovedSalaryEvaluations(emp).map((evaluation) => evaluation.id),
      );

      if (appliedEvaluationIds.length > 0) {
        const { error: evaluationError } = await supabase
          .from("salary_increase_evaluations")
          .update({ status: "sudah_dinaikkan" })
          .in("id", appliedEvaluationIds);
        if (evaluationError) throw evaluationError;
      }

      toast.success(
        `Payroll periode ${formatPeriode(periodeGaji)} berhasil dieksekusi untuk ${selectedBranchName}.`,
      );

      // Clear draft for the period that was just executed
      try {
        localStorage.removeItem(`payroll_draft_${periodeGaji}`);
      } catch (e) {
        console.error("Error removing draft from localStorage", e);
      }

      setIsConfirmOpen(false);
      setPeriodeGaji(getCurrentPeriode());
      setEmployees((prev) =>
        prev.map((emp) => ({
          ...emp,
          component_inputs: {},
          custom_allowances: [],
          salary_increase_manual: 0,
        })),
      );
    } catch (error: any) {
      console.error(error);
      toast.error(`Kegagalan sistem: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading =
    loadingEmp ||
    loadingAllowances ||
    loadingDeductions ||
    loadingSalaryEvaluations ||
    loadingSalaryHistory;
  const detailBreakdown = detailEmp ? getPayrollBreakdown(detailEmp) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kalkulasi Payroll</h1>
            {hasLocalDraft && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Ada Draf Inputan
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Tinjau dan sesuaikan komponen gaji bersih karyawan untuk periode berjalan.
          </p>
        </div>

        {/* Kontrol Kanan: Filter Cabang + Tombol Eksekusi */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
            <div className="space-y-1 min-w-[180px]">
              <Label className="text-xs text-slate-500">Periode Payroll</Label>
              <Input
                type="month"
                value={periodeGaji}
                onChange={(e) => setPeriodeGaji(e.target.value)}
                disabled={isSaving}
                className="h-9 w-full bg-white shadow-sm"
              />
            </div>
            <div className="space-y-1 min-w-[180px]">
              <Label className="text-xs text-slate-500">Cabang</Label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                <Store className="w-4 h-4 text-slate-500 ml-1" />
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="w-[180px] h-8 border-0 bg-transparent shadow-none focus:ring-0 text-sm font-medium">
                    <SelectValue placeholder="Pilih Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Cabang</SelectItem>
                    {branches.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1 min-w-[220px]">
              <Label className="text-xs text-slate-500">Cari karyawan</Label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nama, jabatan, atau cabang"
                  className="h-9 pl-10"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={isLoading || filteredEmployees.length === 0}
              className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-800 shadow-sm transition-all duration-200"
            >
              <Download className="w-4 h-4 mr-2 text-slate-500" /> Ekspor CSV
            </Button>

            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
                id="csv-import-input"
              />
              <Button
                variant="outline"
                asChild
                className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-800 shadow-sm cursor-pointer transition-all duration-200"
              >
                <label htmlFor="csv-import-input" className="flex items-center">
                  <Upload className="w-4 h-4 mr-2 text-slate-500" /> Impor CSV
                </label>
              </Button>
            </div>

            {hasLocalDraft && (
              <Button
                variant="outline"
                onClick={handleResetDraft}
                className="h-9 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 shadow-sm transition-all duration-200"
              >
                <RefreshCw className="w-4 h-4 mr-2 text-rose-500" /> Reset Draf
              </Button>
            )}

            <Button
              onClick={() => setIsConfirmOpen(true)}
              disabled={isLoading || filteredEmployees.length === 0}
              className="shadow-sm h-9 bg-slate-900 text-white hover:bg-slate-800 transition-all duration-200"
            >
              <Calculator className="w-4 h-4 mr-2" /> Eksekusi Payroll
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Karyawan */}
        <div className="relative overflow-hidden bg-white border border-slate-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 group hover:-translate-y-1">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-50 rounded-full transition-all duration-500 group-hover:scale-110 opacity-50 z-0"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Karyawan Diproses
              </span>
              <h3 className="text-2xl font-bold text-slate-800">{stats.totalKaryawan} Orang</h3>
              <p className="text-xs text-slate-400">Aktif & siap menerima gaji</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors duration-300">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 2: Total Gaji Pokok & Tunjangan */}
        <div className="relative overflow-hidden bg-white border border-slate-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 group hover:-translate-y-1">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-50 rounded-full transition-all duration-500 group-hover:scale-110 opacity-50 z-0"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Pendapatan
              </span>
              <h3 className="text-2xl font-bold text-slate-800">
                {formatIDR(stats.totalGajiPokok + stats.totalTunjangan)}
              </h3>
              <p className="text-xs text-emerald-600 font-medium">Gaji pokok + tunjangan</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors duration-300">
              <Coins className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 3: Total Potongan */}
        <div className="relative overflow-hidden bg-white border border-slate-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 group hover:-translate-y-1">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-rose-50 rounded-full transition-all duration-500 group-hover:scale-110 opacity-50 z-0"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Potongan
              </span>
              <h3 className="text-2xl font-bold text-slate-800">
                {formatIDR(stats.totalPotongan)}
              </h3>
              <p className="text-xs text-rose-600 font-medium">Sanksi absen, telat & cuti</p>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-100 group-hover:text-rose-700 transition-colors duration-300">
              <Percent className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 4: Total Bersih (THP) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 rounded-xl p-5 shadow-md hover:shadow-lg transition-all duration-300 group hover:-translate-y-1 text-white border border-slate-800">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full transition-all duration-500 group-hover:scale-110 opacity-50 z-0"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                Total Net Transfer
              </span>
              <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-white to-indigo-200">
                {formatIDR(stats.totalTHP)}
              </h3>
              <p className="text-xs text-indigo-200 font-medium">Total Take Home Pay bersih</p>
            </div>
            <div className="p-3 bg-white/10 text-white rounded-xl group-hover:bg-white/20 transition-colors duration-300">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembuatan Draft</DialogTitle>
            <DialogDescription>
              Sistem akan merangkum seluruh kalkulasi dan menerbitkan slip gaji untuk{" "}
              <strong className="text-slate-800">{filteredEmployees.length} karyawan</strong>
              {selectedBranchId === "all" ? " di semua cabang" : ` di ${selectedBranchName}`}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-700">Bulan Penggajian</Label>
              <Input
                type="month"
                value={periodeGaji}
                onChange={(e) => setPeriodeGaji(e.target.value)}
                disabled={isSaving}
                className="shadow-none focus-visible:ring-1"
              />
              {periodeGajiLabel && (
                <p className="text-xs text-slate-500">
                  Periode akan ditampilkan sebagai{" "}
                  <span className="font-medium text-slate-700">{periodeGajiLabel}</span>.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t mt-2">
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} disabled={isSaving}>
              Batalkan
            </Button>
            <Button
              onClick={executeSavePayroll}
              disabled={isSaving || !periodeGaji}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...
                </>
              ) : (
                "Lanjutkan Proses"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={customAllowanceModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCustomAllowanceModalOpen(false);
            setCustomAllowanceEmployeeId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Tambah Penyesuaian Khusus</DialogTitle>
            <DialogDescription>
              Tambahkan penyesuaian yang hanya berlaku untuk satu karyawan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Penyesuaian</Label>
              <Input
                value={customAllowanceName}
                onChange={(e) => setCustomAllowanceName(e.target.value)}
                placeholder="Contoh: Lembur Minggu"
              />
            </div>
            <div className="space-y-2">
              <Label>Nominal (Rp)</Label>
              <Input
                type="text"
                value={formatNumberDots(customAllowanceNominal)}
                onChange={(e) => {
                  const parsed = parseNumberDots(e.target.value);
                  setCustomAllowanceNominal(parsed === 0 ? "" : parsed);
                }}
                placeholder="500.000"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t mt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setCustomAllowanceModalOpen(false);
                setCustomAllowanceEmployeeId(null);
              }}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmCustomAllowance}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              Tambah Penyesuaian
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDetailOpen}
        onOpenChange={(open) => (!open ? closeDetail() : setIsDetailOpen(true))}
      >
        <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900">
              Rincian Slip Gaji
            </DialogTitle>
            <DialogDescription>
              Visualisasi rincian payroll berjalan untuk karyawan ini.
            </DialogDescription>
          </DialogHeader>
          {detailEmp && (
            <>
              <div className="space-y-4 py-2">
                {/* Header info card */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-white/5 rounded-full z-0"></div>
                  <div className="relative z-10">
                    <h4 className="text-lg font-bold truncate">{detailEmp?.nama}</h4>
                    <p className="text-xs text-slate-300 font-medium">
                      {detailEmp?.jabatan || "Tidak ada posisi"}
                    </p>
                    <div className="mt-3 flex items-baseline justify-between border-t border-slate-800 pt-3">
                      <span className="text-xs text-slate-400">Take Home Pay Bersih:</span>
                      <span className="text-lg font-black text-emerald-400">
                        {formatIDR(detailBreakdown?.gajiBersih || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick breakdown metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                      Pokok
                    </span>
                    <span className="text-xs font-bold text-slate-800 block mt-1">
                      {formatIDR(detailBreakdown?.gajiPokok || 0)}
                    </span>
                  </div>
                  <div className="bg-emerald-50/60 border border-emerald-100/50 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] font-bold text-emerald-600 block uppercase tracking-wider">
                      Tunjangan
                    </span>
                    <span className="text-xs font-bold text-emerald-700 block mt-1">
                      +{formatIDR(detailBreakdown?.totalTunjangan || 0)}
                    </span>
                  </div>
                  <div className="bg-rose-50/60 border border-rose-100/50 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] font-bold text-rose-600 block uppercase tracking-wider">
                      Potongan
                    </span>
                    <span className="text-xs font-bold text-rose-700 block mt-1">
                      -{formatIDR(detailBreakdown?.totalPotongan || 0)}
                    </span>
                  </div>
                </div>

                {/* Visual Balance Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 tracking-wider">
                    <span>KOMPOSISI GAJI</span>
                    <span>TOTAL PENDAPATAN KOTOR</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    {detailBreakdown &&
                    detailBreakdown.gajiPokok + detailBreakdown.totalTunjangan > 0 ? (
                      <>
                        <div
                          className="bg-slate-700 h-full transition-all"
                          style={{
                            width: `${(detailBreakdown.gajiPokok / (detailBreakdown.gajiPokok + detailBreakdown.totalTunjangan)) * 100}%`,
                          }}
                          title="Gaji Pokok"
                        ></div>
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{
                            width: `${(detailBreakdown.totalTunjangan / (detailBreakdown.gajiPokok + detailBreakdown.totalTunjangan)) * 100}%`,
                          }}
                          title="Tunjangan"
                        ></div>
                      </>
                    ) : (
                      <div className="bg-slate-300 h-full w-full"></div>
                    )}
                  </div>
                </div>

                {/* Inputs & Configurations */}
                <div className="space-y-3">
                  {detailEmp?.evaluation_info?.isDue && (
                    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 shadow-sm">
                      <div className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                        Jadwal Evaluasi Gaji
                      </div>
                      <p className="text-[11px] text-amber-700 leading-normal">
                        Karyawan ini telah masuk jadwal penyesuaian gaji sejak{" "}
                        {detailEmp.evaluation_info.nextDate}.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Label className="text-xs font-semibold text-amber-900 w-24">
                          Nominal Naik
                        </Label>
                        <Input
                          type="text"
                          className="h-8 text-right text-xs bg-white border-amber-300 focus-visible:ring-amber-500"
                          placeholder="Rp"
                          value={formatNumberDots(detailEmp?.salary_increase_manual)}
                          onChange={(e) =>
                            detailEmp && handleSalaryIncreaseChange(detailEmp.id, e.target.value)
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Master reference salary info */}
                  <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Gaji Pokok Karyawan:</span>
                      <span className="font-semibold text-slate-800">
                        {formatIDR(detailEmp?.gaji_pokok || 0)}
                      </span>
                    </div>
                    {Number(detailEmp?.salary_adjustment || 0) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Kenaikan Otomatis Berlaku:</span>
                        <span className="font-semibold">
                          +{formatIDR(detailEmp?.salary_adjustment || 0)}
                        </span>
                      </div>
                    )}
                    {detailEmp?.jabatan_tunjangan > 0 && (
                      <div className="flex justify-between">
                        <span>Tunjangan Jabatan:</span>
                        <span className="font-semibold text-slate-800">
                          {formatIDR(detailEmp?.jabatan_tunjangan || 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                    Tunjangan Dinamis
                  </div>
                  {(allowanceTypes || [])
                    .filter((alw) => checkIsEligible(alw.catatan, detailEmp?.jabatan ?? ""))
                    .map((alw) => (
                      <div
                        key={alw.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm hover:border-emerald-200 transition-colors"
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-700">{alw.nama}</div>
                          <div className="text-[10px] text-slate-400 font-medium capitalize">
                            {alw.metode === "fixed"
                              ? "Tetap"
                              : alw.metode === "per_day"
                                ? "Per Hari"
                                : alw.metode === "per_hour"
                                  ? "Per Jam"
                                  : "Nominal Bebas"}
                          </div>
                        </div>
                        {alw.metode === "fixed" ? (
                          <div className="text-xs font-semibold text-slate-700">
                            {formatIDR(alw.nominal_default)}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              type={alw.metode === "manual" ? "text" : "number"}
                              className="h-8 w-24 text-right text-xs focus-visible:ring-emerald-400"
                              placeholder={
                                alw.metode === "manual"
                                  ? "Rp"
                                  : alw.metode === "per_day"
                                    ? "Hari"
                                    : "Jam"
                              }
                              value={
                                alw.metode === "manual"
                                  ? formatNumberDots(detailEmp?.component_inputs?.[alw.id])
                                  : (detailEmp?.component_inputs?.[alw.id] ?? "")
                              }
                              onChange={(e) => {
                                if (detailEmp) {
                                  const val =
                                    alw.metode === "manual"
                                      ? parseNumberDots(e.target.value) === 0 &&
                                        e.target.value === ""
                                        ? ""
                                        : String(parseNumberDots(e.target.value))
                                      : e.target.value;
                                  handleInputChange(detailEmp.id, alw.id, val);
                                }
                              }}
                            />
                            {alw.metode !== "manual" &&
                              getComponentCalculatedValue(alw, detailEmp) > 0 && (
                                <div className="text-xs font-bold text-emerald-600 w-24 text-right">
                                  {formatIDR(getComponentCalculatedValue(alw, detailEmp))}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                    Potongan Dinamis
                  </div>
                  {(deductionTypes || [])
                    .filter((ded) => checkIsEligible(ded.catatan, detailEmp?.jabatan ?? ""))
                    .map((ded) => {
                      const finalVal = detailEmp ? getComponentCalculatedValue(ded, detailEmp) : 0;
                      return (
                        <div
                          key={ded.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm hover:border-rose-200 transition-colors"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-700">{ded.nama}</div>
                            <div className="text-[10px] text-slate-400 font-medium capitalize">
                              {ded.metode === "fixed"
                                ? "Tetap"
                                : ded.metode === "per_day"
                                  ? "Per Hari"
                                  : "Nominal Bebas"}
                            </div>
                            {ded.metode === "per_day" && Number(ded.nominal_default || 0) === 0 && (
                              <div className="text-[9px] text-slate-400">
                                Gaji pokok / 30 x jumlah
                              </div>
                            )}
                          </div>
                          {ded.metode === "fixed" ? (
                            <div className="text-xs font-semibold text-rose-600">
                              {formatIDR(ded.nominal_default)}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                type={ded.metode === "manual" ? "text" : "number"}
                                className="h-8 w-24 text-right text-xs focus-visible:ring-rose-400"
                                placeholder={ded.metode === "manual" ? "Rp" : "Jumlah"}
                                value={
                                  ded.metode === "manual"
                                    ? formatNumberDots(detailEmp?.component_inputs?.[ded.id])
                                    : (detailEmp?.component_inputs?.[ded.id] ?? "")
                                }
                                onChange={(e) => {
                                  if (detailEmp) {
                                    const val =
                                      ded.metode === "manual"
                                        ? parseNumberDots(e.target.value) === 0 &&
                                          e.target.value === ""
                                          ? ""
                                          : String(parseNumberDots(e.target.value))
                                        : e.target.value;
                                    handleInputChange(detailEmp.id, ded.id, val);
                                  }
                                }}
                              />
                              {finalVal > 0 && (
                                <div className="w-24 text-right text-xs font-semibold text-rose-600">
                                  {formatIDR(finalVal)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                <Button
                  onClick={closeDetail}
                  className="bg-slate-900 text-white hover:bg-slate-800 w-full sm:w-auto rounded-xl"
                >
                  Selesai & Tutup
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto pb-4">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-slate-50/50">
                <TableHead className="sticky left-0 bg-slate-50/95 backdrop-blur z-20 w-64 border-r border-slate-200 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                  <span className="text-slate-700 font-semibold">Informasi Karyawan</span>
                </TableHead>
                <TableHead className="font-semibold text-slate-700">Gaji Pokok</TableHead>

                {(allowanceTypes || []).map((alw) => (
                  <TableHead
                    key={alw.id}
                    className="hidden md:table-cell text-center min-w-[120px] border-t-2 border-t-emerald-400 bg-emerald-50/30"
                  >
                    <div className="font-medium text-slate-800 text-sm">{alw.nama}</div>
                    <div className="text-[10px] font-medium text-emerald-600/70 uppercase tracking-wider mt-0.5">
                      {alw.metode === "fixed"
                        ? "Tetap"
                        : alw.metode === "per_day"
                          ? "Faktor Hari"
                          : alw.metode === "per_hour"
                            ? "Faktor Jam"
                            : "Nominal"}
                    </div>
                  </TableHead>
                ))}

                <TableHead className="hidden md:table-cell text-center w-56 border-t-2 border-t-teal-400 bg-teal-50/30">
                  <div className="font-medium text-slate-800 text-sm">Penyesuaian Tambahan</div>
                  <div className="text-[10px] font-medium text-teal-600/70 uppercase tracking-wider mt-0.5">
                    Ad-Hoc / Custom
                  </div>
                </TableHead>

                {(deductionTypes || []).map((ded) => (
                  <TableHead
                    key={ded.id}
                    className="hidden md:table-cell text-center min-w-[120px] border-t-2 border-t-rose-400 bg-rose-50/30"
                  >
                    <div className="font-medium text-slate-800 text-sm">{ded.nama}</div>
                    <div className="text-[10px] font-medium text-rose-600/70 uppercase tracking-wider mt-0.5">
                      {ded.metode === "fixed"
                        ? "Tetap"
                        : ded.metode === "per_day"
                          ? "Faktor Hari"
                          : "Nominal"}
                    </div>
                  </TableHead>
                ))}

                <TableHead className="font-semibold text-right sticky right-0 bg-slate-50/95 backdrop-blur z-20 border-l border-slate-200 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] text-slate-900">
                  Total Bersih
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={(allowanceTypes || []).length + (deductionTypes || []).length + 4}
                    className="h-32 text-center"
                  >
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={(allowanceTypes || []).length + (deductionTypes || []).length + 4}
                    className="h-32 text-center text-slate-500"
                  >
                    Tidak ada karyawan di cabang ini.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp) => {
                  const hasEdits =
                    (emp.component_inputs &&
                      Object.keys(emp.component_inputs).some(
                        (k) => emp.component_inputs[k] !== "",
                      )) ||
                    (emp.custom_allowances && emp.custom_allowances.length > 0) ||
                    Number(emp.salary_increase_manual) > 0;

                  return (
                    <Fragment key={emp.id}>
                      <TableRow
                        className={`group ${hasEdits ? "bg-indigo-50/10 hover:bg-indigo-50/20" : "hover:bg-slate-50/50"} border-l-2 ${hasEdits ? "border-l-indigo-500" : "border-l-transparent"} transition-colors`}
                      >
                        <TableCell
                          className={`sticky left-0 ${hasEdits ? "bg-indigo-50/20 group-hover:bg-indigo-50/30" : "bg-white group-hover:bg-slate-50/95"} z-10 space-y-2 border-r border-slate-100 transition-colors`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <div className="font-semibold text-slate-900">{emp.nama}</div>
                              {hasEdits && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                  Draf
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                              {emp.jabatan ? emp.jabatan : "Tidak ada posisi"}
                              <div className="text-[11px] text-slate-500 mt-1">
                                Cabang: {getBranchName(emp.branch_id)}
                              </div>
                              {emp.jabatan_tunjangan > 0 && (
                                <div className="text-[11px] text-teal-700 font-medium mt-1">
                                  Tunjangan: {formatIDR(emp.jabatan_tunjangan)}
                                </div>
                              )}
                              {Number(emp.salary_adjustment || 0) > 0 && (
                                <div className="text-[11px] text-emerald-700 font-medium mt-1">
                                  Kenaikan berlaku: +{formatIDR(emp.salary_adjustment)}
                                </div>
                              )}
                              {emp.evaluation_info?.isDue && (
                                <div className="mt-2 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2">
                                  <div className="text-[11px] text-amber-700 font-medium">
                                    Perlu evaluasi gaji
                                  </div>
                                  <Input
                                    type="text"
                                    className="h-7 text-xs text-right bg-white"
                                    placeholder="Kenaikan Rp"
                                    value={formatNumberDots(emp.salary_increase_manual)}
                                    onChange={(e) =>
                                      handleSalaryIncreaseChange(emp.id, e.target.value)
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px] shadow-none border-teal-200 text-teal-700 bg-teal-50/30 hover:bg-teal-100"
                              onClick={() => handleAddCustomAllowance(emp.id)}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Penyesuaian
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-6 px-2 text-[10px] shadow-none border-slate-200 text-slate-700 hover:bg-slate-100 md:hidden"
                              onClick={() => openDetail(emp)}
                            >
                              Detail
                            </Button>
                          </div>
                        </TableCell>

                        <TableCell className="text-slate-600 text-sm font-medium">
                          <div>{formatIDR(getPayrollBaseSalary(emp))}</div>
                          {Number(emp.salary_adjustment || 0) > 0 && (
                            <div className="text-[10px] font-semibold text-emerald-600">
                              +{formatIDR(emp.salary_adjustment)}
                            </div>
                          )}
                          {Number(emp.salary_increase_manual || 0) > 0 && (
                            <div className="text-[10px] font-semibold text-amber-600">
                              +{formatIDR(emp.salary_increase_manual)}
                            </div>
                          )}
                        </TableCell>

                        {(allowanceTypes || []).map((alw) => {
                          const isEligible = checkIsEligible(alw.catatan, emp.jabatan);
                          const inputVal = emp.component_inputs?.[alw.id] ?? "";
                          const finalVal = getComponentCalculatedValue(alw, emp);

                          return (
                            <TableCell
                              key={alw.id}
                              className="hidden md:table-cell text-center align-top pt-4"
                            >
                              {!isEligible ? (
                                <span className="text-slate-200 text-sm font-medium">-</span>
                              ) : alw.metode === "fixed" ? (
                                <span className="text-sm font-medium text-slate-700">
                                  {formatIDR(alw.nominal_default)}
                                </span>
                              ) : (
                                <div className="flex flex-col items-center gap-1.5">
                                  <Input
                                    type={alw.metode === "manual" ? "text" : "number"}
                                    className={`h-7 text-center text-xs shadow-none transition-all ${alw.metode === "manual" ? "w-24" : "w-16"} border-slate-200 focus-visible:ring-1 focus-visible:ring-emerald-400`}
                                    placeholder={
                                      alw.metode === "manual"
                                        ? "Rp"
                                        : alw.metode === "per_day"
                                          ? "Hari"
                                          : "Jam"
                                    }
                                    value={
                                      alw.metode === "manual"
                                        ? formatNumberDots(inputVal)
                                        : inputVal
                                    }
                                    onChange={(e) => {
                                      const val =
                                        alw.metode === "manual"
                                          ? parseNumberDots(e.target.value) === 0 &&
                                            e.target.value === ""
                                            ? ""
                                            : String(parseNumberDots(e.target.value))
                                          : e.target.value;
                                      handleInputChange(emp.id, alw.id, val);
                                    }}
                                  />
                                  {finalVal > 0 && (
                                    <span className="text-[10px] text-emerald-600 font-semibold">
                                      {formatIDR(finalVal)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          );
                        })}

                        <TableCell className="hidden md:table-cell align-top pt-3">
                          <div className="space-y-1.5 max-h-28 overflow-y-auto p-0.5">
                            {emp.custom_allowances?.length === 0 ? (
                              <span className="text-xs text-slate-300 block text-center mt-2">
                                -
                              </span>
                            ) : (
                              emp.custom_allowances?.map((c: any) => (
                                <div
                                  key={c.id}
                                  className="flex items-center justify-between bg-white border border-slate-200 shadow-sm rounded-md px-2 py-1.5"
                                >
                                  <span
                                    className="text-[11px] font-medium text-slate-600 truncate max-w-[90px]"
                                    title={c.nama}
                                  >
                                    {c.nama}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-slate-800">
                                      {formatIDR(c.nominal)}
                                    </span>
                                    <button
                                      onClick={() => handleRemoveCustomAllowance(emp.id, c.id)}
                                      className="text-slate-400 hover:text-rose-500 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </TableCell>

                        {(deductionTypes || []).map((ded) => {
                          const isEligible = checkIsEligible(ded.catatan, emp.jabatan);
                          const inputVal = emp.component_inputs?.[ded.id] ?? "";
                          const finalVal = getComponentCalculatedValue(ded, emp);

                          return (
                            <TableCell
                              key={ded.id}
                              className="hidden md:table-cell text-center align-top pt-4"
                            >
                              {!isEligible ? (
                                <span className="text-slate-200 text-sm font-medium">-</span>
                              ) : ded.metode === "fixed" ? (
                                <span className="text-sm font-medium text-rose-600/80">
                                  {formatIDR(ded.nominal_default)}
                                </span>
                              ) : (
                                <div className="flex flex-col items-center gap-1.5">
                                  <Input
                                    type={ded.metode === "manual" ? "text" : "number"}
                                    className={`h-7 text-center text-xs shadow-none transition-all ${ded.metode === "manual" ? "w-24" : "w-16"} border-slate-200 focus-visible:ring-1 focus-visible:ring-rose-400`}
                                    placeholder={ded.metode === "manual" ? "Rp" : "Hari"}
                                    value={
                                      ded.metode === "manual"
                                        ? formatNumberDots(inputVal)
                                        : inputVal
                                    }
                                    onChange={(e) => {
                                      const val =
                                        ded.metode === "manual"
                                          ? parseNumberDots(e.target.value) === 0 &&
                                            e.target.value === ""
                                            ? ""
                                            : String(parseNumberDots(e.target.value))
                                          : e.target.value;
                                      handleInputChange(emp.id, ded.id, val);
                                    }}
                                  />
                                  {ded.metode === "per_day" &&
                                    Number(ded.nominal_default || 0) === 0 && (
                                      <span className="text-[10px] text-slate-400">gaji/30</span>
                                    )}
                                  {finalVal > 0 && (
                                    <span className="text-[10px] text-rose-500 font-semibold">
                                      {formatIDR(finalVal)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          );
                        })}

                        <TableCell
                          className={`font-bold text-right sticky right-0 ${hasEdits ? "bg-indigo-50/20 group-hover:bg-indigo-50/30" : "bg-white group-hover:bg-slate-50/95"} z-10 border-l border-slate-100 transition-colors align-middle`}
                        >
                          <div className="flex items-center justify-end gap-2 text-base text-slate-900">
                            {formatIDR(emp.grandTotal)}
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow className="md:hidden bg-slate-50/60">
                        <TableCell
                          colSpan={
                            (allowanceTypes || []).length + (deductionTypes || []).length + 5
                          }
                          className="py-3 px-3 text-xs text-slate-600"
                        >
                          <div className="grid gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">Gaji Pokok Payroll</span>
                              <span className="font-semibold">
                                {formatIDR(getPayrollBaseSalary(emp))}
                              </span>
                            </div>
                            {emp.evaluation_info?.isDue && (
                              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                                Sudah waktunya evaluasi gaji sejak {emp.evaluation_info.nextDate}.
                              </div>
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">Total Tunjangan</span>
                              <span className="font-semibold">
                                {formatIDR(getPayrollBreakdown(emp).totalTunjangan)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">Total Potongan</span>
                              <span className="font-semibold">
                                {formatIDR(getPayrollBreakdown(emp).totalPotongan)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">Bersih</span>
                              <span className="font-semibold text-slate-900">
                                {formatIDR(emp.grandTotal)}
                              </span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[10px] shadow-none border-teal-200 text-teal-700 bg-teal-50/30 hover:bg-teal-100"
                                onClick={() => handleAddCustomAllowance(emp.id)}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Penyesuaian
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-7 px-2 text-[10px] shadow-none border-slate-200 text-slate-700 hover:bg-slate-100"
                                onClick={() => openDetail(emp)}
                              >
                                Detail
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
