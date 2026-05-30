import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
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
import { Loader2, Printer, FileText, Send, Mail } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/slip-gaji')({
  component: SlipGajiPage,
})

function SlipGajiPage() {
  const queryClient = useQueryClient()
  const [selectedRunId, setSelectedRunId] = useState<string>('all')
  const [selectedSlip, setSelectedSlip] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Ambil daftar periode (payroll_runs) untuk dropdown filter
  const { data: payrollRuns, isLoading: loadingRuns } = useQuery({
    queryKey: ['payroll_runs_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('id, periode, status')
        .order('periode', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Ambil daftar payroll items beserta data whatsapp & email karyawan
  const { data: payrollItems, isLoading: loadingItems } = useQuery({
    queryKey: ['payroll_items', selectedRunId],
    queryFn: async () => {
      let query = supabase
        .from('payroll_items')
        .select(`
          id,
          gaji_pokok,
          total_tunjangan,
          total_potongan,
          gaji_bersih,
          slip_dibuat,
          payroll_runs ( id, periode, status ),
          employees ( id, nama, jabatan, nomor_rekening, nama_bank, whatsapp, email )
        `)
      
      if (selectedRunId !== 'all') {
        query = query.eq('payroll_run_id', selectedRunId)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!payrollRuns,
  })

  // Mutasi untuk memperbarui status pengiriman di database
  const markAsSentMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('payroll_items')
        .update({ slip_dibuat: true })
        .eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => {
      // Refresh data tabel slip dan ringkasan agar status berubah secara real-time
      queryClient.invalidateQueries({ queryKey: ['payroll_items', selectedRunId] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp_summary'] })
      toast.success('Status pengiriman berhasil diperbarui di sistem!')
    },
    onError: (error: any) => {
      console.error('Supabase Update Error:', error)
      alert(`Gagal memperbarui status di database: ${error.message}\n\nPastikan RLS untuk tabel "payroll_items" sudah dinonaktifkan atau diatur kebijakannya.`);
    }
  })

  // Pembantu format YYYY-MM ke nama bulan lokal
  const formatPeriode = (periode: string) => {
    if (!periode) return '-'
    const [year, month] = periode.split('-')
    const date = new Date(Number(year), Number(month) - 1)
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }

  const handlePrint = () => {
    window.print()
    if (selectedSlip) {
      markAsSentMutation.mutate(selectedSlip.id)
    }
  }

  const openSlip = (item: any) => {
    setSelectedSlip(item)
    setIsDialogOpen(true)
  }

  // Fungsi Pengiriman WhatsApp dengan pelindung error
  const handleSendWA = () => {
    try {
      const phone = selectedSlip?.employees?.whatsapp
      if (!phone || phone.trim() === '') {
        alert('Aksi Dibatalkan: Nomor WhatsApp karyawan ini kosong! Silakan isi nomor telepon terlebih dahulu di menu Data Karyawan.')
        return
      }

      // Format nomor: Hilangkan karakter non-angka
      let formattedPhone = phone.replace(/\D/g, '')
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '62' + formattedPhone.substring(1)
      }

      if (formattedPhone.length < 9) {
        alert('Aksi Dibatalkan: Format nomor WhatsApp tidak valid atau terlalu pendek!')
        return
      }

      const text = encodeURIComponent(
        `Halo ${selectedSlip.employees.nama},\n\nBerikut adalah rincian slip gaji Anda untuk periode ${formatPeriode(selectedSlip.payroll_runs?.periode)}:\n\n` +
        `Gaji Pokok: ${formatIDR(selectedSlip.gaji_pokok)}\n` +
        `Total Tunjangan: ${formatIDR(selectedSlip.total_tunjangan)}\n` +
        `Total Potongan: ${formatIDR(selectedSlip.total_potongan)}\n\n` +
        `*Take Home Pay: ${formatIDR(selectedSlip.gaji_bersih)}*\n\n` +
        `Terima kasih atas dedikasi dan kerja keras Anda.\nSalam,\nManajemen.`
      )

      // Jalankan pembaruan status ke database Supabase
      markAsSentMutation.mutate(selectedSlip.id)
      
      // Buka jendela baru ke WhatsApp Web / Aplikasi WhatsApp
      window.open(`https://wa.me/${formattedPhone}?text=${text}`, '_blank')
    } catch (err: any) {
      console.error('WhatsApp Action Error:', err)
      alert('Terjadi kesalahan lokal saat memproses pengiriman WhatsApp: ' + err.message)
    }
  }

  // Fungsi Pengiriman Email dengan pelindung error
  const handleSendEmail = () => {
    try {
      const emailAddress = selectedSlip?.employees?.email
      if (!emailAddress || emailAddress.trim() === '') {
        alert('Aksi Dibatalkan: Alamat email karyawan ini masih kosong! Silakan isi email terlebih dahulu di menu Data Karyawan.')
        return
      }

      const subject = encodeURIComponent(`Slip Gaji - ${formatPeriode(selectedSlip.payroll_runs?.periode)}`)
      const body = encodeURIComponent(
        `Halo ${selectedSlip.employees.nama},\n\nBerikut adalah rincian gaji Anda untuk periode ${formatPeriode(selectedSlip.payroll_runs?.periode)}.\n\n` +
        `Gaji Pokok: ${formatIDR(selectedSlip.gaji_pokok)}\n` +
        `Total Tunjangan: ${formatIDR(selectedSlip.total_tunjangan)}\n` +
        `Total Potongan: ${formatIDR(selectedSlip.total_potongan)}\n\n` +
        `Take Home Pay: ${formatIDR(selectedSlip.gaji_bersih)}\n\n` +
        `Terima kasih atas kontribusi Anda.\n\nSalam,\nManajemen.`
      )

      markAsSentMutation.mutate(selectedSlip.id)
      window.open(`mailto:${emailAddress}?subject=${subject}&body=${body}`, '_blank')
    } catch (err: any) {
      console.error('Email Action Error:', err)
      alert('Terjadi kesalahan lokal saat memproses pengiriman Email: ' + err.message)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Slip Gaji Karyawan"
          description="Lihat rincian, lakukan cetak fisik, atau kirim slip langsung via WhatsApp & Email."
        />
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Filter Periode:</span>
          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Pilih Periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Periode</SelectItem>
              {payrollRuns?.map((run) => (
                <SelectItem key={run.id} value={run.id}>
                  {formatPeriode(run.periode)} {run.status === 'draft' ? '(Draft)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Karyawan</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead className="text-right">Gaji Bersih (THP)</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingItems || loadingRuns ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : payrollItems?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Tidak ada data slip gaji pada periode ini.
                </TableCell>
              </TableRow>
            ) : (
              payrollItems?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.employees?.nama || 'Tanpa Nama'}
                    <span className="block text-xs text-muted-foreground font-normal">
                      {item.employees?.jabatan || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {formatPeriode(item.payroll_runs?.periode)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatIDR(item.gaji_bersih)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.slip_dibuat ? "default" : "secondary"} className={item.slip_dibuat ? "bg-green-500 text-white" : ""}>
                      {item.slip_dibuat ? 'Terkirim / Selesai' : 'Belum Dikirim'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => openSlip(item)}>
                      <FileText className="h-4 w-4" />
                      Lihat Slip
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Preview Slip Gaji */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl sm:max-w-[600px]">
          <DialogHeader className="print:hidden">
            <DialogTitle>Pratinjau Slip Gaji</DialogTitle>
          </DialogHeader>
          
          {selectedSlip && (
            <div className="flex flex-col gap-6 pt-4" id="print-area">
              {/* Header Slip */}
              <div className="text-center border-b pb-4">
                <h2 className="text-2xl font-bold tracking-tight">SLIP GAJI KARYAWAN</h2>
                <p className="text-muted-foreground">Periode: {formatPeriode(selectedSlip.payroll_runs?.periode)}</p>
              </div>

              {/* Info Karyawan */}
              <div className="grid grid-cols-2 gap-y-2 text-sm border-b pb-4">
                <div className="text-muted-foreground">Nama Karyawan</div>
                <div className="font-medium text-right">{selectedSlip.employees?.nama}</div>
                
                <div className="text-muted-foreground">Jabatan</div>
                <div className="font-medium text-right">{selectedSlip.employees?.jabatan || '-'}</div>
                
                <div className="text-muted-foreground">Rekening Transfer</div>
                <div className="font-medium text-right">
                  {selectedSlip.employees?.nama_bank ? `${selectedSlip.employees.nama_bank} - ${selectedSlip.employees.nomor_rekening}` : 'Tunai / Manual'}
                </div>
              </div>

              {/* Rincian Komponen Gaji */}
              <div className="flex flex-col gap-3 text-sm border-b pb-4">
                <div className="flex justify-between items-center font-medium">
                  <span>Gaji Pokok</span>
                  <span>{formatIDR(selectedSlip.gaji_pokok)}</span>
                </div>
                
                <div className="flex justify-between items-center text-green-600">
                  <span>Total Tunjangan (+)</span>
                  <span>{formatIDR(selectedSlip.total_tunjangan)}</span>
                </div>
                
                <div className="flex justify-between items-center text-red-600">
                  <span>Total Potongan (-)</span>
                  <span>{formatIDR(selectedSlip.total_potongan)}</span>
                </div>
              </div>

              {/* Take Home Pay */}
              <div className="flex justify-between items-center font-bold text-lg bg-muted p-3 rounded-lg">
                <span>TAKE HOME PAY</span>
                <span>{formatIDR(selectedSlip.gaji_bersih)}</span>
              </div>
              
              {/* Grup Tombol Distribusi */}
              <div className="flex flex-wrap justify-end gap-2 pt-4 print:hidden">
                <Button variant="outline" className="gap-2" onClick={handleSendEmail} disabled={markAsSentMutation.isPending}>
                  <Mail className="h-4 w-4" />
                  Kirim Email
                </Button>
                <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={handleSendWA} disabled={markAsSentMutation.isPending}>
                  <Send className="h-4 w-4" />
                  Kirim WA
                </Button>
                <Button variant="secondary" className="gap-2" onClick={handlePrint} disabled={markAsSentMutation.isPending}>
                  <Printer className="h-4 w-4" />
                  Cetak / PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  )
}