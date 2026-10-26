const HASH_OFFSET_BASIS = 14695981039346656037n
const HASH_PRIME = 1099511628211n
const UINT64_MASK = 0xffffffffffffffffn

/** Creates a stable, compact CSS-safe class for values that belong to one scene target. */
export function sceneStyleClassName(role: string, targetId: string): string {
  return `elce-${role}-${compactIdentifierHash(targetId)}`
}

/** Hashes an identifier to a compact base-36 suffix while preserving deterministic naming. */
function compactIdentifierHash(value: string): string {
  let hash = HASH_OFFSET_BASIS
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index))
    hash = (hash * HASH_PRIME) & UINT64_MASK
  }
  return hash.toString(36)
}

/** Renders one class rule from CSS declarations owned by a scene builder. */
export function sceneClassRule(
  className: string,
  declarations: Readonly<Record<string, string>>,
): string {
  const body = Object.entries(declarations)
    .map(([property, value]) => `  ${cssPropertyName(property)}: ${value};`)
    .join('\n')
  return `.${className} {\n${body}\n}`
}

/** Adds a generated class to the opening tag with one explicit markup ID. */
export function appendClassToMarkupElement(markup: string, elementId: string, className: string): string {
  const idAttribute = `id="${elementId}"`
  const idIndex = markup.indexOf(idAttribute)
  if (idIndex < 0) throw new Error(`L’élément ${elementId} est absent du markup de scène.`)

  const tagStart = markup.lastIndexOf('<', idIndex)
  const tagEnd = markup.indexOf('>', idIndex)
  if (tagStart < 0 || tagEnd < 0) throw new Error(`La balise ${elementId} est incomplète.`)

  const openingTag = markup.slice(tagStart, tagEnd + 1)
  const classAttribute = openingTag.match(/\bclass=(['"])(.*?)\1/)
  const replacement = classAttribute === null
    ? `${openingTag.slice(0, -1)} class="${className}">`
    : openingTag.replace(classAttribute[0], `class=${classAttribute[1]}${classAttribute[2]} ${className}${classAttribute[1]}`)
  return `${markup.slice(0, tagStart)}${replacement}${markup.slice(tagEnd + 1)}`
}

/** Converts a JavaScript CSS property name to the stylesheet spelling. */
function cssPropertyName(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
