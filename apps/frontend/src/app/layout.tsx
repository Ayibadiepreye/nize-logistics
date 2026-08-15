import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider, themeInitScript } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Nize Logistics — ...Plenty Waka',
  description:
    'Fast pick-up and fast delivery across Port Harcourt and beyond. Book a dispatch rider, track your package live, and pay on delivery or online.',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Both themes ship a matching browser-chrome colour.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1017' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
