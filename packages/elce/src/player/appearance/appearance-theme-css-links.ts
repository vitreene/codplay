import { appearanceThemeCssAssetUrl } from './appearance-theme-styles.ts'

export interface AppearanceThemeCssLinks {
  readonly loaded: Promise<void>
  readonly remove: () => void
}

/** Loads authored appearance CSS assets into the player document before scene initialization. */
export function loadAppearanceThemeCssLinks(
  ownerDocument: Document,
  assetPaths: readonly string[],
): AppearanceThemeCssLinks {
  if (ownerDocument.head === null) throw new Error('Le document lecteur ne possède pas de head.')
  const links: HTMLLinkElement[] = []
  const loaded = assetPaths.map((assetPath) => new Promise<void>((resolve, reject) => {
    const link = ownerDocument.createElement('link')
    link.rel = 'stylesheet'
    link.href = appearanceThemeCssAssetUrl(assetPath)
    link.dataset.elceAppearanceCss = assetPath
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`La feuille CSS d’apparence ne peut pas être chargée : ${assetPath}`))
    links.push(link)
    ownerDocument.head.append(link)
  }))
  return {
    loaded: Promise.all(loaded).then(() => undefined),
    remove: () => {
      for (const link of links) {
        link.onload = null
        link.onerror = null
        link.remove()
      }
    },
  }
}
