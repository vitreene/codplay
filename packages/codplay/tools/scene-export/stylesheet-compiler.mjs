import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import postcss from 'postcss'

/** Resolves imported sheets and local CSS URLs before the package writer copies files. */
export async function compileStyleSheets(stylesheets, sceneFile) {
  const resources = []
  const cssRoots = []
  const fontFaces = []
  const sceneDirectory = path.dirname(path.resolve(sceneFile))

  for (const stylesheet of stylesheets) {
    if (typeof stylesheet.cssText !== 'string') {
      throw new Error(`CSS export from ${stylesheet.sourceFile} must be a string.`)
    }
    const sourceFile = path.resolve(stylesheet.sourceFile ?? sceneFile)
    const root = await compileCssText({
      cssText: stylesheet.cssText,
      sourceFile,
      sceneDirectory,
      importStack: [],
      resources,
    })
    cssRoots.push(root)
    fontFaces.push(...collectFontFaces(root, sourceFile, fontFaces.length))
  }

  const cssText = cssRoots.flatMap((root) => root.nodes ?? []).map((node) => node.toString()).join('\n')
  return {
    cssText,
    classNames: collectClassNames(cssRoots),
    resources,
    fontFaces,
  }
}

/** Extracts the declared font faces in their compiled stylesheet order. */
function collectFontFaces(root, fallbackSourceFile, firstOrder) {
  const fontFaces = []
  root.walkAtRules('font-face', (node) => {
    let parent = node.parent
    while (parent !== undefined && parent.type !== 'root') {
      if (parent.type === 'rule') {
        throw cssNodeError(node, node.source?.input?.file ?? fallbackSourceFile, '@font-face cannot be nested inside a style rule.')
      }
      parent = parent.parent
    }

    const declarations = new Map()
    node.walkDecls((declaration) => declarations.set(declaration.prop.toLowerCase(), declaration.value.trim()))
    const sourceFile = node.source?.input?.file ?? fallbackSourceFile
    const rawFamily = declarations.get('font-family')
    if (rawFamily === undefined) {
      throw cssNodeError(node, sourceFile, '@font-face requires a font-family descriptor.')
    }
    const family = parseFontFamily(rawFamily, node, sourceFile)
    const src = declarations.get('src')
    if (src === undefined || findCssUrlFunctions(src).length === 0) {
      throw cssNodeError(node, sourceFile, '@font-face requires at least one local or embedded url() source.')
    }

    fontFaces.push({
      sourceOrder: firstOrder + fontFaces.length,
      family,
      src,
      weight: declarations.get('font-weight') ?? 'normal',
      style: declarations.get('font-style') ?? 'normal',
      stretch: declarations.get('font-stretch') ?? 'normal',
      variationSettings: declarations.get('font-variation-settings') ?? 'normal',
      unicodeRange: declarations.get('unicode-range') ?? 'U+0-10FFFF',
      display: declarations.get('font-display') ?? 'auto',
    })
  })
  return fontFaces
}

/** Decodes one CSS font-family name for the package manifest. */
function parseFontFamily(value, node, sourceFile) {
  const cleaned = removeCssComments(value).trim()
  if (cleaned === '') throw cssNodeError(node, sourceFile, '@font-face font-family cannot be empty.')

  let name = cleaned
  const first = cleaned[0]
  if (first === '"' || first === "'") {
    if (cleaned.at(-1) !== first) {
      throw cssNodeError(node, sourceFile, '@font-face font-family must contain exactly one quoted name.')
    }
    name = cleaned.slice(1, -1)
  } else if (cleaned.includes(',') || /["']/.test(cleaned)) {
    throw cssNodeError(node, sourceFile, '@font-face font-family must contain exactly one family name.')
  }

  const decoded = decodeCssEscapes(name).replace(/\s+/g, ' ').trim()
  if (decoded === '') {
    throw cssNodeError(node, sourceFile, '@font-face font-family must contain exactly one family name.')
  }
  return decoded
}

/** Removes CSS comments without changing comment-like text inside a string. */
function removeCssComments(value) {
  let output = ''
  let quote
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (quote !== undefined) {
      output += character
      if (character === '\\') {
        output += value[index + 1] ?? ''
        index += 1
      } else if (character === quote) {
        quote = undefined
      }
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      output += character
      continue
    }
    if (value.startsWith('/*', index)) {
      const end = value.indexOf('*/', index + 2)
      index = end < 0 ? value.length : end + 1
      output += ' '
      continue
    }
    output += character
  }
  return output
}

/** Decodes CSS hexadecimal and escaped-character sequences in a family name. */
function decodeCssEscapes(value) {
  return value.replace(/\\(?:([\da-fA-F]{1,6})(?:\r\n|[\t\r\n\f ])?|\r\n|[\n\r\f]|([\s\S]))/g, (_match, hex, escaped) => {
    if (hex !== undefined) {
      const codePoint = Number.parseInt(hex, 16)
      return codePoint === 0 || codePoint > 0x10ffff || codePoint >= 0xd800 && codePoint <= 0xdfff
        ? '\uFFFD'
        : String.fromCodePoint(codePoint)
    }
    return escaped ?? ''
  })
}

/** Parses one stylesheet, expands imports in place, and records each local asset reference. */
async function compileCssText({ cssText, sourceFile, sceneDirectory, importStack, resources }) {
  let root
  try {
    root = postcss.parse(cssText, { from: sourceFile })
  } catch (error) {
    throw new Error(formatCssError(error, sourceFile))
  }

  const canonicalSource = await realpath(sourceFile).catch(() => sourceFile)
  const nextImportStack = [...importStack, canonicalSource]
  let seenNonImport = false
  const nodes = [...(root.nodes ?? [])]

  for (const node of nodes) {
    if (node.type === 'atrule' && node.name.toLowerCase() === 'import') {
      if (seenNonImport) throw cssNodeError(node, sourceFile, '@import must appear before stylesheet rules.')
      const imported = await compileImport(node, sourceFile, sceneDirectory, nextImportStack, resources)
      node.replaceWith(...imported)
      continue
    }
    if (node.type === 'atrule' && node.name.toLowerCase() === 'charset') {
      node.remove()
      continue
    }
    if (node.type === 'atrule' && node.name.toLowerCase() === 'namespace') {
      throw cssNodeError(node, sourceFile, '@namespace cannot be preserved inside a scoped scene stylesheet.')
    }
    seenNonImport = true
    await collectNodeResources(node, sourceFile, sceneDirectory, resources)
  }

  return root
}

/** Expands one local @import at its source position and retains its supported qualifiers. */
async function compileImport(node, sourceFile, sceneDirectory, importStack, resources) {
  const { url, qualifiers } = parseImportParams(node.params, node, sourceFile)
  const resolved = await resolveCssFile(url, sourceFile, sceneDirectory, node)
  const canonicalPath = await realpath(resolved)
  if (importStack.includes(canonicalPath)) {
    throw cssNodeError(node, sourceFile, `CSS import cycle detected: ${[...importStack, canonicalPath].join(' -> ')}`)
  }
  const importedText = await readFile(canonicalPath, 'utf8')
  const importedRoot = await compileCssText({
    cssText: importedText,
    sourceFile: canonicalPath,
    sceneDirectory,
    importStack,
    resources,
  })
  return wrapImportedNodes(importedRoot.nodes ?? [], qualifiers)
}

/** Parses the target and supported layer(), supports(), and media portions of @import. */
function parseImportParams(params, node, sourceFile) {
  let cursor = skipWhitespace(params, 0)
  let url
  if (params[cursor] === '"' || params[cursor] === "'") {
    const parsed = readQuoted(params, cursor, node, sourceFile)
    url = parsed.value
    cursor = parsed.end
  } else if (startsFunction(params, cursor, 'url')) {
    const parsed = readFunction(params, cursor, node, sourceFile)
    url = unquote(parsed.value.trim(), node, sourceFile)
    cursor = parsed.end
  } else {
    throw cssNodeError(node, sourceFile, '@import must use a quoted path or url(...).')
  }

  const tail = params.slice(cursor).trim()
  const qualifiers = []
  let remaining = tail
  const layer = consumeImportModifier(remaining, 'layer', node, sourceFile)
  if (layer !== undefined) {
    qualifiers.push({ name: 'layer', params: layer.value })
    remaining = layer.remaining
  }
  const supports = consumeImportModifier(remaining, 'supports', node, sourceFile)
  if (supports !== undefined) {
    qualifiers.push({ name: 'supports', params: supports.value })
    remaining = supports.remaining
  }
  if (/^(?:layer|supports)\b/i.test(remaining.trimStart())) {
    throw cssNodeError(node, sourceFile, '@import layer()/supports() modifiers are duplicated or out of order.')
  }
  if (/\bscope\s*\(/i.test(remaining)
    || /\b(?:layer|supports)\s*\(/i.test(remaining)) {
    throw cssNodeError(node, sourceFile, `Unsupported or misplaced @import qualifier: ${remaining.trim()}`)
  }
  if (remaining.trim() !== '') qualifiers.push({ name: 'media', params: remaining.trim() })
  return { url, qualifiers }
}

/** Consumes one optional import modifier at the start of the remaining qualifier text. */
function consumeImportModifier(value, name, node, sourceFile) {
  const text = value.trimStart()
  if (!new RegExp(`^${name}(?:\\s|\\(|$)`, 'i').test(text)) return undefined
  const afterName = skipWhitespace(text, name.length)
  if (text[afterName] !== '(') {
    if (name !== 'layer') throw cssNodeError(node, sourceFile, `@import ${name}() requires a condition.`)
    return { value: '', remaining: text.slice(afterName).trimStart() }
  }
  const parsed = readFunction(text, afterName, node, sourceFile)
  const params = parsed.value.trim()
  if (params.length === 0 && name === 'supports') {
    throw cssNodeError(node, sourceFile, '@import supports() cannot be empty.')
  }
  return { value: params, remaining: text.slice(parsed.end).trimStart() }
}

/** Wraps imported rules from inner to outer qualifier order without changing their declarations. */
function wrapImportedNodes(importedNodes, qualifiers) {
  let nodes = importedNodes.map((node) => node.clone())
  for (const qualifier of [...qualifiers].reverse()) {
    const params = qualifier.name === 'supports'
      && !qualifier.params.startsWith('(')
      && !/^(?:not\b|selector\(|font-(?:format|tech)\()/i.test(qualifier.params)
      ? `(${qualifier.params})`
      : qualifier.params
    const wrapper = postcss.atRule({ name: qualifier.name, params })
    wrapper.append(nodes)
    nodes = [wrapper]
  }
  return nodes
}

/** Finds and records URL functions in declarations and other nested CSS values. */
async function collectNodeResources(node, sourceFile, sceneDirectory, resources) {
  if (node.type === 'decl') {
    const isFontSource = node.parent?.type === 'atrule'
      && node.parent.name.toLowerCase() === 'font-face'
      && node.prop.toLowerCase() === 'src'
    if (isFontSource && hasCssFunction(node.value, 'local')) {
      throw cssNodeError(node, sourceFile, '@font-face local() sources are unsupported in a self-contained scene package.')
    }
    const replacements = []
    for (const reference of findCssUrlFunctions(node.value)) {
      if (isFontSource && (reference.value.trim() === '' || reference.value.trim().startsWith('#'))) {
        throw cssNodeError(node, sourceFile, '@font-face sources cannot use empty or fragment-only URLs.')
      }
      const token = await compileResourceUrl(reference.value, sourceFile, sceneDirectory, isFontSource ? 'font' : 'image', node, resources.length)
      if (token === undefined) continue
      resources.push(token.resource)
      replacements.push({ ...reference, replacement: `url(${JSON.stringify(token.resource.token)})` })
    }
    node.value = applyTextReplacements(node.value, replacements)
    return
  }

  if (node.type === 'atrule') {
    const name = node.name.toLowerCase()
    if (name === 'import') {
      throw cssNodeError(node, sourceFile, '@import must be a top-level stylesheet rule.')
    }
    if (name === 'namespace') {
      throw cssNodeError(node, sourceFile, '@namespace cannot be preserved inside a scoped scene stylesheet.')
    }
    if (name === 'charset') {
      throw cssNodeError(node, sourceFile, '@charset is only supported at the stylesheet root.')
    }
    for (const reference of findCssUrlFunctions(node.params)) {
      const token = await compileResourceUrl(reference.value, sourceFile, sceneDirectory, 'image', node, resources.length)
      if (token === undefined) continue
      resources.push(token.resource)
      node.params = applyTextReplacements(node.params, [{ ...reference, replacement: `url(${JSON.stringify(token.resource.token)})` }])
    }
  }
  for (const child of node.nodes ?? []) {
    await collectNodeResources(child, sourceFile, sceneDirectory, resources)
  }
}

/** Resolves one CSS URL to a compiler-owned token, preserving query and fragment suffixes. */
async function compileResourceUrl(url, sourceFile, sceneDirectory, type, node, resourceIndex) {
  const value = url.trim()
  if (value === '' || value.startsWith('#') || /^data:/i.test(value)) return undefined
  if (value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value) || path.win32.isAbsolute(value)) {
    throw cssNodeError(node, sourceFile, `CSS resource must be local to the exported project: ${value}`)
  }

  const suffixIndex = [value.indexOf('?'), value.indexOf('#')]
    .filter((index) => index >= 0)
    .reduce((left, right) => Math.min(left, right), Number.POSITIVE_INFINITY)
  const encodedPath = Number.isFinite(suffixIndex) ? value.slice(0, suffixIndex) : value
  const suffix = Number.isFinite(suffixIndex) ? value.slice(suffixIndex) : ''
  if (encodedPath === '' || encodedPath.includes('\\')) {
    throw cssNodeError(node, sourceFile, `CSS resource path is ambiguous: ${value}`)
  }
  let decodedPath
  try {
    decodedPath = decodeURIComponent(encodedPath)
  } catch {
    throw cssNodeError(node, sourceFile, `CSS resource path has invalid URL encoding: ${value}`)
  }
  const baseDirectory = decodedPath.startsWith('/') ? path.resolve(sceneDirectory) : path.dirname(sourceFile)
  const resolvedPath = path.resolve(baseDirectory, decodedPath.replace(/^\//, ''))
  const info = await stat(resolvedPath).catch(() => undefined)
  if (info === undefined || !info.isFile()) {
    throw cssNodeError(node, sourceFile, `CSS resource file does not exist: ${value}`)
  }

  const canonicalPath = await realpath(resolvedPath)
  const token = `codplay-resource-${resourceIndex}`
  return {
    resource: {
      token,
      sourcePath: canonicalPath,
      suffix,
      type,
      sourceFile,
      line: node.source?.start?.line,
      column: node.source?.start?.column,
    },
  }
}

/** Finds unquoted or quoted url(...) tokens while skipping strings and comments. */
function findCssUrlFunctions(value) {
  const matches = []
  let index = 0
  while (index < value.length) {
    if (value.startsWith('/*', index)) {
      const end = value.indexOf('*/', index + 2)
      index = end < 0 ? value.length : end + 2
      continue
    }
    if (value[index] === '"' || value[index] === "'") {
      index = skipQuoted(value, index)
      continue
    }
    if (isIdentifierStart(value[index]) && value.slice(index, index + 3).toLowerCase() === 'url') {
      const before = value[index - 1]
      const afterName = skipWhitespace(value, index + 3)
      if (!isIdentifierPart(before) && value[afterName] === '(') {
        const parsed = readFunction(value, afterName, undefined, undefined)
        matches.push({ start: index, end: parsed.end, value: unquote(parsed.value.trim()) })
        index = parsed.end
        continue
      }
    }
    index += 1
  }
  return matches
}

/** Detects one CSS function outside strings and comments without interpreting its arguments. */
function hasCssFunction(value, functionName) {
  let index = 0
  while (index < value.length) {
    if (value.startsWith('/*', index)) {
      const end = value.indexOf('*/', index + 2)
      index = end < 0 ? value.length : end + 2
      continue
    }
    if (value[index] === '"' || value[index] === "'") {
      index = skipQuoted(value, index)
      continue
    }
    if (isIdentifierStart(value[index])
      && value.slice(index, index + functionName.length).toLowerCase() === functionName.toLowerCase()
      && !isIdentifierPart(value[index - 1])
      && !isIdentifierPart(value[index + functionName.length])) {
      const open = skipWhitespace(value, index + functionName.length)
      if (value[open] === '(') return true
    }
    index += 1
  }
  return false
}

/** Reads a balanced CSS function and returns its inner text and exclusive end offset. */
function readFunction(value, start, node, sourceFile) {
  const open = value.indexOf('(', start)
  if (open < 0) throw cssNodeError(node, sourceFile, 'Malformed CSS function.')
  let depth = 1
  let index = open + 1
  while (index < value.length) {
    if (value.startsWith('/*', index)) {
      const commentEnd = value.indexOf('*/', index + 2)
      index = commentEnd < 0 ? value.length : commentEnd + 2
      continue
    }
    if (value[index] === '"' || value[index] === "'") {
      index = skipQuoted(value, index)
      continue
    }
    if (value[index] === '(') depth += 1
    if (value[index] === ')') {
      depth -= 1
      if (depth === 0) return { value: value.slice(open + 1, index), end: index + 1 }
    }
    index += 1
  }
  throw cssNodeError(node, sourceFile, 'Unclosed CSS function.')
}

/** Reads a CSS quoted string and returns its decoded value and exclusive end offset. */
function readQuoted(value, start, node, sourceFile) {
  const end = skipQuoted(value, start)
  if (end >= value.length && value.at(-1) !== value[start]) {
    throw cssNodeError(node, sourceFile, 'Unclosed CSS string.')
  }
  return { value: unquote(value.slice(start, end), node, sourceFile), end }
}

/** Removes one quote pair and refuses CSS escapes that cannot be mapped safely to a file path. */
function unquote(value, node, sourceFile) {
  const trimmed = value.trim()
  const unquoted = trimmed.length >= 2 && (trimmed[0] === '"' || trimmed[0] === "'")
    ? trimmed.slice(1, -1)
    : trimmed
  if (unquoted.includes('\\')) throw cssNodeError(node, sourceFile, 'Escaped CSS resource paths are not supported.')
  return unquoted
}

/** Advances past a CSS quoted string, honoring escaped quote characters. */
function skipQuoted(value, start) {
  const quote = value[start]
  let index = start + 1
  while (index < value.length) {
    if (value[index] === '\\') {
      index += 2
      continue
    }
    if (value[index] === quote) return index + 1
    index += 1
  }
  return value.length
}

/** Resolves one quoted import file relative to its importing stylesheet. */
async function resolveCssFile(url, sourceFile, sceneDirectory, node) {
  if (url.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(url) || path.win32.isAbsolute(url)) {
    throw cssNodeError(node, sourceFile, `CSS import must be local to the exported project: ${url}`)
  }
  const suffixIndex = [url.indexOf('?'), url.indexOf('#')]
    .filter((index) => index >= 0)
    .reduce((left, right) => Math.min(left, right), Number.POSITIVE_INFINITY)
  const encodedPath = Number.isFinite(suffixIndex) ? url.slice(0, suffixIndex) : url
  const suffix = Number.isFinite(suffixIndex) ? url.slice(suffixIndex) : ''
  if (suffix !== '' || encodedPath === '') {
    throw cssNodeError(node, sourceFile, `CSS import query, fragment or empty path is unsupported: ${url}`)
  }
  let decodedPath
  try {
    decodedPath = decodeURIComponent(encodedPath)
  } catch {
    throw cssNodeError(node, sourceFile, `CSS import has invalid URL encoding: ${url}`)
  }
  const baseDirectory = decodedPath.startsWith('/') ? sceneDirectory : path.dirname(sourceFile)
  const filePath = path.resolve(baseDirectory, decodedPath.replace(/^\//, ''))
  if (path.extname(filePath).toLowerCase() !== '.css') {
    throw cssNodeError(node, sourceFile, `Only .css imports are supported: ${url}`)
  }
  const info = await stat(filePath).catch(() => undefined)
  if (info === undefined || !info.isFile()) throw cssNodeError(node, sourceFile, `CSS import file does not exist: ${url}`)
  return filePath
}

/** Replaces resource tokens from right to left without shifting later CSS offsets. */
function applyTextReplacements(value, replacements) {
  return [...replacements].sort((left, right) => right.start - left.start).reduce(
    (result, replacement) => result.slice(0, replacement.start) + replacement.replacement + result.slice(replacement.end),
    value,
  )
}

/** Collects authored CSS class selectors in first-use order without renaming them. */
function collectClassNames(roots) {
  const names = new Set()
  for (const root of roots) {
    root.walkRules((rule) => {
      for (const name of readClassSelectors(rule.selector)) names.add(name)
    })
  }
  return [...names]
}

/** Reads class selector identifiers while ignoring strings, comments, and attribute selectors. */
function readClassSelectors(selector) {
  const names = []
  let index = 0
  let attributeDepth = 0
  while (index < selector.length) {
    if (selector.startsWith('/*', index)) {
      const end = selector.indexOf('*/', index + 2)
      index = end < 0 ? selector.length : end + 2
      continue
    }
    if (selector[index] === '"' || selector[index] === "'") {
      index = skipQuoted(selector, index)
      continue
    }
    if (selector[index] === '\\') {
      index = skipCssEscape(selector, index)
      continue
    }
    if (selector[index] === '[') attributeDepth += 1
    if (selector[index] === ']') attributeDepth = Math.max(0, attributeDepth - 1)
    if (attributeDepth === 0 && selector[index] === '.') {
      const identifier = readCssIdentifier(selector, index + 1)
      if (identifier !== undefined) {
        names.push(identifier.value)
        index = identifier.end
        continue
      }
    }
    index += 1
  }
  return names
}

/** Reads one CSS identifier following a class-selector dot and returns its decoded name. */
function readCssIdentifier(value, start) {
  let index = start
  let decoded = ''
  while (index < value.length) {
    const character = value[index]
    if (character === '\\') {
      const escape = readCssEscape(value, index)
      if (escape === undefined) break
      decoded += escape.value
      index = escape.end
      continue
    }
    if (!/[a-z0-9_-]/i.test(character ?? '') && (character?.codePointAt(0) ?? 0) < 0x80) break
    decoded += character
    index += 1
  }
  if (decoded === '' || /^[0-9]/.test(decoded) || /^-[0-9]/.test(decoded)) return undefined
  return { value: decoded, end: index }
}

/** Reads one CSS escape and decodes either its hexadecimal code point or escaped character. */
function readCssEscape(value, start) {
  if (value[start] !== '\\' || start + 1 >= value.length) return undefined
  let index = start + 1
  const hexStart = index
  while (index < value.length && index - hexStart < 6 && /[0-9a-f]/i.test(value[index] ?? '')) index += 1
  if (index > hexStart) {
    const codePoint = Number.parseInt(value.slice(hexStart, index), 16)
    if (/\s/.test(value[index] ?? '')) index += 1
    return { value: String.fromCodePoint(codePoint === 0 || codePoint > 0x10ffff ? 0xfffd : codePoint), end: index }
  }
  return { value: value[index] ?? '', end: index + 1 }
}

/** Advances over one CSS escape while scanning a selector. */
function skipCssEscape(value, start) {
  return readCssEscape(value, start)?.end ?? start + 1
}

/** Formats a PostCSS parse error with the source file and parser location. */
function formatCssError(error, sourceFile) {
  const line = error?.line === undefined ? '' : `:${error.line}:${error.column ?? 1}`
  return `CSS compilation failed at ${sourceFile}${line}: ${error?.reason ?? String(error)}`
}

/** Creates one source-located CSS compilation error. */
function cssNodeError(node, sourceFile, message) {
  const line = node?.source?.start?.line
  const column = node?.source?.start?.column
  const location = line === undefined ? sourceFile : `${sourceFile}:${line}:${column ?? 1}`
  return new Error(`${location}: ${message}`)
}

/** Skips CSS whitespace beginning at a string offset. */
function skipWhitespace(value, start) {
  let index = start
  while (/\s/.test(value[index] ?? '')) index += 1
  return index
}

/** Checks whether a character can begin a CSS identifier. */
function isIdentifierStart(value) {
  return typeof value === 'string' && /[a-z_-]/i.test(value)
}

/** Checks whether a character can continue a CSS identifier. */
function isIdentifierPart(value) {
  return typeof value === 'string' && /[a-z0-9_-]/i.test(value)
}
