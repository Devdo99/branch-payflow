import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/potongan")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Potongan" description="Modul sedang disiapkan." />
      <div className="p-6">
        <div className="rounded-md border border-dashed border-border bg-card p-10 text-center">
          <Construction className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Modul sedang disiapkan</p>
          <p className="mt-1 text-xs text-muted-foreground">Akan dibangun pada iterasi berikutnya.</p>
        </div>
      </div>
    </>
  );
}
