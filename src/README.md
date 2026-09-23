# Source parts

`index.html` (FSU, the van) and `scenes.html` (Scenes) are built from these parts by
`node build.js` in the folder above. `build.js` lists the order in `TARGETS`: each page is its
own head and body part, then the shared parts, then its own. The parts are joined byte for byte;
the only other thing the build does is put the SHA-256 of the joined inline script into the
page's Content-Security-Policy.

| Part | Page | What it holds |
|---|---|---|
| `head.html`, `head-scenes.html` | own | doctype, meta (including the Content-Security-Policy), icons, manifest, the opening `<style>` |
| `app.css` | both | every style rule, app and print |
| `body-van.html`, `body-scenes.html` | own | the closing `</style>`, the shell markup, that page's views, the opening `<script>` |
| `van.js`, `scenes.js` | own | one line: which page this is (`PAGE`) |
| `data-van.js` | both | the van's tables: compartments, walls, stock forms, guide items, tabs |
| `core.js` | both | the record `S`, storage, `save()`, `esc()`, shared helpers, and the checks on data from outside (`cleanVan`, `cleanCase`) |
| `chrome.js` | both | sheets, the photo store (IndexedDB), theme and layout, save status, the error log, the service worker |
| `pages.js` | both | which view belongs to which page, direct links (`#v=`) |
| `incidents.js` | both | incidents, filled forms, the activity log |
| `case-package.js` | both | the save-failed bar, case package export and import |
| `demo.js` | both | the sample van |
| `sync.js` | both | GitHub sync (SYNC_DESIGN.txt at the root is the design) |
| `nav.js` | both | navigation and history |
| `views-van.js`, `views-forms.js`, `views-items.js` | both | the views |
| `events.js` | both | the delegated event listeners |
| `ext-van.js`, `ext-tabs.js`, `ext-reports.js` | both | round four (van side), tab headers, reports and upkeep; `APP_VERSION` and the in-app change log are in `ext-reports.js` |
| `pdf.js`, `pdf-sketch.js` | Scenes | PDF export and bundles |
| `sketch-objects.js` | Scenes | the symbol tables, about 200 KB of path data |
| `sketch-canvas.js`, `sketch-controls.js`, `map.js` | Scenes | the sketch engine and the map |
| `ext-sketch-1.js`, `ext-sketch-2.js`, `ext-sketch-3.js` | Scenes | sketch rounds one to three |
| `init.js`, `init-scenes.js` | own | the lines that start the page |
| `tail.html` | both | the closing tags |

Edit the part, run `node build.js`, and commit the parts and both pages. CI runs
`node build.js --check` and refuses a commit whose pages do not match `src/`. HANDOFF.md at the
root describes the architecture and the rules to keep.
