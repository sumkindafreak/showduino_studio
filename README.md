# Showduino Studio 2.0

Showduino Studio is the production-authoring environment for building immersive events for the Showduino system.

## Studio 2.0 direction

Studio is no longer modelled as a generic DAW timeline. Its core production model is:

**Production → Scene → Cue → Action → Target**

A production contains scenes. Scenes contain operator or event cues. Each cue can execute multiple Showduino actions across different systems at the same moment.

## Current milestone — Production Foundation

This branch introduces the first Studio 2.0 foundation:

- Production workspace instead of a generic multi-track editor
- Scene navigator
- Cue list and Cue Composer
- Multi-action cues
- Audio, lighting, pixels, DMX, relay, video, delay, automation, trigger and safety action types
- Explicit Showduino targets
- Create/edit scenes, cues and actions
- Browser local save/load
- Structural preflight checks
- Cue and scene simulation preview
- The Chamber reference production
- Responsive browser UI

## Reference production

`The Chamber` is used as the development reference. The included `Entity Appears` cue demonstrates a single cue coordinating:

1. entity scream audio
2. chamber lighting snap to red
3. corridor pixel chase
4. relay-driven prop strike
5. timed delay
6. impact audio

This is the behaviour Studio 2.0 is designed around: one production intent coordinating multiple Showduino capabilities.

## Architecture

```text
index.html
styles.css
src/
  app.js          Studio shell, scene navigation and Cue Composer
  model.js        Production / Scene / Cue / Action / Target model
  store.js        Project persistence
  preflight.js    Production validation
  simulator.js    Cue and scene execution preview
```

The legacy Studio 1.x `app.js` and `touch.js` remain temporarily in the repository for comparison/migration, but Studio 2.0 does not load them.

## Run

Studio uses native JavaScript modules, so serve the repository through a web server rather than opening `index.html` as a local file.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

GitHub Pages can also serve the app directly from `main` after the Studio 2.0 branch is merged.

## Next Studio 2.0 layers

- Asset Library and real audio import/waveforms
- Device inventory and routing
- Dedicated Lighting editor
- Pixel FX designer
- DMX editor
- Automation curves
- Trigger graph
- Scene timeline view
- richer simulator
- production packaging/export for the Showduino runtime
