import '../shared/demo-shell.css'

import { TalkingHead } from '@met4citizen/talkinghead'
import { phraseWordsFR, speakAudioFR } from '../scenes/avatar-data/phrase-fr'
import { buildDemoLinksMarkup } from '../shared/demo-registry'

export async function runAvatarPocDemo(): Promise<void> {
  const appNode = globalThis.document.querySelector<HTMLDivElement>('#app')
  if (appNode === null) throw new Error('Expected #app root element')

  const demoLinksMarkup = buildDemoLinksMarkup('avatar-poc')

  appNode.innerHTML = `
    <main class="demo-shell">
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

  playButton.addEventListener('click', () => {
    stateNode.textContent = 'En lecture…'
    playButton.disabled = true
    void head.speakAudio({
      audio: audioBuffer,
      ...speakAudioFR,
    }).then(() => {
      stateNode.textContent = 'Terminé'
      playButton.disabled = false
    })
  })

  stopButton.addEventListener('click', () => {
    head.stopSpeaking()
    stateNode.textContent = 'Arrêté'
    playButton.disabled = false
  })

  void phraseWordsFR // utilisé via speakAudioFR — référence pour TS
}
