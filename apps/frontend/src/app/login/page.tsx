'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api, { apiError } from '@/lib/api';
import { homeForRole, setSession, type AuthUser } from '@/lib/auth';
import { Button, Card, Field, InlineAlert, Input } from '@/components/ui';
import Icon from '@/components/Icon';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Set after a successful sign-in when an admin has reset this password —
  // the account must choose its own before it can go anywhere.
  const [mustChange, setMustChange] = useState<{ user: AuthUser; currentPassword: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', form);
      setSession(data.token, data.user);

      if (data.user.mustChangePassword) {
        setMustChange({ user: data.user, currentPassword: form.password });
        return;
      }

      router.push(next || homeForRole(data.user.role));
    } catch (err) {
      setError(apiError(err, 'Could not sign you in.'));
    } finally {
      setLoading(false);
    }
  };

  if (mustChange) {
    return (
      <ForcePasswordChange
        currentPassword={mustChange.currentPassword}
        onDone={() => router.push(next || homeForRole(mustChange.user.role))}
      />
    );
  }

  return (
    <div className="shell">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-4 py-14">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 text-center">
            <div className="logo-icon mx-auto mb-4" style={{ width: 46, height: 46, fontSize: 20 }}>
              <Icon name="truck-fast" />
            </div>
            <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Sign in
            </h1>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
              For riders and administrators
            </p>
          </div>

          <Card className="card-pad">
            <form onSubmit={submit} className="space-y-4">
              {error && <InlineAlert tone="danger">{error}</InlineAlert>}

              <Field label="Email or username" required>
                {(id) => (
                  <Input
                    id={id}
                    type="text"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@nizelogistics.com"
                    autoComplete="username"
                    required
                    autoFocus
                  />
                )}
              </Field>

              <Field label="Password" required>
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Your password"
                    autoComplete="current-password"
                    required
                  />
                )}
              </Field>

              <Button type="submit" variant="primary" size="lg" block loading={loading} icon={<LogIn size={15} />}>
                Sign in
              </Button>
            </form>
          </Card>

          <p className="mt-5 text-center text-[13.5px]" style={{ color: 'var(--text-secondary)' }}>
            Booking a delivery doesn&apos;t need an account —{' '}
            <Link href="/order" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
              book here
            </Link>{' '}
            or{' '}
            <Link href="/track" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
              track an order
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/** Blocks the session until a reset password is replaced by the account owner. */
function ForcePasswordChange({
  currentPassword,
  onDone,
}: {
  currentPassword: string;
  onDone: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const mismatch = confirm.length > 0 && confirm !== newPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      onDone();
    } catch (err) {
      setError(apiError(err, 'Could not update your password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shell">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-14">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 text-center">
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: 'var(--warning-subtle)', color: 'var(--warning-text)' }}
            >
              <ShieldCheck size={22} />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Choose a new password
            </h1>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
              An administrator reset your password. Pick your own to continue.
            </p>
          </div>

          <Card className="card-pad">
            <form onSubmit={submit} className="space-y-4">
              {error && <InlineAlert tone="danger">{error}</InlineAlert>}

              <Field label="New password" hint="At least 8 characters, including a letter and a number." required>
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    autoFocus
                  />
                )}
              </Field>

              <Field label="Confirm password" error={mismatch ? 'Passwords do not match' : undefined} required>
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    value={confirm}
                    invalid={mismatch}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                )}
              </Field>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                loading={loading}
                disabled={newPassword.length < 8 || mismatch}
              >
                Set password and continue
              </Button>
            </form>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
