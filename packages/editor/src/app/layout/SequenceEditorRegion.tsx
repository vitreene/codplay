import { useEffect, useRef } from 'react'
import type { Actor } from 'xstate'
import type { controllerMachine } from '../controller/controller-machine'
import { createSequenceEditorBridge } from '../bridges/sequence-editor-bridge'

export interface SequenceEditorRegionProps {
  controller: Actor<typeof controllerMachine>
}

/**
 * Ne porte aucune logique propre — pose le conteneur DOM et transmet la référence au pont
 * (`2026-07-13-controller-islands-bridge-plan.md` §5). Le pont possède tout : montage, câblage,
 * démontage.
 */
export function SequenceEditorRegion({ controller }: SequenceEditorRegionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const bridge = createSequenceEditorBridge(container, controller)
    return () => bridge.destroy()
  }, [controller])

  return <div ref={containerRef} className="app-region-content app-region-content--sequence-editor" />
}
