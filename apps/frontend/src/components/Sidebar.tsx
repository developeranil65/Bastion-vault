'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  IconAccess,
  IconDashboard,
  IconKey,
  IconLogOut,
  IconScroll,
  IconSettings,
} from '@/components/kv-icons';

const navItems = [
  { href: '/dashboard', label: 'Overview', Icon: IconDashboard },
  { href: '/projects', label: 'Projects', Icon: IconDashboard },
  { href: '/secrets', label: 'Secrets', Icon: IconKey },
  { href: '/audit', label: 'Audit', Icon: IconScroll },
  { href: '/identities', label: 'Access', Icon: IconAccess },
  { href: '/settings', label: 'Settings', Icon: IconSettings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'BV';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
          }}
        >
          <div
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(145deg, var(--surface-container-high), var(--surface-container-lowest))',
              border: '1px solid var(--border-subtle)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--primary-fixed-dim)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            BV
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Bastion Vault</h2>
            <span>Secrets control plane</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className={active ? 'active' : ''}>
              <span className="nav-icon" aria-hidden>
                <Icon size={18} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="name">{user?.email?.split('@')[0] || 'User'}</div>
          <div className="role">{user?.role?.toLowerCase() || 'member'}</div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="icon-btn"
          title="Sign out"
          aria-label="Sign out"
        >
          <IconLogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
