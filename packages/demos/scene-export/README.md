# Export CodPlay : Rive + Three.js

Cette démo exporte dans un seul paquet une scène V2 qui réunit l’avatar Rive
`coach.riv` et la grille animée de la démo `threejs-grid`. Le paquet contient
la scène compilée, les feuilles CSS, le document Rive et l’audio source. Les
composants Rive/Three.js et leurs bibliothèques sont configurés par le site dans
l’engine partagé. Le player CodPlay est construit séparément et importé une
seule fois. Dans cette démo, l’engine embarque les modules JavaScript Rive et
Three.js ; le runtime Rive charge son WASM depuis l’URL prévue par le package.

```sh
npm run scene-export:build --workspace=@codplay/demos
npm run build --workspace=@codplay/demos
npm run preview --workspace=@codplay/demos
```

Le build crée séparément le player, l’engine du site et le paquet de scène.
Chaque entrée existante de `engine.libraries.register` porte le specifier
`module` et son mode de livraison : `package` embarque le module dans l’engine,
`remote` pointe vers un module ESM compatible à une URL, et `platform` laisse le
specifier à la résolution de la page, généralement avec une import map.

Ouvrir `/scene-export/`. `load()` prépare le document et la bibliothèque Rive,
puis restitue la scène avec Three.js avant d’activer les commandes. Les boutons
lancent l’instance, cherchent à 9 000 ms, la mettent en pause ou la détruisent.

Le site charge son engine et le player séparément. Le bundle d’engine garde
`codplay` externe, résolu vers l’URL unique du player :

```html
<script type="importmap">
  { "imports": { "codplay": "/codplay-player/codplay.js" } }
</script>
```

Le bundle d’intégration expose les définitions et stratégies preload tierces :

```ts
const [{ CodPlay }, integration] = await Promise.all([
  import('/codplay-player/codplay.js'),
  import('/codplay-engine/engine.js'),
])
const player = new CodPlay({
  engine: integration.engineCapabilities,
  preload: { strategies: integration.preloadStrategies },
})
const instance = await player.load('/exports/scene-export/', { root: '#scene-root' })
await instance.telco.play()
```

Une bibliothèque distante doit exposer les exports attendus par son intégration
et autoriser le chargement depuis le site. Une bibliothèque en mode `platform`
doit avoir une entrée correspondante dans l’import map. Les dépendances propres
aux bibliothèques, comme le WASM de Rive, suivent aussi leur configuration de
chargement.
