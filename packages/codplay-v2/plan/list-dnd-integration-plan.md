# Intégration V2 de la capture DnD et de la capacité `list`

> Status: En cours — placement validé, seek de la démo encore ouvert
> CodPlay version: V2 foundation
> Périmètre: validation HTML de la capacité `list`

Ce document complète le contrat de capture V2 pour son usage avec la capacité
`list`. Il ne crée pas un canal DnD concurrent : le DnD reste une capture
continue ordinaire, dont la preview est transitoire et dont le commit produit
un `move` ordinaire.

Le code actif de cette tranche est entièrement V2 : il n'importe aucun module,
type ou runtime de `packages/codplay`. Les références historiques servent
uniquement à vérifier les comportements portés dans les contrats V2.

## Frontières

### Core capture

- ouvre, suit et ferme une session `begin -> track -> end/cancel` ;
- conserve le `captureState` éphémère ;
- transporte les samples et les sorties `endEmit` / `endCapture` par le
  dispatcher normal ;
- ne connaît ni liste, ni DOM, ni géométrie, ni ghost.

### Source et materializer HTML

La source HTML peut fournir deux hooks génériques, utilisables par d'autres
materializers avec une forme équivalente :

- `onCaptureTrack` est appelé après le `track` normal, pour une preview qui ne
  produit ni event ni entrée de journal ;
- `resolveEndCaptureState` est appelé une seule fois à l'événement de fin. Il
  reçoit le dernier état et peut retourner son remplacement final avant
  `endEmit` / `endCapture`.

Ces hooks ne sont pas des fonctions auteur et ne recherchent aucune cible pour
les actions compilées. Ils appartiennent à la frontière source/materializer.

### Capacité `list`

La capacité `list` porte les règles de placement et de réordonnancement. Pour
un drop, elle consomme un résultat abstrait `{ target, index }` et le commit est
représenté par :

```ts
{
  move: {
    target: 'list-b',
    mode: 1,
    flipMode: 'overlay-world',
    transition: { duration: 400, ease: 'out(2)' }
  }
}
```

La capacité ne possède pas de pipeline d'animation séparé. Les frontières
runtime sont ajoutées au même journal et au même `StructuralTimeline` que les
frontières compilées ; Play et Seek reconstruisent donc le même ordre.

La fermeture d'un DnD qui doit être relue déclare les deux sorties du contrat :

- `endEmit` applique au temps courant le passage de la pose live au relâchement
  vers la cible. Cette pose appartient à la fin du geste et ne constitue pas
  la trajectoire historique à rejouer ;
- `endCapture` retourne un événement `persist-only` au temps `end - durée`. Son
  `move` part de l'attachement logique source et atteint la même cible. C'est
  cette frontière qui porte la trajectoire source → cible à la relecture.

Dans la démo S6, les deux événements sélectionnent deux actions compilées
distinctes qui portent la même donnée `move` : `item:persisted:*` ne produit
que la frontière rejouable, tandis que `item:dropped:*` reste le fait normal
qui déclenche le strap de state et de compteurs. À la relecture, l'événement
`persist-only` a déjà établi la cible avant `endEmit` ; ce dernier ne recrée
donc pas une seconde trajectoire. Le snapshot HTML de la pose live est
supprimé avant un seek et n'est jamais utilisé pour reconstruire la trajectoire
persistante.

### Démo HTML

La démo possède la partie dépendante du substrat : écoute pointer, hit-test
HTML, preview et ghost. La preview ne réordonne jamais les nodes auteur et ne
produit jamais d’event. Elle reçoit l’ordre courant depuis le graphe résolu de
`list` ; sa lecture directe des enfants DOM reste uniquement le repli pour un
hôte qui ne fournit pas cet ordre. À la fermeture, elle fournit seulement le
dernier résultat abstrait au hook générique de fin.

Pendant cette preview, les nodes HTML temporaires portent l'attribut réservé
`data-codplay-transient`. Le materializer structurel les exclut de son ordre
d'auteur et ne réattache pas un node auteur marqué comme transitoire. Il ne
réexécute pas non plus `appendChild` lorsque l'ordre des nodes auteurs est déjà
celui de la scène. Cette combinaison permet aux frames de lecture de continuer
à matérialiser la scène sans déplacer le node flottant ni le ghost ; le marqueur
est retiré à la fermeture avant la reprise normale de la materialisation.

Le ghost est une représentation technique transitoire. Les nodes auteur restent
persistants et leur destruction est réservée au teardown final.

La preview peut recevoir dans le `captureState` un `ghost` (`className` et
`style`) et un `move.transition` (`duration`, `ease`, `path`, `traversal`). Ces
données servent respectivement à la représentation HTML et au `move` final ;
elles ne créent ni action ni event runtime supplémentaire. L'index applique une
hystérésis de midpoint et un même point ne relance pas le hit-test.

Pendant le geste, le perso saisi est détaché du DOM de la liste et placé dans
`document.body` par une pose HTML fixe qui conserve le point de prise. Cette
opération reste transitoire : le placement logique V2 n'est pas modifié. Le
hit-test mesure les enfants restants de la liste, comme en V1. Lors de la
première résolution dans la liste source, le ghost occupe le slot libéré par le
perso saisi : le reflow des voisins ne peut donc pas le faire apparaître
immédiatement au début ou à la fin de la liste. Les déplacements suivants
utilisent l'hystérésis de midpoint pour franchir réellement les slots voisins.
Les nodes auteur restent dans leur ordre logique.
La source HTML met en file les `pointermove` et l'événement de fin reçus avant
la fin asynchrone de l'événement de début ; aucun échantillon live n'est donc
perdu entre `pointerdown` et `beginCapture`. Le hit-test, les rectangles FLIP et
la référence d'insertion utilisent le même ordre d'enfants montés ; un ordre
DOM divergent ou un node non monté ne peut plus déplacer le ghost vers un autre
slot que celui qui a été mesuré.
Chaque changement de slot capture les
rectangles `FIRST` des voisins avant la mutation du ghost, mesure leur état
`LAST`, puis joue un FLIP HTML transitoire. Une transition déjà en cours est
mesurée dans sa pose stabilisée avant d'être éventuellement relancée ; un même
slot ne redémarre donc pas l'animation à chaque `pointermove`.

Les primitives HTML de rectangle stabilisé, de capture de rectangles et de
transition FLIP sont partagées dans `html-transient-flip.ts`. Cette mutualisation
ne mélange pas le cycle live de la preview avec le graphe de lecture : elle évite
seulement de dupliquer le traitement géométrique élémentaire.

L'événement de fin peut porter un dernier échantillon pointer. La preview le
traite une seule fois avant de produire le `move`, de sorte que `target` et
`mode` correspondent au point réel du drop, même si aucun `pointermove` n'a été
reçu à cette position.

Avant que `endEmit` ne modifie l'état logique, le runner HTML photographie la
pose visible courante comme `FIRST` de la frontière live. Cette photographie
inclut la pose fixe au drop et les reflows FLIP encore visibles des voisins ;
le `LAST` reste mesuré depuis le player isolé après le `move`. Elle sert au
handoff immédiat de la fermeture, puis est supprimée au prochain seek. Pour
`endCapture`, le `FIRST` de relecture est au contraire mesuré par le player
isolé juste avant la frontière persist-only. Le snapshot live est une donnée de
présentation du runner, pas un nouvel état de capture et pas une entrée du
journal.

## Donnée de `endEmit`

`endEmit` reste un événement normal. Le runtime garantit toujours la clé
réservée `data.captureState`. Lorsque l'auteur ne fournit pas de donnée
explicite, les champs du `captureState` sont également exposés au niveau
supérieur de `data`, puis la clé réservée est ajoutée :

```ts
{
  persoId: 'item-1',
  move: { target: 'list-b', mode: 1 },
  captureState: {
    persoId: 'item-1',
    move: { target: 'list-b', mode: 1 }
  }
}
```

Cette forme utilise la fusion shallow des actions V2 tout en rendant le
`captureState` systématiquement disponible aux straps. Une donnée explicite est
conservée ; sa clé réservée `captureState` est remplacée par le snapshot final
de la session.

## Séquence normative

```text
pointerdown
  -> event de début normal
  -> beginCapture
pointermove*
  -> trackCapture
  -> action live éventuelle par Component.update/services/materializer
  -> preview HTML transitoire éventuelle
pointerup
  -> résolution finale unique du captureState par la source/materializer
  -> endCapture persist-only éventuel
     (source logique -> cible, ancré à end - durée)
  -> photographie FIRST visible de la pose live
  -> endEmit apply-now éventuel
     (pose au relâchement -> cible, temps courant)
  -> journal / StructuralTimeline / solve / Component / materializer
```

Le hook de preview n'est jamais rejoué au seek. La trajectoire live de
`endEmit` n'est pas réutilisée pour la relecture : un seek efface son FIRST
présentationnel et le graphe repart du FIRST logique de `endCapture`. Le
résultat final reste rejouable uniquement s'il a été porté par une sortie
persistante.

## Critères de sortie

- la capture classique reste inchangée pour les sources qui n'utilisent pas les
  hooks ;
- le résultat final de liste est résolu une seule fois, depuis le cache de
  preview ;
- au début d'un drag source, le ghost occupe le slot d'origine ; après un
  déplacement réel, il suit la position courante avec l'hystérésis de la
  référence V1 ;
- les voisins du ghost se déplacent par FLIP pendant la preview, sans
  réordonnancement logique concurrent ;
- `endEmit` anime la remise live de la pose de relâchement vers la cible ;
- `endCapture` porte une trajectoire persist-only source → cible, distincte de
  cette remise live ;
- une capture S6 n'inscrit qu'un événement `persist-only` de placement ; les
  mises à jour de state et de compteurs restent portées par `endEmit` ;
- le commit passe par l'action `move` et la capacité `list` ;
- les événements runtime structurels sont visibles par Play et Seek sans
  modifier `CompiledScene` ni créer d'action runtime ;
- le S6 DnD list remplace l'entrée de démo courante et utilise la telco existante.

## Vérification d'implémentation — 2026-08-22

- [x] `endCapture` S6 produit une sortie `persist-only` ancrée avant
  `endEmit`, avec le `move` source → cible ;
- [x] une fermeture S6 inscrit un seul événement `persist-only` de placement ;
- [x] le snapshot FIRST live est utilisé uniquement pour la remise au
  relâchement et est effacé avant `seek` ;
- [x] le hit-test reprend le cycle V1 : détachement HTML du perso saisi,
  ordre canonique des enfants restants, coordonnées locales de la liste et
  couverture du changement de slot ;
- [x] les `pointermove` arrivant avant la résolution de l'événement de début
  sont rejoués dans l'ordre ; le flux natif ne peut plus laisser le ghost figé
  au premier slot tout en corrigeant seulement le drop final ;
- [x] le hit-test, les rectangles FLIP et l'insertion du ghost partagent le
  même snapshot des enfants montés ;
- [x] régression unitaire : item 2 saisi au centre et déplacé de 2 px reste
  dans le slot source ;
- [x] régression materializer : plusieurs materialisations de la même frame
  conservent le node flottant hors de la liste et le ghost dans son slot ;
- [x] typecheck, test ciblé, suite V2 complète et builds player/runner passent.

## Validation navigateur via MCP Safari — 2026-08-22

Le MCP Safari connecté est le canal de validation navigateur de cette tranche.
Les contrôles ont été effectués sur la démo V2 `CodPlay V2 — Drag & Capture`,
en ciblant les éléments visibles et non les clones de mesure ou de présentation.

- [x] capture dans la liste source après plusieurs frames de lecture : le
  ghost reste en deuxième position pour un déplacement de 2 px de l'item 2
  (`index 1`), puis suit le pointeur après franchissement de la frontière
  (`index 2`) ; l'item saisi reste hors de la liste en pose fixe ;
- [x] transfert source → cible : le ghost apparaît dans la cible à `index 0` ;
- [x] deux transferts successifs : les ghosts sont supprimés à la fermeture
  et l'ordre DOM final reste cohérent ;
- [x] aucune erreur `warn` ou `error` dans la console Safari pendant ces essais ;
- [ ] seek de la démo : la commande telco est actuellement rejetée et doit
  rester ouverte pour investigation séparée.

Cette validation ne clôt donc pas la démo : le placement HTML du ghost est
validé dans Safari, mais le seek n'est pas déclaré validé.
