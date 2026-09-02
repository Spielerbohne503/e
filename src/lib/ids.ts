/**
 * Identifiers. All ids are opaque strings; the space token is the only
 * secret in the system, so it comes from a cryptographic source.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function randomString(length: number, alphabet: string): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  // Rejection-free mapping is unnecessary here; the modulo bias over a
  // 36-char alphabet is negligible for collision resistance at this length.
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length]
  return out
}

/** Short, readable, collision-safe enough for a single-user data set. */
export function newId(prefix: string): string {
  return `${prefix}_${randomString(16, ALPHABET)}`
}

/** 32 characters from a cryptographic source, per the sync design. */
export function newSpaceToken(): string {
  return randomString(32, ALPHABET)
}

export const isSpaceToken = (value: string): boolean => /^[a-z0-9]{32}$/.test(value)
