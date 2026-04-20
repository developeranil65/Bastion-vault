# Bastion Vault Integration Guide

This guide explains how frontend applications and runtime services should consume Bastion Vault.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Human Authentication Flow](#human-authentication-flow)
3. [Runtime Secret Consumption](#runtime-secret-consumption)
4. [API Conventions](#api-conventions)
5. [Error Handling](#error-handling)
6. [Next.js Example](#nextjs-example)
7. [Common Pitfalls](#common-pitfalls)

---

## Getting Started

### Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://your-domain.com/api/v1
```

### Interactive API Docs

Swagger UI is available at `http://localhost:3000/api-docs` when the backend is running. Use it to explore all endpoints interactively.

### CORS

The API accepts requests from origins listed in the `CORS_ORIGINS` environment variable.

---

## Human Authentication Flow

Bastion Vault uses an OTP-based login flow for human users.

### Step 1: Register a User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePass123!",
  "tenantName": "My Workspace"    // optional
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "userId": "uuid-of-user",
  "tenantId": "uuid-of-tenant"
}
```

> Registration auto-creates a project (tenant primitive). Store the `tenantId` from login as your `projectId` context.

### Step 2: Request an OTP

```http
POST /api/v1/auth/otp/send
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "If an account exists for user@example.com, an OTP has been sent."
}
```

> The response is intentionally vague to prevent email enumeration attacks.

### Step 3: Login with OTP

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "message": "Login successful",
  "user": {
    "id": "uuid-of-user",
    "email": "user@example.com",
    "role": "owner",
    "tenantId": "uuid-of-tenant"
  }
}
```

**What to store:**
| Value | Storage | Purpose |
|-------|---------|---------|
| `accessToken` | Memory (React state / context) | Sent with every API request |
| `refreshToken` | `httpOnly` cookie or secure storage | Used to get a new `accessToken` |
| `user` object | State / localStorage | Display name, role, tenant context |

### Step 4: Use the Access Token

Include the token in the `Authorization` header for all authenticated requests:

```http
GET /api/v1/projects/{projectId}/environments/dev/secrets
Authorization: Bearer eyJhbGciOi...
```

### Step 5: Refresh Expired Tokens

Access tokens expire after **30 minutes**. Refresh them before they expire:

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOi..."
}
```

**Response (200):**
```json
{
  "success": true,
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token",
  "message": "Token refreshed successfully"
}
```

> **Important:** Each refresh returns a **new refresh token** as well. Always replace both tokens.

---

## API Conventions

### URL Pattern

All project-scoped resources follow this pattern:

```
/api/v1/projects/{projectId}/...
```

The `projectId` in the URL **must match** the active project embedded in the JWT or machine passport.

### Environments

Common environments are `dev`, `staging`, and `prod`, but the backend also accepts custom strings such as `preview-42`.

### Roles and Permissions

| Role | Can List | Can Create | Can Rotate | Can Delete | Can Manage Identities |
|------|----------|------------|------------|------------|----------------------|
| `owner` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user` | ✅ | ❌ | ❌ | ❌ | ❌ |

The role is set during registration (`owner` for the first user) and embedded in the JWT. It cannot be changed by the frontend.

---

## Runtime Secret Consumption

For production workloads, use **Machine Identity Passports** instead of a human JWT.

### 1. Create a passport

```http
POST /api/v1/projects/{projectId}/identities
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "payment-service-prod",
  "scopes": ["prod:read"]
}
```

**Response**

```json
{
  "message": "Machine Identity created. Save this passport — the token will NOT be shown again.",
  "passport": {
    "token": "bv_...",
    "tenantId": "uuid",
    "identityId": "uuid",
    "name": "payment-service-prod",
    "scopes": ["prod:read"],
    "apiUrl": "http://localhost:3000",
    "expiresAt": "2026-05-01T00:00:00.000Z"
  }
}
```

### 2. Fetch a secret at runtime

```http
GET /api/v1/projects/{projectId}/environments/prod/secrets/DATABASE_URL/value
X-Passport-Token: bv_...
```

```json
{
  "value": "postgres://user:pass@host:5432/db"
}
```

### 3. Keep the secret in memory only

- Store passport tokens in your platform secret manager.
- Fetch secrets during startup or a controlled refresh path.
- Do not log plaintext values.
- Never commit passport tokens or fetched secrets to source control.

### Scope grammar

Scopes follow `environment:action`.

Examples:

- `prod:read`
- `staging:read`
- `preview-42:read`
- `*:read`
- `prod:*`

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| `400` | Bad Request — validation failed | Check request body format |
| `401` | Unauthorized — token missing/invalid | Re-authenticate or refresh token |
| `403` | Forbidden — insufficient role or cross-project | Check user role and project context |
| `404` | Not Found — resource does not exist | Verify resource name and tenant |
| `409` | Conflict — duplicate resource | Secret name already exists in this scope |
| `429` | Too Many Requests — rate limited | Wait and retry after `Retry-After` seconds |
| `500` | Internal Server Error | Report to backend team |

### Handling 401

For frontend JWT flows, a `401` usually means the access token expired.

For runtime passport flows, a `401` usually means the passport is revoked, invalid, or expired.

### Handling 429

Sensitive endpoints are rate limited. Back off and retry with jitter.

---

## Next.js Example

Use `NEXT_PUBLIC_API_URL` for browser-visible API URLs.

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
```

### Browser API client

```typescript
async function apiFetch(path: string, token?: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}
```

### Runtime service example

```typescript
export async function fetchRuntimeSecret({
  apiBase,
  tenantId,
  environment,
  secretName,
  passportToken,
}: {
  apiBase: string;
  tenantId: string;
  environment: string;
  secretName: string;
  passportToken: string;
}) {
  const response = await fetch(
    `${apiBase}/api/v1/projects/${tenantId}/environments/${environment}/secrets/${secretName}/value`,
    {
      headers: {
        'X-Passport-Token': passportToken,
      },
      cache: 'no-store',
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Secret fetch failed: ${response.status}`);
  }

  return data.value as string;
}
```

### Refresh interceptor example

Implement an interceptor that catches `401` and refreshes the JWT:

```typescript
// Example: Axios interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const { accessToken, refreshToken: newRefresh } = await refreshTokens();

      // Update stored tokens
      setAccessToken(accessToken);
      setRefreshToken(newRefresh);

      // Retry the original request
      error.config.headers.Authorization = `Bearer ${accessToken}`;
      return api(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## Common Pitfalls

### 1. Forgetting the `projectId` in URLs

Every project endpoint requires `projectId` in the URL path. Get it from the login response (`user.tenantId`) and store it in your auth context.

### 7. Ignoring guardrail policy

Project settings define secret guardrails (required metadata and production confirmations). Read and apply `/api/v1/projects/{projectId}/settings` to keep UX behavior aligned with policy.

### 2. Over-scoping machine identities

Avoid `*:*` unless the workload genuinely needs universal access.

### 3. Not refreshing tokens

Access tokens expire after 30 minutes. Set up an interceptor to automatically refresh them, or users will get `401` errors.

### 4. Logging or caching secret values

Never write decrypted secret values to `console.log`, `localStorage`, or the browser cache. The `/value` endpoint sets `Cache-Control: no-store` — respect it.

### 5. Handling rate limits

Write endpoints (create secret) are rate limited to 10 requests per 60 seconds. If you get a `429` response, check the `Retry-After` header and wait.

### 6. CORS errors

If you see CORS errors, make sure your frontend origin is listed in the `CORS_ORIGINS` environment variable in `apps/api/.env`. Multiple origins are comma-separated:

```
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## Health Check

Use this endpoint to verify connectivity before making authenticated requests:

```http
GET /health
```

```json
{
  "status": "OK",
  "version": "1.0.0",
  "uptime": 12345.67
}
```
