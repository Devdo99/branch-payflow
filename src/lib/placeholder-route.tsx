import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Construction } from "lucide-react";

const placeholders = {
  karyawan: { title: "Karyawan", desc: "Kelola data karyawan dan rekening bank." },
  "gaji-pokok": { title: "Gaji Pokok", desc: "Kelola gaji pokok dan riwayat perubahan." },
  tunjangan: { title: "Master Tunjangan", desc: "Jenis tunjangan dan metode hitung." },
  potongan: { title: "Master Potongan", desc: "Jenis potongan dan metode hitung." },
  "rekening-bank": { title: "Rekening Bank", desc: "Rekap rekening karyawan." },
  "proses-gaji": { title: "Proses Gaji", desc: "Hitung gaji per cabang dan periode." },
  "slip-gaji": { title: "Slip Gaji", desc: "Daftar slip dan unduh JPG." },
  "ringkasan-whatsapp": { title: "Ringkasan WhatsApp", desc: "Ringkasan gaji per karyawan / seluruh karyawan." },
  "format-whatsapp": { title: "Format WhatsApp", desc: "Edit template WhatsApp dengan variabel." },
  laporan: { title: "Laporan", desc: "Rekap penggajian per periode/cabang." },
  pengaturan: { title: "Pengaturan", desc: "Pengaturan umum aplikasi." },
} as const;

function makeRoute(slug: keyof typeof placeholders) {
  return createFileRoute(`/_authenticated/${slug}` as never)({
    component: () => {
      const p = placeholders[slug];
      return (
        <>
          <PageHeader title={p.title} description={p.desc} />
          <div className="p-6">
            <div className="rounded-md border border-dashed border-border bg-card p-10 text-center">
              <Construction className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Modul sedang disiapkan</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Modul ini akan dibangun pada iterasi berikutnya. Halaman <strong>Cabang</strong> sudah dapat digunakan.
              </p>
            </div>
          </div>
        </>
      );
    },
  });
}

export { makeRoute };
