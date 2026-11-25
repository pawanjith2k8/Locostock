# LOCOStock — Shopkeeper Authentication Fix, Redirect Correction & Merchant UI Cleanup Report

**Date:** November 25, 2026  
**Application:** LOCOStock  
**Production URL:** `https://locostock.vercel.app`  
**Supabase Instance:** `https://earbbsjdiftjxuzdbype.supabase.co`  
**Status:** Verification Passed (27/27 Tests Passing, Clean Production Build)

---

## 1. Executive Summary

This report documents the resolution of three merchant portal issues:
1. **Authentication Mode Mismatch**: The portal previously forced a 6-digit OTP UI input while Supabase Auth default settings send email confirmation links.
2. **Localhost Redirect in Email Links**: Email links previously defaulted to `http://localhost:3000/#access_token=...`, triggering `ERR_CONNECTION_REFUSED` for production users.
3. **Infrastructure Branding Exposure**: Merchant-facing interfaces previously displayed technical infrastructure messages such as "Supabase Service Not Configured", "Supabase Live & Reachable", and database connectivity probes.

All issues have been resolved without breaking existing features, without weakening authentication security, and while preserving the green LOCOStock aesthetic.

---

## 2. Root Cause Analysis

### A. OTP / Email Link Mismatch
- **Mechanism:** Supabase `auth.signInWithOtp()` triggers an email containing a magic link (or confirmation link) by default, unless the project template has been manually customized to include `{{ .Token }}` instead of `{{ .ConfirmationURL }}`.
- **Problem:** The previous LOCOStock UI immediately switched to a screen requiring a 6-digit verification code. Users who received an email titled *"Confirm your email address"* with a clickable link had no OTP code to enter, causing user confusion and drop-off.
- **Resolution:** Redesigned the authentication screen to treat **Email Confirmation Links as Primary** and **6-Digit OTP as Secondary / Fallback**. The UI displays an inbox waiting card with background session detection, while offering a toggle to enter a 6-digit code if the user received an OTP token.

### B. Localhost Redirect Issue
- **Mechanism:** When Supabase Auth sends confirmation emails, it redirects to the URL configured in `emailRedirectTo`. If omitted or set to local origin during SSR, Supabase falls back to the Site URL or default URL in the dashboard (often `http://localhost:3000`).
- **Problem:** When users clicked the verification link in their email on a mobile device or outside the local development environment, the browser attempted to navigate to `http://localhost:3000/auth/callback` or `http://localhost:3000/#access_token=...`, causing `ERR_CONNECTION_REFUSED`.
- **Resolution:** Implemented `getAuthRedirectUrl()` helper in `src/lib/supabaseClient.ts` that dynamically detects `window.location.origin` in the browser, falls back to `process.env.NEXT_PUBLIC_APP_URL`, and defaults to `https://locostock.vercel.app/auth/callback`.

---

## 3. Code Modifications & Architecture Updates

### 1. `src/lib/supabaseClient.ts`
- Added `getAuthRedirectUrl()`:
  ```typescript
  export function getAuthRedirectUrl(): string {
    if (typeof window !== 'undefined' && window.location.origin) {
      return `${window.location.origin.replace(/\/+$/, '')}/auth/callback`;
    }
    const envUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (envUrl) {
      return `${envUrl.replace(/\/+$/, '')}/auth/callback`;
    }
    return 'https://locostock.vercel.app/auth/callback';
  }
  ```
- Ensures environment keys are sanitized (whitespace trimmed, quotes stripped).

### 2. `src/lib/db.ts`
- Updated `sendShopkeeperOtp(email)` to use `emailRedirectTo: getAuthRedirectUrl()`.
- Enhanced `verifyShopkeeperOtp(email, token)` with dual-type fallback:
  - First attempts verification using `type: 'email'`.
  - If rejected, falls back to `type: 'signup'`.
- Replaced technical database exception messages with business-friendly error strings.

### 3. `src/app/auth/callback/page.tsx`
- Complete overhaul of auth callback verification supporting 3 distinct verification vectors:
  1. **PKCE Code Exchange:** Exchanges `code` query param via `supabase.auth.exchangeCodeForSession(code)`.
  2. **Token Hash Verification:** Exchanges `token_hash` and `type` via `supabase.auth.verifyOtp({ token_hash, type })`.
  3. **Hash Fragment Fallback:** Parses `#access_token=...&refresh_token=...` via `supabase.auth.setSession()`.
- **Profile Provisioning:** After successful authentication, automatically inspects whether a merchant profile exists in the `profiles` table. If not, creates one with role `'shopkeeper'` to prevent onboarding dead-ends.
- **URL Cleansing:** Silently strips access tokens from the URL bar using `window.history.replaceState` without triggering a full page refresh.
- Wrapped in React `Suspense` boundary for Next.js static prerendering compatibility.

### 4. `src/app/shopkeeper/login/page.tsx`
- Replaced OTP-first screen with an accordion UX flow:
  - **Step 1:** Registered merchant enters email and clicks *"Send Verification Email"*.
  - **Step 2:** Displays *"Check Your Inbox"* card with a live background listener (`onAuthStateChange`) that automatically logs the merchant in as soon as they click the link in their email.
  - **Fallback:** Includes a *"Received a 6-digit code instead?"* accordion toggle revealing the 6-digit OTP input for projects configured with token-based templates.
- Removed technical infrastructure indicator (`Database` icon, endpoint URLs, connectivity probe).
- Replaced with a business-friendly status badge: *"Store Portal: All systems operational"*.

---

## 4. Merchant Portal UI Cleanup Audit

All raw infrastructure branding ("Supabase", raw credentials, database endpoints) has been replaced across merchant-facing views:

| File Location | Old User-Facing Text | New Business-Friendly Text |
| :--- | :--- | :--- |
| `src/app/shopkeeper/login/page.tsx` | "Supabase Live & Reachable" / "Auth & DB Endpoint: https://..." | "Store Portal: All systems operational" |
| `src/app/shopkeeper/login/page.tsx` | "Send Verification OTP" | "Send Verification Email" |
| `src/app/shopkeeper/page.tsx` | "Supabase Service Not Configured" | "Store Portal Offline" |
| `src/app/shopkeeper/billing/page.tsx` | "Supabase Service Not Configured" | "Billing Terminal Offline" |
| `src/app/shopkeeper/inventory/page.tsx` | "Supabase Service Not Configured" | "Inventory Service Offline" |
| `src/app/shopkeeper/history/page.tsx` | "Supabase Service Not Configured" | "Sales History Offline" |
| `src/app/shopkeeper/shop/page.tsx` | "Supabase Service Not Configured" | "Store Profile Offline" |
| `src/app/shopkeeper/onboarding/page.tsx` | "Supabase Service Not Configured" | "Shop Registration Offline" |
| `src/app/auth/callback/page.tsx` | "Supabase service is not configured" | "Authentication service is currently unavailable" |

*Note: Database connectivity, Supabase client initialization, security policies, and error handling remain 100% active and functional under the hood.*

---

## 5. Verification & Test Suite Results

### A. TypeScript Typecheck
```bash
npm run typecheck
> tsc --noEmit
# Result: 0 errors
```

### B. Unit & Integration Test Suite
```bash
npm test
> node --test tests/unit_and_integration.test.mjs tests/security_suite.test.mjs tests/area_search_and_sync.test.mjs tests/auth_and_redirects.test.mjs

✔ Manual Area Discovery - Search an area containing registered shops returns matching shops
✔ Manual Area Discovery - Search an area without shops returns empty result
✔ Manual Area Discovery - Search with empty input returns validation message
✔ Manual Area Discovery - Switching between different areas updates results accurately
✔ Manual Area Discovery - Strict precision prevents unrelated shops from matching
✔ Shopkeeper Registration - Captures full physical address details into shops schema
✔ Customer & Shopkeeper Synchronization - Inventory update reflects in customer catalog
✔ Privacy & Security - Discovery functions without GPS permissions or device tracking
✔ Auth Redirect URL generation uses environment and window.location origin
✔ Auth Callback parameter detection handles code, token_hash, and hash fragments
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

Summary: 27 passing, 0 failing, duration ~1.9s
```

### C. Next.js Production Build
```bash
npm run build
> next build --webpack
✓ Compiled successfully in 5.4s
Finished TypeScript in 1253ms
Generating static pages (16/16) in 646ms
Route (app)
├ ○ /
├ ○ /_not-found
├ ƒ /api/billing
├ ƒ /api/products/search
├ ○ /auth/callback
├ ○ /history
├ ○ /search
├ ○ /shopkeeper
├ ○ /shopkeeper/billing
├ ○ /shopkeeper/history
├ ○ /shopkeeper/inventory
├ ○ /shopkeeper/login
├ ○ /shopkeeper/onboarding
├ ○ /shopkeeper/shop
├ ○ /shops
└ ƒ /shops/[id]
```

---

## 6. Actionable Supabase & Vercel Dashboard Settings

To ensure the production deployment operates without issues, verify the following in your dashboards:

### 1. Supabase Dashboard (`https://supabase.com/dashboard/project/earbbsjdiftjxuzdbype`)
- Navigate to **Authentication** > **URL Configuration**:
  - **Site URL:** Set to `https://locostock.vercel.app`
  - **Redirect URLs:** Add both:
    - `https://locostock.vercel.app/auth/callback`
    - `http://localhost:3000/auth/callback` (for local development)
- (Optional) Navigate to **Authentication** > **Email Templates** > **Magic Link**:
  - If you wish to send 6-digit codes rather than links, change the template content to show `{{ .Token }}` instead of `{{ .ConfirmationURL }}`. LOCOStock now handles both methods seamlessly.

### 2. Vercel Dashboard (`https://vercel.com`)
Ensure the following 4 Environment Variables are set for **Production**:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://earbbsjdiftjxuzdbype.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<your-supabase-anon-key>`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `<your-supabase-publishable-key>`
- `NEXT_PUBLIC_APP_URL` = `https://locostock.vercel.app`
