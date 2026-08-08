# Showduino Studio

A standalone browser-based production editor for designing immersive Showduino shows.

## Current build

The first Studio build uses the same lightweight standalone approach as Drumit: plain HTML, CSS and JavaScript with no build step.

### Included

- Multi-lane DAW-style show timeline
- Drag clips horizontally and vertically between tracks
- Resize clips from either edge
- Audio, video, lighting, DMX, pixels, relay, automation, cue and safety clip types
- Clip inspector hidden behind the `⋮` menu
- Add/remove tracks
- Play, pause, stop, rewind and timeline scrubbing
- Snap controls
- Mouse-wheel / Ctrl-wheel zoom
- Two-finger pinch zoom on touchscreens
- Touch dragging from the clip library
- Undo / redo
- Duplicate, split, move-to-playhead and delete actions
- Browser local save/load
- Responsive mobile/tablet layout
- Demo production

## Run locally

No dependencies are required.

### Option 1 — open directly

Open `index.html` in a modern browser.

### Option 2 — local web server

From the repository folder run:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Files

- `index.html` — application shell
- `styles.css` — Studio UI and responsive design
- `app.js` — timeline, clips, transport, save/load and editing logic
- `touch.js` — pinch zoom and mobile drag support

## Next product steps

The editor is intentionally standalone at this stage. The next integration layer can connect saved Studio productions to Showduino's production manifest / command architecture and add real asset import, device routing, waveform previews, lighting parameter editors, automation curves and Stage Runtime export.
