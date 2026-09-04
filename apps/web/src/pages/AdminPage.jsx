import { useCallback, useEffect, useState } from 'react';
import { ANALYTICS_ENABLED, API_CONFIGURED, api } from '../api/client.js';
import PageShell, { Card, SectionTitle } from '../components/PageShell.jsx';
import TeamsConsole from '../components/TeamsConsole.jsx';
import { LEVEL_COUNT, listStations, targetExists } from '../lib/hunt.js';

const MONO = 'font-mono text-[13px] text-muted';
const CELL = 'px-2 py-1.5 text-left align-top';

function Stat({ value, label }) {
  return (
    <Card>
      <div className="text-3xl font-semibold tracking-[-0.02em]">{value}</div>
      <div className={MONO}>{label}</div>
    </Card>
  );
}

/**
 * Which of the twenty targets are actually compiled and deployed.
 *
 * The single most useful thing this page does on the morning of the event: a
 * station whose .mind was never saved looks completely fine until a team is
 * standing in front of it.
 */
function useTargetReadiness(stations) {
  const [ready, setReady] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(stations.map((s) => targetExists(s.targetUrl))).then((results) => {
      if (cancelled) return;
      setReady(Object.fromEntries(stations.map((s, i) => [s.id, results[i]])));
    });
    return () => {
      cancelled = true;
    };
    // The station list is a constant for the life of the bundle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

export default function AdminPage() {
  const stations = listStations();
  const ready = useTargetReadiness(stations);
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setSummary(await api.summary('breadcrumb'));
    } catch (err) {
      setMessage(`Could not reach the API: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only pull on mount when a Worker was actually configured. The hunt needs no
  // API at all, so firing at a proxy with nothing behind it would just put a 502
  // in the console of a page that renders fine without it.
  useEffect(() => {
    if (API_CONFIGURED) load();
  }, [load]);

  const compiled = ready ? Object.values(ready).filter(Boolean).length : null;

  return (
    <PageShell
      title="Operation Breadcrumb console"
      lede="Ten story levels, each in two places. Every team plays all ten in order; which of the two they get at each level is their route."
      width="max-w-[1000px]"
    >
      <TeamsConsole />

      <SectionTitle>Stations</SectionTitle>
      <Card className="mb-3">
        <div className={MONO}>
          {compiled === null
            ? 'Checking compiled targets…'
            : `${compiled} of ${stations.length} targets compiled and deployed.`}
        </div>
      </Card>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-muted">
              <th className={CELL}>id</th>
              <th className={CELL}>level</th>
              <th className={CELL}>location</th>
              <th className={CELL}>marker</th>
              <th className={CELL}>target</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.id} className="border-t border-white/[0.07]">
                <td className={`${CELL} font-mono`}>{s.id}</td>
                <td className={CELL}>
                  {s.level}{s.variant} · {s.title}
                </td>
                <td className={CELL}>{s.location}</td>
                <td className={`${CELL} text-muted`}>{s.marker}</td>
                <td className={`${CELL} font-mono`}>
                  {ready === null ? (
                    <span className="text-muted">…</span>
                  ) : ready[s.id] ? (
                    <span className="text-ok">ready</span>
                  ) : (
                    <span className="text-warn">missing</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>Scan summary</SectionTitle>
      {ANALYTICS_ENABLED ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <Stat value={summary?.totalScans ?? '–'} label="total scans" />
            <Stat value={summary?.uniqueSessions ?? '–'} label="unique devices" />
            <Stat value={summary?.markers?.length ?? '–'} label={`stations hit of ${LEVEL_COUNT * 2}`} />
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
                  className={`flex items-baseline justify-between gap-4 ${i > 0 ? 'mt-2.5 border-t border-white/[0.07] pt-2.5' : ''}`}
                >
                  <span className="font-mono">{row.markerId}</span>
                  <span className={MONO}>
                    {row.scans} scans · {row.uniqueSessions} devices · {row.avgDwellMs ?? '–'} ms avg dwell
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
            deployed Worker and station hits will be recorded.
          </div>
        </Card>
      )}
    </PageShell>
  );
}
