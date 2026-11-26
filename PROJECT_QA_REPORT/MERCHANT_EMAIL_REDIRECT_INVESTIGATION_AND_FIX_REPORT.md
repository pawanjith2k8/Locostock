# LOCOStock — Merchant Email Verification Redirect Error: Root Cause Investigation & Fix Report

**Date:** November 26, 2026  
**Application:** LOCOStock  
**Production URL:** `https://locostock.vercel.app`  
**Supabase Instance:** `https://earbbsjdiftjxuzdbype.supabase.co`  
**Status:** Root Cause Identified & Proven with Live HTTP Evidence; Code Defense Applied; All 28 Tests Passing; Production Build Clean

---

## 1. Executive Summary & Incident Overview

### The Reported Issue
1. A new merchant was registered via the LOCOStock merchant portal.
2. The application indicated that the verification email was successfully dispatched.
3. Upon opening the email and clicking the confirmation / sign-in link, Chrome navigated to `http://localhost:3000` and presented:
   ```
   ERR_CONNECTION_REFUSED
   ```

### Findings Summary
The redirect to `http://localhost:3000` was **not** caused by client code sending `http://localhost:3000`. The client code correctly requested `redirect_to=https://locostock.vercel.app/auth/callback`. 

Instead, the redirect to localhost occurred at the **Supabase Auth server level**:
- Supabase Auth received the request to verify the token with `redirect_to=https://locostock.vercel.app/auth/callback`.
- Supabase checked its dashboard **Redirect URLs allowlist**.
- Because `https://locostock.vercel.app/auth/callback` was **not present in Supabase's Allowed Redirect URLs**, Supabase considered the redirect target untrusted.
- As required by Supabase's authentication security model, Supabase silently stripped the untrusted `redirect_to` parameter and **fell back to the configured Site URL**.
- The configured **Site URL** in the Supabase project dashboard was set to default: `http://localhost:3000`.
- Consequently, Supabase issued an `HTTP 303 See Other` redirecting the user's browser directly to `http://localhost:3000`.
- Because the user was not running a local development server on port 3000 on their device, Chrome returned `ERR_CONNECTION_REFUSED`.

---

## 2. Irrefutable Live HTTP Evidence

To confirm this beyond any theoretical doubt, live probe requests were sent directly to the project's Supabase endpoint (`https://earbbsjdiftjxuzdbype.supabase.co/auth/v1/verify`):

### Probe Test 1: Testing Production Redirect URL
```http
GET /auth/v1/verify?token=test_probe&type=magiclink&redirect_to=https%3A%2F%2Flocostock.vercel.app%2Fauth%2Fcallback HTTP/1.1
Host: earbbsjdiftjxuzdbype.supabase.co
apikey: [REDACTED_PUBLISHABLE_KEY]
```
**Actual Supabase Response:**
```http
HTTP/1.1 303 See Other
Location: http://localhost:3000#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=
```
> **Notice:** Even though `redirect_to` was explicitly set to `https://locostock.vercel.app/auth/callback`, Supabase **rewrote the location to `http://localhost:3000`**!

---

### Probe Test 2: Testing Localhost Redirect URL
```http
GET /auth/v1/verify?token=test_probe&type=magiclink&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback HTTP/1.1
Host: earbbsjdiftjxuzdbype.supabase.co
apikey: [REDACTED_PUBLISHABLE_KEY]
```
**Actual Supabase Response:**
```http
HTTP/1.1 303 See Other
Location: http://localhost:3000/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=
```
> **Notice:** When given `http://localhost:3000/auth/callback`, Supabase **accepted the redirect path** `/auth/callback` because `http://localhost:3000` matched the configured Site URL!

This proves conclusively that Supabase actively rejects `https://locostock.vercel.app` as an unapproved redirect destination and forces the browser back to `http://localhost:3000`.

---

## 3. Comprehensive Code Defenses & Improvements Implemented

To ensure maximum resilience and prevent any edge cases, four major improvements were made to the codebase:

### 1. Hardened Production Guard in `src/lib/supabaseClient.ts`
Updated `getAuthRedirectUrl()` with four sequential tiers of origin detection and a strict production guard:
```typescript
export function getAuthRedirectUrl(): string {
  // 1. Browser environments: dynamically use window.location.origin
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.trim().replace(/\/+$/, '');
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return `${origin}/auth/callback`;
    }
  }

  // 2. Server environments: check NEXT_PUBLIC_APP_URL
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (appUrl && (appUrl.startsWith('http://') || appUrl.startsWith('https://'))) {
    // If in production mode but appUrl is set to localhost, prevent redirecting to localhost
    if (process.env.NODE_ENV === 'production' && appUrl.includes('localhost')) {
      return 'https://locostock.vercel.app/auth/callback';
    }
    return `${appUrl}/auth/callback`;
  }

  // 3. Vercel deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}/auth/callback`;
  }

  // 4. Default production fallback
  return 'https://locostock.vercel.app/auth/callback';
}
```
*Effect:* In local development, it returns `http://localhost:3000/auth/callback` (or custom port). In production, it returns `https://locostock.vercel.app/auth/callback` and will never output localhost.

---

### 2. Hash Fragment Error Parsing & Callback Optimization in `src/app/auth/callback/page.tsx`
When Supabase redirects an expired or invalid verification link, it passes the error in the URL hash fragment (`#error=access_denied&error_code=otp_expired&error_description=...`) rather than query parameters.
- **Before:** The callback page only inspected `searchParams`. Invalid or expired links sat on the spinning loader for 6 seconds before timing out.
- **After:** The callback page checks both `searchParams` and `window.location.hash`. Expired or invalid links immediately display the exact user-friendly error from Supabase with an immediate "Return to Merchant Login" button.
- Removed `status` from the `useEffect` dependency array to eliminate redundant re-executions during state transitions.

---

### 3. Automatic Auth Fragment Interceptor in `src/context/UserContext.tsx`
If an email link or external browser redirect drops a merchant on the root site (`https://locostock.vercel.app/#access_token=...` or `?code=...`) instead of `/auth/callback`:
```typescript
useEffect(() => {
  if (typeof window !== 'undefined' && window.location.pathname !== '/auth/callback') {
    const hasAuthHash = window.location.hash && (
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('error=')
    );
    const hasAuthQuery = window.location.search && (
      window.location.search.includes('code=') ||
      window.location.search.includes('token_hash=')
    );
    if (hasAuthHash || hasAuthQuery) {
      window.location.replace('/auth/callback' + window.location.search + window.location.hash);
    }
  }
}, []);
```
*Effect:* Any stray authentication tokens or error fragments landing on public pages are seamlessly routed into `/auth/callback`, establishing the merchant session and redirecting to the merchant dashboard without user friction.

---

### 4. Preservation of Merchant Role & Data Isolation
- In `src/lib/db.ts` and `src/app/auth/callback/page.tsx`, successful verification provisions or retrieves a profile with `role: 'shopkeeper'`.
- All merchant routes (`/shopkeeper`, `/billing`, `/inventory`, `/history`, `/shop`) enforce `if (!profile) return <MerchantSignInRequired />`.
- Unverified users cannot access store management, stock updates, or POS billing.
- Customer discovery functions independently and anonymously without requiring login.

---

## 4. Test Suite & Verification Results

### A. Automated Test Suite (28/28 Passed)
```bash
npm test
> node --test tests/unit_and_integration.test.mjs tests/security_suite.test.mjs tests/area_search_and_sync.test.mjs tests/auth_and_redirects.test.mjs

✔ Manual Area Discovery - Search an area containing registered shops returns matching shops
✔ Manual Area Discovery - Search an area without shops returns empty result and triggers expected message
✔ Manual Area Discovery - Search with empty input returns validation message
✔ Manual Area Discovery - Switching between different areas updates results accurately
✔ Manual Area Discovery - Strict precision prevents unrelated shops from matching
✔ Shopkeeper Registration - Captures full physical address details into shops schema
✔ Customer & Shopkeeper Synchronization - Inventory update reflects in customer catalog
✔ Privacy & Security - Discovery functions without GPS permissions or device tracking
✔ Auth Redirect URL generation uses environment and window.location origin
✔ Auth Callback parameter detection handles code, token_hash, and hash fragments
✔ Stray root auth fragment is intercepted and routed to /auth/callback
✔ Next.js Security Headers are configured with complete defensive suite
✔ Input Sanitizer neutralizes XSS vectors, script tags, and control characters
✔ Rate Limiter strictly throttles requests and rejects bursts exceeding quota
✔ CSRF / Origin Validator rejects cross-site attacks and foreign origins
✔ Zod Schemas enforce strict boundaries on billing payloads
✔ Error Masker redacts internal database schemas, SQL statements, and call stacks
✔ Billing Cart Item Aggregation merges duplicate products and enforces bounds
✔ Quantity aggregation validates NUMERIC bounds before INT conversion
✔ Monetary sanitization rejects NaN, Infinity, -Infinity, negative, and over-subtotal amounts
✔ Idempotency key sanitization normalizes whitespace-only strings to null and bounds lengths
✔ SHA-256 Request fingerprint is order-independent on items and detects payload mutations
✔ API billing error mapper returns appropriate HTTP status codes without leaking SQL details
✔ Database Schema defines privilege-based stock protection and required security controls
✔ Direct stock UPDATE is denied while trusted inventory procedures are authorized
✔ Normal authenticated user cannot verify a shop or promote a profile
✔ adjust_stock_atomic enforces ownership for users and audit attribution for service-role
✔ Failed billing rolls back invoices, line items, stock deductions, and audit records

Summary: 28 passing, 0 failing
```

### B. TypeScript Compilation
```bash
npm run typecheck
> tsc --noEmit
# Result: 0 errors
```

### C. Next.js Production Build
```bash
npm run build
> next build --webpack
✓ Compiled successfully in 4.8s
Finished TypeScript in 1171ms
Generating static pages (16/16) in 685ms
# Result: Clean compilation across all 16 dynamic and static routes
```

---

## 5. Required Action in Supabase Dashboard (Fix for the Redirect)

To permanently resolve the Supabase server-level redirect to localhost, you must update two settings in your Supabase project dashboard:

1. Open your browser and navigate to:  
   **[https://supabase.com/dashboard/project/earbbsjdiftjxuzdbype/auth/url-configuration](https://supabase.com/dashboard/project/earbbsjdiftjxuzdbype/auth/url-configuration)**

2. Under **Site URL**:
   - Change the value from `http://localhost:3000` to:
     ```
     https://locostock.vercel.app
     ```

3. Under **Redirect URLs** (click **Add URL**):
   - Add: `https://locostock.vercel.app/**`
   - Add: `https://locostock.vercel.app/auth/callback`
   - Add: `http://localhost:3000/**`
   - Add: `http://localhost:3000/auth/callback`
   *(Adding both production and localhost ensures that local testing continues to work on localhost, while production always redirects to Vercel.)*

4. Click **Save Changes**.

---

## 6. Required Action in Vercel Dashboard

In your Vercel Project Settings under **Environment Variables**:
Ensure the following variable is configured for **Production**:
```
NEXT_PUBLIC_APP_URL = https://locostock.vercel.app
```
*(Ensure it does not point to `http://localhost:3000` in the Production environment).*
