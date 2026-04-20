'use client';

import AppPageHeader from '@/components/AppPageHeader';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useEffect, useMemo, useState } from 'react';
import * as api from '@/lib/api';

export default function ProjectsPage() {
  const { user, accessToken, switchTenant } = useAuth();
  const { addToast } = useToast();
  const [projects, setProjects] = useState<api.ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    api
      .listProjects(accessToken)
      .then(res => setProjects(res.data || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const currentProject = useMemo(
    () => projects.find(t => t.id === user?.tenantId) || null,
    [projects, user?.tenantId]
  );

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

  async function handleCreateProject() {
    if (!accessToken || !newProjectName.trim()) return;
    setCreating(true);
    try {
      const res = await api.createProject(accessToken, newProjectName.trim());
      setProjects(prev => [...prev, res.project]);
      setNewProjectName('');
      addToast('Project created');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRenameProject(projectId: string) {
    if (!accessToken || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const res = await api.updateProject(accessToken, projectId, editName.trim());
      setProjects(prev => prev.map(p => (p.id === projectId ? { ...p, ...res.project } : p)));
      setEditingProjectId(null);
      setEditName('');
      addToast('Project renamed');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <>
      <AppPageHeader
        kicker="Organization"
        title="Projects"
        description="Projects isolate secrets, identities, and audit history. Select a current project to scope all operations."
      />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Projects</div>
          <div className="stat-value">{projects.length}</div>
          <div className="stat-delta neutral">Available memberships</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current project</div>
          <div className="stat-value" style={{ fontSize: '1rem' }}>{currentProject?.name || 'Unassigned'}</div>
          <div className="stat-delta neutral">{currentProject?.role || 'No role'}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>Create project</h3>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1 1 260px', marginBottom: 0 }}>
            <label className="form-label" htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              className="form-input"
              value={newProjectName}
              placeholder="payments-api"
              onChange={e => setNewProjectName(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreateProject}
            disabled={creating || !newProjectName.trim()}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>Project memberships</h3>
        {loading ? (
          <p style={{ color: 'var(--outline)', fontSize: '0.875rem' }}>Loading projects…</p>
        ) : projects.length === 0 ? (
          <p style={{ color: 'var(--outline)', fontSize: '0.875rem' }}>No project memberships found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {projects.map(project => (
              <div
                key={project.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  background: project.id === user?.tenantId ? 'var(--surface-container-low)' : 'transparent',
                }}
              >
                <div>
                  {editingProjectId === project.id ? (
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                      <input
                        className="form-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        style={{ height: 32 }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        onClick={() => handleRenameProject(project.id)}
                        disabled={savingEdit || !editName.trim()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        onClick={() => {
                          setEditingProjectId(null);
                          setEditName('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600 }}>{project.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)' }}>
                        {project.id}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span className="badge badge-primary">{project.role}</span>
                  {(project.role === 'OWNER' || project.role === 'ADMIN') && editingProjectId !== project.id && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => {
                        setEditingProjectId(project.id);
                        setEditName(project.name);
                      }}
                    >
                      Rename
                    </button>
                  )}
                  {project.id === user?.tenantId ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary-fixed-dim)' }}>Current</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                      onClick={() => handleSwitch(project.id)}
                      disabled={switching === project.id}
                    >
                      {switching === project.id ? 'Switching…' : 'Switch'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
