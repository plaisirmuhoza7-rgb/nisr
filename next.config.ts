import type { NextConfig } from 'next';

const config: NextConfig = {
  distDir: process.env.HURIZA_NEXT_DIST || '.next',
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'firebase-admin'],
  output: process.env.VERCEL ? undefined : 'standalone',
  outputFileTracingIncludes: {
    '/**': ['./migrations/**/*', './data/**/*'],
  },
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
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
