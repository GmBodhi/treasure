import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Button from '../components/Button.jsx';
import PageShell, { Card, SectionTitle } from '../components/PageShell.jsx';

const ROW = 'flex items-baseline justify-between gap-4';
const MONO = 'font-mono text-[13px] text-muted';

function Stat({ value, label }) {
  return (
    <Card>
      <div className="text-3xl font-semibold tracking-[-0.02em]">{value}</div>
      <div className={MONO}>{label}</div>
    </Card>
  );
}

export default function AdminPage() {
  const [experiences, setExperiences] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const fileInput = useRef(null);

  const refresh = useCallback(async () => {
    const { experiences: list } = await api.listExperiences();
    setExperiences(list);
    setSelected((current) => current || list[0]?.id || '');
    setSummary(await api.summary(list[0]?.id));
  }, []);

  useEffect(() => {
    refresh().catch((err) => setMessage(`Could not load: ${err.message}`));
  }, [refresh]);

  async function upload(event) {
    event.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setMessage('Uploading…');
    try {
      const payload = await api.uploadTarget(selected, file, file.name);
      setMessage(`Uploaded ${payload.targetFile} (${(payload.bytes / 1024).toFixed(1)} KB)`);
      await refresh();
    } catch (err) {
      setMessage(`Failed: ${err.message}`);
    }
  }

  return (
    <PageShell
      title="Treasure AR console"
      lede="Experience manifests, compiled targets, and scan analytics."
    >
      <SectionTitle>Experiences</SectionTitle>
      {experiences.length === 0 ? (
        <Card>
          <span className={MONO}>No experiences yet.</span>
        </Card>
      ) : (
        experiences.map((exp) => (
          <Card key={exp.id} className="mb-3">
            <div className={ROW}>
              <div>
                <strong>{exp.name}</strong>
                <div className={MONO}>
                  {exp.id} · {exp.markerCount} markers · {exp.targetFile ?? 'no target'}
                </div>
              </div>
              <Link className={`${MONO} text-accent no-underline hover:underline`} to={`/?e=${encodeURIComponent(exp.id)}`}>
                open AR →
              </Link>
            </div>
          </Card>
        ))
      )}

      <SectionTitle>Scan summary</SectionTitle>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <Stat value={summary?.totalScans ?? '–'} label="total scans" />
        <Stat value={summary?.uniqueSessions ?? '–'} label="unique sessions" />
        <Stat value={summary?.markers?.length ?? '–'} label="markers hit" />
      </div>

      <Card className="mt-3">
        {summary?.markers?.length ? (
          summary.markers.map((row, i) => (
            <div
              key={row.markerId}
              className={`${ROW} ${i > 0 ? 'mt-2.5 border-t border-white/[0.07] pt-2.5' : ''}`}
            >
              <span>{row.markerId}</span>
              <span className={MONO}>
                {row.scans} scans · {row.uniqueSessions} sessions · {row.avgDwellMs ?? '–'} ms avg dwell
              </span>
            </div>
          ))
        ) : (
          <div className={MONO}>No scans recorded yet.</div>
        )}
      </Card>

      <SectionTitle>Upload compiled target</SectionTitle>
      <Card>
        <form className="grid gap-3.5" onSubmit={upload}>
          <div>
            <label className="mb-1.5 block text-[13px] text-muted" htmlFor="admin-exp">
              Experience
            </label>
            <select
              id="admin-exp"
              className="w-full rounded-xl border border-stroke bg-black/30 px-3.5 py-3 text-paper font-[inherit]"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {experiences.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] text-muted" htmlFor="admin-file">
              .mind file — build one in{' '}
              <Link className="text-accent" to="/studio">
                the target studio
              </Link>
              , or with <span className="font-mono">npm run compile-target</span>
            </label>
            <input
              id="admin-file"
              ref={fileInput}
              type="file"
              accept=".mind"
              required
              className="w-full rounded-xl border border-stroke bg-black/30 px-3.5 py-3 text-paper font-[inherit]"
            />
          </div>

          <Button type="submit" disabled={!selected}>
            Upload
          </Button>
          <p className="min-h-[18px] text-[13px] text-accent">{message}</p>
        </form>
      </Card>
    </PageShell>
  );
}
