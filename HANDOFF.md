# FSU — handoff brief

A web app for the Williamsport Bureau of Police Forensic Services Unit. Two halves sharing a
shell: **van inventory** (compartments, items, sweeps, reorder) and **scene documentation**
(incidents, forms, sketches, bundled PDF reports). Since 12 September 2026 those two halves are
two pages — `index.html` and `scenes.html` — built from the same `src/` and backed by the same
one record. See "The page split" in section 2 before you change anything structural.

Built over one long session against a real van and one real sweep. It works. The structure is
the problem, not the behaviour.

---

## 1. What you are inheriting

| | |
|---|---|
| `index.html` | the van. ~400 KB, built from `src/` by `node build.js` (23 parts). Libraries loaded on demand from `lib/` beside the page (never from another site; the Content-Security-Policy would refuse it): jsPDF, the QR encoder, JSZip for Word export, svg2pdf for the vector option. Beside it: `sw.js`, `manifest.webmanifest`, `scenes.webmanifest`, icons, `sweep.js`, `fsu-tests/`, `CHANGELOG.md`, and a GitHub Actions workflow that checks both builds and runs the suite |
| `scenes.html` | the scene. ~800 KB, built from the same `src/` by the same command (31 parts: the shared set, plus PDF, the symbol tables and the sketch engine, which the van page does not carry) |
| JavaScript | ~34 parts under `src/`, all global scope, concatenated byte for byte. The extensions sit in blocks just before the init call (sketch rounds one to three on the scene page, then round four for the van side: guided sweep, item cards, verification, reorder states, labels and deep links, activity log, count mode) and hook into the existing listeners |
| CSS | 81 KB, `src/app.css`, one `<style>` block, the same on both pages |
| Views | 21 `<section class="view">` elements, shown and hidden by a `view` string: 14 on the van page, 7 on the scene page (`data`/Settings is the one view built into both, each with page-appropriate content). Since 13 September 2026 the two pages are independent apps: `TABS_BY_PAGE` in `src/data-van.js` gives each its own short tab list — Home, Guide, Storage, Items on the van; just Scenes on the scene — and neither list names a view the other page has. There is no crossing between them; you switch by leaving the app and opening the other icon. The old Active and Scenes tabs are one list with an Open and Closed filter, and `forms` is reached only through it |
| Symbols | 142 SVG shape functions `(w, hh, o?) => string`. Area fills take the object as a third argument for pattern ids and the fill choice |
| Event handling | 6 delegated listeners on `document`, dispatching by `closest("[data-x]")` |

Runs from a local file or GitHub Pages. Lives at https://drfllcky13-droid.github.io/fsu/
(repository `drfllcky13-droid/fsu`, Pages source: branch `main`, root; a push to `main` is live
within about a minute). `install.html` beside it is the printable install sheet. Works offline. No server. Served over http it registers
`sw.js` (this site's own files only: requests to GitHub and the county aerial go straight to the network and are never cached. Since 2026.09.27.1 each request waits up to 3 s for the network, then answers from the cache and lets the network refresh it behind; a page that turns out to have changed shows "Updated" with a Reload button. Offline, Scenes falls back to `scenes.html` and FSU to `index.html`. The cache name is set only in `sw.js`; `build.js` copies it into the pages as `FSU_CACHE`. The worker's own fetches are out of reach of Playwright's routing and `setOffline`, so `fsu-tests/serve.js` takes a per-test network plan; `sw.spec.js` shows how) and can be added to the home screen; Settings › This device says how.

**Test data:** `van-backup-2026-09-04.json` — 72 items, 62 compartments, 41 items placed across
unit 1. Load it through the app's own restore (Settings › Restore or import), not by assigning to
`S`, which is a `const`. With sync connected, restore only adds what is missing and replaces
nothing; disconnect first to start over from a backup.

---

## 2. Architecture as it stands

**The page split.** `build.js` has two targets. `index.html` is the van: home, compartments and
bays, items, the sweep, the guide, the printable map and labels, restock, tidy and Settings.
`scenes.html` is the scene: the incident list, an incident and its document plan, a form being
filled in, form templates, the sketch, and its own Settings. Same origin, same path, so **same
`localStorage` — one record, nothing copied, nothing to sync between them.** A save on one page
is picked up by the other through the `storage` event listener in `src/core.js`, which takes
their version whole, gives it the same clean-up a load does (lists of records, sync settings and
bookkeeping, walls, conflicts; since 2026.09.26.2) and re-renders; do not add a merge there, and do not write a copy of
anything into the other page.

**They are independent apps, on purpose, since 13 September 2026.** Neither has a control that
opens the other: no shared tab bar, no "Quick sketch" on the van's Home, no "Storage" tab on the
scene. `src/pages.js` is the seam and is where you look first:
- `VIEWS` lists which view belongs to which page, and `PAGE` is set before it by `src/van.js`
  or `src/scenes.js` (each is one line). `"data"` (Settings) is the one view listed on both —
  everything else belongs to exactly one page.
- `here(v)` is "this page draws that view".
- `go(v)` in `src/nav.js` is a no-op when the view is not here — it used to jump to the other
  page; it no longer does, by design. If you find yourself wanting it to jump again, that is
  the crossing coming back; check with whoever owns the product decision first.
- `openFromHash()` reads `#v=<view>&ref=<id>` on load and on `hashchange` — a *direct* link into
  this page (a bookmark, a reload, a home-screen shortcut), not a hop from the other one — sets
  the matching `cur*` and `view`, and returns false if the hash names a view that is not on this
  page or a `ref` that names the wrong kind of record.
- `startSketch()` only ever runs on the scene page now; it is a no-op if called on the van
  (structurally unreachable in practice, since nothing on the van calls it).

Adding a view means adding it to `VIEWS`, to that page's body part, to that page's tab list in
`TABS_BY_PAGE` (`src/data-van.js`) if it should have one, and to that page's target in
`build.js`. `fsu-tests/tests/pages.spec.js` is the guard on all of this: it checks neither app
offers a route into the other, that a reload holds your place, that a stale or nonsense `#v=`
address cannot blank the screen, checks two open pages do not write over each other, and checks
that every view is built into exactly one page (or deliberately both, `data` only). Run it first
after anything structural.

Each page has its own manifest (`manifest.webmanifest`, `scenes.webmanifest`) and its own
`apple-mobile-web-app-title`, so a technician gets two home-screen icons; `sw.js` precaches both
pages. The two share every part of the shell — header, side nav, tab bar, sheets, toast, the
rotation gate — because they are literally the same source parts.

**State.** One object `S`, persisted to `localStorage` on every change via `save()`.
Contains `items`, `comps`, `forms`, `fills`, `sketches`, `incidents`, `walls`, plus settings.
`live()` filters `S.items` to those not marked "Not carried".

**Storage split, and it matters.**
- `localStorage` — everything above. **Hard ceiling around 5 MB**, measured, not assumed. A failed
  save now shows a red bar and keeps retrying the real store on every change; before, it fell
  silently into memory and everything after was lost on reload. `S.activity` (last 500 actions with
  initials) and `S.errors` (last 20) live in it too.
- `IndexedDB` (`vanphotos` store) — photographs and sketch backdrops, which are megabytes each.
  Referenced from state by id only. Quota is 60% of disk.
- Getting this wrong breaks saving *everything*, not just images. Do not move images back.
- Since 2026.09.26.1, Settings › This device shows a meter (`storageMeterHTML` in `chrome.js`:
  every localStorage key against `LS_CEIL`, 5 MB, plus `navigator.storage.estimate()` for the
  rest), and at `LS_WARN` (70%) Home and Scenes say so. The way to make room is **Remove closed
  cases that already have a case package** (`removableCases`, `removeCasesSheet` and `removeCases`
  in `case-package.js`). A case goes only if it is closed, a saved package held every form, sketch
  and photograph it has, and it is unchanged since: `exportCasePackage` stores `inc.pkg={at,h}`,
  where `h` is `caseFingerprint`, taken after the share sheet. Removal re-checks at the moment of
  removing. Keep those three conditions; a looser rule deletes case material that exists nowhere
  else.
- A saved record that will not read is kept, not written over (since 2026.09.28.1): `keepBad`
  in `core.js` stores its text as `van3.bad-<time>` (moving it if there is no room for a copy;
  if even that fails, nothing is saved over it until it is downloaded), `#badbar` says so, and
  Settings › This device lists kept copies with Download and Delete. The old `vaninv2`/`vaninv`
  keys are removed once `van3` has read.
- Settings › This device › Check photographs (`photoAudit` in `case-package.js`) lists
  photographs no record uses and records whose photograph is missing; only the unused ones can be
  deleted, and one an undo step refers to counts as in use. A case package records any photograph
  it could not read in `missingPhotos` and names it when it is saved.
- Safari, and every browser on an iPad or iPhone, deletes a site's storage after seven days
  without a visit unless it runs from the Home Screen. `claimStorage` asks for persistence on
  every start, and on Apple devices (`onApple()`), while the answer is no and the app is not
  standalone, `#keepbar` (above the sync bar on both pages, `renderKeepBar` in `chrome.js`) says so
  and stays. Other browsers evict only under disk pressure, so they get no bar; Settings › This
  device explains it.

**Rendering.** `render()` calls a `renderX()` per view, each rebuilding `innerHTML` from state.
No framework, no virtual DOM, no reactivity. Re-render is the only update mechanism. The sketch
view is the exception: `renderSketch` still builds one string, but `patchSketchView` splits it
into regions (`#skhead`, `#skedit`, `#skbars`, `.canvaswrap`, `#skpanel`, `#skrail`) and only
replaces a region whose markup changed, so the rail keeps its scroll and nothing flickers.

**Navigation.** `NAV` array of state snapshots. `navRecord()` runs at the top of `render()`;
back buttons call `navBack(fallback)`. Tab clicks go through `go(v)`, which clears `prevView`.

**Layout.** Three modes driven by body classes: phone (bottom tabs), `wide`, `xwide`
(side nav, and a split master/detail pane for drill-downs listed in `DETAILS`).

**Sync.** Optional, to one file in a private repo, and it **merges per record** rather than
pushing the whole file and hoping. Every item, compartment and form carries `_v` (a Lamport
counter, so a wrong clock cannot reorder anything), `_d` (the device that set it) and, when
deleted, a tombstone. Records are stamped by diffing against `S.base` at sync time, not at the
hundreds of places that call `save()` — do not add stamping to edit sites, it is deliberately
not there. Tombstones live in `S.tomb` in memory but travel inside the arrays on the wire,
shaped so an old build's own filters hide them; that is what lets a build that predates all of
this round-trip the file without corrupting it. Absence is never deletion. The losing side of a
same-record clash is kept in `S.conflicts` and offered back in Settings › Automatic saving.
`S.base` is always what the repo holds (the records pushed or pulled), never the live copy after a
request returns. One pull or push runs at a time across both pages (`navigator.locks`
"fsu-sync"), every GitHub request gives up after 20 s, a push with nothing to send makes no
commit, and a rate limit (429, or 403 with retry-after or x-ratelimit-remaining: 0) is waited out
rather than treated as a dead token. A device upgrading from the build before stamps judges its
first merge against the file it last synced (fetched by its stored blob sha), not as a new device.
**SYNC_DESIGN.txt at the repo root is the full reasoning and every failure case.**
`fsu-tests/tests/sync.spec.js` drives all of it against a stubbed GitHub.

**The map.** `src/map.js`, scene page only. Settings › Map (the `map` view) shows Williamsport's
buildings in 3D with the county address search; the sketch's Backdrop › Map drawing renders the
same data flat and to scale. It is the one part of the app that needs the network: MapLibre GL JS 6
from jsdelivr (ES modules only, hence `import()`), OpenFreeMap tiles, and
`williamsport-buildings.json` beside the pages — OSM plus Microsoft footprints with heights, rebuilt
by `py fetch_buildings.py` in `E:\Claude\Projects\Williamsport3D` and copied here. The live map
starts on the next tick and only if its view is still showing, so the render sweep and the click
crawl, which walk every view in one synchronous go, never touch the network.
Framing a map drawing is `frameMap`: a live, flat, north-up MapLibre map in a fixed, modal
overlay laid over the page area the backdrop fills. The sketch's own pinch only listens to
touches that start inside `#skcanvas`, so the two do not collide. Lock it in runs `lockMap`,
which calls `fetchPlan` at that centre and width and then `setBackdrop`. Every address backdrop
goes through `setBackdrop`: the map lock, the aerial and See more / See less (`reframeBg`).
`moveDrawing` carries the objects, the scale and every undo and redo snapshot from the old frame
to the new, as a zoom plus a shift, with the legend and north arrow excepted. Snapshots do not
carry `sk.bg`, so leaving history alone would undo old positions onto the new image.
MapLibre's `.maplibregl-map{position:relative}` lands on its container and overrides a
one-class `position:absolute`. That collapsed the live map to nothing once; `.mfbox .mfmap`
needs its two classes.

**Offline, all of it.** Since 2026.09.22.1 nothing the app needs comes from another site except
the county aerial imagery. The PDF, Word, QR and map libraries and the map's font are in `lib/`
(see `lib/SOURCES.txt`). The map data sits beside the pages as `williamsport-*.json`. Settings ›
This device › Download for offline use (`OFFLINE` and `offlineDownload` in
`src/views-items.js`) puts every one of those files into `sw.js`'s cache (`FSU_CACHE`, named in `sw.js`), and the
worker serves them back when there is no network. The list and `lib/` have to move together;
`map.spec.js` fails if the list names a file that is not there. `lib/SOURCES.txt` gives the version, source and SHA-256 of every file in `lib/`;
`libs.spec.js` fails if a file is added, removed or changed without it. Since 2026.09.29.1 jsPDF is
4.2.1 and svg2pdf 2.8.1 (2.5.1 had published advisories, and svg2pdf 2.2.4 only works with jsPDF 2). The download records the app
version it was made with, so Settings can say when to fetch again. `fsu-tests/serve.js` has to
serve `.mjs` as JavaScript or MapLibre will not load under test; GitHub Pages already does. A
preview server started before that fix kept serving the old type until it was restarted.
Address search (`findAddress` and `addrLoad` in `src/sketch-canvas.js`) reads
`williamsport-addresses.json`: the city's county address points plus OSM street crossings. The
Williamsport3D project rebuilds all three data files (`fetch_buildings.py`, `fetch_basemap.py`,
`lidar_heights.py`).

**Incidents, sketches, filled forms and photographs are
deliberately excluded** from both sync and backup — that is case material and it stays on the
device. Since 2026.09.24.1 the backup (`backupOut`) is a fixed list of van fields (items,
compartments, form templates, walls, the demo flag, the unit name), so the activity log, handover
notes, saved sketch templates, errors and sync conflicts stay out too; add a field to that list
only if it is van data. Deleting an incident also removes its sketches' `fsu-undo-<id>` keys,
and Scenes clears any undo key whose sketch is gone when it opens. Keep that. The only way case material leaves the device is a **case package** (Settings › Case packages,
or Scene › Save a case package): one JSON file with incidents, forms, sketches and photographs,
shared to Files. The same view restores one. Restoring never silently replaces anything: an
incident, filled form, sketch or photograph already here with different contents is listed in a
sheet with Keep mine (the default, and what closing the sheet does), Use the package's, and Keep
both (a copy with new ids; `copyOf` names the original). Identical records are skipped. A sketch
nags after six hours of changes with no package.

**Data from outside, and the Content-Security-Policy.** Since 2026.09.25.1 everything that comes
from outside the device is checked on the way in, in `core.js` (`cleanVan`, `cleanCase`,
`cleanSketchParts`): the synced file (in `ghGet`, before merging), a restored backup or CSV
(`ingest`), a case package (`importCasePackage`) and stored sketches (`repairSketch`). Record ids
and compartment codes match `/^[\w-]{1,64}$/`, geometry and coordinates are finite numbers,
images are base64 `data:image/` URLs and links are http(s). A record that fails is left out or
repaired, and each is listed once under Settings › Recent errors (`noteBad`); one bad record
never stops the rest. On the way out, `esc()` escapes `& < > " '` and every record id in an
attribute goes through it. Both pages carry a CSP meta tag whose `script-src` names the one
inline script by its SHA-256, which `build.js` computes, so an injected `<script>` or `onerror=`
cannot run. Keep to one inline `<script>` per page, no inline event-handler attributes, and no
other site beyond the two in `connect-src` (`api.github.com`, `imagery.pasda.psu.edu`) without
changing the policy in `src/head.html` and `src/head-scenes.html`; `fsu-tests/tests/csp.spec.js`
runs every feature that loads a library or fetches something under the policy.

---

## 3. Conventions worth preserving

- **Symbols** are `(w, hh) => svgString` using classes `k-fill`, `k-stroke`, `k-thin`,
  `k-thick`. Every symbol is plan view (seen from above). Vehicles are landscape, filled
  silhouettes with white cut-outs for glass. Ten symbols that fell short of the traced set were
  redrawn on 4 September 2026 in a block right after the `SHAPES` table (SUV, van, motorcycle,
  bicycle, scooter, dumpster, blood transfer, blood wipe, print lift, pry mark); the originals
  above it are dead and marked as such. Body moved from Markers to Evidence and the single key
  moved to Belongings. SUV and van changed from portrait to landscape, so any sketch made before
  that day with either symbol will show it squashed until it is re-placed; no real sketches existed.
- **The van thumbnail** on the Storage cards is an inline SVG side profile (`vanSVG`, classes `vs-*`)
  inside the existing `.vanwrap` and `.vanbody` boxes, so the mirroring for driver-side bays and the
  compartment overlay grid are unchanged. The overlay maps to x 48 to 249 of the 255-wide drawing;
  keep those bounds if the drawing changes. Before this it was a CSS-clipped box.
- **The bay wall** (`renderBay`) keeps the wall's true proportions (`aspect-ratio: cols/rows`) and zooms
  by layout width inside a scrolling box, so container queries reveal names as tiles grow. Pinch,
  ctrl-scroll and the bar all call `bayZoomApply`. A tap on a tile previews it in `#baypop` and
  highlights its list row; a second tap opens it. In the desktop split pane the header drops the van
  thumbnail for a Sweep-this-bay button. Unnamed bins are dashed; empty ones say so.
- **Home is one template for every size** (`renderHome`): a header line (unit, date, initials, sweep
  state), four status tiles that only take colour when something is wrong, then a two-column grid
  (`.dash2`, one column under 1000 px): Scenes with the open list, Next actions (which absorbs the
  setup checklist, export and case-package nags, and the sync-token warning), Needs attention,
  Units, Quick find, Settings. `setupCard`, the old `.dashfixed` grid and the phone strip are no
  longer used by Home. Tile and row taps go through the existing `data-list`, `data-go`,
  `data-inc` and `data-item` handlers; `data-caseall` saves a package of everything.
- **Scenes, Guide, Storage and Items** open with the same header line and four status tiles
  (`scenesHead`, `guideHead`, `storageHead`, `itemsHead`, built on `tabHead` and `tabTiles`).
  Tiles reuse existing handlers; the Guide tiles and chips set `guideFilter`, which filters the
  grouped list. Settings keeps its menu-and-sections layout. Never hardcode colour — those classes read `--kc`, which carries the object's ink
  and the light/dark theme. Fractions of `w`/`hh` only, never fixed numbers, or resizing warps.
- **Linear symbols** (fence, road, baseline, tiretrack, stairs) compute repeat count from a
  fixed pitch so stretching adds detail rather than scaling it. Keep that behaviour.
- **Voice.** Plain sentences, no jargon, no exclamation marks. Warnings state the consequence
  ("nothing can be reported low"), not just the fact. Never write in the developer's voice —
  there was an "I'll set them for you" string in the app for a while and it was wrong.
- **Court-facing output** must not look more authoritative than it is. The bundle cover says
  "This bundle is a copy assembled from the unit's records. The case file remains the record."
  Do not add seals, watermarks, or auto-generated summaries of contents.

---

## 4. Known-fragile parts

**These caused real bugs today. Test them specifically after any refactor.**

1. **Duplicate delegated handlers.** Several near-misses where two listeners matched one click:
   the first navigated, the second saw the *new* state and navigated again. Back buttons now
   call `stopPropagation()`. Any new global listener risks reintroducing this.
2. **Removing "dead" code.** Twice, code that looked unreachable was live. Deleting the old
   layer-rename handler took the object-options sheet with it. Grep for the `data-` attribute
   before deleting its handler.
3. **`getBBox()` ignores the element's own transform.** Measuring symbols through the element
   itself gave bounds 10× too large and every traced symbol rendered tiny. Measure through a
   parent wrapper.
4. **Two stylesheets.** The app's `<style>` and a separate inline one inside the PDF export
   string. Anchoring a CSS insert to the wrong one silently does nothing.
5. **Two headers.** The sketch title block is drawn twice — SVG for screen, jsPDF for export.
   They are separate code and have drifted before.
6. **The symbol tables** (`SYM`, `VEH`, `FURN`, `WPN`, `SHAPES`) are now `src/sketch-objects.js`,
   about 200 KB of path data, and they are on the scene page only. Anything on the van page that
   reaches for `SHAPES` will find it undefined — the render sweep already does, silently.
7. **Hooks.** New sketch behaviour is reached through calls placed inside the existing listeners:
   `sketchExtraClick2` then `sketchExtraClick` (click), `extraPointerDown2` then
   `extraPointerDown`, the same for move, and `extraPointerUp`. Round two adds capture-phase
   pointer listeners for pinch only, a `wheel` listener, a `change` listener for typed sizes and a
   second `keydown` for zoom keys — none of them click. Adding another click listener is how the
   duplicate-handler bug comes back.
9. **Zoom is a viewBox.** `ZOOM` holds scale and offset; `canvasPt` maps through it and handles
   are sized in screen pixels via `handleU()`. Export ignores it. Anything that reads pointer
   position must go through `canvasPt`.
10. **`openSheet` adds its class on the next frame.** `closeSheet` before that frame is now
   honoured (the frame checks the scrim is still on). Sheet buttons that start a canvas mode rely
   on this.
11. **`objSVG` is a guard** around `objSVGRaw`. A throwing symbol draws a red placeholder instead
   of blanking the sketch, and `repairSketch` runs at the top of `renderSketch`.
12. **Uncaught errors are logged** to `S.errors` (last twenty, shown under Settings › Recent errors) with a
   toast. Do not let that become a reason to leave errors in.
13. **Canvas modes** are plain globals: `PLACE`, `polyDraw`, `measPick`, `layerMove`, `inkDraw`,
   `multi`. Each has a bar above the canvas and Escape clears it. The pointer hooks check them in
   round-three-first order; a new mode goes at the front of `extraPointerDown3`.
14. **`appExtraClick` runs first** in the main click listener, before the back button. It owns
   every `data-` attribute added in round four and intercepts `data-check` when a compartment
   holds regulated stock that has not been counted today.
15. **Deep links.** `#c=CODE`, `#i=ID` open a compartment or item; `handleHash` (ext-van.js) reads
   them on load (`setTimeout(handleHash,80)`) and on `hashchange`, then clears the hash. It is
   shared code and runs unconditionally on *either* page — a printed QR label always encodes the
   van's own address (`appUrl()` at the time the label was printed, from Settings › Labels, which
   only exists on the van), so in practice it only ever fires on the van, but a hand-typed or
   bookmarked `scenes.html#c=…` would reach it too. `openTarget` therefore checks `here()` before
   acting on any kind — `c`/`i` toast "open it in the FSU app" and `s`/`inc` toast "open it in the
   Scenes app" if asked for on the wrong page, rather than setting `view` to something the current
   page has nothing to draw into (which used to leave the screen blank with the old `.on` class
   already cleared off it).
   These are a *second*, older hash scheme, separate from the `#v=<view>&ref=<id>` one that
   `src/pages.js` uses to open a direct link into a page.
18. **Landscape only.** `applyRotLock` (ext-reports.js) puts `rotlock` on `body` when `landscapeOnly()`
   (default: iPad-like user agent, else `S.landscapeOnly`) and the screen's short side is 700px or
   more; `#rotgate` then covers everything in portrait. iPadOS ignores `screen.orientation.lock` and
   the manifest orientation, so the gate is the real mechanism there.
17. **Sketch layout.** The object panel (`#skpanel`, the `.objset`) renders at the top of `.skrail`, so
   it is under the canvas on a phone and beside it on any `xwide` layout (two columns from 1000px,
   iPad landscape included). `o.lockR` locks an object's rotation: no rotate handle, no rotate buttons,
   typed rotation refused. `placeStart` and any tool hook clear `inkDraw`, so picking a symbol ends
   freehand. `DETAILS` is empty: every page is the main screen (the split-pane code in `render` stays
   but never fires). `applySideMin` folds the side bar while sketching on `xwide` under 1241px.
16. **The settings page is a menu.** `renderData` draws `settingsMenu()` when `SET_SEC` is null and
   `settingsSection(SET_SEC)` otherwise; `openSettings(sec)` lands on a section from anywhere
   (Home uses `data-gosec`). Control ids (`#ghconnect`, `#dlj`, `#wipe`, `#whoin`…) are unchanged
   and their delegated handlers still apply; a handler that calls `renderData()` keeps the section
   open. `foldData` in ext-van.js is no longer called.
8. **Two stylesheets, still.** Measurement lines and area fills have classes in both the app
   `<style>` and the PDF export string. Add to both or the print loses them.
18. **Web Mercator is not ground.** A box `m` Web Mercator metres wide covers `m × cos(latitude)`
   of ground, about 0.75 here. Until 2026.09.21.1 the county aerial asked for the unstretched box,
   so every aerial covered a quarter less ground than its scale said. `fetchAerial` now divides by
   `cos(lat)`, and `planZoom` sizes the map drawing the same way; `fsu-tests/tests/map.spec.js`
   checks both, the drawing against MapLibre's own projection. Both are within 0.15% of the WGS84
   ellipsoid. That spec blocks the service worker, because the worker makes the fetches for this
   site's own files itself, out of `page.route`'s reach. (Since 2026.09.24.1 it no longer touches
   the county aerial or GitHub; those go straight from the page.)

---

## 5. The sweep — do not drop this

Every change today was checked by a script that, at **1500 / 1194 / 393 / 320 px** and in
**both colour schemes**:

- renders every view on the page it is run on and fails on any thrown error or console error
- renders every symbol at 5 sizes each, failing on `NaN`, `undefined` or empty output
- checks horizontal overflow is 0
- checks no touch target is under 40 px
- checks for duplicate `id`s, unstyled classes, unbalanced CSS braces
- checks every `data-` attribute in markup has a handler

It caught roughly a dozen bugs that reading the code did not. The original script was not in
the handoff; a rewrite is in `sweep.js` beside this file, and `fsu-tests/` runs it in Chromium at
all four widths in both schemes plus the sketch flows (`npm ci`, `npm run install-browser`,
`npm test`; `@playwright/test` is pinned exactly and the lockfile is committed). Run it before and after every change.

It walks the `section.view` elements of whatever page it is loaded on, so since the split a run
against `index.html` sees the van's 14 views and no symbols (`SHAPES` is only on the scene page),
and a run against `scenes.html` sees the other 6 and all of the symbols. `fsu.spec.js` currently
points it at `index.html` only — the click crawl and the layout audit in `ui.spec.js` do cover
both pages. Pointing the sweep at both is the obvious next thing to do to the suite.

---

## 6. First refactor, in order

1. **Split the file.** Done. `app.js` no longer exists: it was cut into a dozen parts along its
   own section boundaries, the parts both pages need were lifted into `core.js`, `chrome.js`,
   `incidents.js` and `case-package.js`, and the whole thing then became two pages. `src/` holds
   34 parts that `node build.js` concatenates byte for byte into `index.html` and `scenes.html`;
   CI refuses a commit whose built pages disagree with `src/`. No bundler, no modules, no build
   step beyond concatenation and the CSP hash of the joined script — keep it that way.
2. **Move the symbol tables** into data files. Done: `src/sketch-objects.js`, scene page only.
3. **CI.** `.github/workflows/fsu.yml` runs the build check and the suite on every push.
   Pages needs no workflow: it serves the branch. Do not add a `deploy-pages` workflow unless the
   Pages source is switched to GitHub Actions in the repository settings, or every push goes red.
4. **Then** touch behaviour.

---

## 7. Feature backlog

The September 2026 survey (see `sketch-tool-comparison.md`) listed what FARO Zone 2D, Leica
Map360, Easy Street Draw and Crime Zone had that FSU did not. Most of it is now built:

- **Baseline and triangulation entry.** Measure button, or Place by measurement on any object.
  Two fixed points and two tape distances place the object. The measurement prints as a table
  in the PDF and as dashed lines on the sketch (Measurement lines toggle).
- **Walls by dimension.** A room from width and depth, or a run of walls with turns. Typed
  width, depth, length and rotation on every object. Corners overlap by half a thickness so
  they meet cleanly.
- **24 line types.** Guardrail, railroad, skid mark, centre and edge lines, curb, sidewalk,
  scene tape, property line, footprints, blood trail, path of travel and so on. All repeat at
  a fixed pitch when stretched.
- **Area fills.** Hatched boxes and ovals, grass, water, concrete, gravel, tile, wood, brick,
  blood pool. Outline an area by tapping its corners; drag the corners afterwards.
- **Templates.** Six standard layouts plus save-your-own. Saved templates (`S.sktpl`) stay on this
  device: they are not synced and, since 2026.09.24.1, not in backups either. The Templates sheet
  says so, and still asks for layouts rather than real scenes, because a template outlives the case.
- **DXF export.** R12 DXF with one CAD layer per sketch layer, in real units when the sketch
  has a scale. Symbols go across as outlines with their names.
- **Print at a fixed ratio** on Letter, Legal or Tabloid, so a ruler works on the paper.
- **Copy and paste style, favourites and recents** in the palette, and a screen-only grid.

Round two, built the same day for speed on the iPad and for durability:

- **Pinch zoom and pan**, ctrl-scroll on a desktop, plus and minus keys, a zoom bar on the
  canvas. Handles are sized in screen pixels so they stay grabbable at any zoom.
- **Tap to place.** Tap a symbol, then tap the page. **Marker mode** places the next number on
  every tap. The palette also opens as a sheet on phones so the page stays in view.
- **Toolbar grouped** into Draw, View and Scene; the bar is seven buttons at most.
- **Measure by tapping** the two fixed points instead of picking from a list, and a third
  method, **distance and bearing**, for total-station style notes.
- **Move everything on a layer** from the layer's options.
- **Saving that fails says so** and keeps retrying. A **red placeholder** replaces an object that
  will not draw. **Damaged values are repaired on load** and sketches carry a schema version.
- **Case packages** carry sketches, forms and photographs off the device and back.
- **Rough or finished** printed in the title block.

Round three, for a glitch-free feel:

- **Only what changed redraws**, so no flicker and no lost scroll. **Every uncaught error** shows a
  toast and is listed under Settings. **Installable** with a service worker for guaranteed offline.
- **Freehand ink** with the Pencil, palm rejection once a Pencil is seen. **Camera** straight from
  a photo point. **Live distances** while a measured object moves; the record follows the drop.
- **Select several** by tapping or dragging a box, then move, recolour, duplicate or delete.
- **Rotation snaps** to right angles on touch. **Saved** tick on every save. **Undo survives a
  reload.** **How to sketch a scene** in five steps under Draw. The Scene group is now Setup.

Round four, the van side:

- **One vocabulary.** Home, Scenes, Guide, Storage, Items, the same on the side and the tabs.
  Scenes is one list, open or closed.
- **Home leads with the urgent thing**, and a setup checklist shows what a new unit still needs.
- **The sweep walks itself**: by bay, with names, next unchecked, Swept-and-next, scan a label.
- **Items on a phone are cards** with a count you tap. **Count mode** walks every compartment.
- **Guide verification** confirms each set of instructions with a date and initials.
- **Reorder** has Ordered and Received states, and the sent list leaves out what is on order.
- **Reagents** carry lot, received and opened. **Regulated stock** is counted before a sweep mark.
- **QR labels** for compartments and items open the app at the right place; an in-app scanner
  where the browser has one. **Initials and an activity log** under Settings.

Still not built, in priority order:

1. **Wall joining** when dragging existing walls by hand (typed runs already meet).
2. **Vector PDF** instead of the rasterized sketch, for sharper court prints.
3. **A per-item photograph** for the guide, so a new officer recognises the kit.
4. **User-defined line types** and hatch patterns; **DXF import**.
5. **The file split** from section 6. Four extension blocks now.
6. **RMS integration.** Non-technical; see section 8.

**Not worth building:** point clouds, trajectory cones, body posing, animation. Map360 Pro and
FARO Zone 3D do these and the unit already owns a FARO.

---

## 8. On the desktop-app question

Nothing in the backlog above requires it. The storage argument ended when photographs moved to
IndexedDB. Tauri or Electron wraps this same codebase later without a rewrite, so the decision
stays cheap.

Two things would force it, both non-technical: **IT policy** forbidding case material in a
browser app, or a requirement to **integrate with EFORCE or the RMS** directly. Establish those
before writing code.

---

## 9. Still untested by a real user

Be sceptical of all of this — it is one sweep old.

- The measurement entry, wall tool, line types, area fills, templates and DXF export were
  built and swept on 4 September 2026 against a test sketch only. No DXF has been opened in
  real CAD software yet; try one in FARO Zone before relying on it.
- Round two (same day): pinch zoom and pan, tap to place, marker mode, grouped toolbar, symbols
  sheet, measuring by tapping the points, distance and bearing, layer move, save-failure bar,
  render guard and repair, case packages, rough or finished sketch. Pinch was tested with
  synthetic pointer events only — try it on the iPad. Case package restore was tested with a
  package that had no photographs.
- Round three (same day): render split, error log, home-screen install, Setup rename, rotation
  snap, freehand ink with Pencil-only palm rejection, camera from a photo point, live distances
  with the record following a drop, select several, saved tick, undo across reloads, a
  first-sketch guide. The Pencil path was tested with synthetic pen events; the service worker
  was tested on localhost only; the camera button was not tested on a device.
- Round four (same day, the van side): one vocabulary and one Scenes list, home tiles by urgency
  with a setup checklist, a guided sweep by bay with names and a next button, item cards with
  tap counts on phones, a guide verification pass, ordered and received states on the reorder
  list, lot and received and opened dates on reagents, a count check on regulated stock before a
  compartment can be marked swept, QR labels with deep links and an in-app scanner, initials and
  an activity log, a folded data view, and a count mode. The QR encoder is loaded from `lib/` the
  first time labels are printed. The scanner was not tested on a device.
- Round ten (same day, reports and upkeep): wording snippets on narrative fields (`S.snippets`,
  seeded once), auto-fill from the incident including `S.whoName`, a Photograph log stock form
  fed by `syncPhoto` (STOCKV bumped so existing installs get it), Word export built by hand as
  OOXML through JSZip, a vector option for the sketch PDF through svg2pdf with computed styles
  inlined and a raster fallback, `APP_VERSION` on every export, a weekly vehicle check
  (`S.vehicleChecks`), part numbers on items and the reorder list, a handover note on Home
  (`S.handovers`), service and calibration on durable kit, a help sheet with the change log.
  The Word file was checked for a valid zip and structure, not opened in Word; open one.
- **Sample case.** `fsu-tests/sample.js` builds a complete incident (entry log, evidence log, photo
  log with placeholder photographs, sketch with measurements and photo points, report) in a fresh
  browser and saves every export to `sample-2026-0912/`; `fsu-tests/pdf2png.js` renders any PDF
  to page images through pdf.js. Use them to eyeball output after a change. Fixes found this way:
  measurement table rows no longer overlap or split across pages, captions stay upright on rotated
  photo points, long fields keep their line breaks in the PDF, the photo log is in the bundle order.
- **Bundle order** is report, entry log, evidence log, sketch, photo log. The photograph index page
  is switched off (`BUNDLE_PHOTO_INDEX=false`; the code is kept). The photo log prints each row
  with a thumbnail of the photograph attached to the matching photo point (`photoThumbs`,
  `photoRowsPDF` in the PDF export); rows without an attached copy get a dashed placeholder. Pictures print at 240 by 180 points, so a log runs two photographs to a page.

- Incidents, bundles, photo points and layers have **never been used on a live scene**.
- Only unit 1 of 4 has been inventoried. 19 compartments in unit 2 are still unnamed.
- The reorder list has never been handed to anyone who orders stock.
- The bundle has never been given to whoever receives it. Its order and cover are a guess and
  should be expected to change.
