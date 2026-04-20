'use client';

import AppPageHeader from '@/components/AppPageHeader';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useEffect, useState } from 'react';
import * as api from '@/lib/api';

export default function SettingsPage() {
  const { user, accessToken, tenants, switchTenant } = useAuth();
  const { addToast } = useToast();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('USER');
  const [inviting, setInviting] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [guardrails, setGuardrails] = useState<api.SecretGuardrailsSettings>({
    requireOwnerMetadata: true,
    requireRotationDaysMetadata: true,
    requireClassificationMetadata: true,
    enforceProdCreateConfirmation: true,
    enforceProdRotateConfirmation: true,
    enforceProdDeleteTypedConfirmation: true,
  });
  const [savingGuardrails, setSavingGuardrails] = useState(false);

  useEffect(() => {
    if (!accessToken || !user?.tenantId) return;
    api
      .getProjectSettings(accessToken, user.tenantId)
      .then(res => {
        setGuardrails(prev => ({ ...prev, ...(res.settings.secretGuardrails || {}) }));
      })
      .catch(() => {});
  }, [accessToken, user?.tenantId]);

  async function handleInvite() {
    if (!accessToken || !inviteEmail) return;
    setInviting(true);
    try {
      const res = await api.inviteUser(accessToken, inviteEmail, inviteRole);
      addToast(res.message);
      setInviteEmail('');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setInviting(false);
    }
  }

  async function handleSwitch(tenantId: string) {
    setSwitching(tenantId);
    try {
      await switchTenant(tenantId);
      addToast('Project context updated');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setSwitching(null);
    }
  }

  async function handleSaveGuardrails() {
    if (!accessToken || !user?.tenantId) return;
    setSavingGuardrails(true);
    try {
      await api.updateProjectSettings(accessToken, user.tenantId, {
        secretGuardrails: guardrails,
      });
      addToast('Secret guardrails updated');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setSavingGuardrails(false);
    }
  }

  return (
    <>
      <AppPageHeader
        kicker="Project operations"
        title="Settings"
        description="Project metadata, membership, and API hints for the Bastion Vault control plane."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-lg)', fontSize: '1rem' }}>Current project</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div>
              <div className="form-label">Tenant ID</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--secondary)', wordBreak: 'break-all' }}>
                {user?.tenantId}
              </div>
            </div>
            <div>
              <div className="form-label">Your role</div>
              <span className="badge badge-primary">{user?.role?.toUpperCase()}</span>
            </div>
            <div>
              <div className="form-label">Email</div>
              <div style={{ fontSize: '0.875rem' }}>{user?.email}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-lg)', fontSize: '1rem' }}>Switch project</h3>
          {tenants.length > 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
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
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t.name}</div>
                    <span className="badge badge-primary" style={{ marginTop: '4px' }}>
                      {t.role}
                    </span>
                  </div>
                  {t.id === user?.tenantId ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary-fixed-dim)' }}>Active</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                      onClick={() => handleSwitch(t.id)}
                      disabled={switching === t.id}
                    >
                      {switching === t.id ? '…' : 'Switch'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--outline)', fontSize: '0.875rem' }}>You only have one project. Invitations add more memberships.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>Invite member</h3>
        <p style={{ marginBottom: 'var(--space-lg)', fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
          The user must already have a Bastion Vault account. They will be added to this project.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label className="form-label" htmlFor="invite-email">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              className="form-input"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ width: '140px' }}>
            <label className="form-label" htmlFor="invite-role">
              Role
            </label>
            <select id="invite-role" className="form-input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <button type="button" className="btn btn-primary" onClick={handleInvite} disabled={inviting || !inviteEmail}>
              {inviting ? 'Sending…' : 'Invite'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>Secret guardrails policy</h3>
        <p style={{ marginBottom: 'var(--space-lg)', fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
          Configure how the Secrets workflow enforces metadata and production confirmations.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-md)' }}>
          <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={!!guardrails.requireOwnerMetadata} onChange={e => setGuardrails(prev => ({ ...prev, requireOwnerMetadata: e.target.checked }))} />
            Require owner metadata
          </label>
          <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={!!guardrails.requireRotationDaysMetadata} onChange={e => setGuardrails(prev => ({ ...prev, requireRotationDaysMetadata: e.target.checked }))} />
            Require rotation days metadata
          </label>
          <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={!!guardrails.requireClassificationMetadata} onChange={e => setGuardrails(prev => ({ ...prev, requireClassificationMetadata: e.target.checked }))} />
            Require classification metadata
          </label>
          <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={!!guardrails.enforceProdCreateConfirmation} onChange={e => setGuardrails(prev => ({ ...prev, enforceProdCreateConfirmation: e.target.checked }))} />
            Require PROD confirm on create
          </label>
          <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={!!guardrails.enforceProdRotateConfirmation} onChange={e => setGuardrails(prev => ({ ...prev, enforceProdRotateConfirmation: e.target.checked }))} />
            Require confirmation on prod rotate
          </label>
          <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={!!guardrails.enforceProdDeleteTypedConfirmation} onChange={e => setGuardrails(prev => ({ ...prev, enforceProdDeleteTypedConfirmation: e.target.checked }))} />
            Require typed confirm on prod delete
          </label>
        </div>
        <div style={{ marginTop: 'var(--space-md)' }}>
          <button type="button" className="btn btn-primary" onClick={handleSaveGuardrails} disabled={savingGuardrails}>
            {savingGuardrails ? 'Saving…' : 'Save guardrails'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>CLI quick reference</h3>
        <div className="terminal">
          <div>
            <span className="comment"># Configure client</span>
          </div>
          <div>
            <span className="keyword">bv</span> init ./bastion-passport.json
          </div>
          <div>
            <span className="keyword">bv</span> fetch -e prod -s DATABASE_URL
          </div>
          <div>
            <span className="keyword">bv</span> status
          </div>
        </div>
      </div>
    </>
  );
}
