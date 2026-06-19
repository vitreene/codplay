/**
 * Base class for internal per-instance services in third-party components.
 * Exported by codplay; all internal services extend this class.
 *
 * Lifecycle dispatch in the component base:
 *   - _doAdvance(sec): calls advance?.(sec) on all registered services before advancing the artboard
 *   - _stop(): calls reset() then destroy?() on all registered services
 *   - update(): explicit per-key dispatch to apply() — the component routes each action key to its service
 */
export abstract class ComponentServiceBase {
  abstract apply(value: unknown): void

  reset(): void {}

  advance?(sec: number): void

  destroy?(): void
}
