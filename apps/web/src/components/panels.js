/**
 * Shared class strings for the AR overlay's panel state machine.
 *
 * All three panels stay mounted and stacked in one grid cell so switching
 * between them cross-fades. Which one is visible is decided by `data-state` on
 * the wrapper, read through Tailwind's group-data variant — the visibility
 * classes have to be written out literally per panel, because Tailwind scans
 * source text and would never see a template-built variant.
 */
/**
 * `justify-[safe_center]` over plain `place-items-center`: the AR route locks
 * page scroll (see `body:has(#root > .ar-route)` in ui.css), so a panel that
 * is simply centered has nowhere to go when its content is taller than the
 * viewport — the overflow bleeds equally off the top and bottom with no way
 * to reach it, which on a short phone screen can swallow the button below a
 * long brief entirely. `safe center` centers when it fits and falls back to
 * start-aligned, scrollable-via-`overflow-y-auto` when it does not.
 */
export const PANEL_BASE =
  'col-start-1 row-start-1 flex flex-col items-center justify-[safe_center] ' +
  'overflow-y-auto overscroll-contain invisible opacity-0 ' +
  'transition-[opacity,visibility] duration-[260ms] ease-out-back ' +
  'px-6 pt-[calc(24px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))] ' +
  'bg-[radial-gradient(120%_80%_at_50%_0%,rgb(240_180_41/0.12),transparent_60%)] bg-ink';

export const PANEL_INNER = 'my-auto w-[min(420px,100%)] text-left';

export const SHOW_INTRO = 'group-data-[state=intro]/ui:visible group-data-[state=intro]/ui:opacity-100';
export const SHOW_LOADING = 'group-data-[state=loading]/ui:visible group-data-[state=loading]/ui:opacity-100';
export const SHOW_ERROR = 'group-data-[state=error]/ui:visible group-data-[state=error]/ui:opacity-100';
export const SHOW_HUD =
  'group-data-[state=scanning]/ui:visible group-data-[state=scanning]/ui:opacity-100 ' +
  'group-data-[state=found]/ui:visible group-data-[state=found]/ui:opacity-100';

export const EYEBROW = 'mb-2.5 text-xs tracking-[0.16em] uppercase text-accent';
export const TITLE =
  'mb-3 text-[clamp(30px,8vw,42px)] leading-[1.08] tracking-[-0.02em] ' +
  'short:mb-2 short:text-[26px]';
export const LEDE = 'mb-[22px] text-muted short:mb-3';
