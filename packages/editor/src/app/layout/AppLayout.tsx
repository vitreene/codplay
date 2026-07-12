import type { Actor } from 'xstate'
import './app-layout.css'
import type { controllerMachine } from '../controller/controller-machine'
import { DemoMenuRegion } from './DemoMenuRegion'
import { DemoPanelRegion } from './DemoPanelRegion'

export interface AppLayoutProps {
  controller: Actor<typeof controllerMachine>
}

/**
 * Démonstration de l'étape 2 (`app/2026-07-10-app-construction-plan.md`) : une mutation envoyée
 * depuis la région menu (RUN_COMMAND) se reflète dans la région panel — les deux lisent le MÊME
 * contexte de contrôleur, aucune synchronisation croisée entre régions. Les autres régions restent
 * vides (squelette, étape 1) — leur contenu réel vient à l'étape 3.
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
      <div className="app-region app-region--timeline" />
      <div className="app-region app-region--telco" />
    </div>
  )
}
