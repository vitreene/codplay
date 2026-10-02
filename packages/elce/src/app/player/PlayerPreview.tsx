import { useEffect, useRef } from 'react'
import { ElcePlayerComposition } from '../../player/elce-player-composition'
import type { PlayerPreviewProps } from './player-preview-types'

/** Mounts the complete Elcé Sighty/CodPlay document preview in its own surface. */
export function PlayerPreview({ documentModel, selectedPageId, mediaSources }: PlayerPreviewProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const selectedPage = documentModel.pages.find((page) => page.id === selectedPageId)
  const selectedPageIsInCatalog = selectedPage !== undefined && documentModel.data.catalogPageIds.includes(selectedPage.id)

  useEffect(() => {
    const stage = stageRef.current
    if (stage === null || selectedPageIsInCatalog) return

    let disposed = false
    const composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      startPageId: selectedPageId ?? undefined,
      mediaSources,
      onLog: (message, level) => {
        if (level === 'error') console.error(`[Elcé] ${message}`)
      },
    })
    void composition.initialize().catch((error: unknown) => {
      if (!disposed) console.error('[Elcé] La prévisualisation n’a pas pu démarrer.', error)
    })

    return () => {
      disposed = true
      composition.destroy()
    }
  }, [documentModel, selectedPageId, selectedPageIsInCatalog])

  return (
    <div id="elce-player-stage" ref={stageRef} className="elce-player-stage" aria-label="Prévisualisation du document">
      {selectedPageIsInCatalog
        ? <p id="elce-player-catalog-message">Cette page est dans le catalogue et n’est pas diffusée.</p>
        : null}
    </div>
  )
}
