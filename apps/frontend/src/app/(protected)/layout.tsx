'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import AppTopBar from '@/components/AppTopBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="auth-page">
        <div style={{ color: 'var(--primary-fixed-dim)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
          Initializing control plane…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <AppTopBar />
        <div className="main-content-inner">{children}</div>
      </main>
    </div>
  );
}
