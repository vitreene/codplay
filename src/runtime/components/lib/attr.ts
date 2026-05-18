import { applyAttrPatch } from '../dom-component-adapter'

export type AttrProps = Record<string, unknown>

export type AttrPropsTarget = {
  nodeRef: unknown | null | undefined
  attr: AttrProps | undefined
}

/**
 * Applies one attribute prop map on one node-like target.
 */
export function applyAttrProps(nodeRef: unknown | null | undefined, attr: AttrProps | undefined): void {
  if (nodeRef === null || nodeRef === undefined) {
    return
  }

  applyAttrPatch(nodeRef, attr)
}

/**
 * Applies attribute props on several DOM parts.
 */
export function applyAttrPropsToTargets(targets: AttrPropsTarget[]): void {
  for (const target of targets) {
    applyAttrProps(target.nodeRef, target.attr)
  }
}
