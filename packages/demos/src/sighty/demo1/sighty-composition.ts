import {
  CodPlay,
  type CodPlayCompileSuccess,
  type CodPlayInstance,
  type CodPlayInstanceHostTarget,
  type CodPlayInstanceMountHandle,
  type CodPlayResourceRegistration,
} from 'codplay'
import { createV2DemoTelco } from '../../v2/layout/telco'
import {
  resolveSlotManifestEntry,
  slotManifest,
} from 'codplay'
import { sceneDocuments } from './scene-resources'
import {
  sightyFile,
  type SightySceneKey,
  type SightySlotName,
} from './sighty-file'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from './scene-root-capsule'

type SightyLogLevel = 'info' | 'warn' | 'error'

type SightyCompositionOptions = Readonly<{
  stage: HTMLElement
  controls: HTMLElement
  onLog: (message: string, level?: SightyLogLevel) => void
}>

type SightyInstanceKey = SightySceneKey
type SightyBuilds = ReadonlyMap<SightySceneKey, CodPlayCompileSuccess>

const SCENE_KEYS: readonly SightySceneKey[] = ['layout', 'sceneA', 'sceneB']
const INSTANCE_IDS: Readonly<Record<SightyInstanceKey, string>> = {
  layout: 'layout-1',
  sceneA: 'scene-a-1',
  sceneB: 'scene-b-1',
}

/** Owns the first executable Sighty composition without introducing a second CodPlay engine. */
export class SightyComposition {
  private readonly owner: CodPlay
  private readonly stage: HTMLElement
  private readonly controls: HTMLElement
  private readonly onLog: (message: string, level?: SightyLogLevel) => void
  private readonly instances = new Map<SightyInstanceKey, CodPlayInstance>()
  private readonly mounts = new Map<SightySlotName, CodPlayInstanceMountHandle>()
  private readonly controlCleanups: Array<() => void> = []
  private resourceUrls: readonly string[] = []
  private destroyed = false

  /** Creates one Sighty owner with the shared CodPlay catalog and engine. */
  constructor(options: SightyCompositionOptions) {
    this.stage = options.stage
    this.controls = options.controls
    this.onLog = options.onLog
    this.owner = new CodPlay({
      engine: {
        diagnosticOutput: (diagnostic) => {
          this.onLog(`${diagnostic.code}: ${diagnostic.message}`, diagnostic.severity === 'warning' ? 'warn' : 'error')
        },
      },
      pauseOnDocumentHidden: false,
    })
  }

  /** Compiles, preloads, creates, mounts and starts the declared composition. */
  async initialize(): Promise<void> {
    const builds = this.compileScenes()
    await this.preloadScenes(builds)
    this.installAuthoringStyles()
    this.createInstances(builds)
    this.mountDeclaredChildren()
    this.createControls()
    await this.playAll()
    this.onLog('Composition Sighty A/B initialisée.')
  }

  /** Publishes capsule-automation CSS through CodPlay's scoped preload channel. */
  private installAuthoringStyles(): void {
    this.owner.preload.css.set({
      slot: 'sighty-demo-capsule-automation',
      cssText: SIGHTY_SCENE_ROOT_STYLE_SHEET,
      container: this.stage,
    })
  }

  /** Compiles each declarative scene independently against the same CodPlay owner. */
  private compileScenes(): SightyBuilds {
    const builds = new Map<SightySceneKey, CodPlayCompileSuccess>()
    for (const sceneKey of SCENE_KEYS) {
      const result = this.owner.build({ scene: sceneDocuments[sceneKey] })
      if (!result.ok) {
        const details = result.diagnostics.errors.map((diagnostic) => diagnostic.message).join(' ')
        throw new Error(`La scène Sighty ${sceneKey} est invalide. ${details}`)
      }
      builds.set(sceneKey, result)
    }
    return builds
  }

  /** Preloads all resources from the separately compiled scene manifests. */
  private async preloadScenes(builds: SightyBuilds): Promise<void> {
    const manifests = SCENE_KEYS.map((sceneKey) => builds.get(sceneKey)!.compiledScene.resources)
    const urls = [...new Set(manifests.flatMap((manifest) => manifest.entries.map((entry) => entry.url)))]
    if (urls.length === 0) return

    const result = await this.owner.preload.load({
      manifest: manifests,
      options: { mode: 'author', container: this.stage },
    })
    if (!result.ok) throw new Error(`Le préchargement Sighty a échoué : ${result.error.message}`)

    const registration: CodPlayResourceRegistration = {
      loaded: result.data.loaded,
      skipped: result.data.skipped,
      metadata: result.data.metadata,
      ...(result.data.media === undefined ? {} : { media: result.data.media }),
    }
    this.owner.resources.register(registration)
    this.resourceUrls = urls
    for (const warning of result.data.warnings ?? []) this.onLog(`${warning.code}: ${warning.message}`, 'warn')
  }

  /** Creates the layout root and lets CodPlay own detached child materialization roots. */
  private createInstances(builds: SightyBuilds): void {
    for (const sceneKey of SCENE_KEYS) {
      const build = builds.get(sceneKey)
      if (build === undefined) throw new Error(`Build manquant pour la scène Sighty ${sceneKey}.`)
      // Child roots are deliberately omitted: CodPlay owns their detached
      // materialization container and mounts their rendered roots directly.
      const instance = this.owner.instances.create({
        instanceId: INSTANCE_IDS[sceneKey],
        compiledScene: build.compiledScene,
        functions: build.functions,
        ...(sceneKey === 'layout' ? { root: this.stage } : {}),
      })
      this.instances.set(sceneKey, instance)
      this.observeInstance(instance, sceneKey)
    }
  }

  /** Logs runtime trace events without creating a second event circuit. */
  private observeInstance(instance: CodPlayInstance, sceneKey: SightyInstanceKey): void {
    this.controlCleanups.push(instance.diagnostic.onTrace((event) => {
      this.onLog(`${sceneKey}: ${event.name} @${event.timeMs}ms`)
    }))
  }

  /** Resolves the declared slots through the core authoring manifest and mounts each child. */
  private mountDeclaredChildren(): void {
    const view = sightyFile.views[0]
    if (view === undefined) throw new Error('Le fichier Sighty ne contient aucune vue.')
    const layout = this.instances.get('layout')
    if (layout === undefined) throw new Error('L’instance layout Sighty est absente.')
    const layoutManifest = slotManifest(sceneDocuments.layout, { storyId: 'main' })

    for (const slotName of Object.keys(view.view.slots) as SightySlotName[]) {
      const resolution = resolveSlotManifestEntry(layoutManifest, slotName, {
        sceneId: sceneDocuments.layout.id,
        storyId: 'main',
        referencePath: `views[0].view.slots.${slotName}`,
      })
      if (!resolution.ok) throw new Error(resolution.diagnostic.message)

      const placement = view.view.slots[slotName][0]
      if (placement === undefined) throw new Error(`Le slot Sighty ${slotName} est vide.`)
      const child = this.instances.get(placement.view.scene)
      if (child === undefined) throw new Error(`L’instance enfant ${placement.view.scene} est absente.`)

      const host: CodPlayInstanceHostTarget = {
        instanceId: layout.instanceId,
        storyId: resolution.entry.storyId,
        persoId: resolution.entry.persoId,
      }
      this.mounts.set(slotName, this.owner.instances.mount({
        host,
        childInstanceId: child.instanceId,
      }))
      this.onLog(`slot ${slotName} ← ${child.instanceId}`)
    }
  }

  /** Creates independent remotes and explicit Sighty lifecycle controls. */
  private createControls(): void {
    this.controls.replaceChildren()
    const lifecycle = document.createElement('section')
    lifecycle.className = 'sighty-control-panel sighty-control-panel--lifecycle'
    const heading = document.createElement('h3')
    heading.textContent = 'Composition'
    const description = document.createElement('p')
    description.textContent = 'Sighty conserve les handles de montage et pilote leur durée de vie.'
    const buttons = document.createElement('div')
    buttons.className = 'sighty-control-panel__buttons'
    const playAllButton = this.createButton('Lire toutes les scènes', async () => this.playAll())
    buttons.append(playAllButton)

    for (const slotName of Object.keys(sightyFile.views[0]?.view.slots ?? {}) as SightySlotName[]) {
      const button = this.createMountToggleButton(slotName)
      buttons.append(button)
    }
    lifecycle.append(heading, description, buttons)
    this.controls.append(lifecycle)

    for (const sceneKey of SCENE_KEYS) {
      const instance = this.instances.get(sceneKey)
      if (instance === undefined) continue
      const panel = document.createElement('section')
      panel.className = 'sighty-control-panel'
      const heading = document.createElement('h3')
      heading.textContent = `Instance ${instance.instanceId}`
      const remote = createV2DemoTelco(instance.telco, {
        onLog: (message, level) => this.onLog(`${sceneKey}: ${message}`, level),
      })
      panel.append(heading, remote.element)
      this.controls.append(panel)
      this.controlCleanups.push(remote.destroy)
    }
  }

  /** Creates one button whose callback remains inside the Sighty lifecycle owner. */
  private createButton(label: string, action: () => void | Promise<void>): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'sighty-action-button'
    button.textContent = label
    button.addEventListener('click', () => { void action() })
    return button
  }

  /** Creates a button that explicitly detaches or remounts one declared slot child. */
  private createMountToggleButton(slotName: SightySlotName): HTMLButtonElement {
    const button = this.createButton('', () => {
      const mount = this.mounts.get(slotName)
      if (mount === undefined) this.mountSlot(slotName)
      else {
        mount.detach()
        this.mounts.delete(slotName)
        this.onLog(`slot ${slotName} démonté`)
      }
      button.textContent = this.mounts.has(slotName) ? `Démonter ${slotName}` : `Remonter ${slotName}`
    })
    button.textContent = `Démonter ${slotName}`
    return button
  }

  /** Mounts one child again from the declarative view after an explicit detach. */
  private mountSlot(slotName: SightySlotName): void {
    const view = sightyFile.views[0]
    const placement = view?.view.slots[slotName][0]
    const layout = this.instances.get('layout')
    if (placement === undefined || layout === undefined) return
    const layoutManifest = slotManifest(sceneDocuments.layout, { storyId: 'main' })
    const resolution = resolveSlotManifestEntry(layoutManifest, slotName, {
      sceneId: sceneDocuments.layout.id,
      storyId: 'main',
    })
    if (!resolution.ok) throw new Error(resolution.diagnostic.message)
    const child = this.instances.get(placement.view.scene)
    if (child === undefined) return
    this.mounts.set(slotName, this.owner.instances.mount({
      host: {
        instanceId: layout.instanceId,
        storyId: resolution.entry.storyId,
        persoId: resolution.entry.persoId,
      },
      childInstanceId: child.instanceId,
    }))
    this.onLog(`slot ${slotName} remonté`)
  }

  /** Starts every occurrence independently while retaining one engine clock. */
  private async playAll(): Promise<void> {
    for (const sceneKey of SCENE_KEYS) {
      const instance = this.instances.get(sceneKey)
      if (instance !== undefined) await instance.telco.play()
    }
  }

  /** Tears down handles, instances, remotes, resources and the shared CodPlay owner once. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    for (const cleanup of this.controlCleanups.splice(0)) cleanup()
    for (const mount of this.mounts.values()) mount.detach()
    this.mounts.clear()
    for (const sceneKey of [...SCENE_KEYS].reverse()) {
      this.owner.instances.destroy(INSTANCE_IDS[sceneKey])
    }
    this.owner.preload.release(this.resourceUrls)
    this.owner.destroy()
    this.instances.clear()
    this.stage.replaceChildren()
    this.controls.replaceChildren()
  }
}
