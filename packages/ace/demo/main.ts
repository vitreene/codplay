import { type ColorValue } from '../src/interval'
import { prepareTween, resolveTween } from '../src/tween'

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
const progressInput = document.querySelector<HTMLInputElement>('#progress-input')!
const progressOutput = document.querySelector<HTMLOutputElement>('#progress-output')!
const positionOutput = document.querySelector<HTMLOutputElement>('#position-output')!
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

/** Serializes the internal OKLCH value for this DOM-only temporary demo. */
const toCssColor = (color: ColorValue): string => {
  const [lightness, chroma, hue] = color.coords
  return `oklch(${(lightness * 100).toFixed(3)}% ${chroma.toFixed(4)} ${hue.toFixed(2)} / ${color.alpha})`
}

/** Resolves both ACE tweens and displays their values. */
const render = (): void => {
  const instant = progress * durationMs
  const position = resolveTween(positionTween, instant)
  const color = resolveTween(colorTween, instant)
  if (!Array.isArray(position) || !position.every((value) => typeof value === 'number')) {
    throw new Error('ACE demo: expected a two-dimensional numeric position')
  }
  if (!isColorValue(color)) {
    throw new Error('ACE demo: expected a normalized color')
  }

  const [x, y] = position
  const markerSize = marker.offsetWidth
  const renderedX = (x / 500) * (stage.clientWidth - markerSize)
  const renderedY = (y / 500) * (stage.clientHeight - markerSize)
  const cssColor = toCssColor(color)

  marker.style.transform = `translate(${renderedX}px, ${renderedY}px)`
  marker.style.backgroundColor = cssColor
  progressInput.value = String(Math.round(progress * 1000))
  progressOutput.value = progress.toFixed(3)
  positionOutput.value = `[${x.toFixed(1)}, ${y.toFixed(1)}]`
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
