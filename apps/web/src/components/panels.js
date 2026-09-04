/**
 * Shared class strings for the AR overlay's panel state machine.
 *
 * All three panels stay mounted and stacked in one grid cell so switching
 * between them cross-fades. Which one is visible is decided by `data-state` on
 * the wrapper, read through Tailwind's group-data variant — the visibility
 * classes have to be written out literally per panel, because Tailwind scans
 * source text and would never see a template-built variant.
 */
export const PANEL_BASE =
  // `items-start` + `my-auto` on the inner block, not `place-items-center`.
  // Centring alone overflows in both directions on a short viewport and the
  // panel is fixed to the viewport, so there was no way to reach what fell off:
  // on a 320x568 phone the content is 668px tall and the Start camera button
  // was simply unreachable. Auto margins centre when there is room and give up
  // gracefully when there is not, and the panel scrolls for the rest.
  'col-start-1 row-start-1 h-full min-h-0 grid justify-items-center items-start overflow-y-auto overscroll-contain invisible opacity-0 ' +
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
