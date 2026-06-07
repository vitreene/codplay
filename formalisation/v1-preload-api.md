# Preload API V1 - preparation ressources

## Statut

Spec normative V1 pour le module de preload consomme par le Player.

## Objectif

Charger et preparer les ressources de lecture (media, fonts, css) a partir du `ResourceManifest` avant que la scene ne demarre. Garantir que les composants disposent de leurs ressources au moment ou ils en ont besoin, sans bloquer inutilement ni re-fetcher ce qui est deja disponible.

---

## Contrat API

```ts
type PreloadApi = {
  load: (input: {
    manifest: ResourceManifest
    options?: PreloadOptions
  }) => Promise<ApiResult<PreloadResult>>

  readonly state: PreloadState

  cancel: () => void
  release: (urls: string[]) => void
}

type PreloadOptions = {
  mode?: 'author' | 'broadcast'    // defaut: 'broadcast'
  timeout?: number                  // ms par ressource, defaut: 10000
}

type PreloadResult = {
  loaded: string[]
  skipped: string[]
  warnings?: ApiWarning[]
}

type PreloadState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  loadedCount: number
  totalCount: number
}
```

---

## Modes d'utilisation

### Mode `broadcast`

Le mode `broadcast` est le mode de diffusion standard. Il est appele par `player.init()` de facon automatique et transparente.

Comportement sur ressource indisponible :
- un `ApiWarning` est emis dans le resultat
- la scene demarre quand meme
- le composant concerné affiche son fallback visuel
- le player ne bloque pas

### Mode `author`

Le mode `author` est destine a la tooling auteur. Il est appele directement via l'API `PreloadApi`, en dehors du player.

Comportement sur ressource indisponible :
- `player.init()` retourne un `ApiResult<void>` en erreur
- la scene ne demarre pas
- l'erreur identifie la ressource manquante et son URL

L'acces direct en mode auteur permet un feedback immediat sur les ressources manquantes avant meme de lancer le player. La tooling peut appeler `preload.load()` avec son propre manifeste, puis appeler `player.init()` qui retrouvera les ressources deja en cache.

---

## Strategies de chargement par type

Chaque type de ressource utilise une strategie specifique adaptee a la nature de son contenu.

### `image`

```
new Image()
img.src = url
signal: onload | onerror
```

Suffit a primer le cache navigateur. Quand `ImageComponent` pose `<img src="url">`, le navigateur sert depuis le cache sans requete reseau supplementaire.

### `audio`

```
new Audio()
audio.preload = 'auto'
audio.src = url
signal: canplaythrough | onerror
```

`canplaythrough` garantit que le navigateur estime avoir charge assez de donnees pour une lecture sans interruption. C'est le signal attendu en V1 pour valider la readiness audio.

### `video`

```
<video preload="auto" style="display:none">
<source src="url">
signal: canplaythrough | onerror
```

Meme logique que `audio`. L'element est insere dans le DOM temporairement pour que le navigateur traite le preload, puis retire apres reception du signal.

Note : `canplaythrough` ne garantit pas que l'integralite du fichier est en memoire. Il garantit que la lecture peut commencer sans interruption au moment du signal. Pour des fichiers longs, c'est suffisant en V1.

### `font`

```
const face = new FontFace(name, `url(${url})`)
document.fonts.add(face)
signal: face.load() → Promise
```

Le nom de fonte est derive du champ `name` de l'entree manifeste si present, sinon du segment final de l'URL.

### `css`

```
fetch(url) puis injection <link rel="stylesheet" href="url">
signal: link.onload | link.onerror
```

---

## Cache de session

Le cache preload est un singleton de session, decoupled du cycle de vie du Player.

Regles :
- une URL deja chargee (`status: 'ready'`) n'est jamais re-fetchee, meme apres `player.destroy()` suivi d'un nouveau `player.init()`
- si une URL est en cours de chargement et qu'un second appel `load()` arrive avec la meme URL, le second attend la resolution du premier
- le cache survit au cycle `play → stop → init` — c'est le mecanisme qui protege les cas de rewind complet ou reset de scene sans re-fetch

Structure d'une entree cache :

```ts
type PreloadCacheEntry = {
  url: string
  status: 'loading' | 'ready' | 'error'
  error?: string
}
```

### Release

`preload.release(urls: string[])` retire les entrees specifiees du cache. Les chargements en attente pour ces URLs sont annules.

Cas d'usage principal : liberer la memoire apres `sequence:end` en mode diffusion.

---

## Integration player.init()

`PlayerInitInput` est enrichi :

```ts
type PlayerInitInput = {
  mountTarget: unknown
  compiledScene: CompiledScene
  resourceManifest?: ResourceManifest
  runtimePolicy?: RuntimeEventPolicy
  strapCollection?: StrapCollection
  mode?: 'author' | 'broadcast'         // defaut: 'broadcast'
  preloadPolicy?: {
    releaseOnSequenceEnd?: boolean         // defaut: false
    timeout?: number                       // ms par ressource, defaut: 10000
  }
}
```

Sequence dans `player.init()` :

1. Resoudre le manifeste : `resourceManifest ?? compiledScene.resources`
2. Appeler `preload.load({ manifest, options: { mode, timeout } })`
3. Appliquer le comportement selon le mode (voir section Modes)
4. Apres `sequence:end` : si `releaseOnSequenceEnd: true`, appeler `preload.release(manifest.entries.map(e => e.url))`

Le preload est execute avant le montage runtime. Aucun composant n'est instancie tant que `preload.load()` n'a pas resolu.

---

## Production du ResourceManifest par le Builder

Le Builder extrait automatiquement les URLs des persos et les compile dans le `ResourceManifest`.

Sources scannees :
- `perso.initial.src` sur les persos de type `img` et `media`
- `actions[name].src` sur tous les persos

Inference du type par extension :

| Extensions | Type manifeste |
|---|---|
| `.mp4 .webm .ogv` | `video` |
| `.mp3 .wav .ogg .aac` | `audio` |
| `.png .jpg .jpeg .webp .gif .svg .avif` | `image` |
| `.woff .woff2 .ttf .otf` | `font` |
| `.css` | `css` |

Policy par defaut appliquee si aucune policy n'est declaree manuellement :

```ts
{ cache: 'default', priority: 'normal' }
```

Une URL deja presente dans un `ResourceManifest` fourni manuellement par l'auteur conserve sa policy explicite. Le Builder ne l'ecrase pas.

Le Builder deduplique les URLs : une URL presente plusieurs fois dans la scene produit une seule entree manifeste.

---

## Release apres sequence:end

En mode diffusion, la memoire occupee par les ressources preloadees peut etre liberee apres la fin de sequence.

Comportement quand `preloadPolicy.releaseOnSequenceEnd: true` :
- le player appelle `preload.release(urls)` sur l'ensemble des URLs du manifeste actif lors de la reception de `sequence:end`
- les entrees sont retirees du cache
- un nouveau `player.init()` sur la meme scene re-fetche les ressources

Ce flag est `false` par defaut. Il est active explicitement par l'integrateur en mode diffusion quand la liberation memoire apres sequence est souhaitee.

Il ne s'applique pas en mode auteur : l'auteur peut relancer la scene sans attendre de re-fetch.

---

## Seek et reconstruction DOM

Le seek ne recrée pas le DOM. Les composants `<img>` et `<video>` restent actifs pendant toute la session de seek. Le module preload n'intervient pas pendant le seek.

Si un reset complet de scene (`stop` + nouveau `player.init()`) survient sans eviction de cache, les ressources sont disponibles immediatement depuis le cache de session. Aucun re-fetch n'a lieu.

---

## cancel()

`preload.cancel()` arrete tous les chargements en cours et invalide le resultat courant. Les entrees en cours passent en `error`. Les entrees deja resolues (`ready`) ne sont pas affectees.

Cas d'usage : abandon de sequence avant demarrage en contexte auteur.

---

## Regles V1

- le preload est un module separe du Builder
- le preload consomme uniquement le `ResourceManifest`
- la policy de cache/version/hash est lue depuis chaque entree de manifeste
- tout perso `master: true` : le preload verifie la disponibilite de la ressource avant activation runtime ; si indisponible, warning emis et le player revient sur horloge ticker
- le signal de readiness pour `audio` et `video` est `canplaythrough` ; `onerror` ou timeout produisent un echec
- le cache de session est un singleton decoupled du cycle player
- `release()` est le seul mecanisme de vidage de cache explicite
- en mode auteur, une ressource manquante bloque `player.init()`
- en mode broadcast, une ressource manquante produit un warning et ne bloque pas

---

## Notes

- V1 ne couvre pas les stratégies de retry sur echec reseau
- le detail de la gestion des erreurs par type sera ajuste apres premiers tests reels d'environnement
- les ressources de type `json` et `js` (Lottie, Three.js, Rive) sont hors perimetre V1 ; leur cas sera traite dans une extension V1.x
- la gestion des ressources dans les composants (blob URL vs cache navigateur natif) reste transparente pour le module preload en V1
