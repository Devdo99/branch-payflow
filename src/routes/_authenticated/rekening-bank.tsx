import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Pencil, Loader2, Building2 } from 'lucide-react'
import { Database } from '@/integrations/supabase/types'

type Employee = Database['public']['Tables']['employees']['Row']
type BankStatus = Database['public']['Enums']['bank_status']

export const Route = createFileRoute('/_authenticated/rekening-bank')({
  component: RekeningBankPage,
})

const statusLabels: Record<BankStatus, string> = {
  valid: 'Valid (Siap Transfer)',
  belum_dicek: 'Belum Dicek',
  perlu_dicek_ulang: 'Perlu Dicek Ulang',
}

function getStatusBadge(status: BankStatus) {
  switch (status) {
    case 'valid':
      return <Badge className="bg-green-500 hover:bg-green-600">Valid</Badge>
    case 'belum_dicek':
      return <Badge variant="secondary">Belum Dicek</Badge>
    case 'perlu_dicek_ulang':
      return <Badge variant="destructive">Perlu Cek Ulang</Badge>
  }
}

function RekeningBankPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [editItem, setEditItem] = useState<Employee | null>(null)

  // Form State
  const [namaBank, setNamaBank] = useState('')
  const [nomorRekening, setNomorRekening] = useState('')
  const [namaPemilik, setNamaPemilik] = useState('')
  const [statusRekening, setStatusRekening] = useState<BankStatus>('belum_dicek')
  const [catatan, setCatatan] = useState('')

  // Fetch Data - Hanya ambil karyawan aktif
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees_bank'],
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

  // Mutation
  const updateMutation = useMutation({
    mutationFn: async (newData: Partial<Employee>) => {
      if (!editItem) return
      const { error } = await supabase
        .from('employees')
        .update(newData)
        .eq('id', editItem.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees_bank'] })
      toast.success('Data rekening berhasil diperbarui!')
      setIsOpen(false)
    },
    onError: (error) => {
      toast.error('Gagal menyimpan data: ' + error.message)
    },
  })

  const handleEdit = (item: Employee) => {
    setEditItem(item)
    setNamaBank(item.nama_bank || '')
    setNomorRekening(item.nomor_rekening || '')
    // Default ke nama karyawan jika nama pemilik masih kosong
    setNamaPemilik(item.nama_pemilik_rekening || item.nama) 
    setStatusRekening(item.status_rekening)
    setCatatan(item.catatan_rekening || '')
    setIsOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate({
      nama_bank: namaBank,
      nomor_rekening: nomorRekening,
      nama_pemilik_rekening: namaPemilik,
      status_rekening: statusRekening,
      catatan_rekening: catatan,
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Data Rekening Bank"
          description="Kelola informasi pencairan gaji (bank & e-wallet) untuk karyawan aktif"
        />
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Rekening: {editItem?.nama}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bank">Nama Bank / E-Wallet</Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="bank"
                    className="pl-9"
                    placeholder="BCA, Mandiri, DANA..."
                    value={namaBank}
                    onChange={(e) => setNamaBank(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="norek">Nomor Rekening</Label>
                <Input
                  id="norek"
                  placeholder="1234567890"
                  value={nomorRekening}
                  onChange={(e) => setNomorRekening(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pemilik">Atas Nama (Pemilik Rekening)</Label>
              <Input
                id="pemilik"
                placeholder="Nama sesuai buku tabungan"
                value={namaPemilik}
                onChange={(e) => setNamaPemilik(e.target.value)}
              />
              <p className="text-[0.8rem] text-muted-foreground">
                Pastikan nama di sini sama persis dengan nama di buku tabungan untuk menghindari retur/gagal transfer.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status Validasi</Label>
              <Select value={statusRekening} onValueChange={(val) => setStatusRekening(val as BankStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status validasi" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="catatan">Catatan</Label>
              <Textarea
                id="catatan"
                placeholder="Misal: Nomor rekening sedang diurus, atau e-wallet belum premium..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
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
              <TableHead>Karyawan</TableHead>
              <TableHead>Bank / E-Wallet</TableHead>
              <TableHead>No. Rekening & Atas Nama</TableHead>
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
                  Belum ada data karyawan aktif.
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
                  <TableCell>
                    {item.nama_bank || <span className="text-muted-foreground italic">- Belum diisi -</span>}
                  </TableCell>
                  <TableCell>
                    {item.nomor_rekening ? (
                      <div className="flex flex-col">
                        <span className="font-mono text-sm">{item.nomor_rekening}</span>
                        <span className="text-xs text-muted-foreground uppercase">A.N. {item.nama_pemilik_rekening}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">- Belum diisi -</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(item.status_rekening)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(item)} className="gap-2">
                      <Pencil className="h-4 w-4" />
                      Update
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