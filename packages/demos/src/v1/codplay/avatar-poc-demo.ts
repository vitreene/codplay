import '../shared/demo-shell.css'

import { TalkingHead } from '@met4citizen/talkinghead'
import { phraseWordsFR, MOUTH_CUES, PRESTON_TO_TH } from '../scenes/avatar-data/phrase-fr'
import { buildDemoLinksMarkup } from '../shared/demo-registry'

// All TH viseme morph names
const ALL_VISEMES = ['PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U']

// Viseme weight — slightly boosted for better articulation
const VISEME_WEIGHT = 0.75

// Active cues only (B and X = silence, mouth returns to neutral)
const activeCues = MOUTH_CUES.filter(c => PRESTON_TO_TH[c.value] !== null)

function findActiveViseme(elapsedSec: number): string | null {
  // Find the cue whose interval contains elapsedSec
  for (let i = 0; i < activeCues.length; i++) {
    const cue = activeCues[i]!
    if (elapsedSec >= cue.start && elapsedSec < cue.end) {
      return PRESTON_TO_TH[cue.value]
    }
  }
  return null
}

function applyViseme(head: TalkingHead, visemeName: string | null): void {
  for (const v of ALL_VISEMES) {
    head.setFixedValue('viseme_' + v, v === visemeName ? VISEME_WEIGHT : 0)
  }
}

export async function runAvatarPocDemo(): Promise<void> {
  const appNode = globalThis.document.querySelector<HTMLDivElement>('#app')
  if (appNode === null) throw new Error('Expected #app root element')

  const demoLinksMarkup = buildDemoLinksMarkup('avatar-poc')

  appNode.innerHTML = `
    <main class="demo-container">
      <aside>
        <p class="eyebrow">CodPlay V1</p>
        ${demoLinksMarkup.length > 0 ? `<nav class="demo-links">${demoLinksMarkup}</nav>` : ''}
        <h1>Avatar POC (FR)</h1>
        <p class="subtitle">
          TalkingHead standalone — validation visème + lip-sync sur la phrase<br>
          <em>"Vous l'avez donc vu, l'électricité présente des risques…"</em>
        </p>
        <div class="demo-controls">
          <button id="demo-play-button" class="demo-button" type="button">Play</button>
          <button id="demo-stop-button" class="demo-button demo-button-secondary" type="button">Stop</button>
        </div>
        <div id="player-state" class="player-state"></div>
      </aside>
      <div class="container" id="demo-container" style="position:relative;background:#111;"></div>
    </main>
  `

  const containerNode = globalThis.document.querySelector<HTMLDivElement>('#demo-container')
  if (containerNode === null) throw new Error('Expected #demo-container element')

  const playButton = globalThis.document.querySelector<HTMLButtonElement>('#demo-play-button')!
  const stopButton = globalThis.document.querySelector<HTMLButtonElement>('#demo-stop-button')!
  const stateNode  = globalThis.document.querySelector<HTMLDivElement>('#player-state')!

  stateNode.textContent = 'Chargement de l\'avatar…'
  playButton.disabled = true

  const head = new TalkingHead(containerNode, {
    ttsEndpoint: null,
    lipsyncModules: ['fr', 'en'],
    cameraView: 'upper',
  })

  await head.showAvatar({
    url: '/avatars/avatarsdk.glb',
    body: 'M',
    avatarMood: 'neutral',
    lipsyncLang: 'fr',
    retarget: {
      Neck:          { z: -0.01, rx: -0.15 },
      Neck1:         { z: -0.01, rx: -0.15 },
      Neck2:         { z: -0.01, rx: -0.15 },
      LeftShoulder:  { rz: -0.3 },
      RightShoulder: { rz:  0.3 },
      scaleToEyesLevel: 1.0,
      origin: { y: -0.1 },
    },
  })

  const audioBuffer = await head.audioCtx.decodeAudioData(
    await (await fetch('/assets/1_7b_e.mp3')).arrayBuffer()
  )

  stateNode.textContent = 'Prêt'
  playButton.disabled = false

  // State for master-clock playback
  let source: AudioBufferSourceNode | null = null
  let rafId: number | null = null
  let audioStartTime = 0
  let currentViseme: string | null = null

  function stopPlayback(status: string): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (source !== null) {
      source.onended = null
      try { source.stop() } catch { /* already stopped */ }
      source = null
    }
    // Release all fixed viseme overrides so TH idle takes over
    for (const v of ALL_VISEMES) {
      head.setFixedValue('viseme_' + v, null)
    }
    currentViseme = null
    stateNode.textContent = status
    playButton.disabled = false
  }

  function tick(): void {
    const elapsed = head.audioCtx.currentTime - audioStartTime
    const viseme = findActiveViseme(elapsed)
    if (viseme !== currentViseme) {
      applyViseme(head, viseme)
      currentViseme = viseme
    }
    rafId = requestAnimationFrame(tick)
  }

  playButton.addEventListener('click', () => {
    stateNode.textContent = 'En lecture…'
    playButton.disabled = true

    source = head.audioCtx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(head.audioCtx.destination)

    source.onended = () => stopPlayback('Terminé')

    audioStartTime = head.audioCtx.currentTime
    source.start()
    rafId = requestAnimationFrame(tick)
  })

  stopButton.addEventListener('click', () => {
    stopPlayback('Arrêté')
  })

  void phraseWordsFR // utilisé pour référence TS
}
