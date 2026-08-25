// src/utils/sanitize.ts
//
// Field-name based masking shared by the error handler, the error tracker's
// beforeSend hook and the analytics wrapper: one list of what must never
// leave the process, applied the same way everywhere.

/** Any key containing one of these fragments (case-insensitive) is masked. */
export const SENSITIVE_KEY_FRAGMENTS = ['password', 'token', 'secret', 'auth', 'key', 'credit', 'ssn'];

/**
 * Short names the fragment list cannot safely include: `code` carries OTP/2FA
 * guesses and receipt codes, `otp`/`pin` are credentials wherever they appear.
 */
export const SENSITIVE_EXACT_KEYS = ['code', 'otp', 'pin'];

export const REDACTED = '[REDACTED]';

export const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((k) => lower.includes(k)) || SENSITIVE_EXACT_KEYS.includes(lower);
};

/**
 * Deep-copy `data` with every sensitive field replaced by a marker. Keys are
 * kept so the shape of a payload is still readable; only values are masked.
 */
export const sanitizeErrorData = (data: unknown): unknown => {
  if (!data) return data;

  // Preserve array shape (mapping entries through the sanitizer); treating an
  // array as a generic object would turn it into { "0": ..., "1": ... }.
  if (Array.isArray(data)) return data.map(sanitizeErrorData);

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};

    Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
      if (isSensitiveKey(key)) {
        sanitized[key] = REDACTED;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeErrorData(value);
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  return data;
};
