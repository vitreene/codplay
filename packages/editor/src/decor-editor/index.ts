export type {
  OrientationContext, ItemType, FlexAnchor, CapsulePatch, OffsetPatch, TextAutoSizePatch,
  DecorPatch, ResolvedDecor, DecorPreset,
  ZoneCoords, ZoneDef, ZoneTable, ZoneCard,
  SelectionFrameValue,
} from './types'

export { mergePatch, resolveDecor } from './merge'
export { stripInherited } from './strip-inherited'
export { pxToCqw, cqwToPx } from './units'
export { panelsForType, panelsForTypes, findPanel } from './palette-panel'
export type { PanelId, PanelField, PanelFieldKind, PalettePanel, PaletteConfig } from './palette-panel'
export { orientationFromRatio, coordsForContext, updateZoneCoords } from './zones'
export { resolveFieldAcrossItems } from './field-state'
export type { FieldState } from './field-state'
export {
  applyDecorModifications,
  applyDecorPatch,
  cloneDecorValue,
  collectDecorModifications,
  modificationsFromDecorPatch,
  modificationsToDecorPatch,
  readDecorPath,
  writeDecorPath,
} from './modified-properties'
export type { DecorModificationMap, DecorPropertyModification } from './modified-properties'

export { decorEditorMachine, resolveAttachedDecor } from './machine'
export type { AttachedItem, AttachItemEntry, DecorEditorMachineContext, DecorEditorEvent } from './machine'

export { DecorEditorController } from './controller'
export type { DecorEditorCatalogs, AttachItemInput, DecorChangeEntry, DecorEditorSnapshot, Unsubscribe } from './controller'

export { hexToCssOklch, cssColorToHex, cssOklchComponentsToHex } from './color-adapter'
export { createDecorEditorPalette } from './render'
export type { DecorEditorPaletteHandle } from './render'
