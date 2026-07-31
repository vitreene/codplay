/** Replaces named path placeholders with concrete scene references. */
export function resolveSceneValidationPath(
  template: readonly string[],
  replacements: Readonly<Record<string, string>> = {},
): string {
  return template
    .map((segment) => replacements[segment] ?? segment)
    .join('.')
}
