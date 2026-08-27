const CORNER = 'absolute size-[30px] rounded-[4px] border-[2.5px] border-accent';

/**
 * Framing guide. It fades out on acquisition — once the overlay is up, the
 * corners are competing with the thing the user came to look at.
 */
export default function Reticle({ hidden = false }) {
  return (
    <div
      className={
        'place-self-center relative w-[min(74vw,320px)] aspect-[1/1.32] ' +
        'transition-[opacity,transform] duration-300 ease-out-back ' +
        'group-data-[state=found]/ui:opacity-0 group-data-[state=found]/ui:scale-[1.06] ' +
        (hidden ? 'opacity-0' : '')
      }
    >
      <span className={`${CORNER} top-0 left-0 border-r-0 border-b-0`} />
      <span className={`${CORNER} top-0 right-0 border-l-0 border-b-0`} />
      <span className={`${CORNER} bottom-0 left-0 border-r-0 border-t-0`} />
      <span className={`${CORNER} bottom-0 right-0 border-l-0 border-t-0`} />
      <span
        className={
          'absolute left-[6%] right-[6%] h-0.5 animate-sweep ' +
          'bg-linear-to-r from-transparent via-accent to-transparent ' +
          'drop-shadow-[0_0_8px_rgb(240_180_41/0.7)]'
        }
      />
    </div>
  );
}
