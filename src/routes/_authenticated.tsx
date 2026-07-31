import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Memuat...
      </div>
    );
  }

  // Jika tidak loading dan tidak ada session, langsung blokir render
  // dan alihkan (redirect) secara deklaratif tanpa menunggu useEffect
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background/50">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Premium Glassmorphic Header */}
          <header className="h-14 flex items-center border-b border-border/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 gap-4 sticky top-0 z-20 justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-1.5 transition-colors" />
              <div className="h-4 w-[1px] bg-border hidden sm:block" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:inline">
                Sistem Portal Penggajian • PayFlow
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm">
                Server Online
              </span>
            </div>
          </header>
          
          <main className="flex-1 min-w-0 animate-fade-in duration-300">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
