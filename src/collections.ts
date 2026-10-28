import { buildCharset, charsetEntropy, charsetGenerator, CharRules, DEFAULT_SYMBOLS } from './random';

export const MIN_LENGTH = 1;
export const MAX_LENGTH = 1024;

export interface Collection extends CharRules {
  id: string;
  /** Empty names are generated from the rules */
  name: string;
  /** Null uses the global length */
  length: number | null;
  skipHistory: boolean;
}

const ALPHANUMERIC: CharRules = {
  lower: true,
  upper: true,
  digits: true,
  custom: false,
  customChars: DEFAULT_SYMBOLS,
  exclude: '',
  noLookalikes: true,
  requireEach: true,
  noLeadingSymbol: false,
};

const ONLY_CUSTOM = { lower: false, upper: false, digits: false, custom: true, noLookalikes: false, requireEach: false };

/** Presets only fill in rules, they are not stored */
export const PRESETS: { label: string; rules: CharRules }[] = [
  { label: 'Alphanumeric', rules: ALPHANUMERIC },
  { label: 'With symbols', rules: { ...ALPHANUMERIC, custom: true } },
  { label: 'Uppercase', rules: { ...ALPHANUMERIC, lower: false, digits: false } },
  { label: 'Hex', rules: { ...ALPHANUMERIC, ...ONLY_CUSTOM, customChars: '0-9a-f' } },
  { label: 'PIN', rules: { ...ALPHANUMERIC, ...ONLY_CUSTOM, customChars: '0-9' } },
];

export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return { id: newId(), name: '', length: null, skipHistory: false, ...ALPHANUMERIC, ...overrides };
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
  return result as unknown as Collection;
}

export function defaultCollections(): Collection[] {
  return ['Uppercase', 'Alphanumeric', 'With symbols'].map((name) =>
    makeCollection(PRESETS.find((p) => p.label === name)!.rules),
  );
}

export function effectiveLength(c: Collection, globalLength: number): number {
  return clampLength(c.length ?? globalLength);
}

export function clampLength(n: number): number {
  if (!Number.isFinite(n)) return MIN_LENGTH;
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(n)));
}

export function autoLabel(c: Collection): string {
  let label = '';
  if (c.lower) label += 'a-z';
  if (c.upper) label += 'A-Z';
  if (c.digits) label += '0-9';
  if (c.custom) label += Array.from(c.customChars.trim()).slice(0, 8).join('');
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
  poolSize: number;
  next: () => string;
}

export function prepare(c: Collection, globalLength: number): Prepared {
  const length = effectiveLength(c, globalLength);
  const charset = buildCharset(c, length);
  if (typeof charset === 'string') return { problem: charset, bits: 0, poolSize: 0, next: () => '' };
  return {
    problem: null,
    bits: charsetEntropy(charset, length),
    poolSize: charset.pool.length,
    next: charsetGenerator(charset, length),
  };
}

/** Key over the rules that affect generated values, so renames don't regenerate */
export function generationKey(c: Collection, globalLength: number): string {
  const { lower, upper, digits, custom, customChars, exclude, noLookalikes, requireEach, noLeadingSymbol } = c;
  const rules = [lower, upper, digits, custom, customChars, exclude, noLookalikes, requireEach, noLeadingSymbol];
  return `${effectiveLength(c, globalLength)}:${JSON.stringify(rules)}`;
}
