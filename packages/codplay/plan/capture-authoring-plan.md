# Capture continue V2 — plan core

## Statut

La spécification [capture V2](../specs/capture-v2-spec.md) décrit le cycle
source-agnostique et les sorties live vérifiés. La décision d'utiliser
`visibility` pour les événements capturés est prise, mais n'est pas appliquée.
Elle reprend les valeurs et le routage déjà vérifiés pour les événements V2
dans la [spécification du pipeline événementiel](../specs/event-pipeline-v2-spec.md) ;
sa migration et sa validation restent dans ce plan, donc la tranche demeure
`En cours`.

La fixture HTML S5 avait été validée pour le contrat antérieur. Sa reprise et
son acceptance sous le contrat `visibility` sont suivies dans le
[plan de validation S5](./capture-s5-validation-plan.md).

## Objectif

Appliquer la décision de portée ci-dessous à la représentation auteur, la
compilation, le codec, l’adaptateur de source et le player, puis valider le
chemin réel avec les tests de frontière et la fixture S5.

## Travail restant

### 1. Migration de portée

Remplacer `cascade` par `visibility` sur :

- l’événement qui ouvre une capture ;
- `endEmit` ;
- chaque événement produit par `endCapture`.

Pour chaque déclaration existante, choisir explicitement la portée nommée qui
préserve son destinataire : story, scène ou public. L'ancien booléen `cascade`
ne déclare pas à lui seul une publication publique. Le routage ordinaire quand
`visibility` est absente est décrit par la
[spécification événementielle](../specs/event-pipeline-v2-spec.md) ; conserver
le `storyId` ou la cible globale nécessaire à ce comportement.

Aligner les types auteur et compilés, la validation, la compilation, le codec,
l’adaptateur de source HTML et le contrôleur de capture. Le contrat n’ajoute
aucun chemin alternatif au dispatcher.

### 2. Routage, journal et reconstruction

Vérifier le comportement des portées `story`, `scene` et `public` par le
circuit existant. `public` rend l’événement observable par l’hôte sans
transport automatique vers une autre instance. La visibilité absente suit le
défaut des événements V2 ordinaires décrit par la
[spécification événementielle](../specs/event-pipeline-v2-spec.md).

Préserver les règles de la spécification : `endEmit` suit l’insertion ordinaire
(`apply-now` par défaut), les événements de `endCapture` restent
`persist-only`, et un seek ne rejoue ni samples ni actions live.

### 3. Validation core

Ajouter ou mettre à jour les tests de frontière pour couvrir :

- déclaration, compilation, codec et types sérialisés sans `cascade` sur le
  chemin V2 ;
- portée `visibility` de l’événement d’ouverture, de `endEmit` et de chaque
  sortie `endCapture` ;
- routage `story`, `scene` et `public` par le dispatcher et le journal uniques ;
- `apply-now` et `persist-only`, y compris l’absence de double application à
  la fermeture ;
- seek, annulation, sérialisation et observation publique ;
- maintien du comportement live et de l’ordre des actions compilées.

Les tests core possèdent leurs fixtures. Ils utilisent une source abstraite et
un materializer de test ; ils ne dépendent pas des scènes, timings ou valeurs
des démos.

### 4. Révalidation HTML

Mettre à jour la fixture S5 et son parcours d’intégration lorsque le contrat
est implémenté. Valider l’adaptateur pointeur, la telco, Play, Seek, fermeture,
seconde capture, teardown et scopes `visibility` sur le vrai chemin HTML. Le
détail de cette acceptation pour S5 est dans le
[plan S5](./capture-s5-validation-plan.md). La fixture de capture DnD S6 utilise
également `cascade` sur son événement de départ et doit être migrée puis
revalidée selon son [plan de validation DnD/capture S6](./drag-capture-list-s6-validation-plan.md) ;
cette gate distincte n'est pas couverte par S5.

## Condition de clôture

Passer cette tranche à `Fini` lorsque :

- toutes les frontières V2 de capture utilisent `visibility` et rejettent
  `cascade` ;
- les tests source-agnostiques couvrent les sorties, le dispatcher, le journal,
  le seek et la sérialisation ;
- la fixture S5 traverse le vrai chemin HTML et la telco avec les portées
  attendues ;
- la spécification, le suivi et les références de documentation correspondent
  au comportement validé.
