# CodPlay V2 — média et preload

> Status: En cours — socle media/preload implémenté, validation de tranche en cours
> CodPlay version: V2 foundation

État de la tranche : le service `preload` externalisé et le socle de
la synchronisation `media-sync` sont implémentés. La correction de dérive
reste volontairement reportée à la fin. Les deux capacités restent distinctes.
Le preload ne doit pas être ajouté au service de synchronisation ni rendu
implicite dans le chemin synchrone `init()`.

## Autorité

Cette tranche transpose le contrat V1 de preload et de synchronisation média dans
les frontières V2. Les références normatives sont :

- [`docs/formalisation/v1-preload-api.md`](../../../docs/formalisation/v1-preload-api.md) ;
- [`docs/formalisation/v1-perso-spec.md`](../../../docs/formalisation/v1-perso-spec.md),
  sections `4ter`, `7` et `7bis` ;
- [`docs/formalisation/v1-third-party-runtime-spec.md`](../../../docs/formalisation/v1-third-party-runtime-spec.md) ;
- [`packages/codplay/plan/notes/2026-07-28-decoupage-engine-instances-pilotage.md`](./notes/2026-07-28-decoupage-engine-instances-pilotage.md),
  pour la propriété du cache partagé.

## Frontière retenue

`preload` est une capacité externalisée et distincte. Il consomme un manifeste fourni par
l'appelant et ne connaît ni le scénario Sighty, ni l'éditeur, ni la décision de
transition entre scènes. Le contrat reste réutilisable par de futurs hôtes ; la
présente reprise ne raccorde que l'éditeur.

```text
manifeste(s) fourni(s) par l'éditeur / diffusion
  -> RuntimePreload.load()
  -> cache partagé + stratégie de type
```

Le manifeste peut être fourni seul ou sous forme d'un tableau de manifestes. Les
entrées sont fusionnées et dédupliquées par URL avant le chargement.

La diffusion autonome dispose d'une façade `run` qui enchaîne explicitement :

```text
preload.load(manifest) -> player.init() -> player.play()
```

`RuntimePlayer.init()` et `HtmlPlayerRunner.init()` restent synchrones et ne
déclenchent jamais un preload implicite. L'éditeur peut donc précharger ses
prochains manifestes sans créer un second loader, puis
enregistrer les URLs disponibles dans leur engine avant d'initialiser ou
remplacer leurs instances. La façade `run` n'est qu'un raccourci de diffusion
autonome ; elle ne redéfinit pas le contrat de `RuntimePreload`.

### Accès public final

La façade CodPlay expose le service sans le rattacher à une instance de scène :

```ts
const codplay = new CodPlay({ preload: options })
codplay.preload: RuntimePreloadApi
```

`RuntimePreloadApi` est la forme publique unique :

```ts
type CodPlayPreloadOptions = Readonly<{
  cache?: RuntimePreloadCacheApi
  strategies?: Readonly<Record<string, RuntimePreloadStrategy>>
}>

type RuntimePreloadApi = {
  readonly css: RuntimePreloadCssApi
  readonly state: RuntimePreloadState
  load(input: {
    manifest: RuntimePreloadManifestInput
    options?: RuntimePreloadOptions
  }): Promise<RuntimePreloadResult>
  cancel(): void
  release(urls: readonly string[]): void
  registerStrategy(type: string, strategy: RuntimePreloadStrategy): void
}
```

`new CodPlay(options)` ne crée pas de singleton global. Le cache est fourni par
l'hôte ou créé pour le service de l'instance `CodPlay`, puis partagé explicitement si besoin.
Il n'existe ni `instance.preload()` ni preload implicite dans `init()`.

### Canal CSS généré par l'éditeur — feature V2 validée le 2026-08-30

Le contrat URL de `preload.load()` reste adapté aux ressources qui doivent être
chargées depuis l'extérieur. Il ne couvre pas la feuille `styleSheet` produite
en mémoire par le builder de l'éditeur, dont le contenu peut changer à chaque commit.
L'ouverture d'un canal CSS direct est donc une **feature V2**, et non un
correctif : l'API existante ne promet ni source CSS inline, ni remplacement de
slot.

La façade expose un canal dédié, sans dupliquer la logique de portée et de
nettoyage dans le bridge éditeur :

```ts
type RuntimePreloadCssSetInput = Readonly<{
  /** Identifiant stable du slot, distinct de toute URL de ressource. */
  slot: string
  /** CSS généré par le builder, déjà résolu et prêt à être projeté. */
  cssText: string
  /** Conteneur éditeur auquel la feuille doit être limitée. */
  container: Element
}>

type RuntimePreloadCssApi = Readonly<{
  /** Remplace le slot de façon synchrone et rend la feuille disponible avant le montage. */
  set(input: RuntimePreloadCssSetInput): void
  /** Retire un slot ; sans argument, retire tous les slots du service. */
  clear(slot?: string): void
}>

type RuntimePreloadApi = Readonly<{
  css: RuntimePreloadCssApi
  // load, cancel, release, registerStrategy...
}>
```

Le canal CSS possède ses propres règles :

- `set()` remplace le contenu du même slot au lieu de créer une nouvelle URL,
  un nouveau `<style>` permanent ou une entrée du cache média ;
- la portée est appliquée au `container` fourni et la mise à jour est
  synchrone du point de vue du bridge ;
- `clear(slot)` ne touche ni `CompiledScene`, ni `engine.resources`, ni les
  handles média ; `clear()` sans argument libère tous les slots du service ;
- plusieurs slots sont possibles pour l'éditeur : chaque scène montée possède
  un `slot` et un `container`, et `clear(slot)` ne retire jamais la feuille
  d'une autre scène ; le même contrat pourra être réutilisé ultérieurement par
  Sighty, hors périmètre de cette tranche ;
- `CodPlay.destroy()` libère les slots CSS possédés par son service preload ;
- `preload.load()` conserve son chemin URL pour les médias, images, fonts et
  CSS externe destinés à la diffusion ou à l'export.

Dans le chemin éditeur, le bridge compile d'abord la scène et précharge
uniquement les nouvelles ressources URL de contenu. Il applique ensuite `styleSheet`
dans le slot CSS avant de créer ou remplacer l'instance. Un échec ne publie pas
la nouvelle instance ; le bridge conserve ou restaure le slot et l'instance
précédents. Le canal CSS ne change donc pas la sémantique du preload média et
ne demande aucune intervention au materializer.

L'API `preload.css` est implémentée dans le service V2 et couverte par les tests
de slots, d'isolement entre conteneurs, de remplacement sans accumulation et de
nettoyage par `CodPlay.destroy()`. Le bridge de l'éditeur reste à raccorder dans
la tranche d'intégration prévue. Sighty n'est pas raccordé et n'est pas simulé
par ce service.

## Cache partagé

Le cache est possédé par l'engine ou fourni par l'hôte. Une entrée en cours de
chargement est partagée entre les appelants. Les références sont comptées par
instance de `RuntimePreload`; `release()` ne retire une entrée que lorsque plus
aucun appelant ne la détient. `cancel()` ne coupe pas un chargement encore détenu
par un autre appelant.

### Transfert d'un nœud média prêt

La solution retenue pour l'aperçu vidéo avant `play()` est le transfert du nœud
préchargé, et non la seule conservation de ses métadonnées :

- les stratégies natives `audio` et `video` conservent leur nœud prêt et
  renvoient un handle opaque séparé de `metadata` ;
- `resources.register()` transfère ce handle à l'engine avec le résultat du
  preload ;
- `MediaComponent` adopte le handle correspondant à la source, conserve ce
  même nœud pour sa partie native et ne réassigne ni `src` ni `load()` ;
- l'adoption retire uniquement les styles de masquage propres au preload avant
  l'application de la présentation auteur ;
- un handle n'est adopté qu'une fois, car un nœud DOM ne peut pas appartenir à
  plusieurs composants. Un composant qui ne peut pas adopter un handle conserve
  le comportement existant de création de son propre nœud persistant ;
- le cache, l'engine et le composant détiennent chacun leur référence ; un
  handle non adopté est donc libéré par l'éviction du cache, tandis qu'un handle
  adopté reste vivant jusqu'à la destruction finale du player.

Le transfert ne modifie pas `media-sync` : `play`, `pause`, `seek` et les
transitions continuent d'emprunter la surface du composant et s'appliquent au
nœud adopté comme à tout nœud média persistant.

## Synchronisation média

Le composant `media` conserve une node native par `src` statique. Le module de
synchronisation média est player-scoped :

- `START`, `PAUSE` et `STOP` proviennent des actions compilées du perso ;
- `startAt/endAt` imposent la fenêtre de lecture effective et le clamp des
  positions ;
- `broadcast.transition` est évalué dans le même circuit de présentation que
  les autres actions et transmis au composant ;
- `initial.master: true` désigne une source candidate, sans créer une seconde
  catégorie de composant ;
- un seul media `master` actif fournit éventuellement l'horloge de référence et
  n'est jamais corrigé par la timeline pendant sa lecture ordinaire ;
- quand plusieurs candidats sont actifs, le dernier `START` appliqué est la
  référence ; le master précédent est mis en pause avant le nouveau ;
- si le master est absent, en pause, terminé ou indisponible, le ticker CodPlay
  reprend immédiatement ;
- un media à timeline native non-master avance avec sa propre horloge ; il ne
  reçoit pas un `seek` à chaque frame ;
- une synchronisation de position est idempotente : le composant n'écrit pas
  `currentTime` lorsque la position native est déjà à moins de 40 ms de la
  cible ; un repositionnement réel reste appliqué ;
- `setRate` atteint le player, le module `media-sync` et les nodes natives ;
- la durée effective est issue des métadonnées du preload ; elle ne dépend pas
  de la disponibilité tardive de `HTMLMediaElement.duration` ;
- les médias déjà pilotés par le ticker restent dans le circuit normal ;
- avant un seek, les médias natifs actifs sont mis en pause, puis la
  reconstruction repositionne les nodes persistantes et reprend éventuellement
  la lecture ;
- le seek conserve les nodes et reconstruit leur position sans recharger la source ;
- un seek arrière rejoue les broadcasts actifs après une fin native, afin de
  repositionner le master au nouvel instant ;
- le teardown final arrête et libère les composants, jamais un seek.

### Profil auteur et part native

Le profil `media` conserve la séparation V1 entre la racine du perso et sa
partie média native :

- `initial.className`, `initial.style` et `initial.attr` ciblent le wrapper du
  perso ;
- `initial.video.className`, `initial.video.style` et `initial.video.attr`
  ciblent la node native `video` ou `audio` conservée par le composant ;
- une action `video` met à jour cette même partie native sans diffuser un
  second event ni demander à l'auteur de convertir les propriétés en styles
  de wrapper.

Le nom `video` est conservé pour cette partie interne, y compris lorsque la
source est résolue en `audio`, conformément au contrat V1. Le service `attr`
reste le même service V2 ; seule la cible de projection est choisie par le
composant.

La correction de dérive des médias natifs non-master est une optimisation finale.
Elle sera étudiée après validation de la lecture et du seek, avec des garde-fous
contre les faux écarts au lancement, à la pause et après un seek. Elle ne sera
jamais appliquée au master.

## Anomalie de validation ouverte

- [ ] Safari — aperçu vidéo avant `play()` dans la démo `preload-media`.
  La comparaison du layout avec journal actif et avec
  `v2.html?demo=preload-media&v2-log=off` ne reproduit plus le gel de lecture et
  ne permet pas de corréler ce défaut au journal. Le point restant est distinct :
  la scène ne déclare aucun `poster`, tandis que `loadRuntimeVideo()` supprimait
  le nœud temporaire après `canplaythrough` et ne retournait que des métadonnées.
  Le nœud visible neuf ne recevait donc pas de frame décodée avant `play()`. Le
  contrat V2 retenu est désormais le transfert et la réutilisation du nœud média
  prêt décrit ci-dessus. La vérification Safari doit confirmer que sa première
  frame reste visible après cette adoption, sans nouvel appel à `src`, `load()`
  ou `play()` au moment de la matérialisation.

Une seule implémentation relie cette règle au player :

- `media-sync-capability.ts` est le module player-scoped qui lit les actions
  compilées `broadcast` et appelle la surface du composant materialisé.

La fixture V2 `packages/demos/src/v2/demos/preload-media/` transpose la scène
V1 et passe par le layout commun, le manifeste dérivé du `SceneBuilder` et
`codplay.preload`. Sa vérification Safari reste ouverte tant que l'écran noir
n'est pas reproduit dans un navigateur réel.

Les composants hybrides et les types tiers enregistrent leur stratégie dans la
même infrastructure `RuntimePreload`; ils ne créent pas d'API de chargement
propriétaire.

## Critères de sortie

- API preload autonome utilisable avec un manifeste ou un tableau de manifestes ;
- cache partagé avec comptage de références et stratégies natives/tiers ;
- transfert du nœud média prêt jusqu'au composant, avec adoption et destruction
  couvertes par le chemin de ressources ;
- façade `run` de diffusion autonome ;
- socle de synchronisation média V2 couvert par tests de master, fallback
  ticker, absence de seek par frame, pause avant seek et seek ;
- démo V2 `player` non retenue dans le registre ; le preload reste validé par
  son API et ses tests runtime, indépendamment d'une démo média ;
- README des modules et plan général mis à jour ;
- aucune modification du core V1 `packages/codplay`.

## Preuves

- `tests/runtime/capabilities/media-sync-module.spec.ts` : horloge master,
  arbitrage du master précédent, fallback ticker, absence de seek par frame,
  pause avant seek, resynchronisation après seek, transition et rate ;
- `tests/runtime/runner-html/player-runner.spec.ts` : persistance des nodes
  média par source, choix audio/vidéo et propagation du rate ;
- `tests/runtime/preload/runtime-preload.spec.ts` : métadonnées de durée
  transmises au résultat preload et libération d'un handoff non adopté ;
- `tests/runtime/preload/preload-video-handoff.spec.ts` : la stratégie vidéo
  conserve son nœud après `canplaythrough` et le remet à une lease d'adoption ;
- `tests/runtime/preload/preload-css-slot.spec.ts` : remplacement synchrone d'une
  feuille, isolement de deux scènes par slots et conteneurs, nettoyage ciblé ou
  global, et nettoyage automatique par `CodPlay.destroy()` ;
- `tests/facade/media-preload-handoff.spec.ts` : `resources.register()` transmet
  le nœud retenu au composant média d'une instance publique ;
- `tests/runtime/components/preload-media-demo.spec.ts` : le `START` de la
  scène appelle la lecture sans écriture native redondante de `currentTime` et
  les updates du composant vidéo ne réapparaissent pas pendant les événements
  d'image ;
- la démo V2 `player` n'est pas conservée ; la validation de l'API preload et
  de la synchronisation média reste portée par les tests runtime du plan.
