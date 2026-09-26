# Plan de validation S6 — capture et glisser-déposer dans une liste

> Statut : En cours. La preview HTML est vérifiée ; le seek navigateur de S6
> n'est pas accepté. Le routage capture V2 est migré et vérifié dans la
> [spécification capture](../specs/capture-v2-spec.md).

## Autorité

La [spécification DnD/list](../specs/list-dnd-v2-spec.md) décrit la preview et
l'intégration vérifiées, avec leurs tests et la preuve Safari du placement.
La [spécification capture](../specs/capture-v2-spec.md) fait autorité sur les
sorties de capture certifiées. Le présent plan ne conserve que les gates S6
non terminées.

La fixture [`drag-scene.ts`](../tests/fixtures/drag-scene.ts) déclare
`visibility: 'scene'` sur l'événement pointeur de départ, ce qui conserve le
routage global attendu par S6.

## Travail restant

### 1. Accepter le seek navigateur de S6

Le dernier parcours Safari a rejeté la commande seek de la telco. Reprendre le
chemin réel de la fixture et identifier la frontière qui rejette la commande
avant de conclure sur sa cause. L'acceptation doit vérifier la trajectoire S6
avant, pendant et après le drop, l'état de la liste, la position de la tête et
le teardown. Une correction éventuelle doit suivre le contrat propriétaire et
son plan accepté ; la démo ne doit pas masquer un défaut runtime.

### Preuve runner après migration

Le 2026-09-26, la validation ciblée du preview, de la compilation S6 et du
`HtmlPlayerRunner` a réussi (3 fichiers, 24 tests). Le test runner exerce
l'ouverture `visibility: 'scene'`, le commit `list` et la reconstruction Seek
sur le runtime réel. Cette preuve ne ferme pas l'acceptance navigateur ci-dessus.

## Critères de clôture

Clore l'intégration lorsque la commande telco Seek est acceptée sur le chemin
HTML réel, avec l'état de liste et la trajectoire persistante corrects. La
spécification ne sera étendue qu'aux comportements alors implémentés et
vérifiés.
