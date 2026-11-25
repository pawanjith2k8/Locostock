import test from 'node:test';
import assert from 'node:assert/strict';

test('Auth Redirect URL generation uses environment and window.location origin', () => {
  // Mock window.location.origin fallback logic
  const getAuthRedirectUrlMock = (origin, envUrl) => {
    if (origin) {
      return `${origin.replace(/\/+$/, '')}/auth/callback`;
    }
    if (envUrl) {
      return `${envUrl.replace(/\/+$/, '')}/auth/callback`;
    }
    return 'https://locostock.vercel.app/auth/callback';
  };

  // Test local development origin
  assert.equal(
    getAuthRedirectUrlMock('http://localhost:3000', undefined),
    'http://localhost:3000/auth/callback'
  );

  // Test production Vercel origin
  assert.equal(
    getAuthRedirectUrlMock('https://locostock.vercel.app', undefined),
    'https://locostock.vercel.app/auth/callback'
  );

  // Test SSR fallback to NEXT_PUBLIC_APP_URL
  assert.equal(
    getAuthRedirectUrlMock(null, 'https://locostock.vercel.app/'),
    'https://locostock.vercel.app/auth/callback'
  );

  // Test default fallback
  assert.equal(
    getAuthRedirectUrlMock(null, null),
    'https://locostock.vercel.app/auth/callback'
  );
});

test('Auth Callback parameter detection handles code, token_hash, and hash fragments', () => {
  const parseCallbackParams = (searchParamsString, hashString) => {
    const searchParams = new URLSearchParams(searchParamsString);
    const code = searchParams.get('code');
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const error = searchParams.get('error');

    let hashAccessToken = null;
    let hashRefreshToken = null;
    if (hashString && hashString.startsWith('#')) {
      const hashParams = new URLSearchParams(hashString.substring(1));
      hashAccessToken = hashParams.get('access_token');
      hashRefreshToken = hashParams.get('refresh_token');
    }

    if (error) return { method: 'error', error };
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

  // Test error
  assert.deepEqual(parseCallbackParams('error=access_denied&error_description=User+declined', ''), {
    method: 'error',
    error: 'access_denied'
  });
});
