import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatIDR } from '@/lib/format'
import { Plus, Pencil, Trash2, Loader2, Users, UserCog } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/tunjangan')({
  component: TunjanganPage,
})

const LIST_JOBDESK = ['Kasir', 'Cook / Dapur', 'Server / Pelayan', 'Barista', 'Piket Kebersihan', 'Staf Inti']

function TunjanganPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  const [nama, setNama] = useState('')
  const [nominal, setNominal] = useState<number | ''>('')
  const [metode, setMetode] = useState<string>('fixed')
  const [aktif, setAktif] = useState(true)
  
  // Relasi Jobdesk Explicit
  const [isGlobal, setIsGlobal] = useState(true)
  const [targetJobdesks, setTargetJobdesks] = useState<string[]>([])

  const { data: allowances, isLoading } = useQuery({
    queryKey: ['allowance_types_v6'],
    queryFn: async () => {
      const { data, error } = await supabase.from('allowance_types').select('*').order('nama')
      if (error) throw error
      return data || []
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (isEditing && editId) {
        const { error } = await supabase.from('allowance_types').update(newData).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('allowance_types').insert([newData])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allowance_types_v6'] })
      queryClient.invalidateQueries({ queryKey: ['employees_payroll_v6'] }) 
      toast.success(isEditing ? 'Tunjangan diperbarui!' : 'Tunjangan ditambahkan!')
      handleClose()
    },
    onError: (error: any) => toast.error(`Gagal: ${error.message}`)
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('allowance_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allowance_types_v6'] })
      toast.success('Dihapus!')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama) return toast.error('Nama wajib diisi!')
    
    // Menyimpan target relasi ke dalam kolom 'catatan' sebagai string comma-separated
    const catatanRelasi = isGlobal ? 'GLOBAL' : targetJobdesks.join(',')

    saveMutation.mutate({
      nama,
      nominal_default: Number(nominal) || 0,
      metode,
      aktif,
      catatan: catatanRelasi
    })
  }

  const handleEdit = (item: any) => {
    setIsEditing(true)
    setEditId(item.id)
    setNama(item.nama)
    setNominal(item.nominal_default)
    setMetode(item.metode || 'fixed')
    setAktif(item.aktif)
    
    if (!item.catatan || item.catatan === 'GLOBAL') {
      setIsGlobal(true)
      setTargetJobdesks([])
    } else {
      setIsGlobal(false)
      setTargetJobdesks(item.catatan.split(','))
    }
    
    setIsOpen(true)
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsEditing(false)
    setEditId(null)
    setNama('')
    setNominal('')
    setMetode('fixed')
    setAktif(true)
    setIsGlobal(true)
    setTargetJobdesks([])
  }

  const getMetodeLabel = (m: string) => {
    if (m === 'manual') return 'Input Manual (Rp)'
    if (m === 'per_day') return 'Faktor Kali (Hari)'
    if (m === 'per_hour') return 'Faktor Kali (Jam)'
    return 'Nominal Tetap'
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Master Tunjangan" description="Atur komponen tunjangan dan hubungkan dengan spesifik Jobdesk." />
      
      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={(open) => !open ? handleClose() : setIsOpen(true)}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Tambah Tunjangan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Tunjangan' : 'Tambah Tunjangan'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nama Tunjangan</Label>
                <Input placeholder="Contoh: Tunjangan Dapur" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Model Perhitungan</Label>
                <Select value={metode} onValueChange={setMetode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Nominal Tetap (Otomatis)</SelectItem>
                    <SelectItem value="per_day">Dikali Jumlah Hari Kerja</SelectItem>
                    <SelectItem value="per_hour">Dikali Jumlah Jam (Mis: Lembur)</SelectItem>
                    <SelectItem value="manual">Input Bebas Nominal di Proses Gaji</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {metode !== 'manual' && (
                <div className="space-y-2">
                  <Label>Nominal Default (Rp)</Label>
                  <Input type="number" value={nominal} onChange={(e) => setNominal(Number(e.target.value) || '')} />
                </div>
              )}

              {/* RELASI JOBDESK EXPLICIT */}
              <div className="flex items-center justify-between border rounded-lg p-3">
                <div className="space-y-0.5">
                  <Label>Berlaku Global</Label>
                  <p className="text-[11px] text-muted-foreground">Aktif = Semua karyawan dapat.</p>
                </div>
                <Switch checked={isGlobal} onCheckedChange={setIsGlobal} />
              </div>
              
              {!isGlobal && (
                <div className="space-y-2 border rounded-lg p-3 bg-slate-50/50">
                  <Label className="text-xs text-slate-700">Pilih Jobdesk Penerima Tunjangan Ini:</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {LIST_JOBDESK.map(job => (
                      <div key={job} className="flex items-center space-x-2 bg-white border px-2 py-1.5 rounded">
                        <Checkbox 
                          id={`job-${job}`} 
                          checked={targetJobdesks.includes(job)}
                          onCheckedChange={(checked) => {
                            if (checked) setTargetJobdesks(prev => [...prev, job])
                            else setTargetJobdesks(prev => prev.filter(j => j !== job))
                          }}
                        />
                        <label htmlFor={`job-${job}`} className="text-[11px] font-medium cursor-pointer flex-1">{job}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border rounded-lg p-3 mt-2">
                <Label>Status Aktif</Label>
                <Switch checked={aktif} onCheckedChange={setAktif} />
              </div>
              
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Simpan Tunjangan'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Tunjangan</TableHead>
              <TableHead>Target Penerima</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Nominal</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : allowances?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell>
                    {!item.catatan || item.catatan === 'GLOBAL' ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Users className="w-3 h-3 mr-1" /> Global</Badge>
                    ) : (
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant="outline" className="bg-slate-50 text-slate-700"><UserCog className="w-3 h-3 mr-1" /> Khusus</Badge>
                        <span className="text-[9px] text-muted-foreground break-words max-w-[150px]">{item.catatan}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{getMetodeLabel(item.metode)}</Badge></TableCell>
                  <TableCell>{item.metode === 'manual' ? '-' : formatIDR(item.nominal_default)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="w-4 h-4 text-blue-600" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (window.confirm('Hapus tunjangan?')) deleteMutation.mutate(item.id) }}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}