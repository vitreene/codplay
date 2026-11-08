import type { RiveArtboard, RiveFile, RiveRuntime, RiveViewModelInstance } from '../../src/rive'

/** Supplies native boundary objects owned by these tests, without a demo asset. */
export function createViewModelFixture() {
  const instances: FixtureInstance[] = []
  const artboards: FixtureArtboard[] = []
  const machines: FixtureMachine[] = []

  class FixtureInstance implements RiveViewModelInstance {
    readonly properties = {
      neutral: { value: 1 },
      vowel: { value: 0 },
      turn: { value: 12 },
      headX: { value: 50 },
      speaking: { value: false },
    }
    deleted = false

    /** Describes the scalar properties exported by this independent fixture. */
    getProperties() {
      return Object.entries(this.properties).map(([name, property]) => ({ name, type: typeof property.value }))
    }

    /** Resolves a numeric native property by its authored name. */
    number(name: string) {
      if (name === 'neutral' || name === 'vowel' || name === 'turn' || name === 'headX') return this.properties[name]
      return null
    }

    /** Resolves a boolean native property by its authored name. */
    boolean(name: string) {
      return name === 'speaking' ? this.properties.speaking : null
    }

    /** Reads the native property values without sharing mutable test snapshots. */
    read() {
      return Object.fromEntries(Object.entries(this.properties).map(([name, property]) => [name, property.value]))
    }

    /** Records disposal of the native instance. */
    delete() { this.deleted = true }
  }

  class FixtureArtboard implements RiveArtboard {
    readonly bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    instance: FixtureInstance | undefined
    presented: Record<string, number | boolean> = {}
    drawn: Record<string, number | boolean> = {}
    draws = 0
    deleted = false

    /** Advances the host independently from the logical machine. */
    advance() { return true }
    /** Observes the frame drawn through the real host commit. */
    draw() {
      this.draws += 1
      this.drawn = { ...this.presented }
    }
    /** Keeps linear animation outside this fixture. */
    animationCount() { return 0 }
    /** Implements the unused native linear-animation lookup. */
    animationByIndex() { return undefined }
    /** Implements the unused native named-animation lookup. */
    animationByName() { return undefined }
    /** Resolves the machine descriptor consumed by the real component. */
    stateMachineByName() { return {} }
    /** Records disposal of the host's artboard. */
    delete() { this.deleted = true }
  }

  class FixtureMachine {
    readonly advances: number[] = []
    readonly artboard: FixtureArtboard
    deleted = false

    /** Associates one native machine with its host-owned artboard. */
    constructor(_reference: unknown, artboard: RiveArtboard) {
      this.artboard = artboard as FixtureArtboard
      machines.push(this)
    }
    /** Models Rive's application of bound values on advance, including zero delta. */
    advance(seconds: number) {
      this.advances.push(seconds)
      this.artboard.presented = this.artboard.instance?.read() ?? {}
      return true
    }
    /** Keeps legacy inputs separate from the ViewModel. */
    inputCount() { return 0 }
    /** Implements the unused legacy input accessor. */
    input() { return { name: '', value: undefined } }
    /** Binds this instance to this artboard without a global registry. */
    bindViewModelInstance(instance: RiveViewModelInstance) {
      this.artboard.instance = instance as FixtureInstance
    }
    /** Records disposal of the native machine. */
    delete() {
      if (this.artboard.deleted) throw new Error('Native machine outlived its artboard.')
      this.deleted = true
    }
  }

  /** Creates a fresh host artboard from the shared file. */
  function createArtboard() {
    const artboard = new FixtureArtboard()
    artboards.push(artboard)
    return artboard
  }

  const file: RiveFile = {
    defaultArtboard: createArtboard,
    artboardByName: createArtboard,
    viewModelByName: (name) => name === 'Expression' ? {
      instanceByName: (instanceName) => {
        if (instanceName !== 'Exported pose') return null
        const instance = new FixtureInstance()
        instances.push(instance)
        return instance
      },
    } : null,
  }
  const runtime: RiveRuntime = {
    load: async () => file,
    makeRenderer: () => ({ clear() {}, save() {}, restore() {}, align() {}, delete() {} }),
    LinearAnimationInstance: class {
      /** Implements the unused linear advance boundary. */
      advance() { return true }
      /** Implements the unused linear apply boundary. */
      apply() {}
      /** Implements the unused linear release boundary. */
      delete() {}
    },
    StateMachineInstance: FixtureMachine,
    Fit: { fill: 0, contain: 1, cover: 2, fitWidth: 3, fitHeight: 4, none: 5, scaleDown: 6, layout: 7 },
    Alignment: { topLeft: 0, topCenter: 1, topRight: 2, centerLeft: 3, center: 4, centerRight: 5, bottomLeft: 6, bottomCenter: 7, bottomRight: 8 },
    resolveAnimationFrame() {},
  }
  return { runtime, file, instances, artboards, machines }
}
