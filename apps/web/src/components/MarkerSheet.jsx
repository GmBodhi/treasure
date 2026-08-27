import Button from './Button.jsx';

/**
 * The content sheet that rises when a target is acquired.
 *
 * It stays mounted with the last marker's content after the target is lost:
 * CSS slides it back out, and clearing the text mid-transition would make the
 * sheet visibly empty on its way down.
 */
export default function MarkerSheet({ marker, total }) {
  const cta = marker?.cta;
  const external = cta?.href?.startsWith('http');

  return (
    <aside
      aria-live="polite"
      className={
        'absolute left-3 right-3 bottom-[calc(12px+env(safe-area-inset-bottom))] ' +
        'px-5 pt-3.5 pb-5 rounded-3xl border border-stroke bg-surface ' +
        'backdrop-blur-xl backdrop-saturate-150 shadow-[0_18px_50px_rgb(0_0_0/0.5)] ' +
        'translate-y-[calc(100%+24px)] opacity-0 ' +
        'transition-[transform,opacity] duration-[380ms] ease-out-back ' +
        'group-data-[state=found]/ui:translate-y-0 group-data-[state=found]/ui:opacity-100'
      }
    >
      <div className="mx-auto mb-3.5 h-1 w-[38px] rounded-full bg-white/20" />
      <p className="mb-1.5 text-[11px] tracking-[0.16em] uppercase text-accent">
        {marker?.subtitle ?? ''}
      </p>
      <h2 className="mb-2 text-[21px] leading-[1.2] tracking-[-0.01em]">
        {marker?.title ?? marker?.id ?? ''}
      </h2>
      <p className="mb-[18px] text-[14.5px] text-muted">{marker?.body ?? ''}</p>

      <div className="flex items-center justify-between gap-3.5">
        {cta ? (
          <Button
            as="a"
            size="sm"
            href={cta.href ?? '#'}
            target={external ? '_blank' : '_self'}
            rel="noopener"
          >
            {cta.label ?? 'Open'}
          </Button>
        ) : (
          <span />
        )}
        <span className="text-right text-xs text-paper/40">
          {marker ? `#${marker.targetIndex + 1} of ${total}` : ''}
        </span>
      </div>
    </aside>
  );
}
