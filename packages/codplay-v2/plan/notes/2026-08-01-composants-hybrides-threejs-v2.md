# CodPlay V2 - composants hybrides et acces Three.js

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Review: required before component implementation

Le contrat commun des composants est defini dans
[`2026-08-01-composant-v2-contract.md`](./2026-08-01-composant-v2-contract.md).
Cette note ne traite que de l'extension necessaire a `avatar3d`.

## Decision de conception

Un composant V2 peut etre specialise pour une projection qui possede un substrat
interne propre. Le cas `avatar3d` est hybride :

- son hote externe est un node DOM, ici un `canvas` ;
- son contenu interne est une scene Three.js possedee par le composant ;
- le composant accede directement aux objets Three.js qu'il a crees ;
- aucun composant generique DOM ne doit connaitre cette scene interne.

Le composant declare son canvas dans son template. Apres materialisation, il recupere
ce node dans son cycle de vie et possede directement sa projection Three.js. Les
meshes, les bones, les morphs, la camera et les materiaux restent des ressources
internes du composant.

```text
Component.render()
    -> template string contenant le canvas
    -> backend materialise et monte le template
    -> composant recupere le canvas materialise
    -> composant initialise Three.js
    -> composant applique les etats resolus aux objets Three.js
```

## Propriete des couches

Le backend DOM possede le parentage de la projection externe :

- montage, detachement et parentage ;
- coordination du cycle de vie du node retourne.

Le composant avatar possede la configuration de son canvas, car ce canvas est le
support direct de sa projection particuliere. La creation et le parentage du node
restent assures par le chemin de template et le backend.

Le composant `avatar3d` possede sa projection interne :

- `WebGLRenderer` ;
- `THREE.Scene` ;
- camera ;
- modele charge et objets du modele ;
- runtime avatar, morphs, bones et animations.

La regle de writer unique reste vraie par couche. Le composant est l'unique writer
de son canvas et de sa scene Three.js interne ; le backend est l'unique writer du
parentage DOM. Le coeur CodPlay ne recoit ni le contexte WebGL ni les objets
Three.js.

L'acces direct du composant n'est pas un handle public. Il s'agit d'un acces prive
aux ressources que le composant a creees pour sa projection.

## Cycle de vie

Le cycle V2 attendu est le suivant :

1. `render()` retourne un template string qui contient le canvas.
2. Le backend parse, materialise et monte le template.
3. Le composant recupere le canvas materialise et initialise Three.js dessus.
4. Le player remet au composant un etat resolu et le temps CodPlay.
5. Le composant applique directement cet etat a ses objets Three.js.
6. Le composant rend la scene avec son `WebGLRenderer`.
Le composant ne possede pas d'horloge. Les animations et les transitions sont
evaluees a partir du temps fourni par CodPlay.

## Extrait de composant V2

L'extrait suivant montre la frontiere semantique. Les noms `init` et `update`
sont illustratifs tant que le contrat executable des composants V2 n'est
pas gele ; l'acces direct a Three.js et la propriete des couches sont les decisions
visees.

```ts
type Avatar3DState = Readonly<{
  viseme: string | null
  motion: string | null
  camera: {
    fov: number
    position: { x: number; y: number; z: number }
  }
}>

class Avatar3DComponent extends BaseComponent {
  private canvas: HTMLCanvasElement | null = null
  private renderer: WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private avatar: AvatarEngine | null = null

  /** Declares the canvas host through the component template. */
  render(): string {
    return `
      <canvas class="avatar3d-host"></canvas>
    `
  }

  /** Initializes the private Three.js projection on the materialized canvas. */
  init(): void {
    this.canvas = this.node as HTMLCanvasElement
    this.renderer = new WebGLRenderer({ canvas: this.canvas })
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera()
    this.avatar = createAvatarEngine(this.scene)
  }

  /** Applies one resolved avatar state directly to the private Three.js scene. */
  update(state: Avatar3DState, timelineMs: number): void {
    if (!this.renderer || !this.scene || !this.camera || !this.avatar) return

    this.avatar.setViseme(state.viseme)
    this.avatar.setMotion(state.motion)
    this.camera.fov = state.camera.fov
    this.camera.position.set(
      state.camera.position.x,
      state.camera.position.y,
      state.camera.position.z,
    )
    this.avatar.evaluate(timelineMs)
    this.renderer.render(this.scene, this.camera)
  }

}
```

Le point important est la direction de l'appel :

```text
SolvedPerso.state
    -> Avatar3DComponent.update(state, timelineMs)
    -> this.avatar / this.camera / this.scene
    -> this.renderer.render(this.scene, this.camera)
```

Le template ne decrit que le canvas hote. Il ne decrit pas les meshes Three.js ;
l'API Three.js est l'implementation interne du composant specialise.

## Ce que cette decision n'autorise pas

- Le coeur CodPlay ne manipule pas `THREE.Object3D`.
- Le player ne cherche pas le canvas avec un selector DOM.
- Le composant ne reconstruit pas son etat logique en lisant le canvas ou la scene.
- Un composant DOM generique ne recoit pas une scene Three.js.
- Le composant ne cree pas une horloge independante de CodPlay.

## Hors contrat executable actuel

- interface V2 finale du cycle `render/init/update` ;
- injection de l'hote materialise vers le composant ;
- adaptation runtime des `PersoState` vers le type `Avatar3DState` ;
- backend DOM et backend Three.js de production.
