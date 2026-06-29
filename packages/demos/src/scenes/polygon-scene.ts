import { lerp } from 'codplay'
import type { SceneDoc } from 'codplay/player/types'

const STAR_SHAPE = {
  sides: 5,
  inner: 18,
  outer: 42,
} as const

const HEPTAGON_SHAPE = {
  sides: 7,
  inner: null,
  outer: 42,
} as const

const BUTTON_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  padding: '12px 18px',
  border: '1px solid rgba(49, 46, 129, 0.16)',
  borderRadius: '999px',
  background: 'rgba(255, 255, 255, 0.92)',
  color: '#1f2937',
  fontSize: '15px',
  fontWeight: '600',
  cursor: 'pointer',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
} as const

/** Creates one tween payload that morphs one polygon shape into the other over 500ms. */
function createPolygonMorphTween(input: {
  fromShape: typeof STAR_SHAPE | typeof HEPTAGON_SHAPE
  toShape: typeof STAR_SHAPE | typeof HEPTAGON_SHAPE
}) {
  return {
    duration: 500,
    ease: 'easeInOutSine',
    fn: ({ progress }: { progress: number }) => ({
      morph: {
        from: input.fromShape,
        to: input.toShape,
        progress,
      },
      style: {
        transform: `scale(${lerp(1, 1.06, progress < 0.5 ? progress * 2 : (1 - progress) * 2).toFixed(3)})`,
      },
    }),
  }
}

/** Creates one polygon demo scene: readable label, radio toggle and 500ms morph. */
export function createPolygonScene(): SceneDoc {
  return {
    id: 'polygon-scene',
    stories: {
      'polygon-story': {
        id: 'polygon-story',
        initial: { move: '@root' },
        persos: [
          {
            id: 'polygon-layout',
            type: 'layout',
            initial: {
              move: '@root',
              markup: `
                <section class="polygon-demo-shell">
                  <div data-part="polygon-layout:shape" style="position:relative;display:grid;place-items:center;width:320px;height:320px;"></div>
                  <div data-part="polygon-layout:controls"></div>
                </section>
              `,
              style: {
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                gap: '24px',
                padding: '40px 24px',
                background: 'radial-gradient(circle at top, #e9d5ff 0%, #c4b5fd 28%, #f8fafc 100%)',
              },
            },
            actions: {},
          },
          {
            id: 'polygon-shape',
            type: 'polygon',
            initial: {
              move: { parentId: 'polygon-layout:shape' },
              sides: STAR_SHAPE.sides,
              inner: STAR_SHAPE.inner,
              outer: STAR_SHAPE.outer,
              style: {
                width: '320px',
                height: '320px',
                color: '#312e81',
                overflow: 'visible',
                filter: 'drop-shadow(0 18px 32px rgba(49, 46, 129, 0.30))',
              },
            },
            actions: {
              'polygon:select:heptagone': createPolygonMorphTween({
                fromShape: STAR_SHAPE,
                toShape: HEPTAGON_SHAPE,
              }),
              'polygon:select:etoile': createPolygonMorphTween({
                fromShape: HEPTAGON_SHAPE,
                toShape: STAR_SHAPE,
              }),
            },
          },
          {
            id: 'polygon-label',
            type: 'text',
            initial: {
              tag: 'p',
              content: 'etoile',
              move: { parentId: 'polygon-layout:shape' },
              style: {
                position: 'absolute',
                left: '50%',
                top: '50%',
                margin: '0',
                transform: 'translate(-50%, -50%)',
                color: '#f8fafc',
                fontSize: '28px',
                fontWeight: '800',
                letterSpacing: '0.04em',
                textTransform: 'lowercase',
                textShadow: '0 3px 14px rgba(15, 23, 42, 0.35)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              },
            },
            actions: {
              'polygon:select:heptagone': {
                content: 'heptagone',
                replace: { transition: 'slot-up', duration: 500, split: 'letter' },
              },
              'polygon:select:etoile': {
                content: 'etoile',
                replace: { transition: 'slot-up', duration: 500, split: 'letter' },
              },
            },
          },
          {
            id: 'polygon-radio-etoile',
            type: 'input',
            initial: {
              inputType: 'radio',
              name: 'polygon-mode',
              label: 'etoile',
              checked: true,
              move: { parentId: 'polygon-layout:controls' },
              style: BUTTON_STYLE,
            },
            emit: {
              change: {
                event: { name: 'polygon:select:etoile' },
              },
            },
            actions: {
              'polygon:select:etoile': { checked: true },
              'polygon:select:heptagone': { checked: false },
            },
          },
          {
            id: 'polygon-radio-heptagone',
            type: 'input',
            initial: {
              inputType: 'radio',
              name: 'polygon-mode',
              label: 'heptagone',
              checked: false,
              move: { parentId: 'polygon-layout:controls' },
              style: BUTTON_STYLE,
            },
            emit: {
              change: {
                event: { name: 'polygon:select:heptagone' },
              },
            },
            actions: {
              'polygon:select:etoile': { checked: false },
              'polygon:select:heptagone': { checked: true },
            },
          },
        ],
        eventimes: [],
        listen: [],
      },
    },
  } as unknown as SceneDoc
}
