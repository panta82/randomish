import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack } from 'solid-js';
import { Collection, effectiveLength, generationKey, label, prepare } from '../collections';
import { addToHistory, copy, rollEpoch, state } from '../store';
import { Icon } from './Icon';

/** Must match --row-height in CSS */
export const ROW_HEIGHT = 22;
const LIST_PADDING = 16;

export function formatBits(bits: number): string {
  const n = Math.floor(bits);
  return `${n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n} ${n === 1 ? 'bit' : 'bits'}`;
}

export function bitsTitle(bits: number, poolSize: number): string {
  return `${bits.toFixed(1)} bits of entropy per value, from ${poolSize} characters`;
}

export function Column(props: { collection: Collection; onEdit: () => void }) {
  const collection = () => props.collection;
  const [rows, setRows] = createSignal(0);
  const [values, setValues] = createSignal<string[]>([]);

  // Rebuild the generator only when generation rules change
  const key = createMemo(() => generationKey(collection(), state.length));
  const prepared = createMemo(() => {
    key();
    return untrack(() => prepare(collection(), state.length));
  });

  const make = (count: number) => Array.from({ length: count }, prepared().next);
  const regenerate = () => setValues(prepared().problem ? [] : make(rows()));

  createEffect(on([prepared, rollEpoch], regenerate, { defer: true }));

  // Add rows as the window grows; keep values when it shrinks
  createEffect(
    on(rows, (count) => {
      const missing = count - untrack(values).length;
      if (missing > 0 && !untrack(prepared).problem) setValues((v) => [...v, ...make(missing)]);
    }),
  );

  let list!: HTMLDivElement;
  onMount(() => {
    const observer = new ResizeObserver(() => {
      setRows(Math.max(1, Math.floor((list.clientHeight - LIST_PADDING) / ROW_HEIGHT)));
    });
    observer.observe(list);
    onCleanup(() => observer.disconnect());
  });

  let copying = false;
  const use = async (index: number) => {
    if (copying) return;
    copying = true;
    const value = values()[index];
    try {
      if (!(await copy(value))) return;
      addToHistory(value, collection());
      // The values may have changed while copying
      setValues((v) => v.map((old, i) => (i === index && old === value ? prepared().next() : old)));
    } finally {
      copying = false;
    }
  };

  return (
    <section class="Column" style={{ '--w': effectiveLength(collection(), state.length) }}>
      <header class="Column-title">
        <button class="Column-name" title="Edit rules" onClick={props.onEdit}>
          {label(collection())}
        </button>
        <Show when={!prepared().problem}>
          <span class="Column-bits" title={bitsTitle(prepared().bits, prepared().poolSize)}>
            {formatBits(prepared().bits)}
          </span>
        </Show>
        <button class="IconButton" title="Edit rules" onClick={props.onEdit}>
          <Icon name="menu" />
        </button>
      </header>
      <div class="Column-list" ref={list}>
        <Show when={prepared().problem} fallback={
          <For each={values().slice(0, rows())}>
            {(value, i) => (
              <button class="Value" title={value} onClick={() => use(i())}>
                {value}
              </button>
            )}
          </For>
        }>
          <div class="Column-problem">
            ⚠ {prepared().problem}
            <button class="Button" onClick={props.onEdit}>
              Edit rules
            </button>
          </div>
        </Show>
      </div>
    </section>
  );
}
