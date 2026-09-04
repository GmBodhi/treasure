# Treasure AR

Image-tracking AR treasure hunt. Point a phone camera at a printed marker and an
overlay appears anchored to it — a card, a 3D model, or a set of primitives,
whichever the experience manifest asks for.

A monorepo of two independently deployed halves:

| Workspace | What it is | Deploys to |
| --- | --- | --- |
| `apps/web` | React + Vite front end, [MindAR][mindar] and [A-Frame][aframe] for tracking and rendering | Cloudflare **Pages** |
| `apps/api` | Hono API backed by D1 — scan analytics only, and optional | Cloudflare **Workers** |

**The hunt is a static bundle.** Clues are hard-coded in
`apps/web/src/lib/clues.js` and the compiled tracking target is a static asset
under `apps/web/public/targets/`, so scanning needs no server, no database and
no network round-trip before the camera can open. The Worker is left for one
job — recording scans — and a build with no `VITE_API_BASE` simply does not
report. npm workspaces keep them one `npm install`.

[mindar]: https://hiukim.github.io/mind-ar-js-doc/
[aframe]: https://aframe.io/

## Quick start

```bash
npm install       # one install for both workspaces
npm run dev:web   # Vite dev server on :5173 — this is the entire hunt
```

Then open `/studio`, press **Compile & download**, and save the file to
`apps/web/public/targets/demo.mind`. Reload and the hunt runs. Compiled targets
are git-ignored — megabytes of binary, exactly reproducible from that button —
so a fresh clone has none, and the AR page says so rather than failing inside
MindAR.

That gets you the hunt on one device. For shared progress across a team and the
leaderboard, run the Worker alongside it:

```bash
npm run db:migrate   # create the local D1 database from apps/api/migrations/
npm run dev          # Worker on :8787 AND the Vite dev server on :5173
npm run db:teams     # seed the 15 teams and print their pins
```

`db:teams` prints the code/pin slips you hand out. See
[Multiplayer](#multiplayer).

Vite proxies `/api` to the Worker, so development stays same-origin and CORS
never enters into it. No Cloudflare account is needed — `wrangler dev` simulates
D1 on disk under `apps/api/.wrangler/`.

Every root script delegates to a workspace, so `npm run dev --workspace apps/api`
and friends work too if you only want one half.

### The production shape

The built app served the way Pages serves it — which is the only local way to
exercise `_redirects` and `_headers`:

```bash
npm run build
npx wrangler pages dev apps/web/dist --port 4173 --ip 0.0.0.0   --local-protocol https --https-cert-path certs/cert.pem --https-key-path certs/key.pem
```

`wrangler pages dev` honours `_redirects` and `_headers`; `vite preview` does
not, so it is the only local way to check the SPA fallback, the legacy
redirects, and the `/targets/*` content type before deploying. Add
`VITE_API_BASE=https://192.168.1.42:8787` to the build to point it at a Worker
and exercise CORS as well.

### Why `.npmrc` sets `ignore-scripts`

`mind-ar` depends on `canvas`, a native module for its Node-side compiler that
needs a C++ toolchain. Nothing here uses that path — targets are compiled in the
browser at `/studio` — so the build would fail on a machine without Visual
Studio for no benefit. Puppeteer's ~150 MB Chrome download is skipped for the
same reason: the test runners drive an installed Chrome via `CHROME_PATH`.

| Route | What it is |
| --- | --- |
| `/` | the AR experience (`?e=<id>` selects which) |
| `/markers` | printable marker sheet |
| `/studio` | compile images into a `.mind` target you save into `public/targets/` |
| `/admin` | hunt list and scan analytics |
| `/dev/tracking-test` | synthetic-camera tracking test — no camera, no printout, no human |

The old `.html` URLs (`/markers.html` and friends) 301 to these, so printed QR
codes from earlier builds still work.

`apps/web/public/targets/demo.mind` holds the compiled target. It is
git-ignored, so a fresh clone will not have it — the AR page says so, and
`/studio` rebuilds it in a few seconds with one press of **Compile & download**.
Do the same after changing the marker art or adding a clue.

## HTTPS is not optional

`getUserMedia` only works in a [secure context][secure-context]. `localhost`
counts; your laptop's LAN IP does not. A phone opening `http://192.168.1.x:5173`
gets no camera, and the failure is not obvious from the browser UI — which is
why `describeError` checks `window.isSecureContext` first and says so plainly.

[secure-context]: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts

Both dev servers pick up TLS automatically when `certs/cert.pem` and
`certs/key.pem` exist — `wrangler dev` via `tools/dev-worker.mjs`, Vite via
`vite.config.js`. Without them both fall back to HTTP and say so.

**Local certs.** `mkcert` is the pleasant option because it installs a local CA,
so no browser warning:

```bash
mkcert -install
mkcert -key-file certs/key.pem -cert-file certs/cert.pem 192.168.1.42 localhost
```

Plain `openssl` works too, but the cert is self-signed and every browser will
interrupt with a warning you have to click through. List every host you will
actually type into a phone in `subjectAltName` — a cert without a matching SAN
entry is rejected outright, not merely warned about:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout certs/key.pem -out certs/cert.pem \
  -subj "/CN=treasure-ar local" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.42"
```

Note that iOS Safari sometimes still refuses the camera behind an untrusted
cert even after you accept the exception.

**Tunnel.** The reliable fallback, and the only one that gives a phone a
genuinely trusted certificate without installing a CA on it:

```bash
cloudflared tunnel --url http://localhost:5173    # the app; tunnel :8787 too, or
                                                 # point VITE_API_BASE at a deployed Worker
```

The startup banner prints the LAN URLs to type into the phone.

## How it works

### One scan, end to end

1. The phone opens `/?e=demo`. `ScanPage` calls `useExperience`, which looks the
   hunt up in `src/lib/clues.js` — clues, overlay definitions and a `targetUrl`.
   Synchronous: the definitions are in the bundle, so there is no fetch and no
   await on the critical path.
2. A `HEAD` on `targetUrl` runs before anything else, checking the *content
   type* as well as the status. Without it a missing `.mind` surfaces as a
   generic MindAR load error *after* the camera is already open, which is both
   alarming and unactionable. The status alone is not enough: the SPA fallback
   (`/* /index.html 200`) answers an unmatched path with `200 text/html` rather
   than a 404, so a target that was never compiled would otherwise look present
   and MindAR would try to parse the app's own HTML as a feature bundle.
3. The user presses **Start camera**. iOS requires `getUserMedia` to sit behind a
   user gesture, so this cannot be automatic.
4. `loadAframe()` dynamically imports A-Frame and MindAR — ~1.5 MB, and the
   reason the scan bundle stays small for everyone who never presses the button.
5. `<ArScene>` mounts. It renders `<a-scene mindar-image="…">` with one
   `<a-entity mindar-image-target>` per marker, then waits for A-Frame's
   `loaded`, calls `system.start()`, and waits for MindAR's `arReady`.
6. MindAR decodes camera frames, matches them against the `.mind` feature
   bundle, and fires `targetFound` / `targetLost` on the matching target entity.
7. `onFound` shows the sheet, vibrates, and posts the hit. `onLost` posts the
   dwell time.
8. If analytics is configured, `POST /api/scans` goes out via `sendBeacon`, so
   the report survives the user backgrounding the tab, and the Worker inserts a
   row into D1. With no `VITE_API_BASE` this is a no-op and the hunt is
   unaffected.
9. `/admin` reads `GET /api/scans/summary` — per-marker counts, unique sessions,
   mean dwell.

### Camera ownership

MindAR opens the camera itself, with fixed constraints, and keeps the
`MediaStream` private — which leaves no way to choose a lens, zoom, or switch on
the torch. So `src/ar/camera.js` opens the camera *first*, with the constraints
we want, and hands MindAR that same stream by intercepting exactly one
`getUserMedia` call. The interception is one-shot and self-restoring; patching
the global permanently would capture every other caller on the page, including
the tracking test's synthetic feed.

That buys three controls, each shown only when
`MediaStreamTrack.getCapabilities()` says the device really supports it:

| Control | Mechanism | Where it works |
| --- | --- | --- |
| Pause | `system.pause()` + `track.enabled = false` | everywhere |
| Zoom | `applyConstraints({ advanced: [{ zoom }] })` | Android Chrome; most desktop webcams do not expose it |
| Torch | `applyConstraints({ advanced: [{ torch }] })` | Android Chrome, rear camera only |
| Switch lens | reopen with `deviceId: { exact }`, remount the scene | anywhere with more than one camera |

`advanced` constraints are the point: a browser that does not understand `zoom`
ignores it rather than rejecting the whole call, so an unsupported device
degrades to a no-op instead of an exception. A control whose capability is
missing is not rendered at all — a zoom slider that silently does nothing is
worse than no slider. iOS Safari exposes neither zoom nor torch but does list
its lenses as separate devices, so the flip button is the one that survives
there.

### Pausing

Continuous feature detection over every frame is what makes an AR page eat a
battery, so pause stops it. Three things happen, in decreasing order of how much
they save:

1. `system.pause()` stops the detection loop and the video decode.
2. `track.enabled = false` stops the sensor delivering frames at all.
3. The torch is switched off — leaving a light burning through a pause would
   defeat the point.

The camera is deliberately *not* released. `track.stop()` is the only thing that
powers the hardware down fully, but undoing it costs a fresh `getUserMedia` and a
full MindAR restart; keeping the track alive makes resuming instant and needs no
new permission gesture. While paused, the other controls are disabled — the
sensor is not delivering frames, so zoom, torch and lens switching would all be
lies — and the frozen last frame is dimmed and labelled, because a still image
is otherwise indistinguishable from a crashed app.

Backgrounding the tab runs exactly the same path, so it saves the same power.
The difference is that only the manual pause survives coming back to the tab.

Switching a lens means a new `MediaStream`, and MindAR reads its stream once at
start, so the scene is torn down and rebuilt. If the new lens refuses to open —
busy, or gone since it was enumerated — the previous one is reopened rather than
dropping the user into the error panel with no camera at all.

### Where React ends and A-Frame begins

React owns the DOM it renders; A-Frame owns a WebGL canvas and a scene graph
that it mutates itself. The split that keeps them from fighting:

- **Declarative.** The scene *graph* is JSX. `<ArScene>` renders the `<a-scene>`,
  the camera, and the target entities; `<Overlay>` renders each marker's content
  from the manifest. A-Frame components are configured through attributes, and
  React sets attributes on unknown elements, so this needs no bridge layer.
- **Imperative.** Starting and stopping tracking lives on an A-Frame *system*,
  not on the DOM, and `targetFound`/`targetLost` are DOM events. Both are wired
  in `useEffect` against refs.
- **Mount = camera on.** `<ArScene>` unmounted means no camera. The parent
  decides whether AR runs by rendering it or not, and never reaches inside.

Three consequences worth knowing before editing:

- **`.ar-scene-host` must have a real size.** MindAR's `_resize` derives both the
  video dimensions and the camera fov/aspect from
  `container.clientWidth/clientHeight`, where the container is the `<a-scene>`'s
  parent. A zero-height parent produces a letterboxed video behind an opaque
  background and a broken projection matrix — which presents as a black screen
  with the permission already granted. Its CSS also sits *outside* Tailwind's
  cascade layers on purpose: A-Frame injects an unlayered stylesheet at runtime,
  and unlayered rules beat every layered one regardless of specificity.
- **Visibility uses `pause`/`unpause`, never `stop`/`start`.** MindAR's `stop()`
  stops the media tracks, removes its `<video>` and disposes the controller, and
  its `start()` requests a *fresh* camera with its own constraints — which would
  discard the lens, zoom and torch the user chose and re-download the target.

- `src/main.jsx` does **not** use `<StrictMode>`. Its double-invoked effects
  would open the camera twice and strand a `MediaStream`; on iOS the second
  `getUserMedia` then fails with `NotReadableError`.
- `loadAframe()` awaits its two imports in sequence on purpose.
  `mindar-image-aframe.prod.js` is an IIFE that calls `AFRAME.registerSystem` at
  evaluation time, so `window.AFRAME` must already exist. Static imports would
  let the bundler reorder them.

### Overlays

`overlay.type` in the manifest picks a component in `src/ar/overlays/`:

| Type | Renders |
| --- | --- |
| `card` | tinted plane with the title and body drawn in 3D |
| `primitives` | a declarative tree of A-Frame primitives from the manifest |
| `model` | a `.glb` via `<a-gltf-model>` |
| `image` / `video` | a textured plane; video sources are registered in `<a-assets>` |
| `none` | nothing — tracking only |

Manifest content is server-authored but still becomes live DOM, so `primitives`
accepts only [an allow-list of tags][primitives] and plain attribute names,
never `on*` handlers. Rendering through React rather than `innerHTML` also makes
the escaping problem vanish: values go through `setAttribute`, so a quote in a
manifest string cannot break out into markup.

[primitives]: src/ar/overlays/Primitives.jsx

### Styling

Tailwind v4, configured in CSS. `src/styles/ui.css` holds the design tokens in
an `@theme` block — `bg-surface`, `text-muted`, `ease-out-back` — plus the few
rules that cannot be utilities, because MindAR and A-Frame inject elements this
app never gets to put a `className` on.

The AR overlay is a state machine rather than conditional rendering: all four
panels stay mounted in one grid cell and `data-state` on the wrapper decides
which is visible, read through Tailwind's `group-data-[state=…]` variant. That
is what makes the transitions cross-fade instead of cut. The visibility classes
are written out literally in `src/components/panels.js` — Tailwind scans source
text, so a template-built variant would never be seen.

## Clues

`apps/web/src/lib/clues.js` is the source of truth for every hunt, and the file
you edit to write content. Two vocabularies meet in it, deliberately:

- a **clue** is what you author — a station, with its copy and whichever overlay
  it presents;
- a **marker** is what the tracker sees — an image in the compiled `.mind`,
  addressed by `targetIndex`.

They are the same object. `getExperience()` publishes `clues` as `markers`
because that is the name the A-Frame/MindAR layer, the printable sheet and the
`scans` table have always used. Author clues; the tracker reads markers.

### Clue fields

| Field | Required | What it does |
| --- | --- | --- |
| `targetIndex` | **yes** | integer ≥ 0, unique in the hunt — position in the compiled bundle |
| `id` | **yes** | unique in the hunt; keys the scene entity, the dwell timer and `marker_id` in analytics |
| `title` | no | sheet heading, and the card overlay's 3D text |
| `subtitle` | no | eyebrow above the heading |
| `body` | no | **the clue itself** — the text that sends someone to the next station |
| `accent` | no | overrides `--color-accent` across the whole HUD while the marker is held |
| `cta` | no | `{ label, href }`; an `href` starting with `http` opens in a new tab |
| `overlay` | no | what renders in 3D. Omitted entirely means `{ type: 'card' }` |

### Adding a clue

A clue is two coupled things, and one without the other does not work:

1. **Artwork the tracker can match** — add it to `src/lib/markers.js`, or bring
   your own image into `/studio`. Every marker needs a different *composition*,
   not just a different palette; see [Markers](#markers).
2. **An entry in `clues.js`**, whose `targetIndex` is that image's position in
   the compile order.

Then recompile at `/studio` and save the download over
`public/targets/<hunt-id>.mind`. A clue added against a target that does not
contain its image is a station that can never fire — which is what the tracking
test exists to catch.

Adding a hunt is a second entry in `HUNTS`, reachable at `/?e=<id>`, with its
own `<id>.mind` beside the first.

## Multiplayer

A team is several phones, not one. All of them see the same progress, and the
leaderboard at `/leaderboard` shows where every team has got to.

### Who decides what

**The client verifies, the server decides.** Only the phone can know that MindAR
matched the image in front of it — there is no way to re-check a scan after the
fact, so verification is the scan and nothing else. What the server owns is the
record: whether a find may be counted, when the team got there, and what every
other phone on the team sees.

That makes `unlocked` derived, never stored: it is `MAX(level) + 1` over the
`completions` rows. Two teammates scanning the same marker a second apart write
the same primary key, so the second is a no-op rather than a double count, and
the earlier timestamp wins — the honest answer to *when did this team find
station 4* is whoever got there first.

The server enforces two rules, which are the only two it can:

- **Sequence.** A level whose predecessor is not complete is refused. A jump
  from 2 to 9 is never a race; it is a bug or a team in devtools. A legitimate
  client only ever holds a contiguous run, so the rule costs it nothing.
- **Identity.** A team token is required, and it is issued only for a code and
  pin that match.

What none of this buys is protection from a team cheating on its own run: the
clues are in the bundle on their phone, so they can always post their own
completions. Sequence enforcement, per-device ids and server timestamps make
that *visible to an organiser* rather than impossible. That is the honest limit,
and for a campus afternoon it is the right place to stop.

### Authority is not the same as blocking

A scan in a wifi dead-spot still unlocks the level. The find is verified
locally, the reveal plays, and the level shows as **not sent** until the phone
can report it — held in `pending`, distinct from the server's `confirmed` copy
in the same record.

The server still wins on conflict. `confirmed` is replaced wholesale on every
sync, never merged upward, so an organiser's override lands on every device
instead of being outvoted by a local tally. A refused level is dropped from
`pending` rather than re-posted forever.

The alternative — hard authority, no network no unlock — strands a team at a
marker because of one dead-spot, and there are several on any campus.

### Sync

One endpoint does both jobs. `POST /api/teams/sync` carries every completion the
device holds and returns the team's merged progress, so a poll and a report are
the same request, and a phone that was out of signal for twenty minutes with
three finds to report is the same case as one with nothing to say.

Phones poll every 20 s while the tab is visible, and immediately on becoming
visible, on `online`, and on a find. The visibility listener is the one that
matters: a team walks between stations with the phone in a pocket, and the
moment worth being fresh for is the screen coming back on.

When a sync raises `unlocked`, the rise can only have come from another phone —
this device's own finds were already counted locally — so the app says so:
*a teammate found station 4*.

### Joining

Code and pin, both from the registration slip. The code decides which of the two
routes the team walks; the pin is what stops a team opening a rival's run, which
matters now that there is a board to be top of. Codes are printed on wristbands
and guessable by design, so a wrong pin and an unknown team give the same answer
— otherwise the endpoint is a roster anyone can enumerate.

A phone joining halfway through the afternoon — a flat battery swapped for a
spare — lands on the level the team is actually on, because `join` returns the
team's progress with the token.

A wrong pin is refused. A **network failure at the gate is not**: the team is let
in, marked *not connected*, with a reconnect prompt. A wifi blip in the most
crowded corner of campus must not stop a team from starting.

### Without a Worker

A build with no `VITE_API_BASE` has nothing to sign into, so the pin field
disappears, progress stays on the device, and `/leaderboard` says why it is
empty. This is the dev and rehearsal path, and it is why `npm run dev:web` alone
still works.

### Organiser console

`/admin` holds the roster with pins, each team's level, how many phones they are
playing on, and a per-team override for when a phone ends up in a fountain.
Lowering the override deletes the levels above; raising it backfills them,
marked `organiser` in `device_id` so the table still says how each row got
there. It is behind `ADMIN_TOKEN`, kept in `sessionStorage` — the console gets
opened on whatever laptop is on the desk, and a token that survives the tab
closing is a token still on a borrowed machine tomorrow.

## Markers

`src/lib/markers.js` generates the artwork as SVG, deterministically from a
seed. The printable sheet, the compiler and the tracking test all import that
one module, so a printed marker and the compiled `.mind` cannot drift apart.

Two rules shape the art, and both come from how tracking actually works:

1. **Detail, contrast, asymmetry.** Feature detection wants corners and edges.
   Flat colour fields, gradients, thin repeating patterns and glossy stock all
   track badly. At least ~300px on the short edge.
2. **Different structure, not just a different colour.** Matching happens in
   greyscale. Three cards with the same layout in three palettes are three
   near-identical targets, and the matcher will confidently report the wrong
   one — this repo had exactly that bug, caught by the tracking test. Each
   marker now owns a different composition: plate in a different place, a
   different dominant motif, a different ink weight.

To use your own images instead, drop them into the file picker in `/studio`.
**The order of the images is the `targetIndex` order** used by the markers in
the manifest.

### Compiling targets

`/studio` runs MindAR's compiler in the browser and hands you the result as a
download to drop into `public/targets/`. That is the supported path — nothing
to install. It imports the non-A-Frame MindAR
build, which is a plain ES module, so the studio route never loads the AR
runtime.

There is also `tools/compile-target.mjs` for CI or scripted builds, but it needs
the native `canvas` module, which needs a C++ toolchain (`npm i -D canvas`
first). On a machine without one it will not build, which is exactly why the
studio exists:

```bash
npm run compile-target --workspace apps/web -- public/targets/demo.mind art/one.png art/two.png
```

That writes a file straight to disk; put it in `apps/web/public/targets/` and
it ships with the next build.

## Testing

The tracking test is the one that matters: it replaces `getUserMedia` with a
canvas stream showing each marker in turn, runs the real pipeline, and asserts
every target in the manifest fires `targetFound`. It is the only way to prove a
compiled `.mind` actually matches the artwork without printing anything.

Neither runner needs the API. The hunt renders and unlocks without one, so
`npm run dev:web` and a compiled target are the whole fixture; what a missing
Worker costs is shared progress and the board, not the pipeline under test.

```bash
npm test --workspace apps/web                     # both runners against :5173

# or individually, against any origin:
cd apps/web
node tools/run-tracking-test.mjs https://192.168.1.42:5173   # exits non-zero on failure
node tools/smoke.mjs https://192.168.1.42:5173               # every route loads, no console errors
```

Point either at the `wrangler pages dev` origin (`:4173`) instead to run them
against the built Pages bundle talking to the Worker cross-origin — the shape
that actually ships.

Or open `/dev/tracking-test` in a browser and watch. Query parameters:
`?seconds=N` per marker, `?hold=1` to stay on each marker for the full time,
`?only=<id>` to pin the feed to one marker, `?stage=1` to hide the report and
watch the overlays full-strength.

Both runners drive an installed Chrome via `CHROME_PATH`; set it if yours is not
at the default Windows location.
## Backend

A Cloudflare Worker (Hono) with D1 for storage, deployed separately from the app
and called cross-origin.

**`/api/teams*` is the part the hunt depends on** — see
[Multiplayer](#multiplayer). `/api/scans*` is optional analytics on top of it.

The experience and target endpoints below are neither. Clues moved into the
bundle and targets moved into `public/targets/`, so nothing in `apps/web` calls
them; they still work, and are kept for anyone who wants the server-authored
shape back. `apps/api/seed/experiences.seed.json` is a historical copy of the
demo hunt, not its source — `src/lib/hunt.js` is.

All paths below are inside `apps/api/`.

| File | Job |
| --- | --- |
| `wrangler.jsonc` | bindings, vars, compatibility date |
| `src/index.js` | CORS, security headers, routing, error shape |
| `src/routes/teams.js` | join, sync, leaderboard |
| `src/routes/admin.js` | roster with pins, level override, team reset |
| `src/routes/experiences.js` | manifest CRUD, target upload/serve *(unused by the app)* |
| `src/routes/scans.js` | scan ingest + the analytics rollup |
| `src/lib/auth.js` | team tokens (HMAC), admin token, code normalisation |
| `src/lib/progress.js` | read/merge a team's completions |
| `src/lib/targets.js` | chunked BLOB read/write |
| `src/lib/http.js` | `badRequest` / `notFound` / `tooLarge` |
| `migrations/` | D1 schema, applied by `wrangler d1 migrations apply` |

| Endpoint | Purpose |
| --- | --- |
| `POST /api/teams/join` | code + pin → a team token and the team's progress |
| `POST /api/teams/sync` | **the one the hunt runs on** — post this device's finds, get the team's |
| `GET /api/teams/leaderboard` | public standings |
| `GET /api/teams/:code/progress` | one team's progress, unauthenticated read |
| `GET /api/admin/teams` | roster **with pins** — admin token |
| `PUT /api/admin/teams` | create or replace the roster — admin token |
| `POST /api/admin/teams/:code/unlock` | set a team's level by hand — admin token |
| `DELETE /api/admin/teams/:code/progress` | wipe a team's record — admin token |
| `POST /api/scans` | record one marker hit (analytics; optional) |
| `GET /api/scans` | recent scans |
| `GET /api/scans/summary` | per-marker rollup |
| `GET /api/experiences` | list *(unused by the app)* |
| `GET /api/experiences/:id` | one manifest, with an absolute `targetUrl` |
| `PUT /api/experiences/:id` | create or replace |
| `DELETE /api/experiences/:id` | remove, chunks included |
| `POST /api/experiences/:id/target` | upload a compiled `.mind` (multipart `target`) |
| `GET`/`HEAD /api/experiences/:id/target.mind` | serve it |

### Storage

Two shapes of data with genuinely different needs, so they are stored
differently:

- **experiences** — a handful of documents, read whole, edited rarely. `tracking`
  and `markers` stay JSON columns: the marker list is arbitrary nested overlay
  trees, and shredding it into tables would buy queries nobody runs.
- **scans** — append-only, unbounded, and the only thing anyone aggregates. Real
  columns, so `/api/scans/summary` is a `GROUP BY` executed by the database.
  The file-backed version loaded every scan ever recorded into memory and folded
  it by hand; that work no longer grows with the history.

The row cap still exists to stop an unattended demo growing forever, but it is
trimmed in `waitUntil` after the response — no client waits on it.

### Targets are chunked, and why

*(This describes the API-backed target path, which the app no longer takes —
targets are static assets now. It is kept because the endpoints still exist.)*

`.mind` bundles are megabytes of binary. D1 caps a single BLOB at **2 MB** and
this app accepts uploads up to 10 MB, so `apps/api/src/lib/targets.js` splits a target
into 1 MB rows ordered by `seq` and concatenates them on read. The demo target is
1.79 MB — it would *just* fit in one row today, which is precisely the kind of
margin that disappears the first time someone compiles a fourth marker.

The chunk size is deliberately under the cap rather than at it: the 2 MB limit
applies to the whole row, not the blob column alone.

**This is not the natural design.** Object storage (R2) is where files this size
belong — one binding, no chunking, no reassembly, and range requests for free.
The D1-only shape is a deliberate constraint of this deployment; if that ever
relaxes, `src/lib/targets.js` is the single file to replace.

One consequence to know: a 10 MB target is 10 queries to read and 11 to write.
Workers Free allows 50 D1 queries per invocation, Paid 1,000 — fine either way,
but it is not free.

### Cross-origin details

The one thing still crossing an origin is the scan beacon, and it would fail
silently if sent naively:

- **The scan beacon is `text/plain`.** `navigator.sendBeacon` cannot perform a
  CORS preflight, and `application/json` makes the request non-simple — the
  report would vanish without an error. The Worker parses the body as JSON
  regardless of what the header claims.

Targets used to be the other case here: the API built an absolute `targetUrl`,
because a relative path would have resolved against the *app's* origin and
404ed. Now that resolving against the app's origin is exactly right, the URL is
relative and the problem is gone.

## Deploying

Two independent deploys, and the app half stands alone: a Pages deploy with a
compiled target in `public/targets/` is a working hunt with no Worker at all.
Deploy the Worker only if you want scan analytics.

### apps/web — Pages

```bash
npm run build        # no VITE_API_BASE: a self-contained hunt, analytics off
npm run deploy:web
```

Make sure `apps/web/public/targets/<id>.mind` exists before building — it is
git-ignored, so CI and a fresh clone both start without it. `/studio` produces
it in seconds.

To record scans, point the build at a deployed Worker:

```bash
VITE_API_BASE=https://treasure-ar-api.<your-subdomain>.workers.dev npm run build
npm run deploy:web
```

Connecting the repo to Pages instead of deploying from the CLI needs three
settings, because the build runs from the repo root:

| Setting | Value |
| --- | --- |
| Root directory | `apps/web` |
| Build command | `npm run build` |
| Output directory | `dist` |

and `VITE_API_BASE` as a build-time environment variable pointing at the
deployed Worker. Without it the build has no server, so progress stays on one
device and there is no leaderboard.

### apps/api — Workers

Required for shared progress and the leaderboard. Without it the app falls back
to single-device play; see [Multiplayer](#multiplayer).

```bash
npm run db:create                 # prints a database_id
# paste it into apps/api/wrangler.jsonc -> d1_databases[0].database_id
npm run db:migrate:remote         # apply migrations to the real database

npx wrangler secret put TEAM_SECRET --cwd apps/api    # signs team tokens
npx wrangler secret put ADMIN_TOKEN --cwd apps/api    # guards /api/admin

npm run deploy:api
npm run db:teams -- https://your-worker.workers.dev "$ADMIN_TOKEN"
```

Both secrets have dev defaults in `wrangler.jsonc` so a fresh clone runs. A
`wrangler secret put` overrides the var of the same name, which is the whole of
the production step — do it before the event, not during: rotating
`TEAM_SECRET` signs every phone out, and fifteen teams re-entering a pin
mid-hunt is not a good afternoon.

Set `CORS_ORIGIN` in `apps/api/wrangler.jsonc` to the Pages origin before going
public. `*` is a development default, not a deployment one.

`npm run db:teams` seeds the roster and prints the code/pin slips to hand out.
It upserts, so re-running before the event keeps the progress of a team that has
already started; pass `--repin` to roll new pins. `npm run db:seed` is unrelated
— it feeds the experience endpoints, which no part of the app reads.

### Pages routing

`apps/web/public/_redirects` is copied verbatim into the build and does two jobs:

- **SPA fallback.** `/* /index.html 200` — a rewrite, not a redirect, so the URL
  the user typed survives into the app for react-router to read. Without it
  every deep link (`/markers`, `/admin`) is a 404, because Pages serves files
  and no such file exists.
- **Legacy URLs.** The vanilla build served `.html` pages; those 301 to the
  clean routes so printed QR codes still work. These rules must come *before*
  the catch-all — Pages matches top to bottom, and the fallback would otherwise
  swallow them and quietly render the app at the old URL instead of redirecting.

One consequence of that catch-all is worth knowing, because it is silent: a
request for a target that was never compiled does not 404, it returns
`index.html` with a 200. That is why the check in `lib/clues.js` looks at the
content type and not just the status.

`_headers` marks `/assets/*` immutable (Vite fingerprints them), gives
`/targets/*` an explicit `application/octet-stream` (the other half of that same
check) with a day of caching, keeps `index.html` uncached so a deploy is
actually visible, and sets the `Permissions-Policy` that `getUserMedia` is gated
on alongside the secure context.

## Layout

```
package.json                    workspaces + delegating scripts
.npmrc                          ignore-scripts (see Quick start)
certs/                          shared dev TLS, used by both dev servers

apps/web/                       -> Cloudflare Pages
  index.html                    Vite entry
  vite.config.js                React + Tailwind, dev TLS, /api proxy
  public/
    _redirects                  SPA fallback + legacy .html redirects
    _headers                    cache + security headers
    targets/<id>.mind           compiled tracking targets (git-ignored)
    models/lantern.glb          generated by `npm run make:model`
  src/
    main.jsx                    root render (no StrictMode - see above)
    App.jsx                     routes; operator pages are lazy
    api/client.js               fetch helper, device + session ids, API on/off
    api/teams.js                join, sync, leaderboard
    api/admin.js                organiser roster + overrides
    ar/
      aframe.js                 ordered dynamic import of A-Frame + MindAR
      ArScene.jsx               the scene, and the whole camera lifecycle
      camera.js                 lens selection, zoom, torch, stream interception
      overlays/                 one component per overlay type
    components/                 HUD, panels, camera controls, sync status, shell
    hooks/useHunt.js            team, route, progress, and the sync loop
    hooks/                      camera state, station load, page visibility
    lib/hunt.js                 the 10x2 levels and routes - the content you edit
    lib/progress.js             this device's copy: confirmed + pending
    lib/markers.js              generated marker artwork (SVG, seeded)
    lib/describeError.js        raw failure -> copy a user can act on
    pages/                      one per route
    styles/ui.css               Tailwind entry, @theme tokens, A-Frame overrides
  tools/                        model generator, target compiler, test runners

apps/api/                       -> Cloudflare Workers (shared progress + analytics)
  wrangler.jsonc                Worker name, D1 binding, vars
  src/
    index.js                    CORS, security headers, routing, error shape
    routes/teams.js             join, sync, leaderboard
    routes/admin.js             roster with pins, level override, reset
    routes/                     experiences.js, scans.js
    lib/auth.js                 team + admin tokens
    lib/progress.js             read/merge a team's completions
    lib/targets.js              chunked BLOB read/write
    lib/http.js                 badRequest / notFound / tooLarge
  migrations/                   D1 schema
  seed/                         demo manifest + locally compiled .mind
  tools/                        dev runner, seeders (db:seed, db:teams)
```

## Environment

Copy `.env.example` to `.env`. Everything has a working default.

| Variable | Where | Default | Meaning |
| --- | --- | --- | --- |
| `CORS_ORIGIN` | `wrangler.jsonc` vars | `*` | comma-separated origins allowed to call the API |
| `MAX_TARGET_BYTES` | `wrangler.jsonc` vars | `10485760` | upload cap for `.mind` files |
| `MAX_SCANS` | `wrangler.jsonc` vars | `10000` | scan rows kept per experience |
| `LEVEL_COUNT` | `wrangler.jsonc` vars | `10` | levels in a full run; the leaderboard uses it to mark a team finished |
| `TEAM_SECRET` | `wrangler.jsonc` vars → **secret** | dev placeholder | signs team tokens. `wrangler secret put` before deploying; rotating it signs every phone out |
| `ADMIN_TOKEN` | `wrangler.jsonc` vars → **secret** | dev placeholder | guards `/api/admin`. Unset is a 503, not open |
| `API_PORT` | local | `8787` | port `wrangler dev` listens on; Vite proxies here |
| `TLS_CERT` / `TLS_KEY` | local | `certs/*.pem` | present, so both dev servers use HTTPS |
| `VITE_API_BASE` | build | empty | absolute URL of the deployed Worker. Empty means no shared progress, no leaderboard and no analytics — the hunt runs single-device. Empty is also correct in dev, where Vite proxies `/api` |
