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

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (isEditing && editId) await supabase.from('deduction_types').update(newData).eq('id', editId)
      else await supabase.from('deduction_types').insert([newData])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deduction_types'] })
      toast.success('Disimpan!')
      setIsOpen(false)
    }
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Master Potongan" description="Atur logika pemotongan." />
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/> Tambah</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tambah Potongan</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate({ nama, nominal_default: Number(nominal) || 0, metode, aktif }); }} className="space-y-4">
              <Label>Nama</Label><Input value={nama} onChange={e => setNama(e.target.value)} />
              <Label>Metode</Label>
              <Select value={metode} onValueChange={setMetode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Tetap</SelectItem>
                  <SelectItem value="per_day">Harian</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              <Label>Nominal (Rp)</Label><Input type="number" value={nominal} onChange={e => setNominal(Number(e.target.value))} />
              <Button type="submit">Simpan</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Metode</TableHead><TableHead className="text-right">Nominal</TableHead></TableRow></TableHeader>
        <TableBody>
          {deductions?.map(item => (
            <TableRow key={item.id}>
              <TableCell>{item.nama}</TableCell>
              <TableCell>{item.metode}</TableCell>
              <TableCell className="text-right">{formatIDR(item.nominal_default || 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}