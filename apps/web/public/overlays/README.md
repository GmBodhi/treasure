# Overlay images

Referenced by `overlay: { type: 'image', src: '/overlays/…' }` in
`src/lib/hunt.js`. These are the in-fiction documents that appear on the marker
in AR, so they want to read as photographed printouts, not as UI.

Missing files fail quietly: A-Frame renders the plane with no texture, which
looks like a bug rather than a missing asset. Check every station that uses an
image overlay before the event.

Currently referenced, none of them made yet:

- `l02a-dashboard.png` — Janice's employee record printout, `STATUS: RESIGNED`
- `l03b-abtest.png` — the N3 systems-index entry, `ACCESS DENIED`
- `l04b-report.png` — the repeated system message sheet, `AUDIT PATHWAY: OPEN`
- `l06b-transcript.png` — the ethics committee audit extract, `REMOVED: 50%`
- `l08a-bridge.png` — the N3 terminal printout, `ACCESS GRANTED`
- `l10b-readme.png` — `README_BREADCRUMB.txt`

Keep them roughly 4:3 and legible at arm's length on a phone — the plane is one
marker-width across, so anything set in small type will not be readable.
