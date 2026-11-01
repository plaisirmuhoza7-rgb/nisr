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
      { url: '/favicon.ico' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
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
          <PwaRegister>{children}</PwaRegister>
        </LanguageProvider>
      </body>
    </html>
  );
}
