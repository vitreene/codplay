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
- [`packages/codplay-v2/plan/notes/2026-07-28-decoupage-engine-instances-pilotage.md`](./notes/2026-07-28-decoupage-engine-instances-pilotage.md),
  pour la propriété du cache partagé.

## Frontière retenue

`preload` est une capacité externalisée et distincte. Il consomme un manifeste fourni par
l'appelant et ne connaît ni le scénario Sighty, ni l'éditeur, ni la décision de
transition entre scènes.

```text
manifeste(s) fourni(s) par Sighty / editor / diffusion
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
déclenchent jamais un preload implicite. Sighty et l'éditeur peuvent donc
précharger leurs prochains manifestes sans créer un second loader, puis
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

## Cache partagé

Le cache est possédé par l'engine ou fourni par l'hôte. Une entrée en cours de
chargement est partagée entre les appelants. Les références sont comptées par
instance de `RuntimePreload`; `release()` ne retire une entrée que lorsque plus
aucun appelant ne la détient. `cancel()` ne coupe pas un chargement encore détenu
par un autre appelant.

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

La correction de dérive des médias natifs non-master est une optimisation finale.
Elle sera étudiée après validation de la lecture et du seek, avec des garde-fous
contre les faux écarts au lancement, à la pause et après un seek. Elle ne sera
jamais appliquée au master.

## Anomalie de validation ouverte

- [ ] Safari — écran noir de la vidéo pendant la lecture de la démo
  `preload-media`. Le transport peut progresser et les contrôles natifs peuvent
  indiquer que la vidéo est en lecture alors que sa surface reste noire. La
  cause n'est pas déterminée : ce point doit être reproduit et analysé à partir
  du résultat de `play()`, des événements `playing`/`error`, de `readyState`,
  de `currentTime`, des dimensions vidéo et du rendu effectivement produit.
  Ne pas attribuer cette anomalie à `preload` ou à une question de structure DOM
  sans nouvelle preuve.

Une seule implémentation relie cette règle au player :

- `media-sync-capability.ts` est le module player-scoped qui lit les actions
  compilées `broadcast` et appelle la surface du composant materialisé.

Les composants hybrides et les types tiers enregistrent leur stratégie dans la
même infrastructure `RuntimePreload`; ils ne créent pas d'API de chargement
propriétaire.

## Critères de sortie

- API preload autonome utilisable avec un manifeste ou un tableau de manifestes ;
- cache partagé avec comptage de références et stratégies natives/tiers ;
- façade `run` de diffusion autonome ;
- socle de synchronisation média V2 couvert par tests de master, fallback
  ticker, absence de seek par frame, pause avant seek et seek ;
- démo `packages/demos/src/v2/demos/player` remplacée par l'adaptation V2 `preload-media`,
  avec manifeste explicite, telco de validation et master audio ;
- README des modules et plan général mis à jour ;
- aucune modification du core V1 `packages/codplay`.

## Preuves

- `tests/runtime/capabilities/media-sync-module.spec.ts` : horloge master,
  arbitrage du master précédent, fallback ticker, absence de seek par frame,
  pause avant seek, resynchronisation après seek, transition et rate ;
- `tests/runtime/runner-html/player-runner.spec.ts` : persistance des nodes
  média par source, choix audio/vidéo et propagation du rate ;
- `tests/runtime/preload/runtime-preload.spec.ts` : métadonnées de durée
  transmises au résultat preload ;
- `packages/demos/src/v2/demos/player` : preload externe puis `init()` ; la lecture est
  déclenchée par le bouton de la telco, pour rester compatible avec l'autoplay
  média des navigateurs. Une vérification Safari a couvert la scène montée,
  la lecture déclenchée par `Lire`, le seek à 4500 ms et le seek arrière après
  la fin native du master ; la validation visuelle reste ouverte à cause de
  l'écran noir signalé.
