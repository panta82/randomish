import { createEffect, createMemo, createSignal, For, JSX, on, onMount, Show } from 'solid-js';
import { createStore, unwrap } from 'solid-js/store';
import {
  autoLabel,
  Collection,
  CollectionKind,
  effectiveLength,
  entropyBits,
  generate,
  KIND_LABELS,
  MAX_LENGTH,
  MIN_LENGTH,
  usesLength,
  validate,
} from '../collections';
import { CharClass, LOOKALIKES } from '../random';
import { deleteCollection, moveCollection, saveCollection, state, toast } from '../store';
import { formatBits } from './Column';
import { Icon } from './Icon';

const CLASS_BUTTONS: [CharClass, string][] = [
  ['lower', 'a-z'],
  ['upper', 'A-Z'],
  ['digits', '0-9'],
  ['symbols', '!@#'],
];

type BoolKey = 'noLookalikes' | 'requireEach' | 'noLeadingSymbol' | 'skipHistory';

export function EditModal(props: { collection: Collection; isNew: boolean; onClose: () => void }) {
  const [draft, setDraft] = createStore<Collection>(structuredClone(unwrap(props.collection)));
  const [sample, setSample] = createSignal('');
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  const problem = createMemo(() => validate(draft));
  const index = () => state.collections.findIndex((c) => c.id === draft.id);

  const resample = () => {
    if (problem()) return setSample('');
    try {
      setSample(generate(draft, state.length));
    } catch (err) {
      setSample(`⚠ ${err instanceof Error ? err.message : err}`);
    }
  };
  createEffect(on(() => JSON.stringify(draft) + state.length, resample));

  let dialog!: HTMLDialogElement;
  onMount(() => dialog.showModal());
  const close = () => dialog.close();

  const save = (e: SubmitEvent) => {
    e.preventDefault();
    if (problem()) return;
    saveCollection(structuredClone(unwrap(draft)));
    toast(props.isNew ? 'Collection added' : 'Collection saved');
    close();
  };

  const remove = () => {
    if (!confirmDelete()) return setConfirmDelete(true);
    deleteCollection(draft.id);
    toast('Collection deleted');
    close();
  };

  const move = (delta: number) => moveCollection(draft.id, delta);

  const check = (key: BoolKey, text: JSX.Element) => (
    <label class="Check">
      <input type="checkbox" checked={draft[key]} onChange={(e) => setDraft(key, e.currentTarget.checked)} />
      {text}
    </label>
  );

  const numberInput = (key: 'min' | 'max') => (
    <input
      class="Input Input-short"
      type="number"
      value={draft[key]}
      onInput={(e) => setDraft(key, e.currentTarget.value === '' ? NaN : Number(e.currentTarget.value))}
    />
  );

  return (
    <dialog
      ref={dialog}
      class="Modal"
      onClose={props.onClose}
      onClick={(e) => e.target === dialog && close()}
    >
      <form class="Modal-body" onSubmit={save}>
        <header class="Column-title">
          <span class="Column-name History-name">{props.isNew ? 'New collection' : 'Edit collection'}</span>
          <button type="button" class="IconButton" title="Close" onClick={close}>
            <Icon name="close" />
          </button>
        </header>

        <div class="Form">
          <label class="Form-key" for="name">Name</label>
          <input id="name" class="Input" placeholder={autoLabel(draft)} value={draft.name} onInput={(e) => setDraft('name', e.currentTarget.value)} />

          <span class="Form-key">Type</span>
          <div class="Form-row">
            <For each={Object.entries(KIND_LABELS) as [CollectionKind, string][]}>
              {([kind, text]) => (
                <button type="button" class="Button" classList={{ 'Button-on': draft.kind === kind }} onClick={() => setDraft('kind', kind)}>
                  {text}
                </button>
              )}
            </For>
          </div>

          <Show when={draft.kind === 'chars'}>
            <span class="Form-key">Classes</span>
            <div class="Form-row">
              <For each={CLASS_BUTTONS}>
                {([cls, text]) => (
                  <button type="button" class="Button" classList={{ 'Button-on': draft[cls] }} onClick={() => setDraft(cls, !draft[cls])}>
                    {text}
                  </button>
                )}
              </For>
            </div>

            <label class="Form-key" for="symbols">Symbols</label>
            <input id="symbols" class="Input" disabled={!draft.symbols} value={draft.symbolSet} onInput={(e) => setDraft('symbolSet', e.currentTarget.value)} />

            <label class="Form-key" for="extra">Also include</label>
            <input id="extra" class="Input" placeholder="extra characters…" value={draft.extra} onInput={(e) => setDraft('extra', e.currentTarget.value)} />

            <label class="Form-key" for="exclude">Exclude</label>
            <input id="exclude" class="Input" placeholder="characters to never use…" value={draft.exclude} onInput={(e) => setDraft('exclude', e.currentTarget.value)} />

            <span class="Form-key">Rules</span>
            <div class="Form-checks">
              {check('noLookalikes', <>Skip look-alikes <code>{LOOKALIKES.split('').join(' ')}</code></>)}
              {check('requireEach', 'At least one from each class')}
              {check('noLeadingSymbol', "Don't start with a symbol")}
            </div>
          </Show>

          <Show when={usesLength(draft)}>
            <span class="Form-key">Length</span>
            <div class="Form-row">
              <button type="button" class="Button" classList={{ 'Button-on': draft.length === null }} onClick={() => setDraft('length', null)}>
                Global ({state.length})
              </button>
              <button type="button" class="Button" classList={{ 'Button-on': draft.length !== null }} onClick={() => setDraft('length', effectiveLength(draft, state.length))}>
                Fixed
              </button>
              <input
                class="Input Input-short"
                type="number"
                min={MIN_LENGTH}
                max={MAX_LENGTH}
                disabled={draft.length === null}
                value={effectiveLength(draft, state.length)}
                onInput={(e) => e.currentTarget.value !== '' && setDraft('length', effectiveLength({ ...draft, length: Number(e.currentTarget.value) }, 0))}
              />
            </div>
          </Show>

          <Show when={draft.kind === 'number'}>
            <span class="Form-key">Range</span>
            <div class="Form-row">
              {numberInput('min')} <span class="Faded">to</span> {numberInput('max')}
            </div>
          </Show>

          <span class="Form-key">History</span>
          <div class="Form-checks">{check('skipHistory', "Don't save copied values to history")}</div>

          <span class="Form-key">Preview</span>
          <div class="Preview">
            <span class="Preview-value">{problem() ? `⚠ ${problem()}` : sample()}</span>
            <Show when={!problem()}>
              <span class="Preview-bits">{formatBits(entropyBits(draft, state.length))} bits</span>
              <button type="button" class="IconButton IconButton-light" title="Another sample" onClick={resample}>
                <Icon name="refresh" />
              </button>
            </Show>
          </div>
        </div>

        <footer class="Modal-footer">
          <Show when={!props.isNew}>
            <button
              type="button"
              class="Button Button-danger"
              disabled={state.collections.length <= 1}
              title={state.collections.length <= 1 ? 'You need at least one collection' : 'Delete this collection'}
              onClick={remove}
            >
              <Icon name="trash" size={14} /> {confirmDelete() ? 'Really delete?' : 'Delete'}
            </button>
            <button type="button" class="Button" title="Move left" disabled={index() <= 0} onClick={() => move(-1)}>
              <Icon name="left" size={14} />
            </button>
            <button type="button" class="Button" title="Move right" disabled={index() >= state.collections.length - 1} onClick={() => move(1)}>
              <Icon name="right" size={14} />
            </button>
          </Show>
          <span class="Spacer" />
          <button type="button" class="Button" onClick={close}>
            Cancel
          </button>
          <button type="submit" class="Button Button-on" disabled={!!problem()}>
            {props.isNew ? 'Add' : 'Save'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
