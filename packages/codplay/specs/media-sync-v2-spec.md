# CodPlay V2 — synchronisation des médias natifs

## Périmètre vérifié

Cette spécification décrit les comportements de synchronisation native
couverts par les tests ciblés. Le service de préparation des ressources et le
transfert des nœuds média préchargés sont décrits dans la
[spécification preload](./preload-v2-spec.md). Les validations navigateur et
les décisions encore non appliquées restent dans le
[plan média](../plan/media-preload-plan.md).

## Relation d’horloges

Le profil initial de `media` accepte `sync: 'auto' | 'master' | 'independent'`.
L’absence de valeur signifie `auto`. Le mode est une configuration initiale :
une action ne peut pas le changer. Le build refuse l’ancien champ `master`
et les valeurs de `sync` étrangères à ces trois modes. Le codec conserve la
déclaration initiale.

- `auto` soumet le média au temps CodPlay ; c’est le comportement par défaut.
- `master` fournit l’horloge qui conduit CodPlay.
- `independent` conserve le temps et les contrôles natifs du média ; aucune
  des deux horloges ne conduit l’autre.

Le module existant `media-sync` reste propriétaire de ces trois modes et des
commandes broadcast. Il ne crée pas de player, d’horloge ou de journal annexe.

## Horloge master

Le module `media-sync` appartient au player et peut résoudre l'horloge logique
depuis un média master actif. Si ce master est en pause, le ticker du player
fournit l'horloge. Quand un autre master devient actif, le précédent est mis en
pause avant le démarrage du nouveau.

L'ajout d'une diffusion pendant qu'un master joue ne repositionne pas ce
master. Une présentation temporelle transmet la progression d'une transition
`broadcast` au composant média par le service existant.

## Seek et lecture des modes `auto` et `master`

- Avant la reconstruction d'un seek, le service met en pause les médias natifs
  actifs. La présentation qui suit repositionne les nœuds média persistants.
- Un média non master avec sa propre timeline native n'est pas repositionné à
  chaque frame ordinaire de lecture.
- Lorsqu'un média natif est terminé, le service le stoppe à sa durée disponible
  sans tenter de le relancer à chaque présentation.
- Un retour de la timeline à son instant initial rejoue une diffusion active.
  Un seek derrière la fin d'un média repositionne également cette diffusion à
  l'instant visé.
- Le rate du player est transmis aux médias `auto` et `master`.

Ces comportements ne spécifient pas de correction de dérive ni de fenêtre
`startAt/endAt` complète.

## Commandes et lecture indépendante

Les commandes explicites restent `START`, `PAUSE` et `STOP`. Aucun alias
`PLAY` n’est introduit. `START` démarre à `startAt`, ou zéro par défaut.
`STOP` arrête et remet à zéro dans les trois modes ; il efface la fenêtre de
lecture précédente, même si son début était différent de zéro. La fin native
est distincte de cette commande explicite.

Pour `independent`, une nouvelle occurrence de commande s’applique une seule
fois lors de sa présentation normale. `PAUSE` suspend à la position native
courante. Les présentations suivantes ne relancent pas le média et ne
contrarient pas ses contrôles natifs.

La pause, le rate, la fin et la reconstruction du temps CodPlay par Seek ou
reset ne pilotent pas sa lecture native. La reconstruction ne rejoue pas les
commandes indépendantes. Une nouvelle commande explicite après reconstruction
reste applicable. La destruction du player arrête la lecture et libère la
représentation native. Une application qui masque une scène doit donc envoyer
sa propre commande de transport si elle souhaite arrêter son média indépendant.

## Persistance de la représentation native

Le composant HTML garde une node par source média déclarée. Une node détachée
reste réutilisable lors d'un seek ; changer de source sélectionne la node de
cette source sans recréer les autres. La destruction finale du runner retire le
perso matérialisé et ses nodes.

## Preuves

- [`media-sync.spec.ts`](../tests/scene/compiled/media-sync.spec.ts) vérifie le
  build et le codec des modes, le défaut, les valeurs invalides et le refus de
  l’ancien booléen et des changements de mode par action.
- [`media-sync.spec.ts`](../tests/facade/media-sync.spec.ts) exerce le player
  public, le journal et le runner HTML : lecture native, pause/rate/Seek/reset
  CodPlay, nouvelles commandes après reconstruction, `STOP` à zéro, identité
  du nœud et de sa source, puis destruction.

- [`media-sync-module.spec.ts`](../tests/runtime/capabilities/media-sync-module.spec.ts)
  couvre l'horloge master, son remplacement, le fallback ticker, le seek, les
  broadcasts, la fin native, le rate et la transition.
  Il couvre aussi les commandes indépendantes, leur non-répétition, le
  `STOP` des trois modes après un départ non nul, l’isolation et le teardown.
- [`player-runner.spec.ts`](../tests/runtime/runner-html/player-runner.spec.ts)
  couvre la persistance des nodes par source, le détachement, le seek, la
  destruction, le type audio et la transmission du rate.
- [`preload-media-demo.spec.ts`](../tests/runtime/components/preload-media-demo.spec.ts)
  couvre la lecture de la scène média par le runtime V2 et l'absence d'écriture
  native redondante pendant sa présentation.

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/capabilities/media-sync-module.spec.ts \
  tests/runtime/runner-html/player-runner.spec.ts \
  tests/runtime/components/preload-media-demo.spec.ts
3 fichiers, 29 tests réussis
```

Le 14 octobre 2026, les cinq suites ci-dessus passent : **49 tests**.
Typecheck CodPlay, Elcé, démos V2 et Sighty réussis ; build Elcé réussi.
La suite complète CodPlay compte 729 succès et 7 échecs reproduits à `HEAD`
avant modification : cinq assertions d’overlay motion et deux tests Sighty
sur `localStorage`. Ils ne certifient pas une régression média.

Safari MCP, le 14 octobre 2026, lit un MP4 produit pour la fixture avec
Canvas/MediaRecorder. `START` fait progresser le temps natif de 0 à 0,266 s ;
pause, rate ×2, Seek et reset CodPlay le laissent jouer à rate natif 1.
`PAUSE` fige sa position native, puis `STOP` après reprise donne `paused=true`
et `currentTime=0`, avec le même nœud. Cette preuve porte sur une vidéo
ordinaire ; elle ne ferme pas les gates de preload, de source directe ou de
fenêtre `endAt` du plan média.
