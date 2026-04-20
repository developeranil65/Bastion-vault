import Link from 'next/link';

export default function DocumentationPage() {
  return (
    <div className="min-h-screen font-body" style={{ background: 'var(--surface-base)', color: 'var(--on-surface)' }}>
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[rgba(11,13,17,0.85)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-3 font-headline text-sm font-semibold">
            <span
              className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border-subtle)] font-mono text-[10px] font-bold text-[var(--primary-fixed-dim)]"
              style={{ background: 'var(--surface-container)' }}
            >
              BV
            </span>
            Bastion Vault
          </Link>
          <nav className="flex items-center gap-6 text-sm text-[var(--on-surface-variant)]">
            <Link href="/" className="hover:text-[var(--on-surface)]">
              Home
            </Link>
            <span className="text-[var(--on-surface)]">Documentation</span>
            <Link href="/login" className="rounded-md border border-[rgba(45,212,191,0.35)] bg-[var(--primary-container)] px-4 py-2 text-[var(--on-primary-container)] hover:brightness-110">
              Console
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 lg:flex lg:gap-12">
        <aside className="mb-10 w-full shrink-0 lg:mb-0 lg:w-56">
          <nav className="sticky top-24 space-y-6 text-sm">
            <div>
              <div className="kv-kicker mb-2">Start</div>
              <ul className="space-y-2 text-[var(--on-surface-variant)]">
                <li className="text-[var(--on-surface)]">Overview</li>
                <li>Human auth</li>
                <li>Runtime secrets</li>
              </ul>
            </div>
            <div>
              <div className="kv-kicker mb-2">Consume</div>
              <ul className="space-y-2 text-[var(--on-surface-variant)]">
                <li>JWT for console apps</li>
                <li>Passport for services</li>
                <li>Error handling</li>
              </ul>
            </div>
          </nav>
        </aside>

        <article
          className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] p-8 lg:p-10"
          style={{ background: 'var(--surface-container)' }}
        >
          <p className="kv-kicker mb-3">Documentation</p>
          <h1 className="font-headline text-3xl font-semibold tracking-tight">Consume Bastion Vault</h1>
          <p className="mt-4 text-[var(--on-surface-variant)] leading-relaxed">
            Bastion Vault exposes a web console for operators and an API for applications that need runtime secret retrieval. Human users
            authenticate with OTP. Services should authenticate with Machine Identity Passports and fetch secrets over HTTPS at runtime.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container-low)] p-4">
              <div className="kv-kicker">Why it exists</div>
              <p className="mt-2 text-sm">Replace scattered `.env` files and ad hoc credential sharing with a real secrets operating model.</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container-low)] p-4">
              <div className="kv-kicker">Who uses it</div>
              <p className="mt-2 text-sm">Platform teams, application teams, and security reviewers who need one shared control plane.</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container-low)] p-4">
              <div className="kv-kicker">Core promise</div>
              <p className="mt-2 text-sm">Secure secret delivery, scoped machine access, and audit-ready visibility without excessive ops complexity.</p>
            </div>
          </div>

          <h2 className="font-headline mt-10 text-xl font-semibold">Core concepts</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--on-surface-variant)]">
            <li>
              <strong className="text-[var(--on-surface)]">Project (tenant primitive)</strong> — isolation boundary for secrets and members.
            </li>
            <li>
              <strong className="text-[var(--on-surface)]">Environment</strong> — dev, staging, or prod slice of the secret store.
            </li>
            <li>
              <strong className="text-[var(--on-surface)]">Passport</strong> — short-lived or scoped token material for automation; treat
              like a secret.
            </li>
          </ul>

          <h2 className="font-headline mt-10 text-xl font-semibold">API base URL</h2>
          <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
            Point clients at <code className="mono text-[var(--primary-fixed-dim)]">{`process.env.NEXT_PUBLIC_API_URL`}</code> (see your
            deployment). Use bearer tokens for browser or console requests. Use `X-Passport-Token` for service-to-service runtime access.
          </p>

          <h2 className="font-headline mt-10 text-xl font-semibold">Human login flow</h2>
          <div className="terminal mt-4">
            <div>
              <span className="comment"># 1. request OTP</span>
            </div>
            <div>
              <span className="keyword">POST</span> /api/v1/auth/otp/send
            </div>
            <div>
              <span className="comment"># 2. exchange OTP for JWTs</span>
            </div>
            <div>
              <span className="keyword">POST</span> /api/v1/auth/login
            </div>
          </div>

          <h2 className="font-headline mt-10 text-xl font-semibold">Runtime secret workflow</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-[var(--on-surface-variant)]">
            <li>Admin creates a Machine Identity Passport for a workload.</li>
            <li>The raw token is shown once and stored in that workload&apos;s secret manager.</li>
            <li>The workload calls Bastion Vault using <code className="mono text-[var(--primary-fixed-dim)]">X-Passport-Token</code>.</li>
            <li>The plaintext secret is kept in memory only.</li>
          </ol>

          <div className="terminal mt-6">
            <div>
              <span className="comment"># Create a passport (admin JWT required)</span>
            </div>
            <div>
              <span className="keyword">POST</span> /api/v1/projects/&lt;projectId&gt;/identities
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <span className="comment"># Fetch a runtime secret (service passport)</span>
            </div>
            <div>
              <span className="keyword">GET</span> /api/v1/projects/&lt;projectId&gt;/environments/prod/secrets/DATABASE_URL/value
            </div>
            <div>
              <span className="keyword">X-Passport-Token</span>: <span className="string">bv_...</span>
            </div>
          </div>

          <h2 className="font-headline mt-10 text-xl font-semibold">Consumer guidance</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--on-surface-variant)]">
            <li>Use JWTs in frontend apps and operator tooling.</li>
            <li>Use scoped passports such as <code className="mono text-[var(--primary-fixed-dim)]">prod:read</code> for runtime services.</li>
            <li>Treat <code className="mono text-[var(--primary-fixed-dim)]">401</code> as expired/invalid auth, <code className="mono text-[var(--primary-fixed-dim)]">403</code> as scope/project mismatch, and <code className="mono text-[var(--primary-fixed-dim)]">429</code> as retryable.</li>
            <li>Never persist fetched secrets to logs, local storage, or git.</li>
          </ul>

          <div className="terminal mt-8">
            <div>
              <span className="comment"># Example: health</span>
            </div>
            <div>
              <span className="keyword">curl</span> -s <span className="string">&quot;$API/health&quot;</span>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <span className="comment"># Example: runtime fetch</span>
            </div>
            <div>
              <span className="keyword">curl</span> -H <span className="string">&quot;X-Passport-Token: $PASSPORT&quot;</span>{' '}
              <span className="string">&quot;$API/api/v1/projects/$PROJECT_ID/environments/prod/secrets/DATABASE_URL/value&quot;</span>
            </div>
          </div>

          <h2 className="font-headline mt-10 text-xl font-semibold">Project guardrails policy</h2>
          <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
            Project admins can configure secret guardrails in Settings, including required metadata and production confirmation controls.
            Secrets UI enforces this policy in real time.
          </p>

          <h2 className="font-headline mt-10 text-xl font-semibold">How an organization should use Bastion</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[var(--on-surface-variant)]">
            <li>Create one project per application, domain, or platform boundary.</li>
            <li>Use environments to separate delivery stages such as `dev`, `staging`, and `prod`.</li>
            <li>Store secret values only in Bastion, not in repos, CI variables, or shared docs.</li>
            <li>Issue machine identities for workloads and scope them narrowly by environment and action.</li>
            <li>Enable project guardrails so production writes require deliberate operator confirmation.</li>
            <li>Review audit trails regularly for secret reads, rotations, and identity issuance.</li>
          </ol>

          <h2 className="font-headline mt-10 text-xl font-semibold">Why teams choose it over `.env` files</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--on-surface-variant)]">
            <li>Secrets are fetched at runtime instead of spread across laptops, CI systems, and deployment manifests.</li>
            <li>Access is revocable and scoped instead of being copied forever.</li>
            <li>Every sensitive operation becomes visible in audit history.</li>
            <li>Project guardrails make production workflows safer for real teams under pressure.</li>
          </ul>
        </article>
      </main>

      <footer className="border-t border-[var(--border-subtle)] py-8 text-center text-xs text-[var(--outline)]">
        Bastion Vault · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
