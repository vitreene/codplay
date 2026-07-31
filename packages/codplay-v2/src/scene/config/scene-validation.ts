/** Structural paths used by scene and story guards. */
export const SCENE_DOC_VALIDATION_PATHS = {
  root: ['scene'],
  id: ['id'],
  stories: ['stories'],
  storyId: ['stories', '<storyId>', 'id'],
  storyPersos: ['stories', '<storyId>', 'persos'],
  persoId: ['stories', '<storyId>', 'persos', '<persoId>', 'id'],
  persoType: ['stories', '<storyId>', 'persos', '<persoId>', 'type'],
  tracks: ['tracks'],
  actions: ['stories', '<storyId>', 'persos', '<persoId>', 'actions'],
} as const

/** Replaces named path placeholders with concrete scene references. */
export function resolveSceneValidationPath(
  template: readonly string[],
  replacements: Readonly<Record<string, string>> = {},
): string {
  return template
    .map((segment) => replacements[segment] ?? segment)
    .join('.')
}
