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

const CLASS_NAMES: Record<CharClass, string> = {
  lower: 'lowercase letters',
  upper: 'uppercase letters',
  digits: 'digits',
  symbols: 'symbols',
};

const ALNUM = /^[\p{L}\p{N}]$/u;

/** Below this share of accepted attempts, rules count as too strict to generate from */
const MIN_ACCEPTANCE_LOG2 = -10;

/**
 * Turn rules into a concrete charset for a given length.
 * Returns a problem instead, if the rules can't be honored.
 */
export function buildCharset(rules: CharRules, length: number): Charset | string {
  const excluded = new Set(Array.from(rules.exclude + (rules.noLookalikes ? LOOKALIKES : '')));
  const seen = new Set<string>();
  const take = (source: string) => {
    const result: string[] = [];
    for (const c of source) {
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
    if (!group.length) return `No ${CLASS_NAMES[cls]} left after exclusions`;
    groups.push(group);
  }
  const pool = [...groups.flat(), ...take(rules.extra)];
  if (!pool.length) return 'No characters to pick from';

  const leading = rules.noLeadingSymbol ? pool.filter((c) => ALNUM.test(c)) : pool;
  if (!leading.length) return 'Only symbols left, so nothing can go first';

  const required = rules.requireEach ? groups : [];
  if (required.length > length) return `Length must be at least ${required.length} to fit one of each class`;

  const charset = { pool, leading, required };
  if (required.length) {
    const unconstrained = Math.log2(leading.length) + (length - 1) * Math.log2(pool.length);
    if (charsetEntropy(charset, length) - unconstrained < MIN_ACCEPTANCE_LOG2) {
      return 'Rules are too strict for this length';
    }
  }
  return charset;
}

/**
 * Returns a function producing uniformly random strings over all strings of `length`
 * that satisfy the charset. First char is drawn from `leading`, then we reject until
 * all required groups are present, which keeps the distribution uniform over valid strings.
 */
export function charsetGenerator(charset: Charset, length: number): () => string {
  const { pool, leading } = charset;
  const required = charset.required.map((g) => new Set(g));
  const out = new Array<string>(length);
  return () => {
    // buildCharset guarantees a reasonable acceptance rate, so this terminates quickly
    for (;;) {
      out[0] = pick(leading);
      for (let i = 1; i < length; i++) out[i] = pick(pool);
      if (required.every((set) => out.some((c) => set.has(c)))) return out.join('');
    }
  };
}

/**
 * Exact entropy (log2 of the number of possible outputs) of charsetGenerator,
 * counted using inclusion-exclusion over required groups.
 */
export function charsetEntropy(charset: Charset, length: number): number {
  const { pool, leading, required } = charset;
  if (length < 1) return 0;

  const leadingSet = new Set(leading);
  const sizes = required.map((g) => g.length);
  const leadingSizes = required.map((g) => g.filter((c) => leadingSet.has(c)).length);

  let total = 0n;
  for (let mask = 0; mask < 1 << required.length; mask++) {
    let without = pool.length;
    let leadingWithout = leading.length;
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
