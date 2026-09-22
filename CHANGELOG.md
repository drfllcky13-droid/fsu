# FSU change log

## 2026.09.21.1
Scenes has a map. **Settings › Map** shows every building in Williamsport, South Williamsport
and Duboistown in 3D. Search an address the same way as for a backdrop and the map flies there
and drops a pin; tap a building for its height. Buildings come from OpenStreetMap and Microsoft,
and most heights are Microsoft's estimates from aerial imagery, so read them as rough. The map
needs a connection the first time it opens.

The sketch backdrop can now be a **map drawing** instead of the aerial photo: the same address
search and the same choice of width, but streets and building outlines, north up and to scale.
It stays sharp at any size, and the credit line under the sketch says where it came from.
The map drawing is the first choice now; the aerial is one tap away.

Pick the address for a map drawing and the map opens right on the sketch page, over the area
it will fill. Pinch and drag it until it is right, then tap **Lock it in**: that view is drawn
to scale across the page under the title block, and you sketch on top of it. **Backdrop › Move
or zoom the map** opens it again later, and whatever you have drawn moves with the ground, so
every object stays on its spot at its true size. The legend and the north arrow stay where they
are, and undo still works across it. An aerial photo has **See more** and **See less** instead.

Fixed: on a sketch with no title block yet, the aerial slid under the title block that
placing it brought in.

Fixed: the county aerial was about a quarter too small for the distance it claimed. An aerial
set to 320 ft across covered about 240 ft of ground, so any distance measured over it read about
a third too long. New aerials are right. A sketch that already has an aerial keeps the old scale:
check any measurement that was taken from the photo rather than typed in.

## 2026.09.12.7
FSU and Scenes are now genuinely separate apps, not two pages that happened to share a tab bar.
The van no longer has a Scenes tab, and Home no longer offers Start an incident or Quick sketch —
that work happens in the Scenes app. Scenes no longer has Home, Storage, Guide or Items — those
are the van's. Each has its own Settings: FSU's covers automatic saving, backup and labels;
Scenes' covers case packages, form templates and report wording. Each has its own Help.

They still share one set of records — a sweep logged on one shows up on the other, and nothing
has to be sent between them — but there is no button, tab or link from inside one into the other
any more. Switching means going back to the home screen and tapping the other icon, the way any
two separate apps work.

## 2026.09.12.6
The van and the scene are now two icons on the home screen. **FSU** is the van: Home, Storage,
Items, the sweep, the guide, the printed map and labels, restocking and Settings. **Scenes** is
the scene: the incident list, the documents an incident needs, filling a form in, the templates
and the sketch. Put both on the home screen and the sketch opens from its own icon instead of
through the van.

It is still one app and one set of records. A sweep logged on one icon is there on the other the
next time you look, nothing is copied and there is nothing to send between them. The tabs down
the side are the same on both, so tapping Scenes, or Home, goes where it always did; you do not have
to know which icon you started from.

The scene half no longer has to load with the van half, so the van opens quicker on an older
iPad. Nothing was renamed, nothing moved, and nothing behaves differently once you are in it.

## 2026.09.12.5
Measuring to or from an evidence marker used the middle of its card instead of the spike at the
bottom, so every such measurement was out by about half the marker height — roughly 2 ft 7 in at
100 units to 10 feet, always in the same direction. Measurements now use the spike, which is where
the tape is pulled to and where tapping already placed it. An existing sketch is put back onto its
recorded tape distances the first time it opens; the recorded distances themselves are never
changed. A sketch exported before this will not match one exported after it.

Changing the scale, or flipping to portrait, left measured objects drawn where they were while the
table printed the old distances. Duplicating an object copied its measurement and shared its
photograph, so deleting one copy's photograph destroyed the other's. Walls typed by dimension took
the lengths as centrelines when a tape reads the inside face; there is now a choice, set to inside.
A real length typed as 12 feet 6 inches in the scale sheet became 12.

Undo covers the whole sketch now, not just its objects: deleting a layer and undoing it brings the
layer back with its name, and scale, portrait and rotation lock are undoable. Arrow-key nudges are
undone as one gesture instead of not at all. Nothing can be dropped into a locked layer any more.

## Unreleased — sync merges instead of choosing a side
Two devices that changed different things no longer fight. Saving to GitHub now reads the
shared file, merges it into this device item by item, and writes the result, so two people
working at once — or a device that has been out of signal for a week — both keep their work
with nobody being asked anything. Deletions carry across properly instead of quietly coming
back, and an iPad still running an older build cannot damage any of it.

When two devices did change the *same* item, one of them has to win. The app picks, the same
way on every device and without consulting the clock, and keeps the other version under
Settings › Automatic saving with a **Put mine back** button. Nothing is thrown away.

Connecting a device is shorter: owner, repository, token, and no more being asked which copy
of the data survives. The token's expiry comes from GitHub instead of being typed in. A token
that has lapsed now says so plainly, stops retrying, holds everything typed since, and offers
a Reconnect button that asks only for the new token. A file in the repo that will not open is
reported and never written over.

Scene material — incidents, filled forms, sketches, photographs — still does not sync, on
purpose. SYNC_DESIGN.txt at the repo root says why, and covers every failure case.

## 2026.09.12.4
The interface is quieter. One spacing and type scale runs through every panel, row, tile and
button instead of each carrying its own numbers; panel headers are captions rather than filled
grey bars; the unit cards on Home are flush rows; a stat tile only carries colour when it wants
something. Every control now meets the 44px touch size on an iPad, which it did not before,
including the sidebar toggle, the header gear and the side-bar rows. Nothing moved, nothing was
renamed, nothing behaves differently.

The delete paths are now covered by checks: deleting an incident, a sketch, an item or a
compartment takes what it says and leaves everything beside it standing.

## 2026.09.12.3
Text that was too faint to read has been darkened. The small grey print everywhere, the
warning strip, the Sweep tile and the blue buttons in dark mode all now clear the contrast
standard for readable text; nothing else about the look changes, and the van drawing keeps
its old grey.

A sheet now holds the keyboard while it is up, instead of letting Tab wander into the page
behind it. If another device changes the van list while you are saving, the red bar says so
wherever you are, not only on the Sync screen.

Checks added for offline, keyboard, print, a full storage, older saved data, a case package
round trip, a sync clash, and a van list with years of data in it.

## 2026.09.12.2
Offline checks: the app opens with the network cut, an incident started and a compartment
checked offline survive a reload, and every file the page asks for is in the cache. A
contrast report lists text under the WCAG AA ratio in both schemes; it prints, it never
fails a run.

## 2026.09.12.1
Opening a form in Templates did nothing: the sheet threw before it could show, because the app
runs in strict mode and nothing had declared the variable holding the open form. Fixed.

Two checks added, both runnable from the console on the iPad the way the render sweep is. The
click crawl presses every control in every view, and one level into any sheet a control opens,
and says so when a Back or a tab lands somewhere other than where its attribute points, when a
handler throws, or when a button does nothing. The layout audit looks for anything outside the
window, cut off by a hidden overflow, covered by something on top of it, or under the tap size.
Both run at desktop and iPad widths, either way up, in Chromium and in WebKit, which is the
engine Safari uses.

## 2026.09.04.20
Tapping a bin on the bay wall no longer moves the page. On a wide screen (iPad, desktop) the bin's
items open in a panel to the right of the wall and stay in view while the wall scrolls; on a phone
the panel sits directly under the wall. Full screen on an iPad had shrunk the canvas to the size
of its toolbar since .16; it fills the screen again.

## 2026.09.04.19
Every page opens as the main screen. Compartments and items from Storage or Items no longer open
in a pane beside the list on wide screens; the split pane is retired. On an iPad in landscape the
sketch canvas was squeezed by the side bar and the tool rail together, so while sketching on a
screen under 1241px the side bar folds to its icon rail by itself and the rail beside the canvas
is narrower.

## 2026.09.04.18
The side bar on wide screens (desktop and iPad landscape) folds to an icon rail with the chevron
at its top, giving the page the width back. The choice is remembered on the device.

## 2026.09.04.17
Landscape only on the iPad. iPadOS gives a web app no way to lock the screen, so the app does the
next best thing: held upright, a full-screen notice asks for it to be turned sideways and nothing
else is reachable until it is. On by default on an iPad, off on phones, and switchable either way
under Settings › Display › Orientation. The manifest asks for landscape too, which Android honours
for the installed app.

## 2026.09.04.16
iPad round. A bay from Storage opens as its own page instead of a pane beside the list. Picking a
symbol or any other tool ends freehand drawing, and the Done button in the freehand bar is now blue.
Full screen is on the sketch toolbar as well as in View. The object panel moved from under the
canvas to the top of the rail, so on any wide layout (iPad landscape included) it sits on the right
beside the drawing. Every object has Lock rotation: the rotate handle and buttons go away until it
is unlocked, so a placed object cannot be turned by accident.

## 2026.09.04.15
Sketch symbol previews (palette, symbols sheet, layer list) were near-black on the dark card when
dark mode was chosen under Settings, and black-ink objects in the layer list were dark in every dark
mode. Previews now take their ink from the theme; named inks use the theme tint. The drawing itself
is unchanged: it is white paper with black ink in both modes, as it prints.

## 2026.09.04.14
Scan a label works on every device. Chrome and Android use the built-in barcode reader; iPad and
iPhone load a QR reader (jsQR) the first time and scan live from the camera. Every device also gets
a Use the camera app button that takes a photo of the label and reads the code from it, which is
the route when the browser will not open the camera.

## 2026.09.04.13
Settings is a button at the top of Home and the last entry in the side navigation. The old Data
view is now a settings menu: grouped rows that each show their state (initials set, sync connected
and when it last synced, last backup, storage kept or clearable, errors recorded) and open on their
own page with a way back. The Display, Form templates, Report wording and Help entries moved here
from the bottom of Home. The bottom tab bar fills its width.

## 2026.09.04.12
Hosted at https://drfllcky13-droid.github.io/fsu/ straight from the `main` branch. An install
sheet, `install.html`, carries the address as a QR code, the home-screen steps for iPad, Android and
desktop, and how to connect a device to the van data. Van icon on the home screen. The Actions
deploy workflow is gone; Pages serves the branch directly.

## 2026.09.04.11
Bundle order is report, entry log, evidence log, sketch, photo log. The photograph index page is
gone; the photo log carries each photograph on its row at 240 by 180 points, two to a page. Measurement table rows no
longer overlap or split across pages, captions stay upright on rotated photo points, long report
fields keep their line breaks.

## 2026.09.04.10
Reports: standard wording inserted with one tap on any narrative field, edited under Data.
Forms fill from the incident, including officer name and rank, date, and the photograph count.
A photograph log fed by the sketch's photo points. Word export of any form. A vector option for
the sketch in the PDF. Upkeep: a weekly vehicle check with failures on Next actions, part
numbers on items and the reorder list, a shift handover note on Home, service and calibration
dates with a certificate link on durable kit. A help page with this change log, and the version
on every PDF, DXF and case package. The source is split into `src/` with a build and CI check.

## 2026.09.04.9
Home, Scenes, Guide, Storage and Items redesigned around a header line and status tiles.
The bay wall keeps true proportions, zooms, previews a bin on tap and marks unnamed bins.
Illustrated van on the Storage cards. Ten symbols redrawn in plan view; Body and Key moved.

## 2026.09.04.8
One vocabulary (Home, Scenes, Guide, Storage, Items). Guided sweep by bay with names.
Item cards with tap counts. Guide verification pass. Ordered and received on the reorder
list. Lot and count fields on reagents and regulated stock. QR labels with deep links and an
in-app scanner. Initials and an activity log. Count mode. Folded data view.

## 2026.09.04.7
Sketch: render split, error log, home-screen install, rotation snap, freehand ink with
Pencil-only palm rejection, camera from a photo point, live distances, select several, saved
tick, undo across reloads, a first-sketch guide.

## 2026.09.04.6
Sketch: pinch zoom and pan, tap to place, marker mode, grouped toolbar, symbols sheet,
measure by tapping, distance and bearing, layer move, save-failure bar, render guard and
repair, case packages, rough or finished in the title block.

## 2026.09.04.5
Sketch: baseline and triangulation entry, walls by dimension, typed sizes, 24 line types,
area fills and outlined areas, templates, DXF export, fixed-ratio printing, favourites, grid.
Playwright suite.
