import { ProjectSessionCoordinator } from '../../../core/projects/project-session-coordinator'
import type { ProjectSessionPort } from '../../../core/projects/project-session-types'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import type { QuizHuntDocumentStore } from './quiz-hunt-document-store'
import { createQuizHuntProjectDocumentServices } from './quiz-hunt-project-document-services'
import { createQuizHuntProjectApi } from './quiz-hunt-project-api'
import type { QuizHuntSerializedDocument } from './quiz-hunt-project-api'

/** Creates a Quiz Hunt session whose remembered selection is separate from Learning. */
export function createQuizHuntProjectSessionCoordinator(
  store: QuizHuntDocumentStore,
  session: Storage | null = typeof sessionStorage === 'undefined' ? null : prefixedSessionStorage(sessionStorage),
): ProjectSessionCoordinator<QuizHuntDocument, QuizHuntSerializedDocument, QuizHuntSelection> {
  return new ProjectSessionCoordinator(
    store,
    createQuizHuntProjectApi(),
    createQuizHuntProjectDocumentServices(),
    session,
  )
}

export interface QuizHuntSelection {
  readonly pageId: string | null
  readonly chapterId: string | null
}

/** Adapts session storage keys so each mod remembers its own active project. */
function prefixedSessionStorage(storage: Storage): Storage {
  const prefix = 'quiz-hunt:'
  const keys = (): string[] => Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key !== null && key.startsWith(prefix))
  return {
    get length() { return keys().length },
    clear() { keys().forEach((key) => storage.removeItem(key)) },
    getItem(key) { return storage.getItem(`${prefix}${key}`) },
    key(index) { return keys()[index]?.slice(prefix.length) ?? null },
    removeItem(key) { storage.removeItem(`${prefix}${key}`) },
    setItem(key, value) { storage.setItem(`${prefix}${key}`, value) },
  }
}

/** Exposes the project session contract consumed by the shared controller. */
export type QuizHuntProjectSession = ProjectSessionPort<QuizHuntDocument>
