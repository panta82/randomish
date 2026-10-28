import { createEffect, createRoot, createSignal } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';
import { clampLength, Collection, defaultCollections, normalizeCollection } from './collections';

const STORAGE_KEY = 'randomish:v2';
export const HISTORY_LIMIT = 100;

export interface HistoryEntry {
  value: string;
  timestamp: number;
}

export interface AppState {
  version: 2;
  length: number;
  collections: Collection[];
  history: HistoryEntry[];
}

function defaultState(): AppState {
  return { version: 2, length: 20, collections: defaultCollections(), history: [] };
}

function isHistoryEntry(entry: unknown): entry is HistoryEntry {
  const e = entry as HistoryEntry;
  return typeof e?.value === 'string' && Number.isFinite(e.timestamp);
}

/** Validate stored state before using it */
function parse(raw: string | null): AppState {
  const fallback = defaultState();
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 2) return fallback;
    const collections = Array.isArray(data.collections)
      ? data.collections.map(normalizeCollection).filter((c: Collection | null) => c !== null)
      : [];
    return {
      version: 2,
      length: clampLength(Number(data.length)),
      collections: collections.length ? collections : fallback.collections,
      history: Array.isArray(data.history) ? data.history.filter(isHistoryEntry).slice(0, HISTORY_LIMIT) : [],
    };
  } catch {
    return fallback;
  }
}

function load(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export const [state, setState] = createStore<AppState>(parse(load()));

// ---------------------------------------------------------------------------
// Actions

export function setLength(length: number) {
  setState('length', clampLength(length));
}

/** Save a collection, optionally at a new position */
export function saveCollection(collection: Collection, position?: number) {
  setState(
    'collections',
    produce((list) => {
      const index = list.findIndex((c) => c.id === collection.id);
      if (index >= 0) list.splice(index, 1);
      list.splice(position ?? (index >= 0 ? index : list.length), 0, collection);
    }),
  );
}

export function deleteCollection(id: string) {
  if (state.collections.length <= 1) return;
  setState('collections', (list) => list.filter((c) => c.id !== id));
}

export function addToHistory(value: string, collection: Collection) {
  if (collection.skipHistory) return;
  const entry: HistoryEntry = { value, timestamp: Date.now() };
  setState('history', (history) => [entry, ...history.filter((h) => h.value !== value)].slice(0, HISTORY_LIMIT));
}

/** Move a reused entry to the top */
export function touchHistory(value: string) {
  setState('history', (history) => {
    const entry = history.find((h) => h.value === value);
    if (!entry) return history;
    return [{ ...entry, timestamp: Date.now() }, ...history.filter((h) => h !== entry)];
  });
}

export function clearHistory() {
  setState('history', []);
}

// ---------------------------------------------------------------------------
// Ephemeral UI state

/** Changing this value regenerates every column */
export const [rollEpoch, setRollEpoch] = createSignal(0);

export interface Toast {
  id: number;
  message: string;
  leaving: boolean;
}

const [toasts, setToasts] = createStore<Toast[]>([]);
export { toasts };
let lastToastId = 0;

export function toast(message: string) {
  const id = ++lastToastId;
  setToasts(toasts.length, { id, message, leaving: false });
  setTimeout(() => setToasts((t) => t.id === id, 'leaving', true), 1800);
  setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 2400);
}

/** Copy a value and report success */
export async function copy(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    toast('Copied to clipboard');
    return true;
  } catch (err) {
    console.error('Failed to copy', err);
    toast('Could not copy to clipboard');
    return false;
  }
}

// ---------------------------------------------------------------------------
// Persistence

createRoot(() => {
  let warned = false;
  createEffect(() => {
    const json = JSON.stringify(state);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch (err) {
      console.error('Failed to save', err);
      if (!warned) toast("Can't save to browser storage. Changes will be lost on reload.");
      warned = true;
    }
  });
});

// Sync state across open tabs
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) setState(reconcile(parse(e.newValue)));
});
