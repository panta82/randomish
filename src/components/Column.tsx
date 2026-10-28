import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack } from 'solid-js';
import { Collection, displayWidth, entropyBits, generate, label, validate } from '../collections';
import { Icon } from './Icon';
import { addToHistory, copy, rollEpoch, state } from '../store';

/** Must match --row-height in CSS */
export const ROW_HEIGHT = 22;
const LIST_PADDING = 16;

export function formatBits(bits: number): string {
  return bits >= 10_000 ? `${(bits / 1000).toFixed(1)}k` : String(Math.floor(bits));
}

export function Column(props: { collection: Collection; onEdit: () => void }) {
  const collection = () => props.collection;
  const [rows, setRows] = createSignal(0);
  const [values, setValues] = createSignal<string[]>([]);
  const [error, setError] = createSignal<string | null>(null);

  const problem = createMemo(() => validate(collection()) ?? error());
  const bits = createMemo(() => (validate(collection()) ? 0 : entropyBits(collection(), state.length)));

  const make = (count: number): string[] => {
    try {
      return Array.from({ length: count }, () => generate(collection(), state.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return [];
    }
  };

  const regenerate = () => {
    setError(null);
    setValues(validate(collection()) ? [] : make(rows()));
  };

  // Any rule change, length change or dice roll gives a fresh set
  createEffect(on([() => JSON.stringify(collection()), () => state.length, rollEpoch], regenerate, { defer: true }));

  // Growing the window adds rows, shrinking keeps the existing values around
  createEffect(
    on(rows, (count) => {
      const missing = count - untrack(values).length;
      if (missing > 0 && !untrack(problem)) setValues((v) => [...v, ...make(missing)]);
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

  const use = (index: number) => {
    const value = values()[index];
    copy(value);
    addToHistory(value, collection());
    const [replacement] = make(1);
    setValues((v) => v.map((old, i) => (i === index ? replacement : old)));
  };

  return (
    <section class="Column" style={{ '--w': displayWidth(collection(), state.length) }}>
      <header class="Column-title">
        <button class="Column-name" title="Edit rules" onClick={props.onEdit}>
          {label(collection())}
        </button>
        <Show when={bits()}>
          <span class="Column-bits" title={`${bits().toFixed(1)} bits of entropy per value`}>
            {formatBits(bits())} bit
          </span>
        </Show>
        <button class="IconButton" title="Generate new values" onClick={regenerate}>
          <Icon name="refresh" />
        </button>
      </header>
      <div class="Column-list" ref={list}>
        <Show when={problem()} fallback={
          <For each={values().slice(0, rows())}>
            {(value, i) => (
              <button class="Value" title={value.length > 40 ? value : undefined} onClick={() => use(i())}>
                {value}
              </button>
            )}
          </For>
        }>
          <div class="Column-problem">
            ⚠ {problem()}
            <button class="Button" onClick={props.onEdit}>
              Edit rules
            </button>
          </div>
        </Show>
      </div>
    </section>
  );
}
