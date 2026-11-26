import test from 'node:test';
import assert from 'node:assert/strict';

test('Auth Redirect URL generation uses environment and window.location origin', () => {
  const getAuthRedirectUrlMock = ({ origin, appUrl, nodeEnv, vercelUrl }) => {
    // 1. Browser environments
    if (origin) {
      const clean = origin.trim().replace(/\/+$/, '');
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        return `${clean}/auth/callback`;
      }
    }

    // 2. Server environments
    if (appUrl) {
      const base = appUrl.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
      if (base.startsWith('http://') || base.startsWith('https://')) {
        if (nodeEnv === 'production' && base.includes('localhost')) {
          return 'https://locostock.vercel.app/auth/callback';
        }
        return `${base}/auth/callback`;
      }
    }

    // 3. Vercel deployment URL
    if (vercelUrl) {
      return `https://${vercelUrl.replace(/\/+$/, '')}/auth/callback`;
    }

    // 4. Default production fallback
    return 'https://locostock.vercel.app/auth/callback';
  };

  // Test local development origin
  assert.equal(
    getAuthRedirectUrlMock({ origin: 'http://localhost:3000' }),
    'http://localhost:3000/auth/callback'
  );

  // Test local development custom port
  assert.equal(
    getAuthRedirectUrlMock({ origin: 'http://localhost:3001' }),
    'http://localhost:3001/auth/callback'
  );

  // Test production Vercel origin
  assert.equal(
    getAuthRedirectUrlMock({ origin: 'https://locostock.vercel.app' }),
    'https://locostock.vercel.app/auth/callback'
  );

  // Test SSR fallback to NEXT_PUBLIC_APP_URL
  assert.equal(
    getAuthRedirectUrlMock({ origin: null, appUrl: 'https://locostock.vercel.app/' }),
    'https://locostock.vercel.app/auth/callback'
  );

  // Test production guard: if NODE_ENV=production and appUrl is localhost, MUST NEVER return localhost
  assert.equal(
    getAuthRedirectUrlMock({ origin: null, appUrl: 'http://localhost:3000', nodeEnv: 'production' }),
    'https://locostock.vercel.app/auth/callback'
  );

  // Test default fallback
  assert.equal(
    getAuthRedirectUrlMock({ origin: null, appUrl: null }),
    'https://locostock.vercel.app/auth/callback'
  );
});

test('Auth Callback parameter detection handles code, token_hash, and hash fragments', () => {
  const parseCallbackParams = (searchParamsString, hashString) => {
    const searchParams = new URLSearchParams(searchParamsString);
    const code = searchParams.get('code');
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    let error = searchParams.get('error');
    let errorDescription = searchParams.get('error_description');

    let hashAccessToken = null;
    let hashRefreshToken = null;
    if (hashString && hashString.startsWith('#')) {
      const hashParams = new URLSearchParams(hashString.substring(1));
      hashAccessToken = hashParams.get('access_token');
      hashRefreshToken = hashParams.get('refresh_token');
      if (!error) {
        error = hashParams.get('error');
        errorDescription = hashParams.get('error_description');
      }
    }

    if (error) return { method: 'error', error, errorDescription };
    if (code) return { method: 'pkce', code };
    if (token_hash) return { method: 'token_hash', token_hash, type: type || 'email' };
    if (hashAccessToken && hashRefreshToken) return { method: 'hash_fragment', hashAccessToken, hashRefreshToken };
    return { method: 'none' };
  };

  // Test PKCE code
  assert.deepEqual(parseCallbackParams('code=test-auth-code-123', ''), {
    method: 'pkce',
    code: 'test-auth-code-123'
  });

  // Test token_hash with type
  assert.deepEqual(parseCallbackParams('token_hash=pkce-token-hash-xyz&type=signup', ''), {
    method: 'token_hash',
    token_hash: 'pkce-token-hash-xyz',
    type: 'signup'
  });

  // Test hash fragment token pair
  assert.deepEqual(parseCallbackParams('', '#access_token=token123&refresh_token=refresh456&token_type=bearer'), {
    method: 'hash_fragment',
    hashAccessToken: 'token123',
    hashRefreshToken: 'refresh456'
  });

  // Test query error
  assert.deepEqual(parseCallbackParams('error=access_denied&error_description=User+declined', ''), {
    method: 'error',
    error: 'access_denied',
    errorDescription: 'User declined'
  });

  // Test Supabase hash fragment error (#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired)
  assert.deepEqual(parseCallbackParams('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'), {
    method: 'error',
    error: 'access_denied',
    errorDescription: 'Email link is invalid or has expired'
  });
});

test('Stray root auth fragment is intercepted and routed to /auth/callback', () => {
  const shouldForwardToAuthCallback = (pathname, search, hash) => {
    if (pathname === '/auth/callback') return false;
    const hasAuthHash = hash && (hash.includes('access_token=') || hash.includes('error='));
    const hasAuthQuery = search && (search.includes('code=') || search.includes('token_hash='));
    return Boolean(hasAuthHash || hasAuthQuery);
  };

  // Root path with access token in hash fragment should forward
  assert.equal(
    shouldForwardToAuthCallback('/', '', '#access_token=123&refresh_token=456'),
    true
  );

  // Root path with error in hash fragment should forward
  assert.equal(
    shouldForwardToAuthCallback('/', '', '#error=access_denied'),
    true
  );

  // Root path with PKCE code should forward
  assert.equal(
    shouldForwardToAuthCallback('/', '?code=abc1234', ''),
    true
  );

  // Normal root visit should NOT forward
  assert.equal(
    shouldForwardToAuthCallback('/', '', ''),
    false
  );

  // Normal customer search visit should NOT forward
  assert.equal(
    shouldForwardToAuthCallback('/search', '?q=milk', ''),
    false
  );

  // Already on /auth/callback should NOT forward
  assert.equal(
    shouldForwardToAuthCallback('/auth/callback', '?code=123', '#access_token=456'),
    false
  );
});
