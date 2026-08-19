import { describe, expect, it } from 'vitest'

import { prepareSvgPath, resolvePath } from '../../src/ace'

describe('ACE normalized SVG paths', () => {
  it('normalizes an arbitrary SVG start/end pair to [0, 0] -> [1, 0]', () => {
    const path = prepareSvgPath('M 10 20 L 20 30 L 30 20')

    expect(path.kind).toBe('segments')
    expect(path.segments?.[0]?.to).toEqual([0.5, 0.5])
    expect(path.segments?.at(-1)?.to).toEqual([1, 0])
    expect(resolvePath(path, [0, 0], [100, 0], 0)).toEqual([0, 0])
    expect(resolvePath(path, [0, 0], [100, 0], 1)).toEqual([100, 0])
  })

  it('keeps SVG elliptical arcs as prepared arc segments', () => {
    const path = prepareSvgPath('M 0 0 A 50 50 0 0 1 100 0')

    expect(path.segments?.[0]).toMatchObject({ kind: 'arc', to: [1, 0], radius: [0.5, 0.5] })
    const middle = resolvePath(path, [0, 0], [100, 0], 0.5)
    expect(middle[0]).toBeCloseTo(50, 0)
    expect(Math.abs(middle[1])).toBeGreaterThan(40)
  })

  it('keeps quantized arc trajectories continuous at both endpoints', () => {
    const path = prepareSvgPath('M 0 0 A 0.8 0.8 0 0 0 1 0')
    const almostStart = resolvePath(path, [10, 20], [110, 70], 1e-9)
    const almostEnd = resolvePath(path, [10, 20], [110, 70], 1 - 1e-9)

    expect(almostStart[0]).toBeCloseTo(10, 5)
    expect(almostStart[1]).toBeCloseTo(20, 5)
    expect(almostEnd[0]).toBeCloseTo(110, 5)
    expect(almostEnd[1]).toBeCloseTo(70, 5)
  })

  it('quantizes normalized geometry to two decimal places', () => {
    const path = prepareSvgPath('M 0 0 L 0.1234 0.5678 L 1 0')

    expect(path.segments?.[0]?.to).toEqual([0.12, 0.57])
  })

  it('rejects SVG commands outside the line and arc subset', () => {
    expect(() => prepareSvgPath('M 0 0 C 0.2 0.4 0.8 0.4 1 0')).toThrow(/unsupported/)
  })
})
