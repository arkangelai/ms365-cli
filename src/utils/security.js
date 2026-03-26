function isObject(value) {
  return value !== null && typeof value === 'object';
}

const SECRET_KEY_PATTERN = /(authorization|token|secret|password|cookie|set-cookie|client_secret|refresh_token|access_token|id_token)/i;

export function redactSensitiveData(value) {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveData);
  }

  if (!isObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (SECRET_KEY_PATTERN.test(key)) {
        return [key, '[REDACTED]'];
      }

      return [key, redactSensitiveData(entryValue)];
    })
  );
}

export function assertSafeGraphEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    throw new Error('Graph endpoint must be a non-empty string');
  }

  if (!endpoint.startsWith('/')) {
    throw new Error('Graph endpoint must start with "/"');
  }

  if (endpoint.includes('\r') || endpoint.includes('\n')) {
    throw new Error('Graph endpoint contains invalid characters');
  }
}
