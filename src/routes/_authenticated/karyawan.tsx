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
import { Plus, Pencil, Trash2, Loader2, Mail, Phone, Store } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/karyawan')({
  component: KaryawanPage,
})

const LIST_JOBDESK = ['Kasir', 'Cook / Dapur', 'Server / Pelayan', 'Barista', 'Piket Kebersihan', 'Staf Inti']

function KaryawanPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [kodeKaryawan, setKodeKaryawan] = useState('')
  const [nama, setNama] = useState('')
  const [jabatan, setJabatan] = useState('')
  const [branchId, setBranchId] = useState('') 
  const [whatsapp, setWhatsapp] = useState('') // Perbaikan nama state
  const [email, setEmail] = useState('')
  const [aktif, setAktif] = useState(true)

  // Ambil Master Data Cabang
  const { data: branches = [] } = useQuery({
    queryKey: ['branches_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('nama')
      if (error) throw error
      return data || []
    }
  })

  // Ambil Data Karyawan
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').order('nama')
      if (error) throw error
      return data || []
    }
  })

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
      queryClient.invalidateQueries({ queryKey: ['employees_payroll_v7'] })
      toast.success(isEditing ? 'Data karyawan diperbarui!' : 'Karyawan ditambahkan!')
      handleClose()
    },
    onError: (error: any) => toast.error(`Gagal: ${error.message}`)
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees_list'] })
      toast.success('Dihapus!')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama) return toast.error('Nama wajib diisi!')
    if (!branchId) return toast.error('Cabang penempatan wajib dipilih!')

    saveMutation.mutate({
      kode_karyawan: kodeKaryawan || null,
      nama,
      jabatan: jabatan || null,
      branch_id: branchId,
      whatsapp, // Perbaikan: menggunakan properti whatsapp
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
    setBranchId(item.branch_id || '')
    setWhatsapp(item.whatsapp || '') // Perbaikan mapping
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
    setBranchId('')
    setWhatsapp('')
    setEmail('')
    setAktif(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Manajemen Karyawan" description="Kelola data diri, penempatan cabang, dan kontak staf." />

      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={(open) => !open ? handleClose() : setIsOpen(true)}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Tambah Karyawan</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>ID Karyawan</Label>
                  <Input placeholder="Misal: K001" value={kodeKaryawan} onChange={(e) => setKodeKaryawan(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Cabang Penempatan</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Cabang" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Nama Lengkap</Label>
                <Input placeholder="Masukkan nama" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Jabatan Utama</Label>
                <Select value={jabatan} onValueChange={setJabatan}>
                  <SelectTrigger><SelectValue placeholder="Pilih jabatan" /></SelectTrigger>
                  <SelectContent>
                    {LIST_JOBDESK.map(job => <SelectItem key={job} value={job}>{job}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>No. WhatsApp</Label>
                <Input type="tel" placeholder="08123456789" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              </div>

              <div className="flex items-center justify-between border rounded-lg p-3">
                <Label>Status Aktif</Label>
                <Switch checked={aktif} onCheckedChange={setAktif} />
              </div>

              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Simpan Data'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Karyawan</TableHead>
              <TableHead>Penempatan Cabang</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Kontak</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : employees?.map((item) => {
              const branchName = branches.find((b: any) => b.id === item.branch_id)?.nama || 'Belum diatur'
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-slate-700">
                      <Store className="w-3.5 h-3.5 text-blue-500" /> {branchName}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{item.jabatan || '-'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs text-slate-600 gap-1">
                      {/* Perbaikan: mengambil dari item.whatsapp */}
                      <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {item.whatsapp || '-'}</div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={item.aktif ? 'default' : 'secondary'}>{item.aktif ? 'Aktif' : 'Nonaktif'}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="w-4 h-4 text-blue-600" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (window.confirm('Hapus data?')) deleteMutation.mutate(item.id) }}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}