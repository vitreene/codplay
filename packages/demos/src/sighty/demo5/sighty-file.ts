import type { SightyFile as SightyFileDefinition } from '@codplay/sighty'
import { COURSE_EVENTS } from './messages'

/** Names every CodPlay scene used by the course scenario. */
export type CourseSceneKey =
  | 'scene-layout'
  | 'scene-menu'
  | 'scene-title'
  | 'scene-navigation'
  | `scene-${string}`

/** Names the regions declared by the course layout. */
export type CourseSlotName =
  | 'slot-menu'
  | 'slot-title'
  | 'slot-content'
  | 'slot-navigation'

/** Types the declarative course scenario graph. */
export type CourseScenarioFile = SightyFileDefinition<CourseSceneKey, CourseSlotName>

/** Declares the course graph, shared page behavior, and menu routes. */
export const courseScenarioFile: CourseScenarioFile = {
  format: 'sighty',
  version: 1,
  id: 'sighty-scroll-course',
  views: {
    start: 'view-main',
    views: {
      'view-main': {
        action: 'course:refresh-presentation',
        actions: {
          [COURSE_EVENTS.refreshPresentation]: {},
          'course:menu:select:chapter-1-intro': {
            go: { path: 'view-main/view-course/chapter-1/slot-content/chapter-1-intro' },
          },
          'course:menu:select:chapter-1-plans': {
            go: { path: 'view-main/view-course/chapter-1/slot-content/chapter-1-plans' },
          },
          'course:menu:select:chapter-1-movement': {
            go: { path: 'view-main/view-course/chapter-1/slot-content/chapter-1-movement' },
          },
          'course:menu:select:chapter-1-quiz': {
            go: { path: 'view-main/view-course/chapter-1/slot-content/chapter-1-quiz' },
          },
          'course:menu:select:chapter-2-light': {
            go: { path: 'view-main/view-course/chapter-2/slot-content/chapter-2-light' },
          },
          'course:menu:select:chapter-2-details': {
            go: { path: 'view-main/view-course/chapter-2/slot-content/chapter-2-details' },
          },
          'course:menu:select:chapter-2-synthesis': {
            go: { path: 'view-main/view-course/chapter-2/slot-content/chapter-2-synthesis' },
          },
          'course:menu:select:final-question-1': {
            go: { path: 'view-main/view-course/chapter-final/slot-content/final-question-1' },
          },
          'course:menu:select:final-question-2': {
            go: { path: 'view-main/view-course/chapter-final/slot-content/final-question-2' },
          },
          'course:menu:select:final-question-3': {
            go: { path: 'view-main/view-course/chapter-final/slot-content/final-question-3' },
          },
        },
        view: {
          scene: 'scene-layout',
          slots: {
            'slot-menu': {
              start: 'view-menu',
              views: { 'view-menu': { view: { scene: 'scene-menu' } } },
            },
            'slot-title': {
              start: 'view-title',
              views: { 'view-title': { view: { scene: 'scene-title' } } },
            },
            'slot-navigation': {
              start: 'view-navigation',
              views: { 'view-navigation': { view: { scene: 'scene-navigation' } } },
            },
          },
          views: {
            start: 'view-course',
            views: {
              'view-course': {
                showMode: 'reset',
                accessBy: 'guard:course:page-access',
                exitBy: 'guard:course:page-exit',
                onDenied: { path: 'view-main/view-course/chapter-1/slot-content/chapter-1-intro' },
                actions: {
                  [COURSE_EVENTS.next]: {
                    go: { direction: 'next' },
                  },
                  [COURSE_EVENTS.previous]: {
                    go: { direction: 'previous' },
                  },
                  [COURSE_EVENTS.pageBottom]: { action: 'course:mark-page-finished' },
                  [COURSE_EVENTS.quizAnswered]: { action: 'course:record-quiz-answer' },
                },
                view: {
                  views: {
                    start: 'chapter-1',
                    views: {
                      'chapter-1': {
                        view: {
                          slots: {
                            'slot-content': [
                              { id: 'chapter-1-intro', view: { scene: 'scene-chapter-1-intro' } },
                              { id: 'chapter-1-plans', view: { scene: 'scene-chapter-1-plans' } },
                              { id: 'chapter-1-movement', view: { scene: 'scene-chapter-1-movement' } },
                              {
                                id: 'chapter-1-quiz',
                                view: { scene: 'scene-chapter-1-quiz' },
                              },
                            ],
                          },
                        },
                      },
                      'chapter-2': {
                        accessBy: 'guard:course:chapter-2-access',
                        view: {
                          slots: {
                            'slot-content': [
                              { id: 'chapter-2-light', view: { scene: 'scene-chapter-2-light' } },
                              { id: 'chapter-2-details', view: { scene: 'scene-chapter-2-details' } },
                              { id: 'chapter-2-synthesis', view: { scene: 'scene-chapter-2-synthesis' } },
                            ],
                          },
                        },
                      },
                      'chapter-final': {
                        view: {
                          slots: {
                            'slot-content': [
                              { id: 'final-question-1', view: { scene: 'scene-final-question-1' } },
                              { id: 'final-question-2', view: { scene: 'scene-final-question-2' } },
                              { id: 'final-question-3', view: { scene: 'scene-final-question-3' } },
                              { id: 'course-congratulations', view: { scene: 'scene-course-congratulations' } },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}
