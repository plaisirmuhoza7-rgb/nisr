import type { NextConfig } from 'next';
import {FUNDRAISING_ENABLED} from './src/lib/competition';

const config: NextConfig = {
  distDir: process.env.HURIZA_NEXT_DIST || '.next',
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'firebase-admin'],
  output: process.env.VERCEL ? undefined : 'standalone',
  outputFileTracingIncludes: {
    '/**': ['./migrations/**/*', './data/**/*'],
  },
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  async redirects() {
    return FUNDRAISING_ENABLED ? [] : [{source: '/fund/:path*', destination: '/', permanent: false}];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
