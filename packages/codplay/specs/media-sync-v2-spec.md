# CodPlay V2 — synchronisation des médias natifs

## Périmètre vérifié

Cette spécification décrit les comportements de synchronisation native
couverts par les tests ciblés. Le service de préparation des ressources et le
transfert des nœuds média préchargés sont décrits dans la
[spécification preload](./preload-v2-spec.md). Les validations navigateur et
les décisions encore non appliquées restent dans le
[plan média](../plan/media-preload-plan.md).

## Horloge et master

Le module `media-sync` appartient au player et peut résoudre l'horloge logique
depuis un média master actif. Si ce master est en pause, le ticker du player
fournit l'horloge. Quand un autre master devient actif, le précédent est mis en
pause avant le démarrage du nouveau.

L'ajout d'une diffusion pendant qu'un master joue ne repositionne pas ce
master. Une présentation temporelle transmet la progression d'une transition
`broadcast` au composant média par le service existant.

## Seek et lecture

- Avant la reconstruction d'un seek, le service met en pause les médias natifs
  actifs. La présentation qui suit repositionne les nœuds média persistants.
- Un média non master avec sa propre timeline native n'est pas repositionné à
  chaque frame ordinaire de lecture.
- Lorsqu'un média natif est terminé, le service le stoppe à sa durée disponible
  sans tenter de le relancer à chaque présentation.
- Un retour de la timeline à son instant initial rejoue une diffusion active.
  Un seek derrière la fin d'un média repositionne également cette diffusion à
  l'instant visé.
- Le rate du player est transmis à chaque composant média suivi par le module.

Ces comportements ne spécifient pas de correction de dérive, de fenêtre
`startAt/endAt` complète ni de sémantique autonome pour chaque type de message
`START`, `PAUSE` et `STOP` : ces cas ne sont pas couverts par la suite dédiée.

## Persistance de la représentation native

Le composant HTML garde une node par source média déclarée. Une node détachée
reste réutilisable lors d'un seek ; changer de source sélectionne la node de
cette source sans recréer les autres. La destruction finale du runner retire le
perso matérialisé et ses nodes.

Chaque node vidéo créée par le composant fixe `preload='auto'` avant sa première
affectation de `src`. Cela inclut la node propre à un composant qui partage une
URL avec un autre composant ayant déjà adopté l'unique node remise par le
handle de preload. Les deux composants gardent ainsi leurs propres nœuds
persistants et préparent chacun leurs sources statiques avant un changement.

## Preuves

- [`media-sync-module.spec.ts`](../tests/runtime/capabilities/media-sync-module.spec.ts)
  couvre l'horloge master, son remplacement, le fallback ticker, le seek, les
  broadcasts, la fin native, le rate et la transition.
- [`player-runner.spec.ts`](../tests/runtime/runner-html/player-runner.spec.ts)
  couvre la persistance des nodes par source, le détachement, le seek, la
  destruction, le type audio, la transmission du rate et deux composants qui
  partagent une URL vidéo et gardent chacun une node `preload='auto'`.
- [`preload-media-demo.spec.ts`](../tests/runtime/components/preload-media-demo.spec.ts)
  couvre la lecture de la scène média par le runtime V2 et l'absence d'écriture
  native redondante pendant sa présentation.

Après la correction de préparation des sources vidéo, les sept suites runner,
preload média, media-sync, replace-module, surface de présentation, handoff
vidéo et handoff façade passent : **53 tests**. Les typechecks CodPlay et démos
V2 passent également ; le build Vite des démos passe avec son avertissement de
chunks supérieurs à 500 kB.

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/capabilities/media-sync-module.spec.ts \
  tests/runtime/runner-html/player-runner.spec.ts \
  tests/runtime/components/preload-media-demo.spec.ts
3 fichiers, 29 tests réussis
```
