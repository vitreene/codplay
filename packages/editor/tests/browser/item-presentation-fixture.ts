import { CodPlay, type SceneDoc } from 'codplay'
import { ITEM_PREVIEW_INVERSE_PROPERTY, itemPreviewInverse } from '../../src/item-presentation/item-preview'
import { resolveMotionGeometryPose } from '../../src/motion-editor/geometry'
import { resolveContentInsetsPx } from '../../src/motion-editor/border-insets'
import { EDITOR_ENGINE_OPTIONS } from '../../src/item-presentation/engine-options'

const PRE_ROLL_MS = 300

/** Owns independent clocks and symmetric/asymmetric content insets without demo data. */
function scene(path: boolean, padded: boolean): SceneDoc {
  return {
    id: 'item-clock-test',
    stories: { main: {
      id: 'main',
      persos: [{
        id: 'stage', type: 'list', initial: { tag: 'div', move: '@root', style: { position: 'relative', width: '100%', height: '100%' } }, actions: {},
      }, {
        id: 'item', type: 'tag',
        initial: {
          move: 'stage', tag: 'div', content: 'One runtime item',
          attr: { 'data-item-id': 'main:item' },
          style: {
            x: 10, y: 10, width: 20, height: 12,
            rotate: padded ? 25 : 0,
            ...(padded ? { padding: '1cqw 0.375cqw 2cqw 0.875cqw', 'transform-origin': '25% 75%' } : {}),
            'border-width': '0.6cqw', 'border-style': 'solid',
          },
        },
        actions: {
          pose: {
            style: {
              x: { from: 10, to: 50, duration: 5000, ease: 'linear' },
              width: { from: 20, to: 30, duration: 5000, ease: 'linear' },
            },
            ...(path ? { move: { target: 'stage', transition: {
              duration: 5000, ease: 'linear', path: 'M 0 0 A 0.7 0.7 0 0 1 1 0', orientToPath: true,
            } } } : {}),
          },
          border: { style: { 'border-width': { from: '0.6cqw', to: '2cqw', duration: 2000, ease: 'linear' } } },
        },
      }],
      eventimes: [{ name: 'pose', startAt: PRE_ROLL_MS }, { name: 'border', startAt: PRE_ROLL_MS }],
    } },
    eventimes: [{ name: 'sequence:end', startAt: 5000 + PRE_ROLL_MS }],
  }
}

/** Fails at the browser boundary, retaining the measured value in the failure. */
function check(label: string, value: number, expected: number, tolerance = 0.8): void {
  if (Math.abs(value - expected) > tolerance) throw new Error(`${label}: ${value}, expected ${expected}`)
}

/** Waits for the actual facade resize observer rather than assuming one rendering tick. */
async function waitForResize(visual: HTMLElement, expectedWidth: number): Promise<void> {
  const deadline = performance.now() + 6000
  while (Math.abs(Number.parseFloat(getComputedStyle(visual).width) - expectedWidth) > 0.1) {
    if (performance.now() > deadline) throw new Error('Native resize observation timed out')
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

/** Exercises real HTML layout and player boundaries with the public host-driven engine clock. */
export async function runChecks(caseIndex?: number) {
  const root = document.getElementById('item-test-scene')!
  const results = []
  const cases = [[false, false], [true, false], [false, true], [true, true]] as const
  for (const [path, padded] of cases.filter((_, index) => caseIndex === undefined || index === caseIndex)) {
    const owner = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, pauseOnDocumentHidden: false, frameScheduler: { request: () => 1, cancel: () => undefined } })
    const built = owner.build({ scene: scene(path, padded) })
    if (!built.ok) throw new Error(JSON.stringify(built.diagnostics))
    root.dataset.phase = `create ${path}/${padded}`
    const instance = owner.instances.create({ instanceId: `item-${path}-${padded}`, ...built, root })
    await instance.telco.seek(2500 + PRE_ROLL_MS)
    const frame = root.querySelector<HTMLElement>('[data-item-id="main:item"]')!
    const visual = root.querySelector<HTMLElement>('[data-editor-visual-for="item"]')!
    const read = () => {
      const pose = instance.presentation.get()?.items.find((item) => item.itemId === 'main:item')?.pose
      const bounds = visual.getBoundingClientRect()
      const reference = root.getBoundingClientRect()
      const style = getComputedStyle(visual)
      const dx = (Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)) / 2
      const dy = (Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)) / 2
      const frameBounds = frame.getBoundingClientRect()
      const center = pose === undefined ? {
        x: frameBounds.x + frameBounds.width / 2 - reference.x,
        y: frameBounds.y + frameBounds.height / 2 - reference.y,
      } : {
        x: pose.origin.x + pose.matrix.a * pose.localWidth / 2 + pose.matrix.c * pose.localHeight / 2,
        y: pose.origin.y + pose.matrix.b * pose.localWidth / 2 + pose.matrix.d * pose.localHeight / 2,
      }
      // Bounding rectangles have the same center as an affine rectangle. This measures the
      // native visual independently of the frame's captured/interpolated dimensions.
      check(`native border center x ${JSON.stringify({ path, padded, pose, time: instance.telco.getProgress().timelineMs })}`, bounds.x + bounds.width / 2 - reference.x, center.x)
      check('native border center y', bounds.y + bounds.height / 2 - reference.y, center.y)
      check('native content width', Number.parseFloat(style.width), 25 * reference.width / 100)
      check('native content height', Number.parseFloat(style.height), 12 * reference.width / 100)
      if (!path && !padded) {
        check('content x after the border clock ended', bounds.x - reference.x + Number.parseFloat(style.borderLeftWidth), 30 * reference.width / 100)
        check('untouched content y', bounds.y - reference.y + Number.parseFloat(style.borderTopWidth), 10 * reference.width / 100)
      }
      if (instance.snapshot.get()!.states.length !== 2) throw new Error('An item acquired a second runtime state')
      return { center, contentInset: { x: dx, y: dy }, width: Number.parseFloat(style.width), transform: frame.style.transform }
    }
    root.dataset.phase = `seek ${path}/${padded}`
    const midpoint = read()
    await instance.telco.seek(4200 + PRE_ROLL_MS)
    await instance.telco.seek(2500 + PRE_ROLL_MS)
    const repeated = read()
    check('same-time center x', repeated.center.x, midpoint.center.x, 0.001)
    check('same-time center y', repeated.center.y, midpoint.center.y, 0.001)
    if (path) {
      const pose = instance.presentation.get()!.items.find((item) => item.itemId === 'main:item')!.pose
      const nativeTransform = frame.style.transform
      const width = root.getBoundingClientRect().width
      const candidate = {
        x: width * 0.4, y: width * 0.22, width: width * 0.26, height: width * 0.14,
        rotate: 50, rotationOrigin: padded ? { fx: 0.25, fy: 0.75 } : { fx: 0.5, fy: 0.5 },
      }
      const baseStyle = instance.snapshot.get()!.states.find((state) => state.target.persoId === 'item')!.state.style as Record<string, unknown>
      const expected = resolveMotionGeometryPose(candidate, resolveContentInsetsPx(baseStyle, width)).pathAnchor
      const preview = instance.snapshot.set([{
        target: { storyId: 'main', persoId: 'item' }, timeMs: 2500 + PRE_ROLL_MS,
        state: { style: { x: 40, y: 22, width: 26, height: 14, rotate: 50,
          [ITEM_PREVIEW_INVERSE_PROPERTY]: itemPreviewInverse(pose),
        } },
      }])
      if (!preview.ok) throw new Error(`Snapshot preview rejected: ${preview.code}`)
      const bounds = visual.getBoundingClientRect()
      const reference = root.getBoundingClientRect()
      check('preview native center x', bounds.x + bounds.width / 2 - reference.x, expected.x)
      check('preview native center y', bounds.y + bounds.height / 2 - reference.y, expected.y)
      if (frame.style.transform !== nativeTransform) throw new Error('Preview overwrote the native motion contribution')
      const logicalStyle = instance.snapshot.get()!.states.find((state) => state.target.persoId === 'item')!.state.style as Record<string, unknown>
      if (ITEM_PREVIEW_INVERSE_PROPERTY in logicalStyle) throw new Error('Preview metadata escaped into the base snapshot')
      instance.snapshot.clear()
      const cleared = read()
      check('preview clear center x', cleared.center.x, midpoint.center.x, 0.001)
      check('preview clear center y', cleared.center.y, midpoint.center.y, 0.001)
    }
    root.dataset.phase = `resize ${path}/${padded}`
    root.style.width = '640px'
    root.dataset.step = 'observe 640'
    await waitForResize(visual, 160)
    root.dataset.step = 'seek 640'
    await instance.telco.seek(2500 + PRE_ROLL_MS)
    root.dataset.step = 'read 640'
    const resized = read()
    root.style.width = '800px'
    root.dataset.step = 'observe 800'
    await waitForResize(visual, 200)
    root.dataset.step = 'seek source'
    await instance.telco.seek(PRE_ROLL_MS)
    root.dataset.phase = `play ${path}/${padded}`
    owner.engine.advance(0)
    await instance.telco.play()
    owner.engine.advance(0)
    owner.engine.advance(2500)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const played = read()
    check('Play/Seek center x', played.center.x, midpoint.center.x, 0.001)
    check('Play/Seek center y', played.center.y, midpoint.center.y, 0.001)
    owner.engine.advance(5000)
    await new Promise((resolve) => setTimeout(resolve, 20))
    check('terminal player time', instance.telco.getProgress().timelineMs, 5000 + PRE_ROLL_MS, 0.001)
    root.dataset.step = 'pause terminal'
    await instance.telco.pause()
    const terminal = frame.style.transform
    root.dataset.step = 'seek terminal'
    await instance.telco.seek(5000 + PRE_ROLL_MS)
    if (frame.style.transform !== terminal) throw new Error(`The repeated terminal seek replaced the motion pose: ${terminal} -> ${frame.style.transform}`)
    root.dataset.phase = `reset ${path}/${padded}`
    await instance.telco.reset()
    if (root.querySelector('[data-editor-visual-for="item"]') !== visual) throw new Error('Reset replaced the native content owner')
    root.dataset.phase = `destroy ${path}/${padded}`
    owner.destroy()
    if (root.childElementCount !== 0) throw new Error('Teardown retained item nodes')
    results.push({ path, padded, midpoint, resized, terminal })
  }
  document.getElementById('item-test-result')!.textContent = `${results.length} real-runtime scenarios passed`
  return { clock: 'public engine.advance', documentHidden: document.hidden, results }
}
