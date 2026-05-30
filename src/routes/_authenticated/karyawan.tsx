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
import { Pencil, Plus, Trash2, Loader2, Users } from 'lucide-react'
import { Database } from '@/integrations/supabase/types'

type Employee = Database['public']['Tables']['employees']['Row']

export const Route = createFileRoute('/_authenticated/karyawan')({
  component: KaryawanPage,
})

function KaryawanPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form State
  const [kodeKaryawan, setKodeKaryawan] = useState('')
  const [nama, setNama] = useState('')
  const [jabatan, setJabatan] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [tanggalMasuk, setTanggalMasuk] = useState('')
  const [aktif, setAktif] = useState(true)

  // Fetch Data Karyawan
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('nama', { ascending: true })
      if (error) throw error
      return data as Employee[]
    },
  })

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (isEditing && editId) {
        const { error } = await supabase
          .from('employees')
          .update(newData)
          .eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('employees').insert([newData])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success(isEditing ? 'Data Karyawan diperbarui!' : 'Karyawan baru berhasil ditambahkan!')
      resetForm()
      setIsOpen(false)
    },
    onError: (error) => {
      toast.error('Gagal menyimpan data: ' + error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Data karyawan berhasil dihapus!')
    },
    onError: (error) => {
      toast.error('Gagal menghapus data: Data ini mungkin sedang digunakan pada riwayat penggajian.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama) {
      toast.error('Nama karyawan wajib diisi!')
      return
    }
    
    saveMutation.mutate({
      kode_karyawan: kodeKaryawan || null,
      nama,
      jabatan,
      whatsapp,
      email,
      tanggal_masuk: tanggalMasuk || null,
      aktif,
    })
  }

  const handleEdit = (item: Employee) => {
    setKodeKaryawan(item.kode_karyawan || '')
    setNama(item.nama)
    setJabatan(item.jabatan || '')
    setWhatsapp(item.whatsapp || '')
    setEmail(item.email || '')
    setTanggalMasuk(item.tanggal_masuk || '')
    setAktif(item.aktif)
    setEditId(item.id)
    setIsEditing(true)
    setIsOpen(true)
  }

  const handleDelete = (id: string, namaKaryawan: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus data karyawan ${namaKaryawan}?`)) {
      deleteMutation.mutate(id)
    }
  }

  const resetForm = () => {
    setKodeKaryawan('')
    setNama('')
    setJabatan('')
    setWhatsapp('')
    setEmail('')
    setTanggalMasuk('')
    setAktif(true)
    setEditId(null)
    setIsEditing(false)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Data Karyawan"
          description="Kelola direktori tim restoran Anda, termasuk jabatan dan kontak."
        />
        
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Tambah Karyawan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="kode">Kode Karyawan (Opsional)</Label>
                  <Input
                    id="kode"
                    placeholder="Contoh: KRY-001"
                    value={kodeKaryawan}
                    onChange={(e) => setKodeKaryawan(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nama">Nama Lengkap *</Label>
                  <Input
                    id="nama"
                    placeholder="Nama Karyawan"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="jabatan">Jabatan</Label>
                  <Input
                    id="jabatan"
                    placeholder="Contoh: Waiter, Kasir, Koki"
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tanggal_masuk">Tanggal Masuk / Bergabung</Label>
                  <Input
                    id="tanggal_masuk"
                    type="date"
                    value={tanggalMasuk}
                    onChange={(e) => setTanggalMasuk(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="whatsapp">Nomor WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    placeholder="0812xxxxxx"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Penting untuk fitur pengiriman slip gaji.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email (Opsional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="karyawan@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 mt-2">
                <div className="space-y-0.5">
                  <Label>Status Aktif</Label>
                  <p className="text-xs text-muted-foreground">
                    Hanya karyawan aktif yang akan dimasukkan ke proses penggajian bulanan.
                  </p>
                </div>
                <Switch checked={aktif} onCheckedChange={setAktif} />
              </div>

              <Button type="submit" className="mt-4" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama & Kode</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : employees?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="h-8 w-8 text-muted-foreground/50" />
                    <p>Belum ada data karyawan.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              employees?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.nama}</div>
                    {item.kode_karyawan && (
                      <div className="text-xs text-muted-foreground">ID: {item.kode_karyawan}</div>
                    )}
                  </TableCell>
                  <TableCell>{item.jabatan || '-'}</TableCell>
                  <TableCell>{item.whatsapp || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.aktif ? "default" : "secondary"} className={item.aktif ? "bg-green-500 hover:bg-green-600" : ""}>
                      {item.aktif ? 'Aktif' : 'Non-Aktif'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id, item.nama)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
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