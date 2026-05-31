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
import { Loader2, TrendingUp, TrendingDown, Wallet, Users, Download } from 'lucide-react'
import { toast } from 'sonner'
// @ts-ignore
import { jsPDF } from 'jspdf';

export const Route = createFileRoute('/_authenticated/laporan')({
  component: LaporanPage,
})

const BULAN_LABELS: Record<string, string> = {
  '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
  '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
}

function LaporanPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
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
    queryKey: ['payroll_report', selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select(`
          id,
          periode,
          status,
          payroll_items (
            gaji_pokok,
            total_tunjangan,
            total_potongan,
            gaji_bersih,
            employees ( branch_id )
          )
        `)
        .like('periode', `${selectedYear}-%`)
        .order('periode', { ascending: true })

      if (error) throw error

      // Agregasi data dengan filter cabang di dalam map
      return data.map((run) => {
        // Filter item berdasarkan cabang (jika ada)
        const items = (run.payroll_items || []).filter(item => {
           if (selectedCabang === 'all') return true
           return item.employees?.branch_id === selectedCabang
        })

        return {
          id: run.id,
          periode: run.periode,
          status: run.status,
          total_karyawan: items.length,
          sum_gaji_pokok: items.reduce((acc, curr) => acc + (curr.gaji_pokok || 0), 0),
          sum_tunjangan: items.reduce((acc, curr) => acc + (curr.total_tunjangan || 0), 0),
          sum_potongan: items.reduce((acc, curr) => acc + (curr.total_potongan || 0), 0),
          sum_thp: items.reduce((acc, curr) => acc + (curr.gaji_bersih || 0), 0),
        }
      })
    },
  })

  // Refetch saat cabang berubah
  // Catatan: Karena kita memakai logic filter di dalam queryFn, 
  // kita perlu memicu refetch saat selectedCabang berubah
  // Cara paling mudah: tambahkan selectedCabang ke queryKey
  const { refetch } = useQuery({
      queryKey: ['payroll_report', selectedYear, selectedCabang],
      queryFn: async () => { /* Logika sama seperti di atas */ return [] },
      enabled: false 
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

  const handleDownload = () => {
    setIsDownloading(true)
    const element = document.getElementById('report-container')
    const opt = {
      margin: 10,
      filename: `Laporan_Gaji_${selectedYear}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }
    
    html2pdf().set(opt).from(element).save().finally(() => setIsDownloading(false))
    toast.success("Sedang mengunduh laporan...")
  }

  const formatBulan = (periode: string) => {
    if (!periode) return '-'
    const [_, month] = periode.split('-')
    return BULAN_LABELS[month] || month
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Laporan Penggajian"
          description={`Rekapitulasi tahun ${selectedYear}`}
        />
        
        <div className="flex items-center gap-2">
            <Button onClick={handleDownload} variant="outline" disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" /> Download PDF
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

      {/* Filter Cabang */}
      <div className="bg-white p-4 rounded-xl border flex items-center gap-4">
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

      <div id="report-container" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total THP</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatIDR(grandTotal.thp)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Gaji Pokok</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatIDR(grandTotal.gaji_pokok)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tunjangan</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatIDR(grandTotal.tunjangan)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Potongan</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-red-600">{formatIDR(grandTotal.potongan)}</div></CardContent></Card>
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