import { displayTeamCode } from '../lib/hunt.js';

const SHELL = 'mx-auto w-[min(560px,100%)] px-5 pt-[calc(28px+env(safe-area-inset-top))] pb-[calc(40px+env(safe-area-inset-bottom))]';
const EYEBROW = 'text-[11px] tracking-[0.18em] uppercase text-accent';
const MONO = 'font-mono text-[13px] text-muted';

/**
 * Joined, but the hunt is not open yet.
 *
 * This screen is the picture of a rule, not the rule itself: the server
 * refuses completions until an organiser starts the hunt, so a team that gets
 * past this — a stale tab, devtools — still records nothing. That is why it can
 * afford to be calm rather than defensive.
 *
 * It deliberately shows nothing about the route. Handing out slips half an hour
 * early is normal; letting those teams read their first station and go and
 * stand next to it is not.
 */
export default function WaitingPanel({ team, startsAt, onLeave }) {
  const scheduled = startsAt ? new Date(startsAt) : null;

  return (
    <div className={SHELL}>
      <div className="flex items-baseline justify-between gap-4">
        <p className={EYEBROW}>Operation Breadcrumb</p>
        <button type="button" onClick={onLeave} className={`${MONO} cursor-pointer`}>
          {displayTeamCode(team)} ✕
        </button>
      </div>

      <h1 className="mt-2 mb-3 text-[26px] tracking-[-0.02em]">You&apos;re in</h1>

      <div className="mb-6 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-4">
        <span className="inline-block size-2 shrink-0 rounded-full bg-accent animate-pulse-dot" />
        <div>
          <p className="text-[15px] text-paper">
            {scheduled ? 'The trail opens shortly.' : 'Waiting for the organiser.'}
          </p>
          <p className={MONO}>
            {scheduled
              ? `Starts at ${scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'This screen will move on its own when they say go.'}
          </p>
        </div>
      </div>

      <p className="mb-3 text-muted">
        Your team is registered and your route is assigned. Nothing counts until the hunt opens —
        scanning a marker before then records nothing, so there is nothing to gain by going early.
      </p>
      <p className="text-muted">
        Everyone on your team should join now, with the same code and pin. Whoever scans a station,
        the whole team moves up.
      </p>
    </div>
  );
}
