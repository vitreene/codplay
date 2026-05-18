export type PartTarget<T> = {
  nodeRef: unknown | null | undefined
  payload: T | undefined
}

/**
 * Applies one callback only on parts that expose both node and payload.
 */
export function applyToParts<T>(targets: PartTarget<T>[], apply: (nodeRef: unknown, payload: T) => void): void {
  for (const target of targets) {
    if (target.nodeRef === null || target.nodeRef === undefined || target.payload === undefined) {
      continue
    }

    apply(target.nodeRef, target.payload)
  }
}
