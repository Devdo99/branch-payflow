import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatIDR } from '@/lib/format'
import { TrendingUp, Download } from 'lucide-react'
import { toast } from 'sonner'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export const Route = createFileRoute('/_authenticated/laporan')({
  component: LaporanPage,
})

const BULAN_LABELS: Record<string, string> = {
  '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
  '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
}

const getPeriodeRange = (year: number, month: string) => {
  if (month === 'all') {
    return {
      start: `${year}-01`,
      end: `${year + 1}-01`,
    }
  }

  const monthNumber = Number(month)
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  const nextYear = monthNumber === 12 ? year + 1 : year

  return {
    start: `${year}-${month}`,
    end: `${nextYear}-${String(nextMonth).padStart(2, '0')}`,
  }
}

function LaporanPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [selectedCabang, setSelectedCabang] = useState<string>('all')
  const [isDownloading, setIsDownloading] = useState(false)

  // 1. Fetch Daftar Cabang untuk filter
  const { data: cabangList = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('*').order('nama')
      return data || []
    },
  })

  // 2. Fetch data payroll
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['payroll_report', selectedYear, selectedMonth, selectedCabang],
    queryFn: async () => {
      const periodeRange = getPeriodeRange(selectedYear, selectedMonth)
      const { data, error } = await supabase
        .from('payroll_items')
        .select(`
          id,
          gaji_pokok,
          total_tunjangan,
          total_potongan,
          gaji_bersih,
          jumlah_hari,
          jumlah_izin,
          jumlah_absen,
          jumlah_telat,
          kasbon,
          bonus_manual,
          catatan,
          payroll_item_allowances (
            nama,
            qty,
            nominal,
            subtotal
          ),
          payroll_item_deductions (
            nama,
            qty,
            nominal,
            subtotal
          ),
          employees (
            id,
            nama,
            jabatan,
            nama_bank,
            nomor_rekening,
            branch_id
          ),
          payroll_run:payroll_runs!inner (
            id,
            periode,
            status,
            branch_id
          )
        `)
        .gte('payroll_run.periode', periodeRange.start)
        .lt('payroll_run.periode', periodeRange.end)

      if (error) throw error

      const groupedRuns = (data || []).reduce((acc: Record<string, any>, item: any) => {
        const run = item.payroll_run
        if (!run?.id) return acc

        if (!acc[run.id]) {
          acc[run.id] = {
            id: run.id,
            periode: run.periode,
            status: run.status,
            items: [],
          }
        }

        acc[run.id].items.push(item)
        return acc
      }, {})

      return Object.values(groupedRuns).map((run: any) => {
        const items = (run.items || []).filter((item: any) => {
          if (selectedCabang === 'all') return true
          return item.employees?.branch_id === selectedCabang
        })

        return {
          id: run.id,
          periode: run.periode,
          status: run.status,
          items,
          total_karyawan: items.length,
          sum_gaji_pokok: items.reduce((acc: number, curr: any) => acc + (curr.gaji_pokok || 0), 0),
          sum_tunjangan: items.reduce((acc: number, curr: any) => acc + (curr.total_tunjangan || 0), 0),
          sum_potongan: items.reduce((acc: number, curr: any) => acc + (curr.total_potongan || 0), 0),
          sum_thp: items.reduce((acc: number, curr: any) => acc + (curr.gaji_bersih || 0), 0),
        }
      })
        .filter((row: any) => selectedCabang === 'all' || row.total_karyawan > 0)
        .sort((a: any, b: any) => a.periode.localeCompare(b.periode))
    },
  })

  const grandTotal = reportData?.reduce(
    (acc, curr) => {
      acc.thp += curr.sum_thp
      acc.gaji_pokok += curr.sum_gaji_pokok
      acc.tunjangan += curr.sum_tunjangan
      acc.potongan += curr.sum_potongan
      return acc
    },
    { thp: 0, gaji_pokok: 0, tunjangan: 0, potongan: 0 }
  ) || { thp: 0, gaji_pokok: 0, tunjangan: 0, potongan: 0 }

  const employeeSummaries = (
    reportData ?? []
  ).flatMap((run) => run.items || []).reduce((acc: Record<string, any>, item: any) => {
    const employee = item.employees
    if (!employee) return acc

    if (!acc[employee.id]) {
      acc[employee.id] = {
        id: employee.id,
        nama: employee.nama || '-',
        nama_bank: employee.nama_bank || '-',
        nomor_rekening: employee.nomor_rekening || '-',
        total_gaji: 0,
      }
    }

    acc[employee.id].total_gaji += item.gaji_bersih || 0
    return acc
  }, {})

  const employeeSummaryList = Object.values(employeeSummaries).sort((a: any, b: any) => a.nama.localeCompare(b.nama))

  const detailRows = (reportData ?? [])
    .flatMap((run) =>
      (run.items || []).map((item: any) => ({
        id: item.id || `${run.id}-${item.employees?.id || item.employees?.nama || 'employee'}`,
        periode: run.periode,
        nama: item.employees?.nama || '-',
        jabatan: item.employees?.jabatan || '-',
        branch_id: item.employees?.branch_id || null,
        nama_bank: item.employees?.nama_bank || '-',
        nomor_rekening: item.employees?.nomor_rekening || '-',
        gaji_pokok: item.gaji_pokok || 0,
        total_tunjangan: item.total_tunjangan || 0,
        total_potongan: item.total_potongan || 0,
        gaji_bersih: item.gaji_bersih || 0,
        jumlah_hari: item.jumlah_hari || 0,
        jumlah_izin: item.jumlah_izin || 0,
        jumlah_absen: item.jumlah_absen || 0,
        jumlah_telat: item.jumlah_telat || 0,
        kasbon: item.kasbon || 0,
        bonus_manual: item.bonus_manual || 0,
        catatan: item.catatan || '',
        allowances: item.payroll_item_allowances || [],
        deductions: item.payroll_item_deductions || [],
      }))
    )
    .sort((a: any, b: any) => {
      const periodCompare = a.periode.localeCompare(b.periode)
      if (periodCompare !== 0) return periodCompare
      return a.nama.localeCompare(b.nama)
    })

  const selectedBranchName =
    selectedCabang === 'all'
      ? 'Semua Cabang'
      : cabangList.find((branch: any) => branch.id === selectedCabang)?.nama || 'Cabang tidak diketahui'

  const selectedMonthName =
    selectedMonth === 'all' ? 'Semua Bulan' : BULAN_LABELS[selectedMonth] || selectedMonth

  const totalEmployees = employeeSummaryList.length
  const totalPeriods = reportData?.length || 0

  const handleDownload = async () => {
    if (!reportData || reportData.length === 0) {
      toast.error('Tidak ada data laporan untuk diunduh.')
      return
    }

    setIsDownloading(true)
    const element = document.getElementById('report-container')

    if (!element) {
      toast.error('Tidak dapat menemukan konten laporan untuk diunduh.')
      setIsDownloading(false)
      return
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 1.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const usableWidth = pageWidth - margin * 2
      const usableHeight = pageHeight - margin * 2
      const imgWidth = usableWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let remainingHeight = imgHeight
      let position = margin

      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight)
      remainingHeight -= usableHeight

      while (remainingHeight > 0) {
        position = margin - (imgHeight - remainingHeight)
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight)
        remainingHeight -= usableHeight
      }

      const monthSuffix = selectedMonth === 'all' ? 'Semua_Bulan' : selectedMonth
      pdf.save(`Laporan_Gaji_${selectedBranchName.replace(/\s+/g, '_')}_${selectedYear}_${monthSuffix}.pdf`)
      toast.success('Laporan PDF berhasil diunduh')
    } catch (error) {
      console.error('Gagal membuat PDF laporan:', error)
      toast.error('Gagal membuat PDF laporan')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleSendWhatsApp = () => {
    const employeeLines = employeeSummaryList.map((employee: any) =>
      `${employee.nama}: ${formatIDR(employee.total_gaji)} | ${employee.nomor_rekening} | ${employee.nama_bank}`
    )

    if (employeeLines.length === 0) {
      toast.error('Tidak ada data karyawan untuk dikirim.')
      return
    }

    const summaryText = `Daftar ringkasan karyawan:\n${employeeLines.join('\n')}`

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`
    window.open(waUrl, '_blank')
  }

  const formatBulan = (periode: string) => {
    if (!periode) return '-'
    const [_, month] = periode.split('-')
    return BULAN_LABELS[month] || month
  }

  const formatPeriode = (periode: string) => {
    if (!periode) return '-'
    const [year, month] = periode.split('-')
    return `${BULAN_LABELS[month] || month} ${year || ''}`.trim()
  }

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return '-'
    return cabangList.find((branch: any) => branch.id === branchId)?.nama || '-'
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Laporan Penggajian"
          description={`Rekapitulasi tahun ${selectedYear}`}
        />
        
        <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleDownload} variant="outline" disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
            <Button onClick={handleSendWhatsApp} variant="secondary" disabled={isLoading || isDownloading}>
                <TrendingUp className="mr-2 h-4 w-4" /> Kirim via WhatsApp
            </Button>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}>
                <SelectTrigger className="w-[120px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {[currentYear - 1, currentYear].map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
          <span className="text-sm font-medium text-muted-foreground">Filter Cabang:</span>
          <Select value={selectedCabang} onValueChange={setSelectedCabang}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Semua Cabang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang</SelectItem>
              {cabangList.map((branch: any) => (
                <SelectItem key={branch.id} value={branch.id}>{branch.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-8">
          <span className="text-sm font-medium text-muted-foreground">Filter Bulan:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Semua Bulan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Bulan</SelectItem>
              {Object.entries(BULAN_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div id="report-container" className="space-y-6 bg-white p-1">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Ringkasan Cabang</h2>
                <p className="text-sm text-muted-foreground">{selectedBranchName} • {selectedMonthName} • {selectedYear}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
                <div><span className="block text-muted-foreground">Periode</span><span className="font-semibold">{totalPeriods}</span></div>
                <div><span className="block text-muted-foreground">Total Karyawan</span><span className="font-semibold">{totalEmployees}</span></div>
                <div><span className="block text-muted-foreground">Total THP</span><span className="font-semibold">{formatIDR(grandTotal.thp)}</span></div>
                <div><span className="block text-muted-foreground">Total Tunjangan</span><span className="font-semibold">{formatIDR(grandTotal.tunjangan)}</span></div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total THP</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatIDR(grandTotal.thp)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Gaji Pokok</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatIDR(grandTotal.gaji_pokok)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tunjangan</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatIDR(grandTotal.tunjangan)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Potongan</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-red-600">{formatIDR(grandTotal.potongan)}</div></CardContent></Card>
          </div>

          {/* Ringkasan Per Karyawan */}
          <div className="rounded-md border bg-white">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold">Ringkasan Per Karyawan</h3>
              <p className="text-xs text-muted-foreground">Nama, Total Gaji, No. Rekening, Nama Bank</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="text-right">Total Gaji</TableHead>
                  <TableHead>No. Rekening</TableHead>
                  <TableHead>Bank</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeSummaryList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Tidak ada data karyawan untuk cabang ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  employeeSummaryList.map((employee: any) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.nama}</TableCell>
                      <TableCell className="text-right">{formatIDR(employee.total_gaji)}</TableCell>
                      <TableCell>{employee.nomor_rekening}</TableCell>
                      <TableCell>{employee.nama_bank}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Rincian Per Karyawan */}
          <div className="rounded-md border bg-white">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold">Rincian Gaji Per Karyawan</h3>
              <p className="text-xs text-muted-foreground">Periode, cabang, jabatan, komponen gaji, dan rekening pembayaran</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periode</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead className="text-right">Gaji Pokok</TableHead>
                    <TableHead className="text-right">Tunjangan</TableHead>
                    <TableHead className="text-right">Potongan</TableHead>
                    <TableHead className="text-right">THP</TableHead>
                    <TableHead>Komponen</TableHead>
                    <TableHead>Rekening</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                        Tidak ada rincian gaji untuk filter ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    detailRows.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatPeriode(row.periode)}</TableCell>
                        <TableCell className="font-medium">{row.nama}</TableCell>
                        <TableCell>{getBranchName(row.branch_id)}</TableCell>
                        <TableCell>{row.jabatan}</TableCell>
                        <TableCell className="text-right">{formatIDR(row.gaji_pokok)}</TableCell>
                        <TableCell className="text-right">{formatIDR(row.total_tunjangan)}</TableCell>
                        <TableCell className="text-right">{formatIDR(row.total_potongan)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatIDR(row.gaji_bersih)}</TableCell>
                        <TableCell>
                          <div className="min-w-[220px] space-y-1 text-xs leading-tight">
                            {row.allowances.length > 0 ? (
                              <div>
                                <span className="font-semibold text-emerald-700">Tunjangan: </span>
                                {row.allowances
                                  .map((item: any) => `${item.nama} ${formatIDR(item.subtotal || 0)}`)
                                  .join(', ')}
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-emerald-700">Tunjangan: </span>
                                {formatIDR(row.total_tunjangan)}
                              </div>
                            )}
                            {row.deductions.length > 0 ? (
                              <div>
                                <span className="font-semibold text-rose-700">Potongan: </span>
                                {row.deductions
                                  .map((item: any) => `${item.nama} ${formatIDR(item.subtotal || 0)}`)
                                  .join(', ')}
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-rose-700">Potongan: </span>
                                {formatIDR(row.total_potongan)}
                              </div>
                            )}
                            {(row.jumlah_izin > 0 || row.jumlah_absen > 0 || row.jumlah_telat > 0) && (
                              <div className="text-muted-foreground">
                                Izin {row.jumlah_izin}, sakit/absen {row.jumlah_absen}, telat {row.jumlah_telat}
                              </div>
                            )}
                            {row.catatan && <div className="text-muted-foreground">{row.catatan}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs leading-tight">
                            <div>{row.nomor_rekening}</div>
                            <div className="text-muted-foreground">{row.nama_bank}</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Tabel Detail */}
          <div className="rounded-md border bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Bulan</TableHead>
                        <TableHead className="text-right">Gaji Pokok</TableHead>
                        <TableHead className="text-right">Tunjangan</TableHead>
                        <TableHead className="text-right">Potongan</TableHead>
                        <TableHead className="text-right font-bold">Total THP</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reportData?.map((row) => (
                        <TableRow key={row.id}>
                            <TableCell>{formatBulan(row.periode)}</TableCell>
                            <TableCell className="text-right">{formatIDR(row.sum_gaji_pokok)}</TableCell>
                            <TableCell className="text-right">{formatIDR(row.sum_tunjangan)}</TableCell>
                            <TableCell className="text-right">{formatIDR(row.sum_potongan)}</TableCell>
                            <TableCell className="text-right font-bold">{formatIDR(row.sum_thp)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
      </div>
    </div>
  )
}
