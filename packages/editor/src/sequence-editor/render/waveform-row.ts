import type { MachineContext, MachineViewport } from '../machine'
import type { LayoutProfile, Waveform } from '../types'
import { timeToPixel } from './geometry'

export function createWaveformRow(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.classList.add('seq-waveform')
  return canvas
}

/** La waveform vit dans le `Content` de l'item désigné par `masterItemId` (document-model §"Le son master") — remplace l'ancien `scene.audio.waveform`. */
function masterWaveform(ctx: MachineContext): Waveform | undefined {
  const masterItemId = ctx.scene.masterItemId
  const masterItem = masterItemId ? ctx.scene.items.find((i) => i.id === masterItemId) : undefined
  const content = masterItem?.contentId ? ctx.scene.contents[masterItem.contentId] : undefined
  return content?.waveform
}

export function renderWaveformRow(canvas: HTMLCanvasElement, ctx: MachineContext): void {
  const waveform = masterWaveform(ctx)
  if (!waveform) {
    canvas.style.display = 'none'
    return
  }
  canvas.style.display = ''

  const { viewport, layoutProfile } = ctx
  const h = layoutProfile.rowHeightWaveform
  const w = canvas.clientWidth || canvas.width

  canvas.width = w
  canvas.height = h

  const gc = canvas.getContext('2d')
  if (!gc) return

  gc.clearRect(0, 0, w, h)
  drawWaveform(gc, waveform, viewport, layoutProfile, w, h)
}

function drawWaveform(
  gc: CanvasRenderingContext2D,
  wf: Waveform,
  viewport: MachineViewport,
  layoutProfile: LayoutProfile,
  width: number,
  height: number,
): void {
  const msPerSample = (wf.durationSec * 1000) / wf.points
  const mid = height / 2

  gc.strokeStyle = 'var(--seq-waveform-stroke, #3b82f6)'
  gc.lineWidth = 1
  gc.beginPath()

  for (let i = 0; i < wf.points; i++) {
    const x = timeToPixel(i * msPerSample, viewport, layoutProfile)
    if (x < 0 || x > width) continue
    const ampMax = (wf.max[i] ?? 0) * mid
    const ampMin = (wf.min[i] ?? 0) * mid
    gc.moveTo(x, mid - ampMax)
    gc.lineTo(x, mid - ampMin)
  }

  gc.stroke()
}
