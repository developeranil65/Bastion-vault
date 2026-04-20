/** Bastion Vault API client — type-safe HTTP client for the backend */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface FetchOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data as T;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export async function register(email: string, password: string, tenantName?: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    userId: string;
    tenantId?: string;
    recoveryCodes?: string[];
  }>('/api/v1/auth/register', {
    method: 'POST',
    body: { email, password, tenantName },
  });
}

export async function sendOtp(email: string) {
  return apiFetch<{ message: string }>('/api/v1/auth/otp/send', {
    method: 'POST',
    body: { email },
  });
}

export async function login(email: string, otp: string) {
  return apiFetch<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    message: string;
    user?: { id: string; email: string; role: string; tenantId: string };
    tenants?: { id: string; name: string; role: string }[];
  }>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, otp },
  });
}

export async function refreshToken(refreshTokenStr: string) {
  return apiFetch<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
  }>('/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken: refreshTokenStr },
  });
}

export async function getMe(token: string) {
  return apiFetch<{
    user: { sub: string; email: string; role: string; tenantId: string; permissions: string[] };
  }>('/api/v1/auth/me', { token });
}

export async function switchTenant(token: string, tenantId: string) {
  return apiFetch<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    message: string;
  }>('/api/v1/auth/switch-tenant', {
    method: 'POST',
    body: { tenantId },
    token,
  });
}

export async function inviteUser(token: string, email: string, role?: string) {
  return apiFetch<{ success: boolean; message: string }>('/api/v1/auth/invite', {
    method: 'POST',
    body: { email, role },
    token,
  });
}

// ─── Secrets ───────────────────────────────────────────────────────────────

export interface SecretMeta {
  id: string;
  name: string;
  version: number;
  environment: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
  hmacHash: string | null;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SecretGuardrailsSettings {
  requireOwnerMetadata?: boolean;
  requireRotationDaysMetadata?: boolean;
  requireClassificationMetadata?: boolean;
  enforceProdCreateConfirmation?: boolean;
  enforceProdRotateConfirmation?: boolean;
  enforceProdDeleteTypedConfirmation?: boolean;
}

export interface ProjectSettings {
  defaultRegion?: string;
  mfaRequired?: boolean;
  sessionTimeoutMinutes?: number;
  allowMachineIdentities?: boolean;
  auditRetentionDays?: number;
  secretGuardrails?: SecretGuardrailsSettings;
}

export async function listSecrets(token: string, tenantId: string, environment: string) {
  return apiFetch<{ data: SecretMeta[] }>(
    `/api/v1/secrets/${tenantId}/envs/${environment}/secrets`,
    { token }
  );
}

export async function createSecret(
  token: string,
  tenantId: string,
  environment: string,
  name: string,
  value: string,
  metadata?: Record<string, string>,
) {
  return apiFetch<{ secret: SecretMeta }>(
    `/api/v1/secrets/${tenantId}/envs/${environment}/secrets`,
    { method: 'POST', body: { name, value, metadata }, token }
  );
}

export async function listProjectEnvironmentSecrets(token: string, projectId: string, environment: string) {
  return apiFetch<{ data: SecretMeta[] }>(
    `/api/v1/projects/${projectId}/environments/${environment}/secrets`,
    { token }
  );
}

export async function createProjectEnvironmentSecret(
  token: string,
  projectId: string,
  environment: string,
  name: string,
  value: string,
  metadata?: Record<string, string>,
) {
  return apiFetch<{ secret: SecretMeta }>(
    `/api/v1/projects/${projectId}/environments/${environment}/secrets`,
    { method: 'POST', body: { name, value, metadata }, token }
  );
}

export async function getSecretValue(token: string, tenantId: string, environment: string, secretName: string) {
  return apiFetch<{ value: string }>(
    `/api/v1/secrets/${tenantId}/envs/${environment}/secrets/${secretName}/value`,
    { token }
  );
}

export async function rotateSecret(
  token: string,
  tenantId: string,
  environment: string,
  secretName: string,
  newValue?: string,
) {
  return apiFetch<{ success: boolean; version: number }>(
    `/api/v1/secrets/${tenantId}/envs/${environment}/secrets/${secretName}/rotate`,
    { method: 'PUT', body: newValue ? { newValue } : {}, token }
  );
}

export async function rotateProjectEnvironmentSecret(
  token: string,
  projectId: string,
  environment: string,
  secretName: string,
  newValue?: string,
) {
  return apiFetch<{ success: boolean; version: number }>(
    `/api/v1/projects/${projectId}/environments/${environment}/secrets/${secretName}/rotate`,
    { method: 'PUT', body: newValue ? { newValue } : {}, token }
  );
}

export async function deleteSecret(token: string, tenantId: string, environment: string, secretName: string) {
  return apiFetch<{ success: boolean }>(
    `/api/v1/secrets/${tenantId}/envs/${environment}/secrets/${secretName}`,
    { method: 'DELETE', token }
  );
}

export async function deleteProjectEnvironmentSecret(
  token: string,
  projectId: string,
  environment: string,
  secretName: string
) {
  return apiFetch<{ success: boolean }>(
    `/api/v1/projects/${projectId}/environments/${environment}/secrets/${secretName}`,
    { method: 'DELETE', token }
  );
}

// ─── Machine Identities ───────────────────────────────────────────────────

export interface MachineIdentity {
  id: string;
  name: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
}

export async function listPassports(token: string, tenantId: string) {
  return apiFetch<{ data: MachineIdentity[] }>(
    `/api/v1/identities/${tenantId}/passports`,
    { token }
  );
}

export async function listProjectPassports(token: string, projectId: string) {
  return apiFetch<{ data: MachineIdentity[] }>(
    `/api/v1/projects/${projectId}/identities`,
    { token }
  );
}

export async function createPassport(
  token: string,
  tenantId: string,
  name: string,
  scopes: string[],
  expiresAt?: string,
) {
  return apiFetch<{
    message: string;
    passport: {
      token: string;
      tenantId: string;
      identityId: string;
      name: string;
      scopes: string[];
      apiUrl: string;
      expiresAt: string | null;
    };
  }>(`/api/v1/identities/${tenantId}/passports`, {
    method: 'POST',
    body: { name, scopes, expiresAt },
    token,
  });
}

export async function revokePassport(token: string, tenantId: string, identityId: string) {
  return apiFetch<{ success: boolean }>(
    `/api/v1/identities/${tenantId}/passports/${identityId}`,
    { method: 'DELETE', token }
  );
}

// ─── Tenant ────────────────────────────────────────────────────────────────

export async function listTenantSecrets(token: string, tenantId: string) {
  return apiFetch<{ secrets: SecretMeta[] }>(
    `/api/v1/tenants/${tenantId}/secrets`,
    { token }
  );
}

export async function listProjectSecrets(token: string, projectId: string) {
  return apiFetch<{ secrets: SecretMeta[] }>(
    `/api/v1/projects/${projectId}/secrets`,
    { token }
  );
}

export async function listProjectAudit(
  token: string,
  projectId: string,
  limit = 50,
  filters?: { action?: string; actorType?: string; from?: string; to?: string }
) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (filters?.action) params.set('action', filters.action);
  if (filters?.actorType) params.set('actorType', filters.actorType);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);

  return apiFetch<{
    data: AuditEntry[];
    chainStatus: 'present' | 'empty';
    filters?: { action: string | null; actorType: string | null; from: string | null; to: string | null };
  }>(
    `/api/v1/projects/${projectId}/audit?${params.toString()}`,
    { token }
  );
}

export async function listProjects(token: string) {
  return apiFetch<{ data: ProjectSummary[] }>('/api/v1/projects', { token });
}

export async function createProject(token: string, name: string) {
  return apiFetch<{ project: ProjectSummary }>('/api/v1/projects', {
    method: 'POST',
    body: { name },
    token,
  });
}

export async function updateProject(token: string, projectId: string, name: string) {
  return apiFetch<{ project: ProjectSummary }>(`/api/v1/projects/${projectId}`, {
    method: 'PATCH',
    body: { name },
    token,
  });
}

export async function getProjectSettings(token: string, projectId: string) {
  return apiFetch<{ settings: ProjectSettings }>(`/api/v1/projects/${projectId}/settings`, {
    token,
  });
}

export async function updateProjectSettings(token: string, projectId: string, settings: ProjectSettings) {
  return apiFetch<{ success: boolean }>(`/api/v1/projects/${projectId}/settings`, {
    method: 'PUT',
    body: settings,
    token,
  });
}

// ─── Health ────────────────────────────────────────────────────────────────

export async function healthCheck() {
  return apiFetch<{ status: string; version: string; timestamp: string }>('/health');
}
