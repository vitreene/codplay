import type { SceneDoc } from 'codplay/player/types'
import { lerp } from 'codplay'

const START_SECONDS = 20

function buildClockFaceMarkup(): string {
  const cx = 150, cy = 150
  const outerR = 143, majorInnerR = 124, minorInnerR = 134
  const textR = 110

  const parts: string[] = []

  for (let i = 0; i < 60; i++) {
    const rad = (i * 6 - 90) * (Math.PI / 180)
    const isMajor = i % 5 === 0
    const innerR = isMajor ? majorInnerR : minorInnerR
    const x1 = (cx + innerR * Math.cos(rad)).toFixed(2)
    const y1 = (cy + innerR * Math.sin(rad)).toFixed(2)
    const x2 = (cx + outerR * Math.cos(rad)).toFixed(2)
    const y2 = (cy + outerR * Math.sin(rad)).toFixed(2)
    const stroke = isMajor ? '#475569' : '#1e293b'
    const sw = isMajor ? '2.5' : '1'
    parts.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`,
    )
  }

  for (let i = 1; i <= 12; i++) {
    const sec = i * 5
    const rad = (sec * 6 - 90) * (Math.PI / 180)
    const x = (cx + textR * Math.cos(rad)).toFixed(2)
    const y = (cy + textR * Math.sin(rad)).toFixed(2)
    const label = sec === 60 ? '60' : String(sec).padStart(2, '0')
    parts.push(
      `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#334155" font-size="11" font-family="monospace">${label}</text>`,
    )
  }

  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`
}

// ─── Scene ───────────────────────────────────────────────────────────────────

const BTN_BASE = {
  cursor: 'pointer',
  padding: '8px 18px',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  fontFamily: 'sans-serif',
  fontWeight: '600',
  color: 'white',
}

export function createChronoScene(): SceneDoc {
  return {
    id: 'chrono-scene',
    stories: {
      'chrono-story': {
        id: 'chrono-story',
        initial: { move: '@root' },
        straps: {
          chrono: ({ event }: { event: { name: string; data?: unknown } }) => {
            if (event.name === 'chrono:start') {
              const d = event.data as Record<string, unknown> | undefined
              const start = typeof d?.start === 'number' ? d.start : START_SECONDS
              const stop = typeof d?.stop === 'number' ? d.stop : 0
              const durationMs = Math.abs(start - stop) * 1000
              const startDeg = (start / 60) * 360

              return {
                events: [
                  {
                    name: 'chrono:needle',
                    data: {
                      fn: ({ progress }: { progress: number }) => ({
                        style: { transform: `rotate(${lerp(startDeg, 0, progress).toFixed(3)}deg)` },
                      }),
                      duration: durationMs,
                      ease: 'linear',
                    },
                  },
                  {
                    name: 'chrono:display',
                    data: {
                      fn: ({ progress }: { progress: number }) => {
                        const value = lerp(start, stop, progress)
                        const secs = Math.floor(value)
                        const centis = Math.round((value - secs) * 100)
                        const color = progress < 0.5 ? '#4ade80' : progress < 0.75 ? '#fb923c' : '#f87171'
                        return {
                          content: `${String(secs).padStart(2, '0')}:${String(centis).padStart(2, '0')}`,
                          style: { color },
                        }
                      },
                      duration: durationMs,
                      ease: 'linear',
                    },
                  },
                ],
              }
            }

            if (event.name === 'chrono:stop') {
              return { events: [{ name: 'tween:stop' }] }
            }

            if (event.name === 'chrono:reset') {
              return {
                events: [
                  { name: 'tween:stop' },
                  { name: 'chrono:needle-set', data: { style: { transform: 'rotate(0deg)' } } },
                  { name: 'chrono:display-set', data: { content: '--:--', style: { color: '#334155' } } },
                ],
              }
            }
          },
        },
        persos: [
          // ── outer shell ───────────────────────────────────────
          {
            id: 'chrono-root',
            type: 'list',
            initial: {
              move: '@root',
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                padding: '24px',
              },
            },
            actions: {},
          },

          // ── clock face ────────────────────────────────────────
          {
            id: 'chrono-wrapper',
            type: 'list',
            initial: {
              move: { parentId: 'chrono-root' },
              style: {
                width: '300px',
                height: '300px',
                position: 'relative',
                borderRadius: '50%',
                backgroundColor: '#0f172a',
                boxShadow: '0 0 60px rgba(0,0,0,0.8), inset 0 0 30px rgba(0,0,0,0.5)',
                border: '2px solid #1e293b',
                overflow: 'hidden',
                flexShrink: '0',
              },
            },
            actions: {},
          },
          {
            id: 'chrono-face',
            type: 'layout',
            initial: {
              move: { parentId: 'chrono-wrapper' },
              format: 'svg',
              markup: buildClockFaceMarkup(),
              style: {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                zIndex: '1',
              },
            },
            actions: {},
          },
          {
            id: 'chrono-needle',
            type: 'list',
            initial: {
              move: { parentId: 'chrono-wrapper' },
              style: {
                position: 'absolute',
                bottom: '50%',
                left: 'calc(50% - 1.5px)',
                width: '3px',
                height: '105px',
                backgroundColor: '#ef4444',
                borderRadius: '3px 3px 0 0',
                transformOrigin: 'bottom center',
                transform: 'rotate(0deg)',
                zIndex: '2',
                boxShadow: '0 0 8px rgba(239,68,68,0.7)',
              },
            },
            actions: {
              'chrono:needle': true,
              'chrono:needle-set': true,
            },
          },
          {
            id: 'chrono-dot',
            type: 'list',
            initial: {
              move: { parentId: 'chrono-wrapper' },
              style: {
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                transform: 'translate(-50%, -50%)',
                zIndex: '3',
                boxShadow: '0 0 6px rgba(239,68,68,0.8)',
              },
            },
            actions: {},
          },
          {
            id: 'chrono-display',
            type: 'text',
            initial: {
              move: { parentId: 'chrono-wrapper' },
              content: '--:--',
              style: {
                position: 'absolute',
                bottom: '22%',
                left: '50%',
                transform: 'translateX(-50%)',
                color: '#334155',
                fontSize: '28px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                letterSpacing: '3px',
                zIndex: '3',
                textShadow: '0 0 10px currentColor',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              },
            },
            actions: {
              'chrono:display': true,
              'chrono:display-set': true,
            },
          },

          // ── controls ──────────────────────────────────────────
          {
            id: 'chrono-controls',
            type: 'list',
            initial: {
              move: { parentId: 'chrono-root' },
              style: { display: 'flex', gap: '12px', justifyContent: 'center' },
            },
            actions: {},
          },

          // "Démarrer" — visible initially, hidden once chrono starts
          {
            id: 'btn-chrono-start',
            type: 'layout',
            initial: {
              move: { parentId: 'chrono-controls' },
              format: 'html',
              markup: '<button type="button">Démarrer</button>',
              style: { ...BTN_BASE, backgroundColor: '#22c55e' },
            },
            emit: {
              click: { event: { name: 'chrono:start' }, data: { start: 20, stop: 0 } },
            },
            actions: {
              'chrono:start': { style: { display: 'none' } },
              'chrono:reset': { style: { display: 'inline-block' } },
            },
          },

          // "Pause" — hidden initially, shown when chrono is running
          {
            id: 'btn-chrono-pause',
            type: 'layout',
            initial: {
              move: { parentId: 'chrono-controls' },
              format: 'html',
              markup: '<button type="button">Pause</button>',
              style: { ...BTN_BASE, backgroundColor: '#f59e0b', display: 'none' },
            },
            emit: {
              click: { event: { name: 'chrono:stop' } },
            },
            actions: {
              'chrono:start': { style: { display: 'inline-block' } },
              'chrono:stop': { style: { display: 'none' } },
              'chrono:reset': { style: { display: 'none' } },
            },
          },

          // "Reprendre" — hidden initially, shown after a pause
          {
            id: 'btn-chrono-resume',
            type: 'layout',
            initial: {
              move: { parentId: 'chrono-controls' },
              format: 'html',
              markup: '<button type="button">Reprendre</button>',
              style: { ...BTN_BASE, backgroundColor: '#22c55e', display: 'none' },
            },
            emit: {
              click: { event: { name: 'chrono:start' }, data: { start: 20, stop: 0 } },
            },
            actions: {
              'chrono:stop': { style: { display: 'inline-block' } },
              'chrono:start': { style: { display: 'none' } },
              'chrono:reset': { style: { display: 'none' } },
            },
          },

          // "Réinitialiser" — always visible
          {
            id: 'btn-chrono-reset',
            type: 'layout',
            initial: {
              move: { parentId: 'chrono-controls' },
              format: 'html',
              markup: '<button type="button">Réinitialiser</button>',
              style: { ...BTN_BASE, backgroundColor: '#64748b' },
            },
            emit: {
              click: { event: { name: 'chrono:reset' } },
            },
            actions: {},
          },
        ],
        eventimes: [],
        listen: [
          { on: 'chrono:start', straps: ['chrono'] },
          { on: 'chrono:stop', straps: ['chrono'] },
          { on: 'chrono:reset', straps: ['chrono'] },
        ],
      },
    },
    tracks: {},
  } as unknown as SceneDoc
}
