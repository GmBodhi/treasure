import { MARKERS, markerDataUri } from '../lib/markers.js';
import Button from '../components/Button.jsx';
import PageShell from '../components/PageShell.jsx';

/**
 * The printable sheet. `print:` variants strip the chrome and force one marker
 * per page — the printed artefact and the on-screen page are the same DOM, so
 * they cannot drift.
 */
export default function MarkersPage() {
  return (
    <div className="print:bg-white">
      <PageShell
        title="Printable markers"
        lede="Print these, or show them on a second screen — both work. The artwork is generated from src/lib/markers.js, the same module the compiler uses, so a printed marker and the compiled .mind can never drift apart."
        width="max-w-[900px]"
      >
        <div className="my-[18px] flex flex-wrap gap-2.5 print:hidden">
          <Button size="sm" onClick={() => window.print()}>
            Print sheet
          </Button>
        </div>

        {MARKERS.map((marker, index) => (
          <figure key={marker.id} className="m-0 mb-[34px] print:mb-0 print:break-after-page">
            <div className="w-full overflow-hidden rounded-[10px] print:rounded-none">
              <img className="block h-auto w-full" src={markerDataUri(marker)} alt={`${marker.title} marker`} />
            </div>
            <figcaption className="flex justify-between gap-3 px-0.5 pt-2.5 font-mono text-[13px] text-muted print:hidden">
              <span>
                {marker.code} · {marker.title}
              </span>
              <span>targetIndex: {index}</span>
            </figcaption>
          </figure>
        ))}
      </PageShell>
    </div>
  );
}
