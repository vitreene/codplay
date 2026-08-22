# CodPlay V2 — média et preload

> Status: En cours
> CodPlay version: V2 foundation

État de la tranche : le service `preload` externalisé est implémenté et testé.
La synchronisation média (`media-sync`) reste une sous-tranche distincte à
implémenter ; elle ne doit pas être ajoutée au service de preload ni au chemin
`init()`.

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

## Cache partagé

Le cache est possédé par l'engine ou fourni par l'hôte. Une entrée en cours de
chargement est partagée entre les appelants. Les références sont comptées par
instance de `RuntimePreload`; `release()` ne retire une entrée que lorsque plus
aucun appelant ne la détient. `cancel()` ne coupe pas un chargement encore détenu
par un autre appelant.

## Média

Le composant `media` conserve une node par `src`, comme en V1. Le module de
synchronisation média est player-scoped :

- `START`, `PAUSE` et `STOP` proviennent des actions compilées du perso ;
- un seul media `master` actif fournit éventuellement l'horloge de référence ;
- lecture, pause, seek et correction de dérive passent par les composants média ;
- le seek conserve les nodes et reconstruit leur position sans recharger la source ;
- le teardown final arrête et libère les composants, jamais un seek.

Les composants hybrides et les types tiers enregistrent leur stratégie dans la
même infrastructure `RuntimePreload`; ils ne créent pas d'API de chargement
propriétaire.

## Critères de sortie

- API preload autonome utilisable avec un manifeste ou un tableau de manifestes ;
- cache partagé avec comptage de références et stratégies natives/tiers ;
- façade `run` de diffusion autonome ;
- synchronisation média V2 couverte par tests de master, dérive, pause, seek et
  persistance `node-per-src` (sous-tranche encore ouverte) ;
- README des modules et plan général mis à jour ;
- aucune modification du core V1 `packages/codplay`.
