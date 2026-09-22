# FSU

Scene documentation and van upkeep for the Williamsport Bureau of Police Forensic Services Unit.
No server, runs offline on an iPad, a phone or a desktop.

## Where it runs

The app is live at **https://drfllcky13-droid.github.io/fsu/**

GitHub Pages serves this repository's `main` branch directly. A push to `main` is live within about
a minute. Nothing needs to be enabled or deployed by hand.

It is two pages, and you can put both on the home screen:

- **FSU** (the address above) is the van: Home, Storage, Items, the sweep, the guide, the printed
  map and labels, restocking, tidying up and Settings.
- **Scenes** (`.../fsu/scenes.html`) is the scene: the incident list, an incident and the
  documents it needs, filling a form in, form templates, the sketch, and a 3D map of
  Williamsport's buildings (Settings › Map, which needs a connection).

They are the same records, not two copies — a sweep logged on one shows up on the other, and
nothing has to be sent between them — but they are genuinely separate apps. Neither has a button,
a tab or a link into the other; there is no "Scenes" tab on the van and no "Storage" tab on the
scene. You switch between them the way you switch between any two apps: back to the home screen,
tap the other icon.

**Install sheet:** https://drfllcky13-droid.github.io/fsu/install.html — one printable page with a
QR code for each app, the home-screen steps for iPad, Android and desktop, and how to connect a
device to the van data. Print it and pin it in the van.

## Getting a device going

1. Open the address above in Safari (iPad or iPhone) or Chrome (Android, desktop).
2. Add it to the home screen: Safari → Share → Add to Home Screen; Chrome → menu → Install app or
   Add to Home screen; desktop Chrome or Edge → the install icon at the right of the address bar.
   That icon is **FSU**, the van.
3. Now open `.../fsu/scenes.html` and add that to the home screen the same way. That icon is
   **Scenes**. Doing both gives the technician one icon for the van and one for the scene; each
   opens straight into its own work, with no route from one into the other.
4. Open each icon once while online. From then on they work without a connection.
5. To share the van list with the other devices, open **Settings** (top of Home), then
   **Automatic saving**. Owner and repository are already filled in (`drfllcky13-droid` /
   `van-data`). Paste the unit's access token and tap **Connect** — that is the whole form.
   The list merges straight away and every change after that saves itself a couple of seconds
   later. This is done once per device.

Devices do not overwrite each other. Two people working at the same time, or a device that has
been out of signal for a week, both keep their work: the app merges item by item rather than
file by file. The only thing it cannot decide for you is when two devices changed the *same*
item — then it picks one, and keeps yours in Settings › Automatic saving with a **Put mine
back** button. Nothing is ever discarded without a copy.

## The access token (whoever administers the GitHub account)

The van data lives in the private repository `drfllcky13-droid/van-data` as one file, `data.json`.
Devices read and write it with a fine-grained personal access token:

GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
Repository access: **only `van-data`**. Permissions: **Contents: Read and write**, nothing else.
Expiration: the longest offered. Copy the token once and hand it to the devices; the app reads the
expiry date from GitHub itself and warns before the token lapses.

There is no way to move a token from one device to another from inside the app, and there should
not be: a token that can be copied out is a token that can be photographed off a screen. Setting
up a second device means pasting the token into it, from wherever the unit keeps it.

When it lapses, saving stops and every device says so, with a **Reconnect** button that asks for
nothing but the new token. Nothing typed in the meantime is lost — it is held on the device and
goes up as soon as a working token is pasted.

The token is stored in the browser on each device only. It is left out of backup files, exports
and case packages.

## What stays on the device

Case material (incidents, forms, sketches, photographs) never syncs and never reaches GitHub. It
leaves a device only as an exported PDF, Word, DXF or case package. Keep it that way. The app
repository is public; nothing in it is case material.

## For whoever maintains it

- `index.html` (the van) and `scenes.html` (the scene) are the app. Both are built from `src/` by
  `node build.js`; edit the parts, not the built files. `src/pages.js` says which view lives on
  which page.
- `sw.js`, `manifest.webmanifest`, `scenes.webmanifest` and the icons make both pages installable
  from a web address.
- `fsu-tests/` is the Playwright suite (`npm install`, `npm run install-browser`, `npm test`).
- `HANDOFF.md` explains the structure and the things that bite. `CHANGELOG.md` is the version history.
- `.github/workflows/fsu.yml` checks the build and runs the suite on every push.

To ship a change: edit under `src/`, run `node build.js`, run the suite, commit `src/`,
`index.html` and `scenes.html` together, push to `main`.
