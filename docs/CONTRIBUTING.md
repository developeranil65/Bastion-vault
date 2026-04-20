# Contributing to Bastion Vault

Thank you for your interest in contributing. This document covers the development workflow, code style standards, and the pull request process.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### Development Setup

```bash
git clone https://github.com/yourusername/bastion-vault.git
cd bastion-vault

# Automated setup
bash scripts/setup-dev.sh

# Or manually:
docker compose -f docker/compose.yml up -d postgres redis
cd apps/api
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
npm test   # Verify all tests pass
```

---

## Code of Conduct

- Be respectful and constructive in all interactions.
- Never commit secrets, API keys, or credentials.
- Report security vulnerabilities privately — see [SECURITY.md](./SECURITY.md).

---

## Contribution Workflow

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes following the guidelines below.
4. Write tests for all new functionality.
5. Ensure all tests pass: `npm test`
6. Submit a Pull Request targeting `main`.

---

## Code Style

### General Rules

- **TypeScript strict mode** is enforced. No `any` in production code.
- Use `const` by default, `let` only when reassignment is required.
- Use `async/await` over raw Promises.
- Validate all inputs with Zod schemas.

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `secret-service.ts` |
| Classes | PascalCase | `SecretService` |
| Functions | camelCase | `createSecret()` |
| Constants | UPPER_SNAKE_CASE | `ENCRYPTION_MASTER_KEY` |
| Interfaces | PascalCase | `AuthContext` |

### Formatting

```bash
npm run format   # Prettier
npm run lint     # ESLint
```

---

## Testing

### Requirements

- All new code must have test coverage.
- All existing tests must pass before submitting a PR.
- Security-sensitive changes require security-specific tests.

### Running Tests

```bash
npm test                              # Full suite
npx vitest run src/__tests__/FILE     # Single file
npx vitest --watch                    # Watch mode
```

### Test Structure

Security tests are located in `apps/api/test/security/` and should be treated as the trusted baseline suite:

| File | Domain |
|------|--------|
| `tenant-isolation.test.ts` | Cross-tenant access blocking |
| `input-hardening.test.ts` | Injection and payload validation |
| `rate-limit-ddos.test.ts` | Burst abuse / DoS resistance |

---

## Security Requirements

These apply to every pull request:

1. Never commit `.env` files, API keys, or passwords.
2. Document new environment variables in `.env.example`.
3. Use Prisma for all database queries — no raw SQL.
4. Return generic error messages to clients — never expose stack traces or Prisma error codes.
5. Never log secret values, tokens, or OTP codes.
6. Read user roles from JWT claims only — never from client headers.
7. Apply rate limiting to write endpoints.

### Security Review Checklist

- [ ] No secrets in the diff
- [ ] All inputs validated with Zod
- [ ] Error responses are generic
- [ ] Audit logs contain no sensitive values
- [ ] All tests pass
- [ ] New tests cover new attack surfaces

---

## Pull Request Process

### PR Title Format

```
[TYPE] Brief description
```

| Prefix | Usage |
|--------|-------|
| `[FEAT]` | New feature |
| `[FIX]` | Bug fix |
| `[SEC]` | Security patch |
| `[DOCS]` | Documentation |
| `[TEST]` | Test changes |
| `[REFACTOR]` | Code restructuring |

### Review Process

1. CI runs all tests and lint checks.
2. At least one maintainer approval is required.
3. Security review is required for changes to `middlewares/`, `services/`, or `routes/`.
4. PRs are squash-merged into `main`.

---

## Versioning

Bastion Vault follows [Semantic Versioning](https://semver.org/):

- **MAJOR** — Breaking API changes
- **MINOR** — New features (backward compatible)
- **PATCH** — Bug fixes and security patches

---

## License

By submitting a pull request, you agree that your contribution will be licensed under the [MIT License](../LICENSE).
