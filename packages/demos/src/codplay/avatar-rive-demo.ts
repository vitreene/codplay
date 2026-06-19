import { RuntimeLoader } from '@rive-app/canvas'
import { createAvatarRiveBinding } from '@codplay/avatar-rive'
import { createAvatarRiveScene } from '../scenes/avatar-rive-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

const AVATAR_W = 600
const AVATAR_H = 600

const RIV_SRC = '/avatars/coach.riv'
const ARTBOARD = 'Coach model'
const STATE_MACHINE = 'State Machine 1'
const INPUT_LIPS = 'lips sync id'
const INPUT_EMOTION = 'emotion'

export function runAvatarRiveDemo(): Promise<void> {
  return runCodPlaySceneDemo({
    title: 'Avatar Rive — CodPlay',
    subtitle: 'Marionnette Rive pilotée frame-par-frame par CodPlay — aucun RAF Rive propre.',
    scene: createAvatarRiveScene(),
    activeDemo: 'avatar-rive',

    async setup() {
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_W
      canvas.height = AVATAR_H
      canvas.style.cssText = 'width:100%;height:100%;display:block;'

      // API bas-niveau Rive — CodPlay est le seul producteur de frames.
      const rc = await RuntimeLoader.awaitInstance()

      const renderer = rc.makeRenderer(canvas)

      const bytes = await fetch(RIV_SRC).then((r) => {
        if (!r.ok) throw new Error(`[avatar-rive] HTTP ${r.status} pour ${RIV_SRC}`)
        return r.arrayBuffer()
      })

      const file = await rc.load(new Uint8Array(bytes))
      const artboard = file.artboardByName(ARTBOARD)
      if (!artboard) throw new Error(`[avatar-rive] artboard "${ARTBOARD}" introuvable`)

      const smRef = artboard.stateMachineByName(STATE_MACHINE)
      if (!smRef) throw new Error(`[avatar-rive] state machine "${STATE_MACHINE}" introuvable`)

      const smInstance = new rc.StateMachineInstance(smRef, artboard)

      // Recherche des inputs par nom.
      let lipsSyncInput: { value: number | boolean | undefined } | null = null
      let emotionInput: { value: number | boolean | undefined } | undefined
      const count = smInstance.inputCount()
      for (let i = 0; i < count; i++) {
        const inp = smInstance.input(i)
        // asNumber() est requis : SMIInput générique n'applique pas .value sur le WASM
        // sans être casté vers le type concret de l'input.
        if (inp.name === INPUT_LIPS) lipsSyncInput = inp.asNumber()
        if (inp.name === INPUT_EMOTION) emotionInput = inp.asNumber()
      }
      if (!lipsSyncInput) {
        throw new Error(`[avatar-rive] input "${INPUT_LIPS}" introuvable dans "${STATE_MACHINE}"`)
      }

      // La fonction drawFrame est définie ici — elle connaît rc, renderer, artboard, canvas.
      // Elle est passée au binding pour que l'adapter puisse rendre sans connaître l'API Rive.
      const frame = { minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height }
      const drawFrame = (): void => {
        renderer.clear()
        renderer.save()
        renderer.align(rc.Fit.contain, rc.Alignment.center, frame, artboard.bounds)
        artboard.draw(renderer)
        renderer.restore()
        rc.resolveAnimationFrame()
      }

      const { componentClass, renderAdapter } = createAvatarRiveBinding({
        canvas,
        lipsSyncInput,
        emotionInput,
        stateMachineInstance: smInstance,
        artboard,
        drawFrame,
      })

      return {
        components: { 'avatar-rive': componentClass },
        renderAdapters: [renderAdapter],
      }
    },
  })
}
