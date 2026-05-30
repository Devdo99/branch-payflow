import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Mail, Phone } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/karyawan')({
  component: KaryawanPage,
})

const LIST_JOBDESK = ['Kasir', 'Cook / Dapur', 'Server / Pelayan', 'Barista', 'Piket Kebersihan', 'Staf Inti']

function KaryawanPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // State Form data diri & kontak fokus utama
  const [kodeKaryawan, setKodeKaryawan] = useState('')
  const [nama, setNama] = useState('')
  const [jabatan, setJabatan] = useState('')
  const [telepon, setTelepon] = useState('')
  const [email, setEmail] = useState('')
  const [aktif, setAktif] = useState(true)

  // Ambil data karyawan dari database
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('nama', { ascending: true })
      if (error) throw error
      return data || []
    }
  })

  // Operasi Tambah / Edit Karyawan
  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (isEditing && editId) {
        const { error } = await supabase.from('employees').update(newData).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('employees').insert([newData])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees_list'] })
      queryClient.invalidateQueries({ queryKey: ['employees_payroll_v6'] })
      toast.success(isEditing ? 'Data karyawan berhasil diperbarui!' : 'Karyawan baru berhasil ditambahkan!')
      handleClose()
    },
    onError: (error: any) => {
      toast.error(`Gagal menyimpan data: ${error.message}`)
    }
  })

  // Operasi Hapus Karyawan
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees_list'] })
      toast.success('Data karyawan berhasil dihapus!')
    },
    onError: (error: any) => {
      toast.error(`Gagal menghapus data: ${error.message}`)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama) return toast.error('Nama karyawan wajib diisi!')
    if (!telepon) return toast.error('Nomor WhatsApp wajib diisi untuk pengiriman slip gaji!')

    saveMutation.mutate({
      kode_karyawan: kodeKaryawan || null,
      nama,
      jabatan: jabatan || null,
      telepon,
      no_hp: telepon, // Diisi ke kedua kolom agar aman dengan skema database
      email: email || null,
      aktif
    })
  }

  const handleEdit = (item: any) => {
    setIsEditing(true)
    setEditId(item.id)
    setKodeKaryawan(item.kode_karyawan || '')
    setNama(item.nama || '')
    setJabatan(item.jabatan || '')
    setTelepon(item.telepon || item.no_hp || '')
    setEmail(item.email || '')
    setAktif(item.aktif ?? true)
    setIsOpen(true)
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsEditing(false)
    setEditId(null)
    setKodeKaryawan('')
    setNama('')
    setJabatan('')
    setTelepon('')
    setEmail('')
    setAktif(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Manajemen Karyawan" 
        description="Kelola data diri dan kontak utama karyawan untuk keperluan distribusi slip gaji via WhatsApp atau Email." 
      />

      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={(open) => !open ? handleClose() : setIsOpen(true)}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Tambah Karyawan</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label htmlFor="kode">ID / Kode Karyawan</Label>
                <Input id="kode" placeholder="Misal: K001" value={kodeKaryawan} onChange={(e) => setKodeKaryawan(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="nama">Nama Lengkap</Label>
                <Input id="nama" placeholder="Masukkan nama lengkap" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="jabatan">Jabatan / Peran Utama</Label>
                <Select value={jabatan} onValueChange={setJabatan}>
                  <SelectTrigger id="jabatan">
                    <SelectValue placeholder="Pilih jabatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {LIST_JOBDESK.map(job => (
                      <SelectItem key={job} value={job}>{job}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="telepon">No. WhatsApp (Kontak Slip Gaji)</Label>
                <Input id="telepon" type="tel" placeholder="Contoh: 08123456789" value={telepon} onChange={(e) => setTelepon(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Pastikan nomor aktif untuk mempermudah fitur Kirim WA.</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Alamat Email (Opsional)</Label>
                <Input id="email" type="email" placeholder="contoh@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="flex items-center justify-between border rounded-lg p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="status">Status Karyawan Aktif</Label>
                  <p className="text-[11px] text-muted-foreground">Karyawan nonaktif otomatis disembunyikan dari halaman proses gaji.</p>
                </div>
                <Switch id="status" checked={aktif} onCheckedChange={setAktif} />
              </div>

              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Simpan Data Karyawan'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID Karyawan</TableHead>
              <TableHead>Nama Karyawan</TableHead>
              <TableHead>Jabatan Utama</TableHead>
              <TableHead>No. WhatsApp</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : employees?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground h-24">
                  Belum ada data karyawan yang terdaftar.
                </TableCell>
              </TableRow>
            ) : (
              employees?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.kode_karyawan || '-'}</TableCell>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell><Badge variant="secondary">{item.jabatan || '-'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {item.telepon || item.no_hp || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {item.email || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.aktif ? 'default' : 'secondary'}>
                      {item.aktif ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="w-4 h-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Hapus data karyawan ${item.nama}?`)) deleteMutation.mutate(item.id) }}>
                      <Trash2 className="w-4 h-4 text-red-600" />
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