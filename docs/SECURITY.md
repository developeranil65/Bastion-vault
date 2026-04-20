# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, **do not open a public issue**. Report it privately to the Bastion Vault maintainers with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment

We will acknowledge receipt within 24 hours and provide a fix timeline within 72 hours.

---

## Authentication

Bastion Vault supports two authentication methods:

| Method | Use Case | Header |
|--------|----------|--------|
| JWT Bearer Token | Human users (web, admin) | `Authorization: Bearer <token>` |
| Machine Identity Passport | CLI tools, services | `X-Passport-Token: <token>` |

### JWT Claims

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "admin",
  "tenantId": "tenant-uuid",
  "permissions": ["read_secrets", "manage_secrets"],
  "iat": 1711709000,
  "exp": 1711710800
}
```

Role and tenant information is read **exclusively from the JWT payload**. Client-sent role headers are ignored.

---

## Encryption

### Envelope Encryption (AES-256-GCM)

Each secret is encrypted with its own Data Encryption Key (DEK). The DEK is then encrypted by the master Key Encryption Key (KEK).

```
Plaintext → [DEK encrypts data] → encryptedData + iv + authTag
      DEK → [KEK encrypts DEK]  → encryptedDek + dekIv + dekAuthTag
```

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key Size | 256 bits (32 bytes) |
| IV Size | 96 bits (12 bytes) |
| Auth Tag | 128 bits (16 bytes) |
| DEK Generation | `crypto.randomBytes(32)` per secret |

### What Is Stored

| Column | Content | Encrypted |
|--------|---------|-----------|
| `encryptedData` | Secret ciphertext | Yes (AES-256-GCM) |
| `encryptedDek` | Wrapped DEK | Yes (AES-256-GCM) |
| `iv`, `authTag` | Data encryption parameters | Hex (not sensitive alone) |
| `dekIv`, `dekAuthTag` | DEK encryption parameters | Hex (not sensitive alone) |
| `name` | Secret identifier | No |

### What Is Never Stored

- Plaintext secret values
- Unencrypted DEKs
- Secret values in audit logs
- Secret values in error messages

---

## Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | `default-src 'self'` | XSS prevention |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | HTTPS enforcement |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing prevention |
| `X-Frame-Options` | `DENY` | Clickjacking prevention |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer control |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Browser API restrictions |
| `Cache-Control` | `no-store, no-cache, must-revalidate, private` | Cache prevention |

---

## Rate Limiting

| Endpoint | Limit | Window | Backend |
|----------|-------|--------|---------|
| Secret creation | 10 requests | 60 seconds | Redis sorted set |
| Passport creation | 5 requests | 60 seconds | Redis sorted set |
| Secret value fetch | 60 requests | 60 seconds | Redis sorted set |
| Fallback (all) | 100 requests | 60 seconds | In-memory |

Key format: `bastion:ratelimit:{client_ip}:{route_path}`

The circuit breaker opens after 5 consecutive Redis failures and resets after 30 seconds.

---

## Audit Logging

| Property | Value |
|----------|-------|
| Integrity | HMAC-SHA256 chain (each entry hashes the previous) |
| Tenant Isolation | All logs scoped by `tenantId` |
| Logged Actions | `CREATE`, `LIST`, `ROTATE`, `DELETE`, `ACCESS_VALUE`, `REVOKE` |
| Retention | Indefinite for audit entries, 90 days for soft-deleted secrets |

HMAC computation:
```
HMAC(tenantId + actorId + action + resourceId + metadata + previousHash)
```

Tampering with any entry in the chain is detectable by verifying the hash sequence.

---

## Incident Response

### Severity Levels

| Level | Response Time | Example |
|-------|---------------|---------|
| P0 — Critical | Immediate (< 1 hour) | Confirmed data breach |
| P1 — High | < 24 hours | Exploitable IDOR |
| P2 — Medium | < 3 days | Missing rate limit on endpoint |
| P3 — Low | Next release | Verbose log message |

### Response Procedure

1. **Identify** — Detect via monitoring, tests, or external report.
2. **Contain** — Disable the affected endpoint or rotate compromised keys.
3. **Fix** — Deploy a code patch addressing the root cause.
4. **Recover** — Rotate affected secrets, invalidate sessions.
5. **Review** — Add regression tests, conduct post-mortem.

### Key Rotation After Compromise

```bash
# Generate new encryption master key
openssl rand -hex 32

# Generate new JWT secrets
openssl rand -base64 48

# Update .env with new values
# Restart the API — all existing JWTs are invalidated immediately
# Rotate all secrets via the API rotation endpoint
```
