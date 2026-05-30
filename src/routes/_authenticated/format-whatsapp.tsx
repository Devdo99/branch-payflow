import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, MessageSquare, Save, Type } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/format-whatsapp')({
  component: FormatWhatsappPage,
})

// Daftar variabel yang bisa disisipkan ke dalam pesan
const VARIABLES = [
  { key: '{{nama}}', label: 'Nama Karyawan', sample: 'Rido Rinaldi' },
  { key: '{{periode}}', label: 'Periode Gaji', sample: 'Mei 2026' },
  { key: '{{gaji_pokok}}', label: 'Gaji Pokok', sample: 'Rp 3.000.000' },
  { key: '{{total_tunjangan}}', label: 'Total Tunjangan', sample: 'Rp 500.000' },
  { key: '{{total_potongan}}', label: 'Total Potongan', sample: 'Rp 100.000' },
  { key: '{{gaji_bersih}}', label: 'Take Home Pay', sample: 'Rp 3.400.000' },
  { key: '{{nama_bank}}', label: 'Nama Bank', sample: 'BCA' },
  { key: '{{nomor_rekening}}', label: 'No. Rekening', sample: '1234567890' },
]

function FormatWhatsappPage() {
  const queryClient = useQueryClient()
  const [template, setTemplate] = useState('')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [cursorPosition, setCursorPosition] = useState(0)

  // Ambil data template dari database
  const { isLoading } = useQuery({
    queryKey: ['whatsapp_template'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('id, konten')
        .eq('jenis', 'per_karyawan')
        .maybeSingle()

      if (error) throw error
      
      if (data) {
        setTemplate(data.konten || '')
        setTemplateId(data.id)
      } else {
        // Jika belum ada, isi dengan template default
        const defaultText = `Halo {{nama}},\n\nBerikut adalah rincian slip gaji Anda untuk periode {{periode}}:\n\nGaji Pokok: {{gaji_pokok}}\nTotal Tunjangan: {{total_tunjangan}}\nTotal Potongan: {{total_potongan}}\n\n*Take Home Pay: {{gaji_bersih}}*\n\nGaji telah ditransfer ke rekening {{nama_bank}} ({{nomor_rekening}}).\n\nTerima kasih atas kerja keras Anda!\nSalam,\nManajemen.`
        setTemplate(defaultText)
      }
      return data
    },
  })

  // Simpan perubahan ke database
  const saveMutation = useMutation({
    mutationFn: async (newKonten: string) => {
      if (templateId) {
        const { error } = await supabase
          .from('whatsapp_templates')
          .update({ konten: newKonten })
          .eq('id', templateId)
        if (error) throw error
      } else {
        // Jika karena alasan tertentu row-nya belum ada di DB, buat baru
        const { error } = await supabase
          .from('whatsapp_templates')
          .insert({ jenis: 'per_karyawan', konten: newKonten })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_template'] })
      toast.success('Format WhatsApp berhasil disimpan!')
    },
    onError: (error: any) => {
      toast.error('Gagal menyimpan format: ' + error.message)
    },
  })

  const handleSave = () => {
    if (!template.trim()) {
      toast.error('Template pesan tidak boleh kosong!')
      return
    }
    saveMutation.mutate(template)
  }

  const insertVariable = (variableKey: string) => {
    const textBefore = template.substring(0, cursorPosition)
    const textAfter = template.substring(cursorPosition)
    const newText = textBefore + variableKey + textAfter
    setTemplate(newText)
    
    // Geser posisi kursor ke setelah variabel dimasukkan
    setCursorPosition(cursorPosition + variableKey.length)
  }

  // Fungsi utilitas untuk memunculkan preview teks
  const generatePreview = () => {
    let previewText = template
    VARIABLES.forEach(v => {
      // Mengganti semua kemunculan {{variabel}} dengan contoh teksnya menggunakan Regex global
      const regex = new RegExp(v.key.replace(/[{}]/g, '\\$&'), 'g')
      previewText = previewText.replace(regex, v.sample)
    })
    return previewText
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl">
      <PageHeader
        title="Format Pesan WhatsApp"
        description="Atur struktur pesan atau template yang akan dikirim ke karyawan saat mendistribusikan slip gaji."
      />

      {isLoading ? (
        <div className="flex h-32 items-center justify-center border rounded-lg bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sisi Editor */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Editor Template
              </CardTitle>
              <CardDescription>
                Ketik format pesan Anda di sini. Gunakan tombol variabel di bawah untuk menyisipkan data dinamis.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <Textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                onBlur={(e) => setCursorPosition(e.target.selectionStart)}
                onSelect={(e: any) => setCursorPosition(e.target.selectionStart)}
                className="min-h-[300px] font-mono text-sm resize-y"
                placeholder="Halo {{nama}}, berikut slip gaji Anda..."
              />
              
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Sisipkan Variabel:
                </p>
                <div className="flex flex-wrap gap-2">
                  {VARIABLES.map((v) => (
                    <Button 
                      key={v.key} 
                      variant="secondary" 
                      size="sm"
                      onClick={() => insertVariable(v.key)}
                      type="button"
                    >
                      {v.key}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Simpan Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sisi Preview */}
          <Card className="bg-muted/30 border-dashed">
            <CardHeader>
              <CardTitle className="text-muted-foreground flex items-center gap-2">
                Simulasi Pesan
              </CardTitle>
              <CardDescription>
                Seperti ini perkiraan pesan yang akan diterima oleh karyawan di WhatsApp mereka.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-[#EFEAE2] p-4 rounded-xl max-w-sm mx-auto shadow-sm relative overflow-hidden">
                {/* Aksen visual ala WhatsApp */}
                <div className="absolute top-0 left-0 w-full h-2 bg-[#25D366]"></div>
                
                <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm mt-2 whitespace-pre-wrap text-sm text-[#111b21] font-sans">
                  {generatePreview() || <span className="text-gray-400 italic">Preview kosong...</span>}
                </div>
                <div className="text-[10px] text-right mt-1 text-gray-500">12:00 PM</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}