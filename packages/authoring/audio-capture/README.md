# Audio Capture

`@codplay/audio-capture` provides a reusable browser panel for audio work. It
starts with the ElevenLabs key and voice selection used by the reference demo.
The key stays in memory unless the author opts to remember it in this browser.

Register the panel in a browser application:

```ts
import { registerAudioCaptureElement } from '@codplay/audio-capture'

registerAudioCaptureElement()
```

```html
<codplay-audio-capture
  id="avatar-audio-capture"
  data-head-target-runtime-src="/assets/vendor/@rive-app/canvas-advanced-single/canvas_advanced_single.mjs"
  data-head-target-src="/assets/avatar.riv"
  data-head-target-artboard="Avatar"
  data-head-target-state-machine="Avatar_SM"
  data-head-target-view-model="AvatarVM"
  data-head-target-instance="Instance"
></codplay-audio-capture>
```

The selector starts with the ten demo voices, so you can choose one without
loading your account's voice list. Enter your ElevenLabs key for TTS, forced
alignment, and voice transformation. Local capture and file loading do not need
the key. For an imported or captured track, enter or paste its transcript in
“Texte de la prise”; “Préparer et insérer” aligns that text with the audio and
builds the Avatar files. It does not transcribe automatically. **Micro** records
audio only; **Caméra** records audio while tracking head movement from the live
camera feed. The saved take contains audio and its head-motion timeline, not
camera images. When the `data-head-target-*` attributes are supplied, Caméra
also renders that Rive target beside the live camera and mirrors `headX`,
`headY`, and `headTilt` while recording.
**Charger mes voix ElevenLabs**
optionally replaces the demo voices with the voices available to your account;
if the key cannot list voices, the demo choices remain available. The key is
stored only when you check the browser-memory option.
