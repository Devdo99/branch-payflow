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
  const [aktif, setAktif] = useState(true)

  const { data: deductions, isLoading } = useQuery({
    queryKey: ['deduction_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('deduction_types').select('*').order('nama')
      if (error) throw error
      return data
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (isEditing && editId) {
        const { error } = await supabase.from('deduction_types').update(newData).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('deduction_types').insert([{ ...newData, metode: 'fixed' }])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deduction_types'] })
      queryClient.invalidateQueries({ queryKey: ['deductions_master'] }) // Update state di proses-gaji
      toast.success('Data potongan berhasil disimpan!')
      resetForm()
      setIsOpen(false)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deduction_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deduction_types'] })
      toast.success('Data berhasil dihapus!')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama || nominal === '') return toast.error('Lengkapi form!')
    saveMutation.mutate({ nama, nominal_default: Number(nominal), aktif })
  }

  const handleEdit = (item: any) => {
    setNama(item.nama)
    setNominal(item.nominal_default)
    setAktif(item.aktif)
    setEditId(item.id)
    setIsEditing(true)
    setIsOpen(true)
  }

  const resetForm = () => {
    setNama(''); setNominal(''); setAktif(true); setEditId(null); setIsEditing(false)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Master Potongan" description="Atur komponen pengurang gaji bulanan karyawan." />
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Tambah Potongan</Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader><DialogTitle>{isEditing ? 'Edit Potongan' : 'Tambah Potongan Baru'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label>Nama Potongan</Label>
                <Input placeholder="Contoh: BPJS, Kasbon Bulanan" value={nama} onChange={e => setNama(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Nominal Tetap (Rp)</Label>
                <Input type="number" placeholder="0" value={nominal} onChange={e => setNominal(Number(e.target.value))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Status Aktif</Label>
                <Switch checked={aktif} onCheckedChange={setAktif} />
              </div>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Menyimpan...' : 'Simpan Data'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Potongan</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow> : 
             deductions?.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Belum ada data potongan.</TableCell></TableRow> :
             deductions?.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.nama}</TableCell>
                <TableCell className="text-right text-red-600 font-medium">{formatIDR(item.nominal_default)}</TableCell>
                <TableCell className="text-center"><Badge variant={item.aktif ? 'default' : 'secondary'}>{item.aktif ? 'Aktif' : 'Non-Aktif'}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if(window.confirm('Hapus potongan ini?')) deleteMutation.mutate(item.id) }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}