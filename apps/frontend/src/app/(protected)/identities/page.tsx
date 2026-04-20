'use client';

import AppPageHeader from '@/components/AppPageHeader';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useEffect, useState } from 'react';
import * as api from '@/lib/api';

export default function IdentitiesPage() {
  const { user, accessToken } = useAuth();
  const { addToast } = useToast();
  const [identities, setIdentities] = useState<api.MachineIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPassport, setShowPassport] = useState<{
    token: string;
    tenantId: string;
    identityId: string;
    name: string;
    scopes: string[];
    apiUrl: string;
  } | null>(null);

  const [idName, setIdName] = useState('');
  const [idScopes, setIdScopes] = useState('dev:read');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadIdentities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user]);

  async function loadIdentities() {
    if (!accessToken || !user) return;
    setLoading(true);
    try {
      const res = await api.listPassports(accessToken, user.tenantId);
      setIdentities(res.data || []);
    } catch {
      setIdentities([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!accessToken || !user || !idName || !idScopes) return;
    setCreating(true);
    try {
      const scopes = idScopes.split(',').map(s => s.trim()).filter(Boolean);
      const res = await api.createPassport(accessToken, user.tenantId, idName, scopes);
      setShowPassport(res.passport);
      setShowCreate(false);
      setIdName('');
      setIdScopes('dev:read');
      loadIdentities();
      addToast('Identity created. Save the passport token now.');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(identityId: string) {
    if (!accessToken || !user) return;
    if (!confirm('Revoke this identity? Associated tokens stop working immediately.')) return;
    try {
      await api.revokePassport(accessToken, user.tenantId, identityId);
      addToast('Identity revoked');
      loadIdentities();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  }

  return (
    <>
      <AppPageHeader
        kicker="Access"
        title="Machine identities"
        description="Passport-style tokens for project automation. Scope by environment and capability; revoke when a workload is retired."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            New identity
          </button>
        }
      />

      <div
        className="card"
        style={{
          marginBottom: 'var(--space-lg)',
          borderColor: 'rgba(254, 177, 39, 0.25)',
          background: 'rgba(254, 177, 39, 0.04)',
        }}
      >
        <h3 style={{ fontSize: '0.9375rem', marginBottom: 'var(--space-sm)', color: 'var(--tertiary)' }}>Handling credentials</h3>
        <p style={{ fontSize: '0.8125rem', marginBottom: 'var(--space-md)', color: 'var(--on-surface-variant)' }}>
          Treat exported passports like long-lived API secrets. Prefer short scopes and rotation over broad access.
        </p>
        <ul style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', paddingLeft: '1.1rem', lineHeight: 1.7 }}>
          <li>Do not commit passport JSON to version control.</li>
          <li>Restrict file permissions on disk (e.g. 0400).</li>
          <li>Revoke when a service account or CI job is decommissioned.</li>
        </ul>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: 'var(--space-lg)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <h3 style={{ fontSize: '1rem', margin: 0 }}>Identities</h3>
          <span className="badge badge-primary">{identities.filter(i => i.isActive).length} active</span>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--outline)', fontSize: '0.875rem' }}>
            Loading…
          </div>
        ) : identities.length === 0 ? (
          <div style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
            <p style={{ color: 'var(--outline)', fontSize: '0.875rem' }}>No identities yet. Create one for CI or runtime fetch.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scopes</th>
                  <th>Status</th>
                  <th>Last used</th>
                  <th>Expires</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {identities.map(id => (
                  <tr key={id.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary)', fontWeight: 500 }}>{id.name}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {id.scopes.map(s => (
                          <span key={s} className="badge badge-primary">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`status-led ${id.isActive ? 'active' : 'revoked'}`}>{id.isActive ? 'Active' : 'Revoked'}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                      {id.lastUsedAt ? new Date(id.lastUsedAt).toLocaleString() : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                      {id.expiresAt ? new Date(id.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {id.isActive && (
                        <button type="button" className="btn btn-danger" style={{ padding: '4px 12px', fontSize: '0.75rem' }} onClick={() => handleRevoke(id.id)}>
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)} role="presentation">
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="id-modal-title">
            <h3 id="id-modal-title">New machine identity</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="id-name">
                Name
              </label>
              <input
                id="id-name"
                className="form-input"
                placeholder="payment-service-prod"
                value={idName}
                onChange={e => setIdName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="id-scopes">
                Scopes (comma-separated)
              </label>
              <input
                id="id-scopes"
                className="form-input"
                placeholder="prod:read, dev:read"
                value={idScopes}
                onChange={e => setIdScopes(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              <p style={{ fontSize: '0.6875rem', color: 'var(--outline)', marginTop: '4px' }}>Format: env:action (e.g. dev:read, prod:write)</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={creating || !idName}>
                {creating ? 'Issuing…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPassport && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" style={{ maxWidth: '600px' }} role="dialog" aria-labelledby="passport-title">
            <h3 id="passport-title" style={{ color: 'var(--tertiary)' }}>
              Save this passport — shown once
            </h3>
            <p style={{ marginBottom: 'var(--space-lg)', fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
              Copy to a secrets manager or encrypted store. It cannot be retrieved again from the UI.
            </p>
            <div className="terminal" style={{ wordBreak: 'break-all', marginBottom: 'var(--space-lg)' }}>
              <div>
                <span className="keyword">&quot;token&quot;</span>: <span className="string">&quot;{showPassport.token}&quot;</span>
              </div>
              <div>
                <span className="keyword">&quot;tenantId&quot;</span>: <span className="string">&quot;{showPassport.tenantId}&quot;</span>
              </div>
              <div>
                <span className="keyword">&quot;identityId&quot;</span>: <span className="string">&quot;{showPassport.identityId}&quot;</span>
              </div>
              <div>
                <span className="keyword">&quot;apiUrl&quot;</span>: <span className="string">&quot;{showPassport.apiUrl}&quot;</span>
              </div>
              <div>
                <span className="keyword">&quot;scopes&quot;</span>: [<span className="string">{showPassport.scopes.map(s => `"${s}"`).join(', ')}</span>]
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const payload = JSON.stringify(showPassport, null, 2);
                  navigator.clipboard.writeText(payload);
                  addToast('JSON copied');
                }}
              >
                Copy JSON
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setShowPassport(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
