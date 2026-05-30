import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formatIDR } from '@/lib/format'
import {
  Calculator,
  Loader2,
  Eye,
  ArrowLeft,
  Save,
  Trash2,
  Coins,
  MinusCircle,
  ClipboardList,
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/proses-gaji')({
  component: ProsesGajiPage,
})

const BULAN_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
]

type RuleMethod = 'fixed' | 'per_day' | 'manual'

type SalaryRule = {
  id: string
  nama: string
  nominal_default: number
  metode: RuleMethod
  aktif: boolean
}

type PayrollRun = {
  id: string
  periode: string
  status: string
  payroll_items?: {
    id: string
    gaji_bersih: number | null
  }[] | null
}

type LocalPayrollItem = {
  id: string
  gaji_pokok: number
  total_tunjangan: number
  total_potongan: number
  gaji_bersih: number
  allowanceQty: Record<string, string>
  deductionQty: Record<string, string>
  manualAllowances: Record<string, string>
  manualDeductions: Record<string, string>
  jumlah_hari: string
  jumlah_jam_lembur: string
  jumlah_telat: string
  jumlah_izin: string
  jumlah_absen: string
  kasbon: string
  bonus_manual: string
  catatan: string
  employees?: {
    id: string
    nama: string
  } | null
}

type MasterRules = {
  allowances: SalaryRule[]
  deductions: SalaryRule[]
}

function ProsesGajiPage() {
  const queryClient = useQueryClient()

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const [isOpen, setIsOpen] = useState(false)
  const [selectedBulan, setSelectedBulan] = useState<number>(currentMonth)
  const [selectedTahun, setSelectedTahun] = useState<number>(currentYear)
  const [editingRun, setEditingRun] = useState<PayrollRun | null>(null)
  const [localItems, setLocalItems] = useState<LocalPayrollItem[]>([])

  const normalizeMethod = (value: unknown): RuleMethod => {
  const raw = String(value ?? '').trim().toLowerCase()

  if (
    raw === 'per_day' ||
    raw === 'harian' ||
    raw === 'perhari' ||
    raw === 'per day' ||
    raw === 'daily'
  ) {
    return 'per_day'
  }

  if (raw === 'manual') {
    return 'manual'
  }

  return 'fixed'
}

const normalizeRule = (item: any): SalaryRule => {
  return {
    id: item.id,
    nama: item.nama,
    nominal_default: Number(item.nominal_default) || 0,
    metode: normalizeMethod(item.metode),
    aktif: Boolean(item.aktif),
  }
}

  const getMasterRules = async (): Promise<MasterRules> => {
    const { data: allowances, error: allowanceError } = await supabase
      .from('allowance_types')
      .select('id, nama, nominal_default, metode, aktif')
      .eq('aktif', true)
      .order('nama')

    if (allowanceError) throw allowanceError

    const { data: deductions, error: deductionError } = await supabase
      .from('deduction_types')
      .select('id, nama, nominal_default, metode, aktif')
      .eq('aktif', true)
      .order('nama')

    if (deductionError) throw deductionError

    return {
      allowances: (allowances ?? []).map(normalizeRule),
      deductions: (deductions ?? []).map(normalizeRule),
    }
  }

  const {
    data: masterRules = { allowances: [], deductions: [] },
    isLoading: loadingRules,
  } = useQuery({
    queryKey: ['payroll_master_rules'],
    queryFn: getMasterRules,
  })

  const { data: payrollRuns = [], isLoading } = useQuery({
    queryKey: ['payroll_runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select(`
          id,
          periode,
          status,
          payroll_items (
            id,
            gaji_bersih
          )
        `)
        .order('periode', { ascending: false })

      if (error) throw error

      return (data ?? []) as PayrollRun[]
    },
  })

  const formatPeriode = (periode: string) => {
    const [tahun, bulan] = periode.split('-')
    const namaBulan = BULAN_OPTIONS.find(
      (item) => item.value === Number(bulan),
    )?.label

    return `${namaBulan ?? bulan} ${tahun}`
  }

  const getGajiHarian = (gajiPokok: number) => {
    return Math.round((Number(gajiPokok) || 0) / 30)
  }

  const getAllowanceAmount = (item: LocalPayrollItem, rule: SalaryRule) => {
    const nominal = Number(rule.nominal_default) || 0
    const qty = Number(item.allowanceQty?.[rule.id]) || 0
    const manual = Number(item.manualAllowances?.[rule.id]) || 0
    const gajiHarian = getGajiHarian(item.gaji_pokok)

    if (rule.metode === 'fixed') return nominal

    if (rule.metode === 'per_day') {
      return nominal === 0 ? gajiHarian * qty : nominal * qty
    }

    return manual
  }

  const getDeductionAmount = (item: LocalPayrollItem, rule: SalaryRule) => {
    const nominal = Number(rule.nominal_default) || 0
    const qty = Number(item.deductionQty?.[rule.id]) || 0
    const manual = Number(item.manualDeductions?.[rule.id]) || 0
    const gajiHarian = getGajiHarian(item.gaji_pokok)

    if (rule.metode === 'fixed') return nominal

    if (rule.metode === 'per_day') {
      return nominal === 0 ? gajiHarian * qty : nominal * qty
    }

    return manual
  }

  const calculateItem = (item: LocalPayrollItem, rules: MasterRules) => {
    const totalTunjangan = rules.allowances.reduce((total, rule) => {
      return total + getAllowanceAmount(item, rule)
    }, 0)

    const totalPotongan = rules.deductions.reduce((total, rule) => {
      return total + getDeductionAmount(item, rule)
    }, 0)

    const gajiPokok = Number(item.gaji_pokok) || 0
    const bonus = Number(item.bonus_manual) || 0
    const kasbon = Number(item.kasbon) || 0
    const gajiBersih = gajiPokok + totalTunjangan + bonus - totalPotongan - kasbon

    return {
      total_tunjangan: Math.round(totalTunjangan + bonus),
      total_potongan: Math.round(totalPotongan + kasbon),
      gaji_bersih: Math.round(gajiBersih),
    }
  }

  const { isLoading: loadingEdit } = useQuery({
    queryKey: ['edit_payroll_items', editingRun?.id],
    queryFn: async () => {
      if (!editingRun?.id) return []

      const { data, error } = await supabase
        .from('payroll_items')
        .select(`
          id,
          gaji_pokok,
          total_tunjangan,
          total_potongan,
          gaji_bersih,
          jumlah_hari,
          jumlah_jam_lembur,
          jumlah_telat,
          jumlah_izin,
          jumlah_absen,
          kasbon,
          bonus_manual,
          catatan,
          employees (
            id,
            nama
          )
        `)
        .eq('payroll_run_id', editingRun.id)
        .order('id', { ascending: true })

      if (error) throw error

      const rows = (data ?? []) as any[]

      const mappedRows: LocalPayrollItem[] = rows.map((item) => ({
        id: item.id,
        gaji_pokok: Number(item.gaji_pokok) || 0,
        total_tunjangan: Number(item.total_tunjangan) || 0,
        total_potongan: Number(item.total_potongan) || 0,
        gaji_bersih: Number(item.gaji_bersih) || 0,
        allowanceQty: {},
        deductionQty: {},
        manualAllowances: {},
        manualDeductions: {},
        jumlah_hari: item.jumlah_hari != null ? String(item.jumlah_hari) : '',
        jumlah_jam_lembur: item.jumlah_jam_lembur != null ? String(item.jumlah_jam_lembur) : '',
        jumlah_telat: item.jumlah_telat != null ? String(item.jumlah_telat) : '',
        jumlah_izin: item.jumlah_izin != null ? String(item.jumlah_izin) : '',
        jumlah_absen: item.jumlah_absen != null ? String(item.jumlah_absen) : '',
        kasbon: item.kasbon != null && Number(item.kasbon) !== 0 ? String(item.kasbon) : '',
        bonus_manual: item.bonus_manual != null && Number(item.bonus_manual) !== 0 ? String(item.bonus_manual) : '',
        catatan: item.catatan ?? '',
        employees: item.employees,
      }))

      setLocalItems(mappedRows)

      return mappedRows
    },
    enabled: !!editingRun?.id,
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const periodeString = `${selectedTahun}-${selectedBulan
        .toString()
        .padStart(2, '0')}`

      const { data: existing, error: existingError } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('periode', periodeString)
        .maybeSingle()

      if (existingError) throw existingError
      if (existing) throw new Error('Periode ini sudah ada.')

      const { data: employees, error: employeeError } = await supabase
        .from('employees')
        .select('id, gaji_pokok')
        .eq('aktif', true)

      if (employeeError) throw employeeError

      if (!employees || employees.length === 0) {
        throw new Error('Tidak ada karyawan aktif.')
      }

      const freshRules = await getMasterRules()

      const { data: run, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
          periode: periodeString,
          status: 'draft',
        })
        .select()
        .single()

      if (runError) throw runError

      const payrollItems = employees.map((employee) => {
        const baseItem: LocalPayrollItem = {
          id: '',
          gaji_pokok: Number(employee.gaji_pokok) || 0,
          total_tunjangan: 0,
          total_potongan: 0,
          gaji_bersih: 0,
          allowanceQty: {},
          deductionQty: {},
          manualAllowances: {},
          manualDeductions: {},
          jumlah_hari: '',
          jumlah_jam_lembur: '',
          jumlah_telat: '',
          jumlah_izin: '',
          jumlah_absen: '',
          kasbon: '',
          bonus_manual: '',
          catatan: '',
        }

        const calc = calculateItem(baseItem, freshRules)

        return {
          payroll_run_id: run.id,
          employee_id: employee.id,
          gaji_pokok: baseItem.gaji_pokok,
          total_tunjangan: calc.total_tunjangan,
          total_potongan: calc.total_potongan,
          gaji_bersih: calc.gaji_bersih,
          slip_dibuat: false,
        }
      })

      const { error: itemError } = await supabase
        .from('payroll_items')
        .insert(payrollItems)

      if (itemError) throw itemError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_runs'] })
      toast.success('Draf proses gaji berhasil dibuat.')
      setIsOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal membuat proses gaji')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: itemError } = await supabase
        .from('payroll_items')
        .delete()
        .eq('payroll_run_id', id)

      if (itemError) throw itemError

      const { error: runError } = await supabase
        .from('payroll_runs')
        .delete()
        .eq('id', id)

      if (runError) throw runError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_runs'] })
      toast.success('Draf berhasil dihapus.')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menghapus draf')
    },
  })

  const saveMassMutation = useMutation({
    mutationFn: async () => {
      const updates = localItems.map(async (item) => {
        const calc = calculateItem(item, masterRules)

        const { error } = await supabase
          .from('payroll_items')
          .update({
            total_tunjangan: calc.total_tunjangan,
            total_potongan: calc.total_potongan,
            gaji_bersih: calc.gaji_bersih,
          })
          .eq('id', item.id)

        if (error) throw error
      })

      await Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_runs'] })
      toast.success('Data gaji berhasil disimpan.')
      setEditingRun(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menyimpan data')
    },
  })

  const recalculateLocalItem = (item: LocalPayrollItem) => {
    const calc = calculateItem(item, masterRules)

    return {
      ...item,
      total_tunjangan: calc.total_tunjangan,
      total_potongan: calc.total_potongan,
      gaji_bersih: calc.gaji_bersih,
    }
  }

  const handleAllowanceQtyChange = (
    id: string,
    ruleId: string,
    value: string,
  ) => {
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item

        const updated = {
          ...item,
          allowanceQty: {
            ...item.allowanceQty,
            [ruleId]: value,
          },
        }

        return recalculateLocalItem(updated)
      }),
    )
  }

  const handleDeductionQtyChange = (
    id: string,
    ruleId: string,
    value: string,
  ) => {
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item

        const updated = {
          ...item,
          deductionQty: {
            ...item.deductionQty,
            [ruleId]: value,
          },
        }

        return recalculateLocalItem(updated)
      }),
    )
  }

  const handleManualAllowanceChange = (
    id: string,
    ruleId: string,
    value: string,
  ) => {
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item

        const updated = {
          ...item,
          manualAllowances: {
            ...item.manualAllowances,
            [ruleId]: value,
          },
        }

        return recalculateLocalItem(updated)
      }),
    )
  }

  const handleManualDeductionChange = (
    id: string,
    ruleId: string,
    value: string,
  ) => {
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item

        const updated = {
          ...item,
          manualDeductions: {
            ...item.manualDeductions,
            [ruleId]: value,
          },
        }

        return recalculateLocalItem(updated)
      }),
    )
  }

  const renderRuleDescription = (
    rule: SalaryRule,
    type: 'allowance' | 'deduction',
    gajiPokok?: number,
  ) => {
    if (rule.metode === 'fixed') {
      return `Tetap: ${formatIDR(rule.nominal_default)}`
    }

    if (rule.metode === 'manual') {
      return 'Manual: isi nominal saat proses gaji'
    }

    if (rule.nominal_default === 0) {
      const harian = getGajiHarian(gajiPokok ?? 0)
      return `Proporsional: ${formatIDR(harian)} x jumlah`
    }

    return `${formatIDR(rule.nominal_default)} x jumlah ${
      type === 'allowance' ? 'hari/qty' : 'hari/kejadian'
    }`
  }

  if (editingRun) {
    return (
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setEditingRun(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Proses Gaji {formatPeriode(editingRun.periode)}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {masterRules.allowances.length} Tunjangan Aktif
                </Badge>
                <Badge variant="secondary">
                  {masterRules.deductions.length} Potongan Aktif
                </Badge>
                <Badge variant="outline">Status: {editingRun.status}</Badge>
              </div>
            </div>
          </div>

          <Button
            onClick={() => saveMassMutation.mutate()}
            disabled={saveMassMutation.isPending || loadingRules}
            className="gap-2 font-semibold"
          >
            {saveMassMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan Perubahan
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="min-w-[220px] font-bold">
                  Karyawan
                </TableHead>

                <TableHead className="min-w-[340px] font-bold text-green-700">
                  Tunjangan
                </TableHead>

                <TableHead className="min-w-[340px] font-bold text-red-700">
                  Potongan
                </TableHead>

                <TableHead className="min-w-[170px] text-right font-bold">
                  Gaji Bersih
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loadingEdit || loadingRules ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <Loader2 className="mx-auto animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : localItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Tidak ada item gaji.
                  </TableCell>
                </TableRow>
              ) : (
                localItems.map((item) => (
                  <TableRow key={item.id} className="align-top">
                    <TableCell className="align-top">
                      <div className="font-bold text-base">
                        {item.employees?.nama ?? '-'}
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        Gaji Pokok
                      </div>

                      <div className="font-semibold">
                        {formatIDR(item.gaji_pokok)}
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        Harian: {formatIDR(getGajiHarian(item.gaji_pokok))}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="space-y-2">
                        {masterRules.allowances.length === 0 ? (
                          <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                            Tidak ada tunjangan aktif.
                          </div>
                        ) : (
                          masterRules.allowances.map((rule) => {
                            const amount = getAllowanceAmount(item, rule)

                            return (
                              <div
                                key={rule.id}
                                className="rounded-lg border bg-green-50/40 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-bold">
                                      {rule.nama}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                      {renderRuleDescription(
                                        rule,
                                        'allowance',
                                        item.gaji_pokok,
                                      )}
                                    </div>
                                  </div>

                                  {rule.metode === 'fixed' && (
                                    <div className="text-right font-bold text-green-700">
                                      {formatIDR(amount)}
                                    </div>
                                  )}
                                </div>

                                {rule.metode === 'per_day' && (
                                  <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Isi jumlah"
                                      value={item.allowanceQty?.[rule.id] ?? ''}
                                      onChange={(event) =>
                                        handleAllowanceQtyChange(
                                          item.id,
                                          rule.id,
                                          event.target.value,
                                        )
                                      }
                                      className="h-9 font-semibold"
                                    />

                                    <div className="min-w-[120px] text-right font-bold text-green-700">
                                      {formatIDR(amount)}
                                    </div>
                                  </div>
                                )}

                                {rule.metode === 'manual' && (
                                  <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Isi nominal"
                                      value={
                                        item.manualAllowances?.[rule.id] ?? ''
                                      }
                                      onChange={(event) =>
                                        handleManualAllowanceChange(
                                          item.id,
                                          rule.id,
                                          event.target.value,
                                        )
                                      }
                                      className="h-9 font-semibold"
                                    />

                                    <div className="min-w-[120px] text-right font-bold text-green-700">
                                      {formatIDR(amount)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}

                        <div className="flex items-center justify-between rounded-lg border bg-green-100/60 px-3 py-2">
                          <div className="flex items-center gap-2 font-bold text-green-800">
                            <Coins className="h-4 w-4" />
                            Total Tunjangan
                          </div>
                          <div className="font-bold text-green-800">
                            {formatIDR(item.total_tunjangan)}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="space-y-2">
                        {masterRules.deductions.length === 0 ? (
                          <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                            Tidak ada potongan aktif.
                          </div>
                        ) : (
                          masterRules.deductions.map((rule) => {
                            const amount = getDeductionAmount(item, rule)

                            return (
                              <div
                                key={rule.id}
                                className="rounded-lg border bg-red-50/40 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-bold">
                                      {rule.nama}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                      {renderRuleDescription(
                                        rule,
                                        'deduction',
                                        item.gaji_pokok,
                                      )}
                                    </div>
                                  </div>

                                  {rule.metode === 'fixed' && (
                                    <div className="text-right font-bold text-red-700">
                                      {formatIDR(amount)}
                                    </div>
                                  )}
                                </div>

                                {rule.metode === 'per_day' && (
                                  <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Isi jumlah"
                                      value={item.deductionQty?.[rule.id] ?? ''}
                                      onChange={(event) =>
                                        handleDeductionQtyChange(
                                          item.id,
                                          rule.id,
                                          event.target.value,
                                        )
                                      }
                                      className="h-9 font-semibold"
                                    />

                                    <div className="min-w-[120px] text-right font-bold text-red-700">
                                      {formatIDR(amount)}
                                    </div>
                                  </div>
                                )}

                                {rule.metode === 'manual' && (
                                  <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Isi nominal"
                                      value={
                                        item.manualDeductions?.[rule.id] ?? ''
                                      }
                                      onChange={(event) =>
                                        handleManualDeductionChange(
                                          item.id,
                                          rule.id,
                                          event.target.value,
                                        )
                                      }
                                      className="h-9 font-semibold"
                                    />

                                    <div className="min-w-[120px] text-right font-bold text-red-700">
                                      {formatIDR(amount)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}

                        <div className="flex items-center justify-between rounded-lg border bg-red-100/60 px-3 py-2">
                          <div className="flex items-center gap-2 font-bold text-red-800">
                            <MinusCircle className="h-4 w-4" />
                            Total Potongan
                          </div>
                          <div className="font-bold text-red-800">
                            {formatIDR(item.total_potongan)}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="align-top text-right">
                      <div className="text-xs font-medium text-muted-foreground">
                        Take Home Pay
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight">
                        {formatIDR(item.gaji_bersih)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Proses Penggajian"
          description="Generate dan edit rincian gaji berdasarkan master tunjangan dan potongan."
        />

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 font-semibold">
              <Calculator className="h-4 w-4" />
              Buat Proses Gaji Baru
            </Button>
          </DialogTrigger>

          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Generate Periode Penggajian</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                generateMutation.mutate()
              }}
              className="flex flex-col gap-4 py-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <Select
                  value={selectedBulan.toString()}
                  onValueChange={(value) => setSelectedBulan(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BULAN_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value.toString()}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedTahun.toString()}
                  onValueChange={(value) => setSelectedTahun(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map(
                      (year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                Sistem mengambil data dari Master Tunjangan dan Master Potongan
                yang statusnya aktif. Komponen harian akan muncul sebagai form
                pengisian angka di halaman edit gaji.
              </div>

              <Button
                type="submit"
                disabled={generateMutation.isPending}
                className="font-semibold"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  'Generate Sekarang'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Tunjangan Aktif</div>
          <div className="mt-1 text-2xl font-black">
            {masterRules.allowances.length}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Potongan Aktif</div>
          <div className="mt-1 text-2xl font-black">
            {masterRules.deductions.length}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Periode Dibuat</div>
          <div className="mt-1 text-2xl font-black">{payrollRuns.length}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">Periode</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="text-center font-bold">Karyawan</TableHead>
              <TableHead className="text-right font-bold">Total Gaji</TableHead>
              <TableHead className="text-right font-bold">Aksi</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading || loadingRules ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto animate-spin" />
                </TableCell>
              </TableRow>
            ) : payrollRuns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  Belum ada data proses gaji.
                </TableCell>
              </TableRow>
            ) : (
              payrollRuns.map((run) => {
                const totalGaji =
                  run.payroll_items?.reduce(
                    (acc, item) => acc + (Number(item.gaji_bersih) || 0),
                    0,
                  ) ?? 0

                return (
                  <TableRow key={run.id}>
                    <TableCell className="font-bold">
                      {formatPeriode(run.periode)}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          run.status === 'draft' ? 'secondary' : 'default'
                        }
                      >
                        {run.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center font-semibold">
                      {run.payroll_items?.length ?? 0} Orang
                    </TableCell>

                    <TableCell className="text-right text-base font-black">
                      {formatIDR(totalGaji)}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => setEditingRun(run)}
                          variant="outline"
                          size="sm"
                          className="gap-2 font-semibold"
                        >
                          <Eye className="h-4 w-4" />
                          Edit
                        </Button>

                        {run.status === 'draft' && (
                          <Button
                            onClick={() => {
                              if (
                                window.confirm('Hapus draf proses gaji ini?')
                              ) {
                                deleteMutation.mutate(run.id)
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}