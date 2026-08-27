import Button from './Button.jsx';
import { LEDE, PANEL_BASE, PANEL_INNER, SHOW_ERROR } from './panels.js';

export default function ErrorPanel({ title, body, onRetry }) {
  return (
    <section className={`${PANEL_BASE} ${SHOW_ERROR}`}>
      <div className={PANEL_INNER}>
        <p className="mb-2.5 text-xs tracking-[0.16em] uppercase text-warn">Cannot start</p>
        <h2 className="mb-3 text-[clamp(22px,6vw,28px)] leading-[1.08] tracking-[-0.02em]">{title}</h2>
        <p className={LEDE}>{body}</p>
        <Button variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </section>
  );
}
