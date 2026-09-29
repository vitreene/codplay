/** Names the public events shared by the authored course scenes. */
export const COURSE_EVENTS = {
  next: 'course:navigation:next',
  previous: 'course:navigation:previous',
  pageBottom: 'course:page:bottom',
  quizAnswered: 'course:quiz:answered',
  menuPrefix: 'course:menu:select:',
  refreshPresentation: 'course:presentation:refresh',
} as const

/** Names the Sighty events used to project course presentation state. */
export const COURSE_PRESENTATION_EVENTS = {
  menu: 'course:presentation:menu',
  title: 'course:presentation:title',
  navigationPrevious: 'course:presentation:navigation-previous',
  navigationNext: 'course:presentation:navigation-next',
  navigationStatus: 'course:presentation:navigation-status',
} as const

/** Creates the menu selection event for one course page or chapter start. */
export function courseMenuEvent(pageId: string): string {
  return `${COURSE_EVENTS.menuPrefix}${pageId}`
}
