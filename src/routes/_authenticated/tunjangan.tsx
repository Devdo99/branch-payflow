import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  DialogTrigger,
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
import { Plus, Pencil, Trash2, Loader2, Info, Users, UserCog } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/tunjangan')({
  component: TunjanganPage,
})

function TunjanganPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [nama, setNama] = useState('')
  const [nominal, setNominal] = useState<number | ''>('')
  const [metode, setMetode] = useState<'fixed' | 'per_day' | 'manual'>('fixed')
  const [aktif, setAktif] = useState(true)
  const [isGlobal, setIsGlobal] = useState(true) // STATE BARU: Untuk Tunjangan Global/Khusus

  const { data: allowances, isLoading } = useQuery({
    queryKey: ['allowance_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('allowance_types').select('*').order('nama')
      if (error) throw error
      return data
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
      queryClient.invalidateQueries({ queryKey: ['allowance_types'] })
      toast.success('Data tunjangan berhasil disimpan!')
      resetForm()
      setIsOpen(false)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('allowance_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allowance_types'] })
      toast.success('Data berhasil dihapus!')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama) return toast.error('Isi nama tunjangan!')
    // Payload menyertakan is_global
    saveMutation.mutate({ nama, nominal_default: Number(nominal) || 0, metode, aktif, is_global: isGlobal })
  }

  const handleEdit = (item: any) => {
    setNama(item.nama)
    setNominal(item.nominal_default)
    setMetode(item.metode as any || 'fixed')
    setAktif(item.aktif)
    // Menangkap nilai is_global dari database, jika null maka default true
    setIsGlobal(item.is_global === undefined ? true : item.is_global) 
    setEditId(item.id)
    setIsEditing(true)
    setIsOpen(true)
  }

  const resetForm = () => {
    setNama(''); setNominal(''); setMetode('fixed'); setAktif(true); setIsGlobal(true); setEditId(null); setIsEditing(false)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Master Tunjangan" description="Atur komponen penambah gaji karyawan." />
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Tambah Tunjangan</Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader><DialogTitle>{isEditing ? 'Edit Tunjangan' : 'Tambah Tunjangan Baru'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label>Nama Tunjangan</Label>
                <Input placeholder="Contoh: Uang Makan, Tunjangan Jabatan" value={nama} onChange={e => setNama(e.target.value)} />
              </div>
              
              <div className="flex flex-col gap-2">
                <Label>Logika / Metode Perhitungan</Label>
                <Select value={metode} onValueChange={(val: any) => setMetode(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Nominal Tetap Bulanan</SelectItem>
                    <SelectItem value="per_day">Dikalikan Jumlah Hari Hadir</SelectItem>
                    <SelectItem value="manual">Manual (Isi Sendiri Saat Proses Gaji)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Nominal Dasar (Rp)</Label>
                <Input type="number" placeholder="0" value={nominal} onChange={e => setNominal(Number(e.target.value))} />
                {metode === 'per_day' && (
                  <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex gap-1 items-start mt-1">
                    <Info className="h-4 w-4 shrink-0" />
                    Tip: Jika diisi "0", sistem akan menghitung proporsional dari Gaji Pokok Harian karyawan.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col justify-center rounded-lg border p-3 gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Berlaku Global?</Label>
                    <Switch checked={isGlobal} onCheckedChange={setIsGlobal} />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {isGlobal 
                      ? 'Tunjangan ini otomatis muncul untuk SEMUA karyawan.' 
                      : 'Tunjangan khusus. Hanya muncul pada karyawan yang ditunjuk.'}
                  </p>
                </div>

                <div className="flex flex-col justify-center rounded-lg border p-3 gap-2 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Status Aktif</Label>
                    <Switch checked={aktif} onCheckedChange={setAktif} />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {aktif ? 'Tunjangan bisa digunakan.' : 'Tunjangan dinonaktifkan sementara.'}
                  </p>
                </div>
              </div>

              <Button type="submit" className="mt-2" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Menyimpan...' : 'Simpan Data'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Tunjangan</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow> : 
             allowances?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Belum ada data tunjangan.</TableCell></TableRow> :
             allowances?.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.nama}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {(item as any).is_global === undefined ? true : (item as any).is_global ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Users className="w-3 h-3 mr-1"/> Semua</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><UserCog className="w-3 h-3 mr-1"/> Khusus</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.metode === 'fixed' ? 'Tetap' : item.metode === 'per_day' ? 'Harian (x Hadir)' : 'Manual'}
                </TableCell>
                <TableCell className="text-right text-green-600 font-medium">
                  {item.metode === 'per_day' && item.nominal_default === 0 ? 'Proporsional Gaji' : formatIDR(item.nominal_default)}
                </TableCell>
                <TableCell className="text-center"><Badge variant={item.aktif ? 'default' : 'secondary'}>{item.aktif ? 'Aktif' : 'Non-Aktif'}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if(window.confirm('Hapus tunjangan ini?')) deleteMutation.mutate(item.id) }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}