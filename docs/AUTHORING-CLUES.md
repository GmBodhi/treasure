# Clue authoring — what the system supports

This describes the shapes a clue can take in this app: how a station is
structured, every way clue content can be presented, every way a level can be
completed, and where to extend if you need something not listed.

It deliberately contains **no story**. The narrative is authored separately and
dropped into the level fields described in §3. Nothing here assumes what the
story is about.

---

## 1. The structural model

**Ten levels. Each level exists twice** — as variant `A` and variant `B`, in two
different places, with two different puzzles. That is 20 stations.

Every team plays all ten levels **in order**. Which variant they get at each
level comes from their **route**, a string like `AABBBAABBA`. Routes are
generated: balanced five-and-five, distinct per team, so teams spread out instead
of queueing at one spot.

```
Team BC-07   A A B B B A A B B A
Team BC-01   B B B B B A A A A A
             1 2 3 4 5 6 7 8 9 10   ← level
```

Both teams play level 3; they play different versions of it, in different
buildings, at the same point in the sequence.

Level count is set by the `LEVELS` array in `apps/web/src/lib/hunt.js`. It must
stay **even**, because route balancing splits it in half.

### The rule that follows

> **A station must never name another station, another location, or another
> level.**

A team's variant at level 4 comes from their route, independently of what they
got at level 3. So a clue at station 3A ending "now go to the Physics Lab" has
hard-coded level 4 to variant B — and every team routed to 4A is sent to the
wrong building.

**Each station describes only itself.** The app owns the sequence.

### What makes A and B interchangeable

The two versions of a level must be swappable without a player noticing:

1. **Same information gained.** Teams on opposite paths must be able to compare
   notes and be at exactly the same point.
2. **Comparable difficulty.** Routes are assigned arbitrarily. A two-minute
   cipher opposite a twenty-minute logic grid means luck decides the winner.
3. **Different location, marker and mechanic.** Two versions of the same puzzle
   type is the same clue written twice.
4. **No shared physical props.** Version A must not need something that only
   exists at B's location.

---

## 2. How a player moves

```
Level space shows level N's brief
   → player works out where that is
   → walks there, finds the marker
   → completes the level  (see §5)
   → level N+1 unlocks and its brief appears
```

The puzzle is not what you find *at* a station — it is what **identifies** the
station. `brief` is the gate: a team cannot move until they solve it. `reveal` is
the reward for arriving.

Because each brief describes its own location, A and B stay interchangeable.

---

## 3. Anatomy of a level

Narrative fields live on the **level** and are shared by both variants, so both
paths deliver identical story automatically:

| Field | Purpose |
|---|---|
| `n` | Level number. Fixed. |
| `id` | Short slug, used as a React key. |
| `title` | Level heading, shown in the list and at the scan. |
| `story` | The narrative beat. Shown after completion, re-readable. |
| `breadcrumb` | A signature line, rendered in a monospace quote block. |

Everything that *differs* between paths lives on the **station**:

| Field | Who sees it | Status |
|---|---|---|
| `id` | nobody | The compiled target's filename. **Never change it.** |
| `location` | player | Plain name, shown before and after. |
| `marker` | organisers only | Which fixture was photographed. Listed in `/studio` and `/admin`. Never shown to players. |
| `brief` | player | The puzzle identifying **this** station. |
| `reveal` | player | The payload, shown at completion and re-readable forever. |
| `revealImage` | player | Optional. Path under `public/` for a non-text payload. |
| `overlay` | player | What renders in 3D on the marker. See §4. |

---

## 4. Where clue content appears

Four surfaces, with different capabilities. Choosing wrongly is the most common
authoring mistake.

| # | Surface | Shows | Medium |
|---|---|---|---|
| 1 | Level space (`/`) | `brief`, and after completion `reveal`, `story`, `breadcrumb` | HTML — selectable, copyable, scrollable, any length |
| 2 | Station panel (`/scan`, before camera) | `location`, `brief` | HTML. Repeated on purpose: this is the screen someone holds while hunting |
| 3 | The sheet (during a scan) | `title`, `reveal`, a CTA button | HTML over the live camera |
| 4 | AR overlay (on the marker) | whatever `overlay` specifies | 3D geometry |

### Overlay types

Set `overlay: { type: '…' }`. All six are implemented in
`apps/web/src/ar/overlays/Overlay.jsx`.

| Type | What it is | Good for |
|---|---|---|
| `card` | A coloured plane with title and body as 3D text. The default. | Short, dramatic lines |
| `image` | A flat image on the marker. `src` is a path under `public/`. | Cipher grids, charts, QR fragments, diagrams |
| `video` | A video plane. Source is auto-registered in `<a-assets>`; plays on found, pauses on lost. Must be muted-autoplay safe. | Footage, recordings with a still |
| `model` | A `.glb` via `<a-gltf-model>`. Takes `position`, `rotation`, `scale`, `animation`. | Physical props, objects |
| `primitives` | A tree of allow-listed A-Frame primitives with attributes and children. | Built-up shapes, dials, custom composites |
| `none` | Renders nothing. The marker is purely a trigger. | When everything lives in the sheet |

`primitives` accepts only these tags: `a-box`, `a-sphere`, `a-cylinder`,
`a-cone`, `a-plane`, `a-circle`, `a-ring`, `a-torus`, `a-torus-knot`,
`a-octahedron`, `a-tetrahedron`, `a-text`, `a-entity`, `a-light`. Attribute names
must match `^[a-z][a-z0-9-]*$`, and `on*` handlers are rejected. Anything else is
skipped with a console warning.

---

## 5. How a level can be completed

**`scan` — implemented, and currently the only one.** A physical marker at the
location; the tracker matching it unlocks the next level. Nothing is typed.

Each level's scan runs against a **single-target bundle** containing only that
station's image. The other 19 are not loaded, so a team cannot unlock a level by
finding a marker early — the target simply is not in memory.

Other completion types are designed for but **not yet built**. See §7.

---

## 6. Constraints from the medium

**AR text is 3D geometry.** It cannot be selected, copied or zoomed, and goes
unreadable at an angle in poor light.

- Short dramatic lines belong in AR.
- Anything a player must **read carefully or copy** — a hash, a long
  ciphertext, coordinates, a URL — belongs in `reveal`, which is real HTML they
  can long-press and copy. Never put a long string in AR text.

**Markers must be trackable.** Nothing is printed; markers are existing fixed
objects, photographed. Feature matching needs **detail, contrast and asymmetry**.
Blank walls, glass, plain doors and repeating tile patterns cannot be tracked.
Every proposed marker needs an organiser to confirm a suitable fixture exists.

**Markers must be distinct from each other.** Matching happens in greyscale, so
two fixtures with similar composition are a mis-match risk even across levels.

**Media costs download.** Each `.mind` is a few hundred KB. Video and models add
to that, fetched on a phone, possibly on venue wifi.

---

## 7. Designed for, not yet built

These are known extension points. Ask before assuming any of them exist.

| Type | What it would do | What it needs |
|---|---|---|
| **Answer box** | No marker. The player works something out and types it. For steps with nothing scannable — a hosted link, a paper puzzle, a physical prop. | `kind: 'answer'` + `answerHash` (SHA-256 of the normalised answer) on the station; an input in `LevelDetail`; normalisation that ignores case and punctuation |
| **Scan *and* answer** | Two gates on one level: find the marker to receive a puzzle, then type its solution. | Both fields above, plus a two-step state in the level detail |
| **Multi-marker** | One level requiring several markers found in any order. | A set of target files per station; progress as a set rather than a counter |
| **Timed reveal** | Content that unlocks at a wall-clock time, for a synchronised finale. | A timestamp on the level; a clock check in `useHunt` |
| **Audio** | Sound on target found. A-Frame has `a-sound`, but it is not on the primitives allow-list and not in the overlay switch. | Add the tag to the allow-list; register the source in `<a-assets>` like video |
| **Location check** | Confirm the player is physically near the station. | Geolocation, plus a fallback — GPS indoors is unreliable |

New types beyond these are fine. §8 says where they plug in.

---

## 8. Where to extend

| To add… | Change |
|---|---|
| A new overlay type | The switch in `src/ar/overlays/Overlay.jsx`. If it needs a preloaded source, also `Assets` in `src/ar/ArScene.jsx`. |
| A new primitive tag | `ALLOWED_PRIMITIVES` in `src/ar/overlays/Primitives.jsx`. |
| A new completion type | A `kind` on the station in `src/lib/hunt.js`; a branch in `LevelDetail` in `src/pages/HuntPage.jsx`; call `complete(level.n)` from `useHunt` when satisfied. |
| A new station field | `src/lib/hunt.js`, then render it — `HuntPage` for the level space, `useStation` for the scan sheet, `StationPanel` for the pre-camera screen. |
| Changing progression rules | `src/lib/progress.js`. `completeLevel` is idempotent and monotonic; keep it that way — targets re-fire constantly. |

Progression is client-side and trusted: the app believes its own tracker. Anyone
with devtools can skip ahead. That is deliberate for an offline event with no
network dependency; moving the gate behind the Worker in `apps/api` is the
upgrade path if it ever matters.

---

## 9. Checklist

- [ ] Twenty stations filled, no `TODO` left
- [ ] **No station names another station, location or level**
- [ ] Each level's A and B deliver identical information
- [ ] Each level's A and B are comparable in difficulty
- [ ] No mechanic repeated within a level
- [ ] Long or copyable payloads are in `reveal`, never in AR text
- [ ] Every `marker` is a plausible high-detail fixed object, distinct from all others
- [ ] Station `id` values untouched
- [ ] Every overlay type used is one of the six in §4
- [ ] Any completion type other than `scan` was agreed first — it does not exist yet
