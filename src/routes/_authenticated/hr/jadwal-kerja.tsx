import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  CalendarClock,
  Wand2,
  Copy,
  GripVertical,
  X,
  LayoutTemplate,
  Users,
  RefreshCw,
  ClipboardCheck,
  Calculator,
  ArrowRight,
} from "lucide-react";
import {
  HARI_JADWAL,
  JENIS_JADWAL,
  WARNA_JADWAL,
  formatJam,
  getJenisJadwal,
  getNamaHari,
  toTime,
} from "@/lib/jadwal-kerja";
import { getDaysInMonth } from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/hr/jadwal-kerja")({
  component: JadwalKerjaPage,
});

type Employee = {
  id: string;
  nama: string;
  kode_karyawan?: string | null;
  jabatan?: string | null;
  aktif?: boolean;
  branch_id?: string | null;
  branches?: { nama?: string } | null;
};

type JadwalBlock = {
  id: string;
  employee_id: string;
  hari: number;
  jenis: string;
  nama: string | null;
  jam_mulai: string;
  jam_selesai: string;
  warna: string | null;
};

type JadwalTemplate = {
  id: string;
  nama: string;
  jenis: string;
  jam_mulai: string;
  jam_selesai: string;
  warna: string;
};

function JadwalKerjaPage() {
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Drag & drop
  const [dragBlock, setDragBlock] = useState<JadwalBlock | null>(null);
  const [dragTemplate, setDragTemplate] = useState<JadwalTemplate | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragEndedRef = useRef(false);

  // Dialog blok (tambah/edit)
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formEmpId, setFormEmpId] = useState("");
  const [formHari, setFormHari] = useState(0);
  const [formJenis, setFormJenis] = useState("kerja");
  const [formNama, setFormNama] = useState("");
  const [formJamMulai, setFormJamMulai] = useState("08:00");
  const [formJamSelesai, setFormJamSelesai] = useState("16:00");
  const [formWarna, setFormWarna] = useState("#10b981");

  // Dialog auto generate (multi-shift)
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoBranch, setAutoBranch] = useState("all");
  const [workDays, setWorkDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [autoShiftIds, setAutoShiftIds] = useState<string[]>([]);
  const [istirahatOn, setIstirahatOn] = useState(true);
  const [istirahatMulai, setIstirahatMulai] = useState("12:00");
  const [istirahatSelesai, setIstirahatSelesai] = useState("13:00");
  const [namaIstirahat, setNamaIstirahat] = useState("Istirahat");

  // Dialog putar rotasi
  const [rotateOpen, setRotateOpen] = useState(false);

  // Dialog salin jadwal
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySource, setCopySource] = useState("");
  const [copyBranch, setCopyBranch] = useState("all");

  // Dialog integrasi absensi
  const [absenOpen, setAbsenOpen] = useState(false);
  const [absenBranch, setAbsenBranch] = useState("all");
  const [absenMulai, setAbsenMulai] = useState("");
  const [absenSelesai, setAbsenSelesai] = useState("");

  // Dialog man power planning
  const [mpOpen, setMpOpen] = useState(false);
  const [mpBranch, setMpBranch] = useState("");
  const [mpShiftNames, setMpShiftNames] = useState<string[]>([]);
  const [mpKebutuhan, setMpKebutuhan] = useState<Record<string, number>>({});
  const [mpCustomShift, setMpCustomShift] = useState("");

  // Dialog template
  const [tplOpen, setTplOpen] = useState(false);
  const [tplNama, setTplNama] = useState("");
  const [tplJenis, setTplJenis] = useState("kerja");
  const [tplJamMulai, setTplJamMulai] = useState("08:00");
  const [tplJamSelesai, setTplJamSelesai] = useState("16:00");
  const [tplWarna, setTplWarna] = useState("#10b981");

  // ---------- Data ----------
  const { data: branches = [] } = useQuery({
    queryKey: ["branches_jadwal"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, nama").order("nama");
      return (data as { id: string; nama: string }[]) || [];
    },
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees_jadwal", selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("id, nama, kode_karyawan, jabatan, aktif, branch_id, branches ( nama )")
        .order("nama");
      if (selectedBranch !== "all") query = query.eq("branch_id", selectedBranch);
      const { data } = await query;
      return (data || []) as Employee[];
    },
  });

  const { data: jadwalList = [], isLoading } = useQuery<JadwalBlock[]>({
    queryKey: ["jadwal_kerja"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jadwal_kerja")
        .select("id, employee_id, hari, jenis, nama, jam_mulai, jam_selesai, warna")
        .order("jam_mulai");
      if (error) throw error;
      return (data || []) as JadwalBlock[];
    },
  });

  const { data: templates = [] } = useQuery<JadwalTemplate[]>({
    queryKey: ["jadwal_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jadwal_templates")
        .select("id, nama, jenis, jam_mulai, jam_selesai, warna")
        .eq("aktif", true)
        .order("nama");
      if (error) throw error;
      return (data || []) as JadwalTemplate[];
    },
  });

  const kerjaTemplates = useMemo(
    () => templates.filter((t) => t.jenis === "kerja").sort((a, b) => (a.jam_mulai < b.jam_mulai ? -1 : 1)),
    [templates],
  );

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return employees.filter(
      (e) =>
        term === "" ||
        e.nama.toLowerCase().includes(term) ||
        e.kode_karyawan?.toLowerCase().includes(term),
    );
  }, [employees, searchTerm]);

  const empIds = useMemo(() => new Set(filteredEmployees.map((e) => e.id)), [filteredEmployees]);

  const filteredJadwal = useMemo(
    () => jadwalList.filter((b) => empIds.has(b.employee_id)),
    [jadwalList, empIds],
  );

  const blocksByCell = useMemo(() => {
    const map: Record<string, JadwalBlock[]> = {};
    filteredJadwal.forEach((b) => {
      const key = `${b.employee_id}|${b.hari}`;
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.jam_mulai < b.jam_mulai ? -1 : 1)),
    );
    return map;
  }, [filteredJadwal]);

  const stats = useMemo(() => {
    let kerja = 0;
    let istirahat = 0;
    filteredJadwal.forEach((b) => (b.jenis === "istirahat" ? istirahat++ : kerja++));
    return { kerja, istirahat };
  }, [filteredJadwal]);

  // ---------- Data untuk Man Power Planning ----------
  const { data: mpEmployees = [] } = useQuery<{ id: string }[]>({
    queryKey: ["employees_mp", mpBranch],
    queryFn: async () => {
      if (!mpBranch) return [];
      const { data } = await supabase
        .from("employees")
        .select("id")
        .eq("branch_id", mpBranch)
        .eq("aktif", true);
      return (data || []) as { id: string }[];
    },
    enabled: mpOpen && !!mpBranch,
  });

  const { data: mpPlan = [] } = useQuery<
    { shift_nama: string; hari: number; kebutuhan: number }[]
  >({
    queryKey: ["mp_plan", mpBranch],
    queryFn: async () => {
      if (!mpBranch) return [];
      const { data } = await supabase
        .from("man_power_plan")
        .select("shift_nama, hari, kebutuhan")
        .eq("branch_id", mpBranch);
      return (data || []) as { shift_nama: string; hari: number; kebutuhan: number }[];
    },
    enabled: mpOpen && !!mpBranch,
  });

  // Muat daftar shift + kebutuhan saat dialog MP dibuka / cabang berubah
  useEffect(() => {
    if (!mpOpen || !mpBranch) return;
    const set = new Set<string>();
    kerjaTemplates.forEach((t) => set.add(t.nama));
    jadwalList.forEach((b) => {
      if (b.jenis === "kerja" && b.nama) set.add(b.nama);
    });
    mpPlan.forEach((p) => set.add(p.shift_nama));
    setMpShiftNames(Array.from(set).sort());
    const map: Record<string, number> = {};
    mpPlan.forEach((p) => {
      map[`${p.shift_nama}|${p.hari}`] = p.kebutuhan;
    });
    setMpKebutuhan(map);
  }, [mpOpen, mpBranch, kerjaTemplates, jadwalList, mpPlan]);

  const mpTersedia = useMemo(() => {
    const map: Record<string, number> = {};
    const ids = new Set(mpEmployees.map((e) => e.id));
    jadwalList.forEach((b) => {
      if (b.jenis !== "kerja" || !b.nama || !ids.has(b.employee_id)) return;
      const key = `${b.nama}|${b.hari}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [jadwalList, mpEmployees]);

  // ---------- Mutasi ----------
  const saveBlockMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        employee_id: formEmpId,
        hari: formHari,
        jenis: formJenis,
        nama: formNama.trim() || null,
        jam_mulai: toTime(formJamMulai),
        jam_selesai: toTime(formJamSelesai),
        warna: formWarna,
      };
      if (isEditing && editId) {
        const { error } = await supabase.from("jadwal_kerja").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("jadwal_kerja").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jadwal_kerja"] });
      toast.success(isEditing ? "Jadwal berhasil diperbarui!" : "Jadwal berhasil ditambahkan!");
      handleClose();
    },
    onError: (err) => toast.error(`Gagal menyimpan: ${(err as Error).message}`),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jadwal_kerja").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jadwal_kerja"] });
      toast.success("Jadwal dihapus!");
    },
    onError: (err) => toast.error(`Gagal menghapus: ${(err as Error).message}`),
  });

  const moveBlockMutation = useMutation({
    mutationFn: async ({ id, empId, hari }: { id: string; empId: string; hari: number }) => {
      const { error } = await supabase
        .from("jadwal_kerja")
        .update({ employee_id: empId, hari })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, empId, hari }) => {
      await queryClient.cancelQueries({ queryKey: ["jadwal_kerja"] });
      const prev = queryClient.getQueryData<JadwalBlock[]>(["jadwal_kerja"]);
      queryClient.setQueryData<JadwalBlock[]>(["jadwal_kerja"], (old) =>
        (old || []).map((b) => (b.id === id ? { ...b, employee_id: empId, hari } : b)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["jadwal_kerja"], ctx.prev);
      toast.error("Gagal memindahkan jadwal.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["jadwal_kerja"] }),
  });

  const addFromTemplateMutation = useMutation({
    mutationFn: async ({
      template,
      empId,
      hari,
    }: {
      template: JadwalTemplate;
      empId: string;
      hari: number;
    }) => {
      const { error } = await supabase.from("jadwal_kerja").insert([
        {
          employee_id: empId,
          hari,
          jenis: template.jenis,
          nama: template.nama,
          jam_mulai: template.jam_mulai,
          jam_selesai: template.jam_selesai,
          warna: template.warna,
          template_id: template.id,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jadwal_kerja"] });
      toast.success("Template ditambahkan ke jadwal!");
    },
    onError: (err) => toast.error(`Gagal menambah jadwal: ${(err as Error).message}`),
  });

  // Auto generate dengan distribusi shift (rotasi)
  const autoGenerateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("generate_jadwal_shift", {
        p_branch: autoBranch === "all" ? null : autoBranch,
        p_hari_kerja: workDays,
        p_shift_ids: autoShiftIds,
        p_istirahat_mulai: istirahatOn ? toTime(istirahatMulai) : null,
        p_istirahat_selesai: istirahatOn ? toTime(istirahatSelesai) : null,
        p_nama_istirahat: namaIstirahat.trim() || "Istirahat",
      });
      if (error) throw error;
      return (data as number) || 0;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["jadwal_kerja"] });
      toast.success(
        `Jadwal dibuat otomatis — ${n} blok tersimpan. Karyawan dibagi merata ke ${autoShiftIds.length} shift.`,
      );
      setAutoOpen(false);
    },
    onError: (err) =>
      toast.error(
        `Gagal generate: ${(err as Error).message}. Pastikan migrasi jadwal_kerja sudah dijalankan di database.`,
      ),
  });

  // Putar rotasi shift
  const rotateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rotate_jadwal_kerja", {
        p_branch: selectedBranch === "all" ? null : selectedBranch,
      });
      if (error) throw error;
      return (data as number) || 0;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["jadwal_kerja"] });
      toast.success(`Rotasi selesai — ${n} blok shift diputar ke shift berikutnya.`);
      setRotateOpen(false);
    },
    onError: (err) =>
      toast.error(`Gagal rotasi: ${(err as Error).message}. Pastikan ada template shift kerja.`),
  });

  const copyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("copy_jadwal_kerja", {
        p_dari: copySource,
        p_branch: copyBranch === "all" ? null : copyBranch,
      });
      if (error) throw error;
      return (data as number) || 0;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["jadwal_kerja"] });
      toast.success(`Jadwal disalin — ${n} blok tersimpan untuk karyawan lain.`);
      setCopyOpen(false);
    },
    onError: (err) => toast.error(`Gagal menyalin: ${(err as Error).message}`),
  });

  // Integrasi jadwal -> absensi
  const absenSyncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("sinkron_absen_dari_jadwal", {
        p_mulai: absenMulai,
        p_selesai: absenSelesai,
        p_branch: absenBranch === "all" ? null : absenBranch,
      });
      if (error) throw error;
      return (data as number) || 0;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["absen_list"] });
      toast.success(`Absensi disinkronkan dari jadwal — ${n} catatan 'Hadir' dibuat.`);
      setAbsenOpen(false);
    },
    onError: (err) =>
      toast.error(`Gagal sinkron absensi: ${(err as Error).message}. Pastikan migrasi sudah dijalankan.`),
  });

  // Simpan man power planning
  const saveMpMutation = useMutation({
    mutationFn: async () => {
      const rows: { hari: number; shift_nama: string; kebutuhan: number }[] = [];
      mpShiftNames.forEach((shift) => {
        HARI_JADWAL.forEach((h) => {
          rows.push({
            hari: h.hari,
            shift_nama: shift,
            kebutuhan: mpKebutuhan[`${shift}|${h.hari}`] || 0,
          });
        });
      });
      const { data, error } = await supabase.rpc("save_man_power_plan", {
        p_branch: mpBranch,
        p_rows: rows,
      });
      if (error) throw error;
      return (data as number) || 0;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["mp_plan"] });
      toast.success(`Rencana kebutuhan tersimpan (${n} sel).`);
    },
    onError: (err) => toast.error(`Gagal menyimpan rencana: ${(err as Error).message}`),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("jadwal_templates").insert([
        {
          nama: tplNama.trim(),
          jenis: tplJenis,
          jam_mulai: toTime(tplJamMulai),
          jam_selesai: toTime(tplJamSelesai),
          warna: tplWarna,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jadwal_templates"] });
      toast.success("Template jadwal disimpan!");
      setTplNama("");
      setTplJenis("kerja");
      setTplJamMulai("08:00");
      setTplJamSelesai("16:00");
      setTplWarna("#10b981");
    },
    onError: (err) => toast.error(`Gagal menyimpan template: ${(err as Error).message}`),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jadwal_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jadwal_templates"] });
      toast.success("Template dihapus!");
    },
    onError: (err) => toast.error(`Gagal menghapus template: ${(err as Error).message}`),
  });

  // ---------- Handler ----------
  const handleClose = () => {
    setIsOpen(false);
    setIsEditing(false);
    setEditId(null);
    setFormEmpId("");
    setFormHari(0);
    setFormJenis("kerja");
    setFormNama("");
    setFormJamMulai("08:00");
    setFormJamSelesai("16:00");
    setFormWarna("#10b981");
  };

  const openAdd = (empId: string, hari: number) => {
    setIsEditing(false);
    setEditId(null);
    setFormEmpId(empId);
    setFormHari(hari);
    setFormJenis("kerja");
    setFormNama("");
    setFormJamMulai("08:00");
    setFormJamSelesai("16:00");
    setFormWarna("#10b981");
    setIsOpen(true);
  };

  const openEdit = (b: JadwalBlock) => {
    setIsEditing(true);
    setEditId(b.id);
    setFormEmpId(b.employee_id);
    setFormHari(b.hari);
    setFormJenis(b.jenis);
    setFormNama(b.nama || "");
    setFormJamMulai(formatJam(b.jam_mulai));
    setFormJamSelesai(formatJam(b.jam_selesai));
    setFormWarna(b.warna || "#10b981");
    setIsOpen(true);
  };

  const handleDrop = (empId: string, hari: number) => {
    setDropTarget(null);
    if (dragTemplate) {
      addFromTemplateMutation.mutate({ template: dragTemplate, empId, hari });
    } else if (dragBlock) {
      if (dragBlock.employee_id === empId && dragBlock.hari === hari) {
        setDragBlock(null);
        return;
      }
      moveBlockMutation.mutate({ id: dragBlock.id, empId, hari });
    }
    setDragBlock(null);
    setDragTemplate(null);
  };

  const toggleWorkDay = (hari: number) => {
    setWorkDays((prev) =>
      prev.includes(hari) ? prev.filter((h) => h !== hari) : [...prev, hari].sort(),
    );
  };

  const toggleAllWorkDays = () => {
    setWorkDays(workDays.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6]);
  };

  const toggleShift = (id: string) => {
    setAutoShiftIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openAuto = () => {
    setAutoBranch(selectedBranch);
    setWorkDays([0, 1, 2, 3, 4]);
    setAutoShiftIds(kerjaTemplates.map((t) => t.id));
    setIstirahatOn(true);
    setIstirahatMulai("12:00");
    setIstirahatSelesai("13:00");
    setNamaIstirahat("Istirahat");
    setAutoOpen(true);
  };

  const openAbsen = () => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const days = getDaysInMonth(now.getFullYear(), now.getMonth());
    setAbsenBranch(selectedBranch);
    setAbsenMulai(`${now.getFullYear()}-${m}-01`);
    setAbsenSelesai(`${now.getFullYear()}-${m}-${String(days).padStart(2, "0")}`);
    setAbsenOpen(true);
  };

  const openMp = () => {
    const b = selectedBranch === "all" ? branches[0]?.id || "" : selectedBranch;
    setMpBranch(b);
    setMpCustomShift("");
    setMpOpen(true);
  };

  const submitBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmpId) return toast.error("Pilih karyawan terlebih dahulu.");
    if (!formJamMulai || !formJamSelesai) return toast.error("Lengkapi jam mulai dan selesai.");
    saveBlockMutation.mutate();
  };

  const submitAuto = (e: React.FormEvent) => {
    e.preventDefault();
    if (workDays.length === 0) return toast.error("Pilih minimal satu hari kerja.");
    if (autoShiftIds.length === 0) return toast.error("Pilih minimal satu shift kerja.");
    if (istirahatOn && (!istirahatMulai || !istirahatSelesai))
      return toast.error("Lengkapi jam istirahat.");
    if (
      window.confirm(
        "Generate akan MENIMPA seluruh jadwal karyawan aktif pada cabang terpilih, lalu membagi mereka merata ke shift yang dipilih. Lanjutkan?",
      )
    ) {
      autoGenerateMutation.mutate();
    }
  };

  const submitRotate = () => {
    const scope = selectedBranch === "all" ? "semua cabang" : branches.find((b) => b.id === selectedBranch)?.nama;
    if (
      window.confirm(
        `Putar rotasi untuk ${scope}? Setiap karyawan berpindah ke shift berikutnya (urutan: ${kerjaTemplates.map((t) => t.nama).join(" → ")} → kembali ke awal).`,
      )
    ) {
      rotateMutation.mutate();
    }
  };

  const submitCopy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!copySource) return toast.error("Pilih karyawan sumber jadwal.");
    if (
      window.confirm(
        "Salin jadwal akan MENIMPA jadwal seluruh karyawan aktif pada cabang target. Lanjutkan?",
      )
    ) {
      copyMutation.mutate();
    }
  };

  const submitAbsen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!absenMulai || !absenSelesai) return toast.error("Lengkapi rentang tanggal.");
    if (absenSelesai < absenMulai) return toast.error("Tanggal selesai tidak boleh sebelum mulai.");
    if (
      window.confirm(
        "Buat catatan 'Hadir' untuk semua hari kerja sesuai jadwal pada rentang terpilih. Catatan absen yang sudah ada tidak akan ditimpa. Lanjutkan?",
      )
    ) {
      absenSyncMutation.mutate();
    }
  };

  const submitMp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpBranch) return toast.error("Pilih cabang terlebih dahulu.");
    saveMpMutation.mutate();
  };

  const submitTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplNama.trim()) return toast.error("Isi nama template.");
    saveTemplateMutation.mutate();
  };

  const addMpShift = () => {
    const name = mpCustomShift.trim();
    if (!name) return;
    if (mpShiftNames.includes(name)) {
      toast.error("Nama shift sudah ada.");
      return;
    }
    setMpShiftNames((prev) => [...prev, name].sort());
    setMpCustomShift("");
  };

  // Total kebutuhan vs tersedia per hari (semua shift)
  const mpTotals = useMemo(() => {
    const k: Record<number, number> = {};
    const t: Record<number, number> = {};
    HARI_JADWAL.forEach((h) => {
      k[h.hari] = 0;
      t[h.hari] = 0;
    });
    mpShiftNames.forEach((shift) => {
      HARI_JADWAL.forEach((h) => {
        k[h.hari] += mpKebutuhan[`${shift}|${h.hari}`] || 0;
        t[h.hari] += mpTersedia[`${shift}|${h.hari}`] || 0;
      });
    });
    return { k, t };
  }, [mpShiftNames, mpKebutuhan, mpTersedia]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Jadwal Kerja & Istirahat"
        description="Atur jadwal kerja & istirahat per hari, rotasi shift otomatis, sinkron ke absensi, dan kalkulator man power planning."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              onClick={() => setTplOpen(true)}
            >
              <LayoutTemplate className="mr-2 h-4 w-4 text-violet-600" /> Template
            </Button>
            <Button
              variant="outline"
              className="border-sky-200 hover:bg-sky-50 hover:text-sky-700"
              onClick={() => setCopyOpen(true)}
            >
              <Copy className="mr-2 h-4 w-4 text-sky-600" /> Salin Jadwal
            </Button>
            <Button
              variant="outline"
              className="border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={openAbsen}
            >
              <ClipboardCheck className="mr-2 h-4 w-4 text-emerald-600" /> Integrasi Absen
            </Button>
            <Button
              variant="outline"
              className="border-amber-200 hover:bg-amber-50 hover:text-amber-700"
              onClick={openMp}
            >
              <Calculator className="mr-2 h-4 w-4 text-amber-600" /> Man Power
            </Button>
            <Button
              variant="outline"
              className="border-teal-200 hover:bg-teal-50 hover:text-teal-700"
              onClick={() => setRotateOpen(true)}
            >
              <RefreshCw className="mr-2 h-4 w-4 text-teal-600" /> Putar Rotasi
            </Button>
            <Button
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-none rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all"
              onClick={openAuto}
            >
              <Wand2 className="mr-2 h-4 w-4" /> Auto Generate
            </Button>
          </div>
        }
      />

      {/* Statistik */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500/15 to-teal-400/15 border border-emerald-500/20">
              <CalendarClock className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Karyawan Ditampilkan
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {filteredEmployees.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500/15 to-teal-400/15 border border-emerald-500/20">
              <Users className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Blok Kerja
              </p>
              <p className="text-2xl font-bold text-emerald-600">{stats.kerja}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/15 to-orange-400/15 border border-amber-500/20">
              <CalendarClock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Blok Istirahat
              </p>
              <p className="text-2xl font-bold text-amber-600">{stats.istirahat}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-slate-900">Jadwal Mingguan</p>
            <p className="text-xs text-slate-400">
              Seret blok ke hari/karyawan lain, atau seret template ke sel yang diinginkan.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <Input
            placeholder="Cari nama / kode karyawan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full lg:w-56"
          />
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Semua Cabang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Template chips — bisa di-drag ke sel grid */}
      <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Template Blok — seret ke sel jadwal
          </p>
          <button
            type="button"
            onClick={() => setTplOpen(true)}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            + Tambah Template
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {templates.length === 0 && (
            <p className="text-xs text-slate-400">
              Belum ada template. Buat template untuk menambah blok cepat via drag & drop.
            </p>
          )}
          {templates.map((t) => {
            const j = getJenisJadwal(t.jenis);
            return (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => {
                  setDragTemplate(t);
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData("text/plain", `template:${t.id}`);
                }}
                onDragEnd={() => setDragTemplate(null)}
                className={`group flex cursor-grab items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${j.bg} ${j.border}`}
                title={`${t.nama} (${formatJam(t.jam_mulai)}–${formatJam(t.jam_selesai)}) — seret ke sel jadwal`}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-50" />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: t.warna || j.color }}
                />
                <span className="whitespace-nowrap">{t.nama}</span>
                <span className="whitespace-nowrap font-normal text-slate-500">
                  {formatJam(t.jam_mulai)}–{formatJam(t.jam_selesai)}
                </span>
              </div>
            );
          })}
          {(dragTemplate || dragBlock) && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              {dragTemplate ? "Lepaskan di sel jadwal untuk menambah" : "Lepaskan untuk memindahkan"}
            </span>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border/60 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Legenda:</span>
        {JENIS_JADWAL.map((j) => (
          <span key={j.value} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${j.dot}`} />
            {j.label}
          </span>
        ))}
        <span className="ml-auto hidden text-xs text-slate-400 sm:block">
          Klik blok untuk edit • klik × untuk hapus • klik + untuk tambah manual
        </span>
      </div>

      {/* Grid mingguan */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-max w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="sticky left-0 z-10 min-w-52 border-b border-r border-slate-100 bg-slate-50 p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 shadow-[1px_0_0_#f1f5f9]">
                  Karyawan
                </th>
                {HARI_JADWAL.map((h) => (
                  <th
                    key={h.hari}
                    className={`min-w-40 border-b border-r border-slate-100 p-3 text-center text-xs font-bold uppercase tracking-wider ${
                      h.hari === 6 ? "bg-rose-50/60 text-rose-500" : "text-slate-500"
                    }`}
                  >
                    {h.pendek}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="h-40 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    Tidak ada karyawan untuk filter ini.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-slate-50/40">
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white p-3 shadow-[1px_0_0_#f1f5f9]">
                      <div className="font-medium text-slate-900">{e.nama}</div>
                      <div className="text-xs text-slate-400">
                        {e.kode_karyawan || "-"} • {e.branches?.nama || "-"}
                      </div>
                    </td>
                    {HARI_JADWAL.map((h) => {
                      const cellKey = `${e.id}|${h.hari}`;
                      const blocks = blocksByCell[cellKey] || [];
                      const isDrop = dropTarget === cellKey;
                      return (
                        <td
                          key={h.hari}
                          className={`min-h-24 border-b border-r border-slate-100 p-1.5 align-top transition-colors ${
                            h.hari === 6 ? "bg-rose-50/30" : ""
                          } ${isDrop ? "bg-emerald-50 ring-2 ring-inset ring-emerald-300" : ""}`}
                          onDragOver={(ev) => {
                            ev.preventDefault();
                            ev.dataTransfer.dropEffect = dragTemplate ? "copy" : "move";
                            setDropTarget(cellKey);
                          }}
                          onDragLeave={(ev) => {
                            if (!ev.currentTarget.contains(ev.relatedTarget as Node))
                              setDropTarget(null);
                          }}
                          onDrop={(ev) => {
                            ev.preventDefault();
                            handleDrop(e.id, h.hari);
                          }}
                        >
                          <div className="flex min-h-20 flex-col gap-1">
                            {blocks.map((b) => {
                              const j = getJenisJadwal(b.jenis);
                              return (
                                <div
                                  key={b.id}
                                  draggable
                                  onDragStart={(ev) => {
                                    setDragBlock(b);
                                    ev.dataTransfer.effectAllowed = "move";
                                    ev.dataTransfer.setData("text/plain", b.id);
                                  }}
                                  onDragEnd={() => {
                                    dragEndedRef.current = true;
                                    setDragBlock(null);
                                  }}
                                  onClick={() => {
                                    if (dragEndedRef.current) {
                                      dragEndedRef.current = false;
                                      return;
                                    }
                                    openEdit(b);
                                  }}
                                  className={`group relative flex cursor-grab items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${j.bg} ${j.border}`}
                                  title={`${b.nama || j.label} • ${getNamaHari(b.hari)} • ${formatJam(b.jam_mulai)}–${formatJam(b.jam_selesai)} — seret untuk pindah, klik untuk edit`}
                                >
                                  <GripVertical className="h-3 w-3 shrink-0 opacity-40" />
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ background: b.warna || j.color }}
                                  />
                                  <span className="min-w-0 flex-1 truncate">
                                    {b.nama || j.label}
                                  </span>
                                  <span className="shrink-0 font-normal text-slate-500">
                                    {formatJam(b.jam_mulai)}–{formatJam(b.jam_selesai)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      if (window.confirm("Hapus blok jadwal ini?"))
                                        deleteBlockMutation.mutate(b.id);
                                    }}
                                    className="hidden h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/70 text-slate-400 transition-colors hover:bg-rose-500 hover:text-white group-hover:flex"
                                    title="Hapus jadwal"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => openAdd(e.id, h.hari)}
                              className="mt-auto flex h-6 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-300 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-500"
                              title={`Tambah jadwal ${e.nama} — ${getNamaHari(h.hari)}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog tambah/edit blok */}
      <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : setIsOpen(true))}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isEditing ? "Edit Jadwal" : "Tambah Jadwal"}
            </DialogTitle>
            <DialogDescription>
              Atur blok kerja / istirahat karyawan untuk hari tertentu dalam seminggu.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitBlock} className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Karyawan
                </Label>
                <Select value={formEmpId} onValueChange={setFormEmpId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih karyawan" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nama} {emp.kode_karyawan ? `(${emp.kode_karyawan})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Hari
                </Label>
                <Select value={String(formHari)} onValueChange={(v) => setFormHari(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HARI_JADWAL.map((h) => (
                      <SelectItem key={h.hari} value={String(h.hari)}>
                        {h.panjang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Jenis
                </Label>
                <Select value={formJenis} onValueChange={setFormJenis}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JENIS_JADWAL.map((j) => (
                      <SelectItem key={j.value} value={j.value}>
                        {j.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nama (opsional)
                </Label>
                <Input
                  placeholder={formJenis === "istirahat" ? "Istirahat Siang" : "Shift Utama"}
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Jam Mulai
                </Label>
                <Input
                  type="time"
                  value={formJamMulai}
                  onChange={(e) => setFormJamMulai(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Jam Selesai
                </Label>
                <Input
                  type="time"
                  value={formJamSelesai}
                  onChange={(e) => setFormJamSelesai(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Warna
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {WARNA_JADWAL.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setFormWarna(w)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      formWarna === w ? "border-slate-900 ring-2 ring-slate-900/20" : "border-transparent"
                    }`}
                    style={{ background: w }}
                    title={w}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={handleClose}>
                Batal
              </Button>
              <Button type="submit" disabled={saveBlockMutation.isPending}>
                {saveBlockMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Simpan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog auto generate (distribusi shift / rotasi) */}
      <Dialog open={autoOpen} onOpenChange={setAutoOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Auto Generate Jadwal (Rotasi Shift)
            </DialogTitle>
            <DialogDescription>
              Buat jadwal otomatis untuk seluruh karyawan aktif pada cabang terpilih dan bagikan
              mereka merata ke beberapa shift (rotasi). Jadwal lama akan ditimpa.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAuto} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cabang
              </Label>
              <Select value={autoBranch} onValueChange={setAutoBranch}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Cabang</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Hari Kerja
                </Label>
                <button
                  type="button"
                  onClick={toggleAllWorkDays}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  {workDays.length === 7 ? "Kosongkan" : "Pilih Semua"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HARI_JADWAL.map((h) => {
                  const on = workDays.includes(h.hari);
                  return (
                    <button
                      key={h.hari}
                      type="button"
                      onClick={() => toggleWorkDay(h.hari)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                        on
                          ? h.hari === 6
                            ? "border-rose-300 bg-rose-500 text-white shadow-sm"
                            : "border-emerald-300 bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-sm shadow-emerald-500/20"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {h.panjang}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Shift untuk Rotasi
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    setAutoShiftIds(autoShiftIds.length === kerjaTemplates.length ? [] : kerjaTemplates.map((t) => t.id))
                  }
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  {autoShiftIds.length === kerjaTemplates.length && kerjaTemplates.length > 0
                    ? "Kosongkan"
                    : "Pilih Semua"}
                </button>
              </div>
              {kerjaTemplates.length === 0 ? (
                <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
                  Belum ada template shift kerja. Buat template kerja dulu (tombol Template) agar
                  bisa generate rotasi.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {kerjaTemplates.map((t) => {
                    const on = autoShiftIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleShift(t.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                          on
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                            on ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                          }`}
                        >
                          {on && "✓"}
                        </span>
                        {t.nama}
                        <span className="font-normal text-slate-400">
                          {formatJam(t.jam_mulai)}–{formatJam(t.jam_selesai)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {kerjaTemplates.length > 1 && (
                <p className="text-[11px] text-slate-400">
                  Urutan rotasi mengikuti jam mulai:{" "}
                  {kerjaTemplates.map((t) => t.nama).join(" → ")} → kembali ke awal.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">Tambahkan Jam Istirahat</p>
                <p className="text-xs text-amber-700/80">
                  Blok istirahat otomatis dibuat setelah blok kerja.
                </p>
              </div>
              <Switch checked={istirahatOn} onCheckedChange={setIstirahatOn} />
            </div>

            {istirahatOn && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Istirahat Mulai
                  </Label>
                  <Input
                    type="time"
                    value={istirahatMulai}
                    onChange={(e) => setIstirahatMulai(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Istirahat Selesai
                  </Label>
                  <Input
                    type="time"
                    value={istirahatSelesai}
                    onChange={(e) => setIstirahatSelesai(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
              Hari: <b>{workDays.length === 0 ? "-" : workDays.map((h) => getNamaHari(h)).join(", ")}</b>
              {" "}• Shift: <b>{autoShiftIds.length === 0 ? "-" : `${autoShiftIds.length} shift`}</b>
              {" "}• Istirahat:{" "}
              <b>
                {istirahatOn ? `${istirahatMulai}–${istirahatSelesai} (${namaIstirahat.trim() || "Istirahat"})` : "tidak ada"}
              </b>
              <br />
              Karyawan aktif pada cabang akan dibagi merata ke {Math.max(autoShiftIds.length, 1)} shift
              (putar rotasi kapan saja untuk memindahkan semua orang ke shift berikutnya).
            </div>

            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setAutoOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={autoGenerateMutation.isPending}>
                {autoGenerateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {autoGenerateMutation.isPending ? "Membuat..." : "Generate Jadwal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog putar rotasi */}
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Putar Rotasi Shift
            </DialogTitle>
            <DialogDescription>
              Setiap karyawan yang terjadwal akan berpindah ke shift berikutnya sesuai urutan jam
              mulai, lalu kembali ke shift pertama (siklus).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 px-3.5 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
                Urutan Rotasi
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {kerjaTemplates.length === 0 ? (
                  <span className="text-xs text-teal-800">
                    Tidak ada template shift kerja. Buat template dulu.
                  </span>
                ) : (
                  kerjaTemplates.map((t, i) => (
                    <span key={t.id} className="flex items-center gap-1.5 text-xs font-semibold text-teal-900">
                      <span className="rounded-lg bg-white px-2 py-1 shadow-sm">{t.nama}</span>
                      {i < kerjaTemplates.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-teal-400" />}
                    </span>
                  ))
                )}
              </div>
              {kerjaTemplates.length > 1 && (
                <p className="mt-2 text-[11px] text-teal-800/80">
                  Contoh: karyawan ber-Shift Pagi menjadi Shift{" "}
                  {kerjaTemplates[1]?.nama}, dan karyawan shift terakhir kembali ke{" "}
                  {kerjaTemplates[0]?.nama}. Blok istirahat tidak diubah.
                </p>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
              Lingkup:{" "}
              <b>
                {selectedBranch === "all"
                  ? "Semua Cabang"
                  : branches.find((b) => b.id === selectedBranch)?.nama || selectedBranch}
              </b>
            </div>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setRotateOpen(false)}>
                Batal
              </Button>
              <Button
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
                onClick={submitRotate}
                disabled={rotateMutation.isPending || kerjaTemplates.length === 0}
              >
                {rotateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {rotateMutation.isPending ? "Memutar..." : "Putar Rotasi"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog salin jadwal */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Salin Jadwal Karyawan
            </DialogTitle>
            <DialogDescription>
              Salin seluruh jadwal satu karyawan ke karyawan aktif lain pada cabang target.
              Jadwal target akan ditimpa.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCopy} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Karyawan Sumber
              </Label>
              <Select value={copySource} onValueChange={setCopySource}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih karyawan..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nama} {emp.kode_karyawan ? `(${emp.kode_karyawan})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cabang Target
              </Label>
              <Select value={copyBranch} onValueChange={setCopyBranch}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Cabang</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {copySource && (
              <p className="rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs text-sky-700">
                Jadwal <b>{employees.find((x) => x.id === copySource)?.nama}</b> akan disalin ke
                seluruh karyawan aktif pada{" "}
                <b>{copyBranch === "all" ? "semua cabang" : branches.find((b) => b.id === copyBranch)?.nama}</b>.
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setCopyOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={copyMutation.isPending}>
                {copyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copyMutation.isPending ? "Menyalin..." : "Salin Jadwal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog integrasi absensi */}
      <Dialog open={absenOpen} onOpenChange={setAbsenOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Integrasi Jadwal → Absensi
            </DialogTitle>
            <DialogDescription>
              Buat catatan kehadiran 'Hadir' otomatis untuk hari kerja sesuai jadwal pada rentang
              tanggal terpilih. Cek juga di menu Rekap Absen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAbsen} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cabang
              </Label>
              <Select value={absenBranch} onValueChange={setAbsenBranch}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Cabang</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tanggal Mulai
                </Label>
                <Input type="date" value={absenMulai} onChange={(e) => setAbsenMulai(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tanggal Selesai
                </Label>
                <Input
                  type="date"
                  value={absenSelesai}
                  min={absenMulai || undefined}
                  onChange={(e) => setAbsenSelesai(e.target.value)}
                />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-800">
              <p className="font-semibold">Cara kerja:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>Karyawan dengan blok <b>kerja</b> pada hari itu → catatan <b>'Hadir'</b> dibuat (sumber: jadwal).</li>
                <li>Catatan absen yang <b>sudah ada</b> (manual / cuti) tidak ditimpa.</li>
                <li>Hari tanpa jadwal kerja (mis. Minggu) tidak dibuatkan catatan.</li>
              </ul>
            </div>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setAbsenOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={absenSyncMutation.isPending}>
                {absenSyncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="h-4 w-4" />
                )}
                {absenSyncMutation.isPending ? "Menyinkronkan..." : "Sinkron Jadwal → Absen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog man power planning */}
      <Dialog open={mpOpen} onOpenChange={setMpOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Kalkulator Man Power Planning
            </DialogTitle>
            <DialogDescription>
              Isi kebutuhan jumlah karyawan per shift per hari. Kolom "Tersedia" dihitung otomatis
              dari jadwal, dan selisih kekurangan ditandai merah.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitMp} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cabang <span className="text-rose-500">*</span>
              </Label>
              <Select value={mpBranch} onValueChange={setMpBranch}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih cabang..." />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mpBranch ? (
              <>
                {/* Tambah shift custom */}
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tambah Shift / Posisi
                    </Label>
                    <Input
                      placeholder="Contoh: Kasir, Barista, Keamanan..."
                      value={mpCustomShift}
                      onChange={(e) => setMpCustomShift(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addMpShift();
                        }
                      }}
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={addMpShift}>
                    <Plus className="mr-1 h-4 w-4" /> Tambah
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-max w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80">
                        <th className="sticky left-0 min-w-40 border-b border-r border-slate-100 bg-slate-50 p-2 text-left font-bold uppercase tracking-wider text-slate-500">
                          Shift / Posisi
                        </th>
                        {HARI_JADWAL.map((h) => (
                          <th
                            key={h.hari}
                            className={`border-b border-r border-slate-100 p-2 text-center font-bold uppercase tracking-wider ${
                              h.hari === 6 ? "text-rose-500" : "text-slate-500"
                            }`}
                          >
                            {h.pendek}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mpShiftNames.map((shift) => (
                        <tr key={shift} className="align-top">
                          <td className="sticky left-0 border-b border-r border-slate-100 bg-white p-2 font-semibold text-slate-800">
                            {shift}
                          </td>
                          {HARI_JADWAL.map((h) => {
                            const key = `${shift}|${h.hari}`;
                            const need = mpKebutuhan[key] || 0;
                            const avail = mpTersedia[key] || 0;
                            const gap = avail - need;
                            return (
                              <td key={h.hari} className="border-b border-r border-slate-100 p-1.5">
                                <Input
                                  type="number"
                                  min={0}
                                  value={need === 0 ? "" : need}
                                  placeholder="0"
                                  onChange={(e) =>
                                    setMpKebutuhan((prev) => ({
                                      ...prev,
                                      [key]: Math.max(0, Number(e.target.value) || 0),
                                    }))
                                  }
                                  className="h-8 px-2 text-center text-xs"
                                />
                                <p
                                  className={`mt-0.5 text-center text-[10px] font-semibold ${
                                    gap < 0
                                      ? "text-rose-600"
                                      : need > 0
                                        ? "text-emerald-600"
                                        : "text-slate-300"
                                  }`}
                                >
                                  {need > 0
                                    ? `Tersedia ${avail} • ${gap < 0 ? `kurang ${-gap}` : gap === 0 ? "cukup" : `lebih ${gap}`}`
                                    : avail > 0
                                      ? `Tersedia ${avail}`
                                      : ""}
                                </p>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="bg-slate-50/60">
                        <td className="sticky left-0 border-b border-r border-slate-100 bg-slate-50 p-2 font-bold text-slate-700">
                          Total Kebutuhan
                        </td>
                        {HARI_JADWAL.map((h) => {
                          const need = mpTotals.k[h.hari];
                          const avail = mpTotals.t[h.hari];
                          const gap = avail - need;
                          return (
                            <td
                              key={h.hari}
                              className={`border-b border-r border-slate-100 p-2 text-center font-bold ${
                                need > 0 && gap < 0 ? "text-rose-600" : "text-slate-700"
                              }`}
                            >
                              {need}
                              {need > 0 && (
                                <span className="block text-[10px] font-semibold text-slate-400">
                                  tersedia {avail}
                                  {gap < 0 ? ` • kurang ${-gap}` : ""}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-400">
                  "Tersedia" = jumlah karyawan dengan blok kerja shift tersebut pada hari itu
                  (berdasarkan jadwal saat ini, cabang terpilih).
                </p>
              </>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-500">
                Pilih cabang untuk mulai menghitung kebutuhan tenaga kerja.
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setMpOpen(false)}>
                Tutup
              </Button>
              <Button type="submit" disabled={saveMpMutation.isPending || !mpBranch}>
                {saveMpMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4" />
                )}
                {saveMpMutation.isPending ? "Menyimpan..." : "Simpan Rencana"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog kelola template */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Kelola Template Jadwal
            </DialogTitle>
            <DialogDescription>
              Template bisa di-drag langsung ke grid jadwal untuk menambah blok dengan cepat, dan
              dipakai untuk Auto Generate rotasi shift.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              {templates.length === 0 && (
                <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-500">
                  Belum ada template.
                </p>
              )}
              {templates.map((t) => {
                const j = getJenisJadwal(t.jenis);
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${j.bg} ${j.border}`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: t.warna || j.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{t.nama}</p>
                      <p className="text-xs text-slate-500">
                        {j.label} • {formatJam(t.jam_mulai)}–{formatJam(t.jam_selesai)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-500 hover:bg-rose-500/10"
                      onClick={() => {
                        if (window.confirm(`Hapus template "${t.nama}"?`))
                          deleteTemplateMutation.mutate(t.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Plus className="h-3.5 w-3.5" /> Tambah Template Baru
              </p>
              <form onSubmit={submitTemplate} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Nama Template
                  </Label>
                  <Input
                    placeholder="Contoh: Shift Pagi, Istirahat Siang..."
                    value={tplNama}
                    onChange={(e) => setTplNama(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Jenis
                    </Label>
                    <Select value={tplJenis} onValueChange={setTplJenis}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JENIS_JADWAL.map((j) => (
                          <SelectItem key={j.value} value={j.value}>
                            {j.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Jam Mulai
                    </Label>
                    <Input
                      type="time"
                      value={tplJamMulai}
                      onChange={(e) => setTplJamMulai(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Jam Selesai
                    </Label>
                    <Input
                      type="time"
                      value={tplJamSelesai}
                      onChange={(e) => setTplJamSelesai(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Warna
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {WARNA_JADWAL.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setTplWarna(w)}
                        className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                          tplWarna === w
                            ? "border-slate-900 ring-2 ring-slate-900/20"
                            : "border-transparent"
                        }`}
                        style={{ background: w }}
                        title={w}
                      />
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saveTemplateMutation.isPending}>
                    {saveTemplateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Simpan Template
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
