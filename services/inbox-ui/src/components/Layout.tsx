import React, { useEffect, useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import {
  LayoutDashboard, Globe, FileText, Key, ScrollText, LogOut, FlaskConical,
  BookOpen, Github, ExternalLink, Inbox, Users, ListOrdered, Mail,
} from 'lucide-react';
import api, { me, User } from '../api';

// Paths accessible to all roles (member, admin, super-admin)
const MEMBER_PATHS = ['/inbox', '/inbox/sequences', '/inbox/settings'];

// ─── Logo ─────────────────────────────────────────────────────────────────────

function AppLogo({ size = 28 }: { size?: number }) {
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

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  to, icon: Icon, label, badge, exact = false,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact || to === '/' }}
      className="flex items-center gap-2.5 h-[33px] px-2.5 rounded-md text-[13px] font-medium
        text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors
        [&.active]:text-orange-700 [&.active]:bg-orange-50 [&.active]:font-semibold"
    >
      <Icon size={14} className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] font-semibold bg-orange-500 text-white rounded-full min-w-[16px] h-[15px] flex items-center justify-center px-1 tabular-nums">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function NavDivider() {
  return <div className="h-px bg-border mx-2 my-1.5" />;
}

function NavSection({ label }: { label: string }) {
  return (
    <p className="px-2.5 pt-3 pb-0.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider select-none">
      {label}
    </p>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    me().then(u => {
      setUser(u);
      // Redirect members away from admin-only paths
      if (u.role === 'member') {
        const path = window.location.pathname;
        const isMemberPath = MEMBER_PATHS.some(p => path === p || path.startsWith(p + '/'));
        if (!isMemberPath) {
          router.navigate({ to: '/inbox' });
        }
      }
    }).catch(() => {});
  }, []);

  async function handleLogout() {
    await api.post('/api/auth/logout').catch(() => {});
    router.navigate({ to: '/login' });
  }

  const role       = user?.role;
  const isAdmin    = role === 'admin' || role === 'super-admin';
  const isSuperAdmin = role === 'super-admin';
  const initials   = user?.name
    ? user.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ── */}
      <div className="w-[212px] shrink-0 h-full flex flex-col border-r border-border bg-sidebar">

        {/* Brand */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border shrink-0">
          <AppLogo size={28} />
          <div className="leading-none">
            <p className="text-[13.5px] font-bold text-foreground tracking-tight">EmailFlare</p>
            <p className="text-[10.5px] text-muted-foreground mt-[3px]">Inbox</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0">

          {/* ── Inbox (all roles) ── */}
          <NavSection label="Inbox" />
          <NavItem to="/inbox" icon={Mail} label="People" />
          <NavItem to="/inbox/sequences" icon={ListOrdered} label="Sequences" />
          <NavItem to="/inbox/settings" icon={Inbox} label="Inboxes" />

          {/* ── Admin (super-admin only) ── */}
          {isSuperAdmin && (
            <>
              <NavSection label="Admin" />
              <NavItem to="/settings/users" icon={Users} label="Users" />
            </>
          )}

          {/* ── Email API (admin + super-admin) ── */}
          {isAdmin && (
            <>
              <NavSection label="Email API" />
              <NavItem to="/" exact icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="/logs" icon={ScrollText} label="Logs" />
              <NavItem to="/templates" icon={FileText} label="Templates" />
              <NavItem to="/playground" icon={FlaskConical} label="Playground" />
              <NavDivider />
              <NavItem to="/domains" icon={Globe} label="Domains" />
              <NavItem to="/keys" icon={Key} label="API Keys" />
              <NavItem to="/lists" icon={Users} label="Unsubscribe" />
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-2 py-2 shrink-0">
          <a
            href="https://emailflare.dev/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 h-[33px] px-2.5 rounded-md text-[12.5px] font-medium text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <BookOpen size={13} className="shrink-0" />
            <span className="flex-1">API Docs</span>
            <ExternalLink size={10} className="opacity-50" />
          </a>
          <a
            href="https://github.com/0xdps/emailflare"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 h-[33px] px-2.5 rounded-md text-[12.5px] font-medium text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <Github size={13} className="shrink-0" />
            <span className="flex-1">GitHub</span>
            <ExternalLink size={10} className="opacity-50" />
          </a>

          <NavDivider />

          {/* User row */}
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-md">
            <div className="size-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
              <span className="text-[9.5px] font-bold text-orange-700">{initials}</span>
            </div>
            <div className="flex-1 min-w-0 leading-none">
              <p className="text-[12px] font-semibold text-foreground truncate">{user?.name ?? '—'}</p>
              <p className="text-[10.5px] text-muted-foreground mt-[3px] truncate">{user?.email ?? ''}</p>
            </div>
            {isSuperAdmin && (
              <span className="text-[9px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 shrink-0">
                owner
              </span>
            )}
            {role === 'admin' && (
              <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1 py-0.5 shrink-0">
                admin
              </span>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 h-[33px] px-2.5 rounded-md text-[12.5px] font-medium
              text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={13} className="shrink-0" />
            Sign out
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-background">
        {children}
      </div>
    </div>
  );
}
