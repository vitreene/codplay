/** Shared contracts for the composable V2 selection-frame overlay. */

export type SelectionFrameHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** Rotation axis expressed as a fraction of the untransformed local box. */
export type SelectionFrameRotationOrigin = Readonly<{ fx: number; fy: number }>

/** Local-pixel frame value supplied by the owning editor. */
export type SelectionFrameValue = Readonly<{
  x: number
  y: number
  width: number
  height: number
  rotate?: number
  scaleX?: number
  scaleY?: number
  /** Omitted values use the center of the box. */
  rotationOrigin?: SelectionFrameRotationOrigin
}>

/** Geometry emitted when an author draws a new item before it has a player node. */
export type SelectionFrameV2CreationResult = Readonly<
  | { kind: 'rect'; rect: Readonly<{ x: number; y: number; width: number; height: number }> }
  | { kind: 'cell-area'; area: Readonly<{ row: number; col: number; rowSpan: number; colSpan: number }> }
>

/** Active drawing mode; grid dimensions are expressed as track counts. */
export type SelectionFrameV2CreationMode = Readonly<
  | { kind: 'free' }
  | { kind: 'grid'; rows: number; cols: number }
>

/** Callback and trace threshold for the optional V2 creation surface. */
export type SelectionFrameV2CreationOptions = Readonly<{
  onCreate: (result: SelectionFrameV2CreationResult) => void
  onCancel?: () => void
  minTraceSizePx?: number
}>

/** Gesture delta emitted by the frame. Move/resize use local pixels; rotation uses degrees. */
export type SelectionFrameDelta = Readonly<
  | { kind: 'move'; dx: number; dy: number }
  | { kind: 'resize'; handle: SelectionFrameHandleId; dx: number; dy: number }
  | { kind: 'rotate'; dr: number }
  | { kind: 'pivot'; fx: number; fy: number }
>

/** Context exposed to one optional frame modifier; it contains no player or document authority. */
export type SelectionFrameV2ModifierContext = Readonly<{
  /** Stable scene overlay host; it is not a player item node. */
  sceneRoot: HTMLElement
  /** Frame root to which modifier-owned controls may be appended. */
  frame: HTMLElement
  /** Current accepted value, including the live preview candidate. */
  getValue: () => SelectionFrameValue | null
  /** Converts one modifier gesture delta and returns its accepted candidate. */
  onPreview: (delta: SelectionFrameDelta) => SelectionFrameValue | null
  /** Publishes an accepted candidate to the frame root and every composed modifier. */
  renderValue: (value: SelectionFrameValue | null) => void
  /** Commits the last accepted modifier candidate through the owning editor bridge. */
  onCommit: (value: SelectionFrameValue) => void
  /** Abandons the current modifier gesture without a document mutation. */
  onCancel: () => void
  /** True while the frame is hidden by lifecycle (for example during playback). */
  isSuspended: () => boolean
  /** Allows this modifier to reserve a base resize handle while it magnetizes to that point. */
  setHandleSuppressed: (handle: SelectionFrameHandleId, suppressed: boolean) => void
}>

/** Runtime part returned by one mounted modifier. */
export type SelectionFrameV2ModifierHandle = Readonly<{
  /** Refreshes modifier-owned controls from the accepted frame value. */
  update: (value: SelectionFrameValue | null) => void
  /** Clears transient modifier state when a new selection/rebuild is supplied. */
  reset: () => void
  /** Whether a pointer gesture owned by this modifier is active. */
  isGestureActive: () => boolean
  /** Whether the modifier owns the given pointer target. */
  ownsTarget: (target: EventTarget | null) => boolean
  /** Unbinds gestures and removes modifier-owned controls. */
  destroy: () => void
}>

/** A reusable capability module mounted into the neutral V2 frame. */
export type SelectionFrameV2Modifier = Readonly<{
  /** Stable diagnostic/name key for the composed capability. */
  name: string
  /** Mounts the module into one frame instance. */
  mount: (context: SelectionFrameV2ModifierContext) => SelectionFrameV2ModifierHandle
}>

export type SelectionFrameV2Options = Readonly<{
  /** Stable scene overlay host; it is not a player item node. */
  sceneRoot: HTMLElement
  /** Computes and previews a candidate from one gesture delta. */
  onPreview: (delta: SelectionFrameDelta) => SelectionFrameValue | null
  /** Commits the last accepted candidate through the owning editor bridge. */
  onCommit: (value: SelectionFrameValue) => void
  /** Abandons the current gesture without producing a document mutation. */
  onCancel?: () => void
  /** Optional capability modules. The default is the built-in rotation modifier. */
  modifiers?: readonly SelectionFrameV2Modifier[]
  /** Enables a hidden drawing surface that can be activated through the returned handle. */
  creation?: SelectionFrameV2CreationOptions
}>

export type SelectionFrameV2Handle = Readonly<{
  element: HTMLElement
  setValue: (value: SelectionFrameValue | null) => void
  /** Starts or stops authoring a new frame over the scene host. */
  setCreationMode: (mode: SelectionFrameV2CreationMode | null) => void
  setSuspended: (suspended: boolean) => void
  isGestureActive: () => boolean
  destroy: () => void
}>
