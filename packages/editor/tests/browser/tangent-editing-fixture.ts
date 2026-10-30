import { createActor } from 'xstate'
import { controllerMachine } from '../../src/app/controller/controller-machine'
import { EditorCoordinationBridge } from '../../src/app/bridges/editor-coordination-bridge'
import { EditorPlayerCommandFacade } from '../../src/app/commands/editor-player-command-facade'
import { createScenePlayerBridge } from '../../src/app/bridges/scene-player-bridge'
import { createDecorEditorBridge } from '../../src/app/bridges/decor-editor-bridge'
import { createSequenceEditorBridge } from '../../src/app/bridges/sequence-editor-bridge'
import { EditorActionsFacade } from '../../src/app/facades/editor-actions-facade'
import { createMotionArcPath, motionPathPointAtProgress, motionPathTangentAngle, splitMotionPath } from '../../src/motion-editor/geometry'
import type { EditorScene } from '../../src/app/commands/types'
import '../../src/decor-editor/decor-editor.css'
import '../../src/sequence-editor/sequence-editor.css'

const actor = createActor(controllerMachine)
const coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
const actions = new EditorActionsFacade(actor)
const sceneHost = document.getElementById('tangent-test-scene')!
const paletteHost = document.getElementById('tangent-test-palette')!
const timelineHost = document.getElementById('tangent-test-timeline')!
let acknowledgement = 0
actor.on('seekApplied', () => { acknowledgement += 1 })

/** Owns a bordered, tangent-continuous path split independently of SQLite documents. */
function scene(): EditorScene {
  const source = { x: 20, y: 16 }
  const control = { x: 50, y: 55 }
  const target = { x: 80, y: 30 }
  const originalPath = createMotionArcPath(source, control, target)!
  const splitProgress = 0.58
  const waypoint = motionPathPointAtProgress(source, control, target, splitProgress)
  const split = splitMotionPath(originalPath, source, waypoint, target, splitProgress)
  return {
    id: 'tangent-editing-browser-test',
    meta: { title: 'Tangent editing test', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 's', capsuleOrder: 'forward' },
    items: [{
      id: 'test-item', type: 'text', parentId: null, order: 'a', visible: true,
      contentId: 'test-content', initialDecorId: 'test-source',
      keyframes: [
        { id: 'test-first', timeMs: 0, decorId: 'test-source', channel: 'pose' },
        { id: 'test-border', timeMs: 2500, decorId: 'test-border', channel: 'decor' },
        { id: 'test-middle', timeMs: 3000, decorId: 'test-middle', channel: 'pose' },
        { id: 'test-last', timeMs: 5000, decorId: 'test-target', channel: 'pose' },
      ],
    }],
    contents: { 'test-content': { id: 'test-content', type: 'text', text: 'Tangent test' } },
    decors: {
      'test-source': {
        id: 'test-source', offset: { translate: { x: 10, y: 10 }, width: 20, height: 12, rotate: 0 },
        // Use the palette's canonical oklch author vocabulary for both color endpoints.
        style: { 'border-width': '0.6cqw', 'border-style': 'solid', 'border-color': 'oklch(0.8 0.1 190)', 'background-color': 'oklch(0.4 0.1 230)', 'font-size': '2cqw' },
      },
      'test-border': {
        id: 'test-border', style: { 'border-width': '2cqw', 'border-style': 'solid' },
      },
      'test-middle': {
        id: 'test-middle',
        offset: { translate: { x: waypoint.x - 10, y: waypoint.y - 6 }, width: 20, height: 12, rotate: 0 },
        path: split.before!, orientToPath: true,
      },
      'test-target': {
        id: 'test-target',
        offset: { translate: { x: target.x - 10, y: target.y - 6 }, width: 20, height: 12, rotate: 0 },
        style: { 'border-width': '2.75cqw', 'border-style': 'solid' },
        path: split.after!, orientToPath: true,
      },
    },
    zones: {}, markerTracks: {},
  }
}

/** Waits for the actual asynchronous runtime boundary, with a bounded failure. */
async function until(predicate: () => boolean): Promise<void> {
  const deadline = performance.now() + 6000
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error('Editor runtime acknowledgement timed out')
    await new Promise((resolve) => setTimeout(resolve, 16))
  }
}

/** Mounts the production editor bridges with no persistence adapter. */
export async function mountFixture(): Promise<void> {
  actor.start()
  actor.send({ type: 'SCENE_LOADED', scene: scene() })
  createScenePlayerBridge(sceneHost, actor, coordination)
  createSequenceEditorBridge(timelineHost, actor, coordination)
  createDecorEditorBridge(paletteHost, actor, coordination)
  await until(() => acknowledgement > 0)
  await selectTime(0)
}

/** Restores only this test's document through the normal scene loading circuit. */
export async function resetFixture(): Promise<void> {
  const previousRoot = sceneHost.querySelector('.editor-v2-instance-root')
  actor.send({ type: 'SCENE_LOADED', scene: scene() })
  await until(() => sceneHost.querySelector('.editor-v2-instance-root') !== previousRoot
    && coordination.presentation.get()?.timeMs === 0)
  await selectTime(0)
}

/** Loads a two-endpoint curved route for testing an inserted rotated waypoint. */
export async function testInsertedRotationWaypoint(timeMs = 3_000, degrees = 20) {
  const documentScene = scene()
  documentScene.items[0]!.keyframes = [
    { id: 'test-first', timeMs: 0, decorId: 'test-source', channel: 'pose' },
    { id: 'test-last', timeMs: 5_000, decorId: 'test-target', channel: 'pose' },
  ]
  delete documentScene.decors['test-border']
  delete documentScene.decors['test-middle']
  documentScene.decors['test-source']!.offset = {
    translate: { x: 10, y: 10 }, width: 20, height: 12, rotate: 0,
  }
  documentScene.decors['test-target'] = {
    id: 'test-target',
    offset: { translate: { x: 80, y: 30 }, width: 20, height: 12, rotate: 0 },
    style: { 'border-width': '2cqw', 'border-style': 'solid' },
    path: createMotionArcPath({ x: 20, y: 16 }, { x: 50, y: 55 }, { x: 90, y: 36 })!,
    orientToPath: true,
  }
  const previousRoot = sceneHost.querySelector('.editor-v2-instance-root')
  actor.send({ type: 'SCENE_LOADED', scene: documentScene })
  await until(() => sceneHost.querySelector('.editor-v2-instance-root') !== previousRoot
    && coordination.presentation.get()?.timeMs === 0)
  await selectTime(timeMs)
  const before = readFixture()
  const edit = await rotateItem(degrees)
  const seams = await readPathTangentSeam()
  const angles = await readTangentSeam()
  if (edit.committed.alignmentError > 1) throw new Error(`Rotated waypoint item/CS error ${edit.committed.alignmentError}px`)
  if (seams.joins.some((join) => Math.abs(join.jump) > 0.2)) {
    throw new Error(`Rotated waypoint tangent discontinuity ${JSON.stringify(seams.joins)}`)
  }
  if (edit.committed.document!.items[0]!.keyframes.length !== 3
    || Object.values(edit.committed.document!.decors).filter((decor) => decor.path !== undefined).length !== 2) {
    throw new Error('Rotated waypoint must split the original path into two arcs')
  }
  return { before, edit, seams, angles }
}

/** Seeks through the author-owned timeline and waits for the real player acknowledgement. */
export async function selectTime(timeMs: number): Promise<void> {
  const keyframe = actor.getSnapshot().context.scene!.items[0]!.keyframes.find((candidate) => candidate.timeMs === timeMs)
  actor.send({ type: 'SELECT_ITEM', itemIds: ['test-item'], ...(keyframe === undefined ? {} : { keyframeId: keyframe.id }) })
  if (coordination.transport.getProgress()?.timelineMs === timeMs && coordination.presentation.get()?.timeMs === timeMs) return
  const before = acknowledgement
  coordination.requestAuthorSeek(timeMs)
  await until(() => acknowledgement > before)
}

/** Reads transformed content corners from CSS matrices and layout offsets, without DOM rectangles. */
function contentCorners(element: HTMLElement, isOverlay = false) {
  const style = getComputedStyle(element)
  const transform = isOverlay ? element.style.transform : style.transform
  const matrix = new DOMMatrix(transform === 'none' ? undefined : transform)
  const width = Number.parseFloat(isOverlay ? element.style.width : style.width)
  const height = Number.parseFloat(isOverlay ? element.style.height : style.height)
  const origin = (isOverlay ? element.style.transformOrigin : style.transformOrigin).split(/\s+/).map((value, index) =>
    value.endsWith('%') ? Number.parseFloat(value) * (index === 0 ? width : height) / 100 : Number.parseFloat(value))
  const insetX = isOverlay ? 0 : Number.parseFloat(style.borderLeftWidth)
  const insetY = isOverlay ? 0 : Number.parseFloat(style.borderTopWidth)
  const left = isOverlay ? Number.parseFloat(element.style.left) : element.offsetLeft
  const top = isOverlay ? Number.parseFloat(element.style.top) : element.offsetTop
  return [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => {
    const point = matrix.transformPoint({ x: x! + insetX - origin[0]!, y: y! + insetY - origin[1]! })
    return { x: left + origin[0]! + point.x, y: top + origin[1]! + point.y }
  })
}

/** Captures the actual item, CS, ghosts and author model independently of tangent calculations. */
export function readFixture() {
  const item = sceneHost.querySelector<HTMLElement>('[data-item-id="story-main:test-item"]')!
  const visual = sceneHost.querySelector<HTMLElement>('[data-editor-visual-for="test-item"]')
  const frame = sceneHost.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
  const itemCorners = visual === null
    ? domElementCorners(item, contentBoxCorners(item))
    : domElementCorners(visual, contentBoxCorners(visual))
  const itemBorderCorners = visual === null
    ? domElementCorners(item, borderBoxCorners(item))
    : domElementCorners(visual, borderBoxCorners(visual))
  const frameCorners = contentCorners(frame, true)
  const contentError = (corners: typeof itemCorners) => Math.max(...corners.map((point, index) =>
    Math.hypot(point.x - itemCorners[index]!.x, point.y - itemCorners[index]!.y)))
  const borderError = (corners: typeof itemBorderCorners) => Math.max(...corners.map((point, index) =>
    Math.hypot(point.x - itemBorderCorners[index]!.x, point.y - itemBorderCorners[index]!.y)))
  return {
    time: coordination.transport.getProgress()?.timelineMs,
    frame: frame.style.cssText,
    item: item.style.cssText,
    itemCorners, itemBorderCorners, frameCorners, alignmentError: contentError(frameCorners),
    ghosts: [...sceneHost.querySelectorAll<HTMLElement>('[data-motion-ghost]')].filter((ghost) => ghost.dataset.motionKeyframeId).map((ghost) => ({
      id: ghost.dataset.motionKeyframeId, display: ghost.style.display,
      corners: contentCorners(ghost, true), alignmentError: borderError(contentCorners(ghost, true)),
    })),
    document: structuredClone(actor.getSnapshot().context.scene),
    presentation: coordination.presentation.get(),
    snapshot: coordination.snapshot.get(),
  }
}

/** Resolves the transformed motion host's border-box corners from its PresentationFrame pose. */
function presentedBorderCorners(
  pose: NonNullable<ReturnType<typeof coordination.presentation.get>>['items'][number]['pose'],
) {
  return [[0, 0], [pose.localWidth, 0], [pose.localWidth, pose.localHeight], [0, pose.localHeight]].map(([x, y]) => ({
    x: pose.origin.x + pose.matrix.a * x! + pose.matrix.c * y!,
    y: pose.origin.y + pose.matrix.b * x! + pose.matrix.d * y!,
  }))
}

/** Resolves content-box corners from the composed DOM transforms, including snapshot previews. */
function contentBoxCorners(element: HTMLElement) {
  const style = getComputedStyle(element)
  const left = Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft)
  const top = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.paddingTop)
  const width = Number.parseFloat(style.width)
  const height = Number.parseFloat(style.height)
  return [[left, top], [left + width, top], [left + width, top + height], [left, top + height]]
}

/** Resolves the outer border-box corners used by the path and projected ghosts. */
function borderBoxCorners(element: HTMLElement) {
  const style = getComputedStyle(element)
  const width = Number.parseFloat(style.width) + Number.parseFloat(style.paddingLeft)
    + Number.parseFloat(style.paddingRight) + Number.parseFloat(style.borderLeftWidth)
    + Number.parseFloat(style.borderRightWidth)
  const height = Number.parseFloat(style.height) + Number.parseFloat(style.paddingTop)
    + Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderTopWidth)
    + Number.parseFloat(style.borderBottomWidth)
  return [[0, 0], [width, 0], [width, height], [0, height]]
}

/** Composes CSS matrices through the scene host without measuring rendered rectangles. */
function domElementCorners(element: HTMLElement, corners: number[][]) {
  let points = corners.map(([x, y]) => ({ x: x!, y: y! }))
  let current: HTMLElement | null = element
  while (current !== null && current !== sceneHost) {
    const style = getComputedStyle(current)
    const width = Number.parseFloat(style.width)
    const height = Number.parseFloat(style.height)
    const [originX, originY] = style.transformOrigin.split(/\s+/).map((value, index) =>
      value.endsWith('%')
        ? Number.parseFloat(value) * (index === 0 ? width : height) / 100
        : Number.parseFloat(value))
    const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform)
    points = points.map(({ x, y }) => {
      const transformed = matrix.transformPoint({ x: x - originX!, y: y - originY! })
      return {
        x: current!.offsetLeft + originX! + transformed.x,
        y: current!.offsetTop + originY! + transformed.y,
      }
    })
    current = current.parentElement
  }
  return points
}

/** Measures the real player rotation across the C1 path split at its middle keyframe. */
export async function readTangentSeam() {
  const source = { x: 20, y: 16 }
  const control = { x: 50, y: 55 }
  const target = { x: 80, y: 30 }
  const originalPath = createMotionArcPath(source, control, target)!
  const progress = 0.58
  const waypoint = motionPathPointAtProgress(source, control, target, progress)
  const split = splitMotionPath(originalPath, source, waypoint, target, progress)
  const expectedBefore = motionPathTangentAngle(split.before!, source, waypoint, 1)!
  const expectedAfter = motionPathTangentAngle(split.after!, waypoint, target, 0)!
  const readRotation = () => {
    const pose = coordination.presentation.get()?.items.find((item) => item.itemId === 'story-main:test-item')?.pose
    return pose === undefined ? null : Math.atan2(pose.matrix.b, pose.matrix.a) * 180 / Math.PI
  }
  await selectTime(2999)
  const before = readRotation()
  await selectTime(3000)
  const after = readRotation()
  if (before === null || after === null) throw new Error('Tangent fixture did not publish the item pose')
  return {
    before,
    after,
    jump: normalizeDegrees(after - before),
    expectedBefore,
    expectedAfter,
    expectedJump: normalizeDegrees(expectedAfter - expectedBefore),
  }
}

/** Samples the actual player rotation while Play crosses one inserted waypoint. */
export async function playAcrossInsertedWaypoint(timeMs = 3_000) {
  await selectTime(0)
  const samples: Array<{ timeMs: number; angle: number }> = []
  const unsubscribe = coordination.transport.onProgress((progress) => {
    if (Math.abs(progress.timelineMs - timeMs) > 400) return
    const pose = coordination.presentation.get()?.items.find((item) => item.itemId === 'story-main:test-item')?.pose
    if (pose === undefined) return
    samples.push({ timeMs: progress.timelineMs, angle: Math.atan2(pose.matrix.b, pose.matrix.a) * 180 / Math.PI })
  })
  coordination.transport.play()
  await until(() => actor.getSnapshot().value === 'playing')
  await until(() => actor.getSnapshot().value === 'idle' && coordination.transport.getProgress()?.timelineMs === 5_000)
  unsubscribe()
  const before = samples.filter((sample) => sample.timeMs < timeMs).slice(-2)
  const after = samples.filter((sample) => sample.timeMs >= timeMs).slice(0, 2)
  if (before.length < 2 || after.length < 2) throw new Error(`Play did not sample both sides of ${timeMs}ms`)
  const velocity = (first: typeof samples[number], second: typeof samples[number]) =>
    normalizeDegrees(second.angle - first.angle) / (second.timeMs - first.timeMs)
  return {
    before, after,
    angularVelocityBefore: velocity(before[0]!, before[1]!),
    angularVelocityAfter: velocity(after[0]!, after[1]!),
    velocityDelta: velocity(after[0]!, after[1]!) - velocity(before[0]!, before[1]!),
  }
}

/** Measures every authored path join against runtime endpoint centres from PresentationFrame. */
export async function readPathTangentSeam() {
  const currentScene = actor.getSnapshot().context.scene!
  const item = currentScene.items[0]!
  const keyframes = [...item.keyframes]
    .filter((keyframe) => keyframe.channel !== 'decor')
    .sort((left, right) => left.timeMs - right.timeMs)
  const centres = []
  for (const keyframe of keyframes) {
    await selectTime(keyframe.timeMs)
    const pose = coordination.presentation.get()?.items.find((entry) => entry.itemId === 'story-main:test-item')?.pose
    if (pose === undefined) throw new Error(`No player pose at ${keyframe.timeMs}ms`)
    centres.push({
      x: pose.origin.x + pose.matrix.a * pose.localWidth / 2 + pose.matrix.c * pose.localHeight / 2,
      y: pose.origin.y + pose.matrix.b * pose.localWidth / 2 + pose.matrix.d * pose.localHeight / 2,
    })
  }
  const joins = keyframes.flatMap((keyframe, index) => {
    if (index === 0 || index + 1 >= keyframes.length) return []
    const incoming = currentScene.decors[keyframe.decorId]?.path
    const outgoing = currentScene.decors[keyframes[index + 1]!.decorId]?.path
    if (incoming === undefined || outgoing === undefined) return []
    const incomingAngle = motionPathTangentAngle(incoming, centres[index - 1]!, centres[index]!, 1)!
    const outgoingAngle = motionPathTangentAngle(outgoing, centres[index]!, centres[index + 1]!, 0)!
    return [{
      keyframeId: keyframe.id,
      timeMs: keyframe.timeMs,
      incomingAngle,
      outgoingAngle,
      jump: normalizeDegrees(outgoingAngle - incomingAngle),
    }]
  })
  return { joins, keyframes: keyframes.map(({ id, timeMs }) => ({ id, timeMs })) }
}

/** Normalizes a measured pose-angle difference to its shortest signed rotation. */
function normalizeDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180
}

/** Dispatches real gesture events; only native pointer capture is replaced for synthetic pointers. */
async function gesture(selector: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const target = sceneHost.querySelector<HTMLElement>(selector)!
  const originalCapture = target.setPointerCapture
  target.setPointerCapture = () => {}
  const dispatch = (type: string, point: typeof from) => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0,
    buttons: type === 'pointerup' ? 0 : 1, clientX: point.x, clientY: point.y,
  }))
  const before = acknowledgement
  dispatch('pointerdown', from)
  dispatch('pointermove', to)
  const preview = readFixture()
  dispatch('pointerup', to)
  target.setPointerCapture = originalCapture
  await until(() => acknowledgement > before)
  return { preview, committed: readFixture() }
}

/** Rotates using the production needle's pointer handlers. */
export async function rotateItem(degrees: number) {
  const frame = sceneHost.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
  const style = getComputedStyle(frame)
  const origin = style.transformOrigin.split(/\s+/).map(Number.parseFloat)
  const pivot = { x: Number.parseFloat(frame.style.left) + origin[0]!, y: Number.parseFloat(frame.style.top) + origin[1]! }
  const angle = Math.atan2(new DOMMatrix(style.transform).b, new DOMMatrix(style.transform).a) - Math.PI / 2
  return gesture('[data-selection-frame-needle-tip]',
    { x: pivot.x + Math.cos(angle) * 60, y: pivot.y + Math.sin(angle) * 60 },
    { x: pivot.x + Math.cos(angle + degrees * Math.PI / 180) * 60, y: pivot.y + Math.sin(angle + degrees * Math.PI / 180) * 60 })
}

/** Moves the production trace surface to update the current endpoint or create a waypoint. */
export async function moveItem(dx: number, dy: number) {
  const from = readFixture().frameCorners[0]!
  return gesture('[data-motion-move-zone]', from, { x: from.x + dx, y: from.y + dy })
}

/** Resizes through the production southeast handle in the current transformed axes. */
export async function resizeItem(dx: number, dy: number) {
  const from = readFixture().frameCorners[2]!
  return gesture('[data-selection-frame-handle="se"]', from, { x: from.x + dx, y: from.y + dy })
}

/** Places the rotation pivot on the transformed northwest content corner. */
export async function movePivot() {
  const frame = sceneHost.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
  const origin = getComputedStyle(frame).transformOrigin.split(/\s+/).map(Number.parseFloat)
  return gesture('[data-selection-frame-pivot]',
    { x: Number.parseFloat(frame.style.left) + origin[0]!, y: Number.parseFloat(frame.style.top) + origin[1]! },
    readFixture().frameCorners[0]!)
}

/** Edits the real palette border control and flushes through the existing phase boundary. */
async function editStyleControl(path: string, value: string) {
  const input = paletteHost.querySelector<HTMLInputElement>(`[data-decor-property-path="${path}"] input`)!
  input.value = value
  if (input.type === 'color') input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  const preview = readFixture()
  const before = acknowledgement
  actor.send({ type: 'HISTORY_BOUNDARY' })
  await until(() => acknowledgement > before)
  return { preview, committed: readFixture() }
}

/** Edits border width through the real number control and the existing commit phase. */
export function editBorder(value: number) {
  return editStyleControl('style.border-width', String(value))
}

/** Changes only color, so the integration can prove the spatial chain was not split. */
export function editColor(value: string) {
  return editStyleControl('style.background-color', value)
}

/** Runs Stop through the mounted timeline button, including an immediate double click. */
export async function stopItem(doubleClick = false) {
  const stop = timelineHost.querySelector<HTMLButtonElement>('button[title="Stop"]')!
  stop.click()
  if (doubleClick) stop.click()
  await until(() => coordination.transport.getProgress()?.timelineMs === 0)
  await new Promise((resolve) => setTimeout(resolve, 100))
  return readFixture()
}

/** Applies history through the production facade rather than replacing the document manually. */
export async function undoEdit() {
  const before = acknowledgement
  actions.undo()
  await until(() => acknowledgement > before)
  return readFixture()
}

/** Replays the real history transaction and waits for its rebuilt player. */
export async function redoEdit() {
  const before = acknowledgement
  actions.redo()
  await until(() => acknowledgement > before)
  return readFixture()
}

/** Plays through the real animation clock to the natural terminal handoff. */
export async function playToEnd() {
  await selectTime(0)
  coordination.transport.play()
  await until(() => actor.getSnapshot().value === 'playing')
  await until(() => actor.getSnapshot().value === 'idle' && coordination.transport.getProgress()?.timelineMs === 5000)
  return readFixture()
}

/** Reloads serialized author data without involving the application's persistence store. */
export async function reloadDocument() {
  const documentScene = JSON.parse(JSON.stringify(actor.getSnapshot().context.scene)) as EditorScene
  const previousRoot = sceneHost.querySelector('.editor-v2-instance-root')
  actor.send({ type: 'SCENE_LOADED', scene: documentScene })
  await until(() => sceneHost.querySelector('.editor-v2-instance-root') !== previousRoot
    && coordination.presentation.get()?.timeMs === 0)
  return readFixture()
}

/** Observes the actual resize lifecycle of the player and editor overlays. */
export async function resizeScene(width: number) {
  sceneHost.style.width = `${width}px`
  await new Promise((resolve) => setTimeout(resolve, 150))
  return readFixture()
}

/** Fails when the actual item corners and its authoring frame disagree by more than a CSS pixel. */
function verifyPose(label: string, pose: ReturnType<typeof readFixture>) {
  if (pose.alignmentError > 1) throw new Error(`${label}: item/CS error ${pose.alignmentError}px`)
  const keyframe = pose.document!.items[0]!.keyframes.find((candidate) => candidate.timeMs === pose.time)
  const ghost = keyframe === undefined ? undefined : pose.ghosts.find((candidate) => candidate.id === keyframe.id)
  if (ghost !== undefined && (ghost.alignmentError > 1 || ghost.display !== 'none')) {
    throw new Error(`${label}: current ghost error ${ghost.alignmentError}px, display ${ghost.display}`)
  }
  return { label, alignmentError: pose.alignmentError, ...(ghost === undefined ? {} : { ghostError: ghost.alignmentError }) }
}

/** Exercises production events, materialization, snapshots, rebuilding and playback in a real browser. */
export async function runRegressionChecks(section: 'all' | 'editing' | 'playback' | 'decor' = 'all') {
  const results: Array<ReturnType<typeof verifyPose>> = []
  const checkGesture = async (label: string, run: () => ReturnType<typeof rotateItem>, comparePreview = true) => {
    const result = await run()
    results.push(verifyPose(`${label}: preview`, result.preview), verifyPose(`${label}: commit`, result.committed))
    const gap = Math.max(...result.preview.frameCorners.map((point, index) =>
      Math.hypot(point.x - result.committed.frameCorners[index]!.x, point.y - result.committed.frameCorners[index]!.y)))
    if (comparePreview && gap > 1) throw new Error(`${label}: preview/commit gap ${gap}px ${JSON.stringify({
      previewFrame: result.preview.frame,
      committedFrame: result.committed.frame,
      previewCorners: result.preview.frameCorners,
      committedCorners: result.committed.frameCorners,
      authorOffset: result.committed.document?.items[0]?.keyframes.map((keyframe) => ({
        timeMs: keyframe.timeMs,
        offset: result.committed.document?.decors[keyframe.decorId]?.offset,
        path: result.committed.document?.decors[keyframe.decorId]?.path,
      })),
    })}`)
  }
  if (section === 'all' || section === 'editing') {
  await resetFixture()
  await selectTime(5000)
  results.push(verifyPose('target', readFixture()))
  await checkGesture('needle 30', () => rotateItem(30))
  await checkGesture('pivot', movePivot)
  await checkGesture('needle after pivot', () => rotateItem(15))
  await checkGesture('resize', () => resizeItem(20, 15))
  await checkGesture('border', () => editBorder(16))
  await checkGesture('move endpoint', () => moveItem(20, 10), false)
  await selectTime(2500)
  await checkGesture('needle between KFs with scale and pivot', () => rotateItem(20))
  const inserted = readFixture().document!
  if (inserted.items[0]!.keyframes.length !== 3 || Object.values(inserted.decors).filter((decor) => decor.path !== undefined).length !== 2) {
    throw new Error('Pose insertion must produce exactly two authored arcs and one new KF')
  }
  await selectTime(0)
  await checkGesture('source needle', () => rotateItem(45))
  }
  if (section === 'all' || section === 'playback') {
  if (section === 'playback') {
    await resetFixture()
    await selectTime(2500)
    await rotateItem(20)
  }
  results.push(verifyPose('undo', await undoEdit()), verifyPose('redo', await redoEdit()))
  await reloadDocument()
  await selectTime(2500)
  results.push(verifyPose('serialized reload', readFixture()))
  results.push(verifyPose('natural Play end', await playToEnd()))
  const stopped = await stopItem(true)
  results.push(verifyPose('double Stop', stopped), verifyPose('repeated Stop', await stopItem()))
  results.push(verifyPose('resize root', await resizeScene(720)))
  }

  if (section === 'all' || section === 'decor') {
  await resetFixture()
  await selectTime(2500)
  const beforeColor = readFixture()
  const changedColor = await editColor('#cc4400')
  results.push(verifyPose('color preview', changedColor.preview), verifyPose('color commit', changedColor.committed))
  if (changedColor.committed.document!.items[0]!.keyframes.filter((keyframe) => keyframe.channel === 'pose').length !== 2
    || changedColor.committed.document!.decors['test-target']!.path !== beforeColor.document!.decors['test-target']!.path) {
    throw new Error('A decoration-only KF must leave the pose chain and authored path intact')
  }
  const displacement = Math.max(...beforeColor.itemCorners.map((point, index) =>
    Math.hypot(point.x - changedColor.committed.itemCorners[index]!.x, point.y - changedColor.committed.itemCorners[index]!.y)))
  if (displacement > 1) throw new Error(`Color edit moved the presented item by ${displacement}px`)
  await checkGesture('promote decor KF to pose', () => rotateItem(20))
  }
  return results
}
