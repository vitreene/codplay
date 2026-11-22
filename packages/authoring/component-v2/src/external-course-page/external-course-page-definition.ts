import type { RuntimeComponentDefinition } from 'codplay'
import { EXTERNAL_COURSE_PAGE_LIBRARY_ID, EXTERNAL_COURSE_PAGE_TYPE } from './external-course-page-types'
import { ExternalCoursePageComponent } from './external-course-page-component'
import { validateExternalCoursePageAction, validateExternalCoursePageInitial } from './external-course-page-validation'

/** Registers the external page component against the prepared launch library. */
export const EXTERNAL_COURSE_PAGE_DEFINITION: RuntimeComponentDefinition = {
  type: EXTERNAL_COURSE_PAGE_TYPE,
  component: ExternalCoursePageComponent,
  modules: [],
  libraries: [EXTERNAL_COURSE_PAGE_LIBRARY_ID],
  validateInitial: validateExternalCoursePageInitial,
  validateAction: validateExternalCoursePageAction,
  origin: 'foreign',
}
