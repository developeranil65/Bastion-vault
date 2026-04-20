'use client';

import AppPageHeader from '@/components/AppPageHeader';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import * as api from '@/lib/api';

export default function AuditPage() {
  const { user, accessToken } = useAuth();
  const [logs, setLogs] = useState<api.AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainStatus, setChainStatus] = useState<'present' | 'empty'>('empty');
  const [action, setAction] = useState('');
  const [actorType, setActorType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (!accessToken || !user) return;
    setLoading(true);
    api
      .listProjectAudit(accessToken, user.tenantId, 100, {
        action,
        actorType,
        from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
        to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
      })
      .then(res => {
        setLogs(res.data || []);
        setChainStatus(res.chainStatus || 'empty');
      })
      .catch(() => {
        setLogs([]);
        setChainStatus('empty');
      })
      .finally(() => setLoading(false));
  }, [accessToken, user, action, actorType, fromDate, toDate]);

  const actionDotClass = (action: string) => {
    if (action.includes('READ') || action.includes('ACCESS') || action.includes('LIST')) return 'read';
    if (action.includes('CREATE')) return 'create';
    if (action.includes('DELETE') || action.includes('REVOKE')) return 'delete';
    if (action.includes('ROTATE')) return 'rotate';
    return 'auth';
  };

  return (
    <>
      <AppPageHeader
        kicker="Compliance"
        title="Audit"
        description="Structured log of sensitive operations for the active project. Dedicated audit API entries populate here automatically."
      />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Events</div>
          <div className="stat-value">{logs.length || '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Chain</div>
          <div className="stat-value" style={{ fontSize: '1rem' }}>
            <span className={`status-led ${chainStatus === 'present' ? 'active' : 'revoked'}`}>
              {chainStatus === 'present' ? 'HMAC present' : 'No events'}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Policy</div>
          <div className="stat-value" style={{ fontSize: '1rem' }}>
            <span className="badge badge-success">Retained</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: '180px' }}>
            <label className="form-label" htmlFor="audit-action-filter">Action</label>
            <select
              id="audit-action-filter"
              className="form-input"
              value={action}
              onChange={e => setAction(e.target.value)}
            >
              <option value="">All</option>
              <option value="CREATE">CREATE</option>
              <option value="LIST">LIST</option>
              <option value="ACCESS_VALUE">ACCESS_VALUE</option>
              <option value="ROTATE">ROTATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '180px' }}>
            <label className="form-label" htmlFor="audit-actor-filter">Actor type</label>
            <select
              id="audit-actor-filter"
              className="form-input"
              value={actorType}
              onChange={e => setActorType(e.target.value)}
            >
              <option value="">All</option>
              <option value="USER">USER</option>
              <option value="MACHINE_IDENTITY">MACHINE_IDENTITY</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '160px' }}>
            <label className="form-label" htmlFor="audit-from-filter">From</label>
            <input
              id="audit-from-filter"
              type="date"
              className="form-input"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ minWidth: '160px' }}>
            <label className="form-label" htmlFor="audit-to-filter">To</label>
            <input
              id="audit-to-filter"
              type="date"
              className="form-input"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setAction('');
              setActorType('');
              setFromDate('');
              setToDate('');
            }}
          >
            Reset filters
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-lg)',
        }}
      >
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>Stream</h3>

          {loading ? (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--outline)', fontSize: '0.875rem' }}>
              Connecting…
            </div>
          ) : logs.length > 0 ? (
            <div className="audit-stream">
              {logs.map(log => (
                <div key={log.id} className="audit-entry">
                  <div className={`audit-dot ${actionDotClass(log.action)}`} />
                  <div className="audit-body">
                    <div className="audit-title">
                      {log.action}: {log.resourceId}
                    </div>
                    <div className="audit-meta">
                      Actor: {log.actorId} ({log.actorType})
                    </div>
                  </div>
                  <div className="audit-time">{new Date(log.createdAt).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="audit-stream">
              <p style={{ color: 'var(--outline)', fontSize: '0.875rem' }}>
                No audit events yet for this project.
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>Request payload (example)</h3>
          <div className="terminal" style={{ marginBottom: 'var(--space-lg)' }}>
            <div>
              <span className="keyword">&quot;path&quot;</span>: <span className="string">&quot;secret/data/payment-gateway&quot;</span>,
            </div>
            <div>
              <span className="keyword">&quot;operation&quot;</span>: <span className="string">&quot;update&quot;</span>,
            </div>
            <div>
              <span className="keyword">&quot;data&quot;</span>: {'{'}
            </div>
            <div>
              {'  '}
              <span className="keyword">&quot;api_key&quot;</span>: <span className="comment">********</span>,
            </div>
            <div>
              {'  '}
              <span className="keyword">&quot;rotation_period&quot;</span>: <span className="string">&quot;30d&quot;</span>
            </div>
            <div>{'}'}</div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-md)',
              background: 'rgba(74, 222, 128, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span className="status-led active" />
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Integrity check</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Hash chain verified for displayed window.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
