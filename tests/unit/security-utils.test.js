import { describe, expect, it } from 'vitest';
import { assertSafeGraphEndpoint, redactSensitiveData } from '../../src/utils/security.js';

describe('security utils', () => {
  it('redacts nested token-like fields', () => {
    const input = {
      access_token: 'secret-1',
      nested: {
        Authorization: 'Bearer secret-2',
        safe: 'value',
      },
    };

    expect(redactSensitiveData(input)).toEqual({
      access_token: '[REDACTED]',
      nested: {
        Authorization: '[REDACTED]',
        safe: 'value',
      },
    });
  });

  it('rejects graph endpoints without a leading slash', () => {
    expect(() => assertSafeGraphEndpoint('https://graph.microsoft.com/v1.0/me'))
      .toThrow('Graph endpoint must start with "/"');
  });

  it('rejects graph endpoints with newlines', () => {
    expect(() => assertSafeGraphEndpoint('/me/messages\nAuthorization: nope'))
      .toThrow('Graph endpoint contains invalid characters');
  });
});
