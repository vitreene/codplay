import { BaseComponent } from './lib/base-component'
import { applyClassNamePatch, applyNodeId, applyTextContent, collectDataParts } from './lib/dom-component-adapter'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from './types'

type FormVisualState = 'idle' | 'ready' | 'show-result' | 'show-next'

type FormState = {
  questionIndex: number
  title: string
  hint: string
  validateLabel: string
  nextLabel: string
  resultMessage: string
  values: Record<string, string | number | boolean | string[] | null>
  selectedAnswerIds: string[]
  canValidate: boolean
  showResult: boolean
  showNext: boolean
  visualState: FormVisualState
}

type FormInput = {
  questionIndex?: unknown
  title?: unknown
  hint?: unknown
  validateLabel?: unknown
  nextLabel?: unknown
  resultMessage?: unknown
  values?: unknown
  selectedAnswerIds?: unknown
  canValidate?: unknown
  showResult?: unknown
  showNext?: unknown
}

const PART = {
  title: 'title',
  hint: 'hint',
  answers: 'answers',
  controls: 'controls',
  validate: 'validate',
  next: 'next',
  result: 'result'
} as const

const FORM_TEMPLATE = `
  <div data-part="${PART.title}"></div>
  <div data-part="${PART.hint}"></div>
  <div data-part="${PART.answers}"></div>
  <div data-part="${PART.controls}">
    <button type="submit" data-part="${PART.validate}"></button>
    <button type="button" data-part="${PART.next}"></button>
  </div>
  <div data-part="${PART.result}" aria-live="polite"></div>
`

/**
 * Resolves one input payload into one stable array of strings.
 */
function resolveStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Resolves one form visual state.
 */
function resolveVisualState(state: Pick<FormState, 'canValidate' | 'showResult' | 'showNext'>): FormVisualState {
  if (state.showNext) return 'show-next'
  if (state.showResult) return 'show-result'
  if (state.canValidate) return 'ready'
  return 'idle'
}

/**
 * Checks whether one field value should count as meaningful.
 */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false
  }

  if (Array.isArray(value)) {
    return value.some((entry) => isMeaningfulValue(entry))
  }

  return String(value).trim().length > 0
}

/**
 * Resolves one raw authored state into one runtime-ready form state.
 */
function resolveFormState(input: FormInput, fallback?: FormState): FormState {
  const baseValues = fallback?.values ?? {}
  const baseSelectedAnswerIds = fallback?.selectedAnswerIds ?? []
  const canValidate = resolveBooleanValue(input.canValidate, fallback?.canValidate ?? false)
  const showResult = resolveBooleanValue(input.showResult, fallback?.showResult ?? false)
  const showNext = resolveBooleanValue(input.showNext, fallback?.showNext ?? false)

  return {
    questionIndex: typeof input.questionIndex === 'number' ? input.questionIndex : fallback?.questionIndex ?? 0,
    title: typeof input.title === 'string' || typeof input.title === 'number' ? String(input.title) : fallback?.title ?? '',
    hint: typeof input.hint === 'string' || typeof input.hint === 'number' ? String(input.hint) : fallback?.hint ?? '',
    validateLabel:
      typeof input.validateLabel === 'string' || typeof input.validateLabel === 'number'
        ? String(input.validateLabel)
        : fallback?.validateLabel ?? 'Valider',
    nextLabel:
      typeof input.nextLabel === 'string' || typeof input.nextLabel === 'number'
        ? String(input.nextLabel)
        : fallback?.nextLabel ?? 'Suivant',
    resultMessage:
      typeof input.resultMessage === 'string' || typeof input.resultMessage === 'number'
        ? String(input.resultMessage)
        : fallback?.resultMessage ?? '',
    values: typeof input.values === 'object' && input.values !== null ? (input.values as Record<string, string | number | boolean | string[] | null>) : baseValues,
    selectedAnswerIds:
      Array.isArray(input.selectedAnswerIds)
        ? resolveStringList(input.selectedAnswerIds)
        : baseSelectedAnswerIds,
    canValidate,
    showResult,
    showNext,
    visualState: resolveVisualState({ canValidate, showResult, showNext })
  }
}

/**
 * Resolves one boolean-like value from a direct value or a data attribute string.
 */
function resolveBooleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value === 'true'
  }

  return fallback
}

/**
 * Resolves one action payload into the form state fields the component understands.
 */
function resolveFormActionInput(action: Record<string, unknown>): FormInput {
  return {
    questionIndex: action.questionIndex,
    title: action.title,
    hint: action.hint,
    validateLabel: action.validateLabel,
    nextLabel: action.nextLabel,
    resultMessage: action.resultMessage,
    values: action.values,
    selectedAnswerIds: action.selectedAnswerIds,
    canValidate: action.canValidate,
    showResult: action.showResult,
    showNext: action.showNext
  }
}

/**
 * Returns one list of root classes for the current state.
 */
function resolveRootClasses(state: FormState): string[] {
  const classes = [`form--${state.visualState}`]

  if (state.canValidate) {
    classes.push('form--can-validate')
  }

  if (state.showResult) {
    classes.push('form--show-result')
  }

  if (state.showNext) {
    classes.push('form--show-next')
  }

  return classes
}

/**
 * Collects one field snapshot from one DOM form.
 */
function readFormSnapshot(rootNode: HTMLFormElement): Pick<FormState, 'values' | 'selectedAnswerIds' | 'canValidate'> {
  const values: Record<string, string | number | boolean | string[] | null> = {}
  const selectedAnswerIds: string[] = []

  const pushValue = (name: string, value: string | number | boolean | string[] | null): void => {
    const existingValue = values[name]
    if (existingValue === undefined) {
      values[name] = value
      return
    }

    if (Array.isArray(existingValue)) {
      values[name] = [...existingValue, value as string]
      return
    }

    values[name] = [existingValue as string, value as string]
  }

  for (const fieldNode of Array.from(rootNode.elements)) {
    if (!(fieldNode instanceof globalThis.HTMLInputElement || fieldNode instanceof globalThis.HTMLTextAreaElement || fieldNode instanceof globalThis.HTMLSelectElement)) {
      continue
    }

    const name = fieldNode.name
    if (typeof name !== 'string' || name.length === 0) {
      continue
    }

    if (fieldNode instanceof globalThis.HTMLInputElement) {
      if (fieldNode.type === 'checkbox' || fieldNode.type === 'radio') {
        if (fieldNode.checked) {
          selectedAnswerIds.push(fieldNode.value)
          pushValue(name, fieldNode.value)
        }
        continue
      }

      if (fieldNode.type === 'number') {
        const numericValue = fieldNode.value.trim().length > 0 && Number.isFinite(Number(fieldNode.value))
          ? Number(fieldNode.value)
          : fieldNode.value
        pushValue(name, numericValue)
        continue
      }

      pushValue(name, fieldNode.value)
      continue
    }

    if (fieldNode instanceof globalThis.HTMLSelectElement && fieldNode.multiple) {
      const selectedValues = Array.from(fieldNode.selectedOptions).map((option) => option.value)
      pushValue(name, selectedValues)
      continue
    }

    pushValue(name, fieldNode.value)
  }

  const canValidate =
    selectedAnswerIds.length > 0 ||
    Object.values(values).some((value) => isMeaningfulValue(value))

  return {
    values,
    selectedAnswerIds,
    canValidate
  }
}

/**
 * Implements one generic form component with live snapshot collection.
 */
export class FormComponent extends BaseComponent {
  private state: FormState | null = null
  private answersObserver: MutationObserver | null = null

  /**
   * Declares services used for root patches.
   */
  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
  }

  /**
   * Emits one runtime event through the component bridge when available.
   */
  private emitRuntimeEvent(name: string, state: FormState): void {
    this.createElementOptions?.emitRuntimeEvent?.({
      name,
      data: {
        questionIndex: state.questionIndex,
        values: state.values,
        selectedAnswerIds: state.selectedAnswerIds,
        canValidate: state.canValidate
      },
      scopeStoryId: this.perso.storyId,
      source: 'user'
    })
  }

  /**
   * Applies one stable form state on the DOM tree.
   */
  private applyState(rootNode: HTMLFormElement, nextState: FormState, previousState: FormState | null): void {
    const titleNode = this.getPart(PART.title)
    const hintNode = this.getPart(PART.hint)
    const validateNode = this.getPart(PART.validate) as HTMLButtonElement | null
    const nextNode = this.getPart(PART.next) as HTMLButtonElement | null
    const resultNode = this.getPart(PART.result)

    applyClassNamePatch(rootNode, {
      add: resolveRootClasses(nextState).join(' '),
      remove: previousState !== null ? resolveRootClasses(previousState).join(' ') : undefined
    })

    applyNodeId(rootNode, this.perso.id)

    if (titleNode !== null) {
      applyTextContent(titleNode, nextState.title)
    }

    if (hintNode !== null) {
      applyTextContent(hintNode, nextState.hint)
    }

    if (validateNode !== null) {
      validateNode.textContent = nextState.validateLabel
      validateNode.disabled = !nextState.canValidate
    }

    if (nextNode !== null) {
      nextNode.textContent = nextState.nextLabel
      nextNode.hidden = !nextState.showNext
    }

    if (resultNode !== null) {
      applyTextContent(resultNode, nextState.showResult ? nextState.resultMessage : '')
      ;(resultNode as HTMLElement).hidden = !nextState.showResult
    }
  }

  /**
   * Keeps dynamically moved answer nodes inside the dedicated answers slot.
   */
  private placeAnswerChildren(rootNode: HTMLFormElement): void {
    const answersNode = this.getPart(PART.answers)
    if (typeof globalThis.HTMLElement === 'undefined' || !(answersNode instanceof globalThis.HTMLElement)) {
      return
    }

    const fixedChildren = new Set([
      this.getPart(PART.title),
      this.getPart(PART.hint),
      answersNode,
      this.getPart(PART.controls),
      this.getPart(PART.result)
    ])

    for (const childNode of Array.from(rootNode.childNodes)) {
      if (fixedChildren.has(childNode)) {
        continue
      }

      answersNode.appendChild(childNode)
    }
  }

  /**
   * Reads the current DOM snapshot and refreshes the internal state.
   */
  private syncFromDom(rootNode: HTMLFormElement, eventName: 'native:form:change' | 'native:form:submit'): void {
    const previousState = this.state
    const snapshot = readFormSnapshot(rootNode)
    const nextState = resolveFormState({
      questionIndex: previousState?.questionIndex ?? 0,
      title: previousState?.title ?? '',
      hint: previousState?.hint ?? '',
      validateLabel: previousState?.validateLabel ?? 'Valider',
      nextLabel: previousState?.nextLabel ?? 'Suivant',
      resultMessage: previousState?.resultMessage ?? '',
      values: snapshot.values,
      selectedAnswerIds: snapshot.selectedAnswerIds,
      canValidate: snapshot.canValidate,
      showResult: previousState?.showResult ?? false,
      showNext: previousState?.showNext ?? false
    }, previousState ?? undefined)

    this.state = nextState
    this.applyState(rootNode, nextState, previousState)
    this.emitRuntimeEvent(eventName, nextState)
  }

  /**
   * Applies one resolved runtime action on the form component.
   */
  update(input: RuntimeComponentUpdateInput): void {
    const previousState = this.state
    const nextState = resolveFormState(resolveFormActionInput(input.action), previousState ?? undefined)

    this.state = nextState
    this.services.apply(this.node, input.action)
    this.applyState(this.node as HTMLFormElement, nextState, previousState)
  }

  /**
   * Creates the component root and internal helper zones.
   */
  render(): ComponentRenderResult {
    const initialState = resolveFormState(this.perso.initial as FormInput)
    this.state = initialState

    const rootNode = this.buildNode('form') as HTMLFormElement
    rootNode.noValidate = true
    rootNode.innerHTML = FORM_TEMPLATE

    this.clearParts()
    const parts = new Map<string, unknown>()
    collectDataParts(rootNode, parts)
    for (const [partId, partNode] of parts) {
      this.setPart(partId, partNode)
    }

    this.services.apply(rootNode, this.perso.initial)
    this.applyState(rootNode, initialState, null)

    return rootNode as Node
  }

  /**
   * Binds native change and submit events once the form exists.
   */
  init(): void {
    if (!(this.node instanceof globalThis.HTMLFormElement)) {
      return
    }

    const rootNode = this.node
    this.placeAnswerChildren(rootNode)
    const onChange = (): void => this.syncFromDom(rootNode, 'native:form:change')
    const onInput = (): void => this.syncFromDom(rootNode, 'native:form:change')
    const onSubmit = (event: SubmitEvent): void => {
      event.preventDefault()
      this.syncFromDom(rootNode, 'native:form:submit')
    }

    if (typeof globalThis.MutationObserver !== 'undefined') {
      this.answersObserver = new globalThis.MutationObserver(() => {
        this.placeAnswerChildren(rootNode)
      })
      this.answersObserver.observe(rootNode, { childList: true })
    }

    rootNode.addEventListener('change', onChange)
    rootNode.addEventListener('input', onInput)
    rootNode.addEventListener('submit', onSubmit)
  }
}
