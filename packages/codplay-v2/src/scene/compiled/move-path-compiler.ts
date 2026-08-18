import { prepareSvgPath, type Path, type PathTraversal } from '../../ace'
import { isPlainRecord } from '../../shared'

/** Compiles author move paths before the scene enters the serializable artifact. */
export function compileMovePath(value: unknown, scope: string): unknown {
  if (!isPlainRecord(value)) return value
  const move = value.move
  if (!isPlainRecord(move) || !isPlainRecord(move.transition)) return value
  const traversal = move.transition.traversal
  if (traversal !== undefined && traversal !== 'parameter' && traversal !== 'arc-length') {
    throw new Error(`${scope}.move.transition.traversal must be "parameter" or "arc-length".`)
  }
  if (move.transition.path === undefined) {
    if (traversal !== undefined) throw new Error(`${scope}.move.transition.traversal requires a path.`)
    return value
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
    ...value,
    move: {
      ...move,
      transition: {
        ...move.transition,
        path,
      },
    },
  }
}
