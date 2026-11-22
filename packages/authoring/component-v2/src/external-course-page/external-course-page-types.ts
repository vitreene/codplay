import type { TagInitial } from 'codplay'

/** Runtime component identity for one isolated course page. */
export const EXTERNAL_COURSE_PAGE_TYPE = 'external-course-page' as const

/** Engine library identity for the isolated course page launch helper. */
export const EXTERNAL_COURSE_PAGE_LIBRARY_ID = 'external-course-page' as const

/** Primitive configuration values passed to the selected course reader. */
export type ExternalCourseConfigValue = string | number | boolean

/** Authored launch profile for one page in an external course reader. */
export type ExternalCoursePageInitial = Pick<TagInitial, 'className' | 'style'> & Readonly<{
  sourceUrl: string
  chapterId: string
  pageId: string
  title?: string
  config: Readonly<Record<string, ExternalCourseConfigValue>>
}>

/** Engine-prepared helper used by the host component to form its launch URL. */
export type ExternalCoursePageRuntime = Readonly<{
  createLaunchUrl: (profile: ExternalCoursePageInitial) => string
}>

/** Parent command accepted by the isolated reader bridge. */
export type ExternalCoursePageCommand = 'play' | 'pause' | 'seek'

/** Status reported after the reader applies a parent command. */
export type ExternalCoursePagePlaybackStatus = 'playing' | 'paused'

/** Versioned message envelope received from the isolated course reader. */
export type ExternalCoursePageReaderMessage = Readonly<{
  version: 1
  sessionId: string
  kind: 'ready'
  chapterId: string
  pageId: string
}> | Readonly<{
  version: 1
  sessionId: string
  kind: 'result'
  requestId: string
  status: ExternalCoursePagePlaybackStatus
  sourceSequenceId: string | null
  sourceSoundAvailable: boolean
  sourcePositionMs: number | null
  sourceDurationMs: number | null
}> | Readonly<{
  version: 1
  sessionId: string
  kind: 'progress'
  status: ExternalCoursePagePlaybackStatus
  timelineMs: number
  durationMs: number
}> | Readonly<{
  version: 1
  sessionId: string
  kind: 'seek-result'
  requestId: string
  ok: boolean
  status: ExternalCoursePagePlaybackStatus
  timelineMs: number
  durationMs: number
  reason?: string
}> | Readonly<{
  version: 1
  sessionId: string
  kind: 'error'
  reason: string
  phase?: string
  chapterId?: string
  pageId?: string
  requestId?: string
}>
