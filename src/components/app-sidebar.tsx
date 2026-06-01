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
  Briefcase, // Briefcase sudah ditambahkan di sini
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";

const groups = [
  {
    label: "Ringkasan",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Master Data",
    items: [
      { title: "Cabang", url: "/cabang", icon: Building2 },
      { title: "Karyawan", url: "/karyawan", icon: Users },
      { title: "Master Jabatan", url: "/jabatan", icon: Briefcase }, // Menu baru ditambahkan di sini
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-semibold">
            PG
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Penggajian</span>
              <span className="text-[11px] text-muted-foreground">Admin</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const active = path === item.url || path.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="px-2 pt-1 pb-1 text-[11px] text-muted-foreground truncate">
            {user.email}
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()} tooltip="Keluar">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Keluar</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
