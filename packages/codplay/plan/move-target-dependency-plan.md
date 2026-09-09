# Plan CodPlay V2 — dépendance d’un `move` à sa cible

## Statut

> Status: En cours — implémentation autorisée par validation utilisateur du
> 2026-09-09 ; la validation complète reste à exécuter.
> CodPlay version: V2 foundation
> Plan parent : [`motion-live-discovery-invalidation-plan.md`](./motion-live-discovery-invalidation-plan.md)

Ce plan précise le retarget déjà prévu par le mouvement V2 lorsque la cible
d’un `move` change de position pendant la trajectoire d’un item. Il ne crée ni
API de gestion de story, ni événement technique parallèle, ni circuit propre à
la démo `position`.

## 1. Règle fonctionnelle

Lorsqu’un `move` transitionnel de l’item `I` utilise la cible résolue `T` pour
son endpoint `LAST`, le runtime conserve une dépendance de présentation :

```text
move(I) ──dépend de──> target(T)
```

Si un nouvel événement résolu porte un `move` qui modifie `T` alors que la
trajectoire de `I` est encore en cours, la trajectoire de `I` est invalidée et
recalculée. La cible est donc une dépendance explicite de l’occurrence de
`move`, et non une déduction faite à partir d’un nom d’événement, d’un geste ou
d’un champ arbitraire de `event.data`.

Le déplacement de la cible n’est pas un cas spécial de la démo : c’est un
nouveau `move` normal. Les règles existantes de conflit et d’interruption
résolvent d’abord ce nouveau `move` lorsqu’un mouvement de la cible est déjà en
cours. La dépendance sert ensuite à retrouver les trajectoires d’items qui
doivent être retargetées ; elle ne duplique pas le nouveau `move`.

## 2. Déclenchement et coût

- Pendant le déplacement continu de la cible, aucune capture ni recalcul de
  trajectoire n’est lancé.
- Au relâchement, la source de capture émet un événement `move` ordinaire par
  le circuit `listen` / player / runner déjà existant.
- Tout autre événement qui résout un `move` modifiant la même cible emprunte
  exactement le même chemin ; le runtime ne reconnaît pas un type particulier
  d’événement de pointeur.
- Un événement qui ne résout pas de `move`, ou qui modifie une autre cible,
  n’invalide pas la trajectoire de `I`.
- Une cible déplacée après la fin de la trajectoire de `I` ne provoque aucune
  recapture de `I`.

La dépendance est donc consultée à l’arrivée d’une occurrence `move`, jamais
par polling DOM, comparaison de positions à chaque frame ou scan global du
journal.

## 3. Données internes

La frontière capturée à partir de l’occurrence résolue de `move` doit permettre
au graphe d’identifier, sans exposer ces champs à l’auteur :

- l’identité opaque de l’item déplacé `I` ;
- l’identité opaque de la cible montée résolue `T` ;
- la frontière temporelle et l’ordre de l’occurrence ;
- le régime de présentation et la transition de l’occurrence.

Le graphe de présentation maintient un index éphémère des trajectoires en
cours par l’identité de la target montée (`parentItemId` de l’attachement
`LAST`). Pour une attache au root sans parent monté, `targetId` reste le
repli. Cet index appartient au graphe motion et est supprimé avec le segment,
le reset ou la fermeture du groupe concerné. Il ne modifie pas le journal
logique et ne devient pas un catalogue de moves futurs.

La dépendance vise la target résolue du `move`. Elle ne transforme pas tous les
ancêtres DOM en cibles dépendantes : la composition des parents mobiles reste
traitée par le graphe hiérarchique existant. Si un changement d’ancêtre produit
un nouvel état résolu de la target et un nouveau `move` qui la modifie, cette
occurrence est le signal normal de l’invalidation.

## 4. Transaction de retarget

À la frontière où le nouveau `move(T)` est résolu :

1. le runtime résout et traite le `move` de `T` avec les règles normales de
   conflit ;
2. l’index par identité de target montée sélectionne les trajectoires encore
   actives qui dépendent de `T` ;
3. le runner calcule la pose visuelle courante de chaque item dépendant `I` au
   temps exact de la frontière ; cette pose devient son nouveau `FIRST` ;
4. la nouvelle pose projetée de `T` devient le nouveau `LAST` de la trajectoire
   de `I` ; elle est recapturée à partir de l’état `after` du `move(T)`, et non
   depuis l’ancienne position de `T` ;
5. le segment de `I` est remplacé dans le graphe par une trajectoire retargetée
   dans une seule transaction de présentation ;
6. la présentation publie la frame issue de ce commit, sans exposer une pose
   intermédiaire où `I` reviendrait à son ancien `LAST`.

Le retarget ne crée pas un second événement logique pour `I`. Le journal
contient le nouveau `move(T)` ; la dépendance et le remplacement du segment
sont des données de présentation dérivées de cette occurrence.

Lorsque la frontière ne porte que le `move(T)`, le segment actif de `I`
conserve sa phase, son `endAt`, son easing et son path selon la règle de
retarget existante. Seule la borne `LAST` est remplacée par la pose projetée
de la cible. Si la cible continue elle-même à se déplacer au temps `endAt` de
`I`, le resolver compose la pose de `T` à ce temps ; il ne fige pas par erreur
la pose de `T` au temps de l’événement déclencheur.

Lorsque le relâchement produit en plus un nouveau `move(I)`, ce nouveau move
est une occurrence directe qui remplace le segment actif de `I`. Son `FIRST`
est la pose visuelle déjà résolue à la frontière ; il ne doit jamais reprendre
la pose initiale ou la pose provisoire du nouveau segment. Sa durée devient le
temps restant jusqu’à l’`endAt` du segment remplacé, avec un délai nul, afin de
conserver la durée totale de la trajectoire. Le nouveau `LAST`, son easing et
son path viennent de cette occurrence directe. L’ancien segment reste dans
l’historique du graphe pour Play/Seek, mais ne reste plus sélectionnable comme
dépendance active.

Pour une trajectoire quadratique, la forme reste un `Path` interne de type
`quadratic` avec un seul point de contrôle. Le recalcule des bornes ne doit pas
réintroduire une approximation par arc SVG ni modifier le contrat auteur du
`path`.

## 5. Groupes et cas multiples

- Plusieurs items peuvent dépendre de la même target ; l’occurrence de
  `move(T)` les sélectionne tous, mais leur capture est regroupée en une seule
  préparation cohérente lorsque leurs frontières se recouvrent.
- Un item peut être à la fois cible d’un nouveau `move` et dépendant d’une
  autre target. Les conflits du nouveau `move` sont résolus dans l’ordre
  logique, puis les dépendances directement affectées sont retargetées dans le
  même commit ; aucune boucle de recherche globale n’est ajoutée.
- Une dépendance d’ancêtre ou de composition ne crée pas automatiquement une
  seconde trajectoire pour chaque descendant. Seuls les items possédant une
  dépendance `move -> target` active sont retargetés.
- Si la cible concrète était absente au FIRST du `move` dépendant, sa première
  apparition avant LAST ne déclenche pas de retarget : elle rend disponible le
  contexte déjà capturé pour la trajectoire initiale. Dès une frontière où cette
  cible est présente, tout changement de pose reste un nouveau `move` de cible
  et retargete les dépendants actifs.
- Les occurrences futures issues d’un `repeat` ne sont pas préparées à
  l’avance par ce mécanisme. La dépendance est enregistrée lorsque chaque
  occurrence `move` est effectivement résolue ; le plan ne change pas les
  règles de production ou de purge des occurrences `repeat`.
- Un reset de story ou de groupe retire les dépendances et les segments qu’il
  touche. Une occurrence devenue obsolète ne peut donc plus retargeter un item
  après la fermeture de son périmètre.

## 6. Mise en œuvre

### 6.1 Contrat interne et résolution

- Conserver dans l’occurrence l’item, l’action et les snapshots avant/après ;
  résoudre la `targetId` opaque à partir de l’attachement `LAST` capturé, sans
  ajouter ce détail au payload d’occurrence ni au contrat auteur.
- Définir l’identité d’un segment actif et sa durée de validité.
- Définir l’ordre de traitement : conflit du nouveau `move`, recherche des
  dépendants, puis commit motion.
- Ne pas ajouter de propriété auteur, de strap de management ou d’API publique.

### 6.2 Index des dépendances

- Enregistrer `target` montée -> segments actifs à la préparation d’un move
  transitionnel ; ne pas confondre cet index avec l’identifiant logique partagé
  par les frères d’un même target.
- Retirer l’entrée à la fin, au retarget, au reset et à la destruction du
  groupe.
- Dédupliquer une même trajectoire si plusieurs parties de la capture
  référencent la même occurrence.

### 6.3 Capture et commit

- Capturer `FIRST` depuis la pose visuelle résolue de l’item au moment du
  `move(T)`, jamais depuis le snapshot logique initial.
- Pour un nouveau `move(I)` qui remplace une trajectoire active, exclure le
  segment nouvellement planifié et les segments futurs pendant la résolution
  de `FIRST`; sélectionner l’ancien segment actif ou l’état naturel antérieur.
- Pour ce remplacement, préparer le tween sur `endAt_initial - boundary.time`
  et publier `delay: 0`; une nouvelle durée complète ne doit pas prolonger la
  trajectoire.
- Capturer `LAST` depuis la projection post-`move(T)` de la target.
- Préparer les items réellement affectés, leurs ancêtres nécessaires et les
  ressources local/reparent dans le scope existant.
- Remplacer les segments, frontières et ressources du groupe atomiquement.
- Garantir qu’un échec de capture laisse le graphe et la présentation
  précédents cohérents ; aucun demi-retarget ne doit être publié.

### 6.4 Nettoyage de la démo de validation

Après validation du runtime, la démo `position` devra exprimer le déplacement
de la cible par son événement `move` normal et ne conserver aucun cache ou
calcul local qui simule une dépendance de trajectoire. Elle restera une fixture
de validation du chemin réel, notamment pour vérifier que déplacer la source
ne change pas le trajet lorsque la target n’a pas bougé.

## 7. Validation d’acceptation

La fonctionnalité ne sera pas marquée `Fini` avant la validation complète du
chemin réel :

- un item en mouvement et une cible relâchée : un seul retarget, sans saut ;
- `FIRST` égal à la pose visible courante de l’item ;
- si le relâchement émet aussi un nouveau `move` pour l’item, celui-ci ne
  revient pas à sa pose initiale et finit à l’`endAt` initial avec la seule
  durée restante ;
- `LAST` égal à la nouvelle pose projetée de la target ;
- déplacement continu de la cible : aucune capture et aucun recalcul par
  `pointermove` ;
- déplacement de la source seule : la trajectoire vers la target reste
  inchangée ;
- événement `move` équivalent produit par une autre source : même résultat ;
- cible ou événement sans dépendance : aucune invalidation parasite ;
- conflit entre deux moves sur la target : application des règles normales,
  sans événement synthétique supplémentaire ;
- un nouveau `move` direct qui chevauche un ancien segment retire l’ancienne
  dépendance de l’index d’invalidation, sans retirer l’historique nécessaire au
  Play/Seek ;
- plusieurs items dépendants de la même target : groupe cohérent et mesure
  dédupliquée ;
- moves locaux, reparent, target-perso, parent/enfant, reflow et mouvements
  simultanés ;
- quadratique à un seul point de contrôle, sans changement de forme imprévu ;
- égalité Play/Seek avant, à et après la frontière de retarget ;
- reset, replay, isolation et occurrences `repeat` sans segment obsolète ;
- test navigateur sur l’onglet Safari MCP existant de `5173` : la démo
  `position` confirme l’absence de recalcul pendant le drag, un recalcul au
  relâchement, et une baisse significative du nombre d’appels de mesure.

## 7.1 État d’implémentation — 2026-09-09

Le graphe motion implémente maintenant l’index éphémère des targets montées,
le retarget atomique des segments dépendants et la conservation de la phase,
de la durée, de l’easing et du path pour un retarget de target seul. Un nouveau
`move` direct chevauchant un ancien segment repart de la pose visible, raccourcit
son tween jusqu’à l’`endAt` initial et retire seulement la dépendance devenue
obsolète ; l’historique reste disponible pour Play et Seek. Aucun champ auteur,
manager de story ou circuit d’événement parallèle n’a été ajouté.

Validation ciblée exécutée le 2026-09-09 : le graphe distingue maintenant la
première apparition d’une cible absente au FIRST d’un déplacement ultérieur de
la cible. Les tests vérifient la trajectoire initiale vers le LAST disponible,
l’absence de retarget à la simple montée de la cible, le retarget d’un vrai
move de cible et la frontière réelle de la démo 6.

- `motion-graph.spec.ts`, `motion-layout.spec.ts`,
  `runner-html/motion-capture.spec.ts` et `facade/story-six-motion.spec.ts` :
  46 tests passés ;
- `facade/story-five-motion.spec.ts` confirme sur le chemin de premier Play que
  le premier segment de la story 5 conserve `K -> Q`, le mode `reparent`, sa
  durée `2 000 ms` et aucune sous-frontière de retarget ;
- `npm run typecheck --workspace=codplay` : passé ;
- `npm test --workspace=codplay` : 94 fichiers, 601 tests passés ;
- le typecheck CodPlay, le typecheck `@codplay/demos` et le build
  `@codplay/demos` passent ;
- Safari MCP sur `5173` confirme, sur une navigation fraîche, que la story 6
  est la première case (`01 / 06`) et que son premier Play part directement
  sans seek préalable. L'observation à `2 138 ms` place `Qa` dans la liste K,
  dans le sens attendu Q -> K ; la console ne contient ni warning ni erreur.
- Le chemin isolé de la story 5 reste couvert par `story-five-motion.spec.ts` :
  il vérifie le premier segment K -> Q indépendamment de sa position dans le
  carousel.

Le statut reste `En cours` jusqu’à l’exécution des cas d’acceptation restant
ouverts (notamment les combinaisons complètes de reparent, reset, Seek et
répétitions dans le navigateur réel).

### Correction du saut d’endpoint descendant/ancêtre — 2026-09-09

Le saut observé dans la story 6 entre `t=9 180` et `t=9 300` venait de la
résolution des items invalidés à une frontière de mouvement. `resolveChangedItemIds`
comparait auparavant le snapshot `before` au snapshot `after` de l’événement.
Or `after` est capturé à l’endpoint, alors que l’ancêtre B peut continuer son
propre mouvement pendant l’intervalle : une frontière de reflow d’un descendant
faisait donc croire que B avait changé et retargetait Q avec une pose
intermédiaire devenue obsolète.

La résolution distingue maintenant les intentions directes des changements
indirects. Une intention directe reste toujours invalidante ; pour un item
indirect, seule la comparaison `before`/`afterStart` du reflow structurel
invalide la dépendance. Le snapshot `after` reste réservé à la capture de la
pose endpoint et ne peut plus importer l’avancement temporel d’un ancêtre déjà
en mouvement.

Le test de non-régression `does not retarget a child when an ancestor only
advances during an unrelated reflow` couvre précisément ce cas. Validation du
correctif : 31 tests du graphe motion, 2 tests façade de la story 6, puis la
suite CodPlay complète (94 fichiers, 602 tests), les deux typechecks et le build
des démos passent. Safari MCP sur `5173` ne montre plus de discontinuité entre
`9 274` et `9 275` au Seek ; le premier Play réel traverse également la zone
`9 190`–`9 310` sans saut et sans erreur de console.

Le statut reste `En cours` : la matrice navigateur complète de reset, replay,
resize, persistence et lifecycle n’est pas encore exécutée.

### Fixture position — identité physique et rôles transitoires — 2026-09-09

La story 4 ne donne plus aux deux conteneurs des noms permanents `source` et
`target`. Elle expose deux identités physiques, A et B. À chaque occurrence,
le `move` de l'item porte la cible physique effective ; `source` désigne alors
le conteneur opposé uniquement pour décrire la direction de cette occurrence.

Le déplacement de la source courante met à jour sa pose, mais ne produit pas
de nouveau `move` pour l'item. Le déplacement de la cible courante produit un
nouveau `move` vers cette même cible et laisse le graphe motion appliquer le
retarget FIRST courant → LAST projeté. La fixture ne simule donc pas la
dépendance runtime : elle fournit deux moves normaux et vérifie leur ciblage.
Les occurrences planifiées et leur état de cible sont inscrits dans le track
de la story afin que l'alternance A→B→A reste correcte au replay et lors d'un
relâchement pendant le rebond inverse.

## 8. Garde de décision

La règle est validée pour implémentation dans la branche de travail. Elle ne
sera reportée comme décision normative dans [`move-contract-plan.md`](./move-contract-plan.md)
qu’après les validations d’acceptation du §7 ; le plan motion parent conserve
le statut `En cours` jusque-là.

### Régression restaurée — ancêtre de destination nécessaire au premier FIRST/LAST — 2026-09-09

La story 6 a exposé une régression distincte du retarget : au premier passage,
`Qa` était capturé à `1 200 ms`, mais la boundary du cadre de `K`, démarrant à
`2 000 ms`, n’était pas encore dans le graphe. La scène LAST de `Qa` contenait
alors la branche finale de `C` sans la trajectoire de `K`, ce qui orientait le
premier trajet vers `C`. Le phénomène disparaissait après un seek ayant franchi
`2 000 ms`.

Le contrat historique est restauré dans la capture : pour un move dont la
destination gagne un ancêtre monté avant son endpoint, les occurrences `move`
résolues sur cette chaîne et situées dans l’intervalle du move sont préparées
dans la même transaction. Le graphe peut donc composer le LAST de `Qa` avec la
pose de `K` commencée à `2 000 ms`. Cette fermeture reste strictement bornée à
la destination et ne réintroduit pas la découverte globale du journal.

Le test façade `story-six-motion.spec.ts` vérifie que le premier passage de
`Qa` contient déjà le segment du cadre `K` (`2 000 → 9 275 ms`), en plus de la
chaîne FIRST/LAST et de l’absence de retarget parasite. Le statut du plan reste
`En cours` jusqu’à la matrice complète Play, Seek, replay, reset, resize,
persistence et lifecycle.
