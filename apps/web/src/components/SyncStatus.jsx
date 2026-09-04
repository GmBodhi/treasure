import { useState } from 'react';
import Button from './Button.jsx';

/**
 * Whether this phone and the team's record agree, said in as few words as
 * possible.
 *
 * The reason this is on screen at all: progress is shared now, so "I scanned
 * it" and "the team has it" are two different facts, and there is exactly one
 * moment where the difference bites — a find made in a dead-spot that the
 * leaderboard has not heard about. A team that can see that is a team that
 * knows to walk twenty metres rather than rescan a marker that already worked.
 */
const DOT = 'inline-block size-1.5 shrink-0 rounded-full';

const STATES = {
  synced: { dot: 'bg-ok', text: 'text-muted', label: 'Synced' },
  syncing: { dot: 'bg-ok/60 animate-pulse-dot', text: 'text-muted', label: 'Syncing…' },
  idle: { dot: 'bg-muted/50', text: 'text-muted', label: 'Connecting…' },
  offline: { dot: 'bg-warn', text: 'text-warn', label: 'Offline' },
  'signed-out': { dot: 'bg-warn', text: 'text-warn', label: 'Not connected' },
  // No Worker in this build. Saying "offline" would be a lie and saying
  // "synced" a worse one, so it says what is true: this device only.
  solo: { dot: 'bg-muted/40', text: 'text-muted', label: 'This device only' },
};

export function SyncBadge({ sync, pending, onRetry }) {
  const state = STATES[sync.status] ?? STATES.idle;
  const held = pending?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onRetry}
      className={`inline-flex items-center gap-1.5 font-mono text-[12px] ${state.text} cursor-pointer`}
    >
      <span className={`${DOT} ${state.dot}`} />
      {held > 0 && sync.status !== 'synced'
        ? `${held} find${held > 1 ? 's' : ''} not sent`
        : state.label}
    </button>
  );
}

/**
 * The reconnect prompt.
 *
 * Only shown for `signed-out`, which means the server refused this device's
 * token or it never got one — the single case that needs a person and a pin.
 * A plain `offline` gets nothing: the finds are held, the poll retries, and
 * putting a form in front of a team for a problem that fixes itself when they
 * round a corner would just get the pin typed wrong under pressure.
 */
export function ReconnectPrompt({ team, onJoin }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  return (
    <form
      className="mb-6 rounded-xl border border-warn/40 bg-warn/[0.07] px-4 py-3.5"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const result = await onJoin(team, pin);
        setBusy(false);
        if (!result.ok) setError(result.error);
        else setPin('');
      }}
    >
      <p className="text-[13px] text-warn">Not connected to your team</p>
      <p className="mt-1 mb-3 text-[13px] text-muted">
        This device is playing on its own. Your finds are saved and will be sent once you sign back
        in — enter the pin from your team slip.
      </p>
      <div className="flex gap-2">
        <input
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Pin"
          className="min-w-0 flex-1 rounded-xl border border-stroke bg-black/30 px-3.5 py-2.5 font-mono text-paper"
        />
        <Button type="submit" size="sm" disabled={busy || !pin.trim()}>
          {busy ? '…' : 'Connect'}
        </Button>
      </div>
      {error && <p className="mt-2 font-mono text-[13px] text-warn">{error}</p>}
    </form>
  );
}

/**
 * "Someone else on your team found station 4."
 *
 * Transient and dismissible rather than a permanent line, because it is news:
 * the level list underneath it is already correct, and this exists only so a
 * team member who did not scan it understands why their screen just moved.
 */
export function TeammateBanner({ level, onDismiss }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-ok/35 bg-ok/[0.07] px-4 py-3.5">
      <span className={`${DOT} mt-2 bg-ok`} />
      <p className="flex-1 text-[13.5px] text-paper/90">
        A teammate found station {level}. You are both on level {level + 1} now.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="cursor-pointer text-muted"
      >
        ✕
      </button>
    </div>
  );
}
