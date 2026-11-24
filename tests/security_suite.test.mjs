import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import nextConfig from '../next.config.js';

// -----------------------------------------------------------------------
// 1. Next.js Security Headers Verification
// -----------------------------------------------------------------------
test('Next.js Security Headers are configured with complete defensive suite', async () => {
  assert.ok(typeof nextConfig.headers === 'function', 'nextConfig must define async headers() function');
  const headersConfig = await nextConfig.headers();
  assert.ok(Array.isArray(headersConfig) && headersConfig.length > 0, 'headersConfig must return an array');

  const rootRule = headersConfig.find((r) => r.source === '/(.*)');
  assert.ok(rootRule, 'Must define wildcard header rule for /(.*)');

  const headerMap = new Map();
  for (const h of rootRule.headers) {
    headerMap.set(h.key.toLowerCase(), h.value);
  }

  // Content-Security-Policy
  assert.ok(headerMap.has('content-security-policy'), 'CSP header must be present');
  const csp = headerMap.get('content-security-policy');
  assert.match(csp, /default-src 'self'/, 'CSP must define default-src');
  assert.match(csp, /frame-ancestors 'none'/, 'CSP must restrict frame-ancestors to none');
  assert.match(csp, /object-src 'none'/, 'CSP must restrict object-src to none');

  // X-Frame-Options
  assert.equal(headerMap.get('x-frame-options'), 'DENY', 'X-Frame-Options must be DENY');

  // X-Content-Type-Options
  assert.equal(headerMap.get('x-content-type-options'), 'nosniff', 'X-Content-Type-Options must be nosniff');

  // Referrer-Policy
  assert.equal(headerMap.get('referrer-policy'), 'strict-origin-when-cross-origin', 'Referrer-Policy must be strict-origin-when-cross-origin');

  // Permissions-Policy
  assert.match(headerMap.get('permissions-policy'), /camera=\(\)/, 'Permissions-Policy must disable camera');
  assert.match(headerMap.get('permissions-policy'), /microphone=\(\)/, 'Permissions-Policy must disable microphone');

  // Strict-Transport-Security (HSTS)
  assert.match(headerMap.get('strict-transport-security'), /max-age=63072000/, 'HSTS must specify max-age');
  assert.match(headerMap.get('strict-transport-security'), /includeSubDomains/, 'HSTS must include subdomains');

  // X-DNS-Prefetch-Control & X-Permitted-Cross-Domain-Policies
  assert.equal(headerMap.get('x-dns-prefetch-control'), 'on', 'X-DNS-Prefetch-Control must be on');
  assert.equal(headerMap.get('x-permitted-cross-domain-policies'), 'none', 'Cross-Domain policies must be none');
});

// -----------------------------------------------------------------------
// 2. Input Sanitization (DOMPurify & Control Character Stripping)
// -----------------------------------------------------------------------
test('Input Sanitizer neutralizes XSS vectors, script tags, and control characters', () => {
  function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    const clean = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
    return clean.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '').trim();
  }

  // Script tags stripped
  const xssScript = '<script>alert("XSS")</script>John Doe';
  assert.equal(sanitizeInput(xssScript), 'John Doe');

  // Event handlers stripped
  const xssImg = '<img src=x onerror=alert(1)>Jane Doe';
  assert.equal(sanitizeInput(xssImg), 'Jane Doe');

  // Nested / malformed vectors stripped
  const xssNested = '<<SCRIPT>alert("nested");//<</SCRIPT>';
  assert.equal(sanitizeInput(xssNested).includes('<script>'), false);

  // Null bytes and control characters stripped
  const nullByteStr = 'Customer\u0000 Name\u0007';
  assert.equal(sanitizeInput(nullByteStr), 'Customer Name');

  // Normal safe strings preserved
  assert.equal(sanitizeInput('Acme Electronics #101'), 'Acme Electronics #101');
});

// -----------------------------------------------------------------------
// 3. Sliding Window Rate Limiting Verification
// -----------------------------------------------------------------------
test('Rate Limiter strictly throttles requests and rejects bursts exceeding quota', () => {
  class SlidingWindowLimiter {
    constructor() {
      this.store = new Map();
    }
    check(ip, limit = 5, windowMs = 1000) {
      const now = Date.now();
      let record = this.store.get(ip);
      if (!record) {
        record = { timestamps: [] };
        this.store.set(ip, record);
      }
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

      if (record.timestamps.length >= limit) {
        const oldest = record.timestamps[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        return { allowed: false, limit, remaining: 0, retryAfterSeconds };
      }

      record.timestamps.push(now);
      return { allowed: true, limit, remaining: limit - record.timestamps.length, retryAfterSeconds: 0 };
    }
  }

  const limiter = new SlidingWindowLimiter();
  const testIp = '192.168.1.100';

  // First 5 requests allowed
  for (let i = 1; i <= 5; i++) {
    const res = limiter.check(testIp, 5, 1000);
    assert.equal(res.allowed, true, `Request ${i} should be allowed`);
    assert.equal(res.remaining, 5 - i);
  }

  // 6th request blocked
  const blocked = limiter.check(testIp, 5, 1000);
  assert.equal(blocked.allowed, false, '6th request must be rejected with 429 status');
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds > 0, 'Retry-After must be positive');

  // Different IP is isolated and allowed
  const otherIpRes = limiter.check('10.0.0.2', 5, 1000);
  assert.equal(otherIpRes.allowed, true, 'Separate IP should have independent quota');
});

// -----------------------------------------------------------------------
// 4. CSRF / Origin Validation Verification
// -----------------------------------------------------------------------
test('CSRF / Origin Validator rejects cross-site attacks and foreign origins', () => {
  function validateCsrfOrigin(headers, allowedOrigins = ['http://localhost:3000']) {
    const secFetchSite = headers['sec-fetch-site'];
    if (secFetchSite === 'cross-site') {
      return { valid: false, reason: 'Cross-site request blocked by Fetch Metadata' };
    }

    const origin = headers['origin'];
    const referer = headers['referer'];

    if (!origin && !referer) {
      return { valid: true };
    }

    const checkHeader = (headerVal) => {
      if (!headerVal) return false;
      try {
        const urlOrigin = new URL(headerVal).origin.toLowerCase();
        return allowedOrigins.some((a) => a.toLowerCase() === urlOrigin);
      } catch {
        return false;
      }
    };

    if (origin && !checkHeader(origin)) {
      return { valid: false, reason: `Invalid Origin: ${origin}` };
    }

    if (!origin && referer && !checkHeader(referer)) {
      return { valid: false, reason: `Invalid Referer: ${referer}` };
    }

    return { valid: true };
  }

  // Cross-site fetch metadata blocked
  const crossSiteRes = validateCsrfOrigin({ 'sec-fetch-site': 'cross-site', origin: 'http://localhost:3000' });
  assert.equal(crossSiteRes.valid, false);
  assert.match(crossSiteRes.reason, /cross-site/i);

  // Foreign attacker origin blocked
  const attackerRes = validateCsrfOrigin({ origin: 'https://malicious-attacker.com' });
  assert.equal(attackerRes.valid, false);
  assert.match(attackerRes.reason, /Invalid Origin/);

  // Legitimate origin accepted
  const legitRes = validateCsrfOrigin({ origin: 'http://localhost:3000' });
  assert.equal(legitRes.valid, true);

  // Same-origin without origin header (e.g. standard same-site navigation) accepted
  const noHeaderRes = validateCsrfOrigin({});
  assert.equal(noHeaderRes.valid, true);
});

// -----------------------------------------------------------------------
// 5. Zod Schema Validation Boundary Tests
// -----------------------------------------------------------------------
test('Zod Schemas enforce strict boundaries on billing payloads', () => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const uuidField = z.string().regex(uuidRegex, { message: 'Must be a valid UUID' });

  const BillingItemSchema = z.object({
    product_id: uuidField,
    quantity: z.number().int().min(1).max(10000),
    unit_price: z.number().min(0).max(10000000).optional(),
  });

  const BillingPayloadSchema = z.object({
    shop_id: uuidField,
    user_id: z.string().max(100).optional(),
    items: z.array(BillingItemSchema).min(1).max(200),
    subtotal: z.number().min(0).optional(),
    tax: z.number().min(0).optional(),
    discount: z.number().min(0).optional(),
    final_total: z.number().min(0).optional(),
    idempotency_key: z.string().min(1).max(255).optional(),
    customer_name: z.string().max(100).optional(),
    customer_phone: z.string().max(30).optional(),
  });

  const validUuid = '11111111-1111-4111-8111-111111111111';

  // Valid billing payload
  const validBilling = {
    shop_id: validUuid,
    items: [{ product_id: validUuid, quantity: 2, unit_price: 150 }],
    subtotal: 300,
    tax: 15,
    final_total: 315,
  };
  assert.equal(BillingPayloadSchema.safeParse(validBilling).success, true);

  // Invalid shop_id (SQL injection attempt / malformed)
  const sqlInjPayload = { ...validBilling, shop_id: "'; DROP TABLE shops; --" };
  assert.equal(BillingPayloadSchema.safeParse(sqlInjPayload).success, false);

  // Negative quantity rejected
  const negQtyPayload = {
    ...validBilling,
    items: [{ product_id: validUuid, quantity: -5 }],
  };
  assert.equal(BillingPayloadSchema.safeParse(negQtyPayload).success, false);

  // Fractional quantity rejected (must be integer units)
  const fracQtyPayload = {
    ...validBilling,
    items: [{ product_id: validUuid, quantity: 2.5 }],
  };
  assert.equal(BillingPayloadSchema.safeParse(fracQtyPayload).success, false);

  // Exceeding 10,000 units rejected
  const overflowQtyPayload = {
    ...validBilling,
    items: [{ product_id: validUuid, quantity: 10001 }],
  };
  assert.equal(BillingPayloadSchema.safeParse(overflowQtyPayload).success, false);

  // Exceeding 200 items rejected
  const tooManyItems = Array.from({ length: 201 }, () => ({ product_id: validUuid, quantity: 1 }));
  assert.equal(BillingPayloadSchema.safeParse({ ...validBilling, items: tooManyItems }).success, false);
});

// -----------------------------------------------------------------------
// 6. Information Leakage Prevention & Error Masking
// -----------------------------------------------------------------------
test('Error Masker redacts internal database schemas, SQL statements, and call stacks', () => {
  function maskInternalError(error, fallbackMessage = 'Internal Server Error') {
    if (!error) return { message: fallbackMessage, status: 500 };
    const rawMessage = error instanceof Error ? error.message : String(error);

    if (rawMessage.startsWith('Unauthorized')) return { message: rawMessage, status: 401 };
    if (rawMessage.startsWith('Forbidden')) return { message: rawMessage, status: 403 };
    if (rawMessage.startsWith('Bad request')) return { message: rawMessage, status: 400 };
    if (rawMessage.includes('Insufficient stock')) return { message: rawMessage, status: 409 };

    const sensitivePatterns = [
      /select /i,
      /insert /i,
      /update /i,
      /delete /i,
      /relation /i,
      /column /i,
      /syntax error/i,
      /supabase/i,
      /postgres/i,
      /at Object\./i,
      /at async/i,
      /\.ts:\d+/i,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(rawMessage)) {
        return { message: fallbackMessage, status: 500 };
      }
    }

    return { message: rawMessage.length < 200 ? rawMessage : fallbackMessage, status: 500 };
  }

  // Redacts SQL injection error leakage
  const sqlErr = new Error('syntax error at or near "SELECT" in table "shops"');
  const maskedSql = maskInternalError(sqlErr, 'Database operation failed');
  assert.equal(maskedSql.message, 'Database operation failed');
  assert.equal(maskedSql.message.includes('syntax error'), false);
  assert.equal(maskedSql.message.includes('shops'), false);

  // Redacts internal stack traces
  const stackErr = new Error('Connection failed at async finalizeBill (c:\\app\\src\\lib\\db.ts:120)');
  const maskedStack = maskInternalError(stackErr, 'System error occurred');
  assert.equal(maskedStack.message, 'System error occurred');
  assert.equal(maskedStack.message.includes('db.ts'), false);

  // Passes through safe business domain message
  const domainErr = new Error('Insufficient stock for Arduino Uno: requested 5, available 2');
  const maskedDomain = maskInternalError(domainErr);
  assert.equal(maskedDomain.message, 'Insufficient stock for Arduino Uno: requested 5, available 2');
  assert.equal(maskedDomain.status, 409);
});
