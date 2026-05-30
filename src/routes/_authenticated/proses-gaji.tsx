import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { formatIDR } from '@/lib/format'
import { toast } from 'sonner'
import { Loader2, Calculator, Plus, UserCog, ChevronDown, Trash2, ArrowRight, Store } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/proses-gaji')({
  component: AppProsesGajiPage,
})

const LIST_JOBDESK = ['Kasir', 'Cook / Dapur', 'Server / Pelayan', 'Barista', 'Piket Kebersihan', 'Staf Inti']

function AppProsesGajiPage() {
  const [employees, setEmployees] = useState<any[]>([])
  
  // State Filter Cabang
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [periodeGaji, setPeriodeGaji] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Ambil Data Cabang untuk Filter
  const { data: branches = [] } = useQuery({
    queryKey: ['branches_payroll_filter'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('nama')
      if (error) throw error
      return data || []
    }
  })

  const { data: dbEmployees, isLoading: loadingEmp } = useQuery({
    queryKey: ['employees_payroll_v7'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').eq('aktif', true)
      if (error) throw error
      return data || []
    }
  })

  const { data: allowanceTypes = [], isLoading: loadingAllowances } = useQuery({
    queryKey: ['allowance_types_v7'],
    queryFn: async () => {
      const { data, error } = await supabase.from('allowance_types').select('*').eq('aktif', true)
      if (error) throw error
      return data || []
    }
  })

  const { data: deductionTypes = [], isLoading: loadingDeductions } = useQuery({
    queryKey: ['deduction_types_v7'],
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

  // Filter Karyawan Berdasarkan Cabang yang Dipilih
  const filteredEmployees = useMemo(() => {
    if (selectedBranchId === 'all') return employees;
    return employees.filter(emp => emp.branch_id === selectedBranchId)
  }, [employees, selectedBranchId])

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
    const namaTunjangan = window.prompt("Nama Tunjangan Tambahan (Contoh: Bonus Target / Lembur Dadakan):")
    if (!namaTunjangan) return
    const nominal = Number(window.prompt("Masukkan Nominal (Rp):")) || 0
    if (nominal <= 0) return toast.error("Nominal tidak valid.")

    setEmployees(prev => prev.map(emp => {
      if (emp.id === empId) {
        const updatedEmp = { ...emp, custom_allowances: [...(emp.custom_allowances || []), { id: 'custom-' + Date.now(), nama: namaTunjangan, nominal }] }
        updatedEmp.grandTotal = calculateTotal(updatedEmp)
        return updatedEmp
      }
      return emp
    }))
    toast.success("Penyesuaian berhasil ditambahkan.")
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

  const executeSavePayroll = async () => {
    if (!periodeGaji) return toast.error("Periode penggajian wajib diisi.")
    if (filteredEmployees.length === 0) return toast.error("Belum ada data karyawan di cabang ini.")

    setIsSaving(true)
    try {
      // Tambahkan informasi cabang ke nama periode jika difilter
      const branchName = selectedBranchId !== 'all' ? branches.find((b:any) => b.id === selectedBranchId)?.nama : 'Semua Cabang'
      const finalPeriode = `${periodeGaji} (${branchName})`

      const { data: runData, error: runError } = await supabase
        .from('payroll_runs')
        .insert([{ periode: finalPeriode, status: 'draft' }])
        .select()
        .single()

      if (runError) throw runError

      const payrollItemsToInsert = filteredEmployees.map(emp => {
        const breakdown = getPayrollBreakdown(emp)
        return {
          payroll_run_id: runData.id,
          employee_id: emp.id,
          gaji_pokok: breakdown.gajiPokok,
          total_tunjangan: breakdown.totalTunjangan,
          total_potongan: breakdown.totalPotongan,
          gaji_bersih: breakdown.gajiBersih,
          slip_dibuat: true
        }
      })

      const { error: itemsError } = await supabase.from('payroll_items').insert(payrollItemsToInsert)
      if (itemsError) throw itemsError

      toast.success(`Payroll periode ${finalPeriode} berhasil dieksekusi.`)
      
      setIsConfirmOpen(false)
      setPeriodeGaji('')
      setEmployees(prev => prev.map(emp => ({ ...emp, component_inputs: {}, custom_allowances: [] })))

    } catch (error: any) {
      console.error(error)
      toast.error(`Kegagalan sistem: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const isLoading = loadingEmp || loadingAllowances || loadingDeductions

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kalkulasi Payroll</h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Tinjau dan sesuaikan komponen gaji bersih karyawan untuk periode berjalan.
          </p>
        </div>
        
        {/* Kontrol Kanan: Filter Cabang + Tombol Eksekusi */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
            <Store className="w-4 h-4 text-slate-500 ml-1" />
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-[180px] h-8 border-0 bg-transparent shadow-none focus:ring-0 text-sm font-medium">
                <SelectValue placeholder="Pilih Cabang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Cabang</SelectItem>
                {branches.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setIsConfirmOpen(true)} disabled={isLoading || filteredEmployees.length === 0} className="shadow-sm">
            <Calculator className="w-4 h-4 mr-2" /> Eksekusi Payroll
          </Button>
        </div>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembuatan Draft</DialogTitle>
            <DialogDescription>
              Sistem akan merangkum seluruh kalkulasi dan menerbitkan slip gaji untuk <strong className="text-slate-800">{filteredEmployees.length} karyawan</strong> 
              {selectedBranchId !== 'all' && ` di cabang terpilih`}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-700">Periode Penggajian</Label>
              <Input 
                placeholder="Misal: Periode 1-31 Mei 2026" 
                value={periodeGaji} 
                onChange={(e) => setPeriodeGaji(e.target.value)} 
                disabled={isSaving}
                className="shadow-none focus-visible:ring-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t mt-2">
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} disabled={isSaving}>Batalkan</Button>
            <Button onClick={executeSavePayroll} disabled={isSaving || !periodeGaji} className="bg-slate-900 text-white hover:bg-slate-800">
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</> : 'Lanjutkan Proses'}
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
                
                {allowanceTypes.map(alw => (
                  <TableHead key={alw.id} className="text-center min-w-[120px] border-t-2 border-t-emerald-400 bg-emerald-50/30">
                    <div className="font-medium text-slate-800 text-sm">{alw.nama}</div>
                    <div className="text-[10px] font-medium text-emerald-600/70 uppercase tracking-wider mt-0.5">
                      {alw.metode === 'fixed' ? 'Tetap' : alw.metode === 'per_day' ? 'Faktor Hari' : alw.metode === 'per_hour' ? 'Faktor Jam' : 'Nominal'}
                    </div>
                  </TableHead>
                ))}

                <TableHead className="text-center w-56 border-t-2 border-t-teal-400 bg-teal-50/30">
                  <div className="font-medium text-slate-800 text-sm">Penyesuaian Tambahan</div>
                  <div className="text-[10px] font-medium text-teal-600/70 uppercase tracking-wider mt-0.5">Ad-Hoc / Custom</div>
                </TableHead>

                {deductionTypes.map(ded => (
                  <TableHead key={ded.id} className="text-center min-w-[120px] border-t-2 border-t-rose-400 bg-rose-50/30">
                    <div className="font-medium text-slate-800 text-sm">{ded.nama}</div>
                    <div className="text-[10px] font-medium text-rose-600/70 uppercase tracking-wider mt-0.5">
                      {ded.metode === 'fixed' ? 'Tetap' : ded.metode === 'per_day' ? 'Faktor Hari' : 'Nominal'}
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
                <TableRow><TableCell colSpan={allowanceTypes.length + deductionTypes.length + 4} className="h-32 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></TableCell></TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow><TableCell colSpan={allowanceTypes.length + deductionTypes.length + 4} className="h-32 text-center text-slate-500">Tidak ada karyawan di cabang ini.</TableCell></TableRow>
              ) : filteredEmployees.map((emp) => (
                <TableRow key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                  <TableCell className="sticky left-0 bg-white group-hover:bg-slate-50/95 z-10 space-y-2 border-r border-slate-100 transition-colors">
                    <div>
                      <div className="font-medium text-slate-900">{emp.nama}</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        {emp.selected_jobdesks.length > 0 ? emp.selected_jobdesks.join(' • ') : 'Tidak ada peran aktif'}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] shadow-none border-slate-200 text-slate-600 hover:text-slate-900">
                            <UserCog className="w-3 h-3 mr-1.5 text-blue-500" /> Atur Peran <ChevronDown className="w-3 h-3 ml-1 text-slate-400" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2 rounded-xl shadow-lg border-slate-100" align="start">
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 pb-1 mb-1 border-b border-slate-100">Kaitkan Peran</div>
                            {LIST_JOBDESK.map(job => {
                              const isChecked = emp.selected_jobdesks.some((j: string) => j.toLowerCase().trim() === job.toLowerCase().trim())
                              return (
                                <div key={job} className="flex items-center space-x-2 p-1.5 hover:bg-slate-50 rounded-md transition-colors">
                                  <Checkbox 
                                    id={`job-${emp.id}-${job}`} 
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handleJobdeskToggle(emp.id, job, !!checked)}
                                    className="border-slate-300 rounded-[4px]"
                                  />
                                  <label id={`job-${emp.id}-${job}`} className="text-xs font-medium cursor-pointer flex-1 text-slate-700">{job}</label>
                                </div>
                              )
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] shadow-none border-teal-200 text-teal-700 bg-teal-50/30 hover:bg-teal-100" onClick={() => handleAddCustomAllowance(emp.id)}>
                        <Plus className="w-3 h-3 mr-1" /> Penyesuaian
                      </Button>
                    </div>
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm font-medium">{formatIDR(emp.gaji_pokok)}</TableCell>

                  {allowanceTypes.map(alw => {
                    const isEligible = checkIsEligible(alw.catatan, emp.selected_jobdesks)
                    const inputVal = emp.component_inputs[alw.id] ?? ''
                    const finalVal = getComponentCalculatedValue(alw, emp)
                    
                    return (
                      <TableCell key={alw.id} className="text-center align-top pt-4">
                        {!isEligible ? (
                          <span className="text-slate-200 text-sm font-medium">-</span>
                        ) : alw.metode === 'fixed' ? (
                          <span className="text-sm font-medium text-slate-700">{formatIDR(alw.nominal_default)}</span>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5">
                            <Input 
                              type="number" 
                              className={`h-7 text-center text-xs shadow-none transition-all ${alw.metode === 'manual' ? 'w-24' : 'w-16'} border-slate-200 focus-visible:ring-1 focus-visible:ring-emerald-400`} 
                              placeholder={alw.metode === 'manual' ? "Rp" : alw.metode === 'per_day' ? "Hari" : "Jam"}
                              value={inputVal} 
                              onChange={(e) => handleInputChange(emp.id, alw.id, e.target.value)} 
                            />
                            {finalVal > 0 && <span className="text-[10px] text-emerald-600 font-semibold">{formatIDR(finalVal)}</span>}
                          </div>
                        )}
                      </TableCell>
                    )
                  })}

                  <TableCell className="align-top pt-3">
                    <div className="space-y-1.5 max-h-28 overflow-y-auto p-0.5">
                      {emp.custom_allowances?.length === 0 ? <span className="text-xs text-slate-300 block text-center mt-2">-</span> : 
                        emp.custom_allowances?.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between bg-white border border-slate-200 shadow-sm rounded-md px-2 py-1.5">
                          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[90px]" title={c.nama}>{c.nama}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-800">{formatIDR(c.nominal)}</span>
                            <button onClick={() => handleRemoveCustomAllowance(emp.id, c.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TableCell>

                  {deductionTypes.map(ded => {
                    const inputVal = emp.component_inputs[ded.id] ?? ''
                    const finalVal = getComponentCalculatedValue(ded, emp)

                    return (
                      <TableCell key={ded.id} className="text-center align-top pt-4">
                        {ded.metode === 'fixed' ? (
                          <span className="text-sm font-medium text-rose-600/80">{formatIDR(ded.nominal_default)}</span>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5">
                            <Input 
                              type="number" 
                              className={`h-7 text-center text-xs shadow-none transition-all ${ded.metode === 'manual' ? 'w-24' : 'w-16'} border-slate-200 focus-visible:ring-1 focus-visible:ring-rose-400`} 
                              placeholder={ded.metode === 'manual' ? "Rp" : "Hari"}
                              value={inputVal} 
                              onChange={(e) => handleInputChange(emp.id, ded.id, e.target.value)} 
                            />
                            {finalVal > 0 && <span className="text-[10px] text-rose-500 font-semibold">{formatIDR(finalVal)}</span>}
                          </div>
                        )}
                      </TableCell>
                    )
                  })}

                  <TableCell className="font-bold text-right sticky right-0 bg-white group-hover:bg-slate-50/95 z-10 border-l border-slate-100 transition-colors align-middle">
                    <div className="flex items-center justify-end gap-2 text-base text-slate-900">
                      {formatIDR(emp.grandTotal)}
                      <ArrowRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}