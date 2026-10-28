import { describe, expect, it } from 'vitest';
import { autoLabel, entropyBits, generate, makeCollection, validate } from './collections';
import {
  buildCharset,
  charsetEntropy,
  CharRules,
  DEFAULT_SYMBOLS,
  generateFromCharset,
  log2Big,
  randomBelow,
  randomInt,
} from './random';

const rules = (overrides: Partial<CharRules> = {}): CharRules => ({
  lower: true,
  upper: true,
  digits: true,
  symbols: false,
  symbolSet: DEFAULT_SYMBOLS,
  extra: '',
  exclude: '',
  noLookalikes: false,
  requireEach: false,
  noLeadingSymbol: false,
  ...overrides,
});

describe('randomBelow', () => {
  it('stays in range', () => {
    for (const n of [1, 2, 3, 7, 1000, 2 ** 32, 2 ** 32 + 1, 2 ** 53]) {
      for (let i = 0; i < 200; i++) {
        const x = randomBelow(n);
        expect(Number.isInteger(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(n);
      }
    }
  });

  it('rejects bad ranges', () => {
    expect(() => randomBelow(0)).toThrow();
    expect(() => randomBelow(1.5)).toThrow();
    expect(() => randomBelow(2 ** 53 + 2)).toThrow();
  });

  it('is roughly uniform (chi-squared)', () => {
    const n = 7;
    const samples = 70_000;
    const counts = new Array(n).fill(0);
    for (let i = 0; i < samples; i++) counts[randomBelow(n)]++;
    const expected = samples / n;
    const chi2 = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    // 6 degrees of freedom, p = 0.0001 critical value ~ 27.9
    expect(chi2).toBeLessThan(27.9);
  });

  it('randomInt covers both ends', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randomInt(-2, 2));
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
  });
});

describe('buildCharset', () => {
  it('combines classes', () => {
    expect(buildCharset(rules(), 10).pool.length).toBe(62);
    expect(buildCharset(rules({ symbols: true }), 10).pool.length).toBe(70);
  });

  it('drops look-alikes, excluded and duplicate chars', () => {
    const cs = buildCharset(rules({ noLookalikes: true, exclude: 'abc', extra: 'xyz€ ' }), 10);
    for (const c of 'Il1O0oabc ') expect(cs.pool).not.toContain(c);
    expect(cs.pool).toContain('€');
    expect(new Set(cs.pool).size).toBe(cs.pool.length);
  });

  it('only requires groups when there is room for them', () => {
    expect(buildCharset(rules({ requireEach: true }), 3).required.length).toBe(3);
    expect(buildCharset(rules({ requireEach: true }), 2).required.length).toBe(0);
  });

  it('limits leading characters', () => {
    const cs = buildCharset(rules({ symbols: true, noLeadingSymbol: true }), 10);
    expect(cs.leading.length).toBe(62);
  });
});

describe('generateFromCharset', () => {
  it('honors every rule', () => {
    const r = rules({ symbols: true, requireEach: true, noLeadingSymbol: true, noLookalikes: true });
    for (let i = 0; i < 2000; i++) {
      const cs = buildCharset(r, 4);
      const s = generateFromCharset(cs, 4);
      expect(s).toHaveLength(4);
      expect(s).toMatch(/[a-z]/);
      expect(s).toMatch(/[A-Z]/);
      expect(s).toMatch(/[0-9]/);
      expect(s).toMatch(/[!@#$%^&*]/);
      expect(s[0]).toMatch(/[a-zA-Z0-9]/);
      expect(s).not.toMatch(/[Il1O0o]/);
    }
  });

  it('handles empty pool and long strings', () => {
    expect(generateFromCharset(buildCharset(rules({ lower: false, upper: false, digits: false }), 5), 5)).toBe('');
    expect(generateFromCharset(buildCharset(rules(), 1024), 1024)).toHaveLength(1024);
  });
});

describe('charsetEntropy', () => {
  it('matches brute force counting', () => {
    // Tiny alphabet so we can enumerate: {a,b} lower, {A} upper, {!} symbols
    const r = rules({ digits: false, symbols: true, symbolSet: '!', exclude: 'cdefghijklmnopqrstuvwxyzBCDEFGHIJKLMNOPQRSTUVWXYZ', requireEach: true, noLeadingSymbol: true });
    const length = 4;
    const cs = buildCharset(r, length);
    let count = 0;
    const walk = (prefix: string[]) => {
      if (prefix.length === length) {
        const ok = cs.leading.includes(prefix[0]) && cs.required.every((g) => g.some((c) => prefix.includes(c)));
        if (ok) count++;
        return;
      }
      for (const c of cs.pool) walk([...prefix, c]);
    };
    walk([]);
    expect(charsetEntropy(cs, length)).toBeCloseTo(Math.log2(count), 10);
  });

  it('is length * log2(pool) without rules', () => {
    expect(charsetEntropy(buildCharset(rules(), 20), 20)).toBeCloseTo(20 * Math.log2(62), 6);
  });

  it('copes with huge numbers', () => {
    const bits = charsetEntropy(buildCharset(rules({ symbols: true, requireEach: true }), 1024), 1024);
    expect(bits).toBeGreaterThan(6200);
    expect(bits).toBeLessThan(1024 * Math.log2(70) + 0.001);
  });

  it('log2Big', () => {
    expect(log2Big(1024n)).toBe(10);
    expect(log2Big(2n ** 300n)).toBeCloseTo(300, 9);
  });
});

describe('collections', () => {
  it('generates every kind', () => {
    expect(generate(makeCollection(), 12)).toHaveLength(12);
    expect(generate(makeCollection({ length: 5 }), 12)).toHaveLength(5);
    expect(generate(makeCollection({ kind: 'hex' }), 8)).toMatch(/^[0-9a-f]{8}$/);
    expect(generate(makeCollection({ kind: 'uuid' }), 8)).toMatch(/^[0-9a-f-]{36}$/);
    const n = Number(generate(makeCollection({ kind: 'number', min: 5, max: 6 }), 8));
    expect([5, 6]).toContain(n);
  });

  it('labels and validates', () => {
    expect(autoLabel(makeCollection({ symbols: true }))).toBe('a-zA-Z0-9!@#');
    expect(validate(makeCollection({ lower: false, upper: false, digits: false }))).toBeTruthy();
    expect(validate(makeCollection({ kind: 'number', min: 3, max: 1 }))).toBeTruthy();
    expect(entropyBits(makeCollection({ kind: 'number', min: 1, max: 1024 }), 0)).toBe(10);
  });
});
