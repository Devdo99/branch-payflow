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
  payroll_run_id: string
  employee_id: string
  gaji_pokok: number
  total_tunjangan: number
  total_potongan: number
  gaji_bersih: number
  allowanceQty: Record<string, string>
  deductionQty: Record<string, string>
  manualAllowances: Record<string, string>
  manualDeductions: Record<string, string>
<<<<<<< HEAD
=======
  jumlah_hari: string
  jumlah_jam_lembur: string
  jumlah_telat: string
  jumlah_izin: string
  jumlah_absen: string
  kasbon: string
  bonus_manual: string
>>>>>>> 7c8b8790191eb2911f8c09e97ae5deb0764d81c2
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
    if (rule.metode === 'fixed') return rule.nominal_default
    if (rule.metode === 'manual') return Number(item.manualAllowances?.[rule.id]) || 0
    if (rule.metode === 'per_day') {
      const qty = Number(item.allowanceQty?.[rule.id]) || 0
      const nominal = rule.nominal_default === 0 ? getGajiHarian(item.gaji_pokok) : rule.nominal_default
      return nominal * qty
    }
    return 0
  }

  const getDeductionAmount = (item: LocalPayrollItem, rule: SalaryRule) => {
    if (rule.metode === 'fixed') return rule.nominal_default
    if (rule.metode === 'manual') return Number(item.manualDeductions?.[rule.id]) || 0
    if (rule.metode === 'per_day') {
      const qty = Number(item.deductionQty?.[rule.id]) || 0
      const nominal = rule.nominal_default === 0 ? getGajiHarian(item.gaji_pokok) : rule.nominal_default
      return nominal * qty
    }
    return 0
  }

  const calculateItem = (item: LocalPayrollItem, rules: MasterRules) => {
    // 100% Mengandalkan Aturan Dinamis Master Data
    const totalTunjangan = rules.allowances.reduce(
      (total, rule) => total + getAllowanceAmount(item, rule),
      0
    )
    
    const totalPotongan = rules.deductions.reduce(
      (total, rule) => total + getDeductionAmount(item, rule),
      0
    )

<<<<<<< HEAD
    const gajiBersih = item.gaji_pokok + totalTunjangan - totalPotongan

    return {
      total_tunjangan: totalTunjangan,
      total_potongan: totalPotongan,
      gaji_bersih: gajiBersih,
=======
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
>>>>>>> 7c8b8790191eb2911f8c09e97ae5deb0764d81c2
    }
  }

  const handleUpdateItem = (
    itemId: string,
    field: keyof LocalPayrollItem,
    value: any
  ) => {
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value }
          const calculated = calculateItem(updatedItem, masterRules)
          return { ...updatedItem, ...calculated }
        }
        return item
      })
    )
  }

  const fetchPayrollItems = async (runId: string) => {
    const { data, error } = await supabase
      .from('payroll_items')
      .select(`
        *,
        employees (
          id,
<<<<<<< HEAD
          nama
        )
      `)
      .eq('payroll_run_id', runId)
      .order('id')
=======
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
>>>>>>> 7c8b8790191eb2911f8c09e97ae5deb0764d81c2

    if (error) {
      toast.error('Gagal mengambil data detail gaji')
      return
    }

<<<<<<< HEAD
    if (data) {
      const mapped = data.map((d: any) => {
        const allowanceQty = d.allowance_qty || {}
        const deductionQty = d.deduction_qty || {}
        const manualAllowances = d.manual_allowances || {}
        const manualDeductions = d.manual_deductions || {}

        return {
          id: d.id,
          payroll_run_id: d.payroll_run_id,
          employee_id: d.employee_id,
          gaji_pokok: Number(d.gaji_pokok) || 0,
          total_tunjangan: Number(d.total_tunjangan) || 0,
          total_potongan: Number(d.total_potongan) || 0,
          gaji_bersih: Number(d.gaji_bersih) || 0,
          catatan: d.catatan || '',
          allowanceQty,
          deductionQty,
          manualAllowances,
          manualDeductions,
          employees: d.employees,
        } as LocalPayrollItem
      })
      setLocalItems(mapped)
    }
  }
=======
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
>>>>>>> 7c8b8790191eb2911f8c09e97ae5deb0764d81c2

  const generateMutation = useMutation({
    mutationFn: async () => {
      const periode = `${selectedTahun}-${String(selectedBulan).padStart(2, '0')}`
      
      const { data: existing } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('periode', periode)
        .maybeSingle()

      if (existing) {
        throw new Error('Periode gaji ini sudah dibuat!')
      }

      const { data: run, error: runError } = await supabase
        .from('payroll_runs')
        .insert({ periode, status: 'draft' })
        .select()
        .single()

      if (runError) throw runError

<<<<<<< HEAD
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, gaji_pokok')
        .eq('aktif', true)
=======
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
>>>>>>> 7c8b8790191eb2911f8c09e97ae5deb0764d81c2

      if (empError) throw empError

      if (employees && employees.length > 0) {
        const items = employees.map(emp => {
          const gajiPokok = Number(emp.gaji_pokok) || 0
          
          const defaultTunjanganFixed = masterRules.allowances
            .filter(r => r.metode === 'fixed')
            .reduce((sum, r) => sum + r.nominal_default, 0)
            
          const defaultPotonganFixed = masterRules.deductions
            .filter(r => r.metode === 'fixed')
            .reduce((sum, r) => sum + r.nominal_default, 0)

          const gajiBersih = gajiPokok + defaultTunjanganFixed - defaultPotonganFixed

          return {
            payroll_run_id: run.id,
            employee_id: emp.id,
            gaji_pokok: gajiPokok,
            total_tunjangan: defaultTunjanganFixed,
            total_potongan: defaultPotonganFixed,
            gaji_bersih: gajiBersih,
            // Nilai kolom lama yang di-hardcode diset 0 secara default agar tabel DB tidak error
            jumlah_hari: 0,
            jumlah_jam_lembur: 0,
            jumlah_telat: 0,
            jumlah_izin: 0,
            jumlah_absen: 0,
            kasbon: 0,
            bonus_manual: 0,
            allowance_qty: {},
            deduction_qty: {},
            manual_allowances: {},
            manual_deductions: {}
          }
        })

        const { error: itemsError } = await supabase
          .from('payroll_items')
          .insert(items as any)

        if (itemsError) throw itemsError
      }

      return run
    },
    onSuccess: () => {
      toast.success('Periode gaji berhasil dibuat')
      setIsOpen(false)
      queryClient.invalidateQueries({ queryKey: ['payroll_runs'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal membuat periode gaji')
    }
  })

  const saveItemsMutation = useMutation({
    mutationFn: async () => {
      const updates = localItems.map((item) => ({
        id: item.id,
        payroll_run_id: item.payroll_run_id,
        employee_id: item.employee_id,
        gaji_pokok: item.gaji_pokok,
        total_tunjangan: item.total_tunjangan,
        total_potongan: item.total_potongan,
        gaji_bersih: item.gaji_bersih,
        catatan: item.catatan || null,
        allowance_qty: item.allowanceQty,
        deduction_qty: item.deductionQty,
        manual_allowances: item.manualAllowances,
        manual_deductions: item.manualDeductions,
        // Kolom lawas yang tidak lagi dipakai di UI
        jumlah_hari: 0,
        jumlah_jam_lembur: 0,
        jumlah_telat: 0,
        jumlah_izin: 0,
        jumlah_absen: 0,
        kasbon: 0,
        bonus_manual: 0,
      }))

      const { error } = await supabase
        .from('payroll_items')
        .upsert(updates as any)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Data rincian gaji berhasil disimpan')
      setEditingRun(null)
      queryClient.invalidateQueries({ queryKey: ['payroll_runs'] })
    },
    onError: (error) => {
      toast.error('Gagal menyimpan rincian gaji')
      console.error(error)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payroll_runs')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Periode gaji berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: ['payroll_runs'] })
    }
  })

<<<<<<< HEAD
=======
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
            jumlah_hari: Number(item.jumlah_hari) || 0,
            jumlah_jam_lembur: Number(item.jumlah_jam_lembur) || 0,
            jumlah_telat: Number(item.jumlah_telat) || 0,
            jumlah_izin: Number(item.jumlah_izin) || 0,
            jumlah_absen: Number(item.jumlah_absen) || 0,
            kasbon: Number(item.kasbon) || 0,
            bonus_manual: Number(item.bonus_manual) || 0,
            catatan: item.catatan || null,
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

  const handleFieldChange = (
    id: string,
    field: 'jumlah_hari' | 'jumlah_jam_lembur' | 'jumlah_telat' | 'jumlah_izin' | 'jumlah_absen' | 'kasbon' | 'bonus_manual' | 'catatan',
    value: string,
  ) => {
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, [field]: value }
        // kasbon & bonus mempengaruhi gaji bersih, lainnya hanya informasi
        if (field === 'kasbon' || field === 'bonus_manual') {
          return recalculateLocalItem(updated)
        }
        return updated
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

>>>>>>> 7c8b8790191eb2911f8c09e97ae5deb0764d81c2
  if (editingRun) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setEditingRun(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Proses Gaji: {formatPeriode(editingRun.periode)}</h1>
            <p className="text-muted-foreground">Isi rincian tunjangan dan potongan karyawan</p>
          </div>
        </div>

        <div className="flex justify-end sticky top-0 bg-background z-10 py-4 border-b">
          <Button onClick={() => saveItemsMutation.mutate()} disabled={saveItemsMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {saveItemsMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>

        <div className="space-y-8">
          {localItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card">
              Tidak ada data karyawan aktif pada periode ini.
            </div>
          ) : (
            localItems.map((item) => (
              <div key={item.id} className="border rounded-xl p-6 bg-card shadow-sm space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <h3 className="font-bold text-xl flex items-center gap-2">
                    {item.employees?.nama || 'Unknown'}
                  </h3>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Gaji Pokok</div>
                    <div className="font-semibold text-lg">{formatIDR(item.gaji_pokok)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* KOLOM KIRI: TUNJANGAN */}
                  <div className="space-y-6">
                    <div className="p-4 bg-green-50/50 border border-green-100 rounded-lg space-y-4">
                      <h4 className="font-semibold text-green-700 flex items-center gap-2">
                        <Coins className="h-4 w-4" /> Daftar Tunjangan
                      </h4>

<<<<<<< HEAD
                      {masterRules.allowances.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">Belum ada aturan tunjangan yang aktif.</p>
                      )}
=======
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

                      <div className="mt-4 space-y-2 rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          <ClipboardList className="h-3 w-3" /> Kehadiran & Lainnya
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            ['jumlah_hari', 'Hari Kerja'],
                            ['jumlah_jam_lembur', 'Lembur (jam)'],
                            ['jumlah_telat', 'Telat'],
                            ['jumlah_izin', 'Izin'],
                            ['jumlah_absen', 'Absen'],
                          ] as const).map(([field, label]) => (
                            <div key={field}>
                              <Label className="text-[10px] text-muted-foreground">{label}</Label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                value={item[field] ?? ''}
                                onChange={(e) => handleFieldChange(item.id, field, e.target.value)}
                                className="h-8"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-green-700">Bonus (+)</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={item.bonus_manual ?? ''}
                              onChange={(e) => handleFieldChange(item.id, 'bonus_manual', e.target.value)}
                              className="h-8"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-red-700">Kasbon (-)</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={item.kasbon ?? ''}
                              onChange={(e) => handleFieldChange(item.id, 'kasbon', e.target.value)}
                              className="h-8"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Catatan</Label>
                          <Textarea
                            rows={2}
                            value={item.catatan ?? ''}
                            onChange={(e) => handleFieldChange(item.id, 'catatan', e.target.value)}
                            className="text-xs"
                            placeholder="Catatan slip..."
                          />
                        </div>
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
>>>>>>> 7c8b8790191eb2911f8c09e97ae5deb0764d81c2

                      {masterRules.allowances.map((rule) => {
                        if (rule.metode === 'fixed') {
                            return (
                                <div key={rule.id} className="flex justify-between items-center py-2 border-b border-green-100/50">
                                    <Label className="text-sm text-muted-foreground">{rule.nama} <span className="text-[10px] text-green-600">(Otomatis/Tetap)</span></Label>
                                    <span className="font-medium text-sm">{formatIDR(rule.nominal_default)}</span>
                                </div>
                            )
                        } 

                        if (rule.metode === 'per_day') {
                          return (
                            <div key={rule.id} className="grid grid-cols-3 items-center gap-4">
                              <Label className="col-span-1 text-sm text-muted-foreground">
                                {rule.nama} <br/><span className="text-[10px] text-green-600">(Input Jumlah Hari)</span>
                              </Label>
                              <Input
                                className="col-span-2" type="number"
                                value={item.allowanceQty?.[rule.id] || ''}
                                onChange={(e) => handleUpdateItem(item.id, 'allowanceQty', {
                                    ...item.allowanceQty,
                                    [rule.id]: e.target.value,
                                })}
                                placeholder="Jml Hari"
                              />
                            </div>
                          );
                        }

                        if (rule.metode === 'manual') {
                          return (
                            <div key={rule.id} className="grid grid-cols-3 items-center gap-4">
                              <Label className="col-span-1 text-sm text-muted-foreground">
                                {rule.nama} <br/><span className="text-[10px] text-green-600">(Input Nominal Rp)</span>
                              </Label>
                              <Input
                                className="col-span-2" type="number"
                                value={item.manualAllowances?.[rule.id] || ''}
                                onChange={(e) => handleUpdateItem(item.id, 'manualAllowances', {
                                    ...item.manualAllowances,
                                    [rule.id]: e.target.value,
                                })}
                                placeholder="Nominal Rp"
                              />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>

                  {/* KOLOM KANAN: POTONGAN & CATATAN */}
                  <div className="space-y-6">
                    <div className="p-4 bg-red-50/50 border border-red-100 rounded-lg space-y-4">
                      <h4 className="font-semibold text-red-700 flex items-center gap-2">
                        <MinusCircle className="h-4 w-4" /> Daftar Potongan
                      </h4>

                      {masterRules.deductions.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">Belum ada aturan potongan yang aktif.</p>
                      )}

                      {masterRules.deductions.map((rule) => {
                        if (rule.metode === 'fixed') {
                            return (
                                <div key={rule.id} className="flex justify-between items-center py-2 border-b border-red-100/50">
                                    <Label className="text-sm text-muted-foreground">{rule.nama} <span className="text-[10px] text-red-600">(Otomatis/Tetap)</span></Label>
                                    <span className="font-medium text-sm">{formatIDR(rule.nominal_default)}</span>
                                </div>
                            )
                        }

                        if (rule.metode === 'per_day') {
                          return (
                            <div key={rule.id} className="grid grid-cols-3 items-center gap-4">
                              <Label className="col-span-1 text-sm text-muted-foreground">
                                {rule.nama} <br/><span className="text-[10px] text-red-600">(Input Jml Hari/Kali)</span>
                              </Label>
                              <Input
                                className="col-span-2" type="number"
                                value={item.deductionQty?.[rule.id] || ''}
                                onChange={(e) => handleUpdateItem(item.id, 'deductionQty', {
                                    ...item.deductionQty,
                                    [rule.id]: e.target.value,
                                })}
                                placeholder="Jml Hari/Kali"
                              />
                            </div>
                          );
                        }

                        if (rule.metode === 'manual') {
                          return (
                            <div key={rule.id} className="grid grid-cols-3 items-center gap-4">
                              <Label className="col-span-1 text-sm text-muted-foreground">
                                {rule.nama} <br/><span className="text-[10px] text-red-600">(Input Nominal Rp)</span>
                              </Label>
                              <Input
                                className="col-span-2" type="number"
                                value={item.manualDeductions?.[rule.id] || ''}
                                onChange={(e) => handleUpdateItem(item.id, 'manualDeductions', {
                                    ...item.manualDeductions,
                                    [rule.id]: e.target.value,
                                })}
                                placeholder="Nominal Rp"
                              />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                    
                    {/* CATATAN (Satu-satunya form statis yang disisakan untuk keterangan slip gaji) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Catatan Khusus (Opsional)</Label>
                      <Textarea 
                        placeholder="Tambahkan catatan untuk rincian gaji ini jika diperlukan..."
                        value={item.catatan}
                        onChange={(e) => handleUpdateItem(item.id, 'catatan', e.target.value)}
                        className="resize-none h-20"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t flex flex-col items-end gap-1">
                  <div className="text-sm flex gap-4 text-muted-foreground">
                    <span>Total Tunjangan: <span className="text-green-600 font-medium">+{formatIDR(item.total_tunjangan)}</span></span>
                    <span>Total Potongan: <span className="text-red-600 font-medium">-{formatIDR(item.total_potongan)}</span></span>
                  </div>
                  <div className="text-2xl font-bold mt-1 text-slate-800">
                    Gaji Bersih: {formatIDR(item.gaji_bersih)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Proses Gaji"
          description="Buat dan kelola kalkulasi gaji karyawan per periode."
        />
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Calculator className="h-4 w-4" /> Generate Gaji Baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Periode Gaji</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bulan</Label>
                  <Select
                    value={selectedBulan.toString()}
                    onValueChange={(v) => setSelectedBulan(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BULAN_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tahun</Label>
                  <Input
                    type="number"
                    value={selectedTahun}
                    onChange={(e) => setSelectedTahun(Number(e.target.value))}
                  />
                </div>
              </div>
              <Button 
                onClick={() => generateMutation.mutate()} 
                disabled={generateMutation.isPending || loadingRules}
              >
                {generateMutation.isPending ? 'Memproses...' : 'Generate Gaji Karyawan'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periode</TableHead>
              <TableHead>Total Karyawan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24">
                  <Loader2 className="mx-auto animate-spin" />
                </TableCell>
              </TableRow>
            ) : payrollRuns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                  Belum ada data periode gaji.
                </TableCell>
              </TableRow>
            ) : (
              payrollRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">
                    {formatPeriode(run.periode)}
                  </TableCell>
                  <TableCell>
                    {run.payroll_items?.length || 0} Orang
                  </TableCell>
                  <TableCell>
                    <Badge variant={run.status === 'draft' ? 'secondary' : 'default'}>
                      {run.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setEditingRun(run)
                        fetchPayrollItems(run.id)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" /> Edit Rincian
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        if (window.confirm('Yakin ingin menghapus periode ini?')) {
                          deleteMutation.mutate(run.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
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