const lastLogged = new Map();

export function isDatabaseUnavailable(error) {
  return Boolean(
    error && (
      error.code === 'P1001'
      || error.name === 'PrismaClientInitializationError'
      || error.name === 'PrismaClientKnownRequestError' && /Can't reach database server/i.test(error.message || '')
    )
  );
}

export function logDatabaseWarningOnce(scope, error, cooldownMs = 30000) {
  const now = Date.now();
  const last = lastLogged.get(scope) || 0;
  if (now - last < cooldownMs) return;
  lastLogged.set(scope, now);
  console.warn(`[DB unavailable] ${scope}: ${error?.message?.split('\n')[0] || 'Database temporarily unreachable'}`);
}

export function sendDatabaseUnavailable(res, fallback = {}) {
  return res.status(503).json({
    error: 'Database temporarily unavailable. Please try again shortly.',
    ...fallback,
  });
}
