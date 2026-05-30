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
import { FileText, Loader2, Mail, Printer, Send } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/slip-gaji')({
  component: SlipGajiPage,
})

function SlipGajiPage() {
  const queryClient = useQueryClient()

  const [selectedRunId, setSelectedRunId] = useState<string>('all')
  const [selectedSlip, setSelectedSlip] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()

      if (error) {
        console.error('Gagal mengambil app_settings:', error)
        return null
      }

      return data as any
    },
  })

  const { data: payrollRuns = [], isLoading: loadingRuns } = useQuery({
    queryKey: ['payroll_runs_list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payroll_runs')
        .select('id, periode, status')
        .order('periode', { ascending: false })

      if (error) throw error
      return data || []
    },
  })

  const { data: payrollItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['payroll_items', selectedRunId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('payroll_items')
        .select(`
          id,
          payroll_run_id,
          employee_id,
          gaji_pokok,
          total_tunjangan,
          total_potongan,
          gaji_bersih,
          slip_dibuat,
          jumlah_hari,
          jumlah_jam_lembur,
          jumlah_telat,
          jumlah_izin,
          jumlah_absen,
          kasbon,
          bonus_manual,
          catatan,
          payroll_runs (
            id,
            periode,
            status
          ),
          employees (
            id,
            nama,
            jabatan,
            kode_karyawan,
            nomor_rekening,
            nama_bank,
            nama_pemilik_rekening,
            whatsapp,
            email
          )
        `)

      if (selectedRunId !== 'all') {
        query = query.eq('payroll_run_id', selectedRunId)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
    enabled: payrollRuns.length >= 0,
  })

  const markAsSent = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await (supabase as any)
        .from('payroll_items')
        .update({ slip_dibuat: true })
        .eq('id', itemId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_items', selectedRunId] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp_summary'] })
    },
  })

  const formatPeriode = (periode?: string | null) => {
    if (!periode) return '-'

    const [year, month] = String(periode).split('-')

    if (!year || !month) return periode

    return new Date(Number(year), Number(month) - 1).toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    })
  }

  const openSlip = (item: any) => {
    setSelectedSlip(item)
    setIsDialogOpen(true)
  }

  const handlePrint = () => {
    window.print()

    if (selectedSlip?.id) {
      markAsSent.mutate(selectedSlip.id)
    }
  }

  const buildSlipText = (s: any) => {
    const lines = [
      `*SLIP GAJI - ${formatPeriode(s.payroll_runs?.periode)}*`,
      settings?.nama_perusahaan ? `_${settings.nama_perusahaan}_` : '',
      '',
      `Nama   : ${s.employees?.nama ?? '-'}`,
      `Jabatan: ${s.employees?.jabatan ?? '-'}`,
      '',
      `Gaji Pokok     : ${formatIDR(Number(s.gaji_pokok) || 0)}`,
      `Total Tunjangan: ${formatIDR(Number(s.total_tunjangan) || 0)}`,
      `Total Potongan : ${formatIDR(Number(s.total_potongan) || 0)}`,
      Number(s.bonus_manual) ? `Bonus          : ${formatIDR(Number(s.bonus_manual) || 0)}` : '',
      Number(s.kasbon) ? `Kasbon         : ${formatIDR(Number(s.kasbon) || 0)}` : '',
      '',
      `*TAKE HOME PAY : ${formatIDR(Number(s.gaji_bersih) || 0)}*`,
      '',
      settings?.footer_slip ?? '',
    ].filter(Boolean)

    return lines.join('\n')
  }

  const handleSendWA = () => {
    const phone = selectedSlip?.employees?.whatsapp

    if (!phone?.trim()) {
      toast.error('Nomor WhatsApp karyawan kosong.')
      return
    }

    let formattedPhone = phone.replace(/\D/g, '')

    if (formattedPhone.startsWith('0')) {
      formattedPhone = `62${formattedPhone.substring(1)}`
    }

    if (formattedPhone.length < 9) {
      toast.error('Format nomor WhatsApp tidak valid.')
      return
    }

    const text = encodeURIComponent(buildSlipText(selectedSlip))

    if (selectedSlip?.id) {
      markAsSent.mutate(selectedSlip.id)
    }

    window.open(`https://wa.me/${formattedPhone}?text=${text}`, '_blank')
  }

  const handleSendEmail = () => {
    const email = selectedSlip?.employees?.email

    if (!email?.trim()) {
      toast.error('Email karyawan kosong.')
      return
    }

    const subject = encodeURIComponent(
      `Slip Gaji ${formatPeriode(selectedSlip.payroll_runs?.periode)}`
    )

    const body = encodeURIComponent(buildSlipText(selectedSlip).replace(/\*/g, ''))

    if (selectedSlip?.id) {
      markAsSent.mutate(selectedSlip.id)
    }

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }

  const s = selectedSlip
  const companyName = settings?.nama_perusahaan || 'Perusahaan'
  const companyAddress = settings?.alamat || ''
  const footer = settings?.footer_slip || ''

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Slip Gaji Karyawan"
          description="Pratinjau, cetak, atau kirim slip via WhatsApp dan email."
        />

        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            Filter Periode:
          </span>

          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Pilih Periode" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">Semua Periode</SelectItem>

              {payrollRuns.map((run: any) => (
                <SelectItem key={run.id} value={run.id}>
                  {formatPeriode(run.periode)} {run.status === 'draft' ? '(Draft)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Karyawan</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead className="text-right">Gaji Bersih</TableHead>
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
            ) : payrollItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Tidak ada data slip gaji.
                </TableCell>
              </TableRow>
            ) : (
              payrollItems.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.employees?.nama || '-'}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {item.employees?.jabatan || '-'}
                    </span>
                  </TableCell>

                  <TableCell>
                    {formatPeriode(item.payroll_runs?.periode)}
                  </TableCell>

                  <TableCell className="text-right font-semibold">
                    {formatIDR(Number(item.gaji_bersih) || 0)}
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge
                      variant={item.slip_dibuat ? 'default' : 'secondary'}
                      className={item.slip_dibuat ? 'bg-green-600 text-white' : ''}
                    >
                      {item.slip_dibuat ? 'Terkirim' : 'Belum Dikirim'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => openSlip(item)}
                    >
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl gap-0 p-0">
          <DialogHeader className="border-b px-6 pb-3 pt-5 print:hidden">
            <DialogTitle>Pratinjau Slip Gaji</DialogTitle>
          </DialogHeader>

          {s && (
            <>
              <div id="print-area" className="bg-white px-8 py-7 text-slate-900">
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                  <div>
                    <div className="text-xl font-bold uppercase tracking-tight">
                      {companyName}
                    </div>

                    {companyAddress && (
                      <div className="mt-0.5 max-w-xs whitespace-pre-line text-xs text-slate-600">
                        {companyAddress}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500">
                      Slip Gaji
                    </div>
                    <div className="text-sm font-semibold">
                      {formatPeriode(s.payroll_runs?.periode)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      No: {String(s.id).slice(0, 8).toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
                  <Row label="Nama" value={s.employees?.nama ?? '-'} bold />
                  <Row label="Kode" value={s.employees?.kode_karyawan ?? '-'} />
                  <Row label="Jabatan" value={s.employees?.jabatan ?? '-'} />
                  <Row
                    label="Rekening"
                    value={
                      s.employees?.nama_bank
                        ? `${s.employees.nama_bank} - ${s.employees.nomor_rekening ?? ''}`
                        : 'Tunai'
                    }
                  />
                </div>

                <div className="mt-5 grid grid-cols-5 gap-2 text-center">
                  {[
                    ['Hari Kerja', s.jumlah_hari],
                    ['Lembur', s.jumlah_jam_lembur],
                    ['Telat', s.jumlah_telat],
                    ['Izin', s.jumlah_izin],
                    ['Absen', s.jumlah_absen],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded border border-slate-200 py-1.5"
                    >
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        {String(label)}
                      </div>
                      <div className="text-sm font-bold">
                        {Number(value ?? 0)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-6">
                  <div>
                    <div className="mb-2 border-b pb-1 text-[11px] uppercase tracking-wider text-slate-500">
                      Pendapatan
                    </div>

                    <Line label="Gaji Pokok" value={Number(s.gaji_pokok) || 0} />
                    <Line label="Tunjangan" value={Number(s.total_tunjangan) || 0} />

                    {Number(s.bonus_manual) > 0 && (
                      <Line label="Bonus" value={Number(s.bonus_manual) || 0} />
                    )}

                    <div className="mt-2 flex justify-between border-t pt-1.5 text-[13px] font-bold">
                      <span>Total</span>
                      <span>
                        {formatIDR(
                          (Number(s.gaji_pokok) || 0) +
                            (Number(s.total_tunjangan) || 0) +
                            (Number(s.bonus_manual) || 0)
                        )}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 border-b pb-1 text-[11px] uppercase tracking-wider text-slate-500">
                      Potongan
                    </div>

                    <Line label="Potongan" value={Number(s.total_potongan) || 0} />

                    {Number(s.kasbon) > 0 && (
                      <Line label="Kasbon" value={Number(s.kasbon) || 0} />
                    )}

                    <div className="mt-2 flex justify-between border-t pt-1.5 text-[13px] font-bold">
                      <span>Total</span>
                      <span>
                        {formatIDR(
                          (Number(s.total_potongan) || 0) +
                            (Number(s.kasbon) || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between rounded bg-slate-900 px-4 py-3 text-white">
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    Take Home Pay
                  </span>
                  <span className="text-xl font-black">
                    {formatIDR(Number(s.gaji_bersih) || 0)}
                  </span>
                </div>

                {s.catatan && (
                  <div className="mt-4 text-[12px]">
                    <span className="font-semibold">Catatan: </span>
                    <span className="whitespace-pre-line text-slate-700">
                      {s.catatan}
                    </span>
                  </div>
                )}

                {footer && (
                  <div className="mt-6 whitespace-pre-line border-t pt-3 text-center text-[11px] italic text-slate-500">
                    {footer}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/40 px-6 py-4 print:hidden">
                <Button variant="outline" className="gap-2" onClick={handleSendEmail}>
                  <Mail className="h-4 w-4" />
                  Kirim Email
                </Button>

                <Button
                  className="gap-2 bg-green-600 text-white hover:bg-green-700"
                  onClick={handleSendWA}
                >
                  <Send className="h-4 w-4" />
                  Kirim WA
                </Button>

                <Button variant="secondary" className="gap-2" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Cetak / PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden;
              }

              #print-area,
              #print-area * {
                visibility: visible;
              }

              #print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 24px;
              }

              .print\\:hidden {
                display: none !important;
              }
            }
          `,
        }}
      />
    </div>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
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
    <div className="flex justify-between py-0.5 text-[13px]">
      <span className="text-slate-700">{label}</span>
      <span className="tabular-nums">{formatIDR(Number(value) || 0)}</span>
    </div>
  )
}