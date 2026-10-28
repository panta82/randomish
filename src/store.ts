import { createEffect, createRoot, createSignal } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';
import { clampLength, Collection, defaultCollections, makeCollection, shortLabel } from './collections';

const STORAGE_KEY = 'randomish:v2';
export const HISTORY_LIMIT = 100;

export interface HistoryEntry {
  value: string;
  timestamp: number;
  collectionId: string;
  tag: string;
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

function parse(raw: string | null): AppState {
  const fallback = defaultState();
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 2) return fallback;
    const collections = Array.isArray(data.collections)
      ? data.collections.map((c: Partial<Collection>) => makeCollection(c))
      : [];
    return {
      version: 2,
      length: clampLength(Number(data.length)),
      collections: collections.length ? collections : fallback.collections,
      history: Array.isArray(data.history) ? data.history.slice(0, HISTORY_LIMIT) : [],
    };
  } catch {
    return fallback;
  }
}

export const [state, setState] = createStore<AppState>(parse(localStorage.getItem(STORAGE_KEY)));

createRoot(() => {
  createEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  });
});

// Keep multiple open tabs in sync
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) setState(reconcile(parse(e.newValue)));
});

// ---------------------------------------------------------------------------
// Actions

export function setLength(length: number) {
  setState('length', clampLength(length));
}

export function saveCollection(collection: Collection) {
  const index = state.collections.findIndex((c) => c.id === collection.id);
  if (index >= 0) {
    setState('collections', index, reconcile(collection));
  } else {
    setState('collections', state.collections.length, collection);
  }
}

export function deleteCollection(id: string) {
  if (state.collections.length <= 1) return;
  setState('collections', (list) => list.filter((c) => c.id !== id));
}

export function moveCollection(id: string, delta: number) {
  setState(
    'collections',
    produce((list) => {
      const from = list.findIndex((c) => c.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= list.length) return;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
    }),
  );
}

export function addToHistory(value: string, collection: Collection) {
  if (collection.skipHistory) return;
  const entry: HistoryEntry = {
    value,
    timestamp: Date.now(),
    collectionId: collection.id,
    tag: shortLabel(collection),
  };
  setState('history', (history) => [entry, ...history.filter((h) => h.value !== value)].slice(0, HISTORY_LIMIT));
}

/** Move an existing entry back to the top, as it was just used again */
export function touchHistory(index: number) {
  setState('history', (history) => {
    const entry = { ...history[index], timestamp: Date.now() };
    return [entry, ...history.slice(0, index), ...history.slice(index + 1)];
  });
}

export function clearHistory() {
  setState('history', []);
}

// ---------------------------------------------------------------------------
// Ephemeral UI state

/** Bumped by the dice, makes every column regenerate */
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

export async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast('Copied to clipboard');
  } catch (err) {
    console.error('Failed to copy', err);
    toast('Could not copy to clipboard');
  }
}
