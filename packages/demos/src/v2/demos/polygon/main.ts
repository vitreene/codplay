import type { StrapFunction } from 'codplay/runtime/player'
import type { SceneDoc } from 'codplay/scene/types'

const INITIAL = { sides: 5, inner: 18, outer: 42, inflexion: 0, diameter: 280 } as const
const MORPH_TEST_FROM = { sides: 5, inner: 18, outer: 42, rotationDeg: -18 } as const
const MORPH_TEST_TO = { sides: 8, inner: null, outer: 42, rotationDeg: 22.5 } as const

type ScenePerso = SceneDoc['stories']['main']['persos'][number]
type PolygonRangeParameter = 'sides' | 'inner' | 'outer' | 'inflexion' | 'diameter'

/** Creates the V2 transposition of the interactive V1 polygon scene. */
export function createScene(): SceneDoc {
  const morphStrap = createMorphStrap()
  return {
    id: 'polygon-scene',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        straps: { 'polygon-morph': morphStrap },
        listen: [{ on: 'polygon:morph:click', straps: ['polygon-morph'] }],
        persos: [
          createPolygonLayout(),
          createPolygonShape(),
          createMorphTest(),
          ...createParameterPersos('sides', 'côtés', 3, 32, 1, INITIAL.sides),
          ...createParameterPersos('inner', 'inner', 0, 48, 1, INITIAL.inner),
          ...createParameterPersos('outer', 'outer', 5, 48, 1, INITIAL.outer),
          ...createParameterPersos('inflexion', 'inflexion', -20, 20, 0.5, INITIAL.inflexion),
          ...createParameterPersos('diameter', 'diamètre', 120, 400, 8, INITIAL.diameter),
        ],
        eventimes: [],
      },
    },
  }
}

/**
 * Creates the non-normative demo strap that alternates between the two V1 shapes.
 * The closure state is kept only to reproduce the toggle behavior in this fixture;
 * normative story state must live in the story runtime state.
 */
function createMorphStrap(): StrapFunction {
  let isMorphed = false

  return () => {
    const from = isMorphed ? MORPH_TEST_TO : MORPH_TEST_FROM
    const to = isMorphed ? MORPH_TEST_FROM : MORPH_TEST_TO
    isMorphed = !isMorphed
    return {
      events: [
        { name: 'polygon:morph:reset', data: { ...from, content: 'morph' } },
        {
          name: 'polygon:morph:run',
          data: {
            ...to,
            morph: { duration: 700, delayMs: 0, ease: 'inOutCubic', sampleCount: 96 },
            content: 'done',
          },
        },
      ],
    }
  }
}

/** Creates the scene layout and its flex-mounted shape, morph and control parts. */
function createPolygonLayout(): ScenePerso {
  return {
    id: 'polygon-layout',
    type: 'layout',
    initial: {
      move: '@root',
      className: 'polygon-demo-container',
      markup: `
        <div class="polygon-demo-main">
          <div class="polygon-demo-shape" data-part="polygon-layout:shape"></div>
          <div class="polygon-demo-controls" data-part="polygon-layout:controls"></div>
        </div>
        <div class="polygon-demo-morph-corner" data-part="polygon-layout:morph-corner"></div>
      `,
    },
    actions: {},
  }
}

/** Creates the main V2 polygon with the exact V1 initial geometry and styling. */
function createPolygonShape(): ScenePerso {
  return {
    id: 'polygon-shape',
    type: 'polygon',
    initial: {
      move: { target: 'polygon-layout:shape' },
      sides: INITIAL.sides,
      inner: INITIAL.inner,
      outer: INITIAL.outer,
      diameter: INITIAL.diameter,
      content: String(INITIAL.sides),
      style: {
        color: '#312e81',
        overflow: 'visible',
        filter: 'drop-shadow(0 18px 32px rgba(49, 46, 129, 0.30))',
        fontSize: '16px',
        fontWeight: '700',
        '--polygon-label-color': '#f8fafc',
      },
    },
    actions: {
      'polygon:sides': {},
      'polygon:inner': {},
      'polygon:outer': {},
      'polygon:inflexion': {},
      'polygon:diameter': {},
    },
  }
}

/** Creates the clickable corner polygon used to validate deterministic morphing. */
function createMorphTest(): ScenePerso {
  return {
    id: 'polygon-morph-test',
    type: 'polygon',
    initial: {
      move: { target: 'polygon-layout:morph-corner' },
      ...MORPH_TEST_FROM,
      content: 'morph',
      className: 'polygon-demo-morph-test',
      style: {
        width: '92px',
        height: '92px',
        color: '#7c3aed',
        cursor: 'pointer',
        '--polygon-label-color': '#ffffff',
        fontSize: '9px',
        fontWeight: '900',
        filter: 'drop-shadow(0 8px 18px rgba(76, 29, 149, 0.32))',
      },
    },
    emit: { click: { event: { name: 'polygon:morph:click' } } },
    actions: {
      'polygon:morph:reset': {},
      'polygon:morph:run': {},
    },
  }
}

/** Creates one label, range input and output triplet for a polygon parameter. */
function createParameterPersos(
  parameter: PolygonRangeParameter,
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
): readonly ScenePerso[] {
  return [
    {
      id: `polygon-btn-${parameter}`,
      type: 'tag',
      initial: {
        tag: 'button',
        content: label,
        attr: { type: 'button' },
        move: { target: 'polygon-layout:controls' },
        className: 'polygon-demo-param-btn',
      },
      emit: { click: { event: { name: `polygon:${parameter}`, data: { value } } } },
      actions: {},
    },
    {
      id: `polygon-range-${parameter}`,
      type: 'input',
      initial: {
        inputType: 'range',
        min,
        max,
        step,
        value,
        move: { target: 'polygon-layout:controls' },
        className: 'polygon-demo-slider-bare',
      },
      emit: { input: { event: { name: `polygon:${parameter}` } } },
      actions: { [`polygon:${parameter}`]: {} },
    },
    {
      id: `polygon-value-${parameter}`,
      type: 'tag',
      initial: {
        tag: 'output',
        value,
        move: { target: 'polygon-layout:controls' },
        className: 'polygon-demo-value',
      },
      actions: { [`polygon:${parameter}`]: {} },
    },
  ]
}
