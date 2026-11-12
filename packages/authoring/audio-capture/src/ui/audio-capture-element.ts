import {
  clearRememberedElevenLabsApiKey,
  loadRememberedElevenLabsApiKey,
  rememberElevenLabsApiKey,
} from '../elevenlabs/api-key-storage'
import {
  DEFAULT_ELEVENLABS_VOICE_ID,
  DEFAULT_ELEVENLABS_VOICES,
  loadElevenLabsVoices,
  type ElevenLabsVoice,
} from '../elevenlabs/voices'
import type { AudioCharacter, AudioWord } from '../audio/types'
import { alignAudioToText } from '../elevenlabs/forced-alignment'
import { generateSpeechWithTimestamps } from '../elevenlabs/text-to-speech'
import { transformVoice } from '../elevenlabs/voice-transformation'
import { createMp3WithComment } from '../audio/mp3-comment'
import { buildFrenchAzureVisemes } from '../timeline/french-azure-viseme-timeline'
import {
  startHeadMotionRivePreview,
  type HeadMotionRivePreviewConfig,
  type HeadMotionRivePreviewSession,
} from '../head-tracking/head-motion-rive-preview'
import {
  startHeadMotionCapture,
  type HeadMotionCaptureSession,
  type HeadMotionSample,
} from '../head-tracking/head-motion-tracker'

export type AudioCaptureInsertEventDetail = Readonly<{
  audio: File
  timeline: File
  complete: (error?: string) => void
}>

type AudioVariant = Readonly<{
  id: 'tts' | 'recording' | 'camera' | 'loaded' | 'transformed'
  label: string
  fileName: string
  audio: Blob
  characters: readonly AudioCharacter[] | null
  transcript: string
  words: readonly AudioWord[] | null
  headMotion: readonly HeadMotionSample[]
  headMotionDurationMs: number | null
}>

const audioCaptureMarkup = `
  <style id="audio-capture-style">
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
      color: var(--audio-capture-ink, #293936);
      font: inherit;
    }
    * { box-sizing: border-box; }
    #audio-capture-panel { display: grid; gap: 0.85rem; min-width: 0; width: 100%; }
    #audio-capture-form { display: grid; gap: 0.8rem; }
    #audio-capture-settings-panel,
    #audio-capture-capture-panel,
    #audio-capture-track-panel,
    #audio-capture-workflow { display: grid; gap: 0.8rem; }
    #audio-capture-key-label,
    #audio-capture-voice-label,
    #audio-capture-model-label { display: grid; gap: 0.4rem; font-weight: 600; }
    #audio-capture-key-input,
    #audio-capture-voice-select,
    #audio-capture-model-select {
      width: 100%;
      min-height: 2.8rem;
      padding: 0.65rem 0.75rem;
      color: inherit;
      background: var(--audio-capture-field, #fffdf8);
      border: 1px solid var(--audio-capture-border, #d5d1c7);
      border-radius: 0.3rem;
      font: inherit;
    }
    #audio-capture-remember-label {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }
    #audio-capture-remember-input { width: 1.05rem; height: 1.05rem; margin: 0; }
    #audio-capture-main-tabs,
    #audio-capture-source-tabs {
      min-width: 0;
      width: 100%;
      border-bottom: 1px solid var(--audio-capture-border, #d5d1c7);
    }
    #audio-capture-main-tabs { display: flex; gap: 0.8rem; }
    #audio-capture-source-tabs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.25rem;
    }
    #audio-capture-main-tabs [role="tab"],
    #audio-capture-source-tabs [role="tab"] {
      min-height: 3rem;
      padding: 0.65rem 0.9rem;
      color: inherit;
      background: transparent;
      border: 0;
      border-bottom: 3px solid transparent;
      border-radius: 0;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
    }
    #audio-capture-source-tabs [role="tab"] {
      min-width: 0;
      padding-inline: 0.4rem;
      text-align: center;
    }
    #audio-capture-main-tabs [role="tab"][aria-selected="true"],
    #audio-capture-source-tabs [role="tab"][aria-selected="true"] {
      color: var(--audio-capture-primary, #46726b);
      border-bottom-color: var(--audio-capture-primary, #46726b);
    }
    #audio-capture-main-tabs [role="tab"]:focus-visible,
    #audio-capture-source-tabs [role="tab"]:focus-visible {
      outline: 2px solid var(--audio-capture-primary, #46726b);
      outline-offset: 2px;
    }
    #audio-capture-main-tabs [role="tab"]:disabled { cursor: not-allowed; opacity: 0.55; }
    #audio-capture-load-voices {
      min-height: 2.8rem;
      padding: 0.65rem 0.9rem;
      color: var(--audio-capture-primary-ink, #fffdf8);
      background: var(--audio-capture-primary, #46726b);
      border: 1px solid var(--audio-capture-primary, #46726b);
      border-radius: 0.3rem;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
    }
    #audio-capture-load-voices:disabled { cursor: wait; opacity: 0.65; }
    #audio-capture-voice-select:disabled,
    #audio-capture-model-select:disabled { cursor: not-allowed; opacity: 0.7; }
    #audio-capture-status { margin: 0; }
    #audio-capture-status:empty { display: none; }
    #audio-capture-status[data-state="error"] { color: #9f3e34; }
    #audio-capture-status[data-state="success"] { color: #27675c; }
    #audio-capture-panel button:not([role="tab"]) {
      min-height: 2.6rem;
      padding: 0.55rem 0.8rem;
      color: inherit;
      background: var(--audio-capture-field, #fffdf8);
      border: 1px solid var(--audio-capture-border, #d5d1c7);
      border-radius: 0.3rem;
      cursor: pointer;
      font: inherit;
    }
    #audio-capture-panel button:not([role="tab"]):disabled { cursor: not-allowed; opacity: 0.58; }
    #audio-capture-tts-panel,
    #audio-capture-microphone-panel,
    #audio-capture-camera-panel,
    #audio-capture-file-panel,
    #audio-capture-track-panel {
      display: grid;
      gap: 0.7rem;
      min-width: 0;
      margin: 0;
      padding: 0.8rem;
      border: 1px solid var(--audio-capture-border, #d5d1c7);
      border-radius: 0.3rem;
    }
    #audio-capture-file-picker {
      display: inline-grid;
      justify-self: start;
      position: relative;
    }
    #audio-capture-audio-file {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    #audio-capture-choose-audio { justify-self: start; }
    #audio-capture-choose-audio:focus-visible {
      outline: 2px solid var(--audio-capture-primary, #46726b);
      outline-offset: 2px;
    }
    #audio-capture-tts-panel[hidden],
    #audio-capture-microphone-panel[hidden],
    #audio-capture-camera-panel[hidden],
    #audio-capture-file-panel[hidden],
    #audio-capture-camera-video[hidden],
    #audio-capture-settings-panel[hidden],
    #audio-capture-capture-panel[hidden],
    #audio-capture-track-panel[hidden] { display: none; }
    #audio-capture-tts-label,
    #audio-capture-transcript-label { display: grid; gap: 0.4rem; font-weight: 600; }
    #audio-capture-tts-text,
    #audio-capture-transcript-text {
      width: 100%;
      min-height: 6rem;
      padding: 0.65rem 0.75rem;
      color: inherit;
      background: var(--audio-capture-field, #fffdf8);
      border: 1px solid var(--audio-capture-border, #d5d1c7);
      border-radius: 0.3rem;
      font: inherit;
      line-height: 1.4;
      resize: vertical;
    }
    #audio-capture-track-choices { display: grid; gap: 0.4rem; }
    #audio-capture-track-choices label { display: flex; align-items: center; gap: 0.5rem; }
    #audio-capture-track-preview { display: flex; align-items: center; gap: 0.55rem; min-width: 0; }
    #audio-capture-preview { flex: 1; min-width: 0; }
    #audio-capture-camera-video {
      display: block;
      width: 100%;
      max-height: 15rem;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      background: #172623;
      border-radius: 0.3rem;
      transform: scaleX(-1);
    }
    #audio-capture-camera-video[hidden] { display: none; }
    #audio-capture-camera-previews {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    #audio-capture-camera-previews[data-target-active="true"] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    #audio-capture-camera-target {
      display: block;
      width: 100%;
      max-height: 15rem;
      aspect-ratio: 420 / 500;
      background: var(--audio-capture-field, #fffdf8);
      border-radius: 0.3rem;
    }
    #audio-capture-camera-target[hidden] { display: none; }
    #audio-capture-camera-status { margin: 0; }
    #audio-capture-camera-status:empty { display: none; }
    #audio-capture-panel #audio-capture-download {
      display: grid;
      place-items: center;
      width: 2.8rem;
      min-width: 2.8rem;
      min-height: 2.8rem;
      padding: 0.5rem;
    }
    #audio-capture-panel #audio-capture-download[hidden] { display: none; }
    #audio-capture-download-icon { width: 1.35rem; height: 1.35rem; }
    #audio-capture-transform { justify-self: start; }
    #audio-capture-panel #audio-capture-insert {
      justify-self: start;
      min-width: 14rem;
      min-height: 3.25rem;
      padding: 0.8rem 1.2rem;
      color: var(--audio-capture-primary-ink, #fffdf8);
      background: var(--audio-capture-primary, #46726b);
      border-color: var(--audio-capture-primary, #46726b);
      box-shadow: 0 2px 6px rgb(20 30 30 / 18%);
      font-size: 1rem;
      font-weight: 700;
    }
    @media (max-width: 32rem) {
      #audio-capture-source-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
  <section id="audio-capture-panel" aria-label="Capture audio">
    <div id="audio-capture-main-tabs" role="tablist" aria-label="Capture, piste audio et réglages">
      <button id="audio-capture-capture-tab" type="button" role="tab" aria-selected="true" aria-controls="audio-capture-capture-panel" tabindex="0">Capture</button>
      <button id="audio-capture-track-tab" type="button" role="tab" aria-selected="false" aria-controls="audio-capture-track-panel" aria-disabled="true" tabindex="-1" disabled>Piste audio</button>
      <button id="audio-capture-settings-tab" type="button" role="tab" aria-selected="false" aria-controls="audio-capture-settings-panel" tabindex="-1">Réglages</button>
    </div>
    <section id="audio-capture-capture-panel" role="tabpanel" aria-labelledby="audio-capture-capture-tab" tabindex="0">
      <section id="audio-capture-workflow" aria-label="Créer ou charger une piste audio">
        <div id="audio-capture-source-tabs" role="tablist" aria-label="Source audio">
          <button id="audio-capture-tts-tab" type="button" role="tab" aria-selected="true" aria-controls="audio-capture-tts-panel" tabindex="0">Générer une voix</button>
          <button id="audio-capture-microphone-tab" type="button" role="tab" aria-selected="false" aria-controls="audio-capture-microphone-panel" tabindex="-1">Micro</button>
          <button id="audio-capture-camera-tab" type="button" role="tab" aria-selected="false" aria-controls="audio-capture-camera-panel" tabindex="-1">Caméra</button>
          <button id="audio-capture-file-tab" type="button" role="tab" aria-selected="false" aria-controls="audio-capture-file-panel" tabindex="-1">Charger audio</button>
        </div>
      <fieldset id="audio-capture-tts-panel" role="tabpanel" aria-labelledby="audio-capture-tts-tab" tabindex="0">
        <legend id="audio-capture-tts-legend">Synthèse vocale</legend>
        <label id="audio-capture-tts-label" for="audio-capture-tts-text">
          <span id="audio-capture-tts-caption">Texte à prononcer</span>
          <textarea id="audio-capture-tts-text" rows="4"></textarea>
        </label>
        <button id="audio-capture-generate" type="button" disabled>Générer la voix</button>
      </fieldset>
      <fieldset id="audio-capture-microphone-panel" role="tabpanel" aria-labelledby="audio-capture-microphone-tab" tabindex="0" hidden>
        <legend id="audio-capture-microphone-legend">Micro</legend>
        <button id="audio-capture-record" type="button">Commencer l’enregistrement</button>
      </fieldset>
      <fieldset id="audio-capture-camera-panel" role="tabpanel" aria-labelledby="audio-capture-camera-tab" tabindex="0" hidden>
        <legend id="audio-capture-camera-legend">Caméra</legend>
        <button id="audio-capture-camera-record" type="button">Commencer la capture</button>
        <div id="audio-capture-camera-previews" data-target-active="false">
          <video id="audio-capture-camera-video" aria-label="Aperçu caméra" muted playsinline hidden></video>
          <canvas id="audio-capture-camera-target" aria-label="Avatar cible" hidden></canvas>
        </div>
        <p id="audio-capture-camera-status" role="status" aria-live="polite"></p>
      </fieldset>
      <section id="audio-capture-file-panel" role="tabpanel" aria-labelledby="audio-capture-file-tab" tabindex="0" hidden>
        <div id="audio-capture-file-picker">
          <input id="audio-capture-audio-file" type="file" accept="audio/*" tabindex="-1" aria-hidden="true" />
          <button id="audio-capture-choose-audio" type="button">Choisir un fichier</button>
        </div>
      </section>
      </section>
    </section>
    <section id="audio-capture-track-panel" role="tabpanel" aria-labelledby="audio-capture-track-tab" aria-label="Piste audio" tabindex="0" hidden>
      <div id="audio-capture-track-choices" role="radiogroup" aria-label="Choisir la piste audio finale"></div>
      <div id="audio-capture-track-preview">
        <audio id="audio-capture-preview" controls preload="metadata" hidden></audio>
        <button id="audio-capture-download" type="button" aria-label="Télécharger la voix générée" title="Télécharger la voix générée" hidden>
          <svg id="audio-capture-download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <path d="m7 10 5 5 5-5"></path>
            <path d="M12 15V3"></path>
          </svg>
        </button>
      </div>
      <label id="audio-capture-transcript-label" for="audio-capture-transcript-text">
        <span id="audio-capture-transcript-caption">Texte de la prise</span>
        <textarea id="audio-capture-transcript-text" rows="4"></textarea>
      </label>
      <button id="audio-capture-transform" type="button" disabled>Transformer vers la voix choisie</button>
      <button id="audio-capture-insert" type="button" disabled>Préparer et insérer</button>
    </section>
    <section id="audio-capture-settings-panel" role="tabpanel" aria-labelledby="audio-capture-settings-tab" tabindex="0" hidden>
      <form id="audio-capture-form">
        <label id="audio-capture-key-label" for="audio-capture-key-input">
          <span id="audio-capture-key-caption">Clé API ElevenLabs</span>
          <input id="audio-capture-key-input" type="password" autocomplete="off" spellcheck="false" placeholder="xi-api-key" required />
        </label>
        <label id="audio-capture-remember-label" for="audio-capture-remember-input">
          <input id="audio-capture-remember-input" type="checkbox" />
          <span id="audio-capture-remember-caption">Mémoriser la clé dans ce navigateur</span>
        </label>
        <label id="audio-capture-voice-label" for="audio-capture-voice-select">
          <span id="audio-capture-voice-caption">Voix</span>
          <select id="audio-capture-voice-select" disabled>
            <option value="">Charger les voix ElevenLabs</option>
          </select>
        </label>
        <label id="audio-capture-model-label" for="audio-capture-model-select">
          <span id="audio-capture-model-caption">Modèle</span>
          <select id="audio-capture-model-select" disabled>
            <option value="eleven_multilingual_v2">Multilingual v2</option>
            <option value="eleven_flash_v2_5">Flash v2.5 (plus rapide)</option>
            <option value="eleven_turbo_v2_5">Turbo v2.5</option>
          </select>
        </label>
        <button id="audio-capture-load-voices" type="submit">Charger mes voix ElevenLabs</button>
      </form>
    </section>
    <p id="audio-capture-status" role="status" aria-live="polite" data-state="idle"></p>
  </section>
`

/** Registers the reusable browser element for the audio capture module. */
export function registerAudioCaptureElement(): void {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return
  if (customElements.get('codplay-audio-capture') !== undefined) return

  class AudioCaptureElement extends HTMLElement {
    private captureTab: HTMLButtonElement | null = null
    private trackTab: HTMLButtonElement | null = null
    private apiKeyInput: HTMLInputElement | null = null
    private rememberInput: HTMLInputElement | null = null
    private loadVoicesButton: HTMLButtonElement | null = null
    private voiceSelect: HTMLSelectElement | null = null
    private modelSelect: HTMLSelectElement | null = null
    private statusNode: HTMLParagraphElement | null = null
    private trackPanel: HTMLElement | null = null
    private audioFileInput: HTMLInputElement | null = null
    private chooseAudioButton: HTMLButtonElement | null = null
    private ttsText: HTMLTextAreaElement | null = null
    private transcriptText: HTMLTextAreaElement | null = null
    private generateButton: HTMLButtonElement | null = null
    private recordButton: HTMLButtonElement | null = null
    private cameraRecordButton: HTMLButtonElement | null = null
    private cameraVideo: HTMLVideoElement | null = null
    private cameraPreviews: HTMLDivElement | null = null
    private cameraTargetCanvas: HTMLCanvasElement | null = null
    private cameraStatus: HTMLParagraphElement | null = null
    private transformButton: HTMLButtonElement | null = null
    private insertButton: HTMLButtonElement | null = null
    private downloadButton: HTMLButtonElement | null = null
    private trackChoices: HTMLDivElement | null = null
    private previewAudio: HTMLAudioElement | null = null
    private headMotionSession: HeadMotionCaptureSession | null = null
    private headMotionRivePreview: HeadMotionRivePreviewSession | null = null
    private captureController: AbortController | null = null
    private mediaRecorder: MediaRecorder | null = null
    private mediaStream: MediaStream | null = null
    private recordedChunks: BlobPart[] = []
    private recordingStartedAt: number | null = null
    private recordingSource: 'microphone' | 'camera' | null = null
    private recordingStarting = false
    private audioUrl: string | null = null
    private variants = new Map<AudioVariant['id'], AudioVariant>()
    private selectedVariantId: AudioVariant['id'] | null = null
    private busy = false

    /** Creates the reference workflow and binds its browser-only controls. */
    connectedCallback(): void {
      if (this.shadowRoot !== null) {
        const selected = this.selectedVariant()
        if (selected !== null) this.setPreview(selected.audio)
        return
      }

      const root = this.attachShadow({ mode: 'open' })
      root.innerHTML = audioCaptureMarkup
      this.captureTab = root.querySelector<HTMLButtonElement>('#audio-capture-capture-tab')
      this.trackTab = root.querySelector<HTMLButtonElement>('#audio-capture-track-tab')
      this.apiKeyInput = root.querySelector<HTMLInputElement>('#audio-capture-key-input')
      this.rememberInput = root.querySelector<HTMLInputElement>('#audio-capture-remember-input')
      this.loadVoicesButton = root.querySelector<HTMLButtonElement>('#audio-capture-load-voices')
      this.voiceSelect = root.querySelector<HTMLSelectElement>('#audio-capture-voice-select')
      this.modelSelect = root.querySelector<HTMLSelectElement>('#audio-capture-model-select')
      this.statusNode = root.querySelector<HTMLParagraphElement>('#audio-capture-status')
      this.trackPanel = root.querySelector<HTMLElement>('#audio-capture-track-panel')
      this.audioFileInput = root.querySelector<HTMLInputElement>('#audio-capture-audio-file')
      this.chooseAudioButton = root.querySelector<HTMLButtonElement>('#audio-capture-choose-audio')
      this.ttsText = root.querySelector<HTMLTextAreaElement>('#audio-capture-tts-text')
      this.transcriptText = root.querySelector<HTMLTextAreaElement>('#audio-capture-transcript-text')
      this.generateButton = root.querySelector<HTMLButtonElement>('#audio-capture-generate')
      this.recordButton = root.querySelector<HTMLButtonElement>('#audio-capture-record')
      this.cameraRecordButton = root.querySelector<HTMLButtonElement>('#audio-capture-camera-record')
      this.cameraVideo = root.querySelector<HTMLVideoElement>('#audio-capture-camera-video')
      this.cameraPreviews = root.querySelector<HTMLDivElement>('#audio-capture-camera-previews')
      this.cameraTargetCanvas = root.querySelector<HTMLCanvasElement>('#audio-capture-camera-target')
      this.cameraStatus = root.querySelector<HTMLParagraphElement>('#audio-capture-camera-status')
      this.transformButton = root.querySelector<HTMLButtonElement>('#audio-capture-transform')
      this.insertButton = root.querySelector<HTMLButtonElement>('#audio-capture-insert')
      this.downloadButton = root.querySelector<HTMLButtonElement>('#audio-capture-download')
      this.trackChoices = root.querySelector<HTMLDivElement>('#audio-capture-track-choices')
      this.previewAudio = root.querySelector<HTMLAudioElement>('#audio-capture-preview')

      root.querySelector<HTMLFormElement>('#audio-capture-form')?.addEventListener('submit', (event) => {
        event.preventDefault()
        void this.loadVoices()
      })
      this.apiKeyInput?.addEventListener('input', () => this.handleApiKeyInput())
      this.apiKeyInput?.addEventListener('change', () => {
        if (this.rememberInput?.checked === true) this.updateRememberPreference()
      })
      this.rememberInput?.addEventListener('change', () => this.updateRememberPreference())
      root.querySelectorAll<HTMLElement>('[role="tablist"]').forEach((tabList) => {
        tabList.addEventListener('click', (event) => {
          if (!(event.target instanceof Element)) return
          const tab = event.target.closest<HTMLButtonElement>('[role="tab"]')
          if (tab === null || tab.parentElement !== tabList || tab.hidden || tab.disabled) return
          this.selectTab(tab)
        })
        tabList.addEventListener('keydown', (event) => this.handleTabKeydown(event, tabList))
      })
      this.generateButton?.addEventListener('click', () => void this.generateVoice())
      this.recordButton?.addEventListener('click', () => void this.toggleRecording('microphone'))
      this.cameraRecordButton?.addEventListener('click', () => void this.toggleRecording('camera'))
      this.audioFileInput?.addEventListener('change', () => this.loadSelectedAudio())
      this.chooseAudioButton?.addEventListener('click', () => {
        const input = this.audioFileInput
        if (input === null || input.disabled) return
        if (typeof input.showPicker === 'function') {
          input.showPicker()
          return
        }
        input.click()
      })
      this.transformButton?.addEventListener('click', () => void this.transformSelectedAudio())
      this.insertButton?.addEventListener('click', () => void this.insertSelectedAudio())
      this.downloadButton?.addEventListener('click', () => this.downloadGeneratedSpeech())
      this.voiceSelect?.addEventListener('change', () => this.updateWorkflowControls())
      this.ttsText?.addEventListener('input', () => this.updateWorkflowControls())
      this.transcriptText?.addEventListener('input', () => this.updateWorkflowControls())
      this.closest('dialog')?.addEventListener('close', () => {
        if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop()
        else this.cancelStartingCapture()
        this.selectDefaultTab()
      })

      this.setVoices(DEFAULT_ELEVENLABS_VOICES)
      const savedApiKey = loadRememberedElevenLabsApiKey()
      if (savedApiKey !== null) {
        if (this.apiKeyInput !== null) this.apiKeyInput.value = savedApiKey
        if (this.rememberInput !== null) this.rememberInput.checked = true
      }
      this.updateWorkflowControls()
      this.selectDefaultTab()
    }

    /** Stops browser media and revokes temporary playback URLs when removed. */
    disconnectedCallback(): void {
      this.cancelStartingCapture()
      this.stopHeadMotionCapture()
      this.stopHeadMotionRivePreview()
      const recorder = this.mediaRecorder
      this.mediaRecorder = null
      if (recorder?.state === 'recording') recorder.stop()
      this.mediaStream?.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
      this.recordingStartedAt = null
      this.recordingSource = null
      this.recordedChunks = []
      this.revokeAudioUrl()
    }

    /** Selects a tab and reveals only its labelled panel. */
    private selectTab(tab: HTMLButtonElement): void {
      const tabList = tab.parentElement
      if (!(tabList instanceof HTMLElement) || tabList.getAttribute('role') !== 'tablist') return
      const tabs = [...tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      if (!tabs.includes(tab) || tab.hidden || tab.disabled) return

      tabs.forEach((candidate) => {
        const selected = candidate === tab
        candidate.setAttribute('aria-selected', String(selected))
        candidate.tabIndex = selected ? 0 : -1
        const panelId = candidate.getAttribute('aria-controls')
        const panel = panelId === null ? null : this.shadowRoot?.getElementById(panelId)
        if (panel instanceof HTMLElement) panel.hidden = !selected
      })
    }

    /** Selects the audio track, capture, or settings according to available data. */
    private selectDefaultTab(): void {
      const tab = this.selectedVariant() !== null ? this.trackTab : this.captureTab
      if (tab !== null && !tab.hidden && !tab.disabled) this.selectTab(tab)
    }

    /** Supports standard arrow, Home, and End navigation within each tablist. */
    private handleTabKeydown(event: KeyboardEvent, tabList: HTMLElement): void {
      const tabs = [...tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        .filter((tab) => !tab.hidden && !tab.disabled)
      if (tabs.length === 0) return
      const selectedIndex = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true')
      const currentIndex = selectedIndex < 0 ? 0 : selectedIndex
      const nextIndex = event.key === 'ArrowRight'
        ? (currentIndex + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : null
      if (nextIndex === null) return

      event.preventDefault()
      const nextTab = tabs[nextIndex]
      if (nextTab === undefined) return
      this.selectTab(nextTab)
      nextTab.focus()
    }

    /** Optionally replaces the demo voices with the current account's voice list. */
    private async loadVoices(): Promise<void> {
      const apiKey = this.apiKeyInput?.value.trim() ?? ''
      if (apiKey === '') {
        this.setStatus('Saisissez une clé API ElevenLabs.', 'error')
        return
      }

      this.setBusy(true)
      this.setStatus('Chargement des voix ElevenLabs…', 'idle')

      try {
        const voices = await loadElevenLabsVoices(apiKey)
        this.setVoices(voices)
        const count = `${voices.length} voix du compte chargées.`
        this.setStatus(count, 'success')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'La liste du compte est indisponible.'
        this.setStatus(`${message} Les voix de démonstration restent disponibles.`, 'error')
        this.setBusy(false)
        return
      }

      this.setBusy(false)
    }

    /** Restores demo choices and updates optional browser storage when the key changes. */
    private handleApiKeyInput(): void {
      const apiKey = this.apiKeyInput?.value.trim() ?? ''
      this.setVoices(DEFAULT_ELEVENLABS_VOICES)
      if (apiKey === '') {
        clearRememberedElevenLabsApiKey()
        if (this.rememberInput !== null) this.rememberInput.checked = false
      }
      this.updateWorkflowControls()
    }

    /** Stores or removes the key immediately according to the browser-memory option. */
    private updateRememberPreference(): void {
      if (this.rememberInput?.checked !== true) {
        const cleared = clearRememberedElevenLabsApiKey()
        if (!cleared) this.setStatus('Le navigateur ne permet pas de modifier le stockage local.', 'error')
        return
      }

      const apiKey = this.apiKeyInput?.value.trim() ?? ''
      if (apiKey === '') {
        this.setStatus('Saisissez une clé API ElevenLabs.', 'error')
        return
      }

      const saved = rememberElevenLabsApiKey(apiKey)
      this.setStatus(
        saved ? 'Clé mémorisée.' : 'Le navigateur n’a pas pu mémoriser la clé.',
        saved ? 'success' : 'error',
      )
    }

    /** Aborts camera setup that has not yet started its audio recorder. */
    private cancelStartingCapture(): void {
      if (!this.recordingStarting) return
      this.captureController?.abort()
      this.captureController = null
      if (this.mediaRecorder?.state === 'inactive') this.mediaRecorder = null
      this.mediaStream?.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
      this.recordingSource = null
      this.recordingStartedAt = null
      this.recordedChunks = []
      this.recordingStarting = false
      this.stopHeadMotionCapture()
      this.stopHeadMotionRivePreview()
      if (this.cameraVideo !== null) {
        this.cameraVideo.hidden = true
        this.cameraVideo.srcObject = null
      }
      if (this.cameraStatus !== null) this.cameraStatus.textContent = ''
      if (this.recordButton !== null) this.recordButton.textContent = 'Commencer l’enregistrement'
      if (this.cameraRecordButton !== null) this.cameraRecordButton.textContent = 'Commencer la capture'
      this.updateWorkflowControls()
    }

    /** Stops the live tracker and returns its one in-memory motion timeline. */
    private stopHeadMotionCapture(): readonly HeadMotionSample[] {
      const session = this.headMotionSession
      this.headMotionSession = null
      if (session === null) return []
      return session.stop()
    }

    /** Releases the temporary Rive target shown beside the camera preview. */
    private stopHeadMotionRivePreview(): void {
      const preview = this.headMotionRivePreview
      this.headMotionRivePreview = null
      preview?.stop()
      if (this.cameraTargetCanvas !== null) this.cameraTargetCanvas.hidden = true
      if (this.cameraPreviews !== null) this.cameraPreviews.dataset.targetActive = 'false'
    }

    /** Reads the optional Rive target profile supplied by the embedding Avatar editor. */
    private readHeadMotionRivePreviewConfig(): HeadMotionRivePreviewConfig | null {
      const runtimeSrc = this.getAttribute('data-head-target-runtime-src')
      const src = this.getAttribute('data-head-target-src')
      if (src === null || src === '') return null
      const artboard = this.getAttribute('data-head-target-artboard')
      const stateMachine = this.getAttribute('data-head-target-state-machine')
      const viewModel = this.getAttribute('data-head-target-view-model')
      const instance = this.getAttribute('data-head-target-instance')
      if (runtimeSrc === null || runtimeSrc === '' || artboard === null || artboard === ''
        || stateMachine === null || stateMachine === ''
        || viewModel === null || viewModel === '' || instance === null || instance === '') {
        throw new Error('La configuration de la cible Avatar est incomplète.')
      }
      return { runtimeSrc, src, artboard, stateMachine, viewModel, instance }
    }

    /** Replaces the voice selector with one supplied voice list. */
    private setVoices(voices: readonly ElevenLabsVoice[]): void {
      if (this.voiceSelect === null) return

      this.voiceSelect.replaceChildren(...voices.map((voice) => {
        const option = this.ownerDocument.createElement('option')
        option.value = voice.voiceId
        option.textContent = voice.name
        return option
      }))
      const defaultVoiceIndex = voices.findIndex(({ voiceId }) => voiceId === DEFAULT_ELEVENLABS_VOICE_ID)
      this.voiceSelect.selectedIndex = voices.length === 0 ? -1 : Math.max(defaultVoiceIndex, 0)
      this.voiceSelect.disabled = voices.length === 0
      this.updateWorkflowControls()
    }

    /** Updates the accessible status and its presentation state. */
    private setStatus(message: string, state: 'idle' | 'success' | 'error'): void {
      if (this.statusNode === null) return
      this.statusNode.textContent = message
      this.statusNode.dataset.state = state
    }

    /** Disables controls while the voices are being loaded. */
    private setBusy(busy: boolean): void {
      this.busy = busy
      if (this.apiKeyInput !== null) this.apiKeyInput.disabled = busy
      if (this.rememberInput !== null) this.rememberInput.disabled = busy
      if (this.loadVoicesButton !== null) this.loadVoicesButton.disabled = busy
      if (this.ttsText !== null) this.ttsText.disabled = busy
      if (this.transcriptText !== null) this.transcriptText.disabled = busy
      if (this.audioFileInput !== null) this.audioFileInput.disabled = busy
      if (this.chooseAudioButton !== null) this.chooseAudioButton.disabled = busy
      if (busy && this.voiceSelect !== null) this.voiceSelect.disabled = true
      if (!busy && this.voiceSelect !== null && this.voiceSelect.options.length > 1) this.voiceSelect.disabled = false
      this.updateWorkflowControls()
    }

    /** Generates selected-voice speech and keeps its audio and word timings together. */
    private async generateVoice(): Promise<void> {
      const apiKey = this.apiKeyInput?.value.trim() ?? ''
      const voiceId = this.voiceSelect?.value ?? ''
      if (apiKey === '' || voiceId === '') {
        this.setStatus('Saisissez une clé et choisissez une voix ElevenLabs.', 'error')
        return
      }

      this.setOperationBusy(true)
      this.setStatus('Génération de la voix ElevenLabs…', 'idle')
      try {
        const modelId = this.modelSelect?.value
        if (modelId !== 'eleven_multilingual_v2' && modelId !== 'eleven_flash_v2_5' && modelId !== 'eleven_turbo_v2_5') {
          throw new Error('Choisissez un modèle de voix ElevenLabs.')
        }
        const speech = await generateSpeechWithTimestamps(apiKey, voiceId, this.ttsText?.value ?? '', modelId)
        this.addVariant({
          id: 'tts',
          label: 'Voix TTS',
          fileName: 'voix-elevenlabs.mp3',
          audio: speech.audio,
          characters: speech.characters,
          transcript: speech.transcript,
          words: speech.words,
          headMotion: [],
          headMotionDurationMs: null,
        })
        if (this.transcriptText !== null) this.transcriptText.value = speech.transcript
        this.setStatus('Voix générée.', 'success')
      } catch (error) {
        this.setStatus(error instanceof Error ? error.message : 'La voix n’a pas pu être générée.', 'error')
      }
      this.setOperationBusy(false)
    }

    /** Captures microphone audio, optionally starting camera tracking on the same take. */
    private async toggleRecording(source: 'microphone' | 'camera'): Promise<void> {
      if (this.mediaRecorder !== null) {
        if (this.recordingSource === source && this.mediaRecorder.state === 'recording') this.mediaRecorder.stop()
        return
      }
      if (this.recordingStarting || this.busy) return
      if (typeof navigator === 'undefined' || navigator.mediaDevices?.getUserMedia === undefined
        || typeof MediaRecorder === 'undefined') {
        this.setStatus('Ce navigateur ne permet pas la captation demandée.', 'error')
        return
      }

      this.recordingStarting = true
      this.recordingSource = source
      const controller = new AbortController()
      this.captureController = controller
      this.updateWorkflowControls()
      this.setStatus(source === 'camera' ? 'Autorisation de la caméra…' : 'Autorisation du microphone…', 'idle')
      let faceDetectedDuringSetup: boolean | null = null

      try {
        const cameraStream = source === 'camera'
          ? await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false,
          })
          : null
        if (controller.signal.aborted || !this.isConnected) {
          cameraStream?.getTracks().forEach((track) => track.stop())
          return
        }
        if (cameraStream !== null) {
          this.mediaStream = cameraStream
          const video = this.cameraVideo
          if (video === null) throw new Error('L’aperçu caméra est indisponible.')
          video.hidden = false
          video.srcObject = cameraStream
          video.muted = true
          video.playsInline = true
          await video.play()
        }

        this.setStatus('Autorisation du microphone…', 'idle')
        const microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch((error: unknown) => {
          if (error instanceof Error && error.name === 'NotAllowedError') {
            throw new Error('Autorisez l’accès au microphone dans la barre d’adresse du navigateur, puis réessayez.')
          }
          throw error
        })
        if (controller.signal.aborted || !this.isConnected) {
          microphoneStream.getTracks().forEach((track) => track.stop())
          cameraStream?.getTracks().forEach((track) => track.stop())
          this.mediaStream = null
          return
        }
        const stream = cameraStream === null
          ? microphoneStream
          : new MediaStream([...cameraStream.getVideoTracks(), ...microphoneStream.getAudioTracks()])
        this.mediaStream = stream
        if (stream.getAudioTracks().length === 0) throw new Error('Aucune piste microphone n’est disponible.')

        if (cameraStream !== null) {
          const video = this.cameraVideo
          if (video === null) throw new Error('L’aperçu caméra est indisponible.')
          if (this.cameraStatus !== null) this.cameraStatus.textContent = 'Initialisation du suivi…'
          const previewConfig = this.readHeadMotionRivePreviewConfig()
          if (previewConfig !== null) {
            const targetCanvas = this.cameraTargetCanvas
            if (targetCanvas === null) throw new Error('La cible Avatar est indisponible.')
            if (this.cameraPreviews !== null) this.cameraPreviews.dataset.targetActive = 'true'
            this.headMotionRivePreview = await startHeadMotionRivePreview(targetCanvas, previewConfig, controller.signal)
            targetCanvas.hidden = false
          }
          this.headMotionSession = await startHeadMotionCapture(video, cameraStream, {
            getTimeMs: () => this.recordingStartedAt === null
              ? null
              : performance.now() - this.recordingStartedAt,
            onFaceDetected: (detected) => {
              faceDetectedDuringSetup = detected
              if (this.cameraStatus !== null) this.cameraStatus.textContent = detected ? 'Visage détecté.' : 'Visage introuvable.'
            },
            onMotion: (values) => this.headMotionRivePreview?.setValues(values),
            signal: controller.signal,
          })
          if (controller.signal.aborted || !this.isConnected) {
            this.stopHeadMotionCapture()
            this.mediaStream?.getTracks().forEach((track) => track.stop())
            return
          }
        }

        const audioStream = source === 'camera' ? new MediaStream(stream.getAudioTracks()) : stream
        const supportedType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
          .find((type) => MediaRecorder.isTypeSupported(type))
        this.recordedChunks = []
        const recorder = supportedType === undefined
          ? new MediaRecorder(audioStream)
          : new MediaRecorder(audioStream, { mimeType: supportedType })
        this.mediaRecorder = recorder
        recorder.addEventListener('start', () => { this.recordingStartedAt = performance.now() }, { once: true })
        recorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) this.recordedChunks.push(event.data)
        })
        recorder.addEventListener('stop', () => this.finishRecording(), { once: true })
        recorder.start()
        this.recordingStarting = false
        this.captureController = null
        if (source === 'microphone' && this.recordButton !== null) this.recordButton.textContent = 'Arrêter l’enregistrement'
        if (source === 'camera' && this.cameraRecordButton !== null) this.cameraRecordButton.textContent = 'Arrêter la capture'
        if (this.cameraStatus !== null && source === 'camera') {
          this.cameraStatus.textContent = faceDetectedDuringSetup === null
            ? 'Capture en cours…'
            : faceDetectedDuringSetup ? 'Visage détecté.' : 'Visage introuvable.'
        }
        this.setStatus(source === 'camera' ? 'Capture caméra en cours…' : 'Enregistrement en cours…', 'idle')
        this.updateWorkflowControls()
      } catch (error) {
        const wasAborted = controller.signal.aborted
        this.cancelStartingCapture()
        if (wasAborted || !this.isConnected) return
        const permissionMessage = source === 'camera'
          ? 'Autorisez l’accès à la caméra dans la barre d’adresse du navigateur, puis réessayez.'
          : 'Autorisez l’accès au microphone dans la barre d’adresse du navigateur, puis réessayez.'
        const message = error instanceof Error && error.name === 'NotAllowedError'
          ? permissionMessage
          : error instanceof Error ? error.message : ''
        this.setStatus(message || (source === 'camera'
          ? 'La caméra ou le microphone est indisponible. Vérifiez leur autorisation dans le navigateur.'
          : 'Le microphone est indisponible. Vérifiez son autorisation dans le navigateur.'), 'error')
      }
    }

    /** Downloads the generated MP3 with its spoken text in the comment metadata. */
    private downloadGeneratedSpeech(): void {
      const variant = this.selectedVariant()
      if (variant?.id !== 'tts') return

      const audio = createMp3WithComment(variant.audio, variant.transcript)
      const objectUrl = URL.createObjectURL(audio)
      const link = this.ownerDocument.createElement('a')
      link.id = 'audio-capture-generated-download'
      link.href = objectUrl
      link.download = variant.fileName
      this.ownerDocument.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
    }

    /** Finishes one local take and releases the microphone and optional camera. */
    private finishRecording(): void {
      const recorder = this.mediaRecorder
      if (recorder === null) return
      const source = this.recordingSource
      const captureDurationMs = this.recordingStartedAt === null
        ? 0
        : Math.round(Math.max(0, performance.now() - this.recordingStartedAt))
      const headMotion = source === 'camera' ? this.stopHeadMotionCapture() : []
      this.stopHeadMotionRivePreview()
      const audio = new Blob(this.recordedChunks, { type: recorder.mimeType || 'audio/webm' })
      this.captureController?.abort()
      this.captureController = null
      this.mediaStream?.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
      this.mediaRecorder = null
      this.recordedChunks = []
      this.recordingStartedAt = null
      this.recordingSource = null
      this.recordingStarting = false
      if (this.cameraVideo !== null) {
        this.cameraVideo.hidden = true
        this.cameraVideo.srcObject = null
      }
      if (this.cameraTargetCanvas !== null) this.cameraTargetCanvas.hidden = true
      if (this.cameraPreviews !== null) this.cameraPreviews.dataset.targetActive = 'false'
      if (this.cameraStatus !== null) this.cameraStatus.textContent = ''
      if (this.recordButton !== null) this.recordButton.textContent = 'Commencer l’enregistrement'
      if (this.cameraRecordButton !== null) this.cameraRecordButton.textContent = 'Commencer la capture'
      this.updateWorkflowControls()
      if (!this.isConnected) return
      if (audio.size === 0) {
        this.setStatus('Aucun son n’a été capté.', 'error')
        return
      }

      const extension = audio.type.includes('mp4') ? 'm4a' : 'webm'
      this.addVariant({
        id: source === 'camera' ? 'camera' : 'recording',
        label: source === 'camera' ? 'Captation caméra' : 'Captation originale',
        fileName: source === 'camera' ? `captation-camera.${extension}` : `captation.${extension}`,
        audio,
        characters: null,
        transcript: '',
        words: null,
        headMotion,
        headMotionDurationMs: source === 'camera' ? captureDurationMs : null,
      })
      this.setStatus(source === 'camera' ? 'Capture caméra terminée.' : 'Enregistrement terminé.', 'success')
    }

    /** Loads a locally selected audio file as the original track for this capture. */
    private loadSelectedAudio(): void {
      if (this.audioFileInput === null) return
      const audioFile = this.audioFileInput.files?.[0]
      if (audioFile === undefined) return
      this.audioFileInput.value = ''
      if (audioFile.type !== '' && !audioFile.type.startsWith('audio/')) {
        this.setStatus('Choisissez un fichier audio.', 'error')
        return
      }
      if (audioFile.size === 0) {
        this.setStatus('Le fichier audio est vide.', 'error')
        return
      }

      this.addVariant({
        id: 'loaded',
        label: `Audio chargé · ${audioFile.name}`,
        fileName: audioFile.name || 'audio-charge.mp3',
        audio: audioFile,
        characters: null,
        transcript: '',
        words: null,
        headMotion: [],
        headMotionDurationMs: null,
      })
      this.setStatus('Audio chargé.', 'success')
    }

    /** Creates a separate voice-converted variant and leaves the source unchanged. */
    private async transformSelectedAudio(): Promise<void> {
      const apiKey = this.apiKeyInput?.value.trim() ?? ''
      const voiceId = this.voiceSelect?.value ?? ''
      const source = this.selectedVariant()
      if (apiKey === '' || voiceId === '' || source === null || source.id === 'transformed') return

      this.setOperationBusy(true)
      this.setStatus('Transformation vocale ElevenLabs…', 'idle')
      try {
        const audio = await transformVoice(apiKey, voiceId, source.audio, source.fileName)
        const transformed: AudioVariant = {
          id: 'transformed',
          label: 'Voix transformée',
          fileName: 'voix-transformee.mp3',
          audio,
          characters: null,
          transcript: source.transcript,
          words: null,
          headMotion: source.headMotion,
          headMotionDurationMs: source.headMotionDurationMs,
        }
        this.variants.set(transformed.id, transformed)
        this.renderTrackChoices()
        this.setStatus('Voix transformée.', 'success')
      } catch (error) {
        this.setStatus(error instanceof Error ? error.message : 'La transformation vocale a échoué.', 'error')
      }
      this.setOperationBusy(false)
    }

    /** Builds the demo-compatible Avatar data and transfers both generated files to the host editor. */
    private async insertSelectedAudio(): Promise<void> {
      if (this.recordingStarting || this.mediaRecorder !== null) return
      let variant = this.selectedVariant()
      if (variant === null) return

      const apiKey = this.apiKeyInput?.value.trim() ?? ''
      this.setOperationBusy(true)
      this.setStatus('Préparation du son, du transcript et des visèmes…', 'idle')
      try {
        const transcript = this.transcriptText?.value.trim() ?? ''
        if (transcript === '') throw new Error('Saisissez le texte de la prise.')

        if (variant.transcript !== transcript || variant.characters === null) {
          if (apiKey === '') throw new Error('Saisissez une clé ElevenLabs pour aligner le texte sur le son choisi.')
          this.setStatus('Alignement du texte et des caractères sur le son…', 'idle')
          const alignment = await alignAudioToText(apiKey, variant.audio, variant.fileName, transcript)
          variant = { ...variant, transcript, words: alignment.words, characters: alignment.characters }
          this.updateVariant(variant)
        }

        if (variant.characters === null || variant.words === null) {
          throw new Error('Le transcript et son alignement caractère sont nécessaires pour créer l’Avatar.')
        }
        const visemes = buildFrenchAzureVisemes(variant.characters)
        if (visemes.length === 0) throw new Error('La timeline des visèmes est vide pour cette prise.')
        if (variant.headMotion.length > 0) {
          const captureDurationMs = variant.headMotionDurationMs
          if (captureDurationMs === null || captureDurationMs <= 0) {
            throw new Error('La durée de la captation caméra est indisponible pour aligner les mouvements.')
          }
          const audioDurationMs = await this.readAudioDurationMs(variant.audio)
          const samplesByTime = new Map<number, HeadMotionSample>()
          const firstSample = variant.headMotion[0]
          if (firstSample !== undefined && firstSample.startAtMs > 0) {
            samplesByTime.set(0, { startAtMs: 0, values: { headX: 50, headY: 50, headTilt: 50 } })
          }
          variant.headMotion.forEach((sample) => {
            const startAtMs = Math.max(0, Math.min(audioDurationMs, Math.round(sample.startAtMs / captureDurationMs * audioDurationMs)))
            samplesByTime.set(startAtMs, { ...sample, startAtMs })
          })
          const lastSample = [...samplesByTime.values()].sort((first, second) => first.startAtMs - second.startAtMs).at(-1)
          if (lastSample !== undefined && lastSample.startAtMs < audioDurationMs
            && (lastSample.values.headX !== 50 || lastSample.values.headY !== 50 || lastSample.values.headTilt !== 50)) {
            samplesByTime.set(audioDurationMs, {
              startAtMs: audioDurationMs,
              values: { headX: 50, headY: 50, headTilt: 50 },
            })
          }
          variant = {
            ...variant,
            headMotion: [...samplesByTime.values()].sort((first, second) => first.startAtMs - second.startAtMs),
            headMotionDurationMs: audioDurationMs,
          }
          this.updateVariant(variant)
        }
        const audioFile = new File([variant.audio], variant.fileName, { type: variant.audio.type || 'audio/mpeg' })
        const timelineFile = new File([JSON.stringify({
          text: transcript,
          rules: 'fr',
          shapeSet: 'azure',
          target: 'viewModel',
          input: null,
          words: variant.words,
          visemes,
          ...(variant.headMotion.length === 0 ? {} : { headMotion: variant.headMotion }),
        })], 'avatar-timeline.json', { type: 'application/json' })

        this.setStatus('Insertion de la prise dans le BDC Avatar…', 'idle')
        await new Promise<void>((resolve, reject) => {
          let completed = false
          const complete = (error?: string): void => {
            if (completed) return
            completed = true
            if (error !== undefined) reject(new Error(error))
            else resolve()
          }
          const event = new CustomEvent<AudioCaptureInsertEventDetail>('audio-capture-insert', {
            detail: { audio: audioFile, timeline: timelineFile, complete },
            bubbles: true,
            composed: true,
            cancelable: true,
          })
          if (this.dispatchEvent(event)) reject(new Error('Aucun éditeur Avatar n’a reçu les fichiers à insérer.'))
        })
        this.setStatus('Prise insérée.', 'success')
      } catch (error) {
        this.setStatus(error instanceof Error ? error.message : 'La prise n’a pas pu être insérée dans l’Avatar.', 'error')
      }
      this.setOperationBusy(false)
    }

    /** Reads the selected audio duration so captured motion stays inside its final timeline. */
    private async readAudioDurationMs(audioBlob: Blob): Promise<number> {
      const source = URL.createObjectURL(audioBlob)
      const audio = this.ownerDocument.createElement('audio')
      const duration = await new Promise<number>((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => resolve(audio.duration), { once: true })
        audio.addEventListener('error', () => reject(new Error('Le fichier audio ne peut pas être lu.')), { once: true })
        audio.src = source
      }).finally(() => {
        audio.removeAttribute('src')
        audio.load()
        URL.revokeObjectURL(source)
      })
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('La durée du fichier audio est indisponible.')
      return Math.round(duration * 1000)
    }

    /** Adds or replaces a local audio variant and selects it for preview. */
    private addVariant(variant: AudioVariant): void {
      this.stopHeadMotionCapture()
      this.variants.set(variant.id, variant)
      this.selectedVariantId = variant.id
      this.renderTrackChoices()
      if (this.transcriptText !== null) this.transcriptText.value = variant.transcript
      this.setPreview(variant.audio)
      if (this.trackPanel !== null) this.trackPanel.hidden = false
      this.updateWorkflowControls()
      if (this.trackTab !== null) this.selectTab(this.trackTab)
    }

    /** Updates a variant after transcription or alignment without replacing its audio. */
    private updateVariant(variant: AudioVariant): void {
      this.variants.set(variant.id, variant)
      this.renderTrackChoices()
      this.updateWorkflowControls()
    }

    /** Renders explicit radio choices for every original and transformed track. */
    private renderTrackChoices(): void {
      if (this.trackChoices === null) return
      this.trackChoices.replaceChildren(...Array.from(this.variants.values(), (variant) => {
        const label = this.ownerDocument.createElement('label')
        label.id = `audio-capture-track-label-${variant.id}`
        const input = this.ownerDocument.createElement('input')
        input.type = 'radio'
        input.name = 'audio-capture-selected-track'
        input.value = variant.id
        input.checked = variant.id === this.selectedVariantId
        input.addEventListener('change', () => this.selectVariant(variant.id))
        const caption = this.ownerDocument.createElement('span')
        caption.id = `audio-capture-track-caption-${variant.id}`
        caption.textContent = variant.label
        label.append(input, caption)
        return label
      }))
    }

    /** Selects an audio variant and clears timings that belong to the previous track. */
    private selectVariant(id: AudioVariant['id']): void {
      const variant = this.variants.get(id)
      if (variant === undefined) return
      if (id !== this.selectedVariantId) this.stopHeadMotionCapture()
      this.selectedVariantId = id
      if (this.transcriptText !== null) this.transcriptText.value = variant.transcript
      this.setPreview(variant.audio)
      this.updateWorkflowControls()
    }

    /** Returns the currently selected local audio track. */
    private selectedVariant(): AudioVariant | null {
      return this.selectedVariantId === null ? null : this.variants.get(this.selectedVariantId) ?? null
    }

    /** Loads one in-memory audio candidate into the browser preview. */
    private setPreview(audio: Blob): void {
      if (this.previewAudio === null) return
      this.revokeAudioUrl()
      this.audioUrl = URL.createObjectURL(audio)
      this.previewAudio.src = this.audioUrl
      this.previewAudio.hidden = false
    }

    /** Releases the previous object URL when the preview source changes. */
    private revokeAudioUrl(): void {
      if (this.audioUrl === null) return
      URL.revokeObjectURL(this.audioUrl)
      this.audioUrl = null
    }

    /** Enables each provider operation when its local inputs are ready. */
    private updateWorkflowControls(): void {
      const hasApiKey = (this.apiKeyInput?.value.trim() ?? '') !== ''
      const hasVoice = (this.voiceSelect?.value ?? '') !== ''
      const hasSpeechText = (this.ttsText?.value.trim() ?? '') !== ''
      const hasAudio = this.selectedVariant() !== null
      const recording = this.mediaRecorder !== null
      const capturing = this.recordingStarting || recording
      if (this.trackTab !== null) {
        this.trackTab.disabled = !hasAudio || capturing
        this.trackTab.setAttribute('aria-disabled', String(!hasAudio || capturing))
      }
      const settingsTab = this.shadowRoot?.querySelector<HTMLButtonElement>('#audio-capture-settings-tab')
      if (settingsTab !== null && settingsTab !== undefined) settingsTab.disabled = capturing
      const sourceTabId = this.recordingSource === 'camera' ? 'audio-capture-camera-tab' : 'audio-capture-microphone-tab'
      this.shadowRoot?.querySelectorAll<HTMLButtonElement>('#audio-capture-source-tabs [role="tab"]')
        .forEach((tab) => { tab.disabled = capturing && tab.id !== sourceTabId })
      const variant = this.selectedVariant()
      if (this.downloadButton !== null) this.downloadButton.hidden = variant?.id !== 'tts'
      if (this.voiceSelect !== null) {
        this.voiceSelect.disabled = this.busy || capturing || this.voiceSelect.options.length <= 1
      }
      if (this.modelSelect !== null) this.modelSelect.disabled = this.busy || capturing
      if (this.ttsText !== null) this.ttsText.disabled = this.busy || capturing
      if (this.transcriptText !== null) this.transcriptText.disabled = this.busy || capturing
      if (this.audioFileInput !== null) this.audioFileInput.disabled = this.busy || capturing
      if (this.chooseAudioButton !== null) this.chooseAudioButton.disabled = this.busy || capturing
      if (this.generateButton !== null) this.generateButton.disabled = this.busy || capturing || !hasApiKey || !hasVoice || !hasSpeechText
      if (this.recordButton !== null) {
        this.recordButton.disabled = this.busy || this.recordingStarting || (recording && this.recordingSource !== 'microphone')
      }
      if (this.cameraRecordButton !== null) {
        this.cameraRecordButton.disabled = this.busy || this.recordingStarting || (recording && this.recordingSource !== 'camera')
      }
      if (this.transformButton !== null) {
        const source = this.selectedVariant()
        const canTransform = source?.id === 'recording' || source?.id === 'camera' || source?.id === 'loaded'
        this.transformButton.disabled = this.busy || capturing || !hasApiKey || !hasVoice || !hasAudio || !canTransform
      }
      if (this.insertButton !== null) {
        const transcript = this.transcriptText?.value.trim() ?? ''
        const characterTimingReady = variant !== null && variant.characters !== null && variant.transcript === transcript
        this.insertButton.disabled = this.busy || capturing || variant === null || (!characterTimingReady && !hasApiKey)
      }
      this.trackChoices?.querySelectorAll<HTMLInputElement>('input[type="radio"]')
        .forEach((input) => { input.disabled = capturing || this.busy })
    }

    /** Marks API work busy while preserving the current audio and transcript in memory. */
    private setOperationBusy(busy: boolean): void {
      this.setBusy(busy)
      if (this.recordButton !== null) this.recordButton.disabled = busy && this.mediaRecorder === null
      this.updateWorkflowControls()
    }

  }

  customElements.define('codplay-audio-capture', AudioCaptureElement)
}
