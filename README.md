# Treasure AR

Image-tracking AR treasure hunt. Point a phone camera at a printed marker and an
overlay appears anchored to it — a card, a 3D model, or a set of primitives,
whichever the experience manifest asks for.

A monorepo of two independently deployed halves:

| Workspace | What it is | Deploys to |
| --- | --- | --- |
| `apps/web` | React + Vite front end, [MindAR][mindar] and [A-Frame][aframe] for tracking and rendering | Cloudflare **Pages** |
| `apps/api` | Hono API backed by D1 | Cloudflare **Workers** |

They share nothing at runtime — the app is a static bundle that calls the API
cross-origin — so either can be deployed without touching the other. npm
workspaces keep them one `npm install`.

[mindar]: https://hiukim.github.io/mind-ar-js-doc/
[aframe]: https://aframe.io/

## Quick start

```bash
npm install          # one install for both workspaces
npm run db:migrate   # create the local D1 database from apps/api/migrations/
npm run dev          # Worker on :8787, Vite dev server on :5173
npm run db:seed      # load the demo experience and its compiled target
```

Open the URL the Vite banner prints. `npm run dev` runs both workspaces; Vite
proxies `/api` to the Worker, so development stays same-origin and CORS never
enters into it. No Cloudflare account is needed for any of this — `wrangler dev`
simulates D1 on disk under `apps/api/.wrangler/`.

Every root script delegates to a workspace, so `npm run dev --workspace apps/api`
and friends work too if you only want one half.

### The production shape

The built app on its own origin, talking to the API cross-origin — which is what
actually exercises CORS, and what `_redirects` is for:

```bash
VITE_API_BASE=https://192.168.1.42:8787 npm run build
npx wrangler pages dev apps/web/dist --port 4173 --ip 0.0.0.0   --local-protocol https --https-cert-path certs/cert.pem --https-key-path certs/key.pem
```

`wrangler pages dev` honours `_redirects` and `_headers`; `vite preview` does
not, so it is the only local way to check that the SPA fallback and the legacy
redirects actually work before deploying.

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
| `/studio` | compile images into a `.mind` target and attach it to an experience |
| `/admin` | experience list, scan analytics, manual target upload |
| `/dev/tracking-test` | synthetic-camera tracking test — no camera, no printout, no human |

The old `.html` URLs (`/markers.html` and friends) 301 to these, so printed QR
codes from earlier builds still work.

`apps/api/seed/targets/demo.mind` holds the compiled target. It is git-ignored, so a
fresh clone will not have it — the AR page says so, and `/studio` rebuilds it in
a few seconds with one press of **Compile & upload**. Do the same after changing
the marker art.

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

1. The phone opens `/?e=demo`. `ScanPage` calls `useExperience`, which fetches
   `GET /api/experiences/demo` — the manifest: markers, overlay definitions, and
   a `targetUrl`.
2. A `HEAD` on `targetUrl` runs before anything else. Without it a missing
   `.mind` surfaces as a generic MindAR load error *after* the camera is already
   open, which is both alarming and unactionable.
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
8. `POST /api/scans` goes out via `sendBeacon`, so the report survives the user
   backgrounding the tab. The Worker inserts a row into D1.
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

`/studio` runs MindAR's compiler in the browser and uploads the result. That is
the supported path — nothing to install. It imports the non-A-Frame MindAR
build, which is a plain ES module, so the studio route never loads the AR
runtime.

There is also `tools/compile-target.mjs` for CI or scripted builds, but it needs
the native `canvas` module, which needs a C++ toolchain (`npm i -D canvas`
first). On a machine without one it will not build, which is exactly why the
studio exists:

```bash
npm run compile-target --workspace apps/web -- ../api/seed/targets/hunt.mind art/one.png art/two.png
```

That writes a file; uploading it to the API is a separate step — `/admin`, or
`npm run db:seed -- <baseUrl> seed/targets/hunt.mind`.

## Testing

The tracking test is the one that matters: it replaces `getUserMedia` with a
canvas stream showing each marker in turn, runs the real pipeline, and asserts
every target in the manifest fires `targetFound`. It is the only way to prove a
compiled `.mind` actually matches the artwork without printing anything.

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

A Cloudflare Worker (Hono) with D1 for storage. It serves the API only — the
React app in `apps/web` is deployed separately and calls it cross-origin.

All paths below are inside `apps/api/`.

| File | Job |
| --- | --- |
| `wrangler.jsonc` | bindings, vars, compatibility date |
| `src/index.js` | CORS, security headers, routing, error shape |
| `src/routes/experiences.js` | manifest CRUD, target upload/serve |
| `src/routes/scans.js` | scan ingest + the analytics rollup |
| `src/lib/targets.js` | chunked BLOB read/write |
| `src/lib/http.js` | `badRequest` / `notFound` / `tooLarge` |
| `migrations/` | D1 schema, applied by `wrangler d1 migrations apply` |

| Endpoint | Purpose |
| --- | --- |
| `GET /api/experiences` | list |
| `GET /api/experiences/:id` | one manifest, with an absolute `targetUrl` |
| `PUT /api/experiences/:id` | create or replace |
| `DELETE /api/experiences/:id` | remove, chunks included |
| `POST /api/experiences/:id/target` | upload a compiled `.mind` (multipart `target`) |
| `GET`/`HEAD /api/experiences/:id/target.mind` | serve it |
| `POST /api/scans` | record one marker hit |
| `GET /api/scans` | recent scans |
| `GET /api/scans/summary` | per-marker rollup |

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

The app is on another origin, which changes two things that would otherwise fail
silently:

- **`targetUrl` is absolute.** Built from the request URL, because a relative
  path would resolve against the *app's* origin and 404.
- **The scan beacon is `text/plain`.** `navigator.sendBeacon` cannot perform a
  CORS preflight, and `application/json` makes the request non-simple — the
  report would vanish without an error. The Worker parses the body as JSON
  regardless of what the header claims. For the same reason the client only
  sends `content-type` when there is actually a body, so the manifest fetch on
  the critical path costs zero preflights.

## Deploying

Two independent deploys. Neither needs the other to be redeployed.

### apps/api — Workers

```bash
npm run db:create                 # prints a database_id
# paste it into apps/api/wrangler.jsonc -> d1_databases[0].database_id
npm run db:migrate:remote         # apply migrations to the real database
npm run deploy:api
npm run db:seed -- https://treasure-ar-api.<your-subdomain>.workers.dev
```

Set `CORS_ORIGIN` in `apps/api/wrangler.jsonc` to the Pages origin before going
public. `*` is a development default, not a deployment one.

`db:seed` goes through the public API rather than generating SQL for a reason: a
`.mind` bundle is megabytes of binary, D1 caps a SQL statement at 100 KB, and a
hex literal of the file would be several times larger than the file itself. The
bytes have to arrive over HTTP.

### apps/web — Pages

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

and `VITE_API_BASE` as a build-time environment variable.

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

`_headers` marks `/assets/*` immutable (Vite fingerprints them), keeps
`index.html` uncached so a deploy is actually visible, and sets the
`Permissions-Policy` that `getUserMedia` is gated on alongside the secure
context.

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
    models/lantern.glb          generated by `npm run make:model`
  src/
    main.jsx                    root render (no StrictMode - see above)
    App.jsx                     routes; operator pages are lazy
    api/client.js               fetch wrappers, API base, session id, beacon
    ar/
      aframe.js                 ordered dynamic import of A-Frame + MindAR
      ArScene.jsx               the scene, and the whole camera lifecycle
      camera.js                 lens selection, zoom, torch, stream interception
      overlays/                 one component per overlay type
    components/                 HUD, panels, camera controls, buttons, shell
    hooks/                      camera state, experience fetch, page visibility
    lib/markers.js              generated marker artwork (SVG, seeded)
    lib/describeError.js        raw failure -> copy a user can act on
    pages/                      one per route
    styles/ui.css               Tailwind entry, @theme tokens, A-Frame overrides
  tools/                        model generator, target compiler, test runners

apps/api/                       -> Cloudflare Workers
  wrangler.jsonc                Worker name, D1 binding, vars
  src/
    index.js                    CORS, security headers, routing, error shape
    routes/                     experiences.js, scans.js
    lib/targets.js              chunked BLOB read/write
    lib/http.js                 badRequest / notFound / tooLarge
  migrations/                   D1 schema
  seed/                         demo manifest + locally compiled .mind
  tools/                        dev runner, seeder
```

## Environment

Copy `.env.example` to `.env`. Everything has a working default.

| Variable | Where | Default | Meaning |
| --- | --- | --- | --- |
| `CORS_ORIGIN` | `wrangler.jsonc` vars | `*` | comma-separated origins allowed to call the API |
| `MAX_TARGET_BYTES` | `wrangler.jsonc` vars | `10485760` | upload cap for `.mind` files |
| `MAX_SCANS` | `wrangler.jsonc` vars | `10000` | scan rows kept per experience |
| `API_PORT` | local | `8787` | port `wrangler dev` listens on; Vite proxies here |
| `TLS_CERT` / `TLS_KEY` | local | `certs/*.pem` | present, so both dev servers use HTTPS |
| `VITE_API_BASE` | build | empty | absolute URL of the deployed Worker; empty in dev |
