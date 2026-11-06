import type { AudioCaptureInsertEventDetail } from './ui/audio-capture-element'
import type { MixInput } from 'remix/component'

declare global {
  interface HTMLElementEventMap {
    'audio-capture-insert': CustomEvent<AudioCaptureInsertEventDetail>
  }

  namespace JSX {
    interface IntrinsicElements {
      'codplay-audio-capture': {
        readonly id: string
        readonly className?: string
        readonly mix?: MixInput<HTMLElement>
      }
    }
  }
}

export {}
