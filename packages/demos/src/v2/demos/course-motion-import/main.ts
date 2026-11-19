import type { SceneDoc } from 'codplay/scene/types';
import pageXml from './page-p02.xml?raw';
import globalPropertiesXml from './source-properties.xml?raw';
import textXml from './source-text-fr.xml?raw';
import { convertLegacyPage } from './legacy-page-converter';

const IMAGE_BASE_PATH = '/assets/course-access/02_acces/images';
const AUDIO_BASE_PATH = '/assets/course-access/02_acces/sounds/fr';

/** Creates the visible CodPlay scene from page p02 and its four source sequences. */
export function createScene(): SceneDoc {
  return convertLegacyPage(pageXml, {
    assetBasePath: IMAGE_BASE_PATH,
    audioBasePath: AUDIO_BASE_PATH,
    audioDurationsMs: {
      '02_02_01.mp3': 24_493.708,
      '02_02_02.mp3': 20_026.667,
      '02_02_03.mp3': 10_618.667,
      '02_02_04.mp3': 19_570.667,
    },
    chapterId: '02_acces',
    globalPropertiesXml,
    textXml,
    imageSizes: {
      '02/_B1_1732.jpg': { width: 1_366, height: 768 },
      '02/_B1_1736.jpg': { width: 1_366, height: 768 },
      '02/_B1_1741.jpg': { width: 1_366, height: 768 },
      '02/_B1_1746.jpg': { width: 1_366, height: 768 },
      '02/_B1_1749.jpg': { width: 1_366, height: 768 },
      '02/_B1_1752.jpg': { width: 1_366, height: 768 },
      '02/_B1_1754.jpg': { width: 1_366, height: 911 },
      '02/_MG_8735.jpg': { width: 800, height: 500 },
      '02/bonnet@3x.png': { width: 358, height: 524 },
      '02/fotolia_94635724.jpg': { width: 800, height: 500 },
      '02/impermeable@3x.png': { width: 343, height: 512 },
      '02/parapluie@3x.png': { width: 363, height: 618 },
      '02/photo-ravon-r2-parking.jpg': { width: 1_366, height: 768 },
      '02/rain.png': { width: 1_635, height: 1_111 },
      '02/stormy.png': { width: 1_634, height: 1_163 },
      '02/sun.png': { width: 1_218, height: 1_218 },
      '02/weather-snow.png': { width: 300, height: 300 },
    },
  });
}
