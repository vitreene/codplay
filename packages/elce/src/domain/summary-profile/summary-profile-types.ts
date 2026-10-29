import type { BdcId, ChapterId, MediaId, PageId } from '../document/document-types'

export type ProfilePropertyId = string
export type ProfileChoiceId = string
export type ProfilePropertyType = 'text' | 'number' | 'choice-one' | 'choice-many'
export type ProfileValue = string | number | readonly ProfileChoiceId[]

export interface ProfileChoice {
  readonly id: ProfileChoiceId
  readonly label: string
}

export interface ProfileProperty {
  readonly id: ProfilePropertyId
  readonly name: string
  readonly label: string
  readonly type: ProfilePropertyType
  readonly required: boolean
  readonly defaultValue?: ProfileValue
  readonly choices: readonly ProfileChoice[]
}

export interface ProfileDefinition {
  readonly properties: readonly ProfileProperty[]
  readonly fieldPropertyIds: readonly ProfilePropertyId[]
  readonly constraints: readonly ProfileConstraint[]
  readonly readingConstraints: readonly ReadingConstraint[]
}

export type ProfileTarget =
  | Readonly<{ kind: 'chapter'; id: ChapterId }>
  | Readonly<{ kind: 'page'; id: PageId }>
  | Readonly<{ kind: 'bdc'; id: BdcId }>

export type ProfileCondition =
  | Readonly<{ kind: 'text'; operator: 'equals' | 'not-equals'; value: string }>
  | Readonly<{ kind: 'number'; operator: 'equals' | 'not-equals' | 'less-than' | 'greater-than'; value: number }>
  | Readonly<{ kind: 'choice-one'; operator: 'is' | 'is-not'; choiceIds: readonly ProfileChoiceId[]; choiceMode: 'any' }>
  | Readonly<{ kind: 'choice-many'; operator: 'is' | 'is-not'; choiceIds: readonly ProfileChoiceId[]; choiceMode: 'any' }>

export type ProfileConditionJoin = 'and' | 'or'

export interface ProfileConditionRow {
  readonly propertyId: ProfilePropertyId
  readonly condition: ProfileCondition
  readonly joinWithNext: ProfileConditionJoin | null
}

export interface ProfileConstraint {
  readonly id: string
  readonly target: ProfileTarget
  readonly conditions: readonly ProfileConditionRow[]
  readonly unmetBehavior?: 'hide' | 'lock'
}

export type ReadingRequirement =
  | Readonly<{ kind: 'previous-chapter' }>
  | Readonly<{ kind: 'chapters'; chapterIds: readonly ChapterId[] }>

export interface ReadingConstraint {
  readonly id: string
  readonly target: Readonly<{ kind: 'chapter'; id: ChapterId }>
  readonly requirement: ReadingRequirement
}

export interface SummarySettings {
  readonly title: string
  readonly description: string
  readonly backgroundMediaId: MediaId | null
  readonly showInMenu: boolean
  readonly showAtRoot: boolean
  readonly displayMode: 'chapters' | 'pages'
  readonly pageContinuationMode: 'endpage' | 'free'
  readonly permanentAccess: boolean
  readonly endChapterDestination: 'next' | 'summary'
}

export const INITIAL_SUMMARY_SETTINGS: SummarySettings = {
  title: 'Sommaire',
  description: '',
  backgroundMediaId: null,
  showInMenu: true,
  showAtRoot: false,
  displayMode: 'pages',
  pageContinuationMode: 'endpage',
  permanentAccess: false,
  endChapterDestination: 'next',
}

export const INITIAL_PROFILE_DEFINITION: ProfileDefinition = {
  properties: [],
  fieldPropertyIds: [],
  constraints: [],
  readingConstraints: [],
}
