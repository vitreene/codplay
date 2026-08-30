import type {
  RuntimePreloadMediaHandle,
  RuntimePreloadMediaLease,
} from './preload-types'

/** Creates one opaque owner for a native media node retained by preload. */
export function createRuntimePreloadMediaHandle(
  node: HTMLMediaElement,
  type: RuntimePreloadMediaHandle['type'],
): RuntimePreloadMediaHandle {
  let lease: RuntimePreloadMediaLease | undefined
  let taken = false
  let references = 1
  let closed = false

  const closeNode = (): void => {
    if (closed) return
    closed = true
    node.pause()
    const parent = node.parentNode
    if (parent !== null) parent.removeChild(node)
    node.removeAttribute('src')
  }

  const handle: RuntimePreloadMediaHandle = {
    type,
    retain: (): void => {
      if (closed) return
      references += 1
    },
    release: (): void => {
      if (references === 0) return
      references -= 1
      if (references === 0) closeNode()
    },
    take: (): RuntimePreloadMediaLease | undefined => {
      if (closed || taken) return undefined
      taken = true
      references += 1
      const nextLease: RuntimePreloadMediaLease = {
        node,
        release: (): void => {
          if (lease !== nextLease) return
          lease = undefined
          const parent = node.parentNode
          if (parent !== null) parent.removeChild(node)
          handle.release()
        },
      }
      lease = nextLease
      return nextLease
    },
  }
  return handle
}

/** Removes only the hidden presentation applied by the preload strategy. */
export function clearRuntimePreloadPresentation(node: HTMLMediaElement): void {
  node.style.cssText = ''
}
