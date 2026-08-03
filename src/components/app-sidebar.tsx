import type { ComponentType } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  Plus,
  Minus,
  Calculator,
  FileText,
  MessageSquare,
  Settings2,
  Landmark,
  BarChart3,
  Settings,
  LogOut,
  Briefcase,
  ShieldCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  UserX,
  HeartHandshake,
  ChevronRight,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";

type SidebarItem = {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
};

type SidebarGroup = {
  label: string;
  items: SidebarItem[];
  hrSubmenu?: SidebarItem[];
};

const groups: SidebarGroup[] = [
  {
    label: "Ringkasan",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Master Data",
    items: [
      { title: "Cabang", url: "/cabang", icon: Building2 },
      { title: "Karyawan", url: "/karyawan", icon: Users },
      { title: "Master Jabatan", url: "/jabatan", icon: Briefcase },
      { title: "Gaji Pokok", url: "/gaji-pokok", icon: Wallet },
      { title: "Tunjangan", url: "/tunjangan", icon: Plus },
      { title: "Potongan", url: "/potongan", icon: Minus },
      { title: "Rekening Bank", url: "/rekening-bank", icon: Landmark },
    ],
  },
  {
    label: "Penggajian",
    items: [
      { title: "Proses Gaji", url: "/proses-gaji", icon: Calculator },
      { title: "Slip Gaji", url: "/slip-gaji", icon: FileText },
      { title: "Ringkasan WhatsApp", url: "/ringkasan-whatsapp", icon: MessageSquare },
      { title: "Format WhatsApp", url: "/format-whatsapp", icon: Settings2 },
    ],
  },
  {
    label: "HR",
    items: [],
    hrSubmenu: [
      { title: "Kalender Cuti", url: "/hr/kalender-cuti", icon: CalendarDays },
      { title: "Rekap Absen", url: "/hr/rekap-absen", icon: ClipboardCheck },
      { title: "Request Cuti", url: "/hr/request-cuti", icon: ClipboardList },
      { title: "Resign Karyawan", url: "/hr/resign", icon: UserX },
    ],
  },
  {
    label: "Lain-lain",
    items: [
      { title: "Laporan", url: "/laporan", icon: BarChart3 },
      { title: "Pengaturan", url: "/pengaturan", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();

  const getInitials = (email: string) => {
    return email ? email.charAt(0).toUpperCase() : "A";
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/30 bg-slate-950 text-slate-100 font-sans"
    >
      <SidebarHeader className="border-b border-sidebar-border/30 py-4 px-3 bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md shadow-emerald-500/10">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-900">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-tight text-white">
                Pay<span className="text-emerald-400">Flow</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Premium Admin
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-slate-950 py-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {groups.map((g) => (
          <SidebarGroup key={g.label} className="py-2">
            {!collapsed && (
              <SidebarGroupLabel className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {g.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="px-1.5 space-y-0.5">
                {g.items.map((item) => {
                  const active = path === item.url || path.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group ${
                          active
                            ? "bg-emerald-500/10 text-emerald-300 font-medium border-l-2 border-emerald-400"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                        }`}
                      >
                        <Link to={item.url} className="flex items-center w-full">
                          <item.icon
                            className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                              active
                                ? "text-emerald-400"
                                : "text-slate-400 group-hover:text-slate-300"
                            }`}
                          />
                          {!collapsed && <span className="text-sm">{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {g.hrSubmenu && (
                  <Collapsible
                    asChild
                    defaultOpen={path.startsWith("/hr")}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip="HR / Kepegawaian"
                          isActive={path.startsWith("/hr")}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group ${
                            path.startsWith("/hr")
                              ? "bg-emerald-500/10 text-emerald-300 font-medium border-l-2 border-emerald-400"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                          }`}
                        >
                          <HeartHandshake
                            className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                              path.startsWith("/hr")
                                ? "text-emerald-400"
                                : "text-slate-400 group-hover:text-slate-300"
                            }`}
                          />
                          {!collapsed && (
                            <>
                              <span className="text-sm">HR / Kepegawaian</span>
                              <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </>
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="px-2">
                          {g.hrSubmenu.map((sub) => {
                            const subActive = path === sub.url;
                            return (
                              <SidebarMenuItem key={sub.url}>
                                <SidebarMenuButton
                                  asChild
                                  isActive={subActive}
                                  tooltip={sub.title}
                                  className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                                    subActive
                                      ? "bg-emerald-500/10 text-emerald-300 font-medium"
                                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                                  }`}
                                >
                                  <Link to={sub.url} className="flex items-center w-full">
                                    <sub.icon
                                      className={`h-4 w-4 shrink-0 ${subActive ? "text-emerald-400" : "text-slate-500"}`}
                                    />
                                    {!collapsed && <span className="text-sm">{sub.title}</span>}
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/30 bg-slate-950 p-3 space-y-2">
        {!collapsed && user && (
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/50 border border-slate-900/30">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold shadow-inner">
              {getInitials(user.email || "")}
            </div>
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-xs font-semibold text-slate-200 truncate">Administrator</span>
              <span className="text-[10px] text-slate-400 truncate">{user.email}</span>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => signOut()}
              tooltip="Keluar"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition-all duration-200"
            >
              <LogOut className="h-4.5 w-4.5" />
              {!collapsed && <span className="text-sm font-medium">Keluar</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
