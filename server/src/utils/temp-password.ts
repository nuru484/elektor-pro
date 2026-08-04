// src/utils/temp-password.ts
import { randomInt } from 'node:crypto';

const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWER + UPPER + DIGITS;

const pick = (alphabet: string): string => alphabet[randomInt(alphabet.length)];

/**
 * Generate a temporary password for admin-created accounts: 12 chars,
 * guaranteed to satisfy the lower/upper/digit policy, ambiguous glyphs
 * (0/O, 1/l/I) excluded so it survives being read out or handwritten.
 */
export const generateTempPassword = (): string => {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < 12) chars.push(pick(ALL));
  // Fisher-Yates so the guaranteed classes aren't always in front.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};
