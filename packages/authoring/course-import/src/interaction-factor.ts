import type { InteractionRecipe, XmlLocation } from './source-model'
import type { JavaScriptCall, JavaScriptExpression } from './javascript-call-reader'

/** Holds one parsed source callback as evidence for repetition analysis. */
export type SourceInteraction = Readonly<{
  location: XmlLocation
  trigger: string
  source: string
  calls: readonly JavaScriptCall[]
}>

/** Groups structurally matching callbacks and reports values that vary. */
export function factorRepeatedInteractions(interactions: readonly SourceInteraction[]): readonly InteractionRecipe[] {
  const groups = interactions.reduce((result, interaction) => {
    const signature = `${interaction.trigger}:${interaction.calls.map(expressionShape).join(';')}`
    const occurrences = result.get(signature) ?? []
    occurrences.push(interaction)
    result.set(signature, occurrences)
    return result
  }, new Map<string, SourceInteraction[]>())
  return [...groups.entries()]
    .filter(([, occurrences]) => occurrences.length > 1)
    .map(([signature, occurrences]) => ({
      id: `repeated-interaction:${stableToken(signature)}`,
      signature,
      occurrences: occurrences.map(({ location, trigger, source }) => ({ location, trigger, source })),
      varyingPaths: collectVaryingPaths(occurrences.map(({ calls }) => calls)),
    }))
}

/** Builds a value-insensitive signature while retaining call and object shape. */
function expressionShape(expression: JavaScriptExpression): string {
  if (expression === null) return 'null'
  if (typeof expression === 'string') return 'string'
  if (typeof expression === 'number') return 'number'
  if (typeof expression === 'boolean') return 'boolean'
  if (expression.kind === 'identifier') return `identifier:${expression.name}`
  if (expression.kind === 'array') return `array[${expression.items.map(expressionShape).join(',')}]`
  if (expression.kind === 'object') {
    const fields = Object.keys(expression.fields).sort()
    return `object{${fields.map((key) => `${key}:${expressionShape(expression.fields[key]!)}`).join(',')}}`
  }
  return `call:${expression.callee}(${expression.arguments.map(expressionShape).join(',')})`
}

/** Collects expression paths whose literal values vary across one group. */
function collectVaryingPaths(calls: readonly (readonly JavaScriptCall[])[]): readonly string[] {
  const first = calls[0]
  if (first === undefined) return []
  const paths = new Set<string>()
  calls.slice(1).forEach((current) => current.forEach((call, callIndex) => {
    const reference = first[callIndex]
    if (reference !== undefined) call.arguments.forEach((argument, argumentIndex) => {
      const referenceArgument = reference.arguments[argumentIndex]
      if (referenceArgument !== undefined) compareExpression(referenceArgument, argument, `call[${callIndex}].argument[${argumentIndex}]`, paths)
    })
  }))
  return [...paths].sort()
}

/** Compares two same-shaped expressions and records differing literal leaves. */
function compareExpression(
  left: JavaScriptExpression,
  right: JavaScriptExpression,
  path: string,
  paths: Set<string>,
): void {
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    if (left !== right) paths.add(path)
    return
  }
  if (left.kind === 'array' && right.kind === 'array') {
    left.items.forEach((item, index) => {
      const other = right.items[index]
      if (other !== undefined) compareExpression(item, other, `${path}[${index}]`, paths)
    })
    return
  }
  if (left.kind === 'object' && right.kind === 'object') {
    Object.keys(left.fields).forEach((key) => {
      const other = right.fields[key]
      if (other !== undefined) compareExpression(left.fields[key]!, other, `${path}.${key}`, paths)
    })
    return
  }
  if (left.kind === 'call' && right.kind === 'call') {
    left.arguments.forEach((argument, index) => {
      const other = right.arguments[index]
      if (other !== undefined) compareExpression(argument, other, `${path}.${left.callee}.argument[${index}]`, paths)
    })
    return
  }
  if (left.kind === 'identifier' && right.kind === 'identifier' && left.name === right.name) return
  paths.add(path)
}

/** Encodes a recipe signature as a stable readable identifier segment. */
function stableToken(value: string): string {
  return value.replace(/[^A-Za-z0-9:_-]+/g, '-').replace(/^-|-$/g, '')
}
