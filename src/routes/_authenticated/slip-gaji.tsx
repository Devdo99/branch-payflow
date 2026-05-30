import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatIDR } from '@/lib/format'
import { Printer } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export const Route = createFileRoute('/_authenticated/slip-gaji')({
  component: SlipGajiPage,
})

function SlipGajiPage() {
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
  }

  return (
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
    </div>
  )
}