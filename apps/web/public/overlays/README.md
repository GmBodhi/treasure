# Overlay images

Referenced by `overlay: { type: 'image', src: '/overlays/…' }` in
`src/lib/hunt.js`. These are the in-fiction documents that appear on the marker
in AR, so they want to read as photographed printouts, not as UI.

Missing files fail quietly: A-Frame renders the plane with no texture, which
looks like a bug rather than a missing asset. Check every station that uses an
image overlay before the event.

Currently referenced, none of them made yet:

- `l02a-dashboard.png` — the metrics dashboard row, `metric_wellbeing` deprecated
- `l03b-abtest.png` — the A/B result sheet, `variant_provoke` rolled out at 100%
- `l04b-report.png` — the summary page of Janice's report, `STATUS: NOT FOUND`
- `l06b-transcript.png` — published vs raw transcript, timestamps intact
- `l08a-bridge.png` — the `BH-ASSIST-BRIDGE v2` integration spec
- `l10b-readme.png` — `README_BREADCRUMB.txt`

Keep them roughly 4:3 and legible at arm's length on a phone — the plane is one
marker-width across, so anything set in small type will not be readable.
