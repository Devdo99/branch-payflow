import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
<<<<<<< HEAD
import { Card } from '@/components/ui/card'
=======
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
>>>>>>> 7c8b8790191eb2911f8c09e97ae5deb0764d81c2
import { formatIDR } from '@/lib/format'
import { Printer } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export const Route = createFileRoute('/_authenticated/slip-gaji')({
  component: SlipGajiPage,
})

function SlipGajiPage() {
<<<<<<< HEAD
  const slipRef = useRef<HTMLDivElement>(null)
  
  // Contoh data (Dalam implementasi asli, ambil dari state/props)
  const employee = { nama: "Budi Santoso", jabatan: "Kepala Cabang" }
  const data = {
    gaji_pokok: 5000000,
    tunjangan: [{ nama: "Tunjangan Jabatan", nominal: 1500000 }, { nama: "Uang Makan", nominal: 500000 }],
    potongan: [{ nama: "Izin", nominal: 50000 }],
    total_bersih: 6950000
  }

  const generatePDF = async () => {
    const input = slipRef.current
    if (!input) return

    const canvas = await html2canvas(input, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save("Slip_Gaji.pdf")
=======
  const queryClient = useQueryClient()
  const [selectedRunId, setSelectedRunId] = useState<string>('all')
  const [selectedSlip, setSelectedSlip] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
      return data as any
    },
  })

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

  const { data: payrollItems, isLoading: loadingItems } = useQuery({
    queryKey: ['payroll_items', selectedRunId],
    queryFn: async () => {
      let query = supabase
        .from('payroll_items')
        .select(`
          id, gaji_pokok, total_tunjangan, total_potongan, gaji_bersih, slip_dibuat,
          jumlah_hari, jumlah_jam_lembur, jumlah_telat, jumlah_izin, jumlah_absen,
          kasbon, bonus_manual, catatan,
          payroll_runs ( id, periode, status ),
          employees ( id, nama, jabatan, kode_karyawan, nomor_rekening, nama_bank, nama_pemilik_rekening, whatsapp, email )
        `)
      if (selectedRunId !== 'all') query = query.eq('payroll_run_id', selectedRunId)
      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!payrollRuns,
  })

  const markAsSent = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('payroll_items').update({ slip_dibuat: true }).eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_items', selectedRunId] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp_summary'] })
    },
  })

  const formatPeriode = (periode: string) => {
    if (!periode) return '-'
    const [year, month] = periode.split('-')
    return new Date(Number(year), Number(month) - 1)
      .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }

  const openSlip = (item: any) => {
    setSelectedSlip(item)
    setIsDialogOpen(true)
  }

  const handlePrint = () => {
    window.print()
    if (selectedSlip) markAsSent.mutate(selectedSlip.id)
  }

  const buildSlipText = (s: any) => {
    const lines = [
      `*SLIP GAJI - ${formatPeriode(s.payroll_runs?.periode)}*`,
      settings?.nama_perusahaan ? `_${settings.nama_perusahaan}_` : '',
      '',
      `Nama   : ${s.employees?.nama ?? '-'}`,
      `Jabatan: ${s.employees?.jabatan ?? '-'}`,
      '',
      `Gaji Pokok     : ${formatIDR(s.gaji_pokok)}`,
      `Total Tunjangan: ${formatIDR(s.total_tunjangan)}`,
      `Total Potongan : ${formatIDR(s.total_potongan)}`,
      Number(s.bonus_manual) ? `Bonus          : ${formatIDR(s.bonus_manual)}` : '',
      Number(s.kasbon) ? `Kasbon         : ${formatIDR(s.kasbon)}` : '',
      '',
      `*TAKE HOME PAY : ${formatIDR(s.gaji_bersih)}*`,
      '',
      settings?.footer_slip ?? '',
    ].filter(Boolean)
    return lines.join('\n')
  }

  const handleSendWA = () => {
    const phone = selectedSlip?.employees?.whatsapp
    if (!phone?.trim()) return toast.error('Nomor WhatsApp karyawan kosong.')
    let p = phone.replace(/\D/g, '')
    if (p.startsWith('0')) p = '62' + p.substring(1)
    if (p.length < 9) return toast.error('Format nomor WA tidak valid.')
    const text = encodeURIComponent(buildSlipText(selectedSlip))
    markAsSent.mutate(selectedSlip.id)
    window.open(`https://wa.me/${p}?text=${text}`, '_blank')
  }

  const handleSendEmail = () => {
    const email = selectedSlip?.employees?.email
    if (!email?.trim()) return toast.error('Email karyawan kosong.')
    const subject = encodeURIComponent(`Slip Gaji ${formatPeriode(selectedSlip.payroll_runs?.periode)}`)
    const body = encodeURIComponent(buildSlipText(selectedSlip).replace(/\*/g, ''))
    markAsSent.mutate(selectedSlip.id)
    // location.href lebih andal daripada window.open untuk mailto: di sebagian besar browser
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
>>>>>>> 7c8b8790191eb2911f8c09e97ae5deb0764d81c2
  }

  const s = selectedSlip
  const companyName = settings?.nama_perusahaan || 'Perusahaan'
  const companyAddress = settings?.alamat || ''
  const footer = settings?.footer_slip || ''

  return (
<<<<<<< HEAD
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-end mb-4 print:hidden gap-2">
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" /> Cetak
        </Button>
        <Button onClick={generatePDF} variant="default" className="gap-2">
          Kirim via WhatsApp
        </Button>
      </div>

      <div ref={slipRef}>
        <Card className="p-8 border-2 border-black rounded-none shadow-none bg-white text-black">
          {/* Header */}
          <div className="border-b-2 border-black pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase tracking-widest">Slip Gaji</h1>
            <p className="text-sm">Periode: Mei 2026</p>
          </div>

          {/* Info Karyawan */}
          <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
            <div>
              <p className="font-bold text-gray-500 uppercase text-[10px]">Nama</p>
              <p className="font-semibold">{employee.nama}</p>
            </div>
            <div>
              <p className="font-bold text-gray-500 uppercase text-[10px]">Jabatan</p>
              <p className="font-semibold">{employee.jabatan}</p>
            </div>
          </div>

          {/* Tabel Komponen */}
          <div className="space-y-6">
            <div>
              <p className="font-bold border-b border-black mb-2 pb-1">Pendapatan</p>
              <div className="flex justify-between py-1">
                <span>Gaji Pokok</span>
                <span>{formatIDR(data.gaji_pokok)}</span>
              </div>
              {data.tunjangan.map((t, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span>{t.nama}</span>
                  <span>{formatIDR(t.nominal)}</span>
                </div>
              ))}
            </div>

            <div>
              <p className="font-bold border-b border-black mb-2 pb-1">Potongan</p>
              {data.potongan.map((p, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span>{p.nama}</span>
                  <span>{formatIDR(p.nominal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Total Bersih */}
          <div className="border-t-2 border-black mt-8 pt-4 flex justify-between items-center">
            <span className="font-bold uppercase tracking-wider">Total Diterima</span>
            <span className="text-xl font-bold border-b-4 border-black">{formatIDR(data.total_bersih)}</span>
          </div>
        </Card>
      </div>
=======
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Slip Gaji Karyawan"
          description="Pratinjau, cetak, atau kirim slip via WhatsApp & Email."
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Filter Periode:</span>
          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Pilih Periode" /></SelectTrigger>
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
              <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : payrollItems?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Tidak ada data slip gaji.</TableCell></TableRow>
            ) : (
              payrollItems?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.employees?.nama || '-'}
                    <span className="block text-xs text-muted-foreground font-normal">{item.employees?.jabatan || '-'}</span>
                  </TableCell>
                  <TableCell>{formatPeriode(item.payroll_runs?.periode)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatIDR(item.gaji_bersih)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.slip_dibuat ? 'default' : 'secondary'} className={item.slip_dibuat ? 'bg-green-600 text-white' : ''}>
                      {item.slip_dibuat ? 'Terkirim' : 'Belum Dikirim'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => openSlip(item)}>
                      <FileText className="h-4 w-4" /> Lihat Slip
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b print:hidden">
            <DialogTitle>Pratinjau Slip Gaji</DialogTitle>
          </DialogHeader>

          {s && (
            <>
              <div id="print-area" className="bg-white text-slate-900 px-8 py-7">
                {/* Kop */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                  <div>
                    <div className="text-xl font-bold tracking-tight uppercase">{companyName}</div>
                    {companyAddress && (
                      <div className="text-xs text-slate-600 mt-0.5 whitespace-pre-line max-w-xs">{companyAddress}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500">Slip Gaji</div>
                    <div className="text-sm font-semibold">{formatPeriode(s.payroll_runs?.periode)}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">No: {String(s.id).slice(0, 8).toUpperCase()}</div>
                  </div>
                </div>

                {/* Identitas */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] mt-4">
                  <Row label="Nama" value={s.employees?.nama ?? '-'} bold />
                  <Row label="Kode" value={s.employees?.kode_karyawan ?? '-'} />
                  <Row label="Jabatan" value={s.employees?.jabatan ?? '-'} />
                  <Row label="Rekening" value={s.employees?.nama_bank ? `${s.employees.nama_bank} - ${s.employees.nomor_rekening ?? ''}` : 'Tunai'} />
                </div>

                {/* Catatan kehadiran */}
                <div className="mt-5 grid grid-cols-5 gap-2 text-center">
                  {[
                    ['Hari Kerja', s.jumlah_hari],
                    ['Lembur (jam)', s.jumlah_jam_lembur],
                    ['Telat', s.jumlah_telat],
                    ['Izin', s.jumlah_izin],
                    ['Absen', s.jumlah_absen],
                  ].map(([label, val]) => (
                    <div key={label as string} className="rounded border border-slate-200 py-1.5">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                      <div className="font-bold text-sm">{Number(val ?? 0)}</div>
                    </div>
                  ))}
                </div>

                {/* Rincian */}
                <div className="grid grid-cols-2 gap-6 mt-5">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 border-b pb-1 mb-2">Pendapatan</div>
                    <Line label="Gaji Pokok" value={s.gaji_pokok} />
                    <Line label="Tunjangan" value={s.total_tunjangan} />
                    {Number(s.bonus_manual) > 0 && <Line label="Bonus" value={s.bonus_manual} />}
                    <div className="flex justify-between border-t mt-2 pt-1.5 text-[13px] font-bold">
                      <span>Total</span>
                      <span>{formatIDR(Number(s.gaji_pokok) + Number(s.total_tunjangan) + Number(s.bonus_manual ?? 0))}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 border-b pb-1 mb-2">Potongan</div>
                    <Line label="Potongan" value={s.total_potongan} />
                    {Number(s.kasbon) > 0 && <Line label="Kasbon" value={s.kasbon} />}
                    <div className="flex justify-between border-t mt-2 pt-1.5 text-[13px] font-bold">
                      <span>Total</span>
                      <span>{formatIDR(Number(s.total_potongan) + Number(s.kasbon ?? 0))}</span>
                    </div>
                  </div>
                </div>

                {/* THP */}
                <div className="flex justify-between items-center mt-5 px-4 py-3 bg-slate-900 text-white rounded">
                  <span className="text-sm font-semibold tracking-wider uppercase">Take Home Pay</span>
                  <span className="text-xl font-black">{formatIDR(s.gaji_bersih)}</span>
                </div>

                {s.catatan && (
                  <div className="mt-4 text-[12px]">
                    <span className="font-semibold">Catatan: </span>
                    <span className="text-slate-700 whitespace-pre-line">{s.catatan}</span>
                  </div>
                )}

                {footer && (
                  <div className="mt-6 pt-3 border-t text-[11px] text-slate-500 italic whitespace-pre-line text-center">
                    {footer}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t bg-muted/40 print:hidden">
                <Button variant="outline" className="gap-2" onClick={handleSendEmail}>
                  <Mail className="h-4 w-4" /> Kirim Email
                </Button>
                <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={handleSendWA}>
                  <Send className="h-4 w-4" /> Kirim WA
                </Button>
                <Button variant="secondary" className="gap-2" onClick={handlePrint}>
                  <Printer className="h-4 w-4" /> Cetak / PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .print\\:hidden { display: none !important; }
        }
      `}} />
>>>>>>> 7c8b8790191eb2911f8c09e97ae5deb0764d81c2
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 text-slate-500">{label}</span>
      <span className="text-slate-400">:</span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-[13px] py-0.5">
      <span className="text-slate-700">{label}</span>
      <span className="tabular-nums">{formatIDR(Number(value) || 0)}</span>
    </div>
  )
}
