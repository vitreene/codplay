# Suivi d'un perso de scène — frontière strap et fonction d'action

> Statut : exploration à valider avant modification des contrats V2.
> Plan : [`../2026-09-29-avatar-pointing-gesture-poc-plan.md`](../2026-09-29-avatar-pointing-gesture-poc-plan.md).

La première tranche du plan vérifie la désignation d'un perso **immobile**.
Le suivi continu décrit ci-dessous est conservé pour la tranche suivante ;
il ne conditionne pas l'acceptation du PoC statique.

## Besoin

Le même comportement « désigner un perso puis suivre sa position visible » doit
servir au bras d'un avatar et, par exemple, à une flèche SVG qui suit un texte.
Le déclenchement du suivi et celui du mouvement de la cible sont indépendants.
Une seule instruction ouvre ou ferme le suivi ; la position est capturée
dynamiquement pendant la présentation, sans événement par frame.

## Contrats existants

- Un strap V2 s'exécute lors d'un événement. Ses sorties deviennent des faits
  journalisés. Le contrat exclut `context.live`, `onUpdate` et les émissions
  cadencées par les frames. Seek relit les faits sans réexécuter le strap.
- Une `TweenAction` utilise une fonction compilée, extraite dans la collection
  de fonctions du build. Le résolveur appelle cette fonction pure avec
  `{ progress, data }` et applique son résultat comme action ordinaire.
- Une `TweenAction` exige une durée positive et sa fonction ne reçoit ni pose
  de perso, ni géométrie de présentation. Elle ne résout donc pas directement
  un suivi potentiellement illimité d'un perso mobile.
- La présentation HTML possède des poses numériques à date absolue pour les
  items dont la trajectoire demande une présentation. Le port public
  `instance.presentation.get()` ne fournit donc pas les positions de tous les
  persos visibles. Ces poses ne font actuellement pas partie de l'entrée des
  fonctions d'action ni de l'entrée des composants.

## Vérification du chemin des poses

- `captureHtmlLayoutSnapshot(root, persoNodes, scene, selection)` part des
  identités de `scene.persos`. Avec une sélection, il mesure seulement les
  persos montés demandés et leurs ancêtres ; il ne parcourt pas des éléments
  DOM arbitraires. Le test `layout-snapshot.spec.ts` confirme une pose numérique
  dans le repère de la racine de story pour un perso statique.
- Cette capture intervient aujourd'hui pour préparer une occurrence de
  mouvement. Sans frontière de mouvement, `HtmlPlayerMotionController` peut ne
  pas créer de `HtmlMotionSystem` ; `instance.presentation.get()` peut alors
  retourner `null`. Même lorsqu'un système existe, sa frame émet uniquement
  `graph.presentationItemIds`, les propriétaires de trajectoire. Un perso
  statique suivi n'y figure pas nécessairement.
- Si un `LayoutSnapshot` contient l'item suivi, `resolveMotionItem` sait
  calculer sa pose à `t` avec sa chaîne de parents, y compris si cet item ne
  possède pas de segment propre. Ce calcul réutilise le graphe et la capture
  numériques du mouvement ; il ne demande pas une mesure DOM par frame.
- La matérialisation actuelle ne transporte vers ce graphe que les actions
  contenant `move`. Une action de style seule, par exemple un tween
  `translateX`, est résolue et appliquée au perso par le circuit de style,
  mais n'ouvre pas une occurrence de mouvement dans
  `collectMoveOccurrences`. `resolveHtmlMotionActionTransition` sait reconnaître
  un tel style lorsqu'on lui donne l'action ; cela ne prouve pas que le player
  lui transmet actuellement cette action. Le graphe ne peut donc pas être
  déclaré source générale de la position de tout perso animé.
- La présentation actuelle appelle `componentRuntime.presentAt(t)` avant que
  `MotionMaterializer` ne présente la frame HTML. La dernière frame exposée
  peut donc convenir au retard admis en Play, mais elle ne suffit pas pour
  garantir un Seek direct : la géométrie du temps demandé peut être préparée
  seulement après la présentation du composant.

Conséquence pour la tranche statique : la cible est un **perso** désigné par
identité, et la capture ciblée existante est le candidat pour mesurer sa pose.
Son accès au geste à `0 ms`, au Seek et après resize reste à décider. La
tranche de suivi continu devra ensuite lire aussi la pose d'un perso déplacé
par `move` ou par une action de style seule. Le raccord de ces trajectoires ne
constitue pas encore une capacité du runtime.

## Forme à étudier pour le suivi continu

La proposition emprunte **la séparation** des fonctions d'action, sans
réutiliser leur signature actuelle hors de son contrat :

```text
événement -> strap -> fait journalisé -> action de suivi active
                                     -> présentation : position + fonction pure
                                     -> donnée de suivi -> consommateur
```

1. le strap, exécuté une fois sur l'événement, émet par le circuit normal le
   fait qui sélectionne une action de suivi déclarée pour un suiveur et une
   cible de scène ; une action ultérieure la remplace ou la termine ;
2. la présentation fournit la pose du **perso cible** pendant la période
   active, qu'il soit immobile, déplacé par `move` ou déplacé par une action de
   style ; le consommateur définit son ancre de départ dans le même repère ;
3. une fonction pure précompilée reçoit ces positions, le temps et les
   paramètres de l'action, puis produit une donnée de suivi ;
4. l'application propre au consommateur transforme cette donnée en pose IK
   Avatar ou en géométrie de flèche SVG. Elle ne choisit pas la cible et ne
   recapture pas elle-même le perso suivi.

Cette forme est une proposition de contrat, pas une API existante. La fonction
ne doit pas être créée ou retournée dynamiquement par le strap :
les fonctions auteur existantes sont extraites au build et référencées dans
la scène compilée. Le journal conserve une sélection et des paramètres
sérialisables, pas un callback runtime. L'évaluateur ne réexécute ni le strap
ni le dispatcher pendant les frames.

## Décisions de contrat nécessaires

- Où est déclarée la fonction de suivi et quelle instruction journalisée la
  sélectionne ? La `TweenAction` actuelle ne peut pas être étendue par simple
  convention de données, car elle est bornée par une durée et évaluée avant la
  disponibilité de la géométrie présentée.
- Quelle surface de la présentation fournit la position numérique d'un perso
  immobile aussi bien que mobile, à partir des captures et calculs de
  présentation existants, sans imposer le DOM ou Three.js au strap ? Comment
  un perso suivi sans `move`, notamment avec un tween de style, reçoit-il une
  pose numérique cohérente sans créer un second circuit de mouvement ?
- Comment le suiveur exprime-t-il sa propre ancre, notamment l'épaule de
  l'avatar, alors qu'une flèche SVG utilise une autre ancre ?
- À quel point du pipe existant les positions sont-elles échantillonnées en
  Play, Seek et resize ? Un retard d'une frame en Play a été admis pour la
  future cible mobile ;
  un Seek ne doit pas conserver une position issue d'une ancienne date. Il faut
  notamment décider quand la pose de la cible est disponible pour
  `componentRuntime.presentAt(t)` après la préparation d'un Seek.
- Quels changements de layout imposent une nouvelle capture ciblée du perso
  suivi, notamment resize, démontage, remontage et reparentage ?
- Quelle règle s'applique à une cible démontée ou momentanément indisponible ?

Ces décisions précèdent l'extension éventuelle du contrat des straps et des
actions pour une cible mobile. Après le PoC statique, l'acceptation du suivi
générique devra montrer une cible texte et une flèche SVG synthétique, puis
raccorder l'Avatar au même résultat sans second circuit de capture.
