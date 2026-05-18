import { applyClassNamePatch } from '../dom-component-adapter'

export type ClassNameProps = string | { add?: string; remove?: string }

export type ClassNamePropsTarget = {
  nodeRef: unknown | null | undefined
  className: ClassNameProps | undefined
}

/**
 * Applies one className payload on one node-like target.
 */
export function applyClassNameProps(
  nodeRef: unknown | null | undefined,
  className: ClassNameProps | undefined
): void {
  if (nodeRef === null || nodeRef === undefined) {
    return
  }

  applyClassNamePatch(nodeRef, className)
}

/**
 * Applies className props on several DOM parts.
 */
export function applyClassNamePropsToTargets(targets: ClassNamePropsTarget[]): void {
  for (const target of targets) {
    applyClassNameProps(target.nodeRef, target.className)
  }
}
