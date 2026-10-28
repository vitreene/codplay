import type { EditorScene } from '../commands/types'

export type EditorSceneSummary = Readonly<{
  id: string
  title: string
  revision: number
}>

export type StoredEditorScene = Readonly<{
  scene: EditorScene
  revision: number
}>

export type SaveEditorSceneResult =
  | Readonly<{ kind: 'saved'; revision: number }>
  | Readonly<{ kind: 'conflict'; currentRevision: number | null }>
