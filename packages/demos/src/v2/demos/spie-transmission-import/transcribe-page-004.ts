import type { PersoDoc, SceneDoc } from 'codplay/scene/types'
import { createIconMarkup, createListCompletion, readClick } from './click-actions'

const STAGE = 'spie-page004-stage'
const ENTRY_MS = 500
const VIEW_BOXES: Readonly<Record<string, readonly [number, number]>> = {
  '04/cloud02.svg': [2024.1, 967.5],
  '03/globe.svg': [745, 870],
  '04/cercle.svg': [199, 199],
  '04/tique.svg': [64.69, 67.08],
  '04/mouche.svg': [69.91, 65.58],
  '04/mosquito02.svg': [1537.3, 907.4],
  '04/puce.svg': [83, 70],
  '04/reduve.svg': [102.71, 104.25],
}

type Source = Readonly<{
  pageXml: string
  textXml: string
  propertiesXml: string
  assetBase: string
  audioDurationMs: number
  icons: Readonly<Record<string, string>>
}>
type Style = Record<string, string | number | { from: string | number; to: string | number; duration: number; ease: string }>
type Pose = Readonly<{ x: number; y: number; opacity: number; scaleX: number; scaleY: number }>
type Click = ReturnType<typeof readClick>
type Eventime = Readonly<{ name: string; startAt: number }>

/** Converts a length on the 1600px source canvas to a stage width unit. */
const cqw = (pixels: number) => pixels / 16

/** Parses one fixture document and checks its declared root. */
function readXml(xml: string, rootName: string): Element {
  const root = new DOMParser().parseFromString(xml, 'application/xml').documentElement
  if (root.localName !== rootName) throw new Error(`Expected SPIE XML root ${rootName}.`)
  return root
}

/** Reads a source coordinate, including the two canvas center values. */
function coordinate(element: Element, axis: 'x' | 'y'): number {
  const value = element.getAttribute(axis)
  return value === 'center' ? (axis === 'x' ? 800 : 394) : Number(value)
}

/** Creates a CodPlay transition for one channel of a source tween. */
function tween(from: string | number, to: string | number, duration: number, ease = 'outQuad') {
  return { from, to, duration, ease }
}

/** Converts the absolute source endpoints into independent CodPlay channels. */
function readTweens(element: Element, id: string, base: Pose, entry: Partial<Pose>, delay: number, eventimes: Eventime[]) {
  const sourceX = coordinate(element, 'x')
  const sourceY = coordinate(element, 'y')
  let pose = base
  return Object.fromEntries(Array.from(element.querySelectorAll(':scope > tween')).map((node, index) => {
    const localDelay = Number(node.getAttribute('delay')) * 1_000
    const duration = Number(node.getAttribute('time')) * 1_000
    const targets = {
      ...(node.hasAttribute('x') ? { x: cqw(coordinate(node, 'x') - sourceX) } : {}),
      ...(node.hasAttribute('y') ? { y: cqw(coordinate(node, 'y') - sourceY) } : {}),
      ...(node.hasAttribute('alpha') ? { opacity: Number(node.getAttribute('alpha')) } : {}),
      ...(node.hasAttribute('scale') ? { scaleX: Number(node.getAttribute('scale')), scaleY: Number(node.getAttribute('scale')) } : {}),
    } satisfies Partial<Pose>
    const name = `${id}:tween:${index + 1}`
    const style = Object.fromEntries((Object.keys(targets) as (keyof Pose)[]).map((channel) => [
      channel, tween((localDelay === 0 ? entry[channel] : undefined) ?? pose[channel], targets[channel]!, duration),
    ]))
    pose = { ...pose, ...targets }
    eventimes.push({ name, startAt: delay + localDelay })
    return [name, { style }]
  }))
}

/** Builds the visual stage and transcribes the single story of SPIE page004. */
export function transcribeSpiePage004(source: Source): SceneDoc {
  const page = readXml(source.pageXml, 'page')
  const sequence = page.querySelector('sequency')
  if (page.id !== 'page004' || sequence === null) throw new Error('Expected SPIE page004.')
  const translations = new Map(Array.from(readXml(source.textXml, 'lang').children).map((node) => [node.getAttribute('key'), node.textContent ?? '']))
  const properties = new Map(Array.from(readXml(source.propertiesXml, 'globalProperties').children).map((node) => [node.getAttribute('name'), node]))
  const defaults = page.querySelector('default')
  const items = Array.from(sequence.children).filter((node) => node.localName !== 'sound')
  const clicks = new Map(items.filter((node) => node.hasAttribute('onClick')).map((node) => [node, readClick(node)]))
  const listOpenings = Array.from(clicks.values())
  const eventimes: Eventime[] = [{ name: 'spie:narration', startAt: 0 }]
  const sound = sequence.querySelector('sound')?.textContent?.trim()
  if (!sound) throw new Error('SPIE page004 requires its narration.')

  /** Resolves a text attribute through the page and its named source properties. */
  function textAttribute(element: Element, name: string): string | null | undefined {
    const references = (element.getAttribute('properties') ?? '').split(',').filter(Boolean)
    return element.getAttribute(name) ?? references.reverse().map((key) => properties.get(key)?.getAttribute(name)).find((value) => value != null) ?? defaults?.getAttribute(name)
  }

  /** Produces a translated text perso in flow or at a position on the stage. */
  function textPerso(element: Element, id: string, parent: string, zIndex?: number): PersoDoc<'tag'> {
    const inFlow = zIndex === undefined
    const content = translations.get(element.getAttribute('src'))
    if (content === undefined) throw new Error(`Missing SPIE translation for ${id}.`)
    const delay = Number(element.getAttribute('delay')) * 1_000
    const show = `${id}:show`
    if (!inFlow) eventimes.push({ name: show, startAt: delay })
    const color = textAttribute(element, 'textColor')?.replace(/^0x/i, '#') ?? '#22505f'
    return {
      id, type: 'tag',
      initial: {
        tag: 'p', content, className: `spie-text ${textAttribute(element, 'cssClass') ?? ''}`,
        move: { target: parent },
        style: {
          color, fontSize: `${cqw(Number(textAttribute(element, 'textSize')))}cqw`,
          textAlign: textAttribute(element, 'textAlign') ?? 'left',
          ...(inFlow ? {} : {
            position: 'absolute', left: `${cqw(coordinate(element, 'x'))}cqw`, top: `${cqw(coordinate(element, 'y'))}cqw`,
            width: `${cqw(Number(element.getAttribute('width')))}cqw`, visibility: 'hidden', zIndex,
          }),
        },
      },
      actions: inFlow ? {} : {
        [show]: { style: { visibility: 'visible' } },
        ...readTweens(element, id, { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }, {}, delay, eventimes),
      },
    }
  }

  /** Transcribes a centered source SVG and any action targeting the whole icon or its internal fill. */
  function svgPerso(element: Element, id: string, zIndex: number, click?: Click): PersoDoc {
    const src = element.getAttribute('src') ?? ''
    const size = VIEW_BOXES[src]
    if (size === undefined) throw new Error(`Missing SPIE SVG dimensions for ${src}.`)
    const width = Number(element.getAttribute('width'))
    const height = width * size[1] / size[0]
    const delay = Number(element.getAttribute('delay')) * 1_000
    const duration = Number(element.getAttribute('duration')) * 1_000
    const effect = element.getAttribute('effect')
    const scale = Number(element.getAttribute('scale') ?? 1)
    const opacity = Number(element.getAttribute('alpha') ?? 1)
    const base = { x: 0, y: 0, scaleX: scale, scaleY: scale, opacity }
    const entryScale = scale + (effect === 'growDown' ? 0.5 : effect === 'grow' ? -0.5 : 0)
    const entry = { scaleX: entryScale, scaleY: entryScale, opacity: effect === null ? opacity : 0 }
    const show = `${id}:show`
    const hide = `${id}:hide`
    eventimes.push({ name: show, startAt: delay })
    const tracks = readTweens(element, id, base, entry, delay, eventimes)
    const firstTween = element.querySelector(':scope > tween')
    const startsWithTween = firstTween !== null && Number(firstTween.getAttribute('delay')) === 0
    const enter: Style = { visibility: 'visible' }
    if (entryScale !== scale && !(startsWithTween && firstTween.hasAttribute('scale'))) {
      enter.scaleX = tween(entryScale, scale, ENTRY_MS, 'outSine')
      enter.scaleY = tween(entryScale, scale, ENTRY_MS, 'outSine')
    }
    if (effect !== null && !(startsWithTween && firstTween.hasAttribute('alpha'))) enter.opacity = tween(0, opacity, ENTRY_MS, 'outSine')
    if (duration > 0) {
      const lastTweenEnd = Math.max(...Array.from(element.querySelectorAll(':scope > tween'), (node) => Number(node.getAttribute('delay')) * 1_000 + Number(node.getAttribute('time')) * 1_000))
      eventimes.push({ name: hide, startAt: delay + Math.max(duration, lastTweenEnd) })
    }
    const reaction = listOpenings.find((candidate) => candidate.icon === id)
    const style = {
      position: 'absolute', left: `${cqw(coordinate(element, 'x') - width / 2)}cqw`, top: `${cqw(coordinate(element, 'y') - height / 2)}cqw`,
      width: `${cqw(width)}cqw`, height: `${cqw(height)}cqw`, visibility: 'hidden', zIndex,
      pointerEvents: click === undefined ? 'none' : 'auto', opacity: entry.opacity, scaleX: entryScale, scaleY: entryScale,
    }
    const actions = { [show]: { style: enter }, ...tracks, ...(duration > 0 ? { [hide]: { style: { visibility: 'hidden' } } } : {}) }
    if (reaction !== undefined) {
      const svgText = source.icons[src]
      if (svgText === undefined) throw new Error(`Missing SVG markup for ${id}.`)
      return {
        id, type: 'layout',
        initial: { className: 'spie-icon', markup: createIconMarkup(svgText, id, reaction.shape), move: { target: STAGE }, style: { ...style, color: '#808080' } },
        actions: { ...actions, [reaction.event]: { style: {
          color: tween('#808080', reaction.color, reaction.colorDuration),
          rotate: tween(0, reaction.rotation, reaction.duration),
          scaleX: tween(1, reaction.scale, reaction.duration), scaleY: tween(1, reaction.scale, reaction.duration),
        } } },
      }
    }
    return {
      id, type: 'img',
      initial: {
        className: click === undefined ? 'spie-svg' : 'spie-svg spie-hotspot',
        src: `${source.assetBase}/images/${src}`, alt: click?.list ?? '', move: { target: STAGE }, style,
        img: { style: { display: 'block', width: '100%', height: '100%' } },
      },
      ...(click === undefined ? {} : { emit: { click: { event: { name: click.request, visibility: 'story' as const } } } }),
      actions,
    }
  }

  /** Builds a source list and gives its hotspot action a single display target. */
  function listPersos(element: Element, id: string, zIndex: number): PersoDoc[] {
    const click = listOpenings.find((candidate) => candidate.list === id)
    if (click === undefined) throw new Error(`Missing SPIE hotspot for ${id}.`)
    return [{
      id, type: 'layout',
      initial: {
        className: 'spie-list', markup: `<section id="${id}"></section>`, move: { target: STAGE },
        style: { position: 'absolute', left: `${cqw(coordinate(element, 'x'))}cqw`, top: `${cqw(coordinate(element, 'y'))}cqw`, width: `${cqw(Number(element.getAttribute('width')))}cqw`, visibility: 'hidden', opacity: 0, zIndex },
      },
      actions: { [click.event]: { style: { visibility: 'visible', opacity: tween(0, 1, ENTRY_MS) } } },
    }, ...Array.from(element.children, (child, i) => textPerso(child, `${id}-text-${i + 1}`, id))]
  }

  const persos: PersoDoc[] = [{
    id: STAGE, type: 'layout',
    initial: { move: '@root', markup: `<section id="${STAGE}"></section>`, className: 'spie-stage' },
  }, {
    id: 'spie-narration', type: 'media',
    initial: { move: { target: STAGE }, tag: 'audio', src: `${source.assetBase}/sounds/fr/${sound}`, sync: 'master', video: { style: { display: 'none' } } },
    actions: { 'spie:narration': { broadcast: { type: 'START' } } },
  }, ...items.flatMap((element, index): PersoDoc[] => {
    const id = element.id || `spie-${element.localName}-${index + 1}`
    if (element.localName === 'svg') return [svgPerso(element, id, index + 1, clicks.get(element))]
    if (element.localName === 'sub') return [textPerso(element, id, STAGE, index + 1)]
    if (element.localName === 'container') return listPersos(element, id, index + 1)
    throw new Error(`Unsupported SPIE element ${element.localName}.`)
  })]
  return {
    id: 'spie-transmission-page004',
    stories: {
      'page004-sequence-1': {
        id: 'page004-sequence-1',
        persos,
        eventimes,
        state: Object.fromEntries(listOpenings.map(({ list }) => [list, false])),
        listen: listOpenings.map(({ request }) => ({ on: request, straps: ['reveal-list'] })),
        straps: { 'reveal-list': createListCompletion(listOpenings, ENTRY_MS, source.audioDurationMs) },
      },
    },
  }
}
