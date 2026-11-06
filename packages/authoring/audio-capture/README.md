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
<codplay-audio-capture id="avatar-audio-capture"></codplay-audio-capture>
```

The selector starts with the ten demo voices, so you can choose one without
loading your account's voice list. Enter your ElevenLabs key to enable the
audio operations. **Charger mes voix ElevenLabs** optionally replaces the demo
voices with the voices available to your account; if the key cannot list voices,
the demo choices remain available. The key is stored only when you check the
browser-memory option.
