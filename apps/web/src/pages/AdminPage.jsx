import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ANALYTICS_ENABLED, API_CONFIGURED, api } from '../api/client.js';
import PageShell, { Card, SectionTitle } from '../components/PageShell.jsx';
import { listExperiences } from '../lib/clues.js';

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
  // Hunts are hard-coded, so this list is available synchronously and the page
  // has something to show even with no API reachable at all.
  const experiences = listExperiences();
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setSummary(await api.summary(experiences[0]?.id));
    } catch (err) {
      setMessage(`Could not reach the API: ${err.message}`);
    } finally {
      setLoading(false);
    }
    // The hard-coded list is stable for the life of the bundle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only pull on mount when a Worker was actually configured. Otherwise the
  // page is complete without it and the request would just 502 into the console.
  useEffect(() => {
    if (API_CONFIGURED) load();
  }, [load]);

  return (
    <PageShell
      title="Treasure AR console"
      lede="Hunts defined in src/lib/clues.js, and the scan analytics collected by the API."
    >
      <SectionTitle>Hunts</SectionTitle>
      {experiences.map((exp) => (
        <Card key={exp.id} className="mb-3">
          <div className={ROW}>
            <div>
              <strong>{exp.name}</strong>
              <div className={MONO}>
                {exp.id} · {exp.markerCount} clues · public/targets/{exp.targetFile}
              </div>
            </div>
            <Link className={`${MONO} text-accent no-underline hover:underline`} to={`/?e=${encodeURIComponent(exp.id)}`}>
              open AR →
            </Link>
          </div>
        </Card>
      ))}
      <Card>
        <div className={MONO}>
          Edit <span className="text-paper">apps/web/src/lib/clues.js</span> to add or change a
          clue, then recompile its target in{' '}
          <Link className="text-accent no-underline hover:underline" to="/studio">
            the target studio
          </Link>
          .
        </div>
      </Card>

      <SectionTitle>Scan summary</SectionTitle>
      {ANALYTICS_ENABLED ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <Stat value={summary?.totalScans ?? '–'} label="total scans" />
            <Stat value={summary?.uniqueSessions ?? '–'} label="unique sessions" />
            <Stat value={summary?.markers?.length ?? '–'} label="clues hit" />
          </div>

          {!API_CONFIGURED && (
            <p className="mt-3 font-mono text-[13px] text-muted">
              No VITE_API_BASE in this build — analytics is served by the Worker, which the hunt
              itself does not need.{' '}
              <button type="button" onClick={load} className="text-accent underline cursor-pointer">
                {loading ? 'Loading…' : 'Try loading it anyway'}
              </button>
            </p>
          )}

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
              <div className={MONO}>
                {message || (summary ? 'No scans recorded yet.' : 'Analytics not loaded.')}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <div className={MONO}>
            Analytics is off. The hunt itself needs no server — set{' '}
            <span className="text-paper">VITE_API_BASE</span> at build time to point this build at a
            deployed Worker and scans will be recorded.
          </div>
        </Card>
      )}
    </PageShell>
  );
}
