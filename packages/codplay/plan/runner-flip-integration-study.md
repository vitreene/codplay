# Plan d'acceptation intégrée du mouvement HTML

> Statut : **En cours**. La validation Play/Seek complète, les cycles de vie et
> le parcours navigateur restent ouverts après la migration vers la préparation
> motion par occurrence.
> CodPlay version : V2 foundation

## Autorité et périmètre

La forme auteur et la compilation de `move` sont décrites dans la
[spécification `move`](../specs/move-v2-spec.md). Le temps absolu et les
snapshots FIRST/LAST vérifiés figurent dans la
[spécification motion](../specs/motion-frame-v2-spec.md) ; le retarget vers une
target déplacée figure dans sa
[spécification dédiée](../specs/move-target-dependency-v2-spec.md).

La migration de l'architecture du runner et ses tâches d'implémentation sont
suivies dans le [plan de préparation par occurrence](./motion-live-discovery-invalidation-plan.md).
Ce plan porte seulement l'acceptation du chemin HTML réel après cette migration.
Il ne crée pas un autre player, journal, materializer ou circuit de capture.

Les fixtures `position` et `flip-stress` doivent traverser le `RuntimePlayer`,
le materializer et le runner HTML habituels. Elles exposent les scénarios à
accepter ; leur code ne remplace pas le contrat CodPlay.

## Travail restant

### 1. Terminer la migration du runner

Fermer les gates d'implémentation du plan de préparation par occurrence avant
de tirer une conclusion sur cette intégration. La validation ici doit vérifier
que Play et Seek empruntent le circuit migré et que les groupes nécessaires
sont préparés sans publication de frame intermédiaire.

### 2. Rejouer les frontières hiérarchiques

Après la migration, exécuter les cas de non-régression du graphe et du runner
pour :

- mouvements locaux et reparent, y compris le forçage explicite de présentation
overlay ;
- parents source et destination animés indépendamment, enfants locaux et
  chaînes d'ancêtres ;
- chevauchements, remplacement de segment et retarget à une frontière ;
- target ou ancêtre absent au FIRST puis disponible au LAST ;
- ordre de liste, reflow, fermeture de capture live et exclusivité visuelle de
  la source et de son overlay.

Les frontières déjà décrites dans les spécifications restent des invariants de
cette revalidation ; toute nouvelle affirmation n'entre dans une spécification
qu'après implémentation et preuve.

### 3. Fermer Play, Seek et les cycles de vie

Comparer Play et Seek à temps égal aux frontières et au milieu des segments.
Tester les Seek directs dans des ordres d'évaluation différents, puis les
transitions avant, pendant et après reset. Rejouer aussi le resize avec un
mouvement actif, la persistance des materialisations auteur, le replay et la
destruction finale, y compris la libération des ressources overlay.

### 4. Accepter les fixtures dans un navigateur réel

Sur `position` et `flip-stress`, vérifier les débuts, frontières simultanées,
chevauchements, temps intermédiaires et endpoints. Refaire le parcours après
redimensionnement responsive et après reset ; confirmer l'absence de frame
partielle, d'overlay résiduel, d'erreur et de warning inattendu. Inclure Safari
visible dans le relevé d'acceptation.

## Parcours de validation

- Régressions ciblées du graphe, de la capture et du host HTML, dont
  `motion-graph.spec.ts`, `motion-capture.spec.ts` et
  `motion-presentation-host.spec.ts`.
- Cas de frontière exercé par le runner réel, dont
  `story-six-motion.spec.ts`.
- Tests non-régression parent/enfant, reparent, retarget et reflow avant la
  matrice Play/Seek.
- Parcours Play, Seek, reset, resize, persistance et lifecycle ; typecheck et
  build CodPlay et des fixtures V2 concernées.
- Vérification visible dans Safari sur les deux fixtures, avec état final,
  console et absence de ressources transitoires consignés.

Une suite isolée, un typecheck ou un build ne ferme pas l'intégration navigateur.
Les catégories de validation ne peuvent être omises que si l'analyse causale
démontre qu'elles ne sont pas affectées.

## Condition de clôture

Clore ce plan quand la migration décrite par le plan de préparation par
occurrence est intégrée, que les frontières parent/enfant et reparent passent
sur le runner réel, et que la matrice Play/Seek, reset, resize, persistance,
lifecycle, destruction et Safari est acceptée. La spécification ne reçoit que
les comportements alors implémentés et vérifiés.
