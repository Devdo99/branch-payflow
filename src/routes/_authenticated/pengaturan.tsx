import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pengaturan")({
  component: PengaturanPage,
});

type SlipTemplateConfig = {
  layout: "classic" | "compact" | "borderless";
  accentColor: string;
  fontSize: "small" | "normal" | "large";
  showCompanyName: boolean;
  showCompanyAddress: boolean;
  showEmployeeName: boolean;
  showBranch: boolean;
  showPeriod: boolean;
  showBaseSalary: boolean;
  showAllowance: boolean;
  showDeduction: boolean;
  showNetSalary: boolean;
  showSignature: boolean;
  showFooter: boolean;
  leftSignatureLabel: string;
  leftSignatureName: string;
  rightSignatureLabel: string;
};

const defaultSlipTemplateConfig: SlipTemplateConfig = {
  layout: "classic",
  accentColor: "#000000",
  fontSize: "normal",
  showCompanyName: true,
  showCompanyAddress: true,
  showEmployeeName: true,
  showBranch: true,
  showPeriod: true,
  showBaseSalary: true,
  showAllowance: true,
  showDeduction: true,
  showNetSalary: true,
  showSignature: true,
  showFooter: true,
  leftSignatureLabel: "Dibuat oleh,",
  leftSignatureName: "Admin",
  rightSignatureLabel: "Diterima oleh,",
};

const getSlipTemplateConfig = (value: unknown): SlipTemplateConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultSlipTemplateConfig;
  }

  return { ...defaultSlipTemplateConfig, ...(value as Partial<SlipTemplateConfig>) };
};

function PengaturanPage() {
  const qc = useQueryClient();
  const [namaPerusahaan, setNamaPerusahaan] = useState("");
  const [alamat, setAlamat] = useState("");
  const [footerSlip, setFooterSlip] = useState("");
  const [periodeEvaluasiDefault, setPeriodeEvaluasiDefault] = useState("12_bulan");
  const [slipTemplateConfig, setSlipTemplateConfig] =
    useState<SlipTemplateConfig>(defaultSlipTemplateConfig);

  const { data, isLoading } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setNamaPerusahaan(data.nama_perusahaan ?? "");
      setAlamat((data as any).alamat ?? "");
      setFooterSlip((data as any).footer_slip ?? "");
      setPeriodeEvaluasiDefault((data as any).periode_evaluasi_default ?? "12_bulan");
      setSlipTemplateConfig(getSlipTemplateConfig((data as any).slip_template_config));
    }
  }, [data]);

  const updateSlipTemplateConfig = <K extends keyof SlipTemplateConfig>(
    key: K,
    value: SlipTemplateConfig[K],
  ) => {
    setSlipTemplateConfig((current) => ({ ...current, [key]: value }));
  };

  const renderSlipCheckbox = (key: keyof SlipTemplateConfig, label: string) => {
    return (
      <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
        <Checkbox
          checked={Boolean(slipTemplateConfig[key])}
          onCheckedChange={(checked) =>
            setSlipTemplateConfig((current) => ({ ...current, [key]: checked === true }))
          }
        />
        {label}
      </label>
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_settings").upsert({
        id: 1,
        nama_perusahaan: namaPerusahaan || "Nama Perusahaan",
        alamat,
        footer_slip: footerSlip,
        periode_evaluasi_default: periodeEvaluasiDefault,
        slip_template_config: slipTemplateConfig,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Pengaturan disimpan.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <PageHeader
        title="Pengaturan Sistem"
        description="Identitas perusahaan ini akan tampil pada kop dan kaki slip gaji."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Profil Perusahaan</CardTitle>
            <CardDescription>Digunakan sebagai kop dokumen pada slip gaji.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nama_perusahaan">Nama Usaha / Perusahaan</Label>
                  <Input
                    id="nama_perusahaan"
                    value={namaPerusahaan}
                    onChange={(e) => setNamaPerusahaan(e.target.value)}
                    placeholder="cth: Payflow Resto"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="alamat">Alamat</Label>
                  <Textarea
                    id="alamat"
                    rows={2}
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    placeholder="cth: Jl. Merdeka No. 1, Metro, Lampung"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="footer_slip">Catatan Kaki Slip Gaji</Label>
                  <Textarea
                    id="footer_slip"
                    rows={3}
                    value={footerSlip}
                    onChange={(e) => setFooterSlip(e.target.value)}
                    placeholder="cth: Slip ini diterbitkan secara elektronik dan sah tanpa tanda tangan basah."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="periode_evaluasi_default">Periode Evaluasi Default</Label>
                  <Select value={periodeEvaluasiDefault} onValueChange={setPeriodeEvaluasiDefault}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih periode evaluasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3_bulan">3 Bulan</SelectItem>
                      <SelectItem value="6_bulan">6 Bulan</SelectItem>
                      <SelectItem value="12_bulan">1 Tahun</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  <CardDescription>
                    Pilihan ini akan menjadi nilai default periode evaluasi untuk karyawan baru.
                  </CardDescription>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desain Slip Gaji</CardTitle>
            <CardDescription>
              Atur tampilan dan bagian apa saja yang dicantumkan pada preview, JPG, PDF, dan
              WhatsApp image.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <Label>Model Layout</Label>
                    <Select
                      value={slipTemplateConfig.layout}
                      onValueChange={(value) =>
                        updateSlipTemplateConfig("layout", value as SlipTemplateConfig["layout"])
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih layout" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="classic">Classic</SelectItem>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="borderless">Tanpa Border</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="slip_accent_color">Warna Aksen</Label>
                    <div className="flex gap-2">
                      <Input
                        id="slip_accent_color"
                        type="color"
                        value={slipTemplateConfig.accentColor}
                        onChange={(e) => updateSlipTemplateConfig("accentColor", e.target.value)}
                        className="h-10 w-14 p-1"
                      />
                      <Input
                        value={slipTemplateConfig.accentColor}
                        onChange={(e) => updateSlipTemplateConfig("accentColor", e.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Ukuran Teks</Label>
                    <Select
                      value={slipTemplateConfig.fontSize}
                      onValueChange={(value) =>
                        updateSlipTemplateConfig(
                          "fontSize",
                          value as SlipTemplateConfig["fontSize"],
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih ukuran" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Kecil</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="large">Besar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Bagian yang Dicantumkan</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {renderSlipCheckbox("showCompanyName", "Nama perusahaan")}
                    {renderSlipCheckbox("showCompanyAddress", "Alamat perusahaan")}
                    {renderSlipCheckbox("showEmployeeName", "Nama karyawan")}
                    {renderSlipCheckbox("showBranch", "Cabang")}
                    {renderSlipCheckbox("showPeriod", "Periode")}
                    {renderSlipCheckbox("showBaseSalary", "Gaji pokok")}
                    {renderSlipCheckbox("showAllowance", "Total tunjangan")}
                    {renderSlipCheckbox("showDeduction", "Total potongan")}
                    {renderSlipCheckbox("showNetSalary", "Total bersih / THP")}
                    {renderSlipCheckbox("showSignature", "Kolom tanda tangan")}
                    {renderSlipCheckbox("showFooter", "Catatan kaki")}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="left_signature_label">Label TTD Kiri</Label>
                    <Input
                      id="left_signature_label"
                      value={slipTemplateConfig.leftSignatureLabel}
                      onChange={(e) =>
                        updateSlipTemplateConfig("leftSignatureLabel", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="left_signature_name">Nama TTD Kiri</Label>
                    <Input
                      id="left_signature_name"
                      value={slipTemplateConfig.leftSignatureName}
                      onChange={(e) =>
                        updateSlipTemplateConfig("leftSignatureName", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="right_signature_label">Label TTD Kanan</Label>
                    <Input
                      id="right_signature_label"
                      value={slipTemplateConfig.rightSignatureLabel}
                      onChange={(e) =>
                        updateSlipTemplateConfig("rightSignatureLabel", e.target.value)
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan Pengaturan
          </Button>
        </div>
      </form>
    </div>
  );
}
