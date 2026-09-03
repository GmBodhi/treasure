import { useRef, useState } from 'react';
import Button from '../components/Button.jsx';
import PageShell, { Card, SectionTitle } from '../components/PageShell.jsx';
import { listStations } from '../lib/hunt.js';

const FIELD =
  'w-full rounded-xl border border-stroke bg-black/30 px-3.5 py-3 text-paper font-[inherit]';

/** Decode a File the user picked into an <img> the compiler can consume. */
const fileToImage = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

/**
 * One station at a time, one image per file.
 *
 * Compiling all twenty into a single bundle would be less clicking, but a team
 * only ever scans for the level they are on — so the app downloads one
 * single-target file of a few hundred KB instead of a ~13 MB bundle, matches
 * against one image instead of twenty, and cannot mis-match against a marker
 * from a level nobody has reached yet.
 */
export default function StudioPage() {
  const stations = listStations();
  const [selected, setSelected] = useState(stations[0]?.id ?? '');
  const [progress, setProgress] = useState(null);
  const [log, setLog] = useState(null);
  const [file, setFile] = useState(null);
  const fileInput = useRef(null);

  const station = stations.find((s) => s.id === selected);

  async function compileAndDownload() {
    if (!file) return;
    const filename = `${selected}.mind`;

    try {
      const image = await fileToImage(file);
      setProgress(0);
      setLog({ text: 'Compiling… this is CPU-bound and takes a while.' });

      // The non-A-Frame MindAR build is a plain ES module and does not need
      // AFRAME on the page, so this route never loads the 1.5 MB AR runtime.
      const { Compiler } = await import('mind-ar/dist/mindar-image.prod.js');

      const compiler = new Compiler();
      const started = performance.now();
      await compiler.compileImageTargets([image], (value) => setProgress(value));
      const buffer = await compiler.exportData();
      setProgress(100);

      const url = URL.createObjectURL(new Blob([buffer]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setLog({
        tone: 'ok',
        text:
          `Done. ${(buffer.byteLength / 1024).toFixed(1)} KB in ${((performance.now() - started) / 1000).toFixed(1)}s → ${filename}\n` +
          `Save it to apps/web/public/targets/${filename}.`,
      });
    } catch (err) {
      setLog({ tone: 'warn', text: `Failed: ${err.message}` });
    }
  }

  return (
    <PageShell
      title="Target studio"
      lede="Compiles one station's image into a MindAR .mind bundle in this browser — no native dependencies, nothing uploaded anywhere. Save each result into public/targets/ and it ships with the app."
      width="max-w-[760px]"
    >
      <SectionTitle>Station</SectionTitle>
      <Card>
        <label className="mb-1.5 block text-[13px] text-muted" htmlFor="station">
          Which marker is this?
        </label>
        <select
          id="station"
          className={FIELD}
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
            setLog(null);
          }}
        >
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · L{s.level}{s.variant} · {s.title} — {s.location}
            </option>
          ))}
        </select>

        {station && (
          <p className={'mt-2.5 font-mono text-[13px] text-muted'}>
            {station.marker} → saves as{' '}
            <span className="text-paper">apps/web/public/targets/{station.id}.mind</span>
          </p>
        )}
      </Card>

      <SectionTitle>Source image</SectionTitle>
      <Card>
        <p className="mb-3 font-mono text-[13px] text-muted">
          A photo of the fixed thing at that location, shot square-on and cropped to just the
          artwork. Detail, contrast and asymmetry are what the tracker matches — flat walls,
          gradients and repeating patterns give it nothing to hold.
        </p>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setLog(null);
          }}
          className={FIELD}
        />

        {file && (
          <img
            className="mt-3 block max-h-[280px] w-auto rounded-xl border border-stroke"
            src={URL.createObjectURL(file)}
            alt="Selected marker"
          />
        )}

        <div className="mt-3.5 flex flex-wrap gap-2.5">
          <Button
            size="sm"
            onClick={compileAndDownload}
            disabled={!file || !selected || (progress !== null && progress < 100)}
          >
            Compile &amp; download
          </Button>
        </div>

        {progress !== null && (
          <progress className="mt-4 h-2 w-full [accent-color:var(--color-accent)]" value={progress} max={100} />
        )}

        {log && (
          <div
            className={`mt-3.5 min-h-5 whitespace-pre-wrap font-mono text-[13px] ${
              log.tone === 'warn' ? 'text-warn' : 'text-muted'
            }`}
          >
            {log.text}
          </div>
        )}
      </Card>
    </PageShell>
  );
}
