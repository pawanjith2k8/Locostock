/** @type {import('next').NextConfig} */
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.paypal.com https://www.sandbox.paypal.com https://unpkg.com;
  style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com;
  font-src 'self' data: https://fonts.gstatic.com;
  img-src 'self' data: blob: https://*.cartocdn.com https://*.openstreetmap.org https://unpkg.com https://www.paypalobjects.com https://*.supabase.co;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api-m.sandbox.paypal.com https://api-m.paypal.com https://www.sandbox.paypal.com https://www.paypal.com;
  frame-src 'self' https://www.sandbox.paypal.com https://www.paypal.com;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  object-src 'none';
`.replace(/\s{2,}/g, ' ').trim();

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy,
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;

