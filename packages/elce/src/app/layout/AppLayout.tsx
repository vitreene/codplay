import { useSelector } from '@xstate/react'
import type { Actor } from 'xstate'
import type { controllerMachine } from '../controller/controller-machine'
import './app-layout.css'

export interface AppLayoutProps {
  readonly controller: Actor<typeof controllerMachine>
}

/** Renders the initial Elcé work area from the controller-owned application state. */
export function AppLayout({ controller }: AppLayoutProps) {
  const stateValue = useSelector(controller, (snapshot) => String(snapshot.value))

  return (
    <div id="elce-workspace" className="elce-workspace">
      <header id="elce-header" className="elce-header">
        <div id="elce-brand" className="elce-brand">
          <span id="elce-brand-name">Elcé</span>
          <span id="elce-brand-status">POC</span>
        </div>
        <span id="elce-controller-state" className="elce-controller-state">
          état : {stateValue}
        </span>
      </header>
      <main id="elce-main" className="elce-main">
        <section id="elce-outline" className="elce-panel">
          <h1 id="elce-outline-title">Scénario</h1>
          <p id="elce-outline-empty">Le document Elcé sera créé à l’étape suivante.</p>
        </section>
        <section id="elce-work-area" className="elce-panel elce-work-area">
          <h1 id="elce-work-area-title">Zone de travail</h1>
          <p id="elce-work-area-description">L’éditeur et le player seront construits ici.</p>
        </section>
        <aside id="elce-properties" className="elce-panel">
          <h1 id="elce-properties-title">Propriétés</h1>
          <p id="elce-properties-empty">Aucune sélection.</p>
        </aside>
      </main>
    </div>
  )
}
