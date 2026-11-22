import { transcribeSpiePage004 } from './transcribe-page-004'
import pageXml from './page-004.xml?raw'
import propertiesXml from './source-properties.xml?raw'
import textXml from './source-text-fr.xml?raw'
import tique from './tique.svg?raw'
import mouche from './mouche.svg?raw'
import mosquito from './mosquito02.svg?raw'
import puce from './puce.svg?raw'
import reduve from './reduve.svg?raw'

/** Selects the SPIE page and supplies its source resources. */
export function createScene() {
  return transcribeSpiePage004({
    pageXml, propertiesXml, textXml,
    assetBase: '/assets/spie-transmission',
    audioDurationMs: 25_050.667,
    icons: {
      '04/tique.svg': tique,
      '04/mouche.svg': mouche,
      '04/mosquito02.svg': mosquito,
      '04/puce.svg': puce,
      '04/reduve.svg': reduve,
    },
  })
}
