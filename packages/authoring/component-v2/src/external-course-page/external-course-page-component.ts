import { BaseHTMLComponent } from 'codplay'
import type { ComponentRuntimeContext, ComponentUpdateInput, HTMLComponentInput } from 'codplay/runtime/components'
import { EXTERNAL_COURSE_PAGE_LIBRARY_ID } from './external-course-page-types'
import type { ExternalCoursePageInitial, ExternalCoursePageRuntime } from './external-course-page-types'

/** Owns the iframe root while the HTML source adapter owns its active session. */
export class ExternalCoursePageComponent extends BaseHTMLComponent<ExternalCoursePageInitial> {
  /** The iframe root exposes presentation-only services. */
  static readonly declaredServices = ['className', 'style'] as const

  private readonly runtime: ComponentRuntimeContext | undefined

  /** Creates the iframe host and declares its HTML presentation services. */
  constructor(input: HTMLComponentInput<ExternalCoursePageInitial>) {
    super(input)
    this.runtime = input.runtime
    this.services.declare(ExternalCoursePageComponent.declaredServices)
  }

  /** Returns an unloaded iframe so the course does not start before host Play. */
  render(): string {
    return '<iframe title="Contenu pédagogique externe" referrerpolicy="no-referrer"></iframe>'
  }

  /** Prepares the serialized launch URL without navigating the iframe. */
  initialize(): void {
    if (!(this.node instanceof HTMLIFrameElement)) {
      throw new Error(`External course page is not materialized as an iframe: ${this.perso.id}`)
    }
    const runtimeContext = this.runtime
    if (runtimeContext === undefined) {
      throw new Error(`External course page runtime is unavailable: ${this.perso.id}`)
    }
    const initial = this.perso.initial as unknown as ExternalCoursePageInitial
    const runtime = runtimeContext.getLibrary<ExternalCoursePageRuntime>(EXTERNAL_COURSE_PAGE_LIBRARY_ID)
    this.node.dataset.externalCourseLaunchUrl = runtime.createLaunchUrl(initial)
    this.node.title = initial.title ?? 'Contenu pédagogique externe'
    this.node.loading = 'eager'
    this.node.dataset.codplayExternalCoursePage = ''
  }

  /** Projects the logical root's responsive class and style to the iframe. */
  update(input: ComponentUpdateInput<ExternalCoursePageInitial>): void {
    if (this.node === null) throw new Error(`External course page is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
    })
  }
}
