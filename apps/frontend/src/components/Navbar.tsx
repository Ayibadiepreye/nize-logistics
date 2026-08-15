'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, LogOut, Menu, Monitor, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { clearSession, homeForRole, useAuth } from '@/lib/auth';
import Icon from '@/components/Icon';

const PUBLIC_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/order', label: 'Book Delivery' },
  { href: '/track', label: 'Track Order' },
  { href: '/quotes', label: 'Quotes' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, cycleTheme } = useTheme();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const logout = () => {
    clearSession();
    router.push('/login');
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const themeLabel =
    theme === 'dark' ? 'Dark theme' : theme === 'light' ? 'Light theme' : 'System theme';

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <Link href="/" className="logo" aria-label="Nize Logistics home">
            <div className="logo-icon">
              <Icon name="truck-fast" />
            </div>
            <div className="logo-text">
              <div className="logo-main">
                <span className="logo-nize">Nize</span>
                <span className="logo-logistics">Logistics</span>
              </div>
              <div className="logo-tagline">...Plenty Waka</div>
            </div>
          </Link>

          <nav className={`nav ${menuOpen ? 'active' : ''}`} aria-label="Main navigation">
            {PUBLIC_LINKS.map((link) => {
              const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} className={`nav-link ${active ? 'active' : ''}`}>
                  {link.label}
                </Link>
              );
            })}

            {/* Signed-in shortcuts live in the mobile sheet too, where the
                header has no room for them. */}
            {user && (
              <>
                <Link href={homeForRole(user.role)} className="nav-link nav-mobile-only">
                  My Dashboard
                </Link>
                <button type="button" className="nav-link nav-mobile-only text-left" onClick={logout}>
                  Sign out
                </button>
              </>
            )}
          </nav>

          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={cycleTheme}
              title={`${themeLabel} — click to change`}
              aria-label={`${themeLabel}. Change theme`}
              type="button"
            >
              <ThemeIcon size={16} />
            </button>

            <a
              href="https://wa.me/2347063980120?text=Hello%20Nize%20Logistics!%20I'd%20like%20to%20make%20an%20inquiry%20%2F%20book%20a%20delivery%20package."
              className="whatsapp-icon nav-desktop-only"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with us on WhatsApp"
            >
              <Icon name="whatsapp" />
            </a>

            {user ? (
              <div className="nav-desktop-only flex items-center gap-2">
                <Link href={homeForRole(user.role)} className="btn btn-outline btn-sm">
                  <LayoutDashboard size={14} />
                  Dashboard
                </Link>
                <button className="icon-btn" onClick={logout} title="Sign out" type="button" aria-label="Sign out">
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="nav-desktop-only flex items-center gap-2">
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link href="/order" className="btn btn-primary btn-sm">
                  Book Now
                </Link>
              </div>
            )}

            <button
              className="mobile-menu-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              type="button"
            >
              {menuOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
