import { preparePath, prepareTween, resolve, type ColorValue } from '../src/index'

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
const parameterPath = preparePath({ control: [0.5, 0.25] }, { traversal: 'parameter' })
const arcLengthPath = preparePath({ control: [0.5, 0.25] }, { traversal: 'arc-length' })
const positionTween = prepareTween({
  from: [0, 0],
  to: [500, 500],
  duration: durationMs,
  ease: 'inOutQuad',
  loop: true,
  path: parameterPath,
})
const arcLengthTween = prepareTween({
  from: [0, 0],
  to: [500, 500],
  duration: durationMs,
  ease: 'inOutQuad',
  loop: true,
  path: arcLengthPath,
})
const colorTween = prepareTween({
  from: red,
  to: blue,
  duration: durationMs,
  ease: 'inOutQuad',
  loop: true,
})

const stage = document.querySelector<HTMLElement>('#stage')!
const marker = document.querySelector<HTMLElement>('#marker')!
const arcMarker = document.querySelector<HTMLElement>('#arc-marker')!
const progressInput = document.querySelector<HTMLInputElement>('#progress-input')!
const progressOutput = document.querySelector<HTMLOutputElement>('#progress-output')!
const positionOutput = document.querySelector<HTMLOutputElement>('#position-output')!
const arcOutput = document.querySelector<HTMLOutputElement>('#arc-output')!
const colorOutput = document.querySelector<HTMLOutputElement>('#color-output')!
const playToggle = document.querySelector<HTMLButtonElement>('#play-toggle')!
const parameterToggle = document.querySelector<HTMLInputElement>('#parameter-toggle')!
const arcToggle = document.querySelector<HTMLInputElement>('#arc-toggle')!

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
  const [position, arcPosition, color] = resolve([positionTween, arcLengthTween, colorTween], instant)
  if (!isPoint(position) || !isPoint(arcPosition)) {
    throw new Error('ACE demo: expected a two-dimensional numeric position')
  }
  if (!isColorValue(color)) {
    throw new Error('ACE demo: expected a normalized color')
  }

  const cssColor = toCssColor(color)

  const placeMarker = (target: HTMLElement, [x, y]: readonly [number, number]): void => {
    const size = target.offsetWidth
    const renderedX = (x / 500) * (stage.clientWidth - size)
    const renderedY = (y / 500) * (stage.clientHeight - size)
    target.style.transform = `translate(${renderedX}px, ${renderedY}px)`
  }

  marker.hidden = !parameterToggle.checked
  arcMarker.hidden = !arcToggle.checked
  if (!marker.hidden) placeMarker(marker, position)
  if (!arcMarker.hidden) placeMarker(arcMarker, arcPosition)
  marker.style.backgroundColor = cssColor
  arcMarker.style.backgroundColor = cssColor
  progressInput.value = String(Math.round(progress * 1000))
  progressOutput.value = progress.toFixed(3)
  positionOutput.value = `[${position[0].toFixed(1)}, ${position[1].toFixed(1)}]`
  arcOutput.value = `[${arcPosition[0].toFixed(1)}, ${arcPosition[1].toFixed(1)}]`
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

parameterToggle.addEventListener('input', render)
arcToggle.addEventListener('input', render)

new ResizeObserver(render).observe(stage)
render()
requestAnimationFrame(tick)
