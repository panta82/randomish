import { describe, expect, it } from 'vitest';
import { autoLabel, Collection, generationKey, makeCollection, normalizeCollection, prepare, PRESETS } from './collections';
import {
  buildCharset,
  Charset,
  charsetEntropy,
  charsetGenerator,
  CharRules,
  DEFAULT_SYMBOLS,
  expandRanges,
  log2Big,
  randomBelow,
} from './random';

const rules = (overrides: Partial<CharRules> = {}): CharRules => ({
  lower: true,
  upper: true,
  digits: true,
  custom: false,
  customChars: DEFAULT_SYMBOLS,
  exclude: '',
  noLookalikes: false,
  requireEach: false,
  noLeadingSymbol: false,
  ...overrides,
});

describe('randomBelow', () => {
  it('stays in range', () => {
    for (const n of [1, 2, 3, 7, 1000, 2 ** 31 + 1, 2 ** 32]) {
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
    expect(() => randomBelow(2 ** 32 + 1)).toThrow();
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

});

const charset = (r: CharRules, length: number): Charset => {
  const cs = buildCharset(r, length);
  if (typeof cs === 'string') throw new Error(cs);
  return cs;
};

describe('buildCharset', () => {
  it('combines classes', () => {
    expect(charset(rules(), 10).pool.length).toBe(62);
    expect(charset(rules({ custom: true }), 10).pool.length).toBe(70);
  });

  it('drops look-alikes, excluded and duplicate chars', () => {
    const cs = charset(rules({ noLookalikes: true, exclude: 'abc', custom: true, customChars: 'xyz€ ' }), 10);
    for (const c of 'Il1O0oabc ') expect(cs.pool).not.toContain(c);
    expect(cs.pool).toContain('€');
    expect(new Set(cs.pool).size).toBe(cs.pool.length);
  });

  it('limits leading characters', () => {
    expect(charset(rules({ custom: true, noLeadingSymbol: true }), 10).leading.length).toBe(62);
  });

  it('expands custom ranges', () => {
    expect(expandRanges('a-f')).toEqual([...'abcdef']);
    expect(expandRanges('-0-3x-')).toEqual([...'-0123x-']);
    expect(expandRanges('z-a')).toEqual([...'z-a']);
    expect(expandRanges('\u0000-￿')).toHaveLength(3);
  });

  it('reports rules it cannot honor', () => {
    expect(buildCharset(rules({ lower: false, upper: false, digits: false }), 5)).toMatch(/No characters/);
    expect(buildCharset(rules({ exclude: '0123456789' }), 5)).toMatch(/No digits/);
    expect(buildCharset(rules({ requireEach: true }), 2)).toMatch(/at least 3/);
    const symbolsOnly = rules({ lower: false, upper: false, digits: false, custom: true, noLeadingSymbol: true });
    expect(buildCharset(symbolsOnly, 5)).toMatch(/nothing can go first/);
    // Each small class must show up among ~1000 custom characters, in only 4 chars
    const strict = rules({ custom: true, customChars: '一-俦', requireEach: true });
    expect(buildCharset(strict, 4)).toMatch(/too strict/);
  });
});

describe('charsetGenerator', () => {
  it('honors every rule', () => {
    const next = charsetGenerator(charset(rules({ custom: true, requireEach: true, noLeadingSymbol: true, noLookalikes: true }), 4), 4);
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
    const r = rules({ digits: false, custom: true, customChars: '!', exclude: 'cdefghijklmnopqrstuvwxyzBCDEFGHIJKLMNOPQRSTUVWXYZ', requireEach: true, noLeadingSymbol: true });
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
    const bits = charsetEntropy(charset(rules({ custom: true, requireEach: true }), 1024), 1024);
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

  it('generates with global or fixed length', () => {
    expect(next({})).toHaveLength(12);
    expect(next({ length: 5 })).toHaveLength(5);
  });

  it('presets produce what they say', () => {
    const preset = (label: string) => PRESETS.find((p) => p.label === label)!.rules;
    expect(next(preset('Hex'), 32)).toMatch(/^[0-9a-f]{32}$/);
    expect(next(preset('PIN'), 6)).toMatch(/^[0-9]{6}$/);
    expect(next(preset('Uppercase'))).toMatch(/^[A-Z]{12}$/);
  });

  it('labels and reports problems', () => {
    expect(autoLabel(makeCollection({ custom: true }))).toBe('a-zA-Z0-9!@#$%^&*');
    expect(autoLabel(makeCollection({ lower: false, upper: false, digits: false, custom: true, customChars: '0-9a-f' }))).toBe('0-9a-f');
    expect(prepare(makeCollection({ lower: false, upper: false, digits: false }), 10).problem).toBeTruthy();
  });

  it('only changes the generation key when output would change', () => {
    const c = makeCollection();
    const key = generationKey(c, 20);
    expect(generationKey({ ...c, name: 'x', skipHistory: true }, 20)).toBe(key);
    expect(generationKey({ ...c, exclude: 'a' }, 20)).not.toBe(key);
    expect(generationKey({ ...c, length: 20 }, 30)).toBe(key);
  });

  it('normalizes untrusted stored data', () => {
    expect(normalizeCollection(null)).toBeNull();
    const c = normalizeCollection({ name: null, kind: 'uuid', lower: 'yes', length: 5000, customChars: '!' })!;
    expect(c.name).toBe('');
    expect(c).not.toHaveProperty('kind');
    expect(c.lower).toBe(true);
    expect(c.length).toBe(1024);
    expect(c.customChars).toBe('!');
  });
});
