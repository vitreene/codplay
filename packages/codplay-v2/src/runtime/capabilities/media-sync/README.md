# Synchronisation média V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

`media-sync` synchronise les composants `media` avec l'horloge du player. Il
est créé une fois par player et utilise les opérations publiques du composant
pour lancer, arrêter, positionner et faire évoluer un média.

Il ne précharge pas les ressources et ne lit pas directement le DOM. Le
preload prépare les métadonnées séparément ; `media-sync` ne reçoit que les
informations et les surfaces dont il a besoin.

## Fonctionnement

Les actions compilées `broadcast` acceptent `START`, `PAUSE` et `STOP`.
`startAt` et `endAt` définissent la fenêtre de lecture effective et toute
position appliquée reste dans cette fenêtre. Une transition peut interpoler les
propriétés déclarées par `from`, `to` et `duration`.

`initial.master: true` désigne un média candidat pour fournir l'horloge logique
de CodPlay. Ce n'est pas un nouveau type de composant. Lorsque plusieurs
candidats sont actifs, le dernier `START` appliqué est prioritaire. Si le master
devient indisponible, inactif, en pause ou terminé, le player revient à son
horloge de secours.

Un média non-master qui possède sa propre horloge native avance sans être
repositionné à chaque frame. Les médias déjà pilotés par l'horloge de secours
restent dans leur circuit normal.

Avant un seek, les médias actifs sont mis en pause. La scène est reconstruite,
les positions sont appliquées et la lecture reprend si nécessaire. Le seek ne
détruit ni ne recharge les nœuds média ; un seek arrière rejoue les broadcasts
actifs, même après la fin native du média.

## Organisation interne

La façade `media-sync-capability.ts` lit les actions de la scène résolue et
demande la surface `media` au `RuntimeComponentSurfaceResolver`. Elle ne reçoit
jamais la classe concrète du composant et n'utilise pas d'inspection dynamique
de ses méthodes.

Ses sous-modules sont spécialisés :

- `media-sync-state.ts` initialise et conserve l'état logique par média ;
- `media-sync-broadcasts.ts` lit, ordonne et identifie les occurrences ;
- `media-sync-playback.ts` applique fenêtres, transitions, resets et
  synchronisations ;
- `media-sync-types.ts` décrit les contrats internes.

## Contrat et limites

- la durée de fin d'un média vient des métadonnées du preload, pas de
  `HTMLMediaElement.duration` ;
- `setRate(rate)` est propagé au composant et à ses nœuds natifs ;
- le master reste la source de l'horloge et n'est pas corrigé par le ticker à
  chaque frame ;
- les nœuds média sont libérés uniquement lors de la destruction finale du
  player ;
- la correction de dérive en lecture continue est une optimisation ultérieure
  et ne concernera que les médias non-master ;
- `HtmlPlayerRunner.run()` enchaîne explicitement preload, init et play, mais
  `media-sync` n'en dépend pas par un circuit implicite.

## Vérification

- `tests/runtime/capabilities/media-sync-module.spec.ts` couvre le master, son
  arbitrage, l'horloge de secours, le seek, les transitions et le rate ;
- `tests/runtime/runner-html/player-runner.spec.ts` couvre les nœuds persistants
  par source, le choix audio/vidéo et le rate natif ;
- `tests/runtime/preload/runtime-preload.spec.ts` couvre la propagation des
  métadonnées de durée ;
- `packages/codplay-v2/tests/runtime/capabilities/media-sync-module.spec.ts`
  valide le circuit média sans dépendre d'une démo.

La validation visuelle Safari reste ouverte à cause d'un écran noir signalé
pendant la lecture vidéo.
