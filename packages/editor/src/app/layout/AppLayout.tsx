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
 * Menu reste la démonstration temporaire de l'étape 2 (`app/2026-07-10-app-construction-plan.md`)
 * — remplacé par la vraie région en dernier (`2026-07-13-controller-islands-bridge-plan.md` §7
 * étape 6). Scène, timeline, panneau sont les vraies régions (ponts §3.1/§3.2/§3.3). Chutier, telco
 * restent vides — hors périmètre de ce sous-plan.
 */
export function AppLayout({ controller }: AppLayoutProps) {
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
