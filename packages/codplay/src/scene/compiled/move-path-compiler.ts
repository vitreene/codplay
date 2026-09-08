import { prepareSvgPath, type Path } from 'ace'
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
  if (!isPlainRecord(move)) return compiledValue
  if (Object.prototype.hasOwnProperty.call(move, 'flipMode')) {
    throw new Error(`${scope}.move.flipMode was replaced by the boolean reparent property.`)
  }
  if (move.reparent !== undefined && typeof move.reparent !== 'boolean') {
    throw new Error(`${scope}.move.reparent must be a boolean.`)
  }
  if (!isPlainRecord(move.transition)) return compiledValue
  if (Object.prototype.hasOwnProperty.call(move.transition, 'traversal')) {
    throw new Error(`${scope}.move.transition.traversal is an internal integration option and must be omitted.`)
  }
  if (Object.prototype.hasOwnProperty.call(move.transition, 'pathAnchor')) {
    throw new Error(`${scope}.move.transition.pathAnchor is an internal integration option and must be omitted.`)
  }
  if (move.transition.path === undefined) {
    return compiledValue
  }
  if (typeof move.transition.path !== 'string') {
    throw new Error(`${scope}.move.transition.path must be an SVG path d string.`)
  }
  let path: Path
  try {
    path = prepareSvgPath(move.transition.path, {
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
