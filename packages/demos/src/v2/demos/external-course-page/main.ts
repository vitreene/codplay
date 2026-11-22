import type { CodPlayEngineOptions } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import {
  createExternalCoursePagePlaybackBinding,
  EXTERNAL_COURSE_PAGE_DEFINITION,
  EXTERNAL_COURSE_PAGE_LIBRARY,
  EXTERNAL_COURSE_PAGE_TYPE,
} from '@codplay/component-v2'

const SCENE_ID = 'external-course-page-scene'
const STORY_ID = 'external-course-page-story'
const PAGE_PERSO_ID = 'risque-chimique-page112'
const SOURCE_URL = 'http://127.0.0.1:4174/index-embedded.html'

/** Registers the page component and its engine-prepared launch helper. */
export const engineCapabilities: Pick<CodPlayEngineOptions, 'components' | 'libraries'> = {
  components: { register: [EXTERNAL_COURSE_PAGE_DEFINITION] },
  libraries: { register: [EXTERNAL_COURSE_PAGE_LIBRARY] },
}

/** Connects the iframe to the shared HTML runner lifecycle and journal. */
const externalCoursePagePlayback = createExternalCoursePagePlaybackBinding()

/** Connects the reader adapter and its source-owned transport to the shared layout. */
export const sourceAdapterFactories = [externalCoursePagePlayback.sourceAdapterFactory]
export const externalTelcoTransport = externalCoursePagePlayback.transport

/** Creates one scene whose only rendered content is the selected real course page. */
export function createScene(): SceneDoc<string> {
  return {
    id: SCENE_ID,
    stories: {
      [STORY_ID]: {
        id: STORY_ID,
        initial: { move: '@root' },
        persos: [
          {
            id: PAGE_PERSO_ID,
            type: EXTERNAL_COURSE_PAGE_TYPE,
            initial: {
              sourceUrl: SOURCE_URL,
              chapterId: '01_introduction',
              pageId: 'page112',
              title: 'Risque chimique · introduction · page 112',
              config: {
                summaryToLoad: 'content/xml/summary-poc.xml',
                scormVersion: 'exe',
                languageParameter: 'fr',
                chapterParameter: '01_introduction',
                pageParameter: 'page112',
                monoPage: true,
                isModeAuto: false,
              },
              className: 'external-course-page',
              style: {
                display: 'block',
                width: '100%',
                height: '100%',
                border: '0',
                backgroundColor: '#fff',
              },
              move: { target: '@root' },
            },
          },
        ],
      },
    },
  }
}
