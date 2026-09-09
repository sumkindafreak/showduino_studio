# Showduino Studio 2.0

Showduino Studio is the production-authoring environment for building immersive events for the Showduino system.

## Studio 2.0 direction

Studio is no longer modelled as a generic DAW timeline. Its core production model is:

**Production → Scene → Cue → Action → Logical Device → Binding**

A production contains scenes. Scenes contain operator or event cues. Each cue can execute multiple Showduino actions across different systems at the same moment. Creative actions target stable logical device IDs; physical/runtime routing is stored separately in the device binding.

## Current milestone — Production + Device Foundation

Studio now includes:

- Production workspace instead of a generic multi-track editor
- Scene navigator
- Cue list and Cue Composer
- Multi-action cues
- SHDO v2 production import/export
- Official SHDO v2 JSON Schema
- Browser local save/load
- Structural preflight checks
- Cue and scene simulation preview
- real logical Device Inventory
- editable logical IDs and runtime bindings
- action-to-device compatibility checks
- P4 Stage RAM timeline compiler
- deployment-plan export
- direct Stage-load client (never auto-starts a show)
- legacy Studio package/raw-production import migration
- The Chamber reference production
- Responsive browser UI

## Logical devices

Productions author against logical devices rather than scattering physical addresses through cue data.

Current authoring device types are:

```text
Audio Node
P4 Show Pixel Line
C3 Lantern Node
C3 Pixel Node
MOSFET Node
Input / Sensor Node
Projection / Video
Custom / Future Device
```

Current binding routes are:

```text
unbound
specialist Audio Node
P4 GPIO23 Show Pixels
C3 Lantern Node (planned runtime)
C3 Pixel Node (planned runtime)
MOSFET Node (planned runtime)
Projection / Video (planned runtime)
Input / Sensor Node (planned runtime)
```

A logical device can deliberately remain unbound while a production is being designed. Required-but-unbound devices create a Preflight warning. An action targeting a missing, disabled or incompatible logical device is a blocking error.

New Studio authoring no longer offers DMX or Relay actions. DMX remains deliberately parked/out of scope. Legacy Relay and DMX data are retained only so older productions can be imported and migrated; new switched-output work targets the MOSFET Node model.

## Stage compiler

The active scene can be compiled to the P4's existing RAM timeline transport:

```text
SHOW:TL:BEGIN
SHOW:TL:C:<timeMs>:<command>
...
SHOW:TL:END
```

The compiler is intentionally capability-driven. It currently emits runtime commands only for systems already implemented on the current P4 path:

- P4 GPIO23 segmented Show Pixels (`PIXEL:SEGMENT:*`)
- Specialist Audio Node programme audio (`AUDIO:NODE:*`)

The compiler blocks instead of inventing support for:

- MOSFET Node output commands
- Lantern Node lighting commands
- C3 Pixel Node routing
- projection/video runtime
- trigger graph / sensor-triggered scene execution
- DMX
- legacy Relay output

Only Scene Start / Timeline / Automatic cues can currently become a self-contained P4 RAM timeline. Operator-GO and sensor/event trigger semantics stay visible in authoring but block Stage compilation until the Stage cue/trigger runtime exists.

`Deploy to Stage` uploads the compiled RAM timeline only. It does **not** send `SHOW:START`. The P4 remains runtime and safety authority.

Direct Studio upload uses the dedicated `/api/studio-timeline` endpoint rather than widening the generic `/api/command` whitelist. The Communications S3 and P4 both validate the upload envelope, and the P4 again validates each nested Pixel or Audio Node command before accepting it.

### Deployment transport boundary

Plain-HTTP deployment is **commissioning/local-link functionality only**. It is intended for the isolated Showduino Communications S3 SoftAP used during setup, where the operator controls access to the Wi-Fi network. It must not be described or relied on as an authenticated production-deployment channel on a shared venue LAN, public Wi-Fi or the internet.

For a production-grade remote deployment path, Showduino will require an authenticated integrity-protected transport. Until that exists, keep direct phone/browser deployment on the isolated local Showduino link; otherwise export the deployment plan and use a trusted local maintenance path.

A browser page loaded over HTTPS will normally block requests to an `http://` Showduino target as mixed content. The planned phone workflow therefore serves Studio locally from the Communications S3 so authoring and deployment share the same Showduino origin.

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

Studio keeps **Production → Scene → Cue → Action → Logical Device** as its internal authoring model. On export, actions are projected into normalized timeline `tracks` and `clips`, while scenes/cues reference those clips. On import, Studio reconstructs the scene/cue/action model.

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

`The Chamber` is used as the development reference. It now carries actual logical devices for programme audio, P4 corridor pixels, chamber lighting and future MOSFET outputs. Supported P4 pixel/audio actions can compile immediately; planned-node actions visibly report the missing runtime instead of producing false-success output.

## Architecture

```text
index.html
styles.css
device-workspace.css
src/
  app.js          Studio shell, scenes, cues, device inventory and bindings
  model.js        Production / Scene / Cue / Action / Device model
  store.js        Local persistence plus SHDO import/export
  package.js      SHDO v2 serializer, validator, migration and round-trip guard
  preflight.js    Production/device validation
  deployment.js   P4 RAM timeline compiler, plan export and Stage-load client
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

For bench commissioning from another device, use the isolated Showduino local link. Do not expose the plain-HTTP deployment endpoint on an untrusted/shared network.

## Next Studio 2.0 layers

- Communications-S3-hosted phone Studio
- Asset Library and real audio import/waveforms
- dedicated Lighting editor
- Pixel FX designer / reusable presets
- MOSFET Node command/runtime integration
- C3 Lantern and C3 Pixel Node runtime integration
- trigger graph and sensor/event execution
- automation curves
- scene timeline refinement
- richer simulator
- persistent SHDO/runtime-package deployment to P4 SD storage
