# Plan De Demo Space Bubbles

## Objectif

Creer une demo CodPlay inspiree de Space Invaders pour verifier si CodPlay peut supporter des jeux graphiques simples sans devenir un moteur de jeu.

Le jeu contient :

- une tourelle en bas de l'ecran ;
- quatre bulles colorees en mouvement dans le ciel ;
- des projectiles tires par la tourelle ;
- une suite de couleurs cible ;
- une mission visuelle composee de bulles numerotees dans l'ordre attendu ;
- une reussite si les quatre bulles sont detruites dans cet ordre ;
- un affichage du temps final ;
- un panneau final succes/echec avec le temps ;
- deux bonus aleatoires : `picker` et `maluser`.

## Positionnement CodPlay

La demo doit respecter le modele natif de CodPlay :

```txt
emit / eventime / track
  -> Director
  -> listen
  -> straps stateless
  -> events nommes
  -> actions de persos
  -> renderer
```

Le jeu ne doit pas etre implemente comme une simulation centrale basee sur `context.live.loop(...)`.

`loop` peut exister comme helper de planification d'events, mais il ne doit pas devenir le coeur du modele de jeu.

Le modele vise est evenementiel :

- les actions utilisateur emettent des events ;
- les straps decident les transitions d'etat ;
- les straps planifient des controles ou events futurs si necessaire ;
- les actions animent ou rendent les persos ;
- la logique de collision predit ou valide les consequences d'events.

## Strategie De Rendu

Utiliser une structure visuelle hybride :

- `layout` pour la structure racine et les regions ;
- SVG pour le monde de jeu et les trajectoires ;
- HTML pour le HUD, les boutons, l'aide et les panneaux de resultat ;
- `tag` pour creer indifferemment des noeuds HTML ou SVG.

Structure racine recommandee :

```html
<div class="space-bubbles-shell">
  <svg data-part="space-stage:world" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet"></svg>
  <div data-part="space-stage:hud"></div>
  <div data-part="space-stage:overlay"></div>
</div>
```

Les objets de gameplay vivent dans le monde SVG :

- bulles ;
- tourelle ;
- projectiles ;
- picker ;
- maluser ;
- effets optionnels : trainees, ligne de visee, flashs d'impact.

Les objets d'interface vivent en HTML :

- eventuellement bouton recommencer ;
- timer ;
- suite de couleurs cible sous forme de bulles de mission numerotees ;
- ordre de destruction courant ;
- etat accompli sur chaque bulle de mission validee ;
- resultat final succes/echec.

## Demarrage De Scene

La demo doit demarrer depuis le `play` de la telco, pas par un bouton interne obligatoire.

Au lancement de la lecture :

- un item `Go!` apparait pendant environ une seconde ;
- la scene de jeu apparait en transition fondue ;
- les controles deviennent actifs apres ou pendant cette intro selon le ressenti retenu ;
- le chrono de jeu demarre au moment defini par l'event `space:game:start`, a priori apres l'intro `Go!`.

Implementation recommandee :

- `story.eventimes` a `0ms` pour afficher `Go!` et lancer le fondu d'entree ;
- `story.eventimes` a `1000ms` pour masquer `Go!` et emettre `space:game:start` ;
- actions nommees pour `space:stage:fade-in`, `space:intro:go-show`, `space:intro:go-hide`.

Cela respecte le modele CodPlay : l'intro est une sequence d'events/actions, pas une logique imperativement lancee par un timer applicatif.

## Repere Logique

Utiliser un monde logique stable, independant des pixels et de la taille du viewport :

```ts
const WORLD = {
  width: 1000,
  height: 1000,
}
```

Toutes les coordonnees de gameplay utilisent des unites monde, jamais des pixels DOM.

Le `viewBox="0 0 1000 1000"` du SVG rend ce monde naturellement responsive.

La logique ne doit pas utiliser `getBoundingClientRect()` pour decider des collisions.

Les coordonnees pointer/touch, si necessaires, doivent etre converties en coordonnees monde avant d'atteindre la logique de gameplay.

## Modele Des Bulles

Separer l'etat logique de la bulle de son rendu visuel.

Etat logique :

```ts
type Bubble = {
  id: string
  color: string
  level: 3 | 2 | 1 | 0
  alive: boolean
  hitRadius: number
  orbit: BubbleOrbit
}
```

Le rendu peut evoluer independamment :

- v1 : cercles SVG simples ou groupes SVG de base ;
- plus tard : SVG complexe avec gradients, reflets, masques, filtres ;
- plus tard : bulles basees sur des images dans le SVG ou fragments `layout` plus riches.

La collision utilise `hitRadius`, pas les details de la forme rendue.

## Modele De Trajectoire

Les objets mouvants doivent etre representes par des trajectoires deterministes.

Exemple :

```ts
type BubbleOrbit = {
  centerX: number
  centerY: number
  radiusX: number
  radiusY: number
  periodMs: number
  phase: number
}
```

Des fonctions pures partagées resolvent les positions :

```ts
resolveBubblePosition(bubble, timelineMs)
resolveProjectilePosition(projectile, timelineMs)
resolvePickerRect(picker, timelineMs)
resolveMaluserRect(maluser, timelineMs)
```

Ces fonctions sont partagees par :

- les straps et la logique de collision ;
- les constructeurs de payloads d'actions visuelles ;
- les tests.

La position DOM/SVG rendue ne doit jamais devenir la source de verite.

## Decoupage En Stories

Structurer les parties independantes en stories distinctes afin de respecter la logique d'orchestration CodPlay et de garder chaque bloc comprehensible.

Decoupage recommande :

```txt
space-root-story
  space-world-story
  space-hud-story
  space-fx-story
  space-result-story
```

### `space-root-story`

Responsabilites :

- structure generale de la demo ;
- intro `Go!` ;
- fondu d'entree ;
- orchestration des events globaux ;
- state principal ou lien vers les straps scene-level.

### `space-world-story`

Responsabilites :

- plateau SVG ;
- bulles ;
- tourelle ;
- projectiles ;
- picker ;
- maluser ;
- actions visuelles de gameplay.

### `space-hud-story`

Responsabilites :

- timer ;
- mission ;
- bulles de mission numerotees ;
- etats `accompli` ;
- aide courte.

### `space-fx-story`

Responsabilites :

- effets de choc ;
- flashes d'impact ;
- vibrations visuelles ;
- trainees ;
- pulses globaux ou locaux ;
- feedbacks combines sur un meme event.

### `space-result-story`

Responsabilites :

- panneau final ;
- succes/echec ;
- temps final ;
- bouton ou action de reprise si retenu.

Ce decoupage doit exploiter la capacite d'un event CodPlay a etre diffuse vers plusieurs persos/stories. Un meme event metier peut donc produire simultanement :

- une mutation logique par strap ;
- une animation de bulle ;
- un effet de choc ;
- une mise a jour du HUD ;
- un feedback sonore ou visuel futur.

L'objectif est de cabler les animatiques par events nommes, pas de les enfouir dans la logique de collision.

## Strategie De Collision

CodPlay n'a pas de systeme de collision integre. Pour cette demo, les collisions sont de la logique metier.

Controles logiques supportes :

```ts
circleHitsCircle(a, b)
pointHitsCircle(point, circle)
rectHitsCircle(rect, circle)
segmentHitsCircle(segment, circle)
```

Utiliser `segmentHitsCircle` pour les projectiles rapides afin d'eviter qu'ils traversent une bulle entre deux instants de controle.

Les collisions sont verifiees quand des events pertinents arrivent, pas a chaque frame :

- sur `space:fire`, predire les impacts possibles du projectile et planifier des events de controle ;
- sur `space:projectile:impact-check`, valider l'impact avec l'etat courant ;
- sur `space:picker:spawn` ou changement de hauteur, planifier les controles de contact du picker ;
- sur `space:maluser:spawn`, planifier les controles de contact du maluser ;
- sur tout contact qui change l'etat, incrementer une revision pour ignorer les controles perimes.

Quand un impact est valide, le strap doit emettre un event metier nomme, par exemple :

```txt
space:impact:bubble
space:impact:maluser
space:impact:picker
```

Ces events ne doivent pas seulement reduire ou detruire la cible. Ils servent aussi de point de diffusion pour les animatiques associees.

Exemple pour un projectile qui touche une bulle :

```txt
space:projectile:impact-check
  -> strap valide la collision
  -> update etat logique
  -> events:
     - space:impact:bubble
     - space:bubble:red:set-level
     - space:projectile:shot-1:hide
```

Puis plusieurs persos/stories peuvent reagir a `space:impact:bubble` :

- la bulle pulse ou tremble ;
- un flash apparait au point d'impact ;
- la tourelle a un court recul ;
- le HUD surligne l'etape de mission si la destruction est valide ;
- le stage peut produire une micro-vibration ou un halo.

## Protection Contre Les Events Perimes

Les events futurs doivent etre valides avant d'appliquer leurs effets.

Utiliser des revisions/tokens dans l'etat :

```ts
type GameState = {
  revision: number
  projectileRevision: number
  pickerRevision: number
  maluserRevision: number
}
```

Les events planifies portent la revision depuis laquelle ils ont ete calcules :

```ts
{
  name: "space:projectile:impact-check",
  data: {
    projectileId,
    bubbleId,
    revision,
  }
}
```

Si la revision de l'event ne correspond plus a l'etat courant, le strap l'ignore.

## Regles Du Jeu

### Mission

La mission affiche la suite de couleurs a detruire sous forme de bulles fixes dans le HUD.

Chaque bulle de mission porte :

- son numero d'ordre ;
- sa couleur ;
- un etat visuel `accompli` si la destruction correspondante a ete realisee dans les regles.

Exemple visuel :

```txt
1 rouge   2 bleu   3 jaune   4 vert
```

Quand une bulle est detruite dans le bon ordre, la bulle de mission correspondante passe en etat accompli, par exemple avec une croix, une coche ou un marquage visuel equivalent.

Si une bulle est detruite hors ordre, le jeu peut continuer jusqu'au panneau final, mais l'etat logique devient `fail` ou `failedOrder` selon le choix d'implementation. Recommandation actuelle : marquer l'echec logique immediatement, continuer l'affichage jusqu'a la destruction des bulles ou afficher l'echec final des que l'ordre devient impossible.

### Bulles

- Les quatre bulles commencent a `level = 3`.
- Chaque contact reduit une bulle d'un niveau.
- Le niveau `0` signifie que la bulle est detruite.
- Seule la destruction finale ajoute la couleur dans la sequence de destruction.

Cela permet de toucher une bulle hors ordre sans echouer, tant qu'elle n'est pas detruite hors ordre.

### Victoire

Quand les quatre bulles sont detruites :

```ts
success = destructionSequence.join(",") === targetSequence.join(",")
```

Puis emettre :

- `space:game:success`, ou
- `space:game:fail`.

Afficher le temps ecoule a la fin.

### Picker

- Apparait aleatoirement selon une planification deterministe par seed.
- Se deplace de droite a gauche pres de la zone des bulles.
- Le joueur peut modifier sa hauteur.
- Reduit chaque bulle touchee d'un niveau.
- Peut toucher plusieurs bulles en un seul passage.
- Ne doit pas reduire plusieurs fois la meme bulle pendant un meme passage.

Conserver `hitBubbleIds` pour le passage courant du picker.

### Maluser

- Apparait aleatoirement selon une planification deterministe par seed.
- Se deplace en diagonale de gauche a droite.
- Regonfle les bulles touchees d'un niveau.
- Doit pouvoir etre detruit rapidement par projectile.
- Ne devrait pas ressusciter une bulle deja detruite, sauf decision explicite ulterieure.
- Ne doit pas regonfler plusieurs fois la meme bulle pendant un meme passage.

Conserver `hitBubbleIds` pour le passage courant du maluser.

## Aleatoire

Utiliser un aleatoire a seed stocke dans l'etat, dans l'esprit de `quiz-hunt`.

Ne pas appeler `Math.random()` directement dans la logique de jeu.

Le seed est toujours genere pour chaque run de demo. Il s'agit d'un faux random reproductible : une fois le seed pose, toutes les decisions aleatoires du run en decoulent.

Au `space:game:start`, calculer les fenetres de bonus et leurs parametres depuis le seed, puis planifier les events d'apparition.

Cela garde le debug et le replay comprehensibles.

## Straps

Creer une collection de straps scene-level pour la demo.

Straps candidats :

- `space-bubbles-game` gere les events principaux et les transitions d'etat ;
- des straps plus petits pourront etre extraits plus tard si le fichier devient trop gros.

Handlers d'events principaux :

```txt
space:game:start
space:game:restart
space:intro:go-show
space:intro:go-hide
space:turret:move
space:fire
space:projectile:impact-check
space:impact:bubble
space:impact:maluser
space:impact:picker
space:picker:spawn
space:picker:set-height
space:picker:contact-check
space:maluser:spawn
space:maluser:contact-check
space:maluser:destroy
space:game:success
space:game:fail
```

Les straps retournent :

- `update` pour l'etat logique du jeu ;
- `events` pour les actions nommees immediates ;
- `context.planned.delay(...)` / `context.planned.sequence(...)` pour les events futurs.

Ils ne doivent pas muter directement le DOM ni lire les coordonnees rendues pour decider du gameplay.

Les straps doivent distinguer :

- les events de decision logique (`space:projectile:impact-check`) ;
- les events metier diffuses (`space:impact:bubble`) ;
- les events d'action visuelle (`space:bubble:red:set-level`, `space:fx:impact-flash`).

Cette separation permet de brancher ou retirer des animatiques sans changer la logique de collision.

## Actions

Les actions doivent rester nommees et semantiques.

Exemples :

```txt
space:stage:ready
space:stage:fade-in
space:intro:go-show
space:intro:go-hide
space:turret:move
space:projectile:shot-1:fly
space:projectile:shot-1:hide
space:projectile:shot-1:impact
space:bubble:red:move
space:bubble:red:set-level
space:bubble:red:shock
space:bubble:red:pop
space:mission:red:accomplished
space:fx:impact-flash
space:fx:impact-ring
space:fx:stage-shake
space:turret:recoil
space:picker:fly
space:picker:set-height
space:maluser:fly
space:maluser:explode
space:hud:update
space:result:show-success
space:result:show-fail
```

Le payload exact peut utiliser des attributs SVG, des transforms CSS, des changements de classes ou les transitions de style CodPlay standard.

Eviter les noms d'actions lies a une implementation visuelle precise, par exemple `set-circle-radius`, sauf si cela reste strictement interne a une version temporaire du rendu.

## Couche Animatique

Chaque evenement important du jeu doit prevoir des points de branchement animatiques.

Evenements et animatiques candidates :

```txt
space:game:start
  -> Go!, fondu d'entree, activation HUD, apparition tourelle

space:fire
  -> recul tourelle, flash bouche canon, apparition projectile, leger son/halo futur

space:impact:bubble
  -> choc bulle, flash impact, anneau d'onde, disparition projectile, pulse HUD

space:bubble:destroyed
  -> pop bulle, particules/etoiles, mise a jour mission, event succes/echec potentiel

space:picker:spawn
  -> entree rapide, trainee, alerte HUD courte

space:picker:hit-bubble
  -> piqure visuelle, contraction bulle, flash local

space:maluser:spawn
  -> alerte, entree diagonale, teinte danger

space:maluser:hit-bubble
  -> regonflage, pulse inverse, alerte HUD

space:maluser:destroy
  -> explosion/evaporation, flash, annulation danger

space:game:success
  -> panneau final, couleur positive, pulse mission complete

space:game:fail
  -> panneau final, couleur echec, desaturation ou secousse douce
```

Principe : un event metier peut etre ecoute par plusieurs stories. Il ne faut donc pas tout condenser dans une seule action monolithique.

Exemple : `space:impact:bubble` peut declencher simultanement :

- action ciblee sur la bulle ;
- action sur le projectile ;
- action dans `space-fx-story` pour un flash ;
- action sur la tourelle ;
- action HUD si la mission avance.

Cela tire parti de la diffusion CodPlay et rend la dynamique du jeu plus riche sans complexifier la logique metier.

## Organisation Des Fichiers

Dossier recommande pour la demo :

```txt
packages/demos/src/scenes/space-bubbles/
  index.ts
  space-bubbles-scene.ts
  space-bubbles-straps.ts
  space-bubbles-types.ts
  space-bubbles-state.ts
  space-bubbles-trajectories.ts
  space-bubbles-collisions.ts
  space-bubbles-random.ts
  space-bubbles-render-events.ts
  space-bubbles-animatics.ts
  space-bubbles-styles.ts
```

Enregistrer la demo dans :

- `packages/demos/src/main.ts`
- `packages/demos/src/shared/demo-registry.ts`

## Premiere Tranche D'Implementation

Construire d'abord la plus petite demo utile :

1. Stage + HUD + panneau final cache.
2. Intro au play de la telco : `Go!` pendant une seconde et fondu d'entree de la scene.
3. Seed genere pour le run et stocke dans l'etat.
4. Mission affichee avec quatre bulles numerotees dans l'ordre attendu.
5. Quatre bulles rendues en SVG avec positions orbitales deterministes.
6. Tourelle rendue en bas.
7. Deplacement de la tourelle par pointer ou clavier.
8. Tir d'un projectile.
9. Animatique de tir : recul tourelle, projectile, flash de depart.
10. Prediction et validation d'un impact projectile/bulle.
11. Event `space:impact:bubble` avec effet de choc minimal.
12. Reduction du niveau de bulle.
13. Destruction des bulles et validation de la suite cible.
14. Passage en etat accompli sur les bulles de mission detruites dans les regles.
15. Affichage succes/echec avec temps ecoule dans le panneau final.

Seulement apres validation :

16. Ajouter le picker.
17. Ajouter le maluser.
18. Enrichir le rendu visuel et les animatiques.

## Tests

Ajouter d'abord des tests unitaires sur la logique pure :

- resolution des positions de trajectoire ;
- helpers de collision cercle/segment/rectangle ;
- prediction d'impact projectile ;
- transitions de niveau de bulle ;
- validation de l'ordre final ;
- gestion des revisions perimees ;
- planification aleatoire par seed.

La validation visuelle reste manuelle dans la demo.

## Decisions Verrouillees

### Controles Ordinateur

- Les fleches gauche/droite deplacent la tourelle.
- La touche espace tire.
- Les quatre fleches directionnelles sont disponibles.
- Quand le picker est actif, les fleches haut/bas pilotent sa hauteur.

### Controles Mobile

- Utiliser des zones sensibles tactiles.
- A gauche : deux boutons de direction.
- A droite : un bouton de tir.
- Quand le picker traverse l'ecran, les deux boutons gauche/droite deviennent haut/bas pour modifier sa hauteur.

### Maluser

- Le maluser ne doit pas regonfler une bulle deja detruite.

### Picker

- Le picker est valide dans le modele prevu.
- Pour v1, il est pilote par lignes/hauteurs discretes afin de rester coherent avec le modele evenementiel CodPlay.

### Orbite Des Bulles

- L'orbite est validee dans le modele prevu.
- Les positions doivent etre derivees depuis des donnees de trajectoire partagees.
- L'etat et les collisions restent hors du composant visuel.
