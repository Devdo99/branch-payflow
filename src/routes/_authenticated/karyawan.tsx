import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/karyawan')({
  component: KaryawanPage,
})

function KaryawanPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [kodeKaryawan, setKodeKaryawan] = useState('')
  const [nama, setNama] = useState('')
  const [jabatanId, setJabatanId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [tanggalMasuk, setTanggalMasuk] = useState('')
  const [periodeEvaluasi, setPeriodeEvaluasi] = useState('12_bulan')
  const [aktif, setAktif] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')

  const handleClose = () => {
    setIsOpen(false)
    setIsEditing(false)
    setEditId(null)
    setKodeKaryawan('')
    setNama('')
    setJabatanId('')
    setBranchId('')
    setWhatsapp('')
    setEmail('')
    setTanggalMasuk('')
    setPeriodeEvaluasi('12_bulan')
    setAktif(true)
  }

  const { data: branches = [] } = useQuery({
    queryKey: ['branches_list'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('*').order('nama')
      return (data as any[]) || []
    }
  })

  const { data: listJabatan = [] } = useQuery({
    queryKey: ['jabatan_list'],
    queryFn: async () => {
      const { data } = await supabase.from('jabatan' as any).select('*').order('nama_jabatan')
      return (data as any[]) || []
    }
  })

  const { data: employees = [], isLoading } = useQuery<any[], Error>({
    queryKey: ['employees_list'],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*').order('nama')
      return (data as any[]) || []
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (isEditing && editId) {
        await supabase.from('employees').update(newData).eq('id', editId)
      } else {
        await supabase.from('employees').insert([newData])
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees_list'] })
      toast.success(isEditing ? 'Data berhasil diupdate!' : 'Data berhasil disimpan!')
      handleClose()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('employees').delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees_list'] })
      toast.success('Data dihapus!')
    }
  })

  const handleDelete = (id: string) => {
    if (!window.confirm('Hapus data karyawan ini? Tindakan ini tidak bisa dibatalkan.')) return
    deleteMutation.mutate(id)
  }

  // FUNGSI HANDLE EDIT (Mengisi form saat edit ditekan)
  const handleEdit = (item: any) => {
    setIsEditing(true)
    setEditId(item.id)
    setKodeKaryawan(item.kode_karyawan || '')
    setNama(item.nama || '')
    setJabatanId(item.jabatan_id || '')
    setBranchId(item.branch_id || '')
    setWhatsapp(item.whatsapp || '')
    setEmail(item.email || '')
    setTanggalMasuk(item.tanggal_masuk || '')
    setPeriodeEvaluasi(item.periode_evaluasi || '12_bulan')
    setAktif(item.aktif ?? true)
    setIsOpen(true)
  }

  const filteredEmployees = employees.filter((item: any) => {
    const term = searchTerm.toLowerCase().trim()
    const matchesBranch = branchFilter === 'all' || item.branch_id === branchFilter
    const matchesSearch =
      term === '' ||
      item.nama?.toLowerCase().includes(term) ||
      item.kode_karyawan?.toLowerCase().includes(term) ||
      item.whatsapp?.toLowerCase().includes(term) ||
      item.email?.toLowerCase().includes(term)
    return matchesBranch && matchesSearch
  })

  const getMasaKerja = (tanggalMasuk?: string) => {
    if (!tanggalMasuk) return '-'
    const start = new Date(tanggalMasuk)
    if (Number.isNaN(start.getTime())) return '-'
    const now = new Date()
    let years = now.getFullYear() - start.getFullYear()
    let months = now.getMonth() - start.getMonth()

    if (now.getDate() < start.getDate()) {
      months -= 1
    }
    if (months < 0) {
      years -= 1
      months += 12
    }

    if (years <= 0) {
      return `${months} bulan`
    }
    return `${years} thn${months > 0 ? ` ${months} bln` : ''}`
  }

  // FUNGSI SUBMIT (Mengirim semua data)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      kode_karyawan: kodeKaryawan,
      nama,
      jabatan_id: jabatanId,
      branch_id: branchId,
      whatsapp,
      email,
      tanggal_masuk: tanggalMasuk || null,
      periode_evaluasi: periodeEvaluasi,
      aktif
    })
  }

  return (
    <div className="space-y-6 p-4">
      <PageHeader title="Manajemen Karyawan" description="Kelola data karyawan." />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Daftar Karyawan</h2>
            <p className="text-sm text-slate-500">Kelola karyawan aktif dan nonaktif, serta atur cabang dan jabatan.</p>
          </div>
          <Dialog open={isOpen} onOpenChange={(open) => !open ? handleClose() : setIsOpen(true)}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="inline-flex items-center">
                <Plus className="w-4 h-4 mr-2" /> Tambah Karyawan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Edit Karyawan' : 'Tambah Karyawan'}</DialogTitle>
                <DialogDescription>
                  Isi informasi dasar karyawan supaya bisa dipetakan ke proses payroll.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="kode-karyawan">Kode Karyawan</Label>
                    <Input id="kode-karyawan" placeholder="CT001" value={kodeKaryawan} onChange={(e) => setKodeKaryawan(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nama-karyawan">Nama Lengkap</Label>
                    <Input id="nama-karyawan" placeholder="Nama lengkap" value={nama} onChange={(e) => setNama(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch">Cabang</Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih Cabang" /></SelectTrigger>
                      <SelectContent>{branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.nama}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jabatan">Jabatan</Label>
                    <Select value={jabatanId} onValueChange={setJabatanId}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih Jabatan" /></SelectTrigger>
                      <SelectContent>{listJabatan.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.nama_jabatan}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input id="whatsapp" placeholder="0812xxxx" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="example@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tanggal-masuk">Tanggal Masuk</Label>
                    <Input id="tanggal-masuk" type="date" value={tanggalMasuk} onChange={(e) => setTanggalMasuk(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="periode-evaluasi">Periode Evaluasi</Label>
                    <Select value={periodeEvaluasi} onValueChange={setPeriodeEvaluasi}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih Periode" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3_bulan">3 Bulan</SelectItem>
                        <SelectItem value="6_bulan">6 Bulan</SelectItem>
                        <SelectItem value="12_bulan">1 Tahun</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={aktif} onCheckedChange={setAktif} id="aktif" />
                    <Label htmlFor="aktif">Status Aktif</Label>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" type="button" onClick={handleClose}>Batal</Button>
                    <Button type="submit" className="w-full sm:w-auto" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? <Loader2 className="animate-spin" /> : 'Simpan'}
                    </Button>
                  </DialogFooter>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center">
            <Input
              placeholder="Cari nama, kode, email, WhatsApp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Filter Cabang" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Cabang</SelectItem>
                {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>Menampilkan <span className="font-semibold text-slate-900">{filteredEmployees.length}</span> dari <span className="font-semibold text-slate-900">{employees.length}</span> karyawan</span>
            {branchFilter !== 'all' && (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-700">Cabang: {branches.find((b: any) => b.id === branchFilter)?.nama}</span>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-white shadow-sm">
        <Table className="min-w-[650px]">
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="hidden md:table-cell">Cabang</TableHead>
              <TableHead className="hidden md:table-cell">Jabatan</TableHead>
              <TableHead className="hidden md:table-cell">Masa Kerja</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-slate-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-12 text-center text-slate-500">
                  Tidak ada karyawan untuk filter ini.
                </TableCell>
              </TableRow>
            ) : filteredEmployees.map((item: any) => {
              const branchName = branches.find((b: any) => b.id === item.branch_id)?.nama || '-'
              const jabatanName = listJabatan.find((j: any) => j.id === item.jabatan_id)?.nama_jabatan || '-'
              return (
                <TableRow key={item.id} className="group transition-colors hover:bg-slate-50">
                  <TableCell className="font-medium">{item.kode_karyawan || '-'}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{item.nama}</div>
                    <div className="mt-2 grid gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 md:hidden">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Cabang</span>
                        <span>{branchName}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Jabatan</span>
                        <span>{jabatanName}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Masa Kerja</span>
                        <span>{getMasaKerja(item.tanggal_masuk)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Status</span>
                        <span className={item.aktif ? 'text-emerald-700' : 'text-rose-600'}>{item.aktif ? 'Aktif' : 'Nonaktif'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{branchName}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge>{jabatanName}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell">{getMasaKerja(item.tanggal_masuk)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={item.aktif ? 'secondary' : 'destructive'}>
                      {item.aktif ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="w-4 h-4 text-slate-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
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