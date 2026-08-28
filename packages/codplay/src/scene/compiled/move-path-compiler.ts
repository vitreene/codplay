import { prepareSvgPath, type Path, type PathTraversal } from 'ace'
import { isPlainRecord } from '../../shared'

/** Compiles author move paths before the scene enters the serializable artifact. */
export function compileMovePath(value: unknown, scope: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => compileMovePath(item, `${scope}[${index}]`))
  }
  if (!isPlainRecord(value)) return value
  const compiledValue = value.action === undefined
    ? value
    : { ...value, action: compileMovePath(value.action, `${scope}.action`) }
  const move = compiledValue.move
  if (!isPlainRecord(move) || !isPlainRecord(move.transition)) return compiledValue
  const traversal = move.transition.traversal
  if (traversal !== undefined && traversal !== 'parameter' && traversal !== 'arc-length') {
    throw new Error(`${scope}.move.transition.traversal must be "parameter" or "arc-length".`)
  }
  if (move.transition.path === undefined) {
    if (traversal !== undefined) throw new Error(`${scope}.move.transition.traversal requires a path.`)
    return compiledValue
  }
  if (typeof move.transition.path !== 'string') {
    throw new Error(`${scope}.move.transition.path must be an SVG path d string.`)
  }
  let path: Path
  try {
    path = prepareSvgPath(move.transition.path, {
      traversal: traversal as PathTraversal | undefined,
      precision: 2,
    })
  } catch (error) {
    throw new Error(`${scope}.move.transition.path: ${error instanceof Error ? error.message : 'SVG path is invalid.'}`)
  }
  return {
    ...compiledValue,
    move: {
      ...move,
      transition: {
        ...move.transition,
        path,
      },
    },
  }
}
