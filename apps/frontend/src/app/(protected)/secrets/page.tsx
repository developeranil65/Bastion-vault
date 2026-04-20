'use client';

import AppPageHeader from '@/components/AppPageHeader';
import { IconEye, IconPlus, IconRefresh, IconSearch, IconTrash } from '@/components/kv-icons';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useEffect, useMemo, useState } from 'react';
import * as api from '@/lib/api';

const POLICY_TEMPLATES = [
  {
    id: 'db-credentials',
    label: 'Database credentials',
    nameHint: 'DATABASE_URL',
    valueHint: 'postgres://user:pass@host:5432/db',
    metadata: { owner: 'platform', rotationDays: '30', classification: 'restricted' },
  },
  {
    id: 'third-party-api',
    label: 'Third-party API key',
    nameHint: 'STRIPE_API_KEY',
    valueHint: 'sk_live_...',
    metadata: { owner: 'payments', rotationDays: '60', classification: 'confidential' },
  },
  {
    id: 'service-token',
    label: 'Internal service token',
    nameHint: 'INTERNAL_SERVICE_TOKEN',
    valueHint: 'token-...',
    metadata: { owner: 'backend', rotationDays: '14', classification: 'internal' },
  },
] as const;

export default function SecretsPage() {
  const { user, accessToken } = useAuth();
  const { addToast } = useToast();
  const [activeEnv, setActiveEnv] = useState('dev');
  const [secrets, setSecrets] = useState<api.SecretMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showValue, setShowValue] = useState<{ name: string; value: string } | null>(null);
  const [query, setQuery] = useState('');

  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [metadataOwner, setMetadataOwner] = useState('');
  const [metadataRotationDays, setMetadataRotationDays] = useState('30');
  const [metadataClassification, setMetadataClassification] = useState('confidential');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [prodConfirm, setProdConfirm] = useState('');
  const [guardrails, setGuardrails] = useState<api.SecretGuardrailsSettings>({
    requireOwnerMetadata: true,
    requireRotationDaysMetadata: true,
    requireClassificationMetadata: true,
    enforceProdCreateConfirmation: true,
    enforceProdRotateConfirmation: true,
    enforceProdDeleteTypedConfirmation: true,
  });
  const [creating, setCreating] = useState(false);

  const environments = ['dev', 'staging', 'prod'];

  useEffect(() => {
    loadSecrets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEnv, accessToken, user]);

  useEffect(() => {
    if (!accessToken || !user?.tenantId) return;
    api
      .getProjectSettings(accessToken, user.tenantId)
      .then(res => setGuardrails(prev => ({ ...prev, ...(res.settings.secretGuardrails || {}) })))
      .catch(() => {});
  }, [accessToken, user?.tenantId]);

  async function loadSecrets() {
    if (!accessToken || !user) return;
    setLoading(true);
    try {
      const res = await api.listProjectEnvironmentSecrets(accessToken, user.tenantId, activeEnv);
      setSecrets(res.data || []);
    } catch {
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return secrets;
    return secrets.filter(s => s.name.toLowerCase().includes(q));
  }, [secrets, query]);

  const guardrailItems = useMemo(() => {
    return [
      { label: 'Owner metadata required', enabled: !!guardrails.requireOwnerMetadata },
      { label: 'Rotation metadata required', enabled: !!guardrails.requireRotationDaysMetadata },
      { label: 'Classification metadata required', enabled: !!guardrails.requireClassificationMetadata },
      { label: 'Prod create confirmation', enabled: !!guardrails.enforceProdCreateConfirmation },
      { label: 'Prod rotate confirmation', enabled: !!guardrails.enforceProdRotateConfirmation },
      { label: 'Prod typed delete confirmation', enabled: !!guardrails.enforceProdDeleteTypedConfirmation },
    ];
  }, [guardrails]);

  async function handleCreate() {
    if (!accessToken || !user || !newName || !newValue) return;
    if (guardrails.requireOwnerMetadata && !metadataOwner.trim()) {
      addToast('Owner metadata is required', 'error');
      return;
    }
    if (guardrails.requireRotationDaysMetadata && !metadataRotationDays.trim()) {
      addToast('Rotation metadata is required', 'error');
      return;
    }
    if (guardrails.requireClassificationMetadata && !metadataClassification.trim()) {
      addToast('Classification metadata is required', 'error');
      return;
    }
    if (activeEnv === 'prod' && guardrails.enforceProdCreateConfirmation && prodConfirm !== 'PROD') {
      addToast('Type PROD to confirm production write', 'error');
      return;
    }
    setCreating(true);
    try {
      await api.createProjectEnvironmentSecret(accessToken, user.tenantId, activeEnv, newName, newValue, {
        owner: metadataOwner.trim(),
        rotationDays: metadataRotationDays.trim(),
        classification: metadataClassification,
        policyTemplate: selectedTemplateId || 'custom',
      });
      addToast(`Secret "${newName}" stored in ${activeEnv}`);
      setNewName('');
      setNewValue('');
      setMetadataOwner('');
      setMetadataRotationDays('30');
      setMetadataClassification('confidential');
      setSelectedTemplateId('');
      setProdConfirm('');
      setShowCreate(false);
      loadSecrets();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleFetchValue(name: string) {
    if (!accessToken || !user) return;
    try {
      const res = await api.getSecretValue(accessToken, user.tenantId, activeEnv, name);
      setShowValue({ name, value: res.value });
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  }

  async function handleRotate(name: string) {
    if (!accessToken || !user) return;
    if (activeEnv === 'prod' && guardrails.enforceProdRotateConfirmation && !confirm(`Rotate "${name}" in PROD now?`)) return;
    try {
      const res = await api.rotateProjectEnvironmentSecret(accessToken, user.tenantId, activeEnv, name);
      addToast(`"${name}" rotated to v${res.version}`);
      loadSecrets();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  }

  async function handleDelete(name: string) {
    if (!accessToken || !user) return;
    if (activeEnv === 'prod' && guardrails.enforceProdDeleteTypedConfirmation) {
      const token = prompt(`Type DELETE ${name} to confirm production deletion.`);
      if (token !== `DELETE ${name}`) {
        addToast('Production delete cancelled', 'error');
        return;
      }
    } else if (!confirm(`Delete "${name}" from ${activeEnv}? This is a soft-delete.`)) {
      return;
    }
    try {
      await api.deleteProjectEnvironmentSecret(accessToken, user.tenantId, activeEnv, name);
      addToast(`"${name}" removed`);
      loadSecrets();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  }

  return (
    <>
      <AppPageHeader
        kicker="Secrets engine"
        title="Secret paths"
        description="Project-environment scoped names and versions. Decrypt only when needed; values stay encrypted at rest."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <IconPlus size={16} aria-hidden />
            New secret
          </button>
        }
      />

      <div className="kv-toolbar">
        <div className="env-pills" role="tablist" aria-label="Environment">
          {environments.map(env => (
            <button
              key={env}
              type="button"
              role="tab"
              aria-selected={activeEnv === env}
              className={`env-pill ${activeEnv === env ? 'active' : ''}`}
              onClick={() => setActiveEnv(env)}
            >
              {env}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', minWidth: 'min(100%, 240px)' }}>
          <span
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--outline)',
              display: 'flex',
            }}
          >
            <IconSearch size={16} aria-hidden />
          </span>
          <input
            type="search"
            className="form-input"
            placeholder="Filter by name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
            aria-label="Filter secrets"
          />
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 'var(--space-lg)',
          borderColor: 'rgba(254, 177, 39, 0.25)',
          background: 'rgba(254, 177, 39, 0.04)',
        }}
      >
        <h3 style={{ fontSize: '0.9375rem', marginBottom: 'var(--space-sm)', color: 'var(--tertiary)' }}>Security guardrails</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-sm)' }}>
          {guardrailItems.map(item => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: '0.75rem',
              }}
            >
              <span style={{ color: 'var(--on-surface-variant)' }}>{item.label}</span>
              <span className={`badge ${item.enabled ? 'badge-success' : 'badge-primary'}`}>
                {item.enabled ? 'Enforced' : 'Relaxed'}
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--outline)', marginTop: 'var(--space-sm)' }}>
          Policy source: Project Settings {'->'} Secret guardrails policy.
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--outline)', fontSize: '0.875rem' }}>
            Loading secret paths…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
            <p style={{ color: 'var(--outline)', marginBottom: 'var(--space-md)', fontSize: '0.875rem' }}>
              {secrets.length === 0 ? (
                <>
                  No secrets in <span className="badge badge-primary">{activeEnv}</span>.
                </>
              ) : (
                <>No matches for your filter.</>
              )}
            </p>
            {secrets.length === 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(true)}>
                Create first secret
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Version</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className="secret-name">{s.name}</td>
                    <td>
                      <span className="badge badge-primary">v{s.version}</span>
                    </td>
                    <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      {new Date(s.updatedAt).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleFetchValue(s.name)}
                          title="Decrypt once"
                          aria-label={`Decrypt ${s.name}`}
                        >
                          <IconEye />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleRotate(s.name)}
                          title="Rotate"
                          aria-label={`Rotate ${s.name}`}
                        >
                          <IconRefresh />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => handleDelete(s.name)}
                          title="Delete"
                          aria-label={`Delete ${s.name}`}
                        >
                          <IconTrash />
                        </button>
                      </div>
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
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="modal-create-title">
            <h3 id="modal-create-title">New secret</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginBottom: 'var(--space-lg)' }}>
              Stored encrypted for <span className="badge badge-primary">{activeEnv}</span>.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="secret-template">
                Policy template
              </label>
              <select
                id="secret-template"
                className="form-input"
                value={selectedTemplateId}
                onChange={e => {
                  const templateId = e.target.value;
                  setSelectedTemplateId(templateId);
                  const template = POLICY_TEMPLATES.find(t => t.id === templateId);
                  if (!template) return;
                  setNewName(template.nameHint);
                  setNewValue(template.valueHint);
                  setMetadataOwner(template.metadata.owner);
                  setMetadataRotationDays(template.metadata.rotationDays);
                  setMetadataClassification(template.metadata.classification);
                }}
              >
                <option value="">Custom</option>
                {POLICY_TEMPLATES.map(template => (
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </select>
              <p style={{ fontSize: '0.6875rem', color: 'var(--outline)', marginTop: '4px' }}>
                Applies naming and metadata defaults for common secret types.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="secret-name">
                Name
              </label>
              <input
                id="secret-name"
                className="form-input"
                placeholder="DATABASE_URL"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="secret-value">
                Value
              </label>
              <textarea
                id="secret-value"
                className="form-input"
                placeholder="postgres://…"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                rows={4}
                style={{ fontFamily: 'var(--font-mono)' }}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="secret-owner">
                Owner (required)
              </label>
              <input
                id="secret-owner"
                className="form-input"
                placeholder="platform-team"
                value={metadataOwner}
                onChange={e => setMetadataOwner(e.target.value)}
                  required={!!guardrails.requireOwnerMetadata}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="secret-rotation-days">
                  Rotation (days)
                </label>
                <input
                  id="secret-rotation-days"
                  className="form-input"
                  inputMode="numeric"
                  value={metadataRotationDays}
                  onChange={e => setMetadataRotationDays(e.target.value.replace(/[^0-9]/g, ''))}
                  required={!!guardrails.requireRotationDaysMetadata}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="secret-classification">
                  Classification
                </label>
                <select
                  id="secret-classification"
                  className="form-input"
                  value={metadataClassification}
                  onChange={e => setMetadataClassification(e.target.value)}
                  required={!!guardrails.requireClassificationMetadata}
                >
                  <option value="internal">internal</option>
                  <option value="confidential">confidential</option>
                  <option value="restricted">restricted</option>
                </select>
              </div>
            </div>
            {activeEnv === 'prod' && guardrails.enforceProdCreateConfirmation && (
              <div className="form-group">
                <label className="form-label" htmlFor="prod-confirm">
                  Production confirm token
                </label>
                <input
                  id="prod-confirm"
                  className="form-input"
                  placeholder='Type "PROD"'
                  value={prodConfirm}
                  onChange={e => setProdConfirm(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={
                  creating ||
                  !newName ||
                  !newValue ||
                  (guardrails.requireOwnerMetadata && !metadataOwner) ||
                  (guardrails.requireRotationDaysMetadata && !metadataRotationDays) ||
                  (guardrails.requireClassificationMetadata && !metadataClassification) ||
                  (activeEnv === 'prod' && guardrails.enforceProdCreateConfirmation && prodConfirm !== 'PROD')
                }
              >
                {creating ? 'Encrypting…' : 'Store secret'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showValue && (
        <div className="modal-backdrop" onClick={() => setShowValue(null)} role="presentation">
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="modal-value-title">
            <h3 id="modal-value-title">Plaintext (session only)</h3>
            <p style={{ marginBottom: 'var(--space-md)', fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
              Shown in memory for this view. Do not leave unattended.
            </p>
            <div className="terminal">
              <span className="keyword">{showValue.name}</span> = <span className="string">&quot;{showValue.value}&quot;</span>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  navigator.clipboard.writeText(showValue.value);
                  addToast('Copied to clipboard');
                }}
              >
                Copy
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setShowValue(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
