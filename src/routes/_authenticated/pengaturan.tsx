import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Loader2, Save, Building, Shield, Bell } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/pengaturan')({
  component: PengaturanPage,
})

function PengaturanPage() {
  const [isSaving, setIsSaving] = useState(false)

  // State Pengaturan Umum
  const [namaPerusahaan, setNamaPerusahaan] = useState('Payflow Resto')
  const [alamat, setAlamat] = useState('Metro, Lampung')
  const [mataUang, setMataUang] = useState('IDR (Rp)')

  // State Aturan Payroll
  const [autoSendWA, setAutoSendWA] = useState(false)
  const [lockFinalPayroll, setLockFinalPayroll] = useState(true)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    // Simulasi jeda penyimpanan konfigurasi sistem
    setTimeout(() => {
      setIsSaving(false)
      toast.success('Pengaturan berhasil diperbarui!')
    }, 1000)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <PageHeader
        title="Pengaturan Sistem"
        description="Kelola konfigurasi aplikasi, profil perusahaan, dan preferensi sistem penggajian."
      />

      <Tabs defaultValue="umum" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="umum" className="gap-2">
            <Building className="h-4 w-4" />
            Umum
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2">
            <Shield className="h-4 w-4" />
            Aturan Gaji
          </TabsTrigger>
          <TabsTrigger value="notifikasi" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifikasi
          </TabsTrigger>
        </TabsList>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          {/* TAB UMUM */}
          <TabsContent value="umum">
            <Card>
              <CardHeader>
                <CardTitle>Profil Perusahaan / Cabang</CardTitle>
                <CardDescription>
                  Informasi ini akan digunakan sebagai identitas utama pada kop dokumen slip gaji.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nama_perusahaan">Nama Usaha / Restoran</Label>
                  <Input
                    id="nama_perusahaan"
                    value={namaPerusahaan}
                    onChange={(e) => setNamaPerusahaan(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="alamat">Alamat Operasional</Label>
                  <Input
                    id="alamat"
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="mata_uang">Mata Uang Sistem</Label>
                  <Input
                    id="mata_uang"
                    value={mataUang}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB ATURAN PAYROLL */}
          <TabsContent value="payroll">
            <Card>
              <CardHeader>
                <CardTitle>Kebijakan Penggajian</CardTitle>
                <CardDescription>
                  Konfigurasi aturan pembatasan modifikasi data untuk akurasi laporan keuangan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Kunci Gaji Setelah Final</Label>
                    <p className="text-sm text-muted-foreground">
                      Mencegah perubahan data nominal slip jika status periode penggajian sudah dikunci menjadi Final.
                    </p>
                  </div>
                  <Switch checked={lockFinalPayroll} onCheckedChange={setLockFinalPayroll} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Sinkronisasi Otomatis Karyawan Baru</Label>
                    <p className="text-sm text-muted-foreground">
                      Karyawan yang berstatus aktif akan langsung ditarik otomatis setiap kali pembuatan draft bulan baru dimulai.
                    </p>
                  </div>
                  <Switch checked={true} disabled />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB NOTIFIKASI */}
          <TabsContent value="notifikasi">
            <Card>
              <CardHeader>
                <CardTitle>Integrasi WhatsApp Gateway</CardTitle>
                <CardDescription>
                  Atur pemicu otomatisasi pengiriman pesan teks slip kepada para staf restoran.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Kirim Pesan Otomatis Saat Gaji Final</Label>
                    <p className="text-sm text-muted-foreground">
                      Sistem akan otomatis melepaskan antrean pesan WhatsApp begitu status beralih dari Draft ke Final.
                    </p>
                  </div>
                  <Switch checked={autoSendWA} onCheckedChange={setAutoSendWA} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Semua Pengaturan
            </Button>
          </div>
        </form>
      </Tabs>
    </div>
  )
}