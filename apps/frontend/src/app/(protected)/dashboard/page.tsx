'use client';

import AppPageHeader from '@/components/AppPageHeader';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import * as api from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, accessToken, tenants } = useAuth();
  const [secrets, setSecrets] = useState<api.SecretMeta[]>([]);
  const [identities, setIdentities] = useState<api.MachineIdentity[]>([]);
  const [auditEvents, setAuditEvents] = useState<api.AuditEntry[]>([]);
  const [guardrails, setGuardrails] = useState<api.SecretGuardrailsSettings | null>(null);
  const [apiStatus, setApiStatus] = useState<string>('checking...');
  const [apiVersion, setApiVersion] = useState<string>('');

  useEffect(() => {
    if (!accessToken || !user) return;

    api
      .healthCheck()
      .then(h => {
        setApiStatus('online');
        setApiVersion(h.version);
      })
      .catch(() => setApiStatus('offline'));

    api
      .listProjectSecrets(accessToken, user.tenantId)
      .then(r => setSecrets(r.secrets || []))
      .catch(() => {});

    api
      .listProjectPassports(accessToken, user.tenantId)
      .then(r => setIdentities(r.data || []))
      .catch(() => {});

    api
      .listProjectAudit(accessToken, user.tenantId, 15)
      .then(r => setAuditEvents(r.data || []))
      .catch(() => {});

    api
      .getProjectSettings(accessToken, user.tenantId)
      .then(r => setGuardrails(r.settings.secretGuardrails || null))
      .catch(() => setGuardrails(null));
  }, [accessToken, user]);

  const envCounts = secrets.reduce((acc, s) => {
    acc[s.environment] = (acc[s.environment] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeIdentities = identities.filter(i => i.isActive).length;
  const revokedIdentities = identities.filter(i => !i.isActive).length;
  const identitiesExpiringSoon = identities.filter(i => {
    if (!i.isActive || !i.expiresAt) return false;
    const diffMs = new Date(i.expiresAt).getTime() - Date.now();
    return diffMs > 0 && diffMs <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  return (
    <>
      <AppPageHeader
        kicker="Overview"
        title="Control plane snapshot"
        description="Live counts for the current project. Use navigation to drill into secrets, access, and audit trails."
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Secrets</div>
          <div className="stat-value">{secrets.length}</div>
          <div className="stat-delta neutral">All environments</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active identities</div>
          <div className="stat-value">{activeIdentities}</div>
          <div className="stat-delta neutral">{revokedIdentities} revoked</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Control plane</div>
          <div className="stat-value" style={{ fontSize: '1.125rem' }}>
            <span className={`status-led ${apiStatus === 'online' ? 'active' : 'error'}`}>
              {apiStatus === 'online' ? `Online · ${apiVersion || '—'}` : 'Offline'}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Projects</div>
          <div className="stat-value">{tenants.length}</div>
          <div className="stat-delta neutral">Your memberships</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">7d risk watch</div>
          <div className="stat-value">{identitiesExpiringSoon}</div>
          <div className="stat-delta neutral">Identities expiring soon</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-lg)',
        }}
      >
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Secrets by environment</h3>
            <Link href="/secrets" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
              Open
            </Link>
          </div>
          {Object.keys(envCounts).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {Object.entries(envCounts).map(([env, count]) => (
                <div
                  key={env}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-sm) 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span className="badge badge-primary">{env}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-fixed-dim)', fontWeight: 600 }}>{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--outline)', fontSize: '0.875rem' }}>No secrets yet. Create one under Secrets.</p>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Recent identities</h3>
            <Link href="/identities" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
              Open
            </Link>
          </div>
          {identities.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {identities.slice(0, 5).map(id => (
                <div
                  key={id.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-sm) 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--secondary)' }}>{id.name}</span>
                  <span className={`status-led ${id.isActive ? 'active' : 'revoked'}`}>{id.isActive ? 'Active' : 'Revoked'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--outline)', fontSize: '0.875rem' }}>No machine identities. Issue a passport under Access.</p>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-lg)',
          marginTop: 'var(--space-lg)',
        }}
      >
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Operational risk posture</h3>
            <Link href="/identities" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
              Review
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--on-surface-variant)' }}>Revoked identities</span>
              <span className="badge badge-primary">{revokedIdentities}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--on-surface-variant)' }}>Expiring in 7 days</span>
              <span className="badge badge-primary">{identitiesExpiringSoon}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--on-surface-variant)' }}>Audit events loaded</span>
              <span className="badge badge-primary">{auditEvents.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--on-surface-variant)' }}>Prod write guardrails</span>
              <span className="badge badge-primary">
                {guardrails?.enforceProdCreateConfirmation || guardrails?.enforceProdDeleteTypedConfirmation ? 'Enabled' : 'Relaxed'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Recent activity</h3>
            <Link href="/audit" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
              Open audit
            </Link>
          </div>
          {auditEvents.length === 0 ? (
            <p style={{ color: 'var(--outline)', fontSize: '0.875rem' }}>No recent events.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {auditEvents.slice(0, 5).map(event => (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-sm) 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{event.action}</div>
                    <div style={{ color: 'var(--on-surface-variant)', fontSize: '0.75rem' }}>
                      {event.resourceType}: {event.resourceId}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--outline)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {tenants.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>Projects</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {tenants.map(t => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-md)',
                  borderRadius: 'var(--radius-md)',
                  background: t.id === user?.tenantId ? 'var(--surface-container-low)' : 'transparent',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: 'var(--space-sm)',
                }}
              >
                <span style={{ fontWeight: 500 }}>{t.name}</span>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  <span className="badge badge-primary">{t.role}</span>
                  {t.id === user?.tenantId && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--primary-fixed-dim)' }}>Current</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
