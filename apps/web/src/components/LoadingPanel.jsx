import { PANEL_BASE, PANEL_INNER, SHOW_LOADING } from './panels.js';

export default function LoadingPanel({ label }) {
  return (
    <section className={`${PANEL_BASE} ${SHOW_LOADING}`}>
      <div className={`${PANEL_INNER} text-center`}>
        <div
          role="status"
          aria-live="polite"
          className="mx-auto mb-4 size-[34px] rounded-full border-2 border-white/15 border-t-accent animate-spin-slow"
        />
        <p className="m-0 text-sm text-muted">{label}</p>
      </div>
    </section>
  );
}
