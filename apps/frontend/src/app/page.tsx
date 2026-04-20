import Link from 'next/link';
import Image from 'next/image';

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border-subtle)] font-mono text-xs font-bold text-[var(--primary-fixed-dim)] ${className}`}
      style={{ background: 'var(--surface-container)' }}
    >
      BV
    </span>
  );
}

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen overflow-x-hidden text-[var(--on-surface)] font-body" style={{ background: '#04070b' }}>
      {/* Nav — Leadgen-style */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
          <Link href="/" className="flex items-center gap-3 font-headline text-sm font-semibold tracking-tight text-white">
            <BrandMark />
            Bastion Vault
          </Link>
          <nav className="hidden items-center gap-10 text-sm text-neutral-400 md:flex">
            <a href="#bento" className="transition-colors hover:text-white">
              Product
            </a>
            <a href="#features" className="transition-colors hover:text-white">
              Platform
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              Pricing
            </a>
            <Link href="/docs" className="transition-colors hover:text-white">
              Resources
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm text-neutral-400 transition-colors hover:text-white sm:inline">
              Login
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
            >
              Open console
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero — badge, headline, gradient streak */}
        <section className="relative border-b border-neutral-900 hero-gradient">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,18,24,0.9)_0%,#000_50%)]" />
          <div className="hero-orb right-[8%] top-16 h-64 w-64 bg-[radial-gradient(circle,rgba(55,230,213,0.28),transparent_65%)]" />
          <div className="hero-orb alt left-[6%] top-40 h-72 w-72 bg-[radial-gradient(circle,rgba(107,139,255,0.18),transparent_65%)]" />
          <div className="noise-bg pointer-events-none absolute inset-0 opacity-[0.35]" />
          <div className="marketing-grid pointer-events-none absolute inset-0 opacity-[0.08]" />

          <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-16 md:pb-32 md:pt-24">
            <div className="marketing-reveal mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/80 px-4 py-1.5 text-xs font-medium text-neutral-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Enterprise secrets control plane
            </div>
            <h1 className="marketing-reveal max-w-4xl font-headline text-4xl font-semibold leading-[1.02] tracking-tight text-white md:text-5xl lg:text-[3.6rem]">
              Operate secrets with precision—across environments, identities, and audit.
            </h1>
            <p className="marketing-reveal mt-6 max-w-2xl text-lg leading-relaxed text-neutral-400">
              Bastion Vault exists because modern teams need Vault-grade operating discipline without enterprise-platform drag. Centralize runtime
              secrets, enforce project guardrails, and prove every access event in one operator-grade console.
            </p>
            <div className="marketing-reveal mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
              >
                Get started →
              </Link>
              <Link
                href="/docs"
                className="inline-flex justify-center rounded-full border border-neutral-700 bg-neutral-950 px-8 py-3.5 text-sm font-medium text-white transition hover:border-neutral-500 hover:bg-neutral-900"
              >
                Documentation
              </Link>
            </div>
            <div className="marketing-reveal mt-8 flex flex-wrap gap-3 text-xs text-neutral-500">
              <span className="rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1.5">95% practical security outcomes</span>
              <span className="rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1.5">Project-first access control</span>
              <span className="rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1.5">Audit-first operations</span>
            </div>

            <div className="marketing-float mt-16 overflow-hidden rounded-[28px] border border-neutral-800 bg-neutral-950/80 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
              <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-4 text-[10px] uppercase tracking-wider text-neutral-600">bastion-console</span>
              </div>
              <Image
                src="/vault-console-hero.svg"
                alt="Bastion Vault operations console preview"
                width={1200}
                height={760}
                className="h-auto w-full"
                priority
              />
            </div>
          </div>
        </section>

        {/* Bento — “Deployments made easy” style, vault-themed */}
        <section id="bento" className="border-b border-neutral-900 py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="font-headline text-3xl font-semibold tracking-tight text-white md:text-4xl">Secrets operations, simplified</h2>
            <p className="mt-3 max-w-xl text-neutral-400">From seal to rotation—see how teams run Bastion day to day.</p>

            <div className="mt-14 grid gap-4 md:grid-cols-12 md:grid-rows-[auto_auto]">
              <div className="flex flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-950 p-8 md:col-span-7 md:min-h-[280px]">
                <div>
                  <h3 className="font-headline text-lg font-semibold text-white">Path to production</h3>
                  <p className="mt-2 max-w-md text-sm text-neutral-400">Commit, seal, and roll secrets through dev → staging → prod without leaving the console.</p>
                </div>
                <div className="mt-8 flex flex-wrap items-end gap-3">
                  <div className="rounded-xl border border-neutral-800 bg-black p-3 font-mono text-[10px] leading-relaxed text-emerald-400/90">
                    git push
                    <br />
                    <span className="text-neutral-500">trigger seal</span>
                  </div>
                  <div className="pb-2 text-neutral-600">→</div>
                  <div className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-xs font-medium text-white">Bastion</div>
                  <div className="pb-2 text-neutral-600">→</div>
                  <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-300">live · rotated</div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 md:col-span-5 md:min-h-[280px]">
                <h3 className="font-headline text-lg font-semibold text-white">Console density</h3>
                <p className="mt-2 text-sm text-neutral-400">Tables, scopes, and audit rows—built for operators, not slides.</p>
                <div className="mt-6 space-y-2 rounded-xl border border-neutral-800 bg-black/60 p-4">
                  <div className="flex justify-between text-[10px] text-neutral-500">
                    <span>reads / 24h</span>
                    <span className="text-emerald-400/80">+12%</span>
                  </div>
                  <div className="flex h-16 items-end gap-1">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-emerald-900/40 to-emerald-500/60" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 md:col-span-5 md:min-h-[260px]">
                <h3 className="font-headline text-lg font-semibold text-white">Global-ready</h3>
                <p className="mt-2 text-sm text-neutral-400">Pin workloads to regions; keep policy and audit in one place.</p>
                <div className="marketing-float slow relative mt-6 overflow-hidden rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900 to-black p-3">
                  <Image
                    src="/vault-audit-orbit.svg"
                    alt="Bastion Vault audit and policy visualization"
                    width={960}
                    height={720}
                    className="h-36 w-full object-cover"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 md:col-span-7 md:min-h-[260px]">
                <h3 className="font-headline text-lg font-semibold text-white">Audit at a glance</h3>
                <p className="mt-2 text-sm text-neutral-400">Who read which path—structured for security review and export.</p>
                <div className="mt-4 space-y-2 font-mono text-[10px] text-neutral-500">
                  <div className="flex justify-between rounded-lg border border-neutral-800/80 bg-black/50 px-3 py-2">
                    <span className="text-neutral-400">secret/read</span>
                    <span>svc_ci · 10:42</span>
                  </div>
                  <div className="flex justify-between rounded-lg border border-neutral-800/80 bg-black/50 px-3 py-2">
                    <span className="text-neutral-400">identity/issue</span>
                    <span>admin · 09:18</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features — 3 cards */}
        <section id="features" className="border-b border-neutral-900 py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="max-w-xl font-headline text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Built for fast-moving teams that need control.
              </h2>
              <p className="max-w-md text-neutral-400 lg:text-right">
                Policies, scopes, and audit trails—so security and platform stay aligned without blocking delivery.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                {
                  title: 'Scoped automation',
                  body: 'Machine passports with environment and action scopes—issue, bind, revoke in one place.',
                  visual: (
                    <div className="mt-6 space-y-2 rounded-xl border border-neutral-800 bg-black/40 p-4">
                      {['prod:read', 'staging:read', 'dev:write'].map(t => (
                        <div key={t} className="flex items-center justify-between rounded-md bg-neutral-900/80 px-3 py-2 text-[11px] text-neutral-300">
                          <span className="font-mono text-emerald-400/80">{t}</span>
                          <span className="text-neutral-600">bound</span>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  title: 'Rotation without drama',
                  body: 'Version secrets per path; rotate on schedule or on incident—operators see state clearly.',
                  visual: (
                    <div className="mt-6 flex items-center gap-2 rounded-xl border border-neutral-800 bg-black/40 p-4">
                      {['fetch', 'verify', 'seal'].map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                          {i > 0 && <span className="text-neutral-700">→</span>}
                          <span className="rounded-md bg-emerald-950/50 px-2 py-1 text-[10px] font-medium text-emerald-300">{s}</span>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  title: 'Guardrails & audit',
                  body: 'Approvals-friendly trails: who touched secrets, from where, and when—export when auditors ask.',
                  visual: (
                    <div className="relative mt-6 flex h-36 items-center justify-center overflow-hidden rounded-xl border border-neutral-800 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12),transparent_70%)]">
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-500/30 bg-neutral-950 shadow-[0_0_32px_rgba(16,185,129,0.2)]">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-emerald-400" aria-hidden>
                          <path d="M12 2 4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4Z" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M9 12.5 11 15l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>
                  ),
                },
              ].map(card => (
                <div
                  key={card.title}
                  className="group flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950 p-8 transition hover:border-neutral-600"
                >
                  <h3 className="font-headline text-lg font-semibold text-white">{card.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-400">{card.body}</p>
                  {card.visual}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow steps */}
        <section id="workflow" className="border-b border-neutral-900 py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="font-headline text-2xl font-semibold text-white md:text-3xl">How teams run Bastion</h2>
            <p className="mt-3 text-neutral-400">A straight path from sign-in to proof in audit.</p>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { n: '01', t: 'Authenticate', d: 'OTP or recovery to your workspace.' },
                { n: '02', t: 'Choose environment', d: 'dev · staging · prod for every path.' },
                { n: '03', t: 'Seal & rotate', d: 'Create values; decrypt only when needed.' },
                { n: '04', t: 'Prove in audit', d: 'Review reads and changes with confidence.' },
              ].map(s => (
                <li key={s.n} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
                  <span className="font-mono text-xs text-emerald-400/90">{s.n}</span>
                  <div className="mt-2 font-headline text-base font-semibold text-white">{s.t}</div>
                  <p className="mt-2 text-sm text-neutral-500">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Security strip */}
        <section id="security" className="border-b border-neutral-900 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8">
                <h3 className="font-headline text-lg font-semibold text-white">Tenant isolation</h3>
                <p className="mt-2 text-sm text-neutral-400">Workspaces are separated at the API; switching context is explicit—no silent bleed.</p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8">
                <h3 className="font-headline text-lg font-semibold text-white">Least privilege</h3>
                <p className="mt-2 text-sm text-neutral-400">Scopes on machine access—treat passports like policy, not ambient trust.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-b border-neutral-900 py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center">
              <h2 className="font-headline text-3xl font-semibold text-white md:text-4xl">Choose your plan</h2>
              <p className="mx-auto mt-3 max-w-lg text-neutral-400">
                Bastion exists for teams that need the security posture of heavyweight vaulting without heavyweight platform overhead.
              </p>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:items-stretch">
              {[
                {
                  name: 'Starter',
                  sub: 'For small teams and pilots',
                  price: '$19',
                  featured: false,
                  feats: ['3 environments', '500 secrets', '7-day audit retention', 'Email support', 'Community Slack'],
                },
                {
                  name: 'Premium',
                  sub: 'For growing platform teams',
                  price: '$49',
                  featured: true,
                  feats: ['Unlimited secrets', '90-day audit retention', 'SSO-ready flows', 'Priority support', 'Custom scopes'],
                },
                {
                  name: 'Business',
                  sub: 'For regulated & large orgs',
                  price: '$99',
                  featured: false,
                  feats: ['Everything in Premium', 'SAML / SCIM roadmap', 'Dedicated success', 'Uptime SLA options', 'VPC peering (add-on)'],
                },
              ].map(tier => (
                <div
                  key={tier.name}
                  className={`flex flex-col rounded-2xl border p-8 ${
                    tier.featured
                      ? 'border-neutral-500 bg-neutral-900/80 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ring-1 ring-white/10 lg:-mt-2 lg:mb-2 lg:pb-10'
                      : 'border-neutral-800 bg-neutral-950'
                  }`}
                >
                  <h3 className="font-headline text-xl font-semibold text-white">{tier.name}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{tier.sub}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="font-headline text-4xl font-semibold text-white">{tier.price}</span>
                    <span className="text-sm text-neutral-500">/month</span>
                  </div>
                  <Link
                    href="/login"
                    className={`mt-8 inline-flex justify-center rounded-xl py-3 text-sm font-semibold transition ${
                      tier.featured ? 'bg-white text-black hover:bg-neutral-200' : 'border border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800'
                    }`}
                  >
                    Get started
                  </Link>
                  <ul className="mt-8 flex flex-col gap-3 text-sm text-neutral-400">
                    {tier.feats.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-8 rounded-2xl border border-neutral-800 bg-neutral-950 p-8 md:grid-cols-2 md:items-center md:gap-12 lg:p-10">
              <div>
                <h3 className="font-headline text-xl font-semibold text-white">Plan for organizations</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  Custom contracts, regional residency, and procurement-friendly terms. We align Bastion to your security review process.
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
                >
                  Contact sales
                </Link>
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {['Unlimited environments', 'Team onboarding', 'Custom invoicing', 'Standard security review pack', 'Custom roles & workflows', 'Dedicated support channel'].map(
                  f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-neutral-400">
                      <Check className="mt-0.5 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h2 className="font-headline text-2xl font-semibold text-white md:text-3xl">Ship with confidence.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-neutral-400">
              Bastion Vault is powered by a simple belief: secrets management should be operationally clear, security-first, and affordable enough
              for real engineering teams to actually adopt.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex rounded-full bg-white px-10 py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
            >
              Open Bastion Vault
            </Link>
          </div>
        </section>
      </main>

      {/* Footer — 4-column + watermark */}
      <footer className="relative overflow-hidden border-t border-neutral-900 bg-black">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <Link href="/" className="inline-flex items-center gap-3 font-headline text-base font-semibold text-white">
                <BrandMark />
                Bastion Vault
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-500">
                © {year} Bastion Vault. All rights reserved.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Pages</h4>
              <ul className="mt-4 space-y-3 text-sm text-neutral-500">
                <li>
                  <a href="#bento" className="transition hover:text-white">
                    Product
                  </a>
                </li>
                <li>
                  <Link href="/login" className="transition hover:text-white">
                    Console
                  </Link>
                </li>
                <li>
                  <a href="#pricing" className="transition hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link href="/docs" className="transition hover:text-white">
                    Documentation
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Social</h4>
              <ul className="mt-4 space-y-3 text-sm text-neutral-500">
                <li>
                  <a href="https://twitter.com" className="transition hover:text-white" target="_blank" rel="noopener noreferrer">
                    Twitter / X
                  </a>
                </li>
                <li>
                  <a href="https://linkedin.com" className="transition hover:text-white" target="_blank" rel="noopener noreferrer">
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a href="https://github.com" className="transition hover:text-white" target="_blank" rel="noopener noreferrer">
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Legal</h4>
              <ul className="mt-4 space-y-3 text-sm text-neutral-500">
                <li>
                  <a href="#" className="transition hover:text-white">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-white">
                    Terms of service
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-white">
                    Cookie policy
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Account</h4>
              <ul className="mt-4 space-y-3 text-sm text-neutral-500">
                <li>
                  <Link href="/login" className="transition hover:text-white">
                    Sign up
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="transition hover:text-white">
                    Login
                  </Link>
                </li>
                <li>
                  <a href="/login" className="transition hover:text-white">
                    Forgot password
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute bottom-0 left-1/2 z-0 w-[max(100%,1200px)] -translate-x-1/2 select-none text-center font-headline text-[clamp(4rem,18vw,12rem)] font-bold leading-none text-white/[0.04]"
          aria-hidden
        >
          Bastion Vault
        </div>
      </footer>
    </div>
  );
}
