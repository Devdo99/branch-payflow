import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState, useEffect, useMemo } from "react";
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
import { formatIDR, formatPeriode } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Calculator, Plus, Trash2, ArrowRight, Store, Search as SearchIcon } from "lucide-react";

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

function AppProsesGajiPage() {
  const [employees, setEmployees] = useState<any[]>([]);

  // State Filter Cabang
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailEmp, setDetailEmp] = useState<any | null>(null);
  const [customAllowanceModalOpen, setCustomAllowanceModalOpen] = useState(false);
  const [customAllowanceEmployeeId, setCustomAllowanceEmployeeId] = useState<string | null>(null);
  const [customAllowanceName, setCustomAllowanceName] = useState("");
  const [customAllowanceNominal, setCustomAllowanceNominal] = useState<number | "">("");
  const [periodeGaji, setPeriodeGaji] = useState(getCurrentPeriode());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    return (salaryEvaluations as any[]).filter((evaluation) => {
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

    const latestHistory = (salaryHistory as any[]).find(
      (history) => history.employee_id === emp.id,
    );
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
      setEmployees((prevEmployees) =>
        dbEmployees.map((emp) => {
          const prevEmp = prevEmployees.find((prev) => prev.id === emp.id) ?? {};
          const component_inputs: any = prevEmp.component_inputs || {};
          const custom_allowances: any[] = prevEmp.custom_allowances || [];
          const salary_increase_manual = Number(prevEmp.salary_increase_manual || 0);
          const salaryAdjustment = getApprovedSalaryAdjustment(emp);
          const evaluationInfo = getEvaluationInfo(emp);
          const gajiPokok = (Number(emp.gaji_pokok) || 0) + salaryAdjustment;

          // Map jabatan (by id or by name) ke nama jabatan & tunjangan_jabatan jika tersedia
          const empJabatanKey = (emp as any).jabatan_id ?? (emp as any).jabatan;
          const jab = (listJabatan as any[]).find(
            (j: any) => j.id === empJabatanKey || j.nama_jabatan === empJabatanKey,
          );
          const jabatanName = (jab as any)?.nama_jabatan || "";
          const jabatanTunjangan = Number((jab as any)?.tunjangan_jabatan || 0);

          // Hitung tunjangan tetap & potongan tetap yang sudah aktif untuk jabatan karyawan
          let totalTunjangan = 0;
          let totalPotongan = 0;

          // tambahkan tunjangan_jabatan dari master jabatan
          if (jabatanTunjangan > 0) totalTunjangan += jabatanTunjangan;

          allowanceTypes.forEach((alw: any) => {
            const metode = alw.metode;
            const nominalDefault = Number(alw.nominal_default || 0);
            const isEligible =
              !alw.catatan ||
              alw.catatan === "GLOBAL" ||
              (jabatanName &&
                alw.catatan
                  .split(",")
                  .map((j: string) => j.toLowerCase().trim())
                  .includes(jabatanName.toLowerCase().trim()));
            if (!isEligible) return;
            if (metode === "fixed") totalTunjangan += nominalDefault;
          });

          deductionTypes.forEach((ded: any) => {
            const metode = ded.metode;
            const nominalDefault = Number(ded.nominal_default || 0);
            const isEligible =
              !ded.catatan ||
              ded.catatan === "GLOBAL" ||
              (jabatanName &&
                ded.catatan
                  .split(",")
                  .map((j: string) => j.toLowerCase().trim())
                  .includes(jabatanName.toLowerCase().trim()));
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
    return branches.find((branch: any) => branch.id === branchId)?.nama || "Cabang belum diatur";
  };

  const filteredEmployees = useMemo(() => {
    const searchTerm = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      const branchMatch = selectedBranchId === "all" || emp.branch_id === selectedBranchId;
      const searchText = `${emp.nama ?? ""} ${emp.jabatan ?? ""} ${getBranchName(emp.branch_id)}`
        .toLowerCase();
      const searchMatch = !searchTerm || searchText.includes(searchTerm);

      return branchMatch && searchMatch;
    });
  }, [employees, selectedBranchId, searchQuery, branches]);

  const totalFilteredTHP = useMemo(
    () => filteredEmployees.reduce((sum, emp) => sum + Number(emp.grandTotal || 0), 0),
    [filteredEmployees],
  );

  const selectedBranchName = useMemo(() => {
    if (selectedBranchId === "all") return "Semua Cabang";
    return (
      branches.find((branch: any) => branch.id === selectedBranchId)?.nama || "Cabang Terpilih"
    );
  }, [branches, selectedBranchId]);

  const periodeGajiLabel = periodeGaji ? formatPeriode(periodeGaji) : "";

  const checkIsEligible = (catatan: string | null, empJabatan: string) => {
    if (!catatan || catatan === "GLOBAL") return true;
    const targetJobdesks = catatan.split(",").map((j) => j.toLowerCase().trim());
    return empJabatan && targetJobdesks.includes(empJabatan.toLowerCase().trim());
  };

  const getComponentCalculatedValue = (item: any, emp: any) => {
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
    let totalTunjangan = 0;
    let totalPotongan = 0;

    // include jabatan_tunjangan (from master jabatan) if present
    totalTunjangan += Number(emp.jabatan_tunjangan || 0);
    allowanceTypes.forEach((alw) => {
      totalTunjangan += getComponentCalculatedValue(alw, emp);
    });
    emp.custom_allowances?.forEach((c: any) => {
      totalTunjangan += Number(c.nominal) || 0;
    });
    deductionTypes.forEach((ded) => {
      totalPotongan += getComponentCalculatedValue(ded, emp);
    });

    const gajiPokok = getPayrollBaseSalary(emp);
    const gajiBersih = gajiPokok + totalTunjangan - totalPotongan;

    return { gajiPokok, totalTunjangan, totalPotongan, gajiBersih };
  };

  const getPayrollBaseSalary = (emp: any) => {
    return (
      (Number(emp.gaji_pokok) || 0) +
      (Number(emp.salary_adjustment) || 0) +
      (Number(emp.salary_increase_manual) || 0)
    );
  };

  const getDeductionQtySummary = (emp: any) => {
    return deductionTypes.reduce(
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
      ...allowanceTypes
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

    const deductions = deductionTypes
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
    setEmployees((prev) => {
      const updatedEmployees = prev.map((emp) => {
        if (emp.id !== empId) return emp;

        const updatedEmp = {
          ...emp,
          salary_increase_manual: Number(value) || 0,
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Kalkulasi Payroll
          </h1>
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

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setIsConfirmOpen(true)}
              disabled={isLoading || filteredEmployees.length === 0}
              className="shadow-sm h-9"
            >
              <Calculator className="w-4 h-4 mr-2" /> Eksekusi Payroll
            </Button>
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
                type="number"
                value={customAllowanceNominal}
                onChange={(e) => setCustomAllowanceNominal(Number(e.target.value) || "")}
                placeholder="500000"
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
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Detail {detailEmp?.nama || "Karyawan"}</DialogTitle>
            <DialogDescription>Ringkasan payroll untuk karyawan ini.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="text-sm font-medium text-slate-700">
                {detailEmp?.jabatan || "Tidak ada posisi"}
              </div>
              <div className="text-xs text-slate-500">
                Gaji Pokok Payroll: {formatIDR(detailBreakdown?.gajiPokok || 0)}
              </div>
              {Number(detailEmp?.salary_adjustment || 0) > 0 && (
                <div className="text-xs text-emerald-700">
                  Termasuk kenaikan: {formatIDR(detailEmp?.salary_adjustment || 0)}
                </div>
              )}
              {detailEmp?.evaluation_info?.isDue && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <div className="text-xs text-amber-700">
                    Sudah masuk jadwal evaluasi gaji sejak {detailEmp.evaluation_info.nextDate}.
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-24 text-xs text-amber-800">Kenaikan</Label>
                    <Input
                      type="number"
                      className="h-8 text-right text-xs"
                      placeholder="Rp"
                      value={detailEmp?.salary_increase_manual || ""}
                      onChange={(e) =>
                        detailEmp && handleSalaryIncreaseChange(detailEmp.id, e.target.value)
                      }
                    />
                  </div>
                </div>
              )}
              {!detailEmp?.evaluation_info?.isDue && detailEmp?.evaluation_info?.nextDate && (
                <div className="text-xs text-slate-500">
                  Evaluasi berikutnya: {detailEmp.evaluation_info.nextDate}
                </div>
              )}
              <div className="text-xs text-slate-500">
                Gaji Pokok Master: {formatIDR(detailEmp?.gaji_pokok || 0)}
              </div>
              <div className="text-xs text-slate-500">
                Tunjangan Jabatan: {formatIDR(detailEmp?.jabatan_tunjangan || 0)}
              </div>
              <div className="text-xs text-slate-500">
                Total Tunjangan: {formatIDR(detailBreakdown?.totalTunjangan || 0)}
              </div>
              <div className="text-xs text-slate-500">
                Total Potongan: {formatIDR(detailBreakdown?.totalPotongan || 0)}
              </div>
              <div className="text-xs font-semibold text-slate-900">
                Total Bersih: {formatIDR(detailBreakdown?.gajiBersih || 0)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">
                Masukan nilai manual/per-faktor
              </div>
              {allowanceTypes
                .filter((alw) => checkIsEligible(alw.catatan, detailEmp?.jabatan ?? ""))
                .map((alw) => (
                  <div
                    key={alw.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2"
                  >
                    <div className="text-xs text-slate-600">{alw.nama}</div>
                    {alw.metode === "fixed" ? (
                      <div className="text-xs font-medium text-slate-700">
                        {formatIDR(alw.nominal_default)}
                      </div>
                    ) : (
                      <Input
                        type="number"
                        className="h-8 w-24 text-right text-xs"
                        placeholder={
                          alw.metode === "manual" ? "Rp" : alw.metode === "per_day" ? "Hari" : "Jam"
                        }
                        value={detailEmp?.component_inputs?.[alw.id] ?? ""}
                        onChange={(e) =>
                          detailEmp && handleInputChange(detailEmp.id, alw.id, e.target.value)
                        }
                      />
                    )}
                  </div>
                ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">Potongan</div>
              {deductionTypes
                .filter((ded) => checkIsEligible(ded.catatan, detailEmp?.jabatan ?? ""))
                .map((ded) => {
                  const finalVal = detailEmp ? getComponentCalculatedValue(ded, detailEmp) : 0;
                  return (
                    <div
                      key={ded.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2"
                    >
                      <div>
                        <div className="text-xs text-slate-600">{ded.nama}</div>
                        {ded.metode === "per_day" && Number(ded.nominal_default || 0) === 0 && (
                          <div className="text-[10px] text-slate-400">Gaji pokok / 30 x jumlah</div>
                        )}
                      </div>
                      {ded.metode === "fixed" ? (
                        <div className="text-xs font-medium text-rose-600">
                          {formatIDR(ded.nominal_default)}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="h-8 w-24 text-right text-xs"
                            placeholder={ded.metode === "manual" ? "Rp" : "Jumlah"}
                            value={detailEmp?.component_inputs?.[ded.id] ?? ""}
                            onChange={(e) =>
                              detailEmp && handleInputChange(detailEmp.id, ded.id, e.target.value)
                            }
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
            <Button variant="ghost" onClick={closeDetail}>
              Tutup
            </Button>
            <Button onClick={closeDetail} className="bg-slate-900 text-white hover:bg-slate-800">
              Tutup
            </Button>
          </div>
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

                {allowanceTypes.map((alw) => (
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

                {deductionTypes.map((ded) => (
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
                    colSpan={allowanceTypes.length + deductionTypes.length + 4}
                    className="h-32 text-center"
                  >
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={allowanceTypes.length + deductionTypes.length + 4}
                    className="h-32 text-center text-slate-500"
                  >
                    Tidak ada karyawan di cabang ini.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp) => (
                  <Fragment key={emp.id}>
                      <TableRow className="group hover:bg-slate-50/50 transition-colors">
                      <TableCell className="sticky left-0 bg-white group-hover:bg-slate-50/95 z-10 space-y-2 border-r border-slate-100 transition-colors">
                        <div>
                          <div className="font-medium text-slate-900">{emp.nama}</div>
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
                                  type="number"
                                  className="h-7 text-xs text-right bg-white"
                                  placeholder="Kenaikan Rp"
                                  value={emp.salary_increase_manual || ""}
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

                      {allowanceTypes.map((alw) => {
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
                                  type="number"
                                  className={`h-7 text-center text-xs shadow-none transition-all ${alw.metode === "manual" ? "w-24" : "w-16"} border-slate-200 focus-visible:ring-1 focus-visible:ring-emerald-400`}
                                  placeholder={
                                    alw.metode === "manual"
                                      ? "Rp"
                                      : alw.metode === "per_day"
                                        ? "Hari"
                                        : "Jam"
                                  }
                                  value={inputVal}
                                  onChange={(e) =>
                                    handleInputChange(emp.id, alw.id, e.target.value)
                                  }
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
                            <span className="text-xs text-slate-300 block text-center mt-2">-</span>
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

                      {deductionTypes.map((ded) => {
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
                                  type="number"
                                  className={`h-7 text-center text-xs shadow-none transition-all ${ded.metode === "manual" ? "w-24" : "w-16"} border-slate-200 focus-visible:ring-1 focus-visible:ring-rose-400`}
                                  placeholder={ded.metode === "manual" ? "Rp" : "Hari"}
                                  value={inputVal}
                                  onChange={(e) =>
                                    handleInputChange(emp.id, ded.id, e.target.value)
                                  }
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

                      <TableCell className="font-bold text-right sticky right-0 bg-white group-hover:bg-slate-50/95 z-10 border-l border-slate-100 transition-colors align-middle">
                        <div className="flex items-center justify-end gap-2 text-base text-slate-900">
                          {formatIDR(emp.grandTotal)}
                          <ArrowRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow className="md:hidden bg-slate-50/60">
                      <TableCell
                        colSpan={allowanceTypes.length + deductionTypes.length + 5}
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
