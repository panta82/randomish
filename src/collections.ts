import {
  buildCharset,
  charsetEntropy,
  CharRules,
  DEFAULT_SYMBOLS,
  generateFromCharset,
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
  /** Custom title. Empty means auto-generated from rules */
  name: string;
  kind: CollectionKind;
  /** Fixed length. null means follow the global length */
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

export function defaultCollections(): Collection[] {
  return [
    makeCollection({ lower: false, digits: false }),
    makeCollection(),
    makeCollection({ symbols: true }),
  ];
}

/** Whether the global/fixed length setting applies to this kind */
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

/** Short version of the label, for history tags */
export function shortLabel(c: Collection): string {
  const l = label(c);
  return l.length > 10 ? l.slice(0, 9) + '…' : l;
}

/** Returns a problem description if the collection can't produce values */
export function validate(c: Collection): string | null {
  switch (c.kind) {
    case 'chars':
      return buildCharset(c, 1).pool.length ? null : 'No characters to pick from';
    case 'number':
      if (!Number.isSafeInteger(c.min) || !Number.isSafeInteger(c.max)) return 'Min and max must be whole numbers';
      if (c.min > c.max) return 'Min must not be greater than max';
      if (c.max - c.min + 1 > MAX_NUMBER) return 'Range is too large';
      return null;
    default:
      return null;
  }
}

export function generate(c: Collection, globalLength: number): string {
  const length = effectiveLength(c, globalLength);
  switch (c.kind) {
    case 'uuid':
      return crypto.randomUUID();
    case 'hex':
      return generateFromCharset({ pool: [...HEX_CHARS], leading: [...HEX_CHARS], required: [] }, length);
    case 'number':
      return validate(c) ? '' : String(randomInt(c.min, c.max));
    case 'chars':
      return generateFromCharset(buildCharset(c, length), length);
  }
}

export function entropyBits(c: Collection, globalLength: number): number {
  const length = effectiveLength(c, globalLength);
  switch (c.kind) {
    case 'uuid':
      return 122;
    case 'hex':
      return length * 4;
    case 'number':
      return validate(c) ? 0 : Math.log2(c.max - c.min + 1);
    case 'chars':
      return charsetEntropy(buildCharset(c, length), length);
  }
}

/** Approximate rendered width of a value, in characters */
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
