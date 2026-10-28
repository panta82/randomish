// Cryptographically secure random primitives and character-set generation.
// Everything is built on crypto.getRandomValues; there is no seeded PRNG anywhere.

const BUFFER = new Uint32Array(256);
let bufferPos = BUFFER.length;

function nextUint32(): number {
  if (bufferPos >= BUFFER.length) {
    crypto.getRandomValues(BUFFER);
    bufferPos = 0;
  }
  return BUFFER[bufferPos++];
}

const TWO_32 = 2 ** 32;
const TWO_53 = 2 ** 53;

/**
 * Uniform integer in [0, n), for 1 <= n <= 2^53.
 * Uses rejection sampling, so there is no modulo bias.
 */
export function randomBelow(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > TWO_53) {
    throw new RangeError(`randomBelow: invalid range ${n}`);
  }
  if (n <= TWO_32) {
    const limit = TWO_32 - (TWO_32 % n);
    let x: number;
    do {
      x = nextUint32();
    } while (x >= limit);
    return x % n;
  }
  const limit = TWO_53 - (TWO_53 % n);
  let x: number;
  do {
    x = (nextUint32() & 0x1fffff) * TWO_32 + nextUint32();
  } while (x >= limit);
  return x % n;
}

/** Uniform integer in [min, max], both inclusive */
export function randomInt(min: number, max: number): number {
  return min + randomBelow(max - min + 1);
}

export function pick<T>(items: readonly T[]): T {
  return items[randomBelow(items.length)];
}

// ---------------------------------------------------------------------------
// Character sets

export const CLASS_CHARS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
} as const;

export const DEFAULT_SYMBOLS = '!@#$%^&*';
export const LOOKALIKES = 'Il1O0o';
export const HEX_CHARS = '0123456789abcdef';

export type CharClass = 'lower' | 'upper' | 'digits' | 'symbols';
export const CHAR_CLASSES: readonly CharClass[] = ['lower', 'upper', 'digits', 'symbols'];

export interface CharRules {
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  symbolSet: string;
  extra: string;
  exclude: string;
  noLookalikes: boolean;
  requireEach: boolean;
  noLeadingSymbol: boolean;
}

export interface Charset {
  /** Every character that can appear */
  pool: string[];
  /** Characters allowed in the first position */
  leading: string[];
  /** Disjoint groups, one per enabled class, that each must appear at least once */
  required: string[][];
}

const ALNUM = /^[\p{L}\p{N}]$/u;

function chars(s: string): string[] {
  return Array.from(s);
}

/**
 * Turn rules into a concrete charset for a given length. Rules that can't be honored
 * (eg. more required groups than characters) are relaxed instead of failing.
 */
export function buildCharset(rules: CharRules, length: number): Charset {
  const excluded = new Set(chars(rules.exclude + (rules.noLookalikes ? LOOKALIKES : '')));
  const seen = new Set<string>();
  const take = (source: string) => {
    const result: string[] = [];
    for (const c of chars(source)) {
      if (!excluded.has(c) && !seen.has(c) && c.trim() !== '') {
        seen.add(c);
        result.push(c);
      }
    }
    return result;
  };

  const groups: string[][] = [];
  for (const cls of CHAR_CLASSES) {
    if (!rules[cls]) continue;
    const group = take(cls === 'symbols' ? rules.symbolSet : CLASS_CHARS[cls]);
    if (group.length) groups.push(group);
  }
  const extra = take(rules.extra);
  const pool = [...groups.flat(), ...extra];

  let leading = pool;
  if (rules.noLeadingSymbol) {
    const alnum = pool.filter((c) => ALNUM.test(c));
    if (alnum.length) leading = alnum;
  }

  let required: string[][] = [];
  if (rules.requireEach && groups.length > 1 && groups.length <= length) {
    required = groups;
  }

  return { pool, leading, required };
}

const MAX_ATTEMPTS = 100_000;

/**
 * Uniformly random string over all strings of `length` that satisfy the charset.
 * First char is drawn from `leading`, then we reject until all required groups are present,
 * which keeps the distribution uniform over valid strings.
 */
export function generateFromCharset(charset: Charset, length: number): string {
  const { pool, leading, required } = charset;
  if (!pool.length || length < 1) return '';

  const requiredSets = required.map((g) => new Set(g));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const out = new Array<string>(length);
    out[0] = pick(leading);
    for (let i = 1; i < length; i++) out[i] = pick(pool);
    if (requiredSets.every((set) => out.some((c) => set.has(c)))) {
      return out.join('');
    }
  }
  throw new Error('Could not satisfy character rules');
}

/**
 * Exact entropy (log2 of the number of possible outputs) of generateFromCharset,
 * counted using inclusion-exclusion over required groups.
 */
export function charsetEntropy(charset: Charset, length: number): number {
  const { pool, leading, required } = charset;
  if (!pool.length || length < 1) return 0;

  const leadingSet = new Set(leading);
  const n = pool.length;
  const l = leading.length;
  const sizes = required.map((g) => g.length);
  const leadingSizes = required.map((g) => g.filter((c) => leadingSet.has(c)).length);

  let total = 0n;
  for (let mask = 0; mask < 1 << required.length; mask++) {
    let without = n;
    let leadingWithout = l;
    let sign = 1n;
    for (let i = 0; i < required.length; i++) {
      if (mask & (1 << i)) {
        without -= sizes[i];
        leadingWithout -= leadingSizes[i];
        sign = -sign;
      }
    }
    if (without <= 0 || leadingWithout <= 0) continue;
    total += sign * BigInt(leadingWithout) * BigInt(without) ** BigInt(length - 1);
  }
  return log2Big(total);
}

export function log2Big(n: bigint): number {
  if (n <= 0n) return 0;
  const bits = n.toString(2);
  if (bits.length <= 53) return Math.log2(Number(n));
  return Math.log2(parseInt(bits.slice(0, 53), 2)) + (bits.length - 53);
}
