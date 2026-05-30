import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatIDR } from '@/lib/format'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/potongan')({
  component: PotonganPage,
})

function PotonganPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  const [nama, setNama] = useState('')
  const [nominal, setNominal] = useState<number | ''>('')
  const [metode, setMetode] = useState<string>('fixed')
  const [aktif, setAktif] = useState(true)

  const { data: deductions, isLoading } = useQuery({
    queryKey: ['deduction_types'],
    queryFn: async () => {
      const { data } = await supabase.from('deduction_types').select('*').order('nama')
      return data || []
    }
  })

  // Fungsi untuk reset form
  const resetForm = () => {
    setNama('')
    setNominal('')
    setMetode('fixed')
    setAktif(true)
    setIsEditing(false)
    setEditId(null)
  }

  // Fungsi saat tombol Edit diklik
  const handleEdit = (item: any) => {
    setNama(item.nama)
    setNominal(item.nominal_default)
    setMetode(item.metode)
    setAktif(item.aktif)
    setIsEditing(true)
    setEditId(item.id)
    setIsOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (isEditing && editId) {
        await supabase.from('deduction_types').update(newData).eq('id', editId)
      } else {
        await supabase.from('deduction_types').insert([newData])
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deduction_types'] })
      toast.success(isEditing ? 'Potongan diperbarui!' : 'Potongan ditambahkan!')
      setIsOpen(false)
      resetForm()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('deduction_types').delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deduction_types'] })
      toast.success('Potongan berhasil dihapus!')
    }
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Master Potongan" description="Atur logika pemotongan gaji karyawan." />
        <Dialog 
            open={isOpen} 
            onOpenChange={(open) => {
                setIsOpen(open)
                if (!open) resetForm()
            }}
        >
          <DialogTrigger asChild>
            <Button onClick={resetForm}><Plus className="mr-2 h-4 w-4"/> Tambah Potongan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Potongan' : 'Tambah Potongan'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { 
                e.preventDefault(); 
                saveMutation.mutate({ nama, nominal_default: Number(nominal) || 0, metode, aktif }); 
            }} className="space-y-4 pt-4">
              <div className="space-y-2">
                  <Label>Nama Potongan</Label>
                  <Input value={nama} onChange={e => setNama(e.target.value)} required placeholder="Contoh: Izin, Telat, Kasbon" />
              </div>
              <div className="space-y-2">
                  <Label>Metode Perhitungan</Label>
                  <Select value={metode} onValueChange={setMetode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Tetap (Otomatis memotong tiap bulan)</SelectItem>
                      <SelectItem value="per_day">Harian (Muncul Form "Jumlah Hari/Kali")</SelectItem>
                      <SelectItem value="manual">Manual (Muncul Form "Nominal Rupiah")</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
              <div className="space-y-2">
                  <Label>Nominal Default (Rp)</Label>
                  <Input type="number" value={nominal} onChange={e => setNominal(Number(e.target.value))} placeholder="Biarkan 0 jika dipotong proporsional" />
              </div>
              <div className="flex items-center space-x-2 pt-2 pb-2">
                <Switch checked={aktif} onCheckedChange={setAktif} />
                <Label>Status Aktif</Label>
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nama Potongan</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead className="text-right">Nominal Default</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                        <Loader2 className="animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                </TableRow>
              ) : deductions?.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        Belum ada data potongan
                    </TableCell>
                </TableRow>
              ) : (
                deductions?.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell>
                      <Badge variant="outline">
                          {item.metode === 'fixed' ? 'Tetap' : item.metode === 'per_day' ? 'Harian' : 'Manual'}
                      </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatIDR(item.nominal_default || 0)}</TableCell>
                  <TableCell className="text-center">
                      <Badge variant={item.aktif ? 'default' : 'secondary'}>
                          {item.aktif ? 'Aktif' : 'Non-Aktif'}
                      </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                          <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { 
                          if(window.confirm(`Yakin ingin menghapus ${item.nama}?`)) deleteMutation.mutate(item.id) 
                      }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
      </div>
    </div>
  )
}