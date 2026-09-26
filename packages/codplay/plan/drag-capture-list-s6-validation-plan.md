# Plan de validation S6 — capture et glisser-déposer dans une liste

> Statut : En cours. Les unités de preview et le commit logique de la fixture
> S6 sont vérifiés. L'intégration navigateur de bout en bout, dont le seek via
> la telco publique, n'est pas validée. Le routage capture V2 est décrit dans
> la [spécification capture](../specs/capture-v2-spec.md).

## Autorité

La [spécification DnD/list](../specs/list-dnd-v2-spec.md) décrit les
comportements vérifiés et précise les limites de leurs preuves. Aucune démo
V2 actuelle n'exerce le DnD S6. La preuve Safari historique porte sur le
placement visuel de la preview ; elle n'établit pas le parcours S6 de bout en
bout.
La [spécification capture](../specs/capture-v2-spec.md) fait autorité sur les
sorties de capture certifiées. Le présent plan ne conserve que les gates S6
non terminées.

La fixture [`drag-scene.ts`](../tests/fixtures/drag-scene.ts) déclare
`visibility: 'scene'` sur l'événement pointeur de départ, ce qui conserve le
routage global attendu par S6.

## Travail restant

### 1. Rendre le chemin capture → preview exécutable

La preview HTML et la fermeture de capture ne sont pas reliées dans la preuve
runner actuelle. `HtmlListDndPreview` est testé séparément ; le test runner
injecte directement une destination fixe (`list-b`). Il faut établir le point
de composition qui transmet la cible calculée par la preview à la fermeture de
capture. Si cela nécessite une décision d'architecture ou une modification du
cœur, l'inscrire et la faire accepter dans le plan correspondant avant de
modifier le runtime.

### 2. Accepter le parcours navigateur S6

Aucune démo V2 actuelle n'exerce le DnD S6 ; la démo DnD V1 ne constitue pas
une preuve V2. Construire un test navigateur dédié à partir de la fixture
[`drag-scene.ts`](../tests/fixtures/drag-scene.ts), sur la surface publique
CodPlay. Après raccordement du chemin capture → preview, le test doit exercer le
déplacement par pointeur et la résolution géométrique de la cible, puis appeler
`instance.telco.seek` aux instants consignés du journal. Comparer la tête de
lecture, l'appartenance et l'ordre des listes, les compteurs et la position
rendue avant et après replay, puis vérifier le nettoyage au teardown.

Le plan antérieur rapporte un rejet de commande seek par la telco, mais ne donne
ni scénario V2 reproductible, ni instant demandé, ni diagnostic permettant
d'identifier la frontière en cause. Si le rejet se reproduit, conserver ces
éléments avant de conclure à un défaut runtime.

### Preuve runner après migration

Le 2026-09-26, la validation ciblée du preview, de la compilation S6 et du
`HtmlPlayerRunner` a réussi (3 fichiers, 24 tests). Les tests couvrent la
preview en isolation, la sortie compilée et le commit/replay du runner avec un
DOM simulé et une destination de drop injectée. Ils ne prouvent ni la résolution
de cible par géométrie dans le parcours capture, ni le seek de la telco publique
dans un navigateur.

## Critères de clôture

Clore ce plan après preuve navigateur du parcours capture → drop → replay avec
la telco publique, incluant une destination déterminée par le vrai pointeur,
l'état de liste cohérent et le teardown. La spécification ne sera étendue
qu'aux comportements alors implémentés et vérifiés.
