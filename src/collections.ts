import {
  buildCharset,
  charsetEntropy,
  charsetGenerator,
  CharRules,
  DEFAULT_SYMBOLS,
  HEX_CHARS,
  randomInt,
} from './random';

export const MIN_LENGTH = 1;
export const MAX_LENGTH = 1024;
export const MAX_NUMBER = Number.MAX_SAFE_INTEGER;

export type CollectionKind = 'chars' | 'hex' | 'uuid' | 'number';

export const KIND_LABELS: Record<CollectionKind, string> = {
  chars: 'Characters',
  hex: 'Hex',
  uuid: 'UUID',
  number: 'Number',
};

export interface Collection extends CharRules {
  id: string;
  /** Empty names are generated from the rules */
  name: string;
  kind: CollectionKind;
  /** Null uses the global length */
  length: number | null;
  min: number;
  max: number;
  skipHistory: boolean;
}

export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: newId(),
    name: '',
    kind: 'chars',
    lower: true,
    upper: true,
    digits: true,
    symbols: false,
    symbolSet: DEFAULT_SYMBOLS,
    extra: '',
    exclude: '',
    noLookalikes: true,
    requireEach: true,
    noLeadingSymbol: false,
    length: null,
    min: 1,
    max: 100,
    skipHistory: false,
    ...overrides,
  };
}

/** Normalize stored data, or return null if it isn't an object */
export function normalizeCollection(data: unknown): Collection | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  const result = makeCollection() as unknown as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (typeof raw[key] === typeof result[key]) result[key] = raw[key];
  }
  result.length = typeof raw.length === 'number' ? clampLength(raw.length) : null;
  if (!Object.hasOwn(KIND_LABELS, result.kind as string)) result.kind = 'chars';
  return result as unknown as Collection;
}

export function defaultCollections(): Collection[] {
  return [
    makeCollection({ lower: false, digits: false }),
    makeCollection(),
    makeCollection({ symbols: true }),
  ];
}

/** Whether this kind uses a length setting */
export function usesLength(c: Collection): boolean {
  return c.kind === 'chars' || c.kind === 'hex';
}

export function effectiveLength(c: Collection, globalLength: number): number {
  return clampLength(c.length ?? globalLength);
}

export function clampLength(n: number): number {
  if (!Number.isFinite(n)) return MIN_LENGTH;
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(n)));
}

export function autoLabel(c: Collection): string {
  switch (c.kind) {
    case 'hex':
      return 'hex';
    case 'uuid':
      return 'UUID';
    case 'number':
      return `${c.min}–${c.max}`;
  }
  let label = '';
  if (c.lower) label += 'a-z';
  if (c.upper) label += 'A-Z';
  if (c.digits) label += '0-9';
  if (c.symbols) label += Array.from(c.symbolSet).slice(0, 3).join('');
  if (c.extra) label += '+' + Array.from(c.extra).slice(0, 3).join('');
  return label || '?';
}

export function label(c: Collection): string {
  return c.name.trim() || autoLabel(c);
}

/** Generator and metadata for a collection */
export interface Prepared {
  /** Error preventing value generation, if any */
  problem: string | null;
  bits: number;
  /** Number of distinct characters, for character-based kinds */
  poolSize: number | null;
  next: () => string;
}

const broken = (problem: string): Prepared => ({ problem, bits: 0, poolSize: null, next: () => '' });

export function prepare(c: Collection, globalLength: number): Prepared {
  const length = effectiveLength(c, globalLength);
  switch (c.kind) {
    case 'uuid':
      return { problem: null, bits: 122, poolSize: null, next: () => crypto.randomUUID() };
    case 'hex': {
      const hex = [...HEX_CHARS];
      return { problem: null, bits: length * 4, poolSize: 16, next: charsetGenerator({ pool: hex, leading: hex, required: [] }, length) };
    }
    case 'number': {
      const { min, max } = c;
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) return broken('Min and max must be whole numbers');
      if (min > max) return broken("Min can't be greater than max");
      if (max - min + 1 > MAX_NUMBER) return broken('Range is too large');
      return { problem: null, bits: Math.log2(max - min + 1), poolSize: null, next: () => String(randomInt(min, max)) };
    }
    case 'chars': {
      const charset = buildCharset(c, length);
      if (typeof charset === 'string') return broken(charset);
      return {
        problem: null,
        bits: charsetEntropy(charset, length),
        poolSize: charset.pool.length,
        next: charsetGenerator(charset, length),
      };
    }
  }
}

/** Key over the rules that affect generated values, so renames don't regenerate */
export function generationKey(c: Collection, globalLength: number): string {
  switch (c.kind) {
    case 'uuid':
      return 'uuid';
    case 'number':
      return `number:${c.min}:${c.max}`;
    case 'hex':
      return `hex:${effectiveLength(c, globalLength)}`;
    case 'chars': {
      const { lower, upper, digits, symbols, symbolSet, extra, exclude, noLookalikes, requireEach, noLeadingSymbol } = c;
      const rules = [lower, upper, digits, symbols, symbolSet, extra, exclude, noLookalikes, requireEach, noLeadingSymbol];
      return `chars:${effectiveLength(c, globalLength)}:${JSON.stringify(rules)}`;
    }
  }
}

/** Approximate value width in characters */
export function displayWidth(c: Collection, globalLength: number): number {
  switch (c.kind) {
    case 'uuid':
      return 36;
    case 'number':
      return Math.max(String(c.min).length, String(c.max).length);
    default:
      return effectiveLength(c, globalLength);
  }
}
