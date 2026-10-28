import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { Collection, label, makeCollection } from './collections';
import { Column, ROW_HEIGHT } from './components/Column';
import { EditModal } from './components/EditModal';
import { Icon } from './components/Icon';
import { Header, Toasts } from './components/Header';
import { History } from './components/History';
import { state } from './store';

interface Editing {
  collection: Collection;
  isNew: boolean;
}

export function App() {
  const [editing, setEditing] = createSignal<Editing | null>(null);
  const [activeTab, setActiveTab] = createSignal(0);

  let board!: HTMLElement;
  const columns = () => Array.from(board.querySelectorAll<HTMLElement>('.Column'));

  // On mobile, the board is a horizontal scroll-snap carousel; tabs follow the visible column
  const syncTab = () => {
    const left = board.scrollLeft + board.clientWidth / 2;
    const index = columns().findIndex((el) => el.offsetLeft - board.offsetLeft + el.offsetWidth > left);
    if (index >= 0) setActiveTab(index);
  };
  const showColumn = (index: number) => {
    columns()[index]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };
  onMount(() => {
    board.addEventListener('scroll', syncTab, { passive: true });
    onCleanup(() => board.removeEventListener('scroll', syncTab));
  });

  const addNew = () => setEditing({ collection: makeCollection(), isNew: true });

  return (
    <div class="App" style={{ '--row-height': `${ROW_HEIGHT}px` }}>
      <Toasts />
      <Header />

      <nav class="Tabs">
        <For each={state.collections}>
          {(c, i) => (
            <button class="Tab" classList={{ 'Tab-on': activeTab() === i() }} onClick={() => showColumn(i())}>
              {label(c)}
            </button>
          )}
        </For>
        <button class="Tab" title="Add new collection" onClick={addNew}>
          +
        </button>
        <button
          class="Tab"
          classList={{ 'Tab-on': activeTab() === state.collections.length }}
          onClick={() => showColumn(state.collections.length)}
        >
          History
        </button>
      </nav>

      <main class="Board" ref={board}>
        <div class="Board-strip">
          <For each={state.collections}>
            {(c) => <Column collection={c} onEdit={() => setEditing({ collection: c, isNew: false })} />}
          </For>
          <button class="AddRail" title="Add new collection" onClick={addNew}>
            <Icon name="plus" size={26} />
            <span class="AddRail-text">Add new</span>
          </button>
        </div>
        <History />
      </main>

      <a class="About" href="https://github.com/panta82/randomish" target="_blank" rel="noopener">
        about
      </a>

      <Show when={editing()} keyed>
        {(e) => <EditModal collection={e.collection} isNew={e.isNew} onClose={() => setEditing(null)} />}
      </Show>
    </div>
  );
}
