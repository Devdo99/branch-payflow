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
import { toast } from 'sonner'
import { formatIDR } from '@/lib/format'
import { Calculator, Loader2, Play, Eye, ArrowLeft, Save, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/proses-gaji')({
  component: ProsesGajiPage,
})

const BULAN_OPTIONS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maret' },
  { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' }, { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
]

function ProsesGajiPage() {
  const queryClient = useQueryClient()
  
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  
  const [isOpen, setIsOpen] = useState(false)
  const [selectedBulan, setSelectedBulan] = useState<number>(currentMonth)
  const [selectedTahun, setSelectedTahun] = useState<number>(currentYear)

  const [editingRun, setEditingRun] = useState<any>(null)
  const [localItems, setLocalItems] = useState<any[]>([])

  // State info aturan aktif untuk ditampilkan di UI
  const [aturan, setAturan] = useState({ tTetap: 0, pTetap: 0 })

  // 1. Ambil Riwayat Periode Gaji
  const { data: payrollRuns, isLoading } = useQuery({
    queryKey: ['payroll_runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select(`id, periode, status, payroll_items ( id, gaji_bersih )`)
        .order('periode', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // 2. Fungsi Pembantu: Tarik Data Segar dari Database Tunjangan & Potongan
  const getAturanTerbaru = async () => {
    const { data: allowances } = await supabase.from('allowance_types').select('*').eq('aktif', true)
    const { data: deductions } = await supabase.from('deduction_types').select('*').eq('aktif', true)

    // Kita hanya mengambil yang metodenya "fixed" (Tetap per bulan)
    const tTetap = allowances?.filter(a => a.metode === 'fixed').reduce((acc, curr) => acc + Number(curr.nominal_default), 0) || 0
    const pTetap = deductions?.filter(d => d.metode === 'fixed').reduce((acc, curr) => acc + Number(curr.nominal_default), 0) || 0

    return { tTetap, pTetap }
  }

  // 3. Tarik Data Gaji Saat Layar Edit Dibuka
  const { isLoading: loadingEdit } = useQuery({
    queryKey: ['edit_payroll_items', editingRun?.id],
    queryFn: async () => {
      const aturanBaru = await getAturanTerbaru()
      setAturan(aturanBaru)

      const { data, error } = await supabase
        .from('payroll_items')
        .select(`id, gaji_pokok, total_tunjangan, total_potongan, gaji_bersih, employees ( id, nama )`)
        .eq('payroll_run_id', editingRun.id)
        .order('id', { ascending: true })
      
      if (error) throw error
      
      setLocalItems(data)
      return data
    },
    enabled: !!editingRun
  })

  // ================= MUTASI: BUAT DRAF BARU =================
  const generateMutation = useMutation({
    mutationFn: async () => {
      const periodeString = `${selectedTahun}-${selectedBulan.toString().padStart(2, '0')}`
      
      const { data: existing } = await supabase.from('payroll_runs').select('id').eq('periode', periodeString).maybeSingle()
      if (existing) throw new Error('Periode bulan ini sudah ada. Silakan hapus draf yang ada jika ingin mengulang.')

      const { data: employees } = await supabase.from('employees').select('id, gaji_pokok').eq('aktif', true)
      if (!employees || employees.length === 0) throw new Error('Tidak ada karyawan aktif.')

      // Tarik aturan terbaru tepat saat tombol ditekan
      const aturanLangsungDariDB = await getAturanTerbaru()

      const { data: run, error: runError } = await supabase.from('payroll_runs').insert({ periode: periodeString, status: 'draft' }).select().single()
      if (runError) throw runError

      const payrollItems = employees.map(emp => {
        const gapok = emp.gaji_pokok || 0
        const tunjangan = aturanLangsungDariDB.tTetap
        const potongan = aturanLangsungDariDB.pTetap
        const thp = gapok + tunjangan - potongan

        return {
          payroll_run_id: run.id,
          employee_id: emp.id,
          gaji_pokok: gapok,
          total_tunjangan: tunjangan,
          total_potongan: potongan,
          gaji_bersih: thp,
          slip_dibuat: false
        }
      })

      const { error: itemError } = await supabase.from('payroll_items').insert(payrollItems)
      if (itemError) throw itemError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_runs'] })
      toast.success('Periode gaji berhasil dibuat!')
      setIsOpen(false)
    },
    onError: (err: any) => toast.error(err.message)
  })

  // ================= MUTASI: HAPUS DRAF LAMA =================
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payroll_runs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_runs'] })
      toast.success('Draf periode gaji berhasil dihapus!')
    },
    onError: (err: any) => toast.error('Gagal menghapus: ' + err.message)
  })

  // ================= MUTASI: SIMPAN PERUBAHAN MASSAL =================
  const saveMassMutation = useMutation({
    mutationFn: async () => {
      const updates = localItems.map(item => 
        supabase.from('payroll_items').update({
          total_tunjangan: Number(item.total_tunjangan) || 0,
          total_potongan: Number(item.total_potongan) || 0,
          gaji_bersih: item.gaji_bersih
        }).eq('id', item.id)
      )
      const results = await Promise.all(updates)
      const err = results.find(r => r.error)
      if (err) throw err.error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_runs'] })
      toast.success('Data gaji berhasil disimpan!')
      setEditingRun(null)
    },
    onError: (err: any) => toast.error('Gagal menyimpan: ' + err.message)
  })

  // Perhitungan THP Saat Input Tunjangan/Potongan Diubah Manual
  const handleManualChange = (id: string, field: 'total_tunjangan' | 'total_potongan', value: string) => {
    setLocalItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        const t = Number(updated.total_tunjangan) || 0
        const p = Number(updated.total_potongan) || 0
        updated.gaji_bersih = updated.gaji_pokok + t - p
        return updated
      }
      return item
    }))
  }

  const formatPeriodeDisplay = (periodeStr: string) => {
    if (!periodeStr) return '-'
    const [year, month] = periodeStr.split('-')
    return `${BULAN_OPTIONS.find(b => b.value === Number(month))?.label} ${year}`
  }

  // ================= VIEW: MODE EDITOR MASSAL (SUPER LEAN) =================
  if (editingRun) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setEditingRun(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Input Gaji: {formatPeriodeDisplay(editingRun.periode)}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Otomatis dari Master: <span className="font-medium text-green-600">Tunj. Tetap {formatIDR(aturan.tTetap)}</span> | 
                <span className="font-medium text-red-600"> Pot. Tetap {formatIDR(aturan.pTetap)}</span>
              </p>
            </div>
          </div>
          
          <Button onClick={() => saveMassMutation.mutate()} disabled={saveMassMutation.isPending} className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
            {saveMassMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Perubahan
          </Button>
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-bold">Nama Karyawan</TableHead>
                <TableHead className="font-bold text-green-700 w-48">Total Tunjangan (+)</TableHead>
                <TableHead className="font-bold text-red-700 w-48">Total Potongan (-)</TableHead>
                <TableHead className="text-right font-bold">Take Home Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEdit ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
              ) : (
                localItems.map(item => (
                  <TableRow key={item.id} className="hover:bg-muted/10">
                    <TableCell>
                      <div className="font-medium text-base">{item.employees?.nama}</div>
                      <div className="text-xs text-muted-foreground">Gaji Pokok: {formatIDR(item.gaji_pokok)}</div>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.total_tunjangan} 
                        onChange={(e) => handleManualChange(item.id, 'total_tunjangan', e.target.value)}
                        className="w-full text-sm font-medium border-green-200 focus-visible:ring-green-500 bg-green-50/30"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.total_potongan} 
                        onChange={(e) => handleManualChange(item.id, 'total_potongan', e.target.value)}
                        className="w-full text-sm font-medium border-red-200 focus-visible:ring-red-500 bg-red-50/30"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-bold text-lg">{formatIDR(item.gaji_bersih)}</div>
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

  // ================= VIEW: DAFTAR PERIODE (DEFAULT) =================
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Proses Penggajian" description="Generate dan edit rincian gaji karyawan berdasarkan periode bulan." />
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Calculator className="h-4 w-4" /> Buat Proses Gaji Baru</Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader><DialogTitle>Generate Periode Penggajian</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); generateMutation.mutate(); }} className="flex flex-col gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Select value={selectedBulan.toString()} onValueChange={(val) => setSelectedBulan(Number(val))}>
                  <SelectTrigger><SelectValue placeholder="Pilih Bulan" /></SelectTrigger>
                  <SelectContent>{BULAN_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedTahun.toString()} onValueChange={(val) => setSelectedTahun(Number(val))}>
                  <SelectTrigger><SelectValue placeholder="Pilih Tahun" /></SelectTrigger>
                  <SelectContent>{[currentYear - 1, currentYear, currentYear + 1].map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="bg-blue-50 p-3 rounded border text-sm text-blue-800">
                Nilai awal Tunjangan & Potongan (Tetap) akan ditarik secara otomatis berdasarkan Master Data yang aktif saat ini.
              </div>
              <Button type="submit" className="mt-2 gap-2" disabled={generateMutation.isPending}>
                {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Generate Sekarang
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Jumlah Karyawan</TableHead>
              <TableHead className="text-right">Estimasi Total Gaji</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : payrollRuns?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Belum ada riwayat proses gaji.</TableCell></TableRow>
            ) : (
              payrollRuns?.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">{formatPeriodeDisplay(run.periode)}</TableCell>
                  <TableCell><Badge variant={run.status === 'draft' ? 'secondary' : 'default'}>{run.status}</Badge></TableCell>
                  <TableCell className="text-center">{run.payroll_items?.length || 0} Orang</TableCell>
                  <TableCell className="text-right font-medium">{formatIDR(run.payroll_items?.reduce((acc: number, curr: any) => acc + (curr.gaji_bersih || 0), 0) || 0)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => setEditingRun(run)} variant="outline" size="sm" className="gap-2">
                        <Eye className="h-4 w-4" />
                        Edit Data
                      </Button>
                      
                      {run.status === 'draft' && (
                        <Button 
                          onClick={() => {
                            if(window.confirm('Hapus draf ini agar bisa menarik ulang nominal pengaturan yang baru?')) {
                              deleteMutation.mutate(run.id)
                            }
                          }} 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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