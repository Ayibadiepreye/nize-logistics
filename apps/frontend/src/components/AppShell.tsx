'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Role, getUser, homeForRole } from '@/lib/auth';

/**
 * Client-side guard for dashboard routes.
 *
 * This is a UX convenience only — it hides chrome the user cannot use and
 * redirects them somewhere sensible. It is NOT the security boundary: every
 * protected endpoint independently authenticates the bearer token and checks
 * the role server-side, so editing localStorage buys an attacker nothing.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed'>('checking');

  useEffect(() => {
    const user = getUser();
    if (!user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?next=${next}`);
      return;
    }
    if (!roles.includes(user.role)) {
      // Signed in, wrong role — send them to their own dashboard rather than
      // dumping them on the marketing site.
      router.replace(homeForRole(user.role));
      return;
    }
    setState('allowed');
    // `roles` is a literal array at every call site; re-running on identity
    // changes would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'checking') {
    return (
      <div className="shell">
        <Navbar />
        <div className="flex flex-1 items-center justify-center py-24">
          <div className="spinner" role="status" aria-label="Checking your session" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Standard dashboard frame: navbar, constrained content column, footer space. */
export function DashboardShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <Navbar />
      <main className="shell-main">
        <div className="container">
          <div className="page-head">
            <div>
              <h1 className="page-title">{title}</h1>
              {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
