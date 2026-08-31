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
  FileBarChart2,
  UserX,
  HeartHandshake,
  ChevronRight,
  CalendarClock,
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

type SidebarGroupConfig = {
  label: string;
  items: SidebarItem[];
  hrSubmenu?: SidebarItem[];
};

const groups: SidebarGroupConfig[] = [
  {
    label: "Ringkasan",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Master Data",
    items: [
      { title: "Cabang", url: "/cabang", icon: Building2 },
      { title: "Karyawan", url: "/karyawan", icon: Users },
      { title: "Jabatan", url: "/jabatan", icon: Briefcase },
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
      { title: "Ringkasan WA", url: "/ringkasan-whatsapp", icon: MessageSquare },
      { title: "Format WA", url: "/format-whatsapp", icon: Settings2 },
    ],
  },
  {
    label: "HR",
    items: [],
    hrSubmenu: [
      { title: "Kalender Cuti", url: "/hr/kalender-cuti", icon: CalendarDays },
      { title: "Rekap Cuti", url: "/hr/rekap-cuti", icon: FileBarChart2 },
      { title: "Rekap Absen", url: "/hr/rekap-absen", icon: ClipboardCheck },
      { title: "Jadwal Kerja", url: "/hr/jadwal-kerja", icon: CalendarClock },
      { title: "Request Cuti", url: "/hr/request-cuti", icon: ClipboardList },
      { title: "Resign", url: "/hr/resign", icon: UserX },
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
      className="border-r border-white/[0.06] bg-[#0a0f1a] text-slate-200 font-sans"
    >
      {/* ── Header / Logo ── */}
      <SidebarHeader className="border-b border-white/[0.06] py-3 px-3 bg-[#0a0f1a]">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 opacity-90" />
            <div className="relative flex h-full w-full items-center justify-center rounded-[7px] bg-[#0a0f1a]/80">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
            </div>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-extrabold tracking-tight text-white">
                Pay<span className="text-emerald-400">Flow</span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-medium mt-0.5">
                Payroll System
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* ── Navigation Content ── */}
      <SidebarContent className="bg-[#0a0f1a] py-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {groups.map((g) => (
          <SidebarGroup key={g.label} className="py-1">
            {!collapsed && (
              <SidebarGroupLabel className="px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
                {g.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="px-2 space-y-px">
                {g.items.map((item) => {
                  const active = path === item.url || path.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className={`relative w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] transition-all duration-150 group ${
                          active
                            ? "bg-emerald-500/[0.08] text-emerald-300 font-medium"
                            : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
                        }`}
                      >
                        <Link to={item.url} className="flex items-center w-full gap-2.5">
                          <div className={`relative flex items-center justify-center ${active ? "" : ""}`}>
                            {active && (
                              <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-emerald-400" />
                            )}
                            <item.icon
                              className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
                                active
                                  ? "text-emerald-400"
                                  : "text-slate-600 group-hover:text-slate-400"
                              }`}
                            />
                          </div>
                          {!collapsed && <span>{item.title}</span>}
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
                          className={`relative w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] transition-all duration-150 group ${
                            path.startsWith("/hr")
                              ? "bg-emerald-500/[0.08] text-emerald-300 font-medium"
                              : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
                          }`}
                        >
                          <div className="relative flex items-center justify-center">
                            {path.startsWith("/hr") && (
                              <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-emerald-400" />
                            )}
                            <HeartHandshake
                              className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
                                path.startsWith("/hr")
                                  ? "text-emerald-400"
                                  : "text-slate-600 group-hover:text-slate-400"
                              }`}
                            />
                          </div>
                          {!collapsed && (
                            <>
                              <span className="flex-1 text-left">HR / Kepegawaian</span>
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </>
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="ml-6 pl-2 border-l border-white/[0.06] mt-0.5">
                          {g.hrSubmenu.map((sub) => {
                            const subActive = path === sub.url;
                            return (
                              <SidebarMenuItem key={sub.url}>
                                <SidebarMenuButton
                                  asChild
                                  isActive={subActive}
                                  tooltip={sub.title}
                                  className={`w-full flex items-center gap-2 px-2 py-[5px] rounded-md text-[11px] transition-all duration-150 ${
                                    subActive
                                      ? "bg-emerald-500/[0.08] text-emerald-300 font-medium"
                                      : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
                                  }`}
                                >
                                  <Link to={sub.url} className="flex items-center w-full gap-2">
                                    <sub.icon
                                      className={`h-3.5 w-3.5 shrink-0 ${
                                        subActive ? "text-emerald-400" : "text-slate-600"
                                      }`}
                                    />
                                    {!collapsed && <span>{sub.title}</span>}
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

      {/* ── Footer / User Info ── */}
      <SidebarFooter className="border-t border-white/[0.06] bg-[#0a0f1a] p-2 space-y-1.5">
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
              {getInitials(user.email || "")}
            </div>
            <div className="flex flex-col min-w-0 leading-none">
              <span className="text-[11px] font-semibold text-slate-300 truncate">Admin</span>
              <span className="text-[9px] text-slate-500 truncate mt-0.5">{user.email}</span>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => signOut()}
              tooltip="Keluar"
              className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-slate-500 hover:text-rose-400 hover:bg-rose-500/[0.05] transition-all duration-150"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="font-medium">Keluar</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
