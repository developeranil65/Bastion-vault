# Bastion Vault

<div align="center">
  <strong>Open-Source Secrets Management Platform</strong>
  <br /><br />
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-336791" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-7-DC382D" alt="Redis" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
</div>

---

## Overview

Bastion Vault is a multi-tenant secrets management platform built with TypeScript, PostgreSQL, Redis, and Next.js. It provides envelope encryption (AES-256-GCM), role-based access control, HMAC-chained audit logging, OTP login for human users, and Machine Identity Passports for services that fetch secrets at runtime.

### Key Features

- **Envelope Encryption** — Each secret is encrypted with a unique DEK, which is itself encrypted by a master KEK.
- **Multi-Tenant Isolation** — All data is scoped to tenants with middleware-enforced row-level security.
- **HMAC-Chained Audit Logs** — Tamper-evident audit trail where each entry hashes the previous one.
- **Dual Authentication** — Supports JWT (human users) and Machine Identity Passports (CLI/services).
- **Redis Rate Limiting** — Sliding window algorithm with circuit breaker and in-memory fallback.
- **Runtime Secret Fetching** — Services authenticate with one-time-issued Machine Identity Passports over `X-Passport-Token`.

---

## Architecture

```
Client ──▶ Express API ──────────────────────────────────────────────
            │                                                       │
            ├── Auth Middleware (JWT / Passport Token)               │
            ├── RBAC Middleware (Role + Scope Validation)            │
            ├── Rate Limiter (Redis Sliding Window)                  │
            │                                                       │
            ├── Controllers ─── Services ─── Prisma ORM             │
            │                      │                                │
            │                      ├── EncryptionService            │
            │                      │     AES-256-GCM Envelope       │
            │                      │                                │
            │                      ├── SecretService                │
            │                      │     CRUD + Audit Logging       │
            │                      │                                │
            │                      └── MachineIdentityService       │
            │                            Passport Lifecycle         │
            │                                                       │
            ├── PostgreSQL 15 ── Encrypted Secrets + Users          │
            ├── Redis 7 ──────── Rate Limiting + Caching            │
            └── Helmet + CORS ── Security Headers                   │
            ────────────────────────────────────────────────────────
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 18+ / TypeScript 5.3 | Application server |
| ORM | Prisma 5 | Type-safe, parameterized database queries |
| Database | PostgreSQL 15 | Secrets, users, tenants, audit logs |
| Cache | Redis 7 | Rate limiting with sorted set sliding window |
| Auth | JWT + OTP + Passports | Human and machine authentication |
| Encryption | AES-256-GCM | Envelope encryption with per-secret DEKs |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose

### Setup

```bash
# Configure required secrets first
cp .env.example .env

# Full stack in Docker
docker compose -f docker/compose.yml up -d --build
```

The API starts at `http://localhost:3000`.
The frontend starts at `http://localhost:3001`.
Swagger docs are available at `http://localhost:3000/api-docs`.

### Local API development

```bash
docker compose -f docker/compose.yml up -d postgres redis
cd apps/api
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

### Generate Secure Keys

```bash
# Encryption master key (64 hex chars)
openssl rand -hex 32

# JWT secrets
openssl rand -base64 48
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Signing key for access tokens |
| `JWT_REFRESH_SECRET` | Yes | Signing key for refresh tokens |
| `ENCRYPTION_MASTER_KEY` | Yes | Master key for envelope encryption (64 hex chars) |
| `NODE_ENV` | No | `development` / `production` / `test` |
| `PORT` | No | API server port (default: `3000`) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |

---

## API Endpoints

Full interactive documentation is available at `/api-docs` (Swagger UI).

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | — | Register user + auto-create tenant |
| POST | `/api/v1/auth/otp/send` | — | Send OTP to registered email |
| POST | `/api/v1/auth/login` | — | Login with email + OTP |
| POST | `/api/v1/auth/refresh` | — | Refresh access token |
| GET | `/api/v1/auth/me` | Bearer | Get current user info |

### Secrets

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/v1/projects/:projectId/environments/:env/secrets` | Bearer | admin+ | Create encrypted secret |
| GET | `/api/v1/projects/:projectId/environments/:env/secrets` | Bearer | viewer+ | List secrets (metadata only) |
| GET | `/api/v1/projects/:projectId/environments/:env/secrets/:name/value` | Bearer/Passport | — | Fetch decrypted value |
| PUT | `/api/v1/projects/:projectId/environments/:env/secrets/:name/rotate` | Bearer | admin+ | Rotate secret |
| DELETE | `/api/v1/projects/:projectId/environments/:env/secrets/:name` | Bearer | admin+ | Soft-delete secret |

### Machine Identities

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/v1/projects/:projectId/identities` | Bearer | admin+ | Create Machine Identity |
| GET | `/api/v1/projects/:projectId/identities` | Bearer | admin+ | List identities |
| GET | `/api/v1/projects/:projectId/identities/:id` | Bearer | admin+ | Get identity details |
| DELETE | `/api/v1/projects/:projectId/identities/:id` | Bearer | admin+ | Revoke identity |

---

## Runtime Secret Consumption

The intended SaaS workflow for external applications is:

1. A human admin signs in to Bastion Vault.
2. The admin creates a **Machine Identity Passport** for a workload.
3. The raw passport token is shown **once** and stored in that workload's secret store.
4. The workload fetches secrets at runtime from Bastion Vault using `X-Passport-Token`.
5. Plaintext is kept in memory only and never persisted to disk.

### Create a Machine Identity

```http
POST /api/v1/projects/{projectId}/identities
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "name": "payment-service-prod",
  "scopes": ["prod:read"],
  "expiresAt": "2026-12-31T00:00:00.000Z"
}
```

### Fetch a secret at runtime

```http
GET /api/v1/projects/{projectId}/environments/prod/secrets/DATABASE_URL/value
X-Passport-Token: bv_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```json
{
  "value": "postgres://user:pass@host:5432/db"
}
```

### Recommended runtime behavior

- Keep passport tokens in your deployment secret store, not in source control.
- Fetch secrets during process bootstrap or short-lived refresh paths.
- Do not log secret values.
- Treat `401` as re-auth / re-issue passport, `403` as scope error, `404` as config error, and `429` as retryable backoff.
- Configure project-level secret guardrails under `Settings -> Secret guardrails policy` to enforce metadata and production confirmations.

## Project Structure

``` 
bastion-vault/
├── apps/
│   ├── api/                    # Express API
│   │   ├── src/
│   │   │   ├── config/         # Environment, Redis, Swagger
│   │   │   ├── controllers/    # HTTP request handlers
│   │   │   ├── middlewares/    # Auth, RBAC, rate limiting
│   │   │   ├── routes/         # Route definitions + OpenAPI docs
│   │   │   ├── schemas/        # Zod validation schemas
│   │   │   ├── services/       # Business logic + encryption
│   │   │   ├── utils/          # Logger, crypto, request helpers
│   │   │   └── __tests__/      # Vitest test suite
│   │   └── prisma/             # Database schema
├── docker/                     # Docker Compose configuration
├── docs/                       # Documentation
│   ├── CONTRIBUTING.md
│   ├── SECURITY.md
│   └── FRONTEND_GUIDE.md
├── scripts/                    # Development utilities
└── .github/workflows/          # CI/CD pipelines
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Frontend Integration Guide](./docs/FRONTEND_GUIDE.md) | Frontend + runtime consumer guide |
| [Contributing](./docs/CONTRIBUTING.md) | Development setup, code style, PR process |
| [Security Policy](./docs/SECURITY.md) | Encryption specs, headers, incident response |
| [API Docs (Swagger)](http://localhost:3000/api-docs) | Interactive API reference |

---

## Testing

```bash
cd apps/api

# Run all tests
npm test

# Run hardened security suite explicitly
npm run test:security
```

---

## Deployment

### Docker

```bash
# Build the image
docker build -t bastion-vault-api .

# Run with Docker Compose
docker compose -f docker/compose.yml up -d
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `ENCRYPTION_MASTER_KEY`
- [ ] Set a strong `REDIS_PASSWORD` and `POSTGRES_PASSWORD`
- [ ] Configure `CORS_ORIGINS` to your frontend domain
- [ ] Terminate TLS at your reverse proxy (Nginx/Caddy)
- [ ] Run `npx prisma migrate deploy` for schema migrations
- [ ] Remove any local `.env` files before sharing the repo
- [ ] Keep Postgres and Redis internal-only (no public host port mappings)
- [ ] Store Machine Identity Passports in an external secret store

---

## License

This project is licensed under the [MIT License](./LICENSE).

## Contact

- **Issues:** Open an issue in your Bastion Vault repository
- **Security:** See [SECURITY.md](./docs/SECURITY.md) for responsible disclosure
