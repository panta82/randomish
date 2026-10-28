import { createEffect, createMemo, createSignal, For, JSX, on, onMount, Show } from 'solid-js';
import { createStore, unwrap } from 'solid-js/store';
import {
  autoLabel,
  Collection,
  effectiveLength,
  generationKey,
  MAX_LENGTH,
  MIN_LENGTH,
  prepare,
  PRESETS,
} from '../collections';
import { CharClass, LOOKALIKES } from '../random';
import { deleteCollection, moveCollection, saveCollection, state, toast } from '../store';
import { bitsTitle, formatBits } from './Column';
import { Icon } from './Icon';

const CLASS_BUTTONS: [CharClass, string][] = [
  ['lower', 'a-z'],
  ['upper', 'A-Z'],
  ['digits', '0-9'],
  ['custom', 'Custom'],
];

type BoolKey = 'noLookalikes' | 'requireEach' | 'noLeadingSymbol' | 'skipHistory';

export function EditModal(props: { collection: Collection; isNew: boolean; onClose: () => void }) {
  const [draft, setDraft] = createStore<Collection>(structuredClone(unwrap(props.collection)));
  const [sample, setSample] = createSignal('');
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  const prepared = createMemo(on(() => generationKey(draft, state.length), () => prepare(draft, state.length)));
  const problem = () => prepared().problem;
  const resample = () => setSample(prepared().next());
  createEffect(on(prepared, resample));

  // Position is part of the draft; new collections start at the end
  const existing = state.collections.findIndex((c) => c.id === draft.id);
  const slots = existing >= 0 ? state.collections.length : state.collections.length + 1;
  const [position, setPosition] = createSignal(existing >= 0 ? existing : slots - 1);

  let dialog!: HTMLDialogElement;
  onMount(() => dialog.showModal());
  const close = () => dialog.close();

  const save = (e: SubmitEvent) => {
    e.preventDefault();
    if (problem()) return;
    saveCollection(structuredClone(unwrap(draft)));
    moveCollection(draft.id, position());
    toast(props.isNew ? 'Collection added' : 'Collection saved');
    close();
  };

  const remove = () => {
    if (!confirmDelete()) return setConfirmDelete(true);
    deleteCollection(draft.id);
    toast('Collection deleted');
    close();
  };

  const check = (key: BoolKey, text: JSX.Element) => (
    <label class="Check">
      <input type="checkbox" checked={draft[key]} onChange={(e) => setDraft(key, e.currentTarget.checked)} />
      {text}
    </label>
  );

  return (
    <dialog ref={dialog} class="Modal" onClose={props.onClose} onClick={(e) => e.target === dialog && close()}>
      <form class="Modal-body" onSubmit={save}>
        <header class="Column-title">
          <span class="Column-name History-name">{props.isNew ? 'New collection' : 'Edit collection'}</span>
          <button type="button" class="IconButton" title="Close" onClick={close}>
            <Icon name="close" />
          </button>
        </header>

        <div class="Form Modal-band Modal-presets">
          <span class="Form-key">Presets</span>
          <div class="Form-row">
            <For each={PRESETS}>
              {(preset) => (
                <button type="button" class="Button" onClick={() => setDraft(preset.rules)}>
                  {preset.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="Form">
          <label class="Form-key" for="name">Name</label>
          <input id="name" class="Input" placeholder={autoLabel(draft)} value={draft.name} onInput={(e) => setDraft('name', e.currentTarget.value)} />

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

          <label class="Form-key" for="custom">Custom</label>
          <input
            id="custom"
            class="Input"
            disabled={!draft.custom}
            placeholder="characters or ranges, eg. a-f!@#"
            value={draft.customChars}
            onInput={(e) => setDraft('customChars', e.currentTarget.value)}
          />

          <label class="Form-key" for="exclude">Exclude</label>
          <input id="exclude" class="Input" placeholder="characters to never use" value={draft.exclude} onInput={(e) => setDraft('exclude', e.currentTarget.value)} />

          <span class="Form-key">Rules</span>
          <div class="Form-checks">
            {check('noLookalikes', <>Skip look-alikes <code>{LOOKALIKES.split('').join(' ')}</code></>)}
            {check('requireEach', 'At least one from each class')}
            {check('noLeadingSymbol', "Don't start with a symbol")}
          </div>

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
        </div>

        <div class="Form Modal-band">
          <span class="Form-key">Position</span>
          <div class="Form-row">
            <button type="button" class="Button" title="Move left" disabled={position() <= 0} onClick={() => setPosition((p) => p - 1)}>
              <Icon name="left" size={14} />
            </button>
            <div class="Slots">
              <For each={Array.from({ length: slots }, (_, i) => i)}>
                {(i) => (
                  <button
                    type="button"
                    class="Slot"
                    classList={{ 'Slot-current': i === position() }}
                    title={`Position ${i + 1} of ${slots}`}
                    onClick={() => setPosition(i)}
                  />
                )}
              </For>
            </div>
            <button type="button" class="Button" title="Move right" disabled={position() >= slots - 1} onClick={() => setPosition((p) => p + 1)}>
              <Icon name="right" size={14} />
            </button>
          </div>

          <span class="Form-key">History</span>
          <div class="Form-checks">{check('skipHistory', "Don't save copied values to history")}</div>

          <span class="Form-key">Preview</span>
          <div class="Preview">
            <span class="Preview-value">{problem() ? `⚠ ${problem()}` : sample()}</span>
            <Show when={!problem()}>
              <span class="Preview-bits" title={bitsTitle(prepared().bits, prepared().poolSize)}>
                {formatBits(prepared().bits)}
              </span>
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
