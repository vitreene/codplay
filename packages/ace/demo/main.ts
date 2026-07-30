import { preparePath, preparePolarTween, prepareTween, resolve, type ColorValue } from '../src/index'

import './style.css'

const durationMs = 4200
const red: ColorValue = {
  kind: 'color',
  space: 'oklch',
  coords: [0.628, 0.2577, 29.23],
  alpha: 1,
}
const blue: ColorValue = {
  kind: 'color',
  space: 'oklch',
  coords: [0.452, 0.313, 264.05],
  alpha: 1,
}
const positionTween = prepareTween({
  from: [0, 0],
  to: [500, 500],
  duration: durationMs,
  ease: 'inOutQuad',
  loop: true,
  path: preparePath({ control: [0.5, 0.25] }),
})
const colorTween = prepareTween({
  from: red,
  to: blue,
  duration: durationMs,
  ease: 'inOutQuad',
  loop: true,
})
const polarTween = preparePolarTween({
  from: { a: 0, d: 110 },
  to: { a: 360, d: 110 },
  origin: [250, 250],
  duration: durationMs,
  ease: 'linear',
  loop: true,
})
const markerOrbitTween = preparePolarTween({
  from: { a: 0, d: 36 },
  to: { a: 1080, d: 36 },
  origin: [0, 0],
  duration: durationMs,
  ease: 'linear',
  loop: true,
})

const stage = document.querySelector<HTMLElement>('#stage')!
const marker = document.querySelector<HTMLElement>('#marker')!
const polarMarker = document.querySelector<HTMLElement>('#polar-marker')!
const markerOrbit = document.querySelector<HTMLElement>('#marker-orbit')!
const progressInput = document.querySelector<HTMLInputElement>('#progress-input')!
const progressOutput = document.querySelector<HTMLOutputElement>('#progress-output')!
const positionOutput = document.querySelector<HTMLOutputElement>('#position-output')!
const polarOutput = document.querySelector<HTMLOutputElement>('#polar-output')!
const colorOutput = document.querySelector<HTMLOutputElement>('#color-output')!
const playToggle = document.querySelector<HTMLButtonElement>('#play-toggle')!

let playing = true
let progress = 0
let startMs = performance.now()

/** Checks the color value returned by the prepared ACE interval. */
const isColorValue = (value: unknown): value is ColorValue => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Partial<ColorValue>
  return candidate.kind === 'color' && Array.isArray(candidate.coords) && typeof candidate.alpha === 'number'
}

/** Checks the two-dimensional point returned by a path tween. */
const isPoint = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'number' &&
  typeof value[1] === 'number'

/** Serializes the internal OKLCH value for this DOM-only temporary demo. */
const toCssColor = (color: ColorValue): string => {
  const [lightness, chroma, hue] = color.coords
  return `oklch(${(lightness * 100).toFixed(3)}% ${chroma.toFixed(4)} ${hue.toFixed(2)} / ${color.alpha})`
}

/** Resolves both ACE tweens and displays their values. */
const render = (): void => {
  const instant = progress * durationMs
  const [position, color, polarPosition, markerOrbitOffset] = resolve(
    [positionTween, colorTween, polarTween, markerOrbitTween],
    instant,
  )
  if (!isPoint(position) || !isPoint(polarPosition) || !isPoint(markerOrbitOffset)) {
    throw new Error('ACE demo: expected a two-dimensional numeric position')
  }
  if (!isColorValue(color)) {
    throw new Error('ACE demo: expected a normalized color')
  }

  const cssColor = toCssColor(color)

  const placeMarker = (target: HTMLElement, [x, y]: readonly [number, number]): void => {
    const size = target.offsetWidth
    const drawingSize = Math.min(stage.clientWidth, stage.clientHeight)
    const offsetX = (stage.clientWidth - drawingSize) / 2
    const offsetY = (stage.clientHeight - drawingSize) / 2
    const renderedX = offsetX + (x / 500) * drawingSize - size / 2
    const renderedY = offsetY + (y / 500) * drawingSize - size / 2
    target.style.transform = `translate(${renderedX}px, ${renderedY}px)`
  }

  placeMarker(marker, position)
  placeMarker(polarMarker, polarPosition)
  placeMarker(markerOrbit, [
    position[0] + markerOrbitOffset[0],
    position[1] + markerOrbitOffset[1],
  ])
  marker.style.backgroundColor = cssColor
  progressInput.value = String(Math.round(progress * 1000))
  progressOutput.value = progress.toFixed(3)
  positionOutput.value = `[${position[0].toFixed(1)}, ${position[1].toFixed(1)}]`
  polarOutput.value = `[${polarPosition[0].toFixed(1)}, ${polarPosition[1].toFixed(1)}]`
  colorOutput.value = cssColor
}

/** Advances the presentation clock, which is intentionally outside ACE. */
const tick = (nowMs: number): void => {
  if (playing) {
    progress = ((nowMs - startMs) % durationMs) / durationMs
    render()
  }
  requestAnimationFrame(tick)
}

progressInput.addEventListener('input', () => {
  playing = false
  playToggle.textContent = 'Play'
  progress = Number(progressInput.value) / 1000
  render()
})

playToggle.addEventListener('click', () => {
  playing = !playing
  playToggle.textContent = playing ? 'Pause' : 'Play'
  startMs = performance.now() - progress * durationMs
})

new ResizeObserver(render).observe(stage)
render()
requestAnimationFrame(tick)
