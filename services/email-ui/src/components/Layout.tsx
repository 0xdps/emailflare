import React from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import {
  LayoutDashboard, Globe, FileText, Key, ScrollText, LogOut, FlaskConical,
  MonitorDot, BookOpen, Github, ExternalLink, ShieldOff, Settings2, Mailbox,
} from 'lucide-react';
import api from '../api';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';

// ─── Brand logo ───────────────────────────────────────────────────────────────

function AppLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ef-bg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#9a3412" />
          <stop offset="55%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#ef-bg)" />
      <path d="M53 11 L9 28 L23 38 Z" fill="white" />
      <path d="M53 11 L23 38 L9 53 Z" fill="white" opacity="0.82" />
    </svg>
  );
}

// ─── Navigation definition ────────────────────────────────────────────────────

const IS_CLOUDFLARE = import.meta.env.VITE_DEPLOYMENT_MODE === 'cloudflare';

const navSections = [
  {
    label: 'Monitor',
    items: [
      { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
      { to: '/logs',         label: 'Logs',         icon: ScrollText },
      { to: '/test-emails',  label: 'Test Mailbox', icon: Mailbox },
      { to: '/suppressions', label: 'Suppressions', icon: ShieldOff },
    ],
  },
  {
    label: 'Send',
    items: [
      { to: '/templates',  label: 'Templates',  icon: FileText },
      { to: '/playground', label: 'Playground', icon: FlaskConical },
    ],
  },
  {
    label: 'Configure',
    items: [
      { to: '/domains',  label: 'Domains',  icon: Globe },
      { to: '/keys',     label: 'API Keys', icon: Key },
      // Settings page is only relevant for standalone (Railway) deployments.
      // The CF Worker handles bounces natively so the bounce-forwarder setup is hidden.
      ...(!IS_CLOUDFLARE ? [{ to: '/settings', label: 'Settings', icon: Settings2 }] : []),
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function AppSidebar({ onLogout }: { onLogout: () => void }) {
  return (
    <Sidebar collapsible="none" className="border-r border-sidebar-border h-svh">
      {/* Brand header */}
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <AppLogo size={32} />
          <div>
            <p className="text-[14px] font-bold text-foreground tracking-tight leading-none">
              EmailFlare
            </p>
            <p className="text-[11px] text-muted-foreground mt-[5px] leading-none">
              Admin console
            </p>
          </div>
        </div>
      </SidebarHeader>

      {/* Nav sections */}
      <SidebarContent className="px-3 py-4 flex flex-col gap-5 overflow-y-auto">
        {navSections.map(section => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.1em] px-2 mb-1.5">
              {section.label}
            </p>
            <SidebarMenu className="gap-0.5">
              {section.items.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    render={<Link to={to} activeOptions={{ exact: to === '/' }} />}
                    className="h-8 flex items-center gap-2.5 px-2.5 text-[13px] font-medium
                      text-muted-foreground rounded-md
                      hover:bg-muted hover:text-foreground
                      [&.active]:bg-sidebar-accent [&.active]:text-sidebar-accent-foreground [&.active]:font-semibold"
                  >
                    <Icon size={14} className="flex-shrink-0" />
                    {label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3 gap-0.5">
        {/* External links */}
        <div className="mb-1">
          <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.1em] px-2 mb-1.5">
            Resources
          </p>
          <SidebarMenu className="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href="https://emailflare.dev/docs" target="_blank" rel="noopener noreferrer" />}
                className="h-8 flex items-center gap-2.5 px-2.5 text-[13px] font-medium rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <BookOpen size={14} className="flex-shrink-0" />
                <span className="flex-1">API Docs</span>
                <ExternalLink size={11} className="text-muted-foreground/40" />
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href="https://github.com/0xdps/emailflare" target="_blank" rel="noopener noreferrer" />}
                className="h-8 flex items-center gap-2.5 px-2.5 text-[13px] font-medium rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Github size={14} className="flex-shrink-0" />
                <span className="flex-1">GitHub</span>
                <ExternalLink size={11} className="text-muted-foreground/40" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>

        <div className="border-t border-sidebar-border pt-3 flex items-center gap-2.5 px-2.5 py-2 mb-0.5">
          <div className="size-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
            <MonitorDot size={12} className="text-white" />
          </div>
          <div className="leading-none min-w-0">
            <p className="text-[12.5px] font-semibold text-foreground">Admin</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-[10.5px] text-muted-foreground">Live</span>
            </div>
          </div>
        </div>

        <SidebarMenuButton
          onClick={onLogout}
          className="h-8 flex items-center gap-2.5 px-2.5 text-[13px] font-medium rounded-md
            text-muted-foreground hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={14} className="flex-shrink-0" />
          Sign out
        </SidebarMenuButton>

        {/* Developer credit */}
        <p className="text-[10.5px] text-muted-foreground/40 px-2.5 pt-2 pb-0.5">
          Built by{' '}
          <a href="https://dps.md" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
            0xdps
          </a>
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleLogout() {
    await api.post('/api/auth/logout').catch(() => {});
    router.navigate({ to: '/login' });
  }

  return (
    <SidebarProvider>
      <AppSidebar onLogout={handleLogout} />
      <SidebarInset className="bg-background flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
