import { describe, expect, it } from 'vitest';

import { GENESIS_HASH } from '../../src/config/constants.js';
import { verifyAuditChain } from '../../src/services/audit/audit.service.js';
import {
  chainHash,
  decryptSecret,
  encryptSecret,
  generateNumericCode,
  generateReceiptCode,
  safeEqual,
  sha256,
} from '../../src/utils/crypto.js';

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
  // A row exactly as the verifier will read it back from Postgres. The hash
  // is derived from the SAME payload appendAudit hashes, so these specs also
  // pin the payload shape: change one without the other and they fail.
  const row = (
    sequence: number,
    prevHash: string,
    overrides: Partial<{
      action: string;
      createdAt: Date;
      metadata: unknown;
    }> = {},
  ) => {
    const base = {
      action: overrides.action ?? `thing.${String(sequence)}`,
      actorId: null,
      actorRole: null,
      createdAt: overrides.createdAt ?? new Date(1_700_000_000_000 + sequence),
      entity: 'Thing',
      entityId: null,
      metadata: overrides.metadata ?? null,
      prevHash,
      sequence,
    };
    const hash = chainHash(prevHash, {
      action: base.action,
      actorId: base.actorId,
      actorRole: base.actorRole,
      entity: base.entity,
      entityId: base.entityId,
      metadata: base.metadata,
      timestamp: base.createdAt.toISOString(),
    });
    return { ...base, hash };
  };

  it('accepts a well-formed chain', () => {
    const first = row(1, GENESIS_HASH);
    const second = row(2, first.hash);
    expect(verifyAuditChain([first, second]).valid).toBe(true);
  });

  it('detects a broken link', () => {
    const first = row(1, GENESIS_HASH);
    const second = row(2, 'tampered');
    const result = verifyAuditChain([first, second]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.reason).toBe('link');
  });

  it('detects content edited in place, with the links left intact', () => {
    const first = row(1, GENESIS_HASH);
    const second = row(2, first.hash);
    // Exactly what a link-only check missed: rewrite what an entry SAYS while
    // leaving prevHash/hash untouched, and the chain still joins up.
    const doctored = { ...second, action: 'nothing.happened' };
    const result = verifyAuditChain([first, doctored]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.reason).toBe('content');
  });

  it('detects a rewritten timestamp', () => {
    const first = row(1, GENESIS_HASH);
    const result = verifyAuditChain([
      { ...first, createdAt: new Date(1_800_000_000_000) },
    ]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('content');
  });

  it('detects rewritten metadata', () => {
    const first = row(1, GENESIS_HASH, { metadata: { amount: 1 } });
    const result = verifyAuditChain([{ ...first, metadata: { amount: 999 } }]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('content');
  });

  it('accepts an empty chain', () => {
    expect(verifyAuditChain([]).valid).toBe(true);
  });
});
