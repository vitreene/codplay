# Démo position

> Statut : En cours
> Version CodPlay : V2 foundation

Cette scène présente six vues de position dans un carousel `AutoCapsule` :

1. source, cible et reparenting d’un item ;
2. déplacement indépendant de la source et de la cible ;
3. capture d’un point médian, puis transport du path préparé dans `event.data` du move ;
4. ancres déplaçables et trajectoires recalculées pendant les rebonds ;
5. sources imbriquées avec un seul item ;
6. conclusion en réseau de trajectoires multiples, dans la continuité visuelle de `flip-stress`.

Une seule vue est visible à la fois. À chaque changement, l'outro coupe la vue
sortante à la frontière et l'intro `swipe-left` fait glisser la vue entrante.
La lecture de la timeline ne change pas de vue : le carousel avance ou recule
uniquement après une interaction de flèche (ou `Entrée`).
Les réglages de timing et de placement du carousel sont résolus par
`CapsulePreset`, `CapsuleDistribution` et `AutoCapsule`.

Le premier `move` est porté par un eventime de la story : il commence à `1 s`
et dure `2 s`. Tous les reparentings des items suivent cette même durée et
passent par un `move`. Pour les autres vues, le strap de navigation ajoute les
occurrences au track de la story. Chaque occurrence contient un `move` complet
dans `event.data`, car un eventime planifié n'est pas repassé dans `listen` au
moment où il devient actif.

## Organisation auteur

- `main.ts` assemble uniquement la `SceneDoc` ;
- `story.ts` assemble la story unique et son état ;
- `carousel.ts` contient le carousel et les contrôles communs ;
- `story-one.ts` à `story-six.ts` contiennent chacun une vue, ses persos et
  son plan de mouvement ;
- `story-animation.ts` distribue le plan de la vue active ;
- `straps.ts` relie le clavier, les captures et les plans aux événements de la
  story ;
- `constants.ts`, `types.ts` et `shared.ts` isolent respectivement les
  identifiants, les formes de données et les fonctions communes.

## Interactions

- `←` / `→` : vue précédente / suivante ;
- `Entrée` : vue suivante ;
- `Espace` : comportement de story arrêté / relancé par événements.

Le clavier émet des événements locaux à la scène, ensuite traités par
`listen` et les straps. Il ne pilote ni `telco`, ni l’horloge du player. Le
replay après Espace est lui aussi un événement de story ; `tween:stop` arrête
les tweens courants sans transformer cette démo en pause réelle du player.

La capture de la vue 3 conserve des coordonnées normalisées dans l’état de la
story. À sa conclusion, `captureState` est lu par un transform `listen`, le
path est préparé avec `prepareSvgPath`, puis transmis au move de l’item par
`event.data`. La vue 4 applique ce circuit au relâchement d’une ancre ; ses
rebonds planifiés sont des eventimes de mouvement complets. Les coordonnées
issues de `movementX/Y` restent exprimées en pixels jusqu'au style présenté ;
un relâchement déclenche en plus un rebond immédiat calculé par strap.

Les dessins de trajectoire sont volontairement hors du premier volet de
correction : cette étape valide les `move`, leurs destinations, leurs durées,
les reparentings et le circuit d'events.

La démo est enregistrée sous `?demo=position`. Elle reste `En cours` jusqu’à
la validation navigateur complète des transitions, captures, replay/seek,
resize et destruction dans le runner V2.
