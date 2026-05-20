# Mini spec - deferred events et contrat media sur reload runtime

## Objectif

Bloquer deux sujets avant toute nouvelle implementation:

- l'emission differee d'un event runtime
- le contrat interne de reset/reprise des media pendant `seek`, `rewind`, `rebuild` et `sequence:end`

Le but est d'eviter les solutions de confort liees a une demo, et de conserver une surface d'API contractuelle et generique.

## 1. Emission differee d'events

### Constat

Le besoin existe pour des cas auteurs du type:

- un event utilisateur declenche une story de fin
- un `sequence:end` doit etre emis 1 seconde plus tard

Le runtime actuel ne dispose pas d'un contrat explicite pour cela.

### Regle de cadrage

- aucune nouvelle surface d'API publique ne doit etre introduite sans accord user
- les aides type `wait`, `delay`, `repeat`, `loop`, `stagger` doivent etre traitees comme une vraie feature runtime/strap, pas comme un ajout local a un exemple

### Orientation retenue

- pour `wait` / `delay`, le modele vise n'est pas un timer qui attend au runtime avant d'emettre
- l'event doit etre place immediatement dans la sequence, avec un decalage voulu
- la notion cible est donc un `offsetMs` applique a partir de l'event source
- une fois place, l'event suit le cycle normal du `trackManager`, du `seek` et du `rewind`
- sur un cas comme `s4`, `sequence:end` peut etre un event derive de l'event de depart de la story de fin

### Perimetre de la future feature

La spec finale devra trancher explicitement:

1. le point d'entree auteur
   - strap helpers
   - scene hooks
   - emit auteur enrichi
   - autre surface dediee
2. le domaine de persistance
   - un event differe doit etre persiste dans `trackManager` comme un event place, pas comme un timer transitoire
3. le comportement sous `pause`
   - comme l'event est deja place, il n'y a pas de timer runtime a geler
4. le comportement sous `seek` / `rewind`
   - l'event place doit etre rejoue normalement par le cycle de replay
5. le comportement sous `sequence:end`
   - aucun mecanisme transitoire ne doit survivre; seul l'etat persiste des tracks fait foi jusqu'au verrou terminal

### Invariant minimal attendu

- aucun event differe ne doit survivre a un `sequence:end`
- aucun event differe ne doit produire un doublon a cause d'un `seek` ou `rewind`
- le contrat doit etre unique pour tous les cas d'usage, pas seulement pour `s4`
- un event a `offsetMs` doit etre observable comme n'importe quel autre event place dans la sequence

### Etat courant

- une implementation experimentale locale a ete posee pendant l'analyse
- elle n'est pas contractuelle
- elle doit etre remplacee ou retiree des qu'une spec finale est validee

## 2. Contrat media sur reload runtime

### Bug observe

- apres `seek` ou `rewind`, deux lectures audio du meme media peuvent se superposer

### Diagnostic

Le probleme n'est pas principalement narratif. Il vient du cycle de vie runtime du media:

1. `seek` et `rewind` rechargent le runtime
2. le renderer refreshe les composants existants en place
3. `MediaComponent` reutilise son noeud media interne
4. le reset generique de noeud ne definit pas un reset deterministe pour `HTMLMediaElement`
5. le player logique pense repartir proprement, alors qu'une lecture reelle peut encore exister cote navigateur

### Contrat interne a definir

Le runtime doit formaliser un etat neutre media, applique avant toute reconstruction temporelle.

### Etats / transitions concerns

- `player:seek`
- `player:rewind`
- `player:rebuild`
- `sequence:end`
- `destroy`

### Regles minimales attendues

1. avant reconstruction runtime d'un media deja charge:
   - stopper explicitement toute lecture reelle en cours
   - remettre le media dans un etat neutre deterministe
2. apres reconstruction:
   - une seule lecture reelle doit exister pour un runtime item donne
3. `rewind`:
   - le media doit etre a `0`, arrete, non duplique
4. `seek`:
   - tout media en lecture doit etre mis en pause avant repositionnement
   - le media doit ensuite se repositionner sans laisser une ancienne lecture active
5. `sequence:end`:
   - tous les media de la sequence doivent etre stoppes definitivement

### Arbitrage retenu

- `seek` et `rewind` doivent pauser tous les media en lecture
- `rewind` doit en plus les stopper d'office

### Nature de la feature

Ce sujet doit etre traite comme une feature interne de contrat runtime media, pas comme une correction locale dans `rewind` uniquement.

### Point d'implementation a auditer

La spec finale devra couvrir explicitement:

- le reset d'un `HTMLMediaElement`
- le refresh d'un `MediaComponent`
- le contrat entre `MediaSyncModule` et le composant media
- la difference entre etat logique runtime et etat reel du navigateur

## 3. Plan d'action avant implementation

1. valider la surface contractuelle de l'emission differee
2. valider le contrat interne de reset media
3. retirer les experimentations non contractuelles si elles ne correspondent pas a la spec retenue
4. implementer les deux features en gardant `seek` et `rewind` deterministes
5. ajouter des tests navigateur/reload reprodusant le doublon audio reel

## Etat apres implementation strap runtime

- l'experimentation `delayMs` a ete retiree du runtime auteur
- la premiere implementation strap stable est portee par `Player` / `CodPlay`
- les events timeline issus des tracks passent aussi par la couche auteur `listen/straps`
- `story.listen.straps` et `scene.listen.straps` sont supportes
- `update` est un patch shallow applique sur `story.state` ou `scene.state`
- les helpers finis (`delay`, `repeat`, `stagger`) placent leurs events dans la sequence sur des tracks runtime dediees
- la neutralisation d'un flux strap fini repose sur la desactivation de ces tracks dediees
- `loop` est supporte via scheduler runtime local au `Player` public
- `s4` est migree sur strap compteur et sert de test d'integration auteur
