import { isPlainRecord } from '../../../shared'
import { BaseHTMLComponent } from '../base-html-component'
import type { ComponentUpdateInput, HTMLComponentInput } from '../component-types'
import {
  resolveCorrectionState,
  resolveInputControlStateClasses,
  resolveInputRootStateClasses,
} from './input-visual-state'
import {
  isSelectedInput,
  resolveCorrectionLabel,
  resolveInputState,
} from './input-state'
import type {
  InputInitial,
  InputState,
  ResolvedInputState,
} from './input-types'

const PART = {
  control: 'control',
  label: 'label',
  hint: 'hint',
} as const

/** V2 quiz input whose public child targets are selected by the runtime catalog. */
export class InputComponent extends BaseHTMLComponent<InputInitial> {
  /** Services declared by the component author, in application order. */
  static readonly declaredServices = ['className', 'style', 'attr', 'content'] as const

  /** Creates one input component and declares only its own services. */
  constructor(input: HTMLComponentInput<InputInitial>) {
    super(input)
    this.services.declare(InputComponent.declaredServices)
  }

  /** Returns the complete five-part input template. */
  render(): string {
    return createInputTemplate(this.perso.storyId, this.perso.id)
  }

  /** Applies one complete resolved state to the root and its private parts. */
  update(input: ComponentUpdateInput<InputState>): void {
    if (this.node === null) throw new Error(`Input component is not materialized: ${this.perso.id}`)
    const nextState = resolveInputState(input.state, `${this.perso.id}__control`)
    const previousState = this.lastState
    this.lastState = nextState

    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: { ...(isPlainRecord(input.state.attr) ? input.state.attr : {}), id: this.perso.id },
    })
    this.applyState(nextState, previousState)
  }

  /** Last projected visual state, used only to remove prior generated classes. */
  private lastState: ResolvedInputState | null = null

  /** Applies all private input parts through the bound HTML/SVG service facade. */
  private applyState(nextState: ResolvedInputState, previousState: ResolvedInputState | null): void {
    const root = this.node
    const control = this.getPart(PART.control)
    const label = this.getPart(PART.label)
    const selectionIcon = this.getPart(selectionIconPartId(this.perso.storyId, this.perso.id))
    const correctionIcon = this.getPart(correctionIconPartId(this.perso.storyId, this.perso.id))
    const hint = this.getPart(PART.hint)

    this.services.apply(root, {
      className: {
        add: resolveInputRootStateClasses(nextState).join(' '),
        remove: previousState === null ? undefined : resolveInputRootStateClasses(previousState).join(' '),
      },
    })
    this.applyControl(control, nextState, previousState)
    this.services.apply(label, { className: 'input__label', content: nextState.label })
    this.services.apply(hint, { className: 'input__hint', content: nextState.hint })
    this.applySelectionIcon(selectionIcon, nextState, previousState)
    this.applyCorrectionIcon(correctionIcon, nextState, previousState)
  }

  /** Projects native properties and generated classes onto the input control. */
  private applyControl(
    node: unknown,
    nextState: ResolvedInputState,
    previousState: ResolvedInputState | null,
  ): void {
    this.services.apply(node, {
      className: {
        add: ['input__control', ...resolveInputControlStateClasses(nextState)].join(' '),
        remove: previousState === null
          ? undefined
          : resolveInputControlStateClasses(previousState).join(' '),
      },
    })
    if (!isInputElementLike(node)) return
    node.type = nextState.inputType
    node.id = nextState.id
    node.name = nextState.name ?? ''
    node.value = nextState.value === undefined ? '' : String(nextState.value)
    node.checked = nextState.checked
    node.disabled = nextState.disabled
    node.placeholder = nextState.placeholder ?? ''
    node.min = nextState.min === undefined ? '' : String(nextState.min)
    node.max = nextState.max === undefined ? '' : String(nextState.max)
    node.step = nextState.step === undefined ? '' : String(nextState.step)
    node.required = nextState.required
    node.readOnly = nextState.readOnly
    if (nextState.form === undefined) node.removeAttribute?.('form')
    else node.setAttribute?.('form', nextState.form)
  }

  /** Projects the selection icon while preserving a mounted child node. */
  private applySelectionIcon(
    node: unknown,
    nextState: ResolvedInputState,
    previousState: ResolvedInputState | null,
  ): void {
    if (node === undefined) return
    this.services.apply(node, {
      className: {
        add: ['input__selection-icon', nextState.selectionIcon.className, isSelectedInput(nextState) ? 'is-selected' : 'is-idle']
          .filter(Boolean).join(' '),
        remove: previousState === null ? undefined : [
          previousState.selectionIcon.className,
          isSelectedInput(previousState) ? 'is-selected' : 'is-idle',
        ].filter(Boolean).join(' '),
      },
      style: nextState.selectionIcon.style,
      attr: nextState.selectionIcon.attr,
    })
    if (hasChildNodes(node)) return
    this.services.apply(node, {
      content: isSelectedInput(nextState) ? (nextState.selectionIcon.content ?? '') : '',
    })
  }

  /** Projects the correction icon while preserving a mounted child node. */
  private applyCorrectionIcon(
    node: unknown,
    nextState: ResolvedInputState,
    previousState: ResolvedInputState | null,
  ): void {
    if (node === undefined) return
    const previousCorrection = previousState === null ? 'idle' : resolveCorrectionState(previousState.visualState) ?? 'idle'
    const nextCorrection = resolveCorrectionState(nextState.visualState) ?? 'idle'
    this.services.apply(node, {
      className: {
        add: ['input__correction-icon', nextState.correctionIcon.className, `is-${nextCorrection}`]
          .filter(Boolean).join(' '),
        remove: previousState === null ? undefined : [
          previousState.correctionIcon.className,
          `is-${previousCorrection}`,
        ].filter(Boolean).join(' '),
      },
      style: nextState.correctionIcon.style,
      attr: nextState.correctionIcon.attr,
    })
    if (hasChildNodes(node)) return
    this.services.apply(node, { content: resolveCorrectionLabel(nextState) })
  }
}

/** Checks the minimal native input property surface used by this component. */
function isInputElementLike(value: unknown): value is {
  type: string
  id: string
  name: string
  value: string
  checked: boolean
  disabled: boolean
  placeholder: string
  min: string
  max: string
  step: string
  required: boolean
  readOnly: boolean
  setAttribute?: (name: string, value: string) => void
  removeAttribute?: (name: string) => void
} {
  return typeof value === 'object' && value !== null && 'type' in value && 'value' in value
}

/** Reports whether one private part currently contains a mounted child. */
function hasChildNodes(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('childNodes' in value)) return false
  const childNodes = (value as { childNodes?: { length?: unknown } }).childNodes
  return typeof childNodes?.length === 'number' && childNodes.length > 0
}

/** Builds one input template with globally unique public icon target IDs. */
function createInputTemplate(storyId: string, persoId: string): string {
  return `
    <label>
      <input data-part="${PART.control}" />
      <span data-part="${PART.label}"></span>
      <span data-part="${selectionIconPartId(storyId, persoId)}" aria-hidden="true"></span>
      <span data-part="${correctionIconPartId(storyId, persoId)}" aria-hidden="true"></span>
      <span data-part="${PART.hint}"></span>
    </label>
  `
}

/** Returns the unique public selection-icon target ID for one component instance. */
export function selectionIconPartId(storyId: string, persoId: string): string {
  return `${storyId}:${persoId}__selection-icon-slot`
}

/** Returns the unique public correction-icon target ID for one component instance. */
export function correctionIconPartId(storyId: string, persoId: string): string {
  return `${storyId}:${persoId}__correction-icon-slot`
}
