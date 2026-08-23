import { describe, expect, it } from 'vitest';
import { ApiError, fieldErrorsFrom, messageFor } from './api-error';

describe('error copy', () => {
  it('translates a known code into Portuguese', () => {
    expect(messageFor(new ApiError('INVALID_CREDENTIALS', 401, 'Invalid email or password'))).toBe(
      'E-mail ou senha incorretos.',
    );
  });

  it('falls back rather than leaking an internal message', () => {
    const internal = new ApiError('INTERNAL_ERROR', 500, 'relation "users" does not exist');
    const shown = messageFor(internal);

    expect(shown).not.toContain('users');
    expect(shown).toBe('Algo não saiu como esperado. Tente novamente em alguns instantes.');
  });

  it('handles a thrown value that is not an ApiError', () => {
    expect(messageFor(new TypeError('boom'))).toBeTypeOf('string');
    expect(messageFor(undefined)).toBeTypeOf('string');
  });

  it('never says whether an account exists', () => {
    // Both the unknown-email and wrong-password cases arrive as the same code,
    // and must therefore read identically on screen.
    expect(messageFor(new ApiError('INVALID_CREDENTIALS', 401, 'a'))).toBe(
      messageFor(new ApiError('INVALID_CREDENTIALS', 401, 'b')),
    );
  });

  it('extracts field errors from a validation failure', () => {
    const error = new ApiError('VALIDATION_FAILED', 422, 'invalid', [
      { field: 'email', message: 'Informe um e-mail válido' },
      { field: 'password', message: 'A senha precisa ter pelo menos 10 caracteres' },
    ]);

    expect(fieldErrorsFrom(error)).toEqual({
      email: 'Informe um e-mail válido',
      password: 'A senha precisa ter pelo menos 10 caracteres',
    });
  });

  it('ignores malformed details instead of crashing the form', () => {
    expect(fieldErrorsFrom(new ApiError('VALIDATION_FAILED', 422, 'x', 'not-an-array'))).toEqual(
      {},
    );
    expect(fieldErrorsFrom(new ApiError('SOMETHING_ELSE', 400, 'x', []))).toEqual({});
  });
});
