import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { formatIDR } from '@/lib/format'
import { ImageIcon, FileText, Send, Loader2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import html2pdf from 'html2pdf.js'

export const Route = createFileRoute('/_authenticated/slip-gaji')({
  component: SlipGajiPage,
})

function SlipGajiPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [activeSlip, setActiveSlip] = useState<any>(null)
  const slipRef = useRef<HTMLDivElement>(null)

  const { data: payrollItems = [] } = useQuery({
    queryKey: ['payroll_items'],
    queryFn: async () => {
      const { data } = await supabase.from('payroll_items').select(`*, payroll_runs (*), employees (*)`)
      return data || []
    },
  })

  const handleAction = async (type: 'JPG' | 'PDF' | 'WA', slip: any) => {
    setLoading(`${type}-${slip.id}`)
    setActiveSlip(slip)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const element = slipRef.current
    if (!element) {
      toast.error("Template tidak ditemukan")
      setLoading(null)
      return
    }

    try {
      if (type === 'JPG') {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true })
        const link = document.createElement('a')
        link.download = `Slip_${slip.employees?.nama}.jpg`
        link.href = canvas.toDataURL("image/jpeg", 1.0)
        link.click()
      } else if (type === 'PDF') {
        const opt = { margin: 5, filename: `Slip_${slip.employees?.nama}.pdf`, html2canvas: { scale: 2 } }
        await html2pdf().set(opt).from(element).save()
      } else if (type === 'WA') {
        const canvas = await html2canvas(element, { scale: 1.5 })
        const img = canvas.toDataURL("image/jpeg", 0.9)
        const link = document.createElement('a')
        link.download = `Slip_${slip.employees?.nama}.jpg`
        link.href = img
        link.click()
        
        const phone = (slip.employees?.whatsapp || '').replace(/\D/g, '')
        const msg = `Halo ${slip.employees?.nama}, berikut slip gaji Anda. (File gambar terlampir).`
        window.open(`https://wa.me/62${phone.startsWith('0') ? phone.slice(1) : phone}?text=${encodeURIComponent(msg)}`, '_blank')
      }
    } catch (err) {
      toast.error("Gagal memproses slip")
    } finally {
      setLoading(null)
      setActiveSlip(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Distribusi Gaji" description="Kelola slip gaji profesional" />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Karyawan</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Gaji Bersih</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollItems.map((slip: any) => (
              <TableRow key={slip.id}>
                <TableCell className="font-semibold">{slip.employees?.nama}</TableCell>
                <TableCell className="text-slate-500">{slip.payroll_runs?.periode}</TableCell>
                <TableCell className="font-bold">{formatIDR(slip.gaji_bersih)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => handleAction('JPG', slip)}>{loading === `JPG-${slip.id}` ? <Loader2 className="animate-spin w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}</Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction('PDF', slip)}>{loading === `PDF-${slip.id}` ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4" />}</Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAction('WA', slip)}>{loading === `WA-${slip.id}` ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* TEMPLATE (HIDDEN & SEMANTICALLY CORRECT) */}
      {activeSlip && (
        <div className="fixed -left-[9999px] top-0">
          <div ref={slipRef} style={{ width: '600px', backgroundColor: '#ffffff', padding: '40px', fontFamily: 'Arial, sans-serif', color: '#1e293b' }}>
            <div style={{ borderBottom: '3px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
              <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 900 }}>SALARY SLIP</h1>
            </div>
            <div style={{ marginBottom: '30px' }}>
              <p style={{ margin: '5px 0' }}><strong>Nama:</strong> {activeSlip.employees?.nama}</p>
              <p style={{ margin: '5px 0' }}><strong>Periode:</strong> {activeSlip.payroll_runs?.periode}</p>
            </div>
            
            {/* WRAPPER TBODY DITAMBAHKAN DISINI */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '10px 0' }}>Gaji Pokok</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatIDR(activeSlip.gaji_pokok)}</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '10px 0', color: '#059669' }}>Tunjangan</td><td style={{ textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>+ {formatIDR(activeSlip.total_tunjangan)}</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '10px 0', color: '#e11d48' }}>Potongan</td><td style={{ textAlign: 'right', fontWeight: 'bold', color: '#e11d48' }}>- {formatIDR(activeSlip.total_potongan)}</td></tr>
                <tr><td style={{ padding: '20px 0', fontWeight: 900, fontSize: '18px' }}>TOTAL BERSIH</td><td style={{ textAlign: 'right', fontWeight: 900, fontSize: '18px' }}>{formatIDR(activeSlip.gaji_bersih)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}