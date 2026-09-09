# Note d’étude — échelle des optimisations motion V2

## Statut

> Type : note d’examen, non contractuelle
> Date : 2026-09-06
> Version CodPlay : V2 foundation

Cette note conserve l’examen de la lenteur observée dans la scène `position`
et les pistes évoquées. Elle ne constitue pas une autorisation de modifier le
journal, le player ou le contrat d’événement. Ses décisions du 2026-09-06 sont
remplacées par la note du 2026-09-07 et par le plan central de préparation
motion ; elle reste utile pour les mesures de référence.

## Constat mesuré

La mesure a été effectuée dans Safari Technology Preview, après rechargement
complet de la démo. La limite de capture au conteneur de story avait déjà été
appliquée.

| Transition | Avant la limite story | Après la limite story |
| --- | ---: | ---: |
| story 4 → story 5 | 6 244 mesures | 2 116 mesures |
| story 5 → story 4 | 1 716 mesures | 724 mesures |

Pour la story 5, les 2 116 mesures restantes comprennent notamment 516
mesures de la racine de story et 512 du stage. Les ancêtres du layout général
ne sont plus parcourus. Aucun message `error` ou `warn` n’a été relevé dans la
console Safari Technology Preview.

La géométrie ne croît donc plus à chaque passage. La lenteur résiduelle est
distincte : le journal conserve les faits, tandis que la révision globale du
journal provoque encore une relecture des plans et peut invalider la timeline
structurelle. Ce comportement est une limite d’implémentation observée, pas
une nécessité du contrat CodPlay.

## Pistes examinées

### 1. Révision incrémentale du journal

Un curseur d’événements, un index par `eventSeq` et une compilation delta
réduiraient les rescans de `getAllEvents()` et de `compileMotionSchedule()`.
Cette piste est jugée disproportionnée pour le problème actuel : elle est
mise de côté et ne doit pas être ajoutée au journal comme patch local.

### 2. Invalidation séparée des graphes

À long terme, il serait possible de distinguer les invalidations logique,
structurelle, motion et géométrique. Cette conception doit être examinée au
niveau global de la bibliothèque, avec des mesures sur plusieurs usages ; elle
n’est pas introduite dans la scène `position`.

### 3. Réutilisation de géométrie stable

La racine et le stage représentent une part importante des mesures restantes.
Un cache de poses stables pourrait être étudié dans une future optimisation du
présentateur HTML, avec invalidation explicite par `resize`, changement de
style d’un ancêtre ou reparent. Il ne faut pas le déduire d’une seule démo ni
le confondre avec une modification du journal.

### 4. Signal de présentation intentionnel

Un événement de présentation pourrait indiquer qu’un conteneur est présenté
et permettre de différer une capture motion. Ce signal ne devrait ni filtrer
les événements, ni créer un cycle de vie `active/inactive`, ni être déduit par
inspection du DOM. Cette piste est écartée pour cette tranche : l’occurrence
`move` fournit déjà le déclencheur précis, sans évaluation de présentation.

### 5. Représentation compacte des répétitions

La représentation interne de `repeat(20)` pourrait un jour éviter de développer
immédiatement toutes les occurrences. La sémantique et le nombre d’occurrences
doivent rester identiques. Cette piste est indépendante de la limite story et
ne justifie aucune modification de la démo.

## Décision au 2026-09-06 — remplacée

- conserver la limite de capture au conteneur de story ;
- ne pas ajouter de détection automatique de visibilité par le DOM ;
- ne pas introduire de cycle de vie `active/inactive` ;
- traiter la préparation motion dans le plan global suivant, sans modifier la
  démo pour masquer la limite.

Le plan désormais applicable est
[`../motion-live-discovery-invalidation-plan.md`](../motion-live-discovery-invalidation-plan.md).
Il autorise une modification coordonnée du player et du runner afin de
transporter l’occurrence `move`, tout en conservant le journal comme histoire
logique et la limite de capture story-local.

La scène `position` reste une validation du comportement du core. Elle ne doit
pas devenir le support d’une architecture spéciale destinée à masquer cette
limite de performance.

## Observation à reprendre — 2026-09-09

Les mesures de la démo `position` montrent une durée JavaScript qui peut
augmenter alors que le nombre de lectures géométriques et de mutations DOM
reste relativement stable. L’hypothèse prioritaire est donc une dépense de
construction du graphe motion, indépendante du nombre de mutations visibles.

Trois opérations paraissent particulièrement coûteuses et doivent être
réexaminées avant toute nouvelle mesure de freeze :

- `buildMotionGraphStructure()` appelle `freezeMotionGraph()` après chaque
  boundary, alors que la construction dispose déjà de `mutableTracks` et que
  cette vue intermédiaire ne sort pas du builder ;
- `freezeMotionGraph()` recopie tous les tracks puis sérialise le graphe entier
  par `JSON.stringify`, y compris les attachments et leurs contextes. La même
  opération est répétée pendant les remplacements de segments, puis une
  dernière fois pour le graphe final ;
- `buildMotionGraph()` construit un `NaturalLayoutTimeline` pour résoudre les
  opérations, puis `HtmlMotionSystem.rebuild()` reconstruit la même timeline
  pour la présentation.

Questions à résoudre lors de la reprise :

1. Un contrat actif exige-t-il réellement un `freeze` sur le graphe final
   exposé au système de présentation ? Aucun `freeze` intermédiaire ne doit
   être conservé pour protéger le code contre une future erreur interne.
2. `MotionGraph.revision` doit-il réellement être une sérialisation complète,
   ou un identifiant stable et peu coûteux suffit-il pour les usages actuels
   (frame, diagnostic et réutilisation) ?
3. Peut-on transférer la timeline calculée par `buildMotionGraph()` à
   `HtmlMotionSystem` afin d’éviter la seconde construction ?

Piste d’optimisation à évaluer : conserver une représentation de travail
mutable pendant la planification, supprimer les `freeze` intermédiaires et
partager la timeline déjà calculée. Un `freeze` final ne peut rester que s’il
répond à un contrat actif et démontré ; il ne peut pas être justifié par une
programmation défensive dans le chemin chaud du player. Cette piste n’est pas
encore autorisée ni implémentée ; aucune optimisation ne doit supprimer la
preuve de régression Qa/K ou remplacer une mesure par un cache DOM non
invalidé.

### Correction de cadrage — 2026-09-09

La qualification d’une protection défensive contre de futures erreurs de
programmation est explicitement rejetée pour les parties chaudes du player.
Le code interne est l’unique propriétaire de ces structures et le graphe
intermédiaire n’est pas exposé. Un `Object.freeze()` ou une sérialisation ne
peuvent donc être maintenus à cet endroit qu’en présence d’une exigence
contractuelle précise ; sinon ils constituent un coût injustifié à retirer.
