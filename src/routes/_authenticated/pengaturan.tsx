import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/pengaturan')({
  component: PengaturanPage,
})

function PengaturanPage() {
  const qc = useQueryClient()
  const [namaPerusahaan, setNamaPerusahaan] = useState('')
  const [alamat, setAlamat] = useState('')
  const [footerSlip, setFooterSlip] = useState('')
  const [periodeEvaluasiDefault, setPeriodeEvaluasiDefault] = useState('12_bulan')

  const { data, isLoading } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (data) {
      setNamaPerusahaan(data.nama_perusahaan ?? '')
      setAlamat((data as any).alamat ?? '')
      setFooterSlip((data as any).footer_slip ?? '')
      setPeriodeEvaluasiDefault((data as any).periode_evaluasi_default ?? '12_bulan')
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          id: 1,
          nama_perusahaan: namaPerusahaan || 'Nama Perusahaan',
          alamat,
          footer_slip: footerSlip,
          periode_evaluasi_default: periodeEvaluasiDefault,
        } as any)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app_settings'] })
      toast.success('Pengaturan disimpan.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <PageHeader
        title="Pengaturan Sistem"
        description="Identitas perusahaan ini akan tampil pada kop dan kaki slip gaji."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          saveMutation.mutate()
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Profil Perusahaan</CardTitle>
            <CardDescription>
              Digunakan sebagai kop dokumen pada slip gaji.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nama_perusahaan">Nama Usaha / Perusahaan</Label>
                  <Input
                    id="nama_perusahaan"
                    value={namaPerusahaan}
                    onChange={(e) => setNamaPerusahaan(e.target.value)}
                    placeholder="cth: Payflow Resto"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="alamat">Alamat</Label>
                  <Textarea
                    id="alamat"
                    rows={2}
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    placeholder="cth: Jl. Merdeka No. 1, Metro, Lampung"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="footer_slip">Catatan Kaki Slip Gaji</Label>
                  <Textarea
                    id="footer_slip"
                    rows={3}
                    value={footerSlip}
                    onChange={(e) => setFooterSlip(e.target.value)}
                    placeholder="cth: Slip ini diterbitkan secara elektronik dan sah tanpa tanda tangan basah."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="periode_evaluasi_default">Periode Evaluasi Default</Label>
                  <Select value={periodeEvaluasiDefault} onValueChange={setPeriodeEvaluasiDefault}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Pilih periode evaluasi" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3_bulan">3 Bulan</SelectItem>
                      <SelectItem value="6_bulan">6 Bulan</SelectItem>
                      <SelectItem value="12_bulan">1 Tahun</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  <CardDescription>
                    Pilihan ini akan menjadi nilai default periode evaluasi untuk karyawan baru.
                  </CardDescription>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pengaturan
          </Button>
        </div>
      </form>
    </div>
  )
}
