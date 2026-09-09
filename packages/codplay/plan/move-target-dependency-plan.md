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

Validation ciblée exécutée le 2026-09-09 : le test de graphe couvrant le
recalcul direct pendant une trajectoire vérifie l’absence de retour à la pose
initiale, la continuité de la pose à la frontière et la durée restante ; les
28 tests du fichier `motion-graph.spec.ts` passent.

Validation exécutée :

- `npm run test --workspace=codplay` : 92 fichiers, 592 tests passés ;
- typecheck CodPlay et `@codplay/demos` passés ;
- build `@codplay/demos` passé ;
- onglet Safari MCP existant de `5173` : `0` lecture de géométrie pendant le
  `pointermove`, `39` au relâchement, sans erreur runtime. Les 39 lectures
  concernent uniquement la story visible (son root, son stage, ses ancres,
  ses outlets et son item) ; `html`, `body`, le layout de page et les cinq
  autres stories ne sont plus parcourus. La continuité de l’overlay a été
  contrôlée de part et d’autre de la frontière.

Le statut reste `En cours` jusqu’à l’exécution des cas d’acceptation restant
ouverts (notamment les combinaisons complètes de reparent, reset, Seek et
répétitions dans le navigateur réel).

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
