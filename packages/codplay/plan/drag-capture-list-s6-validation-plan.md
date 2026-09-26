# Plan de validation S6 — capture et glisser-déposer dans une liste

> Statut : En cours. La preview HTML est vérifiée ; le seek navigateur de S6
> n'est pas accepté. La migration capture `cascade` vers `visibility` est une
> dépendance distincte, suivie dans le [plan capture](./capture-authoring-plan.md).

## Autorité

La [spécification DnD/list](../specs/list-dnd-v2-spec.md) décrit la preview et
l'intégration vérifiées, avec leurs tests et la preuve Safari du placement.
La [spécification capture](../specs/capture-v2-spec.md) fait autorité sur les
sorties de capture certifiées. Le présent plan ne conserve que les gates S6
non terminées.

La fixture [`drag-scene.ts`](../tests/fixtures/drag-scene.ts) porte encore
`cascade: true` sur l'événement pointeur de départ. Cette valeur relève de la
migration capture suivie dans le plan core.

## Travail restant

### 1. Accepter le seek navigateur de S6

Le dernier parcours Safari a rejeté la commande seek de la telco. Reprendre le
chemin réel de la fixture et identifier la frontière qui rejette la commande
avant de conclure sur sa cause. L'acceptation doit vérifier la trajectoire S6
avant, pendant et après le drop, l'état de la liste, la position de la tête et
le teardown. Une correction éventuelle doit suivre le contrat propriétaire et
son plan accepté ; la démo ne doit pas masquer un défaut runtime.

### 2. Rejouer S6 après migration capture

Après l'application de la migration définie au [plan capture](./capture-authoring-plan.md) :

- remplacer `cascade` sur l'événement de départ par la portée `visibility`
  retenue par le contrat événementiel ;
- rejouer l'ouverture, `endEmit` et `endCapture` par le dispatcher et le journal
  uniques ;
- vérifier le commit `list`, la reconstruction Seek et le parcours navigateur
  accepté au point précédent.

## Critères de clôture

Clore l'intégration lorsque la commande telco Seek est acceptée sur le chemin
HTML réel et que S6 a été rejouée après migration `visibility`, avec l'état de
liste et la trajectoire persistante corrects. La spécification ne sera étendue
qu'aux comportements alors implémentés et vérifiés.
