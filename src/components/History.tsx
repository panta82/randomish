import { createSignal, For, Show } from 'solid-js';
import { Icon } from './Icon';
import { clearHistory, copy, state, toast, touchHistory } from '../store';

const [now, setNow] = createSignal(Date.now());
setInterval(() => setNow(Date.now()), 15_000);

const UNITS: [number, string][] = [
  [60, 's'],
  [60, 'm'],
  [24, 'h'],
  [7, 'd'],
  [4.35, 'w'],
  [12, 'mo'],
  [Infinity, 'y'],
];

export function ago(timestamp: number, at: number): string {
  let value = (at - timestamp) / 1000;
  if (value < 10) return 'just now';
  for (const [size, unit] of UNITS) {
    if (value < size) return `${Math.floor(value)}${unit} ago`;
    value /= size;
  }
  return '';
}

export function History() {
  const use = (index: number) => {
    copy(state.history[index].value);
    touchHistory(index);
  };

  const clear = () => {
    clearHistory();
    toast('History cleared');
  };

  return (
    <section class="Column History">
      <header class="Column-title">
        <span class="Column-name History-name">History</span>
        <button class="IconButton" title="Clear history" disabled={!state.history.length} onClick={clear}>
          <Icon name="trash" />
        </button>
      </header>
      <div class="Column-list History-list">
        <Show when={state.history.length} fallback={<div class="History-empty">Click any value to copy it. It will show up here.</div>}>
          <For each={state.history}>
            {(entry, i) => (
              <button class="History-entry" title={entry.value} onClick={() => use(i())}>
                <span class="History-value">{entry.value}</span>
                <span class="History-tag">{entry.tag}</span>
                <time class="History-time" dateTime={new Date(entry.timestamp).toISOString()}>
                  {ago(entry.timestamp, now())}
                </time>
              </button>
            )}
          </For>
        </Show>
      </div>
    </section>
  );
}
