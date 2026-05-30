import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
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
import { formatIDR } from '@/lib/format'
import { Loader2, TrendingUp, TrendingDown, Wallet, Users } from 'lucide-react'

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

  // Ambil data payroll_runs beserta total item di dalamnya berdasarkan tahun yang dipilih
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
            gaji_bersih
          )
        `)
        .like('periode', `${selectedYear}-%`)
        .order('periode', { ascending: true }) // Urutkan dari Januari ke Desember

      if (error) throw error

      // Proses agregasi data per bulan
      const aggregated = data.map((run) => {
        const items = run.payroll_items || []
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

      return aggregated
    },
  })

  // Hitung Grand Total untuk Summary Cards di atas
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
          description={`Rekapitulasi total pengeluaran gaji perusahaan tahun ${selectedYear}`}
        />
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Pilih Tahun:</span>
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(val) => setSelectedYear(Number(val))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pengeluaran (THP)</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(grandTotal.thp)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Gaji bersih yang dibayarkan
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gaji Pokok</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(grandTotal.gaji_pokok)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Akumulasi gaji pokok
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tunjangan</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(grandTotal.tunjangan)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Penambah gaji (Makan, dll)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Potongan</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatIDR(grandTotal.potongan)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pengurang gaji (Kasbon, dll)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Detail Bulanan */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bulan</TableHead>
              <TableHead className="text-center">Jml Karyawan</TableHead>
              <TableHead className="text-right">Gaji Pokok</TableHead>
              <TableHead className="text-right">Tunjangan (+)</TableHead>
              <TableHead className="text-right">Potongan (-)</TableHead>
              <TableHead className="text-right font-bold">Total THP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : reportData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Belum ada data proses gaji pada tahun {selectedYear}.
                </TableCell>
              </TableRow>
            ) : (
              reportData?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {formatBulan(row.periode)}
                    {row.status === 'draft' && (
                      <span className="ml-2 text-xs text-muted-foreground italic">(Draft)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{row.total_karyawan}</TableCell>
                  <TableCell className="text-right">{formatIDR(row.sum_gaji_pokok)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatIDR(row.sum_tunjangan)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatIDR(row.sum_potongan)}</TableCell>
                  <TableCell className="text-right font-bold">{formatIDR(row.sum_thp)}</TableCell>
                </TableRow>
              ))
            )}
            
            {/* Baris Total di paling bawah tabel */}
            {reportData && reportData.length > 0 && (
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={2} className="text-right">GRAND TOTAL TAHUN {selectedYear}:</TableCell>
                <TableCell className="text-right">{formatIDR(grandTotal.gaji_pokok)}</TableCell>
                <TableCell className="text-right text-green-600">{formatIDR(grandTotal.tunjangan)}</TableCell>
                <TableCell className="text-right text-red-600">{formatIDR(grandTotal.potongan)}</TableCell>
                <TableCell className="text-right">{formatIDR(grandTotal.thp)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}