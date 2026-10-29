import type { ElceDocument } from '../document/document-model'
import { MEDIA_TYPE } from '../../config/document-config'
import { mediaTypeFromMimeType } from '../media/media-resource-service'
import type { Bdc, ChapterId, PageId, RichTextNode } from '../document/document-types'
import type { ProfileCondition, ProfileConstraint, ProfileConditionRow, ProfileProperty, ProfileValue, ReadingConstraint } from './summary-profile-types'

/** Validates the project-owned summary and profile definitions. */
export function assertSummaryProfileInvariants(document: ElceDocument): void {
  const { profile, summary } = document.data
  if (summary.backgroundMediaId !== null) {
    const background = document.medias.find((media) => media.id === summary.backgroundMediaId)
    if (background === undefined) throw new Error(`Média de fond du Sommaire introuvable : ${summary.backgroundMediaId}`)
    if (mediaTypeFromMimeType(background.mimeType) !== MEDIA_TYPE.IMAGE) {
      throw new Error(`Le média ${summary.backgroundMediaId} ne peut pas servir de fond au Sommaire.`)
    }
  }
  if (summary.endChapterDestination === 'summary' && !summary.showAtRoot) {
    throw new Error('Le retour de fin de chapitre exige la présentation racine du Sommaire.')
  }
  const propertiesById = new Map<string, ProfileProperty>()
  for (const property of profile.properties) {
    if (property.id.length === 0 || propertiesById.has(property.id)) throw new Error(`Identifiant de propriété invalide ou dupliqué : ${property.id}`)
    propertiesById.set(property.id, property)
    assertPropertyValue(property, property.defaultValue, `Défaut de ${property.name}`)
    assertUniqueIds(property.choices.map((choice) => choice.id), `option de ${property.name}`)
    if (property.type !== 'choice-one' && property.type !== 'choice-many' && property.choices.length > 0) {
      throw new Error(`La propriété ${property.name} ne peut pas contenir d’options.`)
    }
  }
  assertUniqueIds(profile.fieldPropertyIds, 'champ du Formulaire')
  for (const propertyId of profile.fieldPropertyIds) {
    if (!propertiesById.has(propertyId)) throw missingPropertyError(document, propertyId)
  }
  for (const [propertyId, usages] of collectProfileReferences(document)) {
    if (!propertiesById.has(propertyId)) {
      throw new Error(`Référence à une propriété de profil introuvable : ${propertyId}. Utilisations : ${usages.join(' ; ')}.`)
    }
  }

  const knownChapters = new Set(document.chapters.map((chapter) => chapter.id))
  const knownPages = new Set(document.pages.map((page) => page.id))
  const knownBdcs = new Set(document.bdcs.map((bdc) => bdc.id))
  const constraintKeys = new Set<string>()
  for (const constraint of profile.constraints) {
    const key = `${constraint.target.kind}:${constraint.target.id}`
    if (constraintKeys.has(key)) throw new Error(`Une seule visibilité est permise par cible : ${key}`)
    constraintKeys.add(key)
    assertTargetExists(constraint.target, knownChapters, knownPages, knownBdcs)
    if (constraint.unmetBehavior === 'lock' && constraint.target.kind === 'bdc') {
      throw new Error(`Le verrouillage de visibilité ne cible pas les BDC : ${key}`)
    }
    if (constraint.conditions.length === 0) throw new Error(`La visibilité ${key} doit contenir au moins une condition.`)
    for (const [index, row] of constraint.conditions.entries()) {
      if (index < constraint.conditions.length - 1 && row.joinWithNext === null) {
        throw new Error(`Connecteur manquant après la condition ${index + 1} de ${key}.`)
      }
      if (index === constraint.conditions.length - 1 && row.joinWithNext !== null) {
        throw new Error(`La dernière condition de ${key} ne peut pas avoir de connecteur suivant.`)
      }
      const property = propertiesById.get(row.propertyId)
      if (property === undefined) throw missingPropertyError(document, row.propertyId)
      try {
        assertCondition(property, row.condition)
      } catch (error) {
        const usages = profilePropertyUsages(document, property.id)
        const detail = usages.length === 0 ? '' : ` Utilisations : ${usages.join(' ; ')}.`
        throw new Error(`${errorMessage(error)}${detail}`)
      }
    }
  }

  const readingTargets = new Set<string>()
  for (const constraint of profile.readingConstraints) {
    if (!knownChapters.has(constraint.target.id)) throw new Error(`Chapitre cible introuvable : ${constraint.target.id}`)
    if (readingTargets.has(constraint.target.id)) throw new Error(`Une seule règle de lecture est permise par chapitre : ${constraint.target.id}`)
    readingTargets.add(constraint.target.id)
    if (constraint.requirement.kind === 'chapters') {
      if (constraint.requirement.chapterIds.length === 0) {
        throw new Error(`Le prérequis du chapitre ${constraint.target.id} doit désigner au moins un chapitre.`)
      }
      assertUniqueIds(constraint.requirement.chapterIds, `chapitre requis pour ${constraint.target.id}`)
      for (const chapterId of constraint.requirement.chapterIds) {
        if (!knownChapters.has(chapterId)) throw new Error(`Prérequis vers un chapitre introuvable : ${chapterId}`)
      }
    }
  }
  assertNoReadingCycle(profile.readingConstraints, document.chapters.map((chapter) => chapter.id))
}

/** Resolves profile defaults without inventing values for absent properties. */
export function resolveProfileValues(
  properties: readonly ProfileProperty[],
  values: Readonly<Record<string, ProfileValue>>,
): Readonly<Record<string, ProfileValue>> {
  const resolved: Record<string, ProfileValue> = {}
  for (const property of properties) {
    const value = values[property.id] ?? property.defaultValue
    if (value !== undefined) resolved[property.id] = value
  }
  return resolved
}

/** Lists every field, rule and rich-text label that still refers to a property. */
export function profilePropertyUsages(document: ElceDocument, propertyId: string): readonly string[] {
  const usages = [...(collectProfileReferences(document).get(propertyId) ?? [])]
  if (document.data.profile.fieldPropertyIds.includes(propertyId)) usages.push('champ du Formulaire')
  for (const constraint of document.data.profile.constraints) {
    if (constraint.conditions.some((condition) => condition.propertyId === propertyId)) {
      usages.push(`visibilité ${constraint.target.kind} ${constraint.target.id}`)
    }
  }
  return usages
}

/** Reports missing required fields and values that do not match their property type. */
export function validateProfileValues(
  properties: readonly ProfileProperty[],
  fieldPropertyIds: readonly string[],
  values: Readonly<Record<string, ProfileValue>>,
): readonly string[] {
  const errors: string[] = []
  const byId = new Map(properties.map((property) => [property.id, property]))
  for (const propertyId of fieldPropertyIds) {
    const property = byId.get(propertyId)
    if (property === undefined) continue
    const value = values[propertyId] ?? property.defaultValue
    if (value === undefined || value === '' || Array.isArray(value) && value.length === 0) {
      if (property.required) errors.push(`${property.label} est obligatoire.`)
      continue
    }
    try {
      assertPropertyValue(property, value, property.label)
    } catch {
      errors.push(`${property.label} ne correspond pas à son type.`)
    }
  }
  return errors
}

/** Evaluates one profile condition; absence never satisfies a constraint. */
export function profileConditionMatches(
  property: ProfileProperty,
  value: ProfileValue | undefined,
  condition: ProfileCondition,
): boolean {
  if (value === undefined || property.type !== condition.kind) return false
  switch (condition.kind) {
    case 'text': {
      if (typeof value !== 'string') return false
      const equal = normalizeText(value) === normalizeText(condition.value)
      return condition.operator === 'equals' ? equal : !equal
    }
    case 'number': {
      if (typeof value !== 'number') return false
      switch (condition.operator) {
        case 'equals': return value === condition.value
        case 'not-equals': return value !== condition.value
        case 'less-than': return value < condition.value
        case 'greater-than': return value > condition.value
      }
    }
    case 'choice-one':
    case 'choice-many': {
      const selected = typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
      const matches = condition.choiceIds.some((choiceId) => selected.includes(choiceId))
      return condition.operator === 'is' ? matches : !matches
    }
  }
}

/** Resolves one complete visibility list for a BDC, honoring the nearest local override. */
export function profileVisibilityForBdc(document: ElceDocument, bdcId: string): ProfileConstraint | undefined {
  const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
  if (bdc === undefined) return undefined
  const pageId = bdc.pageId ?? parentPageId(document, bdc)
  const page = document.pages.find((candidate) => candidate.id === pageId)
  const chapterId = page?.chapterId ?? null
  const ancestors = parentBdcIds(document, bdc)
  const candidates = document.data.profile.constraints.filter((constraint) => {
    switch (constraint.target.kind) {
      case 'bdc': return constraint.target.id === bdcId || ancestors.includes(constraint.target.id)
      case 'page': return constraint.target.id === pageId
      case 'chapter': return constraint.target.id === chapterId
    }
  })
  const specificity = (constraint: ProfileConstraint): number => {
    switch (constraint.target.kind) {
      case 'chapter': return 1
      case 'page': return 2
      case 'bdc': return constraint.target.id === bdcId
        ? 4
        : 3 + (ancestors.length - ancestors.indexOf(constraint.target.id)) / 100
    }
  }
  return candidates.toSorted((left, right) => specificity(left) - specificity(right)).at(-1)
}

/** Resolves the page visibility rule, with a local page rule replacing its chapter rule. */
export function profileVisibilityForPage(document: ElceDocument, pageId: string): ProfileConstraint | undefined {
  const local = document.data.profile.constraints.find((constraint) =>
    constraint.target.kind === 'page' && constraint.target.id === pageId)
  if (local !== undefined) return local
  const page = document.pages.find((candidate) => candidate.id === pageId)
  return page?.chapterId === null || page?.chapterId === undefined
    ? undefined
    : document.data.profile.constraints.find((constraint) =>
      constraint.target.kind === 'chapter' && constraint.target.id === page.chapterId)
}

/** Resolves the chapter's own visibility rule for a chapter entry in the summary. */
export function profileVisibilityForChapter(document: ElceDocument, chapterId: string): ProfileConstraint | undefined {
  return document.data.profile.constraints.find((constraint) =>
    constraint.target.kind === 'chapter' && constraint.target.id === chapterId)
}

/** Returns whether a profile-locked page can be opened. */
export function pageVisibilityAllowsAccess(
  document: ElceDocument,
  pageId: string,
  profileValues: Readonly<Record<string, ProfileValue>>,
): boolean {
  const visibility = profileVisibilityForPage(document, pageId)
  return visibility === undefined
    || visibility.unmetBehavior !== 'lock'
    || profileVisibilityMatches(visibility.conditions, new Map(document.data.profile.properties.map((property) => [property.id, property])), profileValues)
}

/** Returns whether a profile-locked chapter remains openable from its own summary entry. */
export function chapterVisibilityAllowsAccess(
  document: ElceDocument,
  chapterId: string,
  profileValues: Readonly<Record<string, ProfileValue>>,
): boolean {
  const visibility = profileVisibilityForChapter(document, chapterId)
  return visibility === undefined
    || visibility.unmetBehavior !== 'lock'
    || profileVisibilityMatches(visibility.conditions, new Map(document.data.profile.properties.map((property) => [property.id, property])), profileValues)
}

/** Returns whether one BDC remains visible under the reader's profile values. */
export function bdcMatchesProfile(
  document: ElceDocument,
  bdcId: string,
  profileValues: Readonly<Record<string, ProfileValue>>,
): boolean {
  const properties = new Map(document.data.profile.properties.map((property) => [property.id, property]))
  const visibility = profileVisibilityForBdc(document, bdcId)
  if (visibility === undefined) return true
  return profileVisibilityMatches(visibility.conditions, properties, profileValues)
    || visibility.target.kind !== 'bdc' && visibility.unmetBehavior === 'lock'
}

/** Evaluates an ordered condition list with AND precedence over OR. */
export function profileVisibilityMatches(
  conditions: readonly ProfileConditionRow[],
  properties: ReadonlyMap<string, ProfileProperty>,
  profileValues: Readonly<Record<string, ProfileValue>>,
): boolean {
  if (conditions.length === 0) return true
  const matches = conditions.map((row) => {
    const property = properties.get(row.propertyId)
    return property !== undefined && profileConditionMatches(property, profileValues[row.propertyId], row.condition)
  })
  const orGroups: boolean[] = []
  let andGroup = matches[0] ?? false
  for (let index = 0; index < conditions.length - 1; index += 1) {
    const next = matches[index + 1] ?? false
    if (conditions[index]?.joinWithNext === 'and') {
      andGroup = andGroup && next
    } else {
      orGroups.push(andGroup)
      andGroup = next
    }
  }
  orGroups.push(andGroup)
  return orGroups.some(Boolean)
}

/** Detects an explicit chapter dependency cycle and reports its path. */
export function assertNoReadingCycle(constraints: readonly ReadingConstraint[], chapterOrder: readonly string[]): void {
  const edges = new Map<string, readonly string[]>()
  for (const constraint of constraints) {
    if (constraint.requirement.kind === 'chapters') {
      edges.set(constraint.target.id, constraint.requirement.chapterIds)
    } else {
      const targetIndex = chapterOrder.indexOf(constraint.target.id)
      const previousChapterId = targetIndex > 0 ? chapterOrder[targetIndex - 1] : undefined
      if (previousChapterId !== undefined) edges.set(constraint.target.id, [previousChapterId])
    }
  }
  const complete = new Set<string>()
  const path: string[] = []
  const indexes = new Map<string, number>()
  const visit = (chapterId: string): void => {
    const repeatedAt = indexes.get(chapterId)
    if (repeatedAt !== undefined) {
      const cycle = [...path.slice(repeatedAt), chapterId]
      throw new Error(`Cycle de prérequis : ${cycle.join(' → ')}`)
    }
    if (complete.has(chapterId)) return
    indexes.set(chapterId, path.length)
    path.push(chapterId)
    for (const requiredChapterId of edges.get(chapterId) ?? []) visit(requiredChapterId)
    path.pop()
    indexes.delete(chapterId)
    complete.add(chapterId)
  }
  for (const chapterId of edges.keys()) visit(chapterId)
}

/** Finds one inline Tiptap profile-label node with a stable property reference. */
function collectProfileReferences(document: ElceDocument): Map<string, string[]> {
  const references = new Map<string, string[]>()
  const addText = (value: string, usage: string): void => {
    for (const match of value.matchAll(/\{\{profile:([^{}]+)\}\}/g)) addReference(match[1]!, usage)
  }
  const addReference = (id: string, usage: string): void => {
    const usages = references.get(id) ?? []
    usages.push(usage)
    references.set(id, usages)
  }
  const addRichText = (nodes: readonly RichTextNode[], bdcId: string): void => {
    for (const node of nodes) {
      if (node.type === 'profileLabel' && typeof node.attrs?.profilePropertyId === 'string') {
        addReference(node.attrs.profilePropertyId, `étiquette dans la Section ${bdcId}`)
      }
      if (node.type === 'text' && typeof node.text === 'string') addText(node.text, `texte de la Section ${bdcId}`)
      if (node.content !== undefined) addRichText(node.content, bdcId)
    }
  }

  addText(document.data.summary.title, 'titre du Sommaire')
  addText(document.data.summary.description, 'description du Sommaire')
  for (const chapter of document.chapters) addText(chapter.name, `titre du chapitre ${chapter.id}`)
  for (const page of document.pages) addText(page.name, `titre de la page ${page.id}`)
  for (const bdc of document.bdcs) addBdcProfileReferences(bdc, addText, addRichText)
  return references
}

/** Collects profile references from every BDC text field exposed by the reader. */
function addBdcProfileReferences(
  bdc: Bdc,
  addText: (value: string, usage: string) => void,
  addRichText: (nodes: readonly RichTextNode[], bdcId: string) => void,
): void {
  if (bdc.section !== null) {
    addText(bdc.section.title, `titre de la Section ${bdc.id}`)
    addRichText(bdc.section.content.content, bdc.id)
  }
  if (bdc.card != null) {
    for (const field of ['overline', 'title', 'description', 'message', 'note', 'caption'] as const) {
      addText(bdc.card[field], `champ ${field} de la Carte ${bdc.id}`)
    }
  }
  if (bdc.question != null) {
    addText(bdc.question.title, `titre de la Question ${bdc.id}`)
    addText(bdc.question.prompt, `énoncé de la Question ${bdc.id}`)
    if (bdc.question.validationLabel !== undefined) addText(bdc.question.validationLabel, `validation de la Question ${bdc.id}`)
    for (const answer of bdc.question.answers) addText(answer.label, `réponse ${answer.id} de la Question ${bdc.id}`)
  }
  if (bdc.statisticalGraph != null) {
    const graph = bdc.statisticalGraph
    for (const field of ['overline', 'title', 'categoryAxisLabel', 'seriesAxisLabel', 'editorialText'] as const) {
      addText(graph[field], `champ ${field} du Graphe ${bdc.id}`)
    }
    for (const category of graph.categories) addText(category.label, `catégorie ${category.id} du Graphe ${bdc.id}`)
    for (const series of graph.series) addText(series.label, `série ${series.id} du Graphe ${bdc.id}`)
  }
  if (bdc.evaluationResult != null) {
    addText(bdc.evaluationResult.success.message, `message de réussite du BDC ${bdc.id}`)
    addText(bdc.evaluationResult.failure.message, `message d’échec du BDC ${bdc.id}`)
  }
}

/** Produces the usage list that blocks deletion of a referenced profile property. */
function missingPropertyError(document: ElceDocument, propertyId: string): Error {
  const usages = profilePropertyUsages(document, propertyId)
  const detail = usages.length === 0 ? '' : ` Utilisations : ${usages.join(' ; ')}.`
  return new Error(`Modification bloquée : propriété ${propertyId} inconnue.${detail}`)
}

/** Converts an unknown validation error into readable text. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Normalizes text comparisons without changing the saved or displayed value. */
function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase()
}

/** Checks a property's default against its declared type and choices. */
function assertPropertyValue(property: ProfileProperty, value: ProfileValue | undefined, label: string): void {
  if (value === undefined) return
  switch (property.type) {
    case 'text':
      if (typeof value !== 'string') throw new Error(`${label} doit être un texte.`)
      return
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} doit être un nombre fini.`)
      return
    case 'choice-one':
    case 'choice-many': {
      const values = typeof value === 'string' ? [value] : Array.isArray(value) ? value : null
      if (values === null || property.type === 'choice-one' && values.length > 1) {
        throw new Error(`${label} doit référencer une sélection de choix valide.`)
      }
      const choiceIds = new Set(property.choices.map((choice) => choice.id))
      if (values.some((choiceId) => !choiceIds.has(choiceId))) throw new Error(`${label} référence une option introuvable.`)
    }
  }
}

/** Checks that the condition kind and options match the referenced property. */
function assertCondition(property: ProfileProperty, condition: ProfileCondition): void {
  if (condition.kind !== property.type) throw new Error(`Condition incompatible avec la propriété ${property.name}.`)
  if (condition.kind === 'number' && !Number.isFinite(condition.value)) throw new Error(`Condition numérique invalide : ${property.name}`)
  if (condition.kind === 'choice-one' || condition.kind === 'choice-many') {
    const choiceIds = new Set(property.choices.map((choice) => choice.id))
    if (condition.choiceMode !== 'any' || condition.choiceIds.length === 0
      || condition.choiceIds.some((choiceId) => !choiceIds.has(choiceId))) {
      throw new Error(`Options de condition invalides pour ${property.name}.`)
    }
  }
}

/** Checks that one rule target still exists in the project document. */
function assertTargetExists(
  target: ProfileConstraint['target'],
  chapters: ReadonlySet<ChapterId>,
  pages: ReadonlySet<PageId>,
  bdcs: ReadonlySet<string>,
): void {
  const exists = target.kind === 'chapter' ? chapters.has(target.id)
    : target.kind === 'page' ? pages.has(target.id)
      : bdcs.has(target.id)
  if (!exists) throw new Error(`Cible de contrainte introuvable : ${target.kind} ${target.id}`)
}

/** Rejects an empty or repeated identifier in one collection. */
function assertUniqueIds(ids: readonly string[], label: string): void {
  if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0)) throw new Error(`Identifiant ${label} vide ou dupliqué.`)
}

/** Finds the page that owns an inline or Carousel child BDC. */
function parentPageId(document: ElceDocument, bdc: Bdc): PageId | null {
  let current = bdc
  while (current.parentBdcId !== null) {
    const parent = document.bdcs.find((candidate) => candidate.id === current.parentBdcId)
    if (parent === undefined) return null
    current = parent
  }
  return current.pageId
}

/** Returns parent BDC identifiers in nearest-to-farthest order. */
function parentBdcIds(document: ElceDocument, bdc: Bdc): readonly string[] {
  const ids: string[] = []
  let parentId = bdc.parentBdcId
  while (parentId !== null) {
    ids.push(parentId)
    parentId = document.bdcs.find((entry) => entry.id === parentId)?.parentBdcId ?? null
  }
  return ids
}
