import { useEffect } from 'react'
import type { Actor } from 'xstate'
import './app-layout.css'
import type { controllerMachine } from '../controller/controller-machine'
import { DemoMenuRegion } from './DemoMenuRegion'
import { SequenceEditorRegion } from './SequenceEditorRegion'
import { ScenePlayerRegion } from './ScenePlayerRegion'
import { DecorEditorRegion } from './DecorEditorRegion'

export interface AppLayoutProps {
  controller: Actor<typeof controllerMachine>
}

/**
 * Fin de phase explicite (`2026-07-16-rebuild-ordering-execution-plan.md` §4.2) — Échap ou clic sur
 * le fond de scène (hors CS) clôt la sélection en cours plutôt que de la laisser expirer par
 * timeout. `CLEAR_SELECTION` existe dans `controller-machine.ts` depuis le début mais n'était
 * envoyé nulle part — seul point d'entrée manquant, le pont `scenePlayer` gère déjà correctement
 * une sélection vide (`selectItem([])` dans `scene-player-bridge.ts`).
 */
function useClearSelectionShortcuts(controller: Actor<typeof controllerMachine>): void {
  useEffect(() => {
    const hasSelection = (): boolean => controller.getSnapshot().context.selection.itemIds.length > 0

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      // Même garde que `sequence-editor/mount.ts` — ne pas voler Échap à un champ en cours d'édition.
      const target = event.target
      if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (!hasSelection()) return
      controller.send({ type: 'CLEAR_SELECTION' })
    }

    const onMouseDown = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      // Uniquement le fond de la scène — jamais un clic dans le panneau, la timeline ou le menu
      // (qui gardent leur propre sémantique), et jamais un clic sur le CS lui-même (ses poignées
      // sont montées à l'intérieur de la même région scène).
      if (target.closest('.app-region--scene') === null) return
      if (target.closest('[data-selection-frame]') !== null) return
      if (!hasSelection()) return
      controller.send({ type: 'CLEAR_SELECTION' })
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [controller])
}

/**
 * Menu reste la démonstration temporaire de l'étape 2 (`app/2026-07-10-app-construction-plan.md`)
 * — remplacé par la vraie région en dernier (`2026-07-13-controller-islands-bridge-plan.md` §7
 * étape 6). Scène, timeline, panneau sont les vraies régions (ponts §3.1/§3.2/§3.3). Chutier, telco
 * restent vides — hors périmètre de ce sous-plan.
 */
export function AppLayout({ controller }: AppLayoutProps) {
  useClearSelectionShortcuts(controller)
  return (
    <div className="app-layout">
      <div className="app-region app-region--menu">
        <DemoMenuRegion controller={controller} />
      </div>
      <div className="app-region app-region--chutier" />
      <div className="app-region app-region--scene">
        <ScenePlayerRegion controller={controller} />
      </div>
      <div className="app-region app-region--panel">
        <DecorEditorRegion controller={controller} />
      </div>
      <div className="app-region app-region--timeline">
        <SequenceEditorRegion controller={controller} />
      </div>
      <div className="app-region app-region--telco" />
    </div>
  )
}
