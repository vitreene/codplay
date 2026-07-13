import type { Actor } from 'xstate'
import './app-layout.css'
import type { controllerMachine } from '../controller/controller-machine'
import { DemoMenuRegion } from './DemoMenuRegion'
import { DemoPanelRegion } from './DemoPanelRegion'
import { SequenceEditorRegion } from './SequenceEditorRegion'

export interface AppLayoutProps {
  controller: Actor<typeof controllerMachine>
}

/**
 * Menu/panel restent la démonstration temporaire de l'étape 2 (`app/2026-07-10-app-construction-
 * plan.md`) — remplacées par les vraies régions en dernier (`2026-07-13-controller-islands-bridge-
 * plan.md` §7 étape 6). Timeline est la vraie région (`SequenceEditorRegion`, pont §3.1). Scène,
 * chutier, telco restent vides — hors périmètre de ce sous-plan.
 */
export function AppLayout({ controller }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <div className="app-region app-region--menu">
        <DemoMenuRegion controller={controller} />
      </div>
      <div className="app-region app-region--chutier" />
      <div className="app-region app-region--scene" />
      <div className="app-region app-region--panel">
        <DemoPanelRegion controller={controller} />
      </div>
      <div className="app-region app-region--timeline">
        <SequenceEditorRegion controller={controller} />
      </div>
      <div className="app-region app-region--telco" />
    </div>
  )
}
