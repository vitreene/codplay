import { useEffect, useRef } from 'react'
import type { Actor } from 'xstate'
import type { controllerMachine } from '../controller/controller-machine'
import { createScenePlayerBridge } from '../bridges/scene-player-bridge'

export interface ScenePlayerRegionProps {
  controller: Actor<typeof controllerMachine>
}

/**
 * Ne porte aucune logique propre — pose le conteneur DOM et transmet la référence au pont
 * (`2026-07-13-controller-islands-bridge-plan.md` §5). Le pont possède tout : rebuild, sélection,
 * démontage.
 */
export function ScenePlayerRegion({ controller }: ScenePlayerRegionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const bridge = createScenePlayerBridge(container, controller)
    return () => bridge.destroy()
  }, [controller])

  return <div ref={containerRef} className="app-region-content app-region-content--scene-player" />
}
