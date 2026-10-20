import type { SceneDoc } from 'codplay/scene/types'
import { createScene as createRiveCoachScene } from '../src/v2/demos/rive/scene.ts'
import { createScene as createThreeGridScene } from '../src/v2/demos/threejs-grid/main.ts'
import '../src/v2/demos/rive/style.css'
import '../src/v2/demos/threejs-grid/style.css'

/** Positions the two real V2 demos side by side inside the exported occurrence. */
export const styleSheet = `
:scope {
  position: relative;
  display: block;
  width: 1360px;
  height: 620px;
  min-height: 620px;
  overflow: hidden;
  background: #101b24;
}

#rive-coach-stage {
  position: absolute;
  top: 10px;
  left: 0;
  width: 600px;
  height: 600px;
}

:scope > [data-codplay-threejs="scene"] {
  position: absolute;
  top: 30px;
  left: 620px;
  width: 720px;
  height: 540px;
}

`

/** Creates one V2 scene that runs the real Rive coach and Three.js grid together. */
export function createScene(): SceneDoc<string> {
  const riveScene = createRiveCoachScene()
  const threeScene = createThreeGridScene()
  const riveStory = riveScene.stories['avatar-story']
  const threeStory = threeScene.stories.main
  if (riveStory === undefined || threeStory === undefined) {
    throw new Error('Rive and Three.js demonstration scenes must expose their expected stories.')
  }

  const rivePersos = riveStory.persos.map((perso) => {
    if (perso.id === 'avatar') {
      return {
        ...perso,
        initial: { ...perso.initial, src: '../public/avatars/coach.riv' },
      }
    }
    if (perso.id === 'audio') {
      return {
        ...perso,
        initial: { ...perso.initial, src: '../public/assets/1_7b_e.mp3' },
      }
    }
    return perso
  })
  const threePersos = threeStory.persos
  const persos = [...rivePersos, ...threePersos]

  return {
    id: 'rive-three-scene-export',
    stories: {
      main: {
        id: 'main',
        initial: riveStory.initial,
        persos,
        eventimes: [...(riveStory.eventimes ?? []), ...(threeStory.eventimes ?? [])],
      },
    },
  }
}

export const scene = /* @__PURE__ */ createScene()
