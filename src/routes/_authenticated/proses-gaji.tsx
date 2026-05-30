import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { formatIDR } from '@/lib/format'
import { toast } from 'sonner'
import { Loader2, Save, Plus, Briefcase, ChevronDown, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/proses-gaji')({
  component: AppProsesGajiPage,
})

const LIST_JOBDESK = ['Kasir', 'Cook / Dapur', 'Server / Pelayan', 'Barista', 'Piket Kebersihan', 'Staf Inti']

function AppProsesGajiPage() {
  const [employees, setEmployees] = useState<any[]>([])
  
  // State untuk Dialog Simpan
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [periodeGaji, setPeriodeGaji] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { data: dbEmployees, isLoading: loadingEmp } = useQuery({
    queryKey: ['employees_payroll_v6'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').eq('aktif', true)
      if (error) throw error
      return data || []
    }
  })

  const { data: allowanceTypes = [], isLoading: loadingAllowances } = useQuery({
    queryKey: ['allowance_types_v6'],
    queryFn: async () => {
      const { data, error } = await supabase.from('allowance_types').select('*').eq('aktif', true)
      if (error) throw error
      return data || []
    }
  })

  const { data: deductionTypes = [], isLoading: loadingDeductions } = useQuery({
    queryKey: ['deduction_types_v6'],
    queryFn: async () => {
      const { data, error } = await supabase.from('deduction_types').select('*').eq('aktif', true)
      if (error) throw error
      return data || []
    }
  })

  useEffect(() => {
    if (dbEmployees) {
      setEmployees(dbEmployees.map(emp => ({
        ...emp,
        component_inputs: {}, 
        selected_jobdesks: emp.jabatan ? [emp.jabatan] : [],
        custom_allowances: [], 
        grandTotal: emp.gaji_pokok || 0
      })))
    }
  }, [dbEmployees])

  const checkIsEligible = (catatan: string | null, empJobdesks: string[]) => {
    if (!catatan || catatan === 'GLOBAL') return true
    const targetJobdesks = catatan.split(',').map(j => j.toLowerCase().trim())
    return empJobdesks.some(job => targetJobdesks.includes(job.toLowerCase().trim()))
  }

  const getComponentCalculatedValue = (item: any, emp: any) => {
    const metode = item.metode
    const nominalDefault = Number(item.nominal_default || 0)
    const inputVal = Number(emp.component_inputs?.[item.id]) || 0

    const isEligible = checkIsEligible(item.catatan, emp.selected_jobdesks)
    if (!isEligible) return 0

    if (metode === 'fixed') return nominalDefault
    if (metode === 'manual') return inputVal
    if (metode === 'per_day' || metode === 'per_hour') return inputVal * nominalDefault
    
    return 0
  }

  const getPayrollBreakdown = (emp: any) => {
    let totalTunjangan = 0
    let totalPotongan = 0

    allowanceTypes.forEach(alw => { totalTunjangan += getComponentCalculatedValue(alw, emp) })
    emp.custom_allowances?.forEach((c: any) => { totalTunjangan += Number(c.nominal) || 0 })
    deductionTypes.forEach(ded => { totalPotongan += getComponentCalculatedValue(ded, emp) })

    const gajiPokok = Number(emp.gaji_pokok) || 0
    const gajiBersih = (gajiPokok + totalTunjangan) - totalPotongan

    return { gajiPokok, totalTunjangan, totalPotongan, gajiBersih }
  }

  const calculateTotal = (emp: any) => {
    return getPayrollBreakdown(emp).gajiBersih
  }

  const handleJobdeskToggle = (empId: string, jobdesk: string, checked: boolean) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id === empId) {
        const currentJobdesks = [...emp.selected_jobdesks]
        const jobLower = jobdesk.toLowerCase().trim()
        let updatedJobdesks = currentJobdesks.filter(j => j.toLowerCase().trim() !== jobLower)
        if (checked) { updatedJobdesks.push(jobdesk) }
        const updatedEmp = { ...emp, selected_jobdesks: updatedJobdesks }
        updatedEmp.grandTotal = calculateTotal(updatedEmp)
        return updatedEmp
      }
      return emp
    }))
  }

  const handleInputChange = (empId: string, compId: string, value: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id === empId) {
        const updatedEmp = { ...emp, component_inputs: { ...emp.component_inputs, [compId]: value } }
        updatedEmp.grandTotal = calculateTotal(updatedEmp)
        return updatedEmp
      }
      return emp
    }))
  }

  const handleAddCustomAllowance = (empId: string) => {
    const namaTunjangan = window.prompt("Nama Tunjangan Baru (misal: Insentif):")
    if (!namaTunjangan) return
    const nominal = Number(window.prompt("Nominal Rupiah (Rp):")) || 0
    if (nominal <= 0) return toast.error("Nominal harus lebih dari 0")

    setEmployees(prev => prev.map(emp => {
      if (emp.id === empId) {
        const updatedEmp = { ...emp, custom_allowances: [...(emp.custom_allowances || []), { id: 'custom-' + Date.now(), nama: namaTunjangan, nominal }] }
        updatedEmp.grandTotal = calculateTotal(updatedEmp)
        return updatedEmp
      }
      return emp
    }))
    toast.success("Tunjangan berhasil ditambahkan!")
  }

  const handleRemoveCustomAllowance = (empId: string, customId: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id === empId) {
        const updatedEmp = { ...emp, custom_allowances: emp.custom_allowances.filter((c: any) => c.id !== customId) }
        updatedEmp.grandTotal = calculateTotal(updatedEmp)
        return updatedEmp
      }
      return emp
    }))
  }

  // ================= LOGIKA SIMPAN (DENGAN DIALOG UI) =================
  const executeSavePayroll = async () => {
    if (!periodeGaji) return toast.error("Nama periode wajib diisi!")
    if (employees.length === 0) return toast.error("Tidak ada data karyawan untuk diproses.")

    setIsSaving(true)
    try {
      const { data: runData, error: runError } = await supabase
        .from('payroll_runs')
        .insert([{ periode: periodeGaji, status: 'draft' }])
        .select()
        .single()

      if (runError) throw runError

      const payrollRunId = runData.id

      const payrollItemsToInsert = employees.map(emp => {
        const breakdown = getPayrollBreakdown(emp)
        return {
          payroll_run_id: payrollRunId,
          employee_id: emp.id,
          gaji_pokok: breakdown.gajiPokok,
          total_tunjangan: breakdown.totalTunjangan,
          total_potongan: breakdown.totalPotongan,
          gaji_bersih: breakdown.gajiBersih,
          slip_dibuat: true
        }
      })

      const { error: itemsError } = await supabase
        .from('payroll_items')
        .insert(payrollItemsToInsert)

      if (itemsError) throw itemsError

      toast.success(`Sukses! Seluruh slip gaji periode "${periodeGaji}" berhasil dibuat.`)
      
      // Reset state dan tutup modal
      setIsConfirmOpen(false)
      setPeriodeGaji('')
      setEmployees(prev => prev.map(emp => ({ ...emp, component_inputs: {}, custom_allowances: [] })))

    } catch (error: any) {
      console.error(error)
      toast.error(`Gagal menyimpan data: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const isLoading = loadingEmp || loadingAllowances || loadingDeductions

  return (
    <div className="space-y-6">
      <PageHeader title="Proses Gaji" description="Kelola double jobdesk staf dan form dinamis berbasis hak penerima." />
      
      <div className="flex justify-end">
        {/* Tombol pemicu Dialog Simpan */}
        <Button onClick={() => setIsConfirmOpen(true)} disabled={isLoading || employees.length === 0}>
          <Save className="w-4 h-4 mr-2" /> Simpan Proses Gaji
        </Button>
      </div>

      {/* DIALOG SIMPAN PERIODE GAJI */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Simpan & Buat Slip Gaji</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Periode Gaji</Label>
              <Input 
                placeholder="Misal: Mei 2026 atau Minggu ke-4 Mei" 
                value={periodeGaji} 
                onChange={(e) => setPeriodeGaji(e.target.value)} 
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Sistem akan membuat draft slip gaji untuk {employees.length} karyawan.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isSaving}>Batal</Button>
            <Button onClick={executeSavePayroll} disabled={isSaving || !periodeGaji}>
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : 'Ya, Buat Slip'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border overflow-x-auto pb-4">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-white shadow-[1px_0_0_0_#e5e7eb] z-20 w-64">Karyawan & Jobdesk</TableHead>
              <TableHead>Gaji Pokok</TableHead>
              
              {allowanceTypes.map(alw => (
                <TableHead key={alw.id} className="text-green-700 bg-green-50/50 text-center">
                  {alw.nama} <br/>
                  <span className="text-[10px] font-normal block text-muted-foreground">
                    {alw.metode === 'fixed' ? 'Otomatis' : alw.metode === 'per_day' ? 'x Hari' : alw.metode === 'per_hour' ? 'x Jam' : 'Input Rp'}
                  </span>
                </TableHead>
              ))}

              <TableHead className="text-emerald-800 bg-emerald-100/50 text-center w-48">Tunjangan Custom</TableHead>

              {deductionTypes.map(ded => (
                <TableHead key={ded.id} className="text-red-700 bg-red-50/50 text-center">
                  {ded.nama} <br/>
                  <span className="text-[10px] font-normal block text-muted-foreground">
                    {ded.metode === 'fixed' ? 'Otomatis' : ded.metode === 'per_day' ? 'x Hari' : 'Input Rp'}
                  </span>
                </TableHead>
              ))}

              <TableHead className="font-bold text-right sticky right-0 bg-white shadow-[-1px_0_0_0_#e5e7eb] z-10">Gaji Bersih</TableHead>
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={allowanceTypes.length + deductionTypes.length + 4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : employees.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="sticky left-0 bg-white shadow-[1px_0_0_0_#e5e7eb] z-10 space-y-2">
                  <div>
                    <div className="font-semibold text-slate-800">{emp.nama}</div>
                    <div className="text-[10px] text-muted-foreground italic">
                      {emp.selected_jobdesks.length > 0 ? emp.selected_jobdesks.join(', ') : 'Belum pilih jobdesk'}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 border-blue-200">
                          <Briefcase className="w-3 h-3 mr-1 text-blue-600" /> Jobdesk ({emp.selected_jobdesks.length}) <ChevronDown className="w-3 h-3 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold px-1 pb-1 border-b">Pilih Jobdesk Staf</div>
                          {LIST_JOBDESK.map(job => {
                            const isChecked = emp.selected_jobdesks.some((j: string) => j.toLowerCase().trim() === job.toLowerCase().trim())
                            return (
                              <div key={job} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded">
                                <Checkbox 
                                  id={`job-${emp.id}-${job}`} 
                                  checked={isChecked}
                                  onCheckedChange={(checked) => handleJobdeskToggle(emp.id, job, !!checked)}
                                />
                                <label id={`job-${emp.id}-${job}`} className="text-xs font-medium cursor-pointer flex-1">{job}</label>
                              </div>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => handleAddCustomAllowance(emp.id)}>
                      <Plus className="w-3 h-3 mr-1" /> Custom
                    </Button>
                  </div>
                </TableCell>

                <TableCell>{formatIDR(emp.gaji_pokok)}</TableCell>

                {allowanceTypes.map(alw => {
                  const isEligible = checkIsEligible(alw.catatan, emp.selected_jobdesks)
                  const inputVal = emp.component_inputs[alw.id] ?? ''
                  const finalVal = getComponentCalculatedValue(alw, emp)
                  
                  return (
                    <TableCell key={alw.id} className="bg-green-50/10 text-center">
                      {!isEligible ? (
                        <span className="text-slate-300 text-lg font-light">-</span>
                      ) : alw.metode === 'fixed' ? (
                        <span className="text-sm font-medium text-green-600">{formatIDR(alw.nominal_default)}</span>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Input 
                            type="number" 
                            className="w-20 h-8 text-center text-xs border-green-200" 
                            placeholder={alw.metode === 'manual' ? "Rp" : alw.metode === 'per_day' ? "Hari" : "Jam"}
                            value={inputVal} 
                            onChange={(e) => handleInputChange(emp.id, alw.id, e.target.value)} 
                          />
                          {finalVal > 0 && <span className="text-[10px] text-green-600 font-medium">{formatIDR(finalVal)}</span>}
                        </div>
                      )}
                    </TableCell>
                  )
                })}

                <TableCell className="bg-emerald-50/20">
                  <div className="space-y-1 max-h-24 overflow-y-auto p-1">
                    {emp.custom_allowances?.length === 0 ? <span className="text-xs text-muted-foreground italic block text-center">-</span> : 
                      emp.custom_allowances?.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between bg-white border border-emerald-100 rounded px-1.5 py-0.5 text-[11px]">
                        <span className="font-medium text-slate-700 truncate max-w-[80px]">{c.nama}</span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-emerald-700">{formatIDR(c.nominal)}</span>
                          <button onClick={() => handleRemoveCustomAllowance(emp.id, c.id)} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TableCell>

                {deductionTypes.map(ded => {
                  const inputVal = emp.component_inputs[ded.id] ?? ''
                  const finalVal = getComponentCalculatedValue(ded, emp)

                  return (
                    <TableCell key={ded.id} className="bg-red-50/10 text-center">
                      {ded.metode === 'fixed' ? (
                        <span className="text-sm font-medium text-red-600">{formatIDR(ded.nominal_default)}</span>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Input 
                            type="number" 
                            className="w-20 h-8 text-center text-xs border-red-200 text-red-600" 
                            placeholder={ded.metode === 'manual' ? "Rp" : "Hari"}
                            value={inputVal} 
                            onChange={(e) => handleInputChange(emp.id, ded.id, e.target.value)} 
                          />
                          {finalVal > 0 && <span className="text-[10px] text-red-500 font-medium">{formatIDR(finalVal)}</span>}
                        </div>
                      )}
                    </TableCell>
                  )
                })}

                <TableCell className="font-bold text-right sticky right-0 bg-white shadow-[-1px_0_0_0_#e5e7eb] z-10 text-primary text-base">
                  {formatIDR(emp.grandTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}