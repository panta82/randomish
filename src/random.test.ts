import { describe, expect, it } from 'vitest';
import { autoLabel, Collection, generationKey, makeCollection, normalizeCollection, prepare } from './collections';
import {
  buildCharset,
  Charset,
  charsetEntropy,
  charsetGenerator,
  CharRules,
  DEFAULT_SYMBOLS,
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

const charset = (r: CharRules, length: number): Charset => {
  const cs = buildCharset(r, length);
  if (typeof cs === 'string') throw new Error(cs);
  return cs;
};

describe('buildCharset', () => {
  it('combines classes', () => {
    expect(charset(rules(), 10).pool.length).toBe(62);
    expect(charset(rules({ symbols: true }), 10).pool.length).toBe(70);
  });

  it('drops look-alikes, excluded and duplicate chars', () => {
    const cs = charset(rules({ noLookalikes: true, exclude: 'abc', extra: 'xyz€ ' }), 10);
    for (const c of 'Il1O0oabc ') expect(cs.pool).not.toContain(c);
    expect(cs.pool).toContain('€');
    expect(new Set(cs.pool).size).toBe(cs.pool.length);
  });

  it('limits leading characters', () => {
    expect(charset(rules({ symbols: true, noLeadingSymbol: true }), 10).leading.length).toBe(62);
  });

  it('requires a lone class when extras could replace it', () => {
    expect(charset(rules({ lower: false, upper: false, extra: '!', requireEach: true }), 1).required).toHaveLength(1);
  });

  it('reports rules it cannot honor', () => {
    expect(buildCharset(rules({ lower: false, upper: false, digits: false }), 5)).toMatch(/No characters/);
    expect(buildCharset(rules({ exclude: '0123456789' }), 5)).toMatch(/No digits/);
    expect(buildCharset(rules({ requireEach: true }), 2)).toMatch(/at least 3/);
    const symbolsOnly = rules({ lower: false, upper: false, digits: false, symbols: true, noLeadingSymbol: true });
    expect(buildCharset(symbolsOnly, 5)).toMatch(/nothing can go first/);
    // One symbol among hundreds of extra characters, in a 4 char string
    const strict = rules({ symbols: true, symbolSet: '!', requireEach: true, extra: String.fromCharCode(...Array.from({ length: 2000 }, (_, i) => 0x4e00 + i)) });
    expect(buildCharset(strict, 4)).toMatch(/too strict/);
  });
});

describe('charsetGenerator', () => {
  it('honors every rule', () => {
    const next = charsetGenerator(charset(rules({ symbols: true, requireEach: true, noLeadingSymbol: true, noLookalikes: true }), 4), 4);
    for (let i = 0; i < 2000; i++) {
      const s = next();
      expect(s).toHaveLength(4);
      expect(s).toMatch(/[a-z]/);
      expect(s).toMatch(/[A-Z]/);
      expect(s).toMatch(/[0-9]/);
      expect(s).toMatch(/[!@#$%^&*]/);
      expect(s[0]).toMatch(/[a-zA-Z0-9]/);
      expect(s).not.toMatch(/[Il1O0o]/);
    }
  });

  it('handles long strings', () => {
    expect(charsetGenerator(charset(rules(), 1024), 1024)()).toHaveLength(1024);
  });
});

describe('charsetEntropy', () => {
  it('matches brute force counting', () => {
    // Tiny alphabet so we can enumerate: {a,b} lower, {A} upper, {!} symbols
    const r = rules({ digits: false, symbols: true, symbolSet: '!', exclude: 'cdefghijklmnopqrstuvwxyzBCDEFGHIJKLMNOPQRSTUVWXYZ', requireEach: true, noLeadingSymbol: true });
    const length = 4;
    const cs = charset(r, length);
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
    expect(charsetEntropy(charset(rules(), 20), 20)).toBeCloseTo(20 * Math.log2(62), 6);
  });

  it('copes with huge numbers', () => {
    const bits = charsetEntropy(charset(rules({ symbols: true, requireEach: true }), 1024), 1024);
    expect(bits).toBeGreaterThan(6200);
    expect(bits).toBeLessThan(1024 * Math.log2(70) + 0.001);
  });

  it('log2Big', () => {
    expect(log2Big(1024n)).toBe(10);
    expect(log2Big(2n ** 300n)).toBeCloseTo(300, 9);
  });
});

describe('collections', () => {
  const next = (overrides: Partial<Collection>, length = 12) => prepare(makeCollection(overrides), length).next();

  it('generates every kind', () => {
    expect(next({})).toHaveLength(12);
    expect(next({ length: 5 })).toHaveLength(5);
    expect(next({ kind: 'hex' }, 8)).toMatch(/^[0-9a-f]{8}$/);
    expect(next({ kind: 'uuid' })).toMatch(/^[0-9a-f-]{36}$/);
    expect(['5', '6']).toContain(next({ kind: 'number', min: 5, max: 6 }));
  });

  it('labels and reports problems', () => {
    expect(autoLabel(makeCollection({ symbols: true }))).toBe('a-zA-Z0-9!@#');
    expect(prepare(makeCollection({ lower: false, upper: false, digits: false }), 10).problem).toBeTruthy();
    expect(prepare(makeCollection({ kind: 'number', min: 3, max: 1 }), 10).problem).toBeTruthy();
    expect(prepare(makeCollection({ kind: 'number', min: 1, max: 1024 }), 10).bits).toBe(10);
  });

  it('only changes the generation key when output would change', () => {
    const c = makeCollection();
    const key = generationKey(c, 20);
    expect(generationKey({ ...c, name: 'x', skipHistory: true }, 20)).toBe(key);
    expect(generationKey({ ...c, exclude: 'a' }, 20)).not.toBe(key);
    expect(generationKey({ ...c, kind: 'uuid' }, 20)).toBe(generationKey({ ...c, kind: 'uuid' }, 30));
  });

  it('normalizes untrusted stored data', () => {
    expect(normalizeCollection(null)).toBeNull();
    const c = normalizeCollection({ name: null, kind: 'evil', lower: 'yes', length: 5000, symbolSet: '!' })!;
    expect(c.name).toBe('');
    expect(c.kind).toBe('chars');
    expect(c.lower).toBe(true);
    expect(c.length).toBe(1024);
    expect(c.symbolSet).toBe('!');
  });
});
