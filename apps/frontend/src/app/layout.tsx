import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nize Logistics - ...Plenty Waka",
  description: "Fast, reliable delivery service across Nigeria",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="dark-theme" suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'light') {
              document.body.classList.remove('dark-theme');
            } else {
              document.body.classList.add('dark-theme');
              if (!savedTheme) {
                localStorage.setItem('theme', 'dark');
              }
            }
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
