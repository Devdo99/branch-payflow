import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
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

export const Route = createFileRoute('/_authenticated/proses-gaji')({
  component: ProsesGajiPage,
})

type AnyRow = Record<string, any>
type ComponentKind = 'allowance' | 'deduction'

const formatRupiah = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

const toNumber = (value: any) => {
  if (typeof value === 'number') return value
  if (!value) return 0

  const cleaned = String(value).replace(/[^\d.-]/g, '')
  return Number(cleaned) || 0
}

const truthy = (value: any) => {
  const text = String(value).toLowerCase()
  return value === true || value === 1 || text === 'true' || text === 'ya' || text === 'yes'
}

const normalizeList = (value: any): any[] => {
  if (!value) return []
  if (Array.isArray(value)) return value

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  if (typeof value === 'object') return [value]

  return [value]
}

const getEmployeeName = (employee: AnyRow) => {
  return employee.nama || employee.name || employee.employee_name || '-'
}

const getBaseSalary = (employee: AnyRow) => {
  return toNumber(
    employee.gaji_pokok ??
      employee.base_salary ??
      employee.salary ??
      employee.gaji ??
      0
  )
}

const getComponentName = (component: AnyRow) => {
  return component.nama || component.name || component.label || 'Tanpa nama'
}

const getComponentAmount = (component: AnyRow) => {
  return toNumber(
    component.nominal ??
      component.amount ??
      component.nilai ??
      component.default_amount ??
      component.jumlah ??
      0
  )
}

const isComponentActive = (component: AnyRow) => {
  if (
    component.aktif === false ||
    component.active === false ||
    component.is_active === false ||
    component.status === false
  ) {
    return false
  }

  if (
    truthy(component.hidden) ||
    truthy(component.is_hidden) ||
    truthy(component.deleted) ||
    truthy(component.is_deleted)
  ) {
    return false
  }

  return true
}

const isMultiplyComponent = (component: AnyRow) => {
  const type = String(
    component.tipe_perhitungan ??
      component.calculation_type ??
      component.type ??
      component.metode ??
      component.jenis_hitung ??
      ''
  ).toLowerCase()

  return (
    type.includes('kali') ||
    type.includes('dikali') ||
    type.includes('multiply') ||
    type.includes('qty') ||
    type.includes('quantity') ||
    type.includes('jumlah') ||
    type.includes('per_hari') ||
    type.includes('per hari') ||
    type.includes('per_jam') ||
    type.includes('per jam') ||
    type.includes('per_unit') ||
    type.includes('per unit')
  )
}

const listContainsEmployee = (value: any, employeeId: any) => {
  const employeeIdText = String(employeeId)

  return normalizeList(value).some((item) => {
    if (!item) return false

    if (typeof item === 'object') {
      const candidates = [
        item.id,
        item.employee_id,
        item.karyawan_id,
        item.user_id,
      ]

      return candidates.some((candidate) => String(candidate) === employeeIdText)
    }

    return String(item) === employeeIdText
  })
}

const listContainsComponent = (value: any, component: AnyRow) => {
  const componentId = String(component.id)
  const componentName = String(getComponentName(component)).toLowerCase()

  return normalizeList(value).some((item) => {
    if (!item) return false

    if (typeof item === 'object') {
      const candidates = [
        item.id,
        item.type_id,
        item.allowance_type_id,
        item.deduction_type_id,
        item.tunjangan_id,
        item.potongan_id,
        item.nama,
        item.name,
      ]

      return candidates.some((candidate) => {
        const text = String(candidate).toLowerCase()
        return String(candidate) === componentId || text === componentName
      })
    }

    const text = String(item).toLowerCase()
    return String(item) === componentId || text === componentName
  })
}

const isComponentApplicable = (
  component: AnyRow,
  employee: AnyRow,
  kind: ComponentKind
) => {
  if (!isComponentActive(component)) return false

  const employeeId = employee.id

  if (component.employee_id && String(component.employee_id) === String(employeeId)) {
    return true
  }

  if (component.karyawan_id && String(component.karyawan_id) === String(employeeId)) {
    return true
  }

  if (listContainsEmployee(component.employee_ids, employeeId)) {
    return true
  }

  if (listContainsEmployee(component.karyawan_ids, employeeId)) {
    return true
  }

  if (listContainsEmployee(component.employees, employeeId)) {
    return true
  }

  const employeeSpecialComponents =
    kind === 'allowance'
      ? employee.tunjangan_khusus ?? employee.allowances ?? employee.allowance_types
      : employee.potongan_khusus ?? employee.deductions ?? employee.deduction_types

  if (listContainsComponent(employeeSpecialComponents, component)) {
    return true
  }

  const scope = String(
    component.scope ??
      component.applies_to ??
      component.jenis_berlaku ??
      component.berlaku ??
      ''
  ).toLowerCase()

  const isGlobal =
    truthy(component.is_global) ||
    truthy(component.global) ||
    truthy(component.berlaku_semua) ||
    scope.includes('global') ||
    scope.includes('semua') ||
    scope.includes('all')

  if (isGlobal) return true

  const hasTargetSetting =
    component.employee_id ||
    component.karyawan_id ||
    component.employee_ids ||
    component.karyawan_ids ||
    component.employees ||
    component.scope ||
    component.applies_to ||
    component.jenis_berlaku ||
    component.berlaku

  /**
   * Kalau komponen tidak punya penanda khusus/global,
   * anggap sebagai komponen umum agar tetap muncul.
   */
  if (!hasTargetSetting) return true

  return false
}

function ProsesGajiPage() {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const [quantities, setQuantities] = useState<Record<string, string>>({})

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['employees_payroll'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('employees')
        .select('*')

      if (error) throw error
      return (data || []) as AnyRow[]
    },
  })

  const { data: allowanceTypes = [] } = useQuery({
    queryKey: ['allowance_types_payroll'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('allowance_types')
        .select('*')

      if (error) {
        console.error('Gagal mengambil allowance_types:', error)
        return []
      }

      return (data || []) as AnyRow[]
    },
  })

  const { data: deductionTypes = [] } = useQuery({
    queryKey: ['deduction_types_payroll'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('deduction_types')
        .select('*')

      if (error) {
        console.error('Gagal mengambil deduction_types:', error)
        return []
      }

      return (data || []) as AnyRow[]
    },
  })

  const getQuantityKey = (
    employeeId: string,
    kind: ComponentKind,
    componentId: string
  ) => {
    return `${employeeId}-${kind}-${componentId}`
  }

  const getQuantityValue = (
    employeeId: string,
    kind: ComponentKind,
    componentId: string
  ) => {
    return quantities[getQuantityKey(employeeId, kind, componentId)] ?? ''
  }

  const getQuantityNumber = (
    employeeId: string,
    kind: ComponentKind,
    componentId: string
  ) => {
    return toNumber(getQuantityValue(employeeId, kind, componentId))
  }

  const setQuantityValue = (
    employeeId: string,
    kind: ComponentKind,
    componentId: string,
    value: string
  ) => {
    setQuantities((prev) => ({
      ...prev,
      [getQuantityKey(employeeId, kind, componentId)]: value,
    }))
  }

  const payrollRows = useMemo(() => {
    return employees.map((employee) => {
      const applicableAllowances = allowanceTypes.filter((item) =>
        isComponentApplicable(item, employee, 'allowance')
      )

      const applicableDeductions = deductionTypes.filter((item) =>
        isComponentApplicable(item, employee, 'deduction')
      )

      const baseSalary = getBaseSalary(employee)

      const allowanceTotal = applicableAllowances.reduce((total, item) => {
        const amount = getComponentAmount(item)
        const isMultiply = isMultiplyComponent(item)

        if (isMultiply) {
          const qty = getQuantityNumber(employee.id, 'allowance', item.id)
          return total + amount * qty
        }

        return total + amount
      }, 0)

      const deductionTotal = applicableDeductions.reduce((total, item) => {
        const amount = getComponentAmount(item)
        const isMultiply = isMultiplyComponent(item)

        if (isMultiply) {
          const qty = getQuantityNumber(employee.id, 'deduction', item.id)
          return total + amount * qty
        }

        return total + amount
      }, 0)

      const netSalary = baseSalary + allowanceTotal - deductionTotal

      return {
        employee,
        baseSalary,
        applicableAllowances,
        applicableDeductions,
        allowanceTotal,
        deductionTotal,
        netSalary,
      }
    })
  }, [employees, allowanceTypes, deductionTypes, quantities])

  const grandTotal = payrollRows.reduce((total, row) => total + row.netSalary, 0)

  const summaryText = useMemo(() => {
    const periodText = period ? period.split('-').reverse().join('/') : '-'

    const detail = payrollRows
      .map((row, index) => {
        return `${index + 1}. ${getEmployeeName(row.employee)}
Gaji Pokok: ${formatRupiah(row.baseSalary)}
Tunjangan: ${formatRupiah(row.allowanceTotal)}
Potongan: ${formatRupiah(row.deductionTotal)}
Gaji Bersih: *${formatRupiah(row.netSalary)}*`
      })
      .join('\n\n')

    return `*Ringkasan Gaji Bulanan*
Periode: ${periodText}

${detail}

*Total Gaji Keseluruhan: ${formatRupiah(grandTotal)}*`
  }, [payrollRows, period, grandTotal])

  const handleCopySummary = async () => {
    await navigator.clipboard.writeText(summaryText)
    alert('Ringkasan gaji berhasil disalin.')
  }

  const renderComponentList = (
    employee: AnyRow,
    items: AnyRow[],
    kind: ComponentKind
  ) => {
    if (!items.length) {
      return <p className="text-sm text-muted-foreground">Tidak ada</p>
    }

    return (
      <div className="space-y-3">
        {items.map((item) => {
          const isMultiply = isMultiplyComponent(item)
          const amount = getComponentAmount(item)
          const quantity = getQuantityNumber(employee.id, kind, item.id)
          const total = isMultiply ? amount * quantity : amount

          return (
            <div
              key={`${employee.id}-${kind}-${item.id}`}
              className="rounded-lg border p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{getComponentName(item)}</p>
                  <p className="text-xs text-muted-foreground">
                    Nominal: {formatRupiah(amount)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold">{formatRupiah(total)}</p>
                  <p className="text-xs text-muted-foreground">
                    {isMultiply ? 'Dikali jumlah' : 'Nominal tetap'}
                  </p>
                </div>
              </div>

              {isMultiply && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground min-w-[90px]">
                    Isi jumlah
                  </span>

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0"
                    value={getQuantityValue(employee.id, kind, item.id)}
                    onChange={(event) =>
                      setQuantityValue(
                        employee.id,
                        kind,
                        item.id,
                        event.target.value
                      )
                    }
                    className="h-9 w-28"
                  />

                  <span className="text-sm text-muted-foreground">
                    x {formatRupiah(amount)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (employeesLoading) {
    return (
      <div className="p-6">
        <p>Memuat data proses gaji...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Proses Gaji Bulanan</h2>
          <p className="text-sm text-muted-foreground">
            Isi jumlah hanya untuk tunjangan atau potongan yang menggunakan sistem dikali.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div>
            <p className="mb-1 text-sm font-medium">Periode Gaji</p>
            <Input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="w-full sm:w-44"
            />
          </div>

          <Button onClick={handleCopySummary} className="sm:mt-6">
            Copy Ringkasan WA
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Jumlah Karyawan</p>
          <p className="text-2xl font-bold">{employees.length}</p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Total Tunjangan</p>
          <p className="text-2xl font-bold">
            {formatRupiah(
              payrollRows.reduce((total, row) => total + row.allowanceTotal, 0)
            )}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Total Potongan</p>
          <p className="text-2xl font-bold">
            {formatRupiah(
              payrollRows.reduce((total, row) => total + row.deductionTotal, 0)
            )}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Total Gaji Bersih</p>
          <p className="text-2xl font-bold">{formatRupiah(grandTotal)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Karyawan</TableHead>
              <TableHead className="min-w-[140px]">Gaji Pokok</TableHead>
              <TableHead className="min-w-[320px]">Tunjangan</TableHead>
              <TableHead className="min-w-[320px]">Potongan</TableHead>
              <TableHead className="min-w-[150px]">Total Tunjangan</TableHead>
              <TableHead className="min-w-[150px]">Total Potongan</TableHead>
              <TableHead className="min-w-[160px]">Gaji Bersih</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {payrollRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Belum ada data karyawan.
                </TableCell>
              </TableRow>
            )}

            {payrollRows.map((row) => (
              <TableRow key={row.employee.id} className="align-top">
                <TableCell>
                  <div>
                    <p className="font-semibold">{getEmployeeName(row.employee)}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {row.employee.id}
                    </p>
                  </div>
                </TableCell>

                <TableCell className="font-medium">
                  {formatRupiah(row.baseSalary)}
                </TableCell>

                <TableCell>
                  {renderComponentList(
                    row.employee,
                    row.applicableAllowances,
                    'allowance'
                  )}
                </TableCell>

                <TableCell>
                  {renderComponentList(
                    row.employee,
                    row.applicableDeductions,
                    'deduction'
                  )}
                </TableCell>

                <TableCell className="font-semibold">
                  {formatRupiah(row.allowanceTotal)}
                </TableCell>

                <TableCell className="font-semibold">
                  {formatRupiah(row.deductionTotal)}
                </TableCell>

                <TableCell className="text-lg font-bold">
                  {formatRupiah(row.netSalary)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border p-4">
        <p className="mb-2 font-semibold">Preview Ringkasan WA</p>
        <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
          {summaryText}
        </pre>
      </div>
    </div>
  )
}