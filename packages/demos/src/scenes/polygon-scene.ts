import type { TransformFn } from 'codplay/player'
import type { SceneDoc } from 'codplay/player/types'

const INITIAL = { sides: 5, inner: 18, outer: 42, inflexion: 0, diameter: 280 } as const
const MORPH_TEST_FROM = { sides: 5, inner: 18, outer: 42, rotationDeg: -18 } as const
const MORPH_TEST_TO = { sides: 8, inner: null, outer: 42, rotationDeg: 22.5 } as const

// ── Slider transforms ────────────────────────────────────────────────────────

const sidesTransform: TransformFn = (event) => {
  const raw = Number(event.data?.valueAsNumber)
  const value = Number.isFinite(raw) ? Math.max(3, Math.min(32, Math.round(raw))) : INITIAL.sides
  return [
    { name: 'polygon:update', data: { sides: value, content: String(value) } },
    { name: 'polygon:value:sides', data: { content: String(value) } },
  ]
}

const innerTransform: TransformFn = (event) => {
  const raw = Number(event.data?.valueAsNumber)
  const rounded = Number.isFinite(raw) ? Math.round(raw) : INITIAL.inner
  const inner = rounded === 0 ? null : rounded
  return [
    { name: 'polygon:update', data: { inner } },
    { name: 'polygon:value:inner', data: { content: String(rounded) } },
  ]
}

const outerTransform: TransformFn = (event) => {
  const raw = Number(event.data?.valueAsNumber)
  const value = Number.isFinite(raw) ? Math.round(raw) : INITIAL.outer
  return [
    { name: 'polygon:update', data: { outer: value } },
    { name: 'polygon:value:outer', data: { content: String(value) } },
  ]
}

const inflexionTransform: TransformFn = (event) => {
  const raw = Number(event.data?.valueAsNumber)
  const value = Number.isFinite(raw) ? raw : INITIAL.inflexion
  return [
    { name: 'polygon:update', data: { inflexion: value } },
    { name: 'polygon:value:inflexion', data: { content: String(value) } },
  ]
}

const diameterTransform: TransformFn = (event) => {
  const raw = Number(event.data?.valueAsNumber)
  const value = Number.isFinite(raw) ? Math.round(raw) : INITIAL.diameter
  return [
    { name: 'polygon:update', data: { style: { width: `${value}px`, height: `${value}px` } } },
    { name: 'polygon:value:diameter', data: { content: String(value) } },
  ]
}

// ── Reset transforms (clicking a label resets its parameter) ─────────────────

const sidesResetTransform: TransformFn = () => [
  { name: 'polygon:update', data: { sides: INITIAL.sides, content: String(INITIAL.sides) } },
  { name: 'polygon:value:sides', data: { content: String(INITIAL.sides) } },
]

const innerResetTransform: TransformFn = () => [
  { name: 'polygon:update', data: { inner: INITIAL.inner } },
  { name: 'polygon:value:inner', data: { content: String(INITIAL.inner) } },
]

const outerResetTransform: TransformFn = () => [
  { name: 'polygon:update', data: { outer: INITIAL.outer } },
  { name: 'polygon:value:outer', data: { content: String(INITIAL.outer) } },
]

const inflexionResetTransform: TransformFn = () => [
  { name: 'polygon:update', data: { inflexion: INITIAL.inflexion } },
  { name: 'polygon:value:inflexion', data: { content: String(INITIAL.inflexion) } },
]

const diameterResetTransform: TransformFn = () => [
  { name: 'polygon:update', data: { style: { width: `${INITIAL.diameter}px`, height: `${INITIAL.diameter}px` } } },
  { name: 'polygon:value:diameter', data: { content: String(INITIAL.diameter) } },
]

/** Creates one direct Anime SVG morph payload for the corner test polygon. */
const morphTestTransform: TransformFn = () => {
  return [
    { name: 'polygon:morph-test:reset', data: { ...MORPH_TEST_FROM, content: 'morph' } },
    {
      name: 'polygon:morph-test:run',
      data: {
        ...MORPH_TEST_TO,
        morph: { duration: 700, ease: 'easeInOutCubic' },
        content: 'done',
      },
    },
  ]
}

/** Creates one interactive polygon demo scene. */
export function createPolygonScene(): SceneDoc {
  return {
    id: 'polygon-scene',
    stories: {
      'polygon-story': {
        id: 'polygon-story',
        initial: { move: '@root' },
        listen: [
          { on: 'polygon:sides:raw', transform: [sidesTransform] },
          { on: 'polygon:inner:raw', transform: [innerTransform] },
          { on: 'polygon:outer:raw', transform: [outerTransform] },
          { on: 'polygon:inflexion:raw', transform: [inflexionTransform] },
          { on: 'polygon:diameter:raw', transform: [diameterTransform] },
          { on: 'polygon:reset:sides', transform: [sidesResetTransform] },
          { on: 'polygon:reset:inner', transform: [innerResetTransform] },
          { on: 'polygon:reset:outer', transform: [outerResetTransform] },
          { on: 'polygon:reset:inflexion', transform: [inflexionResetTransform] },
          { on: 'polygon:reset:diameter', transform: [diameterResetTransform] },
          { on: 'polygon:morph-test:click', transform: [morphTestTransform] },
        ],
        persos: [
          {
            id: 'polygon-layout',
            type: 'layout',
            initial: {
              move: '@root',
              className: 'polygon-demo-shell',
              markup: `
                <div class="polygon-demo-shape" data-part="polygon-layout:shape"></div>
                <div class="polygon-demo-morph-corner" data-part="polygon-layout:morph-corner"></div>
                <div class="polygon-demo-controls" data-part="polygon-layout:controls"></div>
              `,
            },
            actions: {},
          },
          {
            id: 'polygon-shape',
            type: 'polygon',
            initial: {
              move: { parentId: 'polygon-layout:shape' },
              sides: INITIAL.sides,
              inner: INITIAL.inner,
              outer: INITIAL.outer,
              content: String(INITIAL.sides),
              style: {
                width: `${INITIAL.diameter}px`,
                height: `${INITIAL.diameter}px`,
                color: '#312e81',
                overflow: 'visible',
                filter: 'drop-shadow(0 18px 32px rgba(49, 46, 129, 0.30))',
                fontSize: '16px',
                fontWeight: '700',
                '--polygon-label-color': '#f8fafc',
              },
            },
            actions: {
              'polygon:update': {},
            },
          },
          {
            id: 'polygon-morph-test',
            type: 'polygon',
            initial: {
              move: { parentId: 'polygon-layout:morph-corner' },
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
            emit: { click: { event: { name: 'polygon:morph-test:click' } } },
            actions: {
              'polygon:morph-test:reset': {},
              'polygon:morph-test:run': {},
            },
          },
          // ── côtés ──────────────────────────────────────────────────────────
          {
            id: 'polygon-btn-sides',
            type: 'text',
            initial: {
              tag: 'button',
              content: 'côtés',
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-param-btn',
            },
            emit: { click: { event: { name: 'polygon:reset:sides' } } },
            actions: {},
          },
          {
            id: 'polygon-range-sides',
            type: 'input',
            initial: {
              inputType: 'range',
              min: 3,
              max: 32,
              step: 1,
              value: INITIAL.sides,
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-slider-bare',
            },
            emit: { input: { event: { name: 'polygon:sides:raw' } } },
            actions: { 'polygon:reset:sides': { value: INITIAL.sides } },
          },
          {
            id: 'polygon-value-sides',
            type: 'text',
            initial: {
              tag: 'output',
              content: String(INITIAL.sides),
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-value',
            },
            actions: { 'polygon:value:sides': {} },
          },
          // ── inner ──────────────────────────────────────────────────────────
          {
            id: 'polygon-btn-inner',
            type: 'text',
            initial: {
              tag: 'button',
              content: 'inner',
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-param-btn',
            },
            emit: { click: { event: { name: 'polygon:reset:inner' } } },
            actions: {},
          },
          {
            id: 'polygon-range-inner',
            type: 'input',
            initial: {
              inputType: 'range',
              min: 0,
              max: 48,
              step: 1,
              value: INITIAL.inner,
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-slider-bare',
            },
            emit: { input: { event: { name: 'polygon:inner:raw' } } },
            actions: { 'polygon:reset:inner': { value: INITIAL.inner } },
          },
          {
            id: 'polygon-value-inner',
            type: 'text',
            initial: {
              tag: 'output',
              content: String(INITIAL.inner),
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-value',
            },
            actions: { 'polygon:value:inner': {} },
          },
          // ── outer ──────────────────────────────────────────────────────────
          {
            id: 'polygon-btn-outer',
            type: 'text',
            initial: {
              tag: 'button',
              content: 'outer',
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-param-btn',
            },
            emit: { click: { event: { name: 'polygon:reset:outer' } } },
            actions: {},
          },
          {
            id: 'polygon-range-outer',
            type: 'input',
            initial: {
              inputType: 'range',
              min: 5,
              max: 48,
              step: 1,
              value: INITIAL.outer,
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-slider-bare',
            },
            emit: { input: { event: { name: 'polygon:outer:raw' } } },
            actions: { 'polygon:reset:outer': { value: INITIAL.outer } },
          },
          {
            id: 'polygon-value-outer',
            type: 'text',
            initial: {
              tag: 'output',
              content: String(INITIAL.outer),
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-value',
            },
            actions: { 'polygon:value:outer': {} },
          },
          // ── inflexion ──────────────────────────────────────────────────────
          {
            id: 'polygon-btn-inflexion',
            type: 'text',
            initial: {
              tag: 'button',
              content: 'inflexion',
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-param-btn',
            },
            emit: { click: { event: { name: 'polygon:reset:inflexion' } } },
            actions: {},
          },
          {
            id: 'polygon-range-inflexion',
            type: 'input',
            initial: {
              inputType: 'range',
              min: -20,
              max: 20,
              step: 0.5,
              value: INITIAL.inflexion,
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-slider-bare',
            },
            emit: { input: { event: { name: 'polygon:inflexion:raw' } } },
            actions: { 'polygon:reset:inflexion': { value: INITIAL.inflexion } },
          },
          {
            id: 'polygon-value-inflexion',
            type: 'text',
            initial: {
              tag: 'output',
              content: String(INITIAL.inflexion),
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-value',
            },
            actions: { 'polygon:value:inflexion': {} },
          },
          // ── diamètre ───────────────────────────────────────────────────────
          {
            id: 'polygon-btn-diameter',
            type: 'text',
            initial: {
              tag: 'button',
              content: 'diamètre',
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-param-btn',
            },
            emit: { click: { event: { name: 'polygon:reset:diameter' } } },
            actions: {},
          },
          {
            id: 'polygon-range-diameter',
            type: 'input',
            initial: {
              inputType: 'range',
              min: 120,
              max: 400,
              step: 8,
              value: INITIAL.diameter,
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-slider-bare',
            },
            emit: { input: { event: { name: 'polygon:diameter:raw' } } },
            actions: { 'polygon:reset:diameter': { value: INITIAL.diameter } },
          },
          {
            id: 'polygon-value-diameter',
            type: 'text',
            initial: {
              tag: 'output',
              content: String(INITIAL.diameter),
              move: { parentId: 'polygon-layout:controls' },
              className: 'polygon-demo-value',
            },
            actions: { 'polygon:value:diameter': {} },
          },
        ],
        eventimes: [],
      },
    },
  } as unknown as SceneDoc
}
