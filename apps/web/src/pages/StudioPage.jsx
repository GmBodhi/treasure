import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import Button from '../components/Button.jsx';
import PageShell, { Card, SectionTitle } from '../components/PageShell.jsx';
import { MARKERS, markerDataUri, markerImage } from '../lib/markers.js';

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

export default function StudioPage() {
  const [experiences, setExperiences] = useState([]);
  const [selected, setSelected] = useState('');
  const [progress, setProgress] = useState(null);
  const [log, setLog] = useState(null);
  const [fileCount, setFileCount] = useState(0);
  const fileInput = useRef(null);
  const [params] = useSearchParams();

  useEffect(() => {
    api.listExperiences().then(({ experiences: list }) => {
      setExperiences(list);
      setSelected((current) => current || list[0]?.id || '');
    }).catch((err) => setLog({ tone: 'warn', text: `Could not list experiences: ${err.message}` }));
  }, []);

  /** Uploaded files win over the built-in markers when present. */
  async function sourceImages() {
    const files = [...(fileInput.current?.files ?? [])];
    if (files.length === 0) return Promise.all(MARKERS.map((m) => markerImage(m)));
    return Promise.all(files.map(fileToImage));
  }

  async function compile() {
    const images = await sourceImages();
    setProgress(0);
    setLog({ text: `Compiling ${images.length} image(s)… this is CPU-bound and takes a while.` });

    // The non-A-Frame MindAR build is a plain ES module and does not need
    // AFRAME on the page, so this route never loads the 1.5 MB AR runtime.
    const { Compiler } = await import('mind-ar/dist/mindar-image.prod.js');

    const compiler = new Compiler();
    const started = performance.now();
    await compiler.compileImageTargets(images, (value) => setProgress(value));
    const buffer = await compiler.exportData();
    setProgress(100);

    return { buffer, images, seconds: ((performance.now() - started) / 1000).toFixed(1) };
  }

  const compileAndUpload = useCallback(async function compileAndUpload() {
    try {
      const { buffer, images, seconds } = await compile();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const payload = await api.uploadTarget(selected, blob, `${selected}.mind`);
      setLog({
        tone: 'ok',
        text:
          `Done. ${images.length} targets, ${(payload.bytes / 1024).toFixed(1)} KB, ${seconds}s → ${payload.targetFile}\n` +
          `Make sure each marker in the manifest has a matching targetIndex (0…${images.length - 1}).`,
      });
    } catch (err) {
      setLog({ tone: 'warn', text: `Failed: ${err.message}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compile() is stable in practice.
  }, [selected]);

  // Lets a headless build run the whole compile+upload without a click.
  const auto = params.has('auto');
  useEffect(() => {
    if (auto && selected) compileAndUpload();
  }, [auto, selected, compileAndUpload]);

  async function compileAndDownload() {
    try {
      const { buffer, images, seconds } = await compile();
      const url = URL.createObjectURL(new Blob([buffer]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'targets.mind';
      a.click();
      URL.revokeObjectURL(url);
      setLog({ tone: 'ok', text: `Done. ${images.length} targets, ${seconds}s → downloaded targets.mind` });
    } catch (err) {
      setLog({ tone: 'warn', text: `Failed: ${err.message}` });
    }
  }

  return (
    <PageShell
      title="Target studio"
      lede="Compiles images into a MindAR .mind bundle in this browser — no native dependencies, no upload to a third party — then attaches it to an experience on this server."
      width="max-w-[760px]"
    >
      <SectionTitle>Source images</SectionTitle>
      <Card>
        <p className="mb-3 font-mono text-[13px] text-muted">
          {fileCount
            ? `${fileCount} uploaded image(s)`
            : 'Built-in markers from src/lib/markers.js'}
        </p>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {MARKERS.map((marker, index) => (
            <figure key={marker.id} className="m-0 overflow-hidden rounded-xl border border-stroke bg-black">
              <img className="block h-auto w-full" src={markerDataUri(marker)} alt={marker.title} />
              <figcaption className="px-2.5 py-2 font-mono text-xs text-muted">
                {index} · {marker.code}
              </figcaption>
            </figure>
          ))}
        </div>

        <label className="mt-4 block text-[13px] text-muted">
          …or pick your own images (order sets targetIndex)
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              setFileCount(event.target.files.length);
              setLog(null);
            }}
            className={`${FIELD} mt-1.5`}
          />
        </label>
      </Card>

      <SectionTitle>Attach to</SectionTitle>
      <Card>
        <label className="mb-1.5 block text-[13px] text-muted" htmlFor="exp">
          Experience
        </label>
        <select
          id="exp"
          className={FIELD}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {experiences.map((exp) => (
            <option key={exp.id} value={exp.id}>
              {exp.name} ({exp.markerCount} markers)
            </option>
          ))}
        </select>

        <div className="mt-3.5 flex flex-wrap gap-2.5">
          <Button size="sm" onClick={compileAndUpload} disabled={!selected || (progress !== null && progress < 100)}>
            Compile &amp; upload
          </Button>
          <Button size="sm" variant="ghost" onClick={compileAndDownload}>
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
