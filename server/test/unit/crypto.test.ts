import { describe, expect, it } from 'vitest';

import {
  chainHash,
  decryptSecret,
  encryptSecret,
  generateNumericCode,
  generateReceiptCode,
  safeEqual,
  sha256,
} from '../../src/utils/crypto.js';
import { verifyAuditChain } from '../../src/services/audit/audit.service.js';
import { GENESIS_HASH } from '../../src/config/constants.js';

describe('crypto utils', () => {
  it('sha256 is deterministic', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
    expect(sha256('a')).not.toBe(sha256('b'));
  });

  it('encrypts and decrypts a secret round-trip', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it('safeEqual compares correctly', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('generates codes of the right shape', () => {
    expect(generateNumericCode(6)).toMatch(/^\d{6}$/);
    expect(generateReceiptCode()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('chainHash changes when the previous hash or payload changes', () => {
    const a = chainHash(GENESIS_HASH, { x: 1 });
    const b = chainHash(a, { x: 1 });
    expect(a).not.toBe(b);
    expect(chainHash(GENESIS_HASH, { x: 1 })).toBe(a);
  });
});

describe('audit chain verification', () => {
  it('accepts a well-formed chain', () => {
    const h1 = chainHash(GENESIS_HASH, { a: 1 });
    const h2 = chainHash(h1, { a: 2 });
    const result = verifyAuditChain([
      { hash: h1, prevHash: GENESIS_HASH, sequence: 1 },
      { hash: h2, prevHash: h1, sequence: 2 },
    ]);
    expect(result.valid).toBe(true);
  });

  it('detects a broken link', () => {
    const result = verifyAuditChain([
      { hash: 'h1', prevHash: GENESIS_HASH, sequence: 1 },
      { hash: 'h2', prevHash: 'tampered', sequence: 2 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
  });
});
