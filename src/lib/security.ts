import { NextRequest, NextResponse } from 'next/server';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sliding Window In-Memory Rate Limiter
 * Tracks requests per client IP to defend against DoS, brute force, and quota depletion.
 */
interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic cleanup of stale IP entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 300000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(ip);
      }
    }
  }, 300000);
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim());
    if (ips[0]) return ips[0];
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

export interface RateLimitOptions {
  limit?: number; // max requests allowed within window (default: 60)
  windowMs?: number; // sliding window duration in ms (default: 60,000 ms)
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60000;
  const ip = getClientIp(req);
  const now = Date.now();

  let record = rateLimitStore.get(ip);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(ip, record);
  }

  // Filter timestamps within current sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - record.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down and try again later.',
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'Retry-After': String(result.retryAfterSeconds),
      },
    }
  );
}

/**
 * Origin and Fetch-Metadata CSRF Protection
 * Verifies request origin and Sec-Fetch-Site to reject cross-site forged state-modifying requests.
 */
export function validateCsrfOrigin(req: NextRequest): { valid: boolean; reason?: string } {
  // Sec-Fetch-Site check: reject cross-site requests
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return { valid: false, reason: 'Cross-site request blocked by Fetch Metadata policy' };
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  // If no origin or referer header is provided (e.g. non-browser tools, curl), allow if same host
  if (!origin && !referer) {
    return { valid: true };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const allowedOrigins: string[] = [];

  if (appUrl) {
    try {
      allowedOrigins.push(new URL(appUrl).origin.toLowerCase());
    } catch {
      // ignore invalid appUrl
    }
  }

  if (host) {
    allowedOrigins.push(`http://${host}`.toLowerCase());
    allowedOrigins.push(`https://${host}`.toLowerCase());
  }

  // Common localhost/127.0.0.1 origins in development
  allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');

  const checkHeader = (headerValue: string | null): boolean => {
    if (!headerValue) return false;
    try {
      const headerOrigin = new URL(headerValue).origin.toLowerCase();
      return allowedOrigins.some((allowed) => allowed === headerOrigin);
    } catch {
      return false;
    }
  };

  if (origin && !checkHeader(origin)) {
    return { valid: false, reason: `Invalid Origin header: ${origin}` };
  }

  if (!origin && referer && !checkHeader(referer)) {
    return { valid: false, reason: `Invalid Referer header: ${referer}` };
  }

  return { valid: true };
}

/**
 * Text and HTML Sanitization using DOMPurify
 * Strips script tags, unsafe protocols (javascript:), and dangerous HTML attributes.
 */
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Strip all HTML tags for pure plain text
    ALLOWED_ATTR: [],
  });
  // Strip null bytes and control characters
  return clean.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '').trim();
}

/**
 * Prevents information leakage by sanitizing internal database / system error details
 */
export function maskInternalError(error: unknown, fallbackMessage = 'Internal Server Error'): { message: string; status: number } {
  if (!error) return { message: fallbackMessage, status: 500 };

  const rawMessage = error instanceof Error ? error.message : String(error);

  // Safe client-facing domain messages that do not reveal sensitive infrastructure
  if (rawMessage.startsWith('Unauthorized')) {
    return { message: rawMessage, status: 401 };
  }
  if (rawMessage.startsWith('Forbidden')) {
    return { message: rawMessage, status: 403 };
  }
  if (rawMessage.startsWith('Bad request') || rawMessage.startsWith('Invalid')) {
    return { message: rawMessage, status: 400 };
  }
  if (
    rawMessage.includes('Insufficient stock') ||
    rawMessage.includes('Cart is empty') ||
    rawMessage.includes('not found') ||
    rawMessage.includes('is no longer available') ||
    rawMessage.includes('Idempotency conflict')
  ) {
    return { message: rawMessage, status: 409 };
  }

  // Database error patterns to redact
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
    /\.js:\d+/i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(rawMessage)) {
      return { message: fallbackMessage, status: 500 };
    }
  }

  return { message: rawMessage.length < 200 ? rawMessage : fallbackMessage, status: 500 };
}
