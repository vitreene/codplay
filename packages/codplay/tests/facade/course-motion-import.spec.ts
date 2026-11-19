/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import type { SceneDoc } from '../../src/scene/types'
import { convertLegacyMotionItem } from '../../../demos/src/v2/demos/course-motion-import/legacy-image-converter'
import { convertLegacyPageSequence } from '../../../demos/src/v2/demos/course-motion-import/legacy-page-sequence-converter'
import { convertLegacyPage } from '../../../demos/src/v2/demos/course-motion-import/legacy-page-converter'

const IMAGE_XML = `
  <img id="orb" src="orb.svg" x="800" y="400" scale="1.5" delay="0.25" duration="3" effect="toLeft">
    <tween delay="0.25" x="400" y="200" time="2" />
  </img>
`

const CONTIGUOUS_CHAIN_XML = `
  <img src="orb.svg" x="800" y="400" scale="1.5" delay="0.25" duration="3" effect="toLeft">
    <tween delay="0.25" x="600" y="300" time="1" />
    <tween delay="1.25" x="400" y="200" time="1" />
  </img>
`

const PAUSED_CHAIN_XML = `
  <img src="orb.svg" x="800" y="400" scale="1.5" delay="0.25" duration="3.5" effect="toLeft">
    <tween delay="0.25" x="600" y="300" time="1" />
    <tween delay="1.75" x="400" y="200" time="1" />
  </img>
`

const PAGE_SEQUENCE_XML = `
  <sequency>
    <sound>p2_1.mp3</sound>
    <container id="panel1_1" properties="effectPanelCircle,panelColor1" duration="4.5"/>
    <container id="panel1_2" properties="effectPanelCircle,panelColor2" delay="0.2" duration="4.3"/>
    <img delay="0.4" src="p2/circu01.png" x="center" y="center" scale="2" effect="growDown,toLeft" duration="4.5"/>
    <img delay="0.4" src="p2/circu02.png" x="1220" y="140" scale="2" effect="toLeft" duration="4.5">
      <tween delay="0.5" x="370" y="640" time="4" />
    </img>
    <img delay="5" src="p2/IMG_0565.jpg" x="center" y="center" background="Y" effect="fromLeft"/>
  </sequency>
`

const GLOBAL_PROPERTIES_XML = `
  <data>
    <globalProperties>
      <properties name="effectPanelCircle" left="50%" top="50%" centered="Y" width="0" height="0" cssClass="outerContainer under in-circle" effect="noDefault,toBottom">
        <tween width="2800px" height="2800px" time="0.5" ease="sine.in" />
      </properties>
      <properties name="panelColor1" cssStyle="backgroundColor:var(--panel-bg-color--1)" />
      <properties name="panelColor2" cssStyle="backgroundColor:var(--panel-bg-color--2)" />
    </globalProperties>
  </data>
`

const P02_XML = `
  <page id="p02">
    <default />
    <sequency>
      <sound>sequence-1.mp3</sound>
      <img id="background" src="02/background.jpg" x="center" y="center" />
      <img id="hero" src="02/hero.png" x="800" y="400" delay="1">
        <tween targetItem="background" time="1" alpha="0.25" />
      </img>
      <img id="expires" src="02/expires.png" x="800" y="400" delay="0.5" duration="1" />
      <container id="text-box" delay="0.5" width="500">
        <sub src="first-title" delay="1" properties="h4" />
      </container>
    </sequency>
    <sequency><sound>sequence-2.mp3</sound><img src="02/bonnet@3x.png" x="800" y="400" /><img src="02/bonnet@3x.png" x="800" y="400" /></sequency>
    <sequency><sound>sequence-3.mp3</sound><img id="third" src="02/third.png" x="800" y="400" /></sequency>
    <sequency><sound>sequence-4.mp3</sound><img id="fourth" src="02/fourth.png" x="800" y="400" showAfter="Y" /></sequency>
  </page>
`

const P02_PROPERTIES_XML = `
  <data><globalProperties><properties name="h4" textSize="24" /></globalProperties></data>
`

const P02_TEXT_XML = `
  <lang localisation="fr"><tr key="first-title"><![CDATA[Texte&nbsp;du fixture]]></tr></lang>
`

/** Converts a test-owned four-sequence page into one ordered scene fixture. */
function createP02Scene(): SceneDoc {
  return convertLegacyPage(P02_XML, {
    assetBasePath: '/fixture-course/images',
    audioBasePath: '/fixture-course/sounds/fr',
    audioDurationsMs: {
      'sequence-1.mp3': 5_000,
      'sequence-2.mp3': 5_000,
      'sequence-3.mp3': 5_000,
      'sequence-4.mp3': 5_000,
    },
    chapterId: '02_acces',
    globalPropertiesXml: P02_PROPERTIES_XML,
    imageSizes: {
      '02/background.jpg': { width: 1_000, height: 500 },
      '02/hero.png': { width: 100, height: 200 },
      '02/expires.png': { width: 50, height: 50 },
      '02/second.png': { width: 50, height: 50 },
      '02/third.png': { width: 50, height: 50 },
      '02/fourth.png': { width: 50, height: 50 },
      '02/bonnet@3x.png': { width: 358, height: 524 },
    },
    textXml: P02_TEXT_XML,
  })
}

/** Converts test-owned page and property XML values into a complete sequence scene. */
function createPageSequenceScene(xml: string = PAGE_SEQUENCE_XML): SceneDoc {
  return convertLegacyPageSequence(xml, {
    assetBasePath: '/fixture-course/images',
    audioBasePath: '/fixture-course/sounds/fr',
    audioDurationMs: 8_626.508,
    chapterId: '02_circulation',
    globalPropertiesXml: GLOBAL_PROPERTIES_XML,
    imageSizes: {
      'p2/circu01.png': { width: 966, height: 603 },
      'p2/circu02.png': { width: 111, height: 123 },
      'p2/IMG_0565.jpg': { width: 1_200, height: 700 },
    },
    stageId: 'course-motion-stage',
  })
}

/** Creates a deterministic frame scheduler for player seeks in this test. */
function createManualScheduler(): CodPlayFrameScheduler {
  return { request: () => 1, cancel: () => undefined }
}

/** Adds the authored destination required by the converted image placement. */
function createScene(xml: string = IMAGE_XML): SceneDoc {
  const converted = convertLegacyMotionItem(xml, {
    assetBasePath: '/fixture-images',
    chapterId: 'test-chapter',
    imageSize: { width: 100, height: 80 },
    stageId: 'test-stage',
  })
  const stage: SceneDoc['stories']['main']['persos'][number] = {
    id: 'test-stage',
    type: 'layout',
    initial: {
      move: '@root',
      markup: '<section id="test-stage"></section>',
      style: { width: '100%', height: '100%', containerType: 'inline-size' },
    },
    actions: {},
  }

  return {
    ...converted,
    stories: {
      ...converted.stories,
      main: {
        ...converted.stories.main,
        persos: [stage, ...converted.stories.main.persos],
      },
    },
  }
}

/** Builds and mounts one converted image scene through the shared CodPlay player. */
function mountImageScene(codplay: CodPlay, xml: string, instanceId: string): {
  instance: ReturnType<CodPlay['instances']['create']>
  wrapper: HTMLElement
} {
  const scene = createScene(xml)
  const build = codplay.build({ scene })
  if (!build.ok) throw new Error('Converted image scene did not compile.')

  const imageUrl = '/fixture-images/orb.svg'
  codplay.resources.register({ loaded: [imageUrl], skipped: [], metadata: {} })
  const root = document.createElement('main')
  Object.defineProperty(root, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ width: 1_600 }),
  })
  document.body.append(root)
  const instance = codplay.instances.create({
    instanceId,
    compiledScene: build.compiledScene,
    functions: build.functions,
    root,
  })
  const wrapper = root.querySelector<HTMLElement>('.course-motion-image')
  if (wrapper === null) throw new Error('Converted image was not materialized.')
  return { instance, wrapper }
}

describe('legacy image motion conversion through the CodPlay player', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('converts the source page sequence into two panels, three images, and an audio perso', () => {
    codplay = new CodPlay({ frameScheduler: createManualScheduler(), pauseOnDocumentHidden: false })
    const scene = createPageSequenceScene()
    const persos = scene.stories.main?.persos ?? []
    const imagePersos = persos.filter((perso) => perso.type === 'img')
    const panelPersos = persos.filter((perso) => perso.id === 'panel1_1' || perso.id === 'panel1_2')
    const audioPerso = persos.find((perso) => perso.id === 'course-motion-audio')

    expect(persos.map(({ id }) => id)).toEqual([
      'course-motion-stage',
      'course-motion-audio',
      'panel1_1',
      'panel1_2',
      'img_02_circulation_p2_circu01',
      'img_02_circulation_p2_circu02',
      'img_02_circulation_p2_IMG_0565',
    ])
    expect(imagePersos).toHaveLength(3)
    expect(panelPersos).toHaveLength(2)
    expect(audioPerso).toMatchObject({
      type: 'media',
      initial: {
        tag: 'audio',
        src: '/fixture-course/sounds/fr/p2_1.mp3',
        sync: 'auto',
        video: { style: { display: 'none' } },
      },
      actions: { 'course-motion-audio:start': { broadcast: { type: 'START' } } },
    })
    expect(scene.stories.main?.eventimes).toContainEqual({ name: 'course-motion-audio:start', startAt: 0 })
    expect(scene.eventimes).toEqual([{ name: 'sequence:end', startAt: 8_626.508 }])

    const overviewImage = imagePersos[0]!
    expect(overviewImage.initial).toMatchObject({
      src: '/fixture-course/images/p2/circu01.png',
      style: { x: -25.46875, y: -22.484375, width: 150.9375, height: 94.21875, opacity: 0 },
    })
    expect(overviewImage.actions).toMatchObject({
      'img_02_circulation_p2_circu01:appear': {
        style: {
          width: { from: 150.9375, to: 120.75, duration: 500 },
          height: { from: 94.21875, to: 75.375, duration: 500 },
        },
      },
      'img_02_circulation_p2_circu01:exit': {
        style: {
          x: { from: -10.375, to: -22.875, duration: 500 },
          opacity: { from: 1, to: 0, duration: 500 },
        },
      },
    })
    expect(scene.stories.main?.eventimes).toContainEqual({ name: 'img_02_circulation_p2_circu02:motion:1', startAt: 900 })
    expect(scene.stories.main?.eventimes).toContainEqual({ name: 'img_02_circulation_p2_circu02:exit', startAt: 5_000 })
    expect(scene.stories.main?.eventimes).toContainEqual({ name: 'img_02_circulation_p2_IMG_0565:appear', startAt: 5_000 })

    const sceneBackdropImage = imagePersos[2]!
    expect(sceneBackdropImage.initial).toMatchObject({
      className: 'course-motion-image course-motion-image--background',
      img: { style: { objectFit: 'contain' } },
      style: {
        x: -0.375,
        y: 2.375,
        width: 75.75,
        height: 44.5,
        padding: '0.375cqw',
        borderRadius: '0.5cqw',
      },
    })
    expect(sceneBackdropImage.actions).not.toHaveProperty('img_02_circulation_p2_IMG_0565:exit')

    const build = codplay.build({ scene })
    if (!build.ok) throw new Error(JSON.stringify(build.diagnostics, null, 2))
  })

  it('reports unsupported page-sequence elements instead of silently skipping them', () => {
    expect(() => createPageSequenceScene(PAGE_SEQUENCE_XML.replace('</sequency>', '<video src="clip.mp4" /></sequency>')))
      .toThrow('unsupported <video> content')
  })

  it('keeps source timing and presents the translated x/y tween through Seek', async () => {
    codplay = new CodPlay({ frameScheduler: createManualScheduler(), pauseOnDocumentHidden: false })
    const scene = createScene()
    expect(scene.stories.main?.persos.find((perso) => perso.type === 'img')?.id).toBe('orb')
    const build = codplay.build({ scene })
    if (!build.ok) throw new Error('Converted image scene did not compile.')

    const imageUrl = '/fixture-images/orb.svg'
    codplay.resources.register({ loaded: [imageUrl], skipped: [], metadata: {} })
    const root = document.createElement('main')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 1_600 }),
    })
    document.body.append(root)
    const instance = codplay.instances.create({
      instanceId: 'legacy-image-motion-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const wrapper = root.querySelector<HTMLElement>('.course-motion-image')
    const image = wrapper?.querySelector('img')
    if (wrapper === null || wrapper === undefined || image === null || image === undefined) {
      throw new Error('Converted image was not materialized.')
    }

    expect(image.getAttribute('src')).toBe('/fixture-images/orb.svg')
    expect(image.style.objectFit).toBe('contain')
    expect(image.style.width).toBe('100%')
    expect(image.style.height).toBe('100%')
    expect(wrapper.style.width).toBe('150px')
    expect(wrapper.style.height).toBe('120px')
    expect(wrapper.style.opacity).toBe('0')

    await instance.telco.seek(1_500)
    expect(wrapper.style.transform).not.toMatch(/%|scale\(/)
    const position = wrapper.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)
    if (position === null) throw new Error('Converted x/y motion was not projected.')
    expect(Number(position[1]) + 75).toBeCloseTo(517.2, 0)
    expect(Number(position[2]) + 60).toBeCloseTo(258.6, 0)
    expect(Number(wrapper.style.opacity)).toBeGreaterThan(0)

    await instance.telco.seek(2_500)
    expect(wrapper.style.transform).toContain('translate(325px, 140px)')

    await instance.telco.seek(3_850)
    expect(wrapper.style.display).toBe('none')
  })

  it('presents visible intermediate positions during Play', async () => {
    codplay = new CodPlay({ frameScheduler: createManualScheduler(), pauseOnDocumentHidden: false })
    const scene = createScene()
    const build = codplay.build({ scene })
    if (!build.ok) throw new Error('Converted image scene did not compile.')

    const imageUrl = '/fixture-images/orb.svg'
    codplay.resources.register({ loaded: [imageUrl], skipped: [], metadata: {} })
    const root = document.createElement('main')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 1_600 }),
    })
    document.body.append(root)
    const instance = codplay.instances.create({
      instanceId: 'legacy-image-motion-play-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const wrapper = root.querySelector<HTMLElement>('.course-motion-image')
    if (wrapper === null) throw new Error('Converted image was not materialized.')

    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(1_000)

    expect(wrapper.style.transform).not.toMatch(/%|scale\(/)
    const position = wrapper.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)
    if (position === null) throw new Error('Converted x/y motion was not projected during Play.')
    expect(Number(position[1]) + 75).toBeGreaterThan(400)
    expect(Number(position[1]) + 75).toBeLessThan(800)
    expect(Number(position[2]) + 60).toBeGreaterThan(200)
    expect(Number(position[2]) + 60).toBeLessThan(400)
    expect(Number(wrapper.style.opacity)).toBeGreaterThan(0)
  })

  it('exposes each XML trajectory as one action and one eventime on the same img perso', () => {
    const scene = createScene(CONTIGUOUS_CHAIN_XML)
    const imagePerso = scene.stories.main?.persos.find((perso) => perso.id === 'img_test-chapter_orb')
    if (imagePerso === undefined) throw new Error('The converted img perso is missing.')

    expect(imagePerso.type).toBe('img')
    expect(imagePerso.initial).toMatchObject({
      style: { x: 45.3125, y: 21.25, width: 9.375, height: 7.5 },
    })
    expect(imagePerso.actions).toMatchObject({
      'img_test-chapter_orb:motion:1': {
        style: {
          x: { from: 45.3125, to: 32.8125, duration: 1_000 },
          y: { from: 21.25, to: 15, duration: 1_000 },
        },
      },
      'img_test-chapter_orb:motion:2': {
        style: {
          x: { from: 32.8125, to: 20.3125, duration: 1_000 },
          y: { from: 15, to: 8.75, duration: 1_000 },
        },
      },
    })
    expect(scene.stories.main?.eventimes).toContainEqual({ name: 'img_test-chapter_orb:motion:1', startAt: 500 })
    expect(scene.stories.main?.eventimes).toContainEqual({ name: 'img_test-chapter_orb:motion:2', startAt: 1_500 })
  })

  it('uses the chapter and formatted resource path for an image without an XML id', () => {
    const scene = convertLegacyMotionItem(`
      <img src="p2/circu02.png" x="1220" y="140" scale="2" delay="0.4" duration="4.5" effect="toLeft">
        <tween delay="0.5" x="370" y="640" time="4" />
      </img>
    `, {
      assetBasePath: '/fixture-images',
      chapterId: '02_circulation',
      imageSize: { width: 111, height: 123 },
      stageId: 'test-stage',
    })
    const imagePerso = scene.stories.main?.persos[0]
    if (imagePerso === undefined) throw new Error('The converted image perso is missing.')

    expect(imagePerso.id).toBe('img_02_circulation_p2_circu02')
    expect(imagePerso.actions).toHaveProperty('img_02_circulation_p2_circu02:motion:1')
    expect(scene.stories.main?.eventimes).toContainEqual({
      name: 'img_02_circulation_p2_circu02:motion:1',
      startAt: 900,
    })
  })

  it('seeks through both contiguous trajectories without losing the waypoint', async () => {
    codplay = new CodPlay({ frameScheduler: createManualScheduler(), pauseOnDocumentHidden: false })
    const { instance, wrapper } = mountImageScene(codplay, CONTIGUOUS_CHAIN_XML, 'legacy-image-chain-seek-test')

    await instance.telco.seek(1_000)
    const firstSegment = wrapper.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)
    if (firstSegment === null) throw new Error('The first trajectory was not projected.')
    expect(Number(firstSegment[1])).toBeGreaterThan(525)
    expect(Number(firstSegment[1])).toBeLessThan(725)

    await instance.telco.seek(1_500)
    expect(wrapper.style.transform).toContain('translate(525px, 240px)')

    await instance.telco.seek(2_000)
    const secondSegment = wrapper.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)
    if (secondSegment === null) throw new Error('The second trajectory was not projected.')
    expect(Number(secondSegment[1])).toBeGreaterThan(325)
    expect(Number(secondSegment[1])).toBeLessThan(525)

    await instance.telco.seek(2_500)
    expect(wrapper.style.transform).toContain('translate(325px, 140px)')
  })

  it('plays across both contiguous trajectories through the shared player', async () => {
    codplay = new CodPlay({ frameScheduler: createManualScheduler(), pauseOnDocumentHidden: false })
    const { instance, wrapper } = mountImageScene(codplay, CONTIGUOUS_CHAIN_XML, 'legacy-image-chain-play-test')

    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(1_000)
    const firstSegment = wrapper.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)
    if (firstSegment === null) throw new Error('Play did not project the first trajectory.')
    expect(Number(firstSegment[1])).toBeGreaterThan(525)
    expect(Number(firstSegment[1])).toBeLessThan(725)

    codplay.engine.advance(1_500)
    expect(wrapper.style.transform).toContain('translate(525px, 240px)')

    codplay.engine.advance(2_000)
    const secondSegment = wrapper.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)
    if (secondSegment === null) throw new Error('Play did not project the second trajectory.')
    expect(Number(secondSegment[1])).toBeGreaterThan(325)
    expect(Number(secondSegment[1])).toBeLessThan(525)
  })

  it('holds the waypoint during an XML delay before the next trajectory', async () => {
    codplay = new CodPlay({ frameScheduler: createManualScheduler(), pauseOnDocumentHidden: false })
    const { instance, wrapper } = mountImageScene(codplay, PAUSED_CHAIN_XML, 'legacy-image-chain-gap-test')

    await instance.telco.seek(1_750)
    expect(wrapper.style.transform).toContain('translate(525px, 240px)')

    await instance.telco.seek(2_500)
    const secondSegment = wrapper.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)
    if (secondSegment === null) throw new Error('The delayed trajectory was not projected.')
    expect(Number(secondSegment[1])).toBeGreaterThan(325)
    expect(Number(secondSegment[1])).toBeLessThan(525)
  })

  it('maps one source page to four sequential stories and hides items at their boundaries', () => {
    codplay = new CodPlay({ frameScheduler: createManualScheduler(), pauseOnDocumentHidden: false })
    const scene = createP02Scene()
    const storyIds = Object.keys(scene.stories)

    expect(scene.id).toBe('course-access-p02')
    expect(storyIds).toEqual([
      'p02-sequence-1',
      'p02-sequence-2',
      'p02-sequence-3',
      'p02-sequence-4',
    ])
    expect(scene.eventimes).toEqual([{ name: 'sequence:end', startAt: 20_000 }])

    const firstStory = scene.stories['p02-sequence-1']!
    expect(firstStory.eventimes).toContainEqual({ name: 'p02-sequence-1-audio:start', startAt: 0 })
    expect(firstStory.eventimes).toContainEqual({ name: 'background:hide', startAt: 5_500 })
    expect(firstStory.eventimes).toContainEqual({ name: 'hero:target:1', startAt: 1_000 })
    expect(firstStory.eventimes).toContainEqual({ name: 'expires:hide', startAt: 2_100 })
    expect(firstStory.eventimes).toContainEqual({ name: 'sub_02_acces_first-title:show', startAt: 1_500 })
    expect(scene.stories['p02-sequence-2']?.eventimes).toContainEqual({
      name: 'p02-sequence-2-audio:start',
      startAt: 5_000,
    })
    expect(scene.stories['p02-sequence-2']?.persos.filter((perso) => perso.type === 'img').map(({ id }) => id)).toEqual([
      'img_02_acces_02_bonnet@3x',
      'img_02_acces_02_bonnet@3x-2',
    ])
    expect(scene.stories['p02-sequence-4']?.eventimes).not.toContainEqual({ name: 'fourth:hide', startAt: 20_000 })

    const background = firstStory.persos.find((perso) => perso.id === 'background')
    expect(background?.actions).toHaveProperty('hero:target:1')
    expect(background?.actions).toHaveProperty('background:hide')
    expect(firstStory.persos.find((perso) => perso.id === 'sub_02_acces_first-title')).toMatchObject({
      initial: { content: 'Texte\u00a0du fixture' },
    })

    const build = codplay.build({ scene })
    if (!build.ok) throw new Error(JSON.stringify(build.diagnostics, null, 2))
  })

  it('rejects overlapping XML trajectories instead of guessing their composition', () => {
    const overlappingXml = `
      <img id="orb" src="orb.svg" x="800" y="400" scale="1.5" delay="0.25" duration="3" effect="toLeft">
        <tween delay="0.25" x="600" y="300" time="1" />
        <tween delay="1" x="400" y="200" time="1" />
      </img>
    `

    expect(() => createScene(overlappingXml)).toThrow('ordered, non-overlapping tween segments')
  })
})
