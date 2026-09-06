# Démo position

> Statut : En cours
> Version CodPlay : V2 foundation

Cette scène présente une story `main` qui porte le shell du carousel et six
`StoryDoc` de position, une story par étape :

1. source, cible et reparenting d’un item ;
2. déplacement indépendant de la source et de la cible ;
3. capture d’un point médian, puis transport du path préparé dans `event.data` du move ;
4. ancres déplaçables et trajectoires recalculées pendant les rebonds ;
5. sources imbriquées avec un seul item, rails verticaux et conteneurs intérieurs qui oscillent horizontalement pendant 20 cycles de 4 s, par classes flex appuyées par un `move` local, sans reparenting des conteneurs ;
6. conclusion qui reprend fidèlement la mécanique `flip-stress` : quatre
   conteneurs A–D à fonds distincts, deux cadres Q/K colorés, deux listes sans
   clipping et douze échanges sans chevauchement d’items.

Une seule vue est visible à la fois. À chaque changement, l'outro coupe la vue
sortante à la frontière et l'intro `swipe-left` fait glisser la vue entrante.
La lecture de la timeline ne change pas de vue : le carousel avance ou recule
uniquement après une interaction de flèche (ou `Entrée`).
Les réglages de timing et de placement du carousel sont résolus par
`CapsulePreset`, `CapsuleDistribution` et `AutoCapsule`.

Le premier `move` est porté par l’eventime de `position-story-one` : il
commence à `1 s` et dure `2 s`. Pour les autres stories, le strap de navigation
ajoute au track les eventimes correspondant à la story activée. Les actions
des persos portent les `move` déclarés ; `event.data` n’est utilisé que par les
stories qui doivent transporter un calcul capturé.
Chaque plan se termine par l’eventime local `position:demo:story:end`, placé
au terme de sa dernière transition. C’est un repère d’horizon ordinaire : il
stabilise le seek après un retour en arrière, sans arrêter le player et sans
remplacer `sequence:end`.

## Organisation auteur

- `main.ts` assemble uniquement la `SceneDoc` ;
- `main.ts` déclare aussi la story `main`, limitée au shell et au clavier ;
- `carousel.ts` contient le carousel et les contrôles communs ;
- `story-one.ts` à `story-six.ts` contiennent chacun un `StoryDoc`, ses persos,
  ses actions et, lorsque nécessaire, son circuit `listen` / `straps` ;
- `story-animation.ts` distribue le plan de la vue active ;
- `straps.ts` relie uniquement le clavier et la navigation globale aux
  événements de la scène ;
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
`event.data`. La vue 4 applique le capture aux ancres source et cible ; ses
20 rebonds sont des eventimes de mouvement complets produits par
`planned.repeat({ eachMs, times: 20 })`. Les coordonnées
issues de `movementX/Y` restent exprimées en pixels jusqu'au style présenté ;
un relâchement journalisé déclenche une recapture unique de la géométrie
courante, comme `resize()`. Les rebonds utilisent un easing linéaire afin que
l'item reparte immédiatement au changement de cible, sans arrêt perceptible.

La story 6 reprend les timings de `flip-stress` : déplacement des conteneurs sur
`9,35 s` et `8,15 s`, transfert des cadres sur `7,275 s`, puis douze échanges
espacés de `500 ms`, chacun sur `875 ms`. Les deux cadres et les douze items
utilisent des `move` réels ; aucune trajectoire SVG décorative ne les remplace.

La démo est enregistrée sous `?demo=position`. Elle reste `En cours` jusqu’à
la validation navigateur complète des transitions, captures, replay/seek,
resize et destruction dans le runner V2.
