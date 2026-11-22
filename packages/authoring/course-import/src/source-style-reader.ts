import postcss from 'postcss'
import type { XmlElement, XmlLocation } from './source-model'

/** Supplies one source stylesheet without assuming its project or filesystem. */
export type SourceStyleSheet = Readonly<{
  documentId: string
  css: string
}>

/** Reports one CSS declaration that cannot be represented from known inputs. */
export type SourceStyleIssue = Readonly<{
  code: string
  message: string
  location: XmlLocation
  source: string
}>

/** Returns inline style values and provenance from matched source rules. */
export type SourceStyleResolution = Readonly<{
  style: Readonly<Record<string, unknown>>
  importantProperties: readonly string[]
  sources: readonly Readonly<{ selector: string; location: XmlLocation }>[]
  issues: readonly SourceStyleIssue[]
}>

type CssDeclaration = Readonly<{
  property: string
  value: string
  important: boolean
  location: XmlLocation
}>

type CssRule = Readonly<{
  selectors: readonly string[]
  declarations: readonly CssDeclaration[]
  order: number
  location: XmlLocation
  conditional: boolean
}>

type SelectorCompound = Readonly<{
  tagName?: string
  ids: readonly string[]
  classes: readonly string[]
  specificity: number
}>

type SelectorChain = Readonly<{
  compounds: readonly SelectorCompound[]
  combinators: readonly ('descendant' | 'child')[]
  specificity: number
}>

/** Indexes supplied stylesheets and resolves simple source selectors in order. */
export class SourceStyleReader {
  private readonly rules: readonly CssRule[]

  /** Parses each stylesheet once and retains source file positions. */
  constructor(stylesheets: readonly SourceStyleSheet[]) {
    this.rules = stylesheets.flatMap((stylesheet, sheetIndex) => readRules(stylesheet, sheetIndex))
  }

  /** Resolves matching declarations and reports selectors needing an adapter. */
  resolve(
    element: XmlElement,
    ancestors: readonly XmlElement[],
    options: Readonly<{
      sourceCanvasWidth?: number
      elementAttributes?: Readonly<Record<string, string>>
    }> = {},
  ): SourceStyleResolution {
    const selectorElement = options.elementAttributes === undefined
      ? element
      : { ...element, attributes: options.elementAttributes }
    const style: Record<string, unknown> = {}
    const importantProperties = new Set<string>()
    const issues: SourceStyleIssue[] = []
    const sources: { selector: string; location: XmlLocation }[] = []
    const matches: { declaration: CssDeclaration; specificity: number; order: number; selector: string }[] = []

    for (const rule of this.rules) {
      if (rule.conditional) {
        rule.selectors.filter((selector) => selectorMentionsElement(selector, selectorElement, ancestors)).forEach((selector) => {
          issues.push({
            code: 'source-css-condition-unresolved',
            message: 'The source CSS rule is conditional; its active condition is not known.',
            location: rule.location,
            source: selector,
          })
        })
        continue
      }
      const matchingSelectors = rule.selectors.flatMap((selector) => {
        const chain = parseSelectorChain(selector)
        if (chain === undefined) {
          if (selectorMentionsElement(selector, selectorElement, ancestors)) {
            issues.push({
              code: 'source-css-selector-unresolved',
              message: 'The source CSS selector is outside the supported selector grammar.',
              location: rule.location,
              source: selector,
            })
          }
          return []
        }
        return matchesSelector(chain, selectorElement, ancestors) ? [{ selector, specificity: chain.specificity }] : []
      })
      if (matchingSelectors.length === 0) continue

      const matched = matchingSelectors.reduce((best, candidate) => candidate.specificity > best.specificity ? candidate : best)
      sources.push({ selector: matched.selector, location: rule.location })
      rule.declarations.forEach((declaration, declarationIndex) => {
        if (declaration.property.startsWith('--') || /url\s*\(/i.test(declaration.value)) {
          const customProperty = declaration.property.startsWith('--')
          issues.push({
            code: customProperty ? 'source-css-variable-unresolved' : 'source-css-resource-unresolved',
            message: customProperty
              ? 'The source CSS custom property declaration is not evaluated by the style reader.'
              : 'The source CSS resource URL needs a project resource resolver before it can be relocated.',
            location: declaration.location,
            source: `${declaration.property}: ${declaration.value}`,
          })
          return
        }
        const normalized = normalizePixelLengths(declaration.value, options.sourceCanvasWidth)
        const value = normalized === undefined ? undefined : normalizeCssColor(declaration.property, normalized)
        if (value === undefined) {
          issues.push({
            code: /var\s*\(/i.test(declaration.value) ? 'source-css-variable-unresolved' : 'source-css-length-unresolved',
            message: /var\s*\(/i.test(declaration.value)
              ? 'The source CSS custom property value is not resolved by the supplied stylesheets.'
              : 'This CSS value uses px or an unsupported function and needs an explicit source adapter result.',
            location: declaration.location,
            source: `${declaration.property}: ${declaration.value}`,
          })
          return
        }
        matches.push({ declaration: { ...declaration, value }, specificity: matched.specificity, order: rule.order * 1_000 + declarationIndex, selector: matched.selector })
      })
    }

    matches
      .sort((left, right) => Number(left.declaration.important) - Number(right.declaration.important)
        || left.specificity - right.specificity
        || left.order - right.order)
      .forEach(({ declaration }) => {
        const property = toStyleProperty(declaration.property)
        style[property] = declaration.value
        if (declaration.important) importantProperties.add(property)
        else importantProperties.delete(property)
      })

    return { style, importantProperties: [...importantProperties], sources, issues }
  }
}

/** Reads style rules and declaration locations from one stylesheet. */
function readRules(stylesheet: SourceStyleSheet, sheetIndex: number): readonly CssRule[] {
  const root = postcss.parse(stylesheet.css, { from: stylesheet.documentId })
  const rules: CssRule[] = []
  let order = sheetIndex * 1_000_000
  root.walkRules((rule) => {
    order += 1
    const selectors = splitSelectors(rule.selector)
    const declarations = rule.nodes?.flatMap((node) => {
      if (node.type !== 'decl') return []
      const source = node.source?.start
      return [{
        property: node.prop,
        value: node.value,
        important: node.important,
        location: {
          documentId: stylesheet.documentId,
          line: source?.line ?? 1,
          column: source?.column ?? 1,
          path: `${rule.selector}/${node.prop}`,
        },
      }]
    }) ?? []
    if (declarations.length === 0) return
    const source = rule.source?.start
    rules.push({
      selectors,
      declarations,
      order,
      location: {
        documentId: stylesheet.documentId,
        line: source?.line ?? 1,
        column: source?.column ?? 1,
        path: rule.selector,
      },
      conditional: hasConditionalAncestor(rule),
    })
  })
  return rules
}

/** Splits selector lists on commas outside quotes and brackets. */
function splitSelectors(selectorList: string): readonly string[] {
  const selectors: string[] = []
  let current = ''
  let quote = ''
  let bracketDepth = 0
  let parenthesisDepth = 0
  for (const character of selectorList) {
    if (quote !== '') {
      current += character
      if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'") quote = character
    if (character === '[') bracketDepth += 1
    if (character === ']') bracketDepth -= 1
    if (character === '(') parenthesisDepth += 1
    if (character === ')') parenthesisDepth -= 1
    if (character === ',' && bracketDepth === 0 && parenthesisDepth === 0) {
      selectors.push(current.trim())
      current = ''
      continue
    }
    current += character
  }
  if (current.trim() !== '') selectors.push(current.trim())
  return selectors
}

/** Parses the supported type, class, ID, descendant, and child selector subset. */
function parseSelectorChain(selector: string): SelectorChain | undefined {
  const parts: string[] = []
  const combinators: ('descendant' | 'child')[] = []
  let pending: 'descendant' | 'child' | undefined
  for (const token of selector.trim().split(/(\s+|>)/).filter(Boolean)) {
    if (/^\s+$/.test(token)) {
      if (parts.length > 0 && pending === undefined) pending = 'descendant'
      continue
    }
    if (token === '>') {
      if (parts.length === 0) return undefined
      pending = 'child'
      continue
    }
    if (/[:\[\]()]/.test(token)) return undefined
    if (parts.length > 0) combinators.push(pending ?? 'descendant')
    parts.push(token)
    pending = undefined
  }
  const compounds = parts.map(parseCompound)
  if (compounds.some((compound) => compound === undefined)) return undefined
  const resolvedCompounds = compounds as SelectorCompound[]
  return {
    compounds: resolvedCompounds,
    combinators,
    specificity: resolvedCompounds.reduce((total, compound) => total + compound.specificity, 0),
  }
}

/** Parses one compound selector containing an optional tag and class or ID. */
function parseCompound(source: string): SelectorCompound | undefined {
  const match = /^(\*|[A-Za-z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(source)
  if (match === null || (match[1] === undefined && match[2] === '')) return undefined
  const ids = [...match[2]!.matchAll(/#([\w-]+)/g)].map((entry) => entry[1]!)
  const classes = [...match[2]!.matchAll(/\.([\w-]+)/g)].map((entry) => entry[1]!)
  return {
    ...(match[1] === undefined || match[1] === '*' ? {} : { tagName: match[1] }),
    ids,
    classes,
    specificity: ids.length * 100 + classes.length * 10 + (match[1] === undefined || match[1] === '*' ? 0 : 1),
  }
}

/** Checks one selector chain against an element and its ordered ancestors. */
function matchesSelector(
  chain: SelectorChain,
  element: XmlElement,
  ancestors: readonly XmlElement[],
): boolean {
  const last = chain.compounds.length - 1
  if (!matchesCompound(chain.compounds[last]!, element)) return false
  return matchesSelectorAncestor(chain, last, ancestors)
}

/** Matches the remaining selector chain by walking source ancestors. */
function matchesSelectorAncestor(
  chain: SelectorChain,
  compoundIndex: number,
  ancestors: readonly XmlElement[],
): boolean {
  if (compoundIndex === 0) return true
  const relation = chain.combinators[compoundIndex - 1]!
  if (relation === 'child') {
    const parent = ancestors.at(-1)
    return parent !== undefined
      && matchesCompound(chain.compounds[compoundIndex - 1]!, parent)
      && matchesSelectorAncestor(chain, compoundIndex - 1, ancestors.slice(0, -1))
  }
  return ancestors.some((ancestor, index) => matchesCompound(chain.compounds[compoundIndex - 1]!, ancestor)
    && matchesSelectorAncestor(chain, compoundIndex - 1, ancestors.slice(0, index)))
}

/** Checks one source element against the tag, ID, and class part of a selector. */
function matchesCompound(compound: SelectorCompound, element: XmlElement): boolean {
  const elementId = element.attributes.id
  const elementClasses = (element.attributes.cssClass ?? element.attributes.class ?? '').split(/\s+/).filter(Boolean)
  return (compound.tagName === undefined || compound.tagName.toLowerCase() === element.name.toLowerCase())
    && compound.ids.every((id) => elementId === id)
    && compound.classes.every((className) => elementClasses.includes(className))
}

/** Checks whether an unsupported selector mentions a nearby source identity. */
function selectorMentionsElement(selector: string, element: XmlElement, ancestors: readonly XmlElement[]): boolean {
  const nearby = [element, ...ancestors]
  return nearby.some((candidate) => {
    const id = candidate.attributes.id
    const classes = (candidate.attributes.cssClass ?? candidate.attributes.class ?? '').split(/\s+/).filter(Boolean)
    return (id !== undefined && selector.includes(`#${id}`))
      || classes.some((className) => selector.includes(`.${className}`))
      || selector.toLowerCase().includes(candidate.name.toLowerCase())
  })
}

/** Converts a CSS property name to the casing used by CodPlay style data. */
function toStyleProperty(property: string): string {
  return property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
}

/** Rewrites simple CSS pixel lengths to cqw when the source width is known. */
function normalizePixelLengths(value: string, sourceCanvasWidth: number | undefined): string | undefined {
  if (/var\s*\(/i.test(value)) return undefined
  const withoutUrls = value.replace(/url\([^)]*\)/gi, '')
  if (!/\b-?(?:\d+\.?\d*|\.\d+)px\b/i.test(withoutUrls)) return value
  if (/url\s*\(/i.test(value)) return undefined
  if (sourceCanvasWidth === undefined || !Number.isFinite(sourceCanvasWidth) || sourceCanvasWidth <= 0) return undefined
  if (/calc\s*\(/i.test(value)) return undefined
  return value.replace(/(-?(?:\d+\.?\d*|\.\d+))px\b/gi, (_match, number: string) => `${Number(number) / sourceCanvasWidth * 100}cqw`)
}

/** Converts the source 0x color spelling when it is used as a CSS color value. */
function normalizeCssColor(property: string, value: string): string {
  if (!['color', 'backgroundColor', 'borderColor'].includes(toStyleProperty(property))) return value
  return /^0x[\da-f]{3,8}$/i.test(value) ? `#${value.slice(2)}` : value
}

/** Detects whether a CSS rule is nested under a media or feature condition. */
function hasConditionalAncestor(rule: postcss.Rule): boolean {
  let parent: postcss.Node | undefined = rule.parent
  while (parent !== undefined) {
    if (parent.type === 'atrule') return true
    parent = parent.parent
  }
  return false
}
