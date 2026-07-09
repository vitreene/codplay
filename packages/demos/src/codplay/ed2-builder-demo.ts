import { createEd2BuilderDemoScene } from '../scenes/ed2-builder-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * First rendered validation of the ed2 Builder (`2026-07-08-builder-plan.md` steps 3-4): one
 * text item fading in/out over 3s, entirely produced by `buildSceneDoc()` — not hand-authored —
 * plus the Blob CSS → `extraResources` → `CodPlay.load()` mechanism (step 4), pushed here as a
 * dynamically generated Blob, never a `<style>` tag or a static file. The item's dashed outline
 * comes only from this injected stylesheet — if it renders, the mechanism works.
 */
export async function runEd2BuilderDemo(): Promise<void> {
  const { scene, styleSheet } = createEd2BuilderDemoScene()
  const styleSheetUrl = URL.createObjectURL(new Blob([styleSheet], { type: 'text/css' }))

  await runCodPlaySceneDemo({
    title: 'ed2 — Builder (premier item)',
    subtitle:
      'Scène construite par le Builder ed2 à partir d\'une fixture EditorScene — un item texte, fondu 3s, ' +
      'feuille de style injectée dynamiquement (Blob CSS, cf. son contour pointillé).',
    scene,
    activeDemo: 'ed2-builder',
    extraResources: [{ url: styleSheetUrl, type: 'css', policy: { cache: 'no-store' } }],
  })
}
