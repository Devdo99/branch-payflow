import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatIDR } from '@/lib/format';
import {
  ImageIcon,
  FileText,
  Send,
  Trash2,
  Eye,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import html2canvas from 'html2canvas';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export const Route = createFileRoute('/_authenticated/slip-gaji')({
  component: SlipGajiPage,
});

type SlipItem = any;

const toNumber = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const escapeHtml = (value: unknown) => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const safeFileName = (value: unknown) => {
  return String(value || 'Karyawan')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .trim();
};

const normalizeWhatsappNumber = (phone: unknown) => {
  let cleanPhone = String(phone || '').replace(/\D/g, '');

  if (!cleanPhone) return '';

  if (cleanPhone.startsWith('08')) {
    cleanPhone = `62${cleanPhone.slice(1)}`;
  }

  if (cleanPhone.startsWith('8')) {
    cleanPhone = `62${cleanPhone}`;
  }

  if (cleanPhone.startsWith('620')) {
    cleanPhone = `62${cleanPhone.slice(3)}`;
  }

  return cleanPhone;
};

const getSlipFileName = (slip: SlipItem, extension: 'jpg' | 'pdf') => {
  const nama = safeFileName(slip.employees?.nama);
  const periode = safeFileName(slip.payroll_runs?.periode || 'Periode');
  return `Slip_Gaji_${nama}_${periode}.${extension}`;
};

const getRawHtmlTemplate = (slip: SlipItem) => {
  const nama = escapeHtml(slip.employees?.nama || '-');
  const cabang = escapeHtml(slip.employees?.branches?.nama || '-');
  const periode = escapeHtml(slip.payroll_runs?.periode || '-');

  const gajiPokok = toNumber(slip.gaji_pokok);
  const totalTunjangan = toNumber(slip.total_tunjangan);
  const totalPotongan = toNumber(slip.total_potongan);
  const gajiBersih = toNumber(slip.gaji_bersih);

  return `
    <div id="slip-gaji-render" style="
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      background-color: #ffffff;
      width: 600px;
      min-height: 760px;
      padding: 40px;
      box-sizing: border-box;
      border: 1px solid #000000;
    ">
      <h1 style="
        margin: 0;
        padding-bottom: 12px;
        border-bottom: 2px solid #000000;
        text-align: center;
        text-transform: uppercase;
        font-size: 24px;
        letter-spacing: 1px;
        color: #000000;
        background-color: #ffffff;
      ">
        Slip Gaji
      </h1>

      <div style="
        margin: 24px 0;
        font-size: 14px;
        line-height: 1.7;
        color: #000000;
        background-color: #ffffff;
      ">
        <p style="margin: 4px 0;"><strong>Nama:</strong> ${nama}</p>
        <p style="margin: 4px 0;"><strong>Cabang:</strong> ${cabang}</p>
        <p style="margin: 4px 0;"><strong>Periode:</strong> ${periode}</p>
      </div>

      <table style="
        width: 100%;
        border-collapse: collapse;
        margin-top: 24px;
        font-size: 14px;
        color: #000000;
        background-color: #ffffff;
      ">
        <tbody>
          <tr style="border-bottom: 1px solid #000000;">
            <td style="padding: 12px 0;">Gaji Pokok</td>
            <td style="text-align: right; padding: 12px 0;">
              ${formatIDR(gajiPokok)}
            </td>
          </tr>

          <tr style="border-bottom: 1px solid #000000;">
            <td style="padding: 12px 0;">Tunjangan</td>
            <td style="text-align: right; padding: 12px 0;">
              ${formatIDR(totalTunjangan)}
            </td>
          </tr>

          <tr style="border-bottom: 1px solid #000000;">
            <td style="padding: 12px 0;">Potongan</td>
            <td style="text-align: right; padding: 12px 0;">
              ${formatIDR(totalPotongan)}
            </td>
          </tr>

          <tr style="border-top: 2px solid #000000;">
            <td style="
              padding: 18px 0 8px 0;
              font-weight: bold;
              font-size: 16px;
              text-transform: uppercase;
            ">
              Total Bersih
            </td>
            <td style="
              text-align: right;
              padding: 18px 0 8px 0;
              font-weight: bold;
              font-size: 16px;
            ">
              ${formatIDR(gajiBersih)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="
        margin-top: 48px;
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: #000000;
        background-color: #ffffff;
      ">
        <div style="width: 45%; text-align: center;">
          <p style="margin-bottom: 72px;">Dibuat oleh,</p>
          <p style="border-top: 1px solid #000000; padding-top: 8px;">
            Admin
          </p>
        </div>

        <div style="width: 45%; text-align: center;">
          <p style="margin-bottom: 72px;">Diterima oleh,</p>
          <p style="border-top: 1px solid #000000; padding-top: 8px;">
            ${nama}
          </p>
        </div>
      </div>

      <div style="
        margin-top: 28px;
        font-size: 11px;
        color: #000000;
        text-align: center;
        border-top: 1px solid #000000;
        padding-top: 12px;
        background-color: #ffffff;
      ">
        Dokumen ini dibuat otomatis oleh sistem penggajian.
      </div>
    </div>
  `;
};

const waitForRender = () => {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
};

const createIsolatedSlipFrame = async (slip: SlipItem) => {
  const iframe = document.createElement('iframe');

  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = '700px';
  iframe.style.height = '1000px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-1';
  iframe.setAttribute('aria-hidden', 'true');

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;

  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Gagal membuat iframe dokumen slip');
  }

  doc.open();
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          html,
          body {
            margin: 0;
            padding: 0;
            width: 700px;
            min-height: 1000px;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: hidden;
          }

          * {
            box-sizing: border-box;
            color: #000000;
            background-color: transparent;
          }

          table,
          tbody,
          tr,
          td {
            color: #000000;
            background-color: #ffffff;
          }
        </style>
      </head>
      <body>
        ${getRawHtmlTemplate(slip)}
      </body>
    </html>
  `);
  doc.close();

  await waitForRender();

  const target = doc.getElementById('slip-gaji-render') as HTMLElement | null;

  if (!target) {
    document.body.removeChild(iframe);
    throw new Error('Template slip gaji tidak ditemukan');
  }

  if (doc.fonts?.ready) {
    await doc.fonts.ready;
  }

  await waitForRender();

  return { iframe, target };
};

const downloadDataUrl = (dataUrl: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function SlipGajiPage() {
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState<string | null>(null);
  const [previewSlip, setPreviewSlip] = useState<SlipItem | null>(null);

  const {
    data: payrollItems = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['payroll_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_items')
        .select(`
          *,
          payroll_runs (*),
          employees (*, branches (*))
        `);

      if (error) throw error;

      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const { error } = await supabase
        .from('payroll_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return id;
    },
    onSuccess: () => {
      toast.success('Slip gaji berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
    },
    onError: (error) => {
      console.error(error);
      toast.error('Gagal menghapus slip gaji');
    },
  });

  const handleExportJPG = async (slip: SlipItem) => {
    setLoading(`JPG-${slip.id}`);

    let iframe: HTMLIFrameElement | null = null;

    try {
      const created = await createIsolatedSlipFrame(slip);
      iframe = created.iframe;

      const canvas = await html2canvas(created.target, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: created.target.offsetWidth,
        height: created.target.offsetHeight,
        windowWidth: 700,
        windowHeight: 1000,
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      downloadDataUrl(dataUrl, getSlipFileName(slip, 'jpg'));

      toast.success('JPG slip gaji berhasil diunduh');
    } catch (error) {
      console.error('Gagal membuat JPG:', error);
      toast.error('Gagal membuat JPG slip gaji');
    } finally {
      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }

      setLoading(null);
    }
  };

  const handleExportPDF = async (slip: SlipItem) => {
  setLoading(`PDF-${slip.id}`);

  let iframe: HTMLIFrameElement | null = null;

  try {
    const created = await createIsolatedSlipFrame(slip);
    iframe = created.iframe;

    const canvas = await html2canvas(created.target, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: created.target.offsetWidth,
      height: created.target.offsetHeight,
      windowWidth: 700,
      windowHeight: 1000,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Jika tinggi gambar masih muat di 1 halaman
    if (imgHeight <= usableHeight) {
      pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
    } else {
      // Jika tinggi gambar lebih panjang, tetap diperkecil agar masuk A4
      const scaledHeight = usableHeight;
      const scaledWidth = (canvas.width * scaledHeight) / canvas.height;
      const x = (pageWidth - scaledWidth) / 2;

      pdf.addImage(imgData, 'JPEG', x, margin, scaledWidth, scaledHeight);
    }

    pdf.save(getSlipFileName(slip, 'pdf'));

    toast.success('PDF slip gaji berhasil diunduh');
  } catch (error) {
    console.error('Gagal membuat PDF:', error);
    toast.error('Gagal membuat PDF slip gaji');
  } finally {
    if (iframe && document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }

    setLoading(null);
  }
};

  const handleWAText = (slip: SlipItem) => {
    const phone = normalizeWhatsappNumber(slip.employees?.whatsapp);

    if (!phone) {
      toast.error('Nomor WhatsApp karyawan belum diisi');
      return;
    }

    const nama = slip.employees?.nama || '';
    const periode = slip.payroll_runs?.periode || '-';
    const gajiBersih = formatIDR(toNumber(slip.gaji_bersih));

    const msg = `Halo ${nama}, berikut ringkasan gaji Anda periode ${periode}.\n\nTHP: ${gajiBersih}`;

    window.open(
      `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`,
      '_blank'
    );
  };

  const handleWAImage = async (slip: SlipItem) => {
    const phone = normalizeWhatsappNumber(slip.employees?.whatsapp);

    if (!phone) {
      toast.error('Nomor WhatsApp karyawan belum diisi');
      return;
    }

    setLoading(`WA-IMG-${slip.id}`);

    const waTab = window.open('', '_blank');
    let iframe: HTMLIFrameElement | null = null;

    try {
      const created = await createIsolatedSlipFrame(slip);
      iframe = created.iframe;

      const canvas = await html2canvas(created.target, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: created.target.offsetWidth,
        height: created.target.offsetHeight,
        windowWidth: 700,
        windowHeight: 1000,
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      downloadDataUrl(dataUrl, getSlipFileName(slip, 'jpg'));

      const nama = slip.employees?.nama || '';
      const periode = slip.payroll_runs?.periode || '-';

      const msg =
        `Halo ${nama}, berikut slip gaji Anda periode ${periode}.\n\n` +
        `File JPG slip gaji sudah terunduh dari sistem. Silakan lampirkan gambar slip gaji tersebut di chat ini.`;

      const waUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;

      if (waTab) {
        waTab.location.href = waUrl;
      } else {
        window.open(waUrl, '_blank');
      }

      toast.success('JPG diunduh dan WhatsApp Web dibuka');
    } catch (error) {
      console.error('Gagal membuat slip untuk WA:', error);
      toast.error('Gagal membuat slip gaji untuk WhatsApp');

      if (waTab) {
        waTab.close();
      }
    } finally {
      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }

      setLoading(null);
    }
  };

  const isButtonLoading = (key: string) => loading === key;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Slip Gaji"
        description="Kelola, unduh, dan kirim slip gaji karyawan"
      />

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Karyawan</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead className="text-right">THP</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data slip gaji...
                  </div>
                </TableCell>
              </TableRow>
            )}

            {isError && !isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-red-500">
                  Gagal memuat data slip gaji.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && payrollItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Belum ada data slip gaji.
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !isError &&
              payrollItems.map((slip: SlipItem) => {
                const jpgLoading = isButtonLoading(`JPG-${slip.id}`);
                const pdfLoading = isButtonLoading(`PDF-${slip.id}`);
                const waImageLoading = isButtonLoading(`WA-IMG-${slip.id}`);

                return (
                  <TableRow key={slip.id}>
                    <TableCell className="font-medium">
                      {slip.employees?.nama || '-'}
                    </TableCell>

                    <TableCell>
                      {slip.employees?.branches?.nama || '-'}
                    </TableCell>

                    <TableCell>
                      {slip.payroll_runs?.periode || '-'}
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      {formatIDR(toNumber(slip.gaji_bersih))}
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewSlip(slip)}
                          title="Preview slip"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportJPG(slip)}
                          disabled={!!loading}
                          title="Download JPG"
                        >
                          {jpgLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportPDF(slip)}
                          disabled={!!loading}
                          title="Download PDF"
                        >
                          {pdfLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWAText(slip)}
                          disabled={!!loading}
                          title="Kirim WA teks"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWAImage(slip)}
                          disabled={!!loading}
                          title="Download JPG dan buka WhatsApp Web"
                        >
                          {waImageLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(slip.id)}
                          disabled={!!loading}
                          title="Hapus slip"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!previewSlip} onOpenChange={() => setPreviewSlip(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Slip Gaji</DialogTitle>
          </DialogHeader>

          {previewSlip && (
            <div className="flex justify-center overflow-auto rounded-md bg-white p-4">
              <div
                dangerouslySetInnerHTML={{
                  __html: getRawHtmlTemplate(previewSlip),
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}