# FSU checks

Runs the render sweep (`../sweep.js`) at 1500, 1194, 393 and 320 px wide in light and dark, then
drives the sketch flows in Chromium: measurement maths, walls by dimension, tap to place, marker
mode, outlining an area, freehand ink, marquee selection, layer move, DXF and PDF export, the
save-failure bar, the render guard and repair, case package round trip, and undo after a reload.

```
cd fsu-tests
npm install
npm run install-browser
npm test
```

It also runs the click crawl (`../crawl.js`) at 1500 and 393 px, pressing every control in
every view and one level into any sheet a control opens, and the layout audit
(`../visible.js`) at the four widths in both schemes, looking for anything outside the
window, clipped, covered or too small to tap. Both print what they found; tap size is
reported, not asserted. Controls that delete, export, send or sign are named, not pressed.

The crawl and the layout audit run twice, once in Chromium and once in WebKit, which is the
engine the iPad runs. The sketch flows stay on Chromium. Widths are the two machines it is
used on: 1500 and 1280 for a desktop, 1194x834 and 834x1194 for an iPad either way up.

The offline checks cut the network and prove the app still opens, that work done offline
survives a reload, and that every file the page asks for is cached. The contrast check
prints every piece of text under WCAG AA in both schemes and never fails the run.

Run it before and after any change to `index.html`. A failing sweep names the view, symbol or
attribute; a failing flow names the step.
