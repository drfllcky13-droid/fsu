# FSU checks

```
cd fsu-tests
npm ci
npm run install-browser
npm test
```

`@playwright/test` is pinned to one exact version in `package.json`, and `package-lock.json` is
committed. `npm ci` installs exactly that, and `npm run install-browser` then fetches the browser
builds that version expects; CI does the same. To move to a newer Playwright, change the version in
`package.json`, run `npm install` to rewrite the lockfile, and commit both.

The run ends with every failed test, and every test that passed only on a retry, named again
under "failures", and the same list goes to `last-run.txt` (`failures-reporter.js`), so a one-off
failure can be traced even when the output was cut short. CI prints that file as its last step.

`npm run lint` runs ESLint over each built page's script (`lint.js`; three rules: `no-undef`,
`no-unused-vars`, `no-use-before-define`). Findings name the `src/` part and line. The suite runs
it too (`lint.spec.js`), and CI runs it as its own step. Deliberate exceptions live in
`lint-allow.json`, each with its reason; an entry that no longer matches anything fails the lint.

Tools beside the suite: `sample.js` builds a complete sample case and saves every export to
`../sample-2026-0912/`; `pdf2png.js <file.pdf>` renders a PDF's pages to PNG with the pdf.js in
`vendor/pdfjs/` (no network); `mutate.js [n] [seed]` breaks one line in a `src/*.js` part at a
time, rebuilds, runs the suite and lists the breaks nothing caught (one suite run per mutant).
A test written to catch one of those breaks goes in `tests/mutants.spec.js`, with the line it
guards and the mutation that survived before it.

`serve.js` serves the folder above, so a spec opens a page by name: `/index.html` is the van,
`/scenes.html` is the scene. They are the same app and the same `localStorage`, so a spec that
seeds a record on one page can open the other and find it there; `/scenes.html#v=sketch&ref=new`
opens straight into a new sketch, which is how every sketch spec starts.

**The split itself** is `pages.spec.js`: that neither app offers a route into the other (no
control anywhere on the van reaches Scenes, none on Scenes reaches the van, and each keeps its
own Settings), that a document row on an incident still opens same-page (a sketch row, a form
row, the document tabs), that a reload holds your place, that a stale or nonsense `#v=`/`ref=`
address — or the older `#c=`/`#i=`/`#s=`/`#inc=` scanned-label scheme landing on the wrong page —
opens on something rather than a blank screen, that two open pages do not write over each other's
record, that every view is built into exactly one page (Settings only, deliberately, on both) and
`src/pages.js` agrees, and that both manifests and both pages are cached and open offline.

**On the van page.** The render sweep (`../sweep.js`) at 1500, 1194, 393 and 320 px wide in
light and dark. Offline (the network is cut and the app still opens and keeps what was entered),
keyboard (focus moves, is visible, and stays inside a sheet), print (the map, the labels and the
install sheet fit a letter page), storage (localStorage filled to the quota raises the red bar
and loses nothing), the record lint (`data-lint.spec.js`: no compartment code used twice, no item
in a compartment that does not exist), bulk (600 items and 40 sketches at quarter speed against a
200ms budget), and contrast.

**On the scene page.** The sketch flows in Chromium: measurement maths, walls by dimension, tap
to place, marker mode, outlining an area, freehand ink, marquee selection, layer move, DXF and
PDF export, the save-failure bar, the render guard and repair, case package round trip, and undo
after a reload. With them: the geometry checks (`sketch-geom.spec.js`), the old-marker migration
(`marker-migrate.spec.js`), the clock rules (`clock.spec.js`), the model-based random run
(`model.spec.js`), migration of old store keys, and sync against a stubbed GitHub (a clash is
reported, never silently resolved).

**Both pages.** The click crawl (`../crawl.js`) at 1500 and 834 px presses every control in every
view and one level into any sheet a control opens; the layout audit (`../visible.js`) runs at
1500, 1280, 1194 and 834 px in both schemes, looking for anything outside the window, clipped,
covered or too small to tap. `ui.spec.js` runs each of those once against the van and once
against the scene. Both print what they found; tap size is reported, not asserted. Controls that
delete, export, send or sign are named, not pressed. The delete paths (`destructive.spec.js`) and
the text-and-token guarantees (`security.spec.js`) also cover both pages, and the corruption
cases (`corrupt.spec.js`) load each damaged record on whichever page the damage belongs to.
The picture baselines (`visual.spec.js`) take Home, Storage and Items on the van and the incident
list, an incident and a sketch on the scene; they are skipped on CI, where another machine's font
rendering would fail every run.

The crawl and the layout audit run twice, once in Chromium and once in WebKit, which is the
engine the iPad runs. Everything else stays on Chromium. Widths are the two machines it is used
on: 1500 and 1280 for a desktop, 1194x834 and 834x1194 for an iPad either way up.

See ../test-tool-ideas.txt for what each one covers and what it found.

Run it before and after any change to `index.html` or `scenes.html` — that is, after any
`node build.js`. A failing sweep names the view, symbol or attribute; a failing flow names the
step; a failing crawl or layout run names the page it was on.
