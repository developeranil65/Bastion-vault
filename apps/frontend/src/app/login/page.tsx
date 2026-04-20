'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import * as api from '@/lib/api';

type Stage = 'email' | 'otp' | 'register' | 'recovery';

export default function LoginPage() {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [otp, setOtp] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  async function handleSendOtp() {
    if (!email) return;
    setLoading(true);
    try {
      await api.sendOtp(email);
      addToast('OTP sent to your email');
      setStage('otp');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!otp) return;
    setLoading(true);
    try {
      const result = await login(email, otp);
      if (result.success) {
        addToast('Signed in');
        router.push('/dashboard');
      } else {
        addToast(result.message, 'error');
      }
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const result = await register(email, password, tenantName || undefined);
      if (result.success) {
        if (result.recoveryCodes) {
          setRecoveryCodes(result.recoveryCodes);
          setStage('recovery');
        } else {
          addToast('Account created. Sign in with OTP.');
          setStage('email');
        }
      } else {
        addToast(result.message, 'error');
      }
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleRecoverySaved() {
    addToast('Store recovery codes safely. Continue to sign in.');
    setStage('email');
  }

  return (
    <div className="min-h-screen bg-black font-body text-[var(--on-surface)] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col justify-center px-6 py-14 lg:px-12 xl:px-20">
        <div className="mx-auto w-full" style={{ maxWidth: 440 }}>
          <div className="mb-10 text-center lg:text-left">
            <Link href="/" className="inline-flex items-center gap-2 font-headline text-lg font-semibold text-white">
              <span
                className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-800 font-mono text-xs font-bold text-emerald-400/90"
                style={{ background: 'var(--surface-container)' }}
              >
                BV
              </span>
              Bastion Vault
            </Link>
            <p className="mt-2 text-sm text-neutral-500">Control plane sign-in</p>
          </div>

          <div className="auth-card marketing-reveal border-neutral-800 bg-neutral-950/90 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <h1 style={{ color: 'var(--on-surface)', fontSize: '1.25rem' }}>
            {stage === 'register' ? 'Create project workspace' : stage === 'recovery' ? 'Recovery codes' : 'Sign in'}
          </h1>
          <p className="subtitle" style={{ color: 'var(--on-surface-variant)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {stage === 'register'
              ? 'Register and provision your first Bastion project.'
              : stage === 'recovery'
                ? 'Save these codes offline.'
                : 'Email OTP or recovery code for operator access.'}
          </p>

          {stage === 'email' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                  autoComplete="email"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendOtp}
                disabled={loading || !email}
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
              <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8125rem' }}>
                No account?{' '}
                <button
                  type="button"
                  onClick={() => setStage('register')}
                  style={{ color: 'var(--primary-fixed-dim)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Register
                </button>
              </p>
            </>
          )}

          {stage === 'otp' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="login-otp">
                  One-time password
                </label>
                <input
                  id="login-otp"
                  type="text"
                  className="form-input"
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  maxLength={8}
                  style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}
                  autoComplete="one-time-code"
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '0.5rem' }}>
                  Code sent to {email}. Recovery codes work here too.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLogin}
                disabled={loading || !otp}
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                {loading ? 'Signing in…' : 'Continue'}
              </button>
              <button type="button" onClick={() => setStage('email')} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem' }}>
                Back
              </button>
            </>
          )}

          {stage === 'register' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  className="form-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  className="form-input"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-tenant">
                  Project name (optional)
                </label>
                <input
                  id="reg-tenant"
                  type="text"
                  className="form-input"
                  placeholder="Payments platform"
                  value={tenantName}
                  onChange={e => setTenantName(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRegister}
                disabled={loading || !email || !password}
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                {loading ? 'Creating…' : 'Create workspace'}
              </button>
              <button type="button" onClick={() => setStage('email')} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem' }}>
                Back to sign in
              </button>
            </>
          )}

          {stage === 'recovery' && (
            <>
              <div
                style={{
                  background: 'rgba(254, 177, 39, 0.08)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(254, 177, 39, 0.2)',
                  marginBottom: '1.5rem',
                }}
              >
                <p style={{ color: 'var(--tertiary)', fontSize: '0.8125rem', fontWeight: 600 }}>Save these codes now</p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--on-surface-variant)' }}>
                  They are not shown again. Use if you lose OTP access.
                </p>
              </div>
              <div className="recovery-codes">
                {recoveryCodes.map((code, i) => (
                  <code key={i}>{code}</code>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRecoverySaved}
                style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '1.5rem' }}
              >
                I have stored my codes
              </button>
            </>
          )}
        </div>

          <p className="mt-8 text-center text-xs text-neutral-600 lg:text-left">
            <Link href="/" className="hover:text-neutral-400">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden min-h-[320px] flex-col justify-end overflow-hidden rounded-none border-l border-neutral-900 bg-gradient-to-br from-[#06232b] via-neutral-950 to-[#141d3e] p-10 lg:flex lg:min-h-screen">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.15),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative z-10 mb-6 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-300 backdrop-blur-sm">
            Security
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-300 backdrop-blur-sm">
            Multi-tenant
          </span>
        </div>
        <div className="marketing-float relative z-10 mb-6 overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-md">
          <img src="/vault-console-hero.svg" alt="Bastion Vault console preview" className="h-auto w-full rounded-xl opacity-95" />
        </div>
        <blockquote className="relative z-10 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
          <p className="text-sm leading-relaxed text-neutral-200">
            &ldquo;Centralizing secrets, identities, and audit in Bastion gave us the control plane we wanted without running a heavyweight Vault stack.&rdquo;
          </p>
          <footer className="mt-4 text-xs text-neutral-500">Platform lead · Growth-stage SaaS infrastructure</footer>
        </blockquote>
      </div>
    </div>
  );
}
