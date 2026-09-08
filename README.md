# Showduino Studio 2.0

Showduino Studio is the production-authoring environment for building immersive events for the Showduino system.

## Studio 2.0 direction

Studio is no longer modelled as a generic DAW timeline. Its core production model is:

**Production → Scene → Cue → Action → Target**

A production contains scenes. Scenes contain operator or event cues. Each cue can execute multiple Showduino actions across different systems at the same moment.

## Current milestone — Production Foundation

This branch includes the Studio 2.0 production foundation:

- Production workspace instead of a generic multi-track editor
- Scene navigator
- Cue list and Cue Composer
- Multi-action cues
- Explicit Showduino targets
- Create/edit scenes, cues and actions
- Browser local save/load
- Structural preflight checks
- Cue and scene simulation preview
- The Chamber reference production
- Responsive browser UI
- SHDO v2 production import/export
- Official SHDO v2 JSON Schema
- Legacy Studio package/raw-production import migration

## SHDO v2

`.shdo` is the portable authoring/interchange representation of a Showduino **Production**. The Production remains the product object; the filename is only a storage/transport representation.

SHDO v2 contains:

```text
project
architecture
compatibility
devices
tracks
clips
markers
scenes
assets
safety
globalSettings
config
package
metadata
```

Studio keeps **Production → Scene → Cue → Action → Target** as its internal authoring model. On export, actions are projected into normalized timeline `tracks` and `clips`, while scenes/cues reference those clips. On import, Studio reconstructs the scene/cue/action model.

The file declares the current Showduino architecture:

```text
Director ESP32-S3
  → ESP-NOW
Communications ESP32-S3
  → UART
ESP32-P4 Show Engine
  → logical-device-id
Specialist Nodes / local engines
```

The ESP32-P4 remains runtime and safety authority. A production cannot disable the emergency policy; SHDO v2 records the fixed emergency contract as firmware-authoritative with all-pixel white override, manual clear, and no automatic resume.

Schema: `schema/showduino-production-v2.schema.json`

Studio still imports the earlier `showduino.production.package` v1 format and raw Studio production JSON so existing work is not stranded.

## Reference production

`The Chamber` is used as the development reference. The included `Entity Appears` cue demonstrates a single cue coordinating multiple Showduino actions at one moment.

This is the behaviour Studio 2.0 is designed around: one production intent coordinating multiple Showduino capabilities.

## Architecture

```text
index.html
styles.css
src/
  app.js          Studio shell, scene navigation and Cue Composer
  model.js        Production / Scene / Cue / Action / Target model
  store.js        Local persistence plus SHDO import/export
  package.js      SHDO v2 serializer, validator, migration and round-trip guard
  preflight.js    Production validation
  simulator.js    Cue and scene execution preview
  timeline.js     Timeline projection/editor
schema/
  showduino-production-v2.schema.json
```

The legacy Studio 1.x `app.js` and `touch.js` remain temporarily in the repository for comparison/migration, but Studio 2.0 does not load them.

## Run

Studio uses native JavaScript modules, so serve the repository through a web server rather than opening `index.html` as a local file.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

GitHub Pages can also serve the app directly from `main` after changes are merged.

## Next Studio 2.0 layers

- Asset Library and real audio import/waveforms
- Device inventory and logical-device routing UI
- Dedicated Lighting editor
- Pixel FX designer
- Automation curves
- Trigger graph
- Scene timeline refinement
- richer simulator
- deployment/compiler projection for the authoritative P4 runtime
