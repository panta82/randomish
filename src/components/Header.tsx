import { createEffect, createSignal, For } from 'solid-js';
import { MAX_LENGTH, MIN_LENGTH } from '../collections';
import diceSvg from '../dice.svg?raw';
import { setLength, setRollEpoch, state, toasts } from '../store';

const SLIDER_STEPS = 1000;
const LOG_MAX = Math.log2(MAX_LENGTH);

const toSlider = (length: number) => Math.round((Math.log2(length) / LOG_MAX) * SLIDER_STEPS);
const fromSlider = (position: number) => Math.round(2 ** ((position / SLIDER_STEPS) * LOG_MAX));

function Dice() {
  const [rolling, setRolling] = createSignal(false);
  const roll = () => {
    if (rolling()) return;
    setRolling(true);
    setRollEpoch((e) => e + 1);
    setTimeout(() => setRolling(false), 1600);
  };
  return (
    <button
      class="Dice"
      classList={{ 'Dice-rolling': rolling() }}
      title="Re-roll everything"
      onClick={roll}
      innerHTML={diceSvg}
    />
  );
}

export function Header() {
  return (
    <header class="Header">
      <Dice />
      <h1 class="Header-title">Randomish</h1>
      <div class="Header-info">
        Runs entirely in your browser, nothing is sent anywhere ·{' '}
        <a href="https://github.com/panta82/randomish" target="_blank" rel="noopener">
          source
        </a>
      </div>
    </header>
  );
}

export function LengthBar() {
  // The log scale maps many slider positions to one length, so keep the raw position
  // and only resync it when the length changes from elsewhere (eg. the number field)
  const [position, setPosition] = createSignal(toSlider(state.length));
  createEffect(() => {
    if (fromSlider(position()) !== state.length) setPosition(toSlider(state.length));
  });
  const onSlide = (value: number) => {
    setPosition(value);
    setLength(fromSlider(value));
  };

  const onNumber = (e: Event & { currentTarget: HTMLInputElement }) => {
    const n = Number(e.currentTarget.value);
    if (e.currentTarget.value !== '' && Number.isFinite(n)) setLength(n);
  };

  return (
    <div class="LengthBar">
      <label class="LengthBar-label" for="length">
        Length
      </label>
      <input
        id="length"
        class="LengthBar-number"
        type="number"
        min={MIN_LENGTH}
        max={MAX_LENGTH}
        value={state.length}
        onInput={onNumber}
        onBlur={(e) => (e.currentTarget.value = String(state.length))}
      />
      <span class="LengthBar-edge">{MIN_LENGTH}</span>
      <input
        class="LengthBar-slider"
        type="range"
        aria-label="Length"
        min={0}
        max={SLIDER_STEPS}
        value={position()}
        onInput={(e) => onSlide(Number(e.currentTarget.value))}
      />
      <span class="LengthBar-edge">{MAX_LENGTH}</span>
    </div>
  );
}

export function Toasts() {
  return (
    <div class="Toasts" aria-live="polite">
      <For each={toasts}>
        {(t) => (
          <div class="Toast" classList={{ 'Toast-leaving': t.leaving }}>
            {t.message}
          </div>
        )}
      </For>
    </div>
  );
}
