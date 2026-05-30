import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, UserCog } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/karyawan')({
  component: KaryawanPage,
})

function KaryawanPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form State
  const [nama, setNama] = useState('')
  const [tunjanganKhusus, setTunjanganKhusus] = useState<string[]>([])

  // Fetch Data
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*')
      if (error) throw error
      return data
    }
  })

  const { data: allAllowances } = useQuery({
    queryKey: ['allowance_types'],
    queryFn: async () => {
      // Kita gunakan casting 'as any' untuk menghindari error TypeScript 
      // yang belum mendeteksi kolom 'is_global' di types.ts
      const { data, error } = await supabase
        .from('allowance_types')
        .select('*')
        .eq('is_global' as any, false)
      
      if (error) throw error
      return data
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (editId) {
        const { error } = await supabase.from('employees').update(newData).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('employees').insert([newData])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Data karyawan disimpan!')
      setIsOpen(false)
      resetForm()
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({ nama, tunjangan_khusus: JSON.stringify(tunjanganKhusus) })
  }

  const handleEdit = (emp: any) => {
    setNama(emp.nama)
    setTunjanganKhusus(emp.tunjangan_khusus || [])
    setEditId(emp.id)
    setIsOpen(true)
  }

  const resetForm = () => {
    setNama(''); setTunjanganKhusus([]); setEditId(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Manajemen Karyawan" description="Data karyawan dan pengaturan hak tunjangan khusus." />
        <Button onClick={() => { resetForm(); setIsOpen(true); }}><Plus className="h-4 w-4 mr-2"/> Tambah Karyawan</Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Karyawan' : 'Tambah Karyawan'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nama Lengkap</Label>
              <Input value={nama} onChange={e => setNama(e.target.value)} required />
            </div>

            {/* Bagian Tunjangan Khusus */}
            <div className="border p-4 rounded-lg space-y-2">
              <Label className="font-semibold flex items-center gap-2"><UserCog className="w-4 h-4" /> Hak Tunjangan Khusus</Label>
              <p className="text-xs text-muted-foreground">Pilih tunjangan yang berhak diterima karyawan ini (Jabatan, Keahlian, dll):</p>
              <div className="grid gap-2 mt-2">
                {allAllowances?.map((item) => (
                  <div key={item.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={item.id}
                      checked={tunjanganKhusus.includes(item.id)}
                      onCheckedChange={(checked) => {
                        setTunjanganKhusus(prev => 
                          checked ? [...prev, item.id] : prev.filter(id => id !== item.id)
                        )
                      }}
                    />
                    <label htmlFor={item.id} className="text-sm">{item.nama}</label>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full">Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Table className="border rounded-md">
        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Tunjangan Khusus</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
        <TableBody>
          {employees?.map(emp => (
            <TableRow key={emp.id}>
              <TableCell className="font-medium">{emp.nama}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {(emp as any).tunjangan_khusus?.length > 0 ? 'Aktif' : '-'}
              </TableCell>
              <TableCell><Button variant="ghost" size="icon" onClick={() => handleEdit(emp)}><Pencil className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}