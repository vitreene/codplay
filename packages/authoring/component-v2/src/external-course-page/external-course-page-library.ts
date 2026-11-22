import type { RuntimeLibraryDefinition } from 'codplay'
import { EXTERNAL_COURSE_PAGE_LIBRARY_ID } from './external-course-page-types'
import type { ExternalCoursePageInitial, ExternalCoursePageRuntime } from './external-course-page-types'

/** Creates the reader launch URL from the serialized course-page profile. */
export function createExternalCoursePageLaunchUrl(profile: ExternalCoursePageInitial): string {
  const launchUrl = new URL(profile.sourceUrl)
  if (launchUrl.protocol !== 'http:' && launchUrl.protocol !== 'https:') {
    throw new Error('External course pages require an HTTP or HTTPS launch URL.')
  }

  const config = {
    ...profile.config,
    chapterParameter: profile.chapterId,
    pageParameter: profile.pageId,
  }
  launchUrl.searchParams.set('config', JSON.stringify(config))
  launchUrl.searchParams.delete('parentOrigin')
  launchUrl.searchParams.delete('sessionId')
  launchUrl.hash = `#/lesson/${encodeURIComponent(profile.chapterId)}/${encodeURIComponent(profile.pageId)}`
  return launchUrl.href
}

/** Declares the launch helper as an engine-prepared foreign library. */
export const EXTERNAL_COURSE_PAGE_LIBRARY: RuntimeLibraryDefinition = {
  id: EXTERNAL_COURSE_PAGE_LIBRARY_ID,
  load: (): ExternalCoursePageRuntime => ({
    createLaunchUrl: createExternalCoursePageLaunchUrl,
  }),
  origin: 'foreign',
}
