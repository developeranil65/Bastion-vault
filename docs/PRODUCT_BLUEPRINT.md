# Bastion Vault Product Blueprint

## Product Thesis

Bastion Vault delivers the practical security outcomes teams want from enterprise secret managers at much lower operational overhead:

- Target: ~95% of high-value controls for most SaaS teams.
- Cost profile: ~20% of the staffing and complexity of self-operated enterprise Vault stacks.
- Principle: opinionated defaults over unlimited knobs.

## Ideal Customer Profile

- Engineering orgs with 5-100 developers.
- Teams deploying to cloud/Kubernetes with CI/CD.
- Companies that have outgrown `.env` files and ad hoc secret sharing.
- Buyers: platform leads, security leads, CTOs at growth-stage companies.

## Core Object Model

`Organization -> Project -> Environment -> Secret / Identity / Audit`

- **Organization**: billing + top-level governance.
- **Project**: isolation boundary for teams/apps/domains.
- **Environment**: `dev`, `staging`, `prod` (plus optional custom envs later).
- **Secret**: versioned key/value object with metadata and rotation history.
- **Identity**: machine identity with scoped access (`env:action`).
- **Audit Event**: append-only, tamper-evident operation log.

Implementation note: current backend uses `tenant` as the isolation primitive. Product-facing UX should call this a **project** while API compatibility is preserved.

## Primary User Journeys

## 1) Admin onboarding journey

1. Create organization.
2. Create first project (`payments-api`).
3. Create environments.
4. Invite users with roles.
5. Create machine identity for CI/CD.
6. Add baseline secrets.
7. Configure rotation policy and alerting.

Success metric: first runtime fetch in under 15 minutes.

## 2) Developer delivery journey

1. Select project.
2. Add/update secret in `dev`.
3. Promote value strategy to `staging`/`prod`.
4. Fetch secret at runtime in application.
5. Verify audit trail for read/rotate actions.

Success metric: no plaintext secrets in repo or pipelines.

## 3) Security operations journey

1. Detect suspicious access pattern.
2. Filter audit stream by identity/resource.
3. Revoke compromised identity.
4. Rotate affected secrets.
5. Export compliance evidence.

Success metric: time-to-contain under 10 minutes.

## Why This Beats `.env` Files

- Centralized control with access policy and revocation.
- Runtime retrieval eliminates broad static secret distribution.
- Versioning and rotation reduce credential lifetime.
- Tamper-evident audit improves incident response and compliance.
- Blast radius is constrained by project/environment scoping.

## Security Controls Baseline

- Envelope encryption (AES-256-GCM with wrapped DEKs).
- JWT auth and scoped machine passports.
- Rate limiting on sensitive endpoints.
- Strict project isolation checks on all requests.
- Input validation with size and character restrictions.
- HMAC-chained audit integrity.

## UX Information Architecture

Protected app navigation should be:

1. **Overview**
2. **Projects**
3. **Secrets**
4. **Access**
5. **Audit**
6. **Settings**

Key UX requirements:

- Persistent project context in top bar.
- Fast environment switcher on secret screens.
- “Shown once” handling for machine identity token issuance.
- Audit timeline with actor/resource/action filters.
- Copy-paste runnable integration snippets per language.

## API Contract Direction

Near-term: keep existing routes stable for compatibility.

Mid-term path version proposal:

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/:projectId/environments/:environment/secrets`
- `POST /api/v1/projects/:projectId/identities`
- `GET /api/v1/projects/:projectId/audit`

Compatibility strategy:

- Maintain existing `/tenants/*` and `/secrets/:tenantId/*` routes.
- Add project aliases and deprecation headers.
- Document dual route support before any removals.

## Packaging and Pricing Shape

- **Starter**: single org, limited projects, core audit retention.
- **Growth**: SSO, higher limits, policy templates.
- **Enterprise**: advanced audit export, extended retention, support SLA.

Pricing principle: charge by active identities + secret operations, not seat count only.

## KPI Set

- Time to first runtime fetch.
- Secrets rotated per 30 days.
- Percentage of identities with least-privilege scopes.
- Audit coverage of sensitive operations.
- Incidents involving leaked static credentials.

## Execution Roadmap

## Phase 1 (Now)

- Finalize product language (`project` in UI).
- Ship projects view and context-centric navigation.
- Publish integration docs and quickstarts.

## Phase 2

- Add project CRUD APIs and UI.
- Add policy templates and safer defaults by environment.
- Add audit filtering and export endpoints.

## Phase 3

- Add dynamic secrets integrations.
- Add automated rotation jobs and expiry enforcement.
- Add enterprise controls (SSO, SCIM, SIEM streaming).
