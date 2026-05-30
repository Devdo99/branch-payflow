import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatIDR } from '@/lib/format'
import { Pencil, Loader2, Banknote } from 'lucide-react'
import { Database } from '@/integrations/supabase/types'

type Employee = Database['public']['Tables']['employees']['Row']

export const Route = createFileRoute('/_authenticated/gaji-pokok')({
  component: GajiPokokPage,
})

function GajiPokokPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [editItem, setEditItem] = useState<Employee | null>(null)
  const [nominal, setNominal] = useState<number | ''>('')

  // Fetch Karyawan Aktif
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees_gaji'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('aktif', true)
        .order('nama', { ascending: true })
      if (error) throw error
      return data as Employee[]
    },
  })

  // Mutation Update Gaji
  const updateMutation = useMutation({
    mutationFn: async (newGaji: number) => {
      if (!editItem) return
      const { error } = await supabase
        .from('employees')
        .update({ gaji_pokok: newGaji })
        .eq('id', editItem.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees_gaji'] })
      toast.success('Gaji pokok berhasil diperbarui!')
      setIsOpen(false)
    },
    onError: (error) => {
      toast.error('Gagal memperbarui gaji: ' + error.message)
    },
  })

  const handleEdit = (item: Employee) => {
    setEditItem(item)
    setNominal(item.gaji_pokok || 0)
    setIsOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (nominal === '' || nominal < 0) {
      toast.error('Masukkan nominal gaji yang valid!')
      return
    }
    updateMutation.mutate(Number(nominal))
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Data Gaji Pokok"
          description="Atur besaran gaji dasar bulanan untuk masing-masing karyawan aktif."
        />
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Gaji: {editItem?.nama}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nominal">Gaji Pokok Bulanan (Rp)</Label>
              <div className="relative">
                <Banknote className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="nominal"
                  type="number"
                  className="pl-9"
                  placeholder="0"
                  value={nominal}
                  onChange={(e) => setNominal(Number(e.target.value))}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Nominal ini akan menjadi angka dasar sebelum ditambah tunjangan dan dikurangi potongan pada saat proses generate gaji.
              </p>
            </div>

            <Button type="submit" className="mt-4" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Karyawan</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead className="text-right">Gaji Pokok Saat Ini</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : employees?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Belum ada karyawan aktif. Tambahkan di menu Data Karyawan.
                </TableCell>
              </TableRow>
            ) : (
              employees?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.nama}
                    {item.kode_karyawan && (
                      <span className="block text-xs text-muted-foreground font-normal">
                        ID: {item.kode_karyawan}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{item.jabatan || '-'}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    {formatIDR(item.gaji_pokok || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(item)} className="gap-2">
                      <Pencil className="h-4 w-4" />
                      Atur Nominal
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}