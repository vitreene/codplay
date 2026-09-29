# Plan V2 — PoC de désignation Avatar vers un perso immobile

> Statut : **En cours — cadrage opérationnel**. La première tranche vise une
> cible immobile. Le suivi d'une cible mobile est une tranche ultérieure ; son
> exploration reste dans
> [`notes/2026-09-29-suivi-de-perso-strap-fonction-action.md`](./notes/2026-09-29-suivi-de-perso-strap-fonction-action.md).
> Aucun contrat ni changement du core n'est encore validé par ce plan.
>
> Contrats applicables : [`../specs/avatar-gesture-spec.md`](../specs/avatar-gesture-spec.md),
> [`../specs/avatar-gaze-spec.md`](../specs/avatar-gaze-spec.md),
> [`../specs/third-party-target-bridge-spec.md`](../specs/third-party-target-bridge-spec.md)
> et [`../specs/third-party-threejs-spec.md`](../specs/third-party-threejs-spec.md).

## 1. Résultat de la première tranche

Un perso `avatar-gesture` reçoit une action de désignation vers un autre
**perso de scène** visible, par exemple un texte ou une image. Plusieurs
avatars peuvent coexister : `rel.target` désigne l'avatar acteur, tandis que
l'instruction de désignation porte l'identité du perso visé. Un strap peut
choisir et émettre cette instruction par le circuit normal des événements.
Il ne s'exécute pas pendant les frames.

La cible, l'avatar acteur et la caméra restent immobiles pendant le geste.
Le bras et la main pointent vers le centre visible du perso cible ; le buste
prend une légère orientation plausible. Les variantes demandées restent dans
ce PoC : bras gauche ou droit, index tendu ou paume ouverte, coude plié ou
bras tendu relaxé, tête vers la cible ou la caméra. L'action peut avoir une
durée, être terminée explicitement ou être interrompue par un autre geste.
Chaque propriété reçoit un défaut dans le contrat à fixer avant le code.

Le geste utilise la pose cible mesurée par la présentation et une ancre de
l'avatar dans le même repère. Un changement de taille de scène peut déplacer
la cible à l'écran sans action auteur : le resize doit donc réévaluer la
désignation. Play et Seek doivent présenter une direction cohérente au même
temps logique. Aucune position d'un Seek précédent ne peut servir de cible.

Le déplacement de la cible par `move`, style ou DnD, ainsi que le déplacement
de l'avatar ou de la caméra pendant le geste, restent dans le périmètre final.
Ils ne conditionnent pas la validation de cette première tranche. Le contrat
retenu pour la cible immobile doit permettre leur extension sans refaire le
geste ni créer un autre circuit de capture.

## 2. Réutilisations et manque actuel

- TalkingHead fournit les formes `index`, `point` et `handup`, ainsi qu'une
  chaîne IK de main. La motion existante `avatar:gesture:point` est finie et
  sans cible ; elle garde son contrat. `point-at` est le nom provisoire du
  geste ciblé.
- `captureHtmlLayoutSnapshot` mesure déjà un perso monté sélectionné et ses
  ancêtres dans un repère numérique. Elle opère sur les identités de persos,
  sans parcourir des éléments DOM quelconques. Son test autonome passe.
- `instance.presentation.get()` expose seulement les items possédant une
  trajectoire dans le graphe de mouvement. Une cible immobile peut donc en
  être absente, voire ne disposer d'aucune frame de mouvement. Ce port ne
  fournit pas à `avatar-gesture` la pose demandée.
- Le strap V2 ne reçoit pas la géométrie de présentation. La forme des
  fonctions d'action suggère de séparer le fait journalisé et le calcul pur,
  mais la `TweenAction` actuelle exige une durée et ne reçoit que
  `{ progress, data }`. Elle ne donne pas directement la pose cible.
- `componentRuntime.presentAt(t)` précède actuellement la matérialisation
  HTML. La disponibilité de la mesure pour un geste à `0 ms`, au Seek direct
  et après resize doit être décidée explicitement dans le pipe commun.
- `avatar-gaze` connaît aujourd'hui `camera` et `ahead`, mais pas un perso
  de scène comme cible du regard. La variante « tête vers la cible » demande
  une évolution explicite de sa composition avec le geste.

## 3. Ordre de travail et preuves

### Étape 1 — fixer le contrat de la cible statique

Définir l'identité de perso cible dans l'action choisie par le strap, son
point visé par défaut, le repère commun à la cible et à l'ancre Avatar, et
le résultat lorsque la cible est absente ou démontée. Définir la fin et le
remplacement de l'action dans la track geste. La même instruction doit être
rejouable au Seek sans réexécuter le strap. Une action ne contient pas une
position figée par l'auteur : la mesure appartient à la présentation.

Décider où la mesure ciblée existante est préparée pour une cible sans
`move`, et dans quel ordre elle est transmise à `avatar-coordinate` à
`0 ms`, au Seek et après resize. Ne pas introduire un accès direct du
composant au DOM, au runner ou à la façade d'authoring. Documenter ce raccord
dans les spécifications concernées après validation du contrat et obtenir
l'autorisation explicite avant toute modification de `packages/codplay`.

### Étape 2 — prouver le raccord de pose, sans Avatar

Construire une fixture autonome avec un perso texte immobile, puis un perso
image immobile. Vérifier, par identité de perso, le centre numérique mesuré
après matérialisation et transmis à un consommateur synthétique. Couvrir un
déclenchement à `0 ms`, un déclenchement ultérieur, un Seek direct avant et
pendant l'action, un Seek répété, un resize et une cible absente. La fixture
emprunte le player et le matérialiseur réels ; elle n'introduit ni second
journal, ni événement par frame, ni mesure prise directement dans la démo.

**Gate :** le consommateur reçoit la même cible visible en Play et en Seek,
et le resize met à jour sa position avant la nouvelle présentation du geste.
Une absence de cible donne le résultat défini par le contrat, jamais une pose
périmée.

### Étape 3 — fixer puis réaliser `point-at`

Compléter `avatar-gesture` et `avatar-gaze` avant le code. Déclarer les
variantes de main, coude, bras et regard, leurs défauts, la durée facultative,
`release` et l'interruption par un autre geste. Le défaut proposé à vérifier
sur le modèle est : centre de la cible, bras droit, index tendu, coude plié,
regard caméra. Sans durée, le geste reste actif jusqu'à `release` ou son
remplacement. La motion TH `point` existante reste intacte.

Projeter l'épaule et le centre cible dans le même repère, puis calculer angle
et distance. Réutiliser les formes de main TH et la chaîne IK existante pour
orienter bras, coude, poignet et doigt ou paume. Borner les articulations et
la rotation légère du buste ; vérifier la plausibilité sur le modèle réel.
La variante tête vers la cible passe par la composition Avatar et restitue
ensuite la contrainte propre à `avatar-gaze`. Le geste ne pilote ni lip-sync,
ni mood, ni track `word`, et n'ajoute aucun rendu Three.

### Étape 4 — valider la première tranche

Tester avec des fixtures autonomes : texte, image, deux avatars visant des
cibles distinctes, les variantes de bras/main/coude/tête, cible hors portée,
durée, `release`, interruption, cible absente et remontée. Comparer Play et
Seek avant, pendant et après les transitions du geste ; vérifier resize,
replay, lifecycle et l'indépendance de mood, lip-sync et des gestes TH.

Exécuter ensuite les tests et typechecks des packages touchés, le build de
la démo, puis la scène réelle dans Safari TP avec Play, Seek et resize. La
démo exprime le scénario auteur et ne corrige pas localement le runtime.
Mettre à jour les spécifications et le suivi d'implémentation avant de
marquer la tranche terminée.

## 4. Suite : cible mobile

Après validation du geste statique, reprendre le suivi réutilisable décrit
dans la note liée en tête de plan. Le strap sélectionne la relation
suiveur/cible par un fait journalisé ; une fonction de présentation évalue
la pose du perso cible pendant l'action. Cette tranche vérifiera séparément
une cible déplacée par `move`, par style puis par capture interactive, ainsi
que les cas d'avatar ou de caméra mobile. Elle conservera le même geste et
la même identité de cible.

## 5. Critère de fin du PoC statique

Un Avatar désigne un perso texte ou image immobile avec une pose plausible.
Les variantes, les interruptions et le retour fonctionnent sur le modèle
réel ; Play, Seek et resize restent cohérents ; le parcours complet du
player, du matérialiseur et d'Avatar est validé sans correction propre à la
démo.
