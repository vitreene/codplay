/**
 * One WebGPU device shared by every HTML-in-Canvas transition of the page.
 *
 * A device serves any number of canvases, so transitions no longer wait for a
 * new device nor exhaust per-page context limits. Only the device is shared:
 * each transition still releases its canvas configuration, textures and
 * buffers at its end. A lost device is forgotten, reported to the transitions
 * using it, and replaced on the next request.
 */

let sharedDevice: Promise<GPUDevice | undefined> | undefined
const lostListeners = new Set<(reason: string) => void>()

/** Returns the shared device, requesting it on first use or after a loss. */
export function acquireHtmlInCanvasDevice(gpu: GPU): Promise<GPUDevice | undefined> {
  if (sharedDevice !== undefined) return sharedDevice
  const request = requestDevice(gpu)
  sharedDevice = request
  void request.then((device) => {
    if (device === undefined) {
      if (sharedDevice === request) sharedDevice = undefined
      return
    }
    void device.lost.then((info) => {
      if (sharedDevice === request) sharedDevice = undefined
      const listeners = [...lostListeners]
      lostListeners.clear()
      for (const listener of listeners) listener(`WebGPU device lost: ${info.message}`)
    })
  })
  return request
}

/** Registers one transition to be told when the shared device is lost; returns its release. */
export function watchHtmlInCanvasDeviceLoss(listener: (reason: string) => void): () => void {
  lostListeners.add(listener)
  return () => { lostListeners.delete(listener) }
}

/** Requests an adapter and a device, or resolves undefined when the browser refuses. */
async function requestDevice(gpu: GPU): Promise<GPUDevice | undefined> {
  const adapter = await gpu.requestAdapter()
  if (adapter === null) return undefined
  return adapter.requestDevice()
}
