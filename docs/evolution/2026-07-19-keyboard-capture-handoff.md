# Reprise Capture Clavier

## Demande

Rendre le maintien clavier fonctionnellement equivalent a une capture pointeur
pour la tourelle de `space-bubbles`.

Le resultat attendu est un mouvement continu pendant le maintien de la touche,
sans enregistrer les evenements intermediaires de mouvement. Les seuls events
materialises doivent etre le `keydown` initial et le `keyup` terminal.

## Contraintes Confirmees

- Les declarations clavier appartiennent a `perso.emit` et utilisent `keyCode`,
  compare a `KeyboardEvent.code`.
- Une capture appartient au cycle de vie du perso et de l'action qui la
  declarent.
- La capture pointeur reste pilotee par son flux continu natif (`pointermove`).
- Le clavier ne fournit aucune valeur continue entre `keydown` et `keyup` ; son
  echantillonnage continu doit utiliser uniquement le `_tick` existant de
  CodPlay.
- `requestAnimationFrame` est strictement interdit hors du `_tick` CodPlay.
- La livraison continue d'une capture ne doit pas utiliser le cycle normal des
  `StoryEvent`, les tracks, la trace, les helpers de planification, ni un flux
  d'events masque.
- Le code doit cibler des persos et des actions auteur, jamais des nodes runtime.
  Un acces direct comme `context.api.setNodePose(...)` est interdit.
- Cette demo est normative. Ne pas introduire de raccourci ou de comportement
  runtime specifique a la demo qui contourne le modele auteur CodPlay.

## Fait Core Existant

`PlayerFacade.subscribeJitTick()` existait avant ce travail.

Il est actuellement utilise uniquement par `Player` :

- `Player.play()` et `Player.resume()` font avancer `scheduleRuntime`.
- `Player.createStrapHelpers()` fait avancer les schedulers de
  `context.live.*`.

Il est appele depuis le tick unique du player dans
`packages/codplay/src/player/create-player.ts`.

## Implementations Rejetees

### Events clavier synthetiques a chaque tick

La premiere tentative introduisait une session `keyCapture` distincte qui
emettait un event runtime a chaque tick player. Elle est rejetee car elle
recree le flux d'events que la capture doit justement eviter et route l'input
continu dans la mecanique timeline/event.

### Auto-repeat clavier natif

La tentative suivante relayait les `keydown` repetes. Elle est rejetee car
l'auto-repeat comprend un delai initial et produit des impulsions discontinues
plutot qu'une mesure de la duree de maintien.

### Ecriture directe de pose node

La derniere tentative ajoutait `context.api.setNodePose("space-turret", ...)`
et un callback live de capture. Elle est rejetee car un strap doit cibler des
persos et des actions auteur, jamais des nodes renderer. Le callback live
restait egalement un canal implicite de type event plutot qu'une primitive de
premier rang.

## Direction Normative Convenue

Creer dans le player un canal de capture de premier rang, distinct de
`StoryEvent`.

1. Une action `emit` demarre une session de capture et en possede le cycle de
   vie.
2. La session recoit les deltas de `_tick` via le tick player existant.
3. Chaque tick produit une `CaptureValue` typee pour un handler de capture
   declare.
4. Un handler de capture ne peut pas emettre d'events, planifier de helper,
   materialiser de track ou acceder aux nodes runtime.
5. Un handler de capture peut retourner uniquement :
   - une mise a jour d'etat live ;
   - une commande ciblant une action auteur par `persoId` et `actionName`, avec
     ses donnees d'action.
6. Le player resout cette commande via le renderer et le `persoId`. Il ne doit
   jamais exposer une API DOM node.
7. `keyup` termine la capture et est le seul event terminal persiste ; `snapAt`
   conserve les semantiques temporelles de la capture pointeur.

La declaration publique exacte et les types de handler ne sont pas encore
convenus. Ils doivent etre concus avant de remplacer l'implementation actuelle.

## Avertissement Worktree

Le worktree contient actuellement des changements experimentaux de capture
clavier, notamment l'API de pose directe rejetee et le routage live de capture.
Ne pas traiter ces changements comme une conception acceptee. Les supprimer
dans la prochaine implementation agreee, sans chercher a les conserver pour
compatibilite.

## Fichiers Pertinents

- `packages/codplay/src/runtime/capture-session.ts`
- `packages/codplay/src/runtime/types.ts`
- `packages/codplay/src/runtime/create-element.ts`
- `packages/codplay/src/player/create-player.ts`
- `packages/codplay/src/player/player.ts`
- `packages/codplay/src/player/strap-types.ts`
- `packages/codplay/src/renderer/create-renderer.ts`
- `packages/codplay/src/runtime/components/lib/dom.ts`
- `packages/codplay/src/runtime/components/lib/dom-component-adapter.ts`
- `packages/demos/src/scenes/space-bubbles/space-bubbles-scene.ts`
- `packages/demos/src/scenes/space-bubbles/space-bubbles-straps.ts`
- `packages/codplay/tests/lot20/capture-session.spec.ts`
