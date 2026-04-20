'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { IconChevronRight } from '@/components/kv-icons';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Overview',
  projects: 'Projects',
  secrets: 'Secrets',
  audit: 'Audit',
  identities: 'Access',
  settings: 'Settings',
};

export default function AppTopBar() {
  const pathname = usePathname();
  const { user, tenants } = useAuth();

  const parts = pathname.split('/').filter(Boolean);
  const section = parts[0] || 'dashboard';
  const title = ROUTE_LABELS[section] || section;

  const tenantName =
    tenants.find(t => t.id === user?.tenantId)?.name ||
    (user?.tenantId ? `Project ${user.tenantId.slice(0, 8)}…` : 'Project');

  return (
    <header className="app-topbar">
      <div className="kv-breadcrumb">
        <Link href="/dashboard">Bastion Vault</Link>
        <IconChevronRight aria-hidden className="opacity-50" />
        <span style={{ color: 'var(--on-surface-variant)' }}>{tenantName}</span>
        <IconChevronRight aria-hidden className="opacity-50" />
        <strong>{title}</strong>
      </div>
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--on-surface-variant)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {user?.email}
      </div>
    </header>
  );
}
