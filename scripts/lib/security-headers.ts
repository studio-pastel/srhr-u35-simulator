// SPEC.md §13.2 のセキュリティヘッダー。
// public/.htaccess（本番）と vite preview（E2E）で同じ値を使う。一致はテストで確かめる。
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'none'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};
