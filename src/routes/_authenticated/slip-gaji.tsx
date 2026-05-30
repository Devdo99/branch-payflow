import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatIDR } from '@/lib/format'
import { FileText, Loader2, Send } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/slip-gaji')({
  component: SlipGajiPage,
})

function SlipGajiPage() {
  const [selectedRunId, setSelectedRunId] = useState<string>('all')
  const [selectedSlip, setSelectedSlip] = useState<any>(null)

  // Mengambil daftar periode (payroll_runs)
  const { data: payrollRuns = [] } = useQuery({
    queryKey: ['payroll_runs_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  // Mengambil daftar detail gaji (payroll_items) beserta relasinya
  const { data: payrollItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['payroll_items_list', selectedRunId],
    queryFn: async () => {
      // Menggunakan * (all) pada relasi untuk mencegah error akibat kolom tidak ditemukan
      let query = supabase
        .from('payroll_items')
        .select(`
          *,
          payroll_runs (*),
          employees (*)
        `)
        .order('created_at', { ascending: false })
      
      if (selectedRunId !== 'all') {
        query = query.eq('payroll_run_id', selectedRunId)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error fetching slips:', error)
        toast.error('Gagal memuat data slip gaji')
        return []
      }
      return data || []
    },
  })

  // Fungsi Kirim Pesan ke WhatsApp
  const handleSendWA = (slip: any) => {
    // Mengecek nomor HP, mendukung properti no_hp, telepon, maupun whatsapp
    const phone = slip.employees?.no_hp || slip.employees?.telepon || slip.employees?.whatsapp
    
    if (!phone) {
      toast.error('Nomor WhatsApp karyawan tidak ditemukan di data karyawan.')
      return
    }
    
    // Format nomor (Mengubah 08 menjadi 628)
    let formattedPhone = phone.replace(/\D/g, '') // Hapus karakter non-angka
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1)
    }
    
    const periode = slip.payroll_runs?.periode || 'Periode Saat Ini'
    
    const pesan = `Halo *${slip.employees?.nama}*,\n\nBerikut adalah rincian gaji Anda untuk periode *${periode}*:\n\n- Gaji Pokok: ${formatIDR(slip.gaji_pokok)}\n- Total Tunjangan: ${formatIDR(slip.total_tunjangan)}\n- Total Potongan: ${formatIDR(slip.total_potongan)}\n\n*Gaji Bersih Diterima: ${formatIDR(slip.gaji_bersih)}*\n\nTerima kasih atas kerja keras Anda.`
    
    const encodedPesan = encodeURIComponent(pesan)
    window.open(`https://wa.me/${formattedPhone}?text=${encodedPesan}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Slip Gaji" description="Kelola, lihat detail, dan kirim slip gaji karyawan via WhatsApp." />
      
      <div className="flex items-center gap-4">
        <div className="w-[300px]">
          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Periode Gaji" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Periode</SelectItem>
              {payrollRuns.map((run: any) => (
                <SelectItem key={run.id} value={run.id}>
                  {run.periode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead>Nama Karyawan</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Gaji Bersih</TableHead>
              <TableHead>Status Cetak</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingItems ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : payrollItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Belum ada data slip gaji untuk periode ini.
                </TableCell>
              </TableRow>
            ) : (
              payrollItems.map((slip: any) => (
                <TableRow key={slip.id}>
                  <TableCell className="font-medium text-slate-800">{slip.employees?.nama || 'Unknown'}</TableCell>
                  <TableCell>{slip.payroll_runs?.periode}</TableCell>
                  <TableCell className="font-bold text-primary">{formatIDR(slip.gaji_bersih)}</TableCell>
                  <TableCell>
                    <Badge variant={slip.slip_dibuat ? 'default' : 'secondary'} className="bg-blue-50 text-blue-700 border-blue-200">
                      {slip.slip_dibuat ? 'Selesai' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedSlip(slip)}>
                      <FileText className="w-4 h-4 mr-2" /> Detail
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleSendWA(slip)}
                    >
                      <Send className="w-4 h-4 mr-2" /> Kirim WA
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* DIALOG DETAIL SLIP GAJI */}
      <Dialog open={!!selectedSlip} onOpenChange={(open) => !open && setSelectedSlip(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Detail Slip Gaji</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="text-center pb-4 border-b">
              <h3 className="font-bold text-xl text-slate-800">{selectedSlip?.employees?.nama}</h3>
              <p className="text-sm text-muted-foreground">Periode: {selectedSlip?.payroll_runs?.periode}</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Gaji Pokok</span>
                <span className="font-medium">{formatIDR(selectedSlip?.gaji_pokok || 0)}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm bg-green-50/50 p-2 rounded">
                <span className="text-slate-600">Total Tunjangan (+)</span>
                <span className="font-medium text-green-700">{formatIDR(selectedSlip?.total_tunjangan || 0)}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm bg-red-50/50 p-2 rounded">
                <span className="text-slate-600">Total Potongan (-)</span>
                <span className="font-medium text-red-700">{formatIDR(selectedSlip?.total_potongan || 0)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="font-bold text-slate-800">Gaji Bersih Diterima</span>
              <span className="font-bold text-xl text-primary">{formatIDR(selectedSlip?.gaji_bersih || 0)}</span>
            </div>
          </div>
          
          <div className="flex justify-end pt-4 mt-2">
            <Button variant="outline" className="w-full" onClick={() => handleSendWA(selectedSlip)}>
              <Send className="w-4 h-4 mr-2 text-green-600" /> Kirim ke Karyawan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}