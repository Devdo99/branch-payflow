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
  showAllowanceDetails: boolean;
  showDeduction: boolean;
  showDeductionDetails: boolean;
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
  showAllowanceDetails: true,
  showDeduction: true,
  showDeductionDetails: true,
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

const isMissingColumnError = (error: unknown, columnName: string) => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: string }).code : "";
  const message = "message" in error ? String((error as { message?: string }).message) : "";
  return code === "42703" && message.includes(columnName);
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
      const cleanSlipTemplateConfig = {
        ...defaultSlipTemplateConfig,
        ...slipTemplateConfig,
        accentColor: /^#[0-9a-fA-F]{6}$/.test(slipTemplateConfig.accentColor)
          ? slipTemplateConfig.accentColor
          : defaultSlipTemplateConfig.accentColor,
      };

      const payload = {
        id: 1,
        nama_perusahaan: namaPerusahaan || "Nama Perusahaan",
        alamat,
        footer_slip: footerSlip,
        slip_template_config: cleanSlipTemplateConfig,
      };

      const { error } = await supabase.from("app_settings").upsert(
        {
          ...payload,
          periode_evaluasi_default: periodeEvaluasiDefault,
        } as any,
        { onConflict: "id" },
      );

      if (isMissingColumnError(error, "periode_evaluasi_default")) {
        const { error: fallbackError } = await supabase
          .from("app_settings")
          .upsert(payload as any, { onConflict: "id" });

        if (fallbackError) throw fallbackError;
        return;
      }

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Pengaturan disimpan.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewAccentColor = /^#[0-9a-fA-F]{6}$/.test(slipTemplateConfig.accentColor)
    ? slipTemplateConfig.accentColor
    : "#000000";
  const previewFontSize =
    slipTemplateConfig.fontSize === "small"
      ? "text-xs"
      : slipTemplateConfig.fontSize === "large"
        ? "text-base"
        : "text-sm";
  const isCompactPreview = slipTemplateConfig.layout === "compact";
  const isBorderlessPreview = slipTemplateConfig.layout === "borderless";

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
                    {renderSlipCheckbox("showAllowanceDetails", "Rincian tunjangan")}
                    {renderSlipCheckbox("showDeduction", "Total potongan")}
                    {renderSlipCheckbox("showDeductionDetails", "Rincian potongan")}
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

                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Preview Slip Aktif</div>
                      <div className="text-xs text-slate-500">
                        Contoh ini mengikuti layout dan bagian yang dicentang.
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                      {slipTemplateConfig.layout}
                    </span>
                  </div>

                  <div className="overflow-auto rounded-md bg-white p-3">
                    <div
                      className={`mx-auto w-full max-w-[520px] bg-white text-slate-950 ${previewFontSize}`}
                      style={{
                        border: isBorderlessPreview ? "0" : `1px solid ${previewAccentColor}`,
                        padding: isCompactPreview ? 20 : 28,
                      }}
                    >
                      {(slipTemplateConfig.showCompanyName ||
                        slipTemplateConfig.showCompanyAddress) && (
                        <div
                          className="mb-4 border-b pb-3 text-center"
                          style={{ borderColor: previewAccentColor }}
                        >
                          {slipTemplateConfig.showCompanyName && (
                            <div className="text-lg font-bold uppercase tracking-wide">
                              {namaPerusahaan || "Nama Perusahaan"}
                            </div>
                          )}
                          {slipTemplateConfig.showCompanyAddress && (
                            <div className="mt-1 whitespace-pre-line text-xs text-slate-600">
                              {alamat || "Alamat perusahaan"}
                            </div>
                          )}
                        </div>
                      )}

                      <div
                        className="text-center text-lg font-bold uppercase tracking-wide"
                        style={{ color: previewAccentColor }}
                      >
                        Slip Gaji
                      </div>

                      {(slipTemplateConfig.showEmployeeName ||
                        slipTemplateConfig.showBranch ||
                        slipTemplateConfig.showPeriod) && (
                        <div className="my-4 space-y-1 text-slate-700">
                          {slipTemplateConfig.showEmployeeName && (
                            <div>
                              <span className="font-semibold">Nama:</span> Karyawan Contoh
                            </div>
                          )}
                          {slipTemplateConfig.showBranch && (
                            <div>
                              <span className="font-semibold">Cabang:</span> Cabang Utama
                            </div>
                          )}
                          {slipTemplateConfig.showPeriod && (
                            <div>
                              <span className="font-semibold">Periode:</span> 2026-05
                            </div>
                          )}
                        </div>
                      )}

                      {(slipTemplateConfig.showBaseSalary ||
                        slipTemplateConfig.showAllowance ||
                        slipTemplateConfig.showDeduction ||
                        slipTemplateConfig.showNetSalary) && (
                        <div className="mt-4 divide-y divide-slate-200">
                          {slipTemplateConfig.showBaseSalary && (
                            <div className="flex justify-between py-2">
                              <span>Gaji Pokok</span>
                              <span className="font-medium">Rp 3.000.000</span>
                            </div>
                          )}
                          {slipTemplateConfig.showAllowance && (
                            <div className="py-2">
                              <div
                                className="mb-1 text-xs font-bold uppercase"
                                style={{ color: previewAccentColor }}
                              >
                                Tunjangan
                              </div>
                              {slipTemplateConfig.showAllowanceDetails && (
                                <div className="space-y-1 pb-1 text-xs text-slate-600">
                                  <div className="flex justify-between">
                                    <span>Tunjangan Jabatan</span>
                                    <span>Rp 300.000</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Uang Makan</span>
                                    <span>Rp 200.000</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex justify-between font-medium">
                                <span>Total Tunjangan</span>
                                <span>Rp 500.000</span>
                              </div>
                            </div>
                          )}
                          {slipTemplateConfig.showDeduction && (
                            <div className="py-2">
                              <div
                                className="mb-1 text-xs font-bold uppercase"
                                style={{ color: previewAccentColor }}
                              >
                                Potongan
                              </div>
                              {slipTemplateConfig.showDeductionDetails && (
                                <div className="space-y-1 pb-1 text-xs text-slate-600">
                                  <div className="flex justify-between">
                                    <span>Telat</span>
                                    <span>Rp 50.000</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Kasbon</span>
                                    <span>Rp 100.000</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex justify-between font-medium">
                                <span>Total Potongan</span>
                                <span>Rp 150.000</span>
                              </div>
                            </div>
                          )}
                          {slipTemplateConfig.showNetSalary && (
                            <div
                              className="mt-2 flex justify-between border-t-2 py-3 font-bold"
                              style={{ borderColor: previewAccentColor }}
                            >
                              <span>Total Bersih</span>
                              <span>Rp 3.350.000</span>
                            </div>
                          )}
                        </div>
                      )}

                      {slipTemplateConfig.showSignature && (
                        <div className="mt-8 grid grid-cols-2 gap-6 text-center text-xs text-slate-700">
                          <div>
                            <div className="mb-12">
                              {slipTemplateConfig.leftSignatureLabel || "Dibuat oleh,"}
                            </div>
                            <div
                              className="border-t pt-2"
                              style={{ borderColor: previewAccentColor }}
                            >
                              {slipTemplateConfig.leftSignatureName || "Admin"}
                            </div>
                          </div>
                          <div>
                            <div className="mb-12">
                              {slipTemplateConfig.rightSignatureLabel || "Diterima oleh,"}
                            </div>
                            <div
                              className="border-t pt-2"
                              style={{ borderColor: previewAccentColor }}
                            >
                              Karyawan Contoh
                            </div>
                          </div>
                        </div>
                      )}

                      {slipTemplateConfig.showFooter && (
                        <div
                          className="mt-6 border-t pt-3 text-center text-xs text-slate-500"
                          style={{ borderColor: previewAccentColor }}
                        >
                          {footerSlip || "Dokumen ini dibuat otomatis oleh sistem penggajian."}
                        </div>
                      )}
                    </div>
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
