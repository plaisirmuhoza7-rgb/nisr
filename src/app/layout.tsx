import type { Metadata, Viewport } from 'next';
import './globals.css';
import './workspace-theme.css';
import { LanguageProvider } from '@/lib/i18n/context';
import PwaRegister from '@/components/pwa-register';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#2677dc',
};

export const metadata: Metadata = {
  title: { default: 'HURIZA — Community Financial Intelligence', template: '%s · HURIZA' },
  description: 'Beyond Saving. Toward Financial Intelligence. A connected community finance demonstration for Rwanda with offline synchronization.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HURIZA',
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <LanguageProvider>
          {children}
          <PwaRegister />
        </LanguageProvider>
      </body>
    </html>
  );
}
