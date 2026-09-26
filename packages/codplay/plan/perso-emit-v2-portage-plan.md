# Plan d'acceptation HTML de `Perso.emit` V2

> Statut : **En cours**. La source HTML ordinaire est implémentée et un premier
> sous-ensemble est certifié dans la [spécification](../specs/perso-emit-v2-spec.md).
> Il reste des parcours à vérifier avant de retirer ce plan.

## Périmètre

Ce plan porte sur les événements DOM ordinaires déclarés par `Perso.emit` et
leur intégration au `HtmlPlayerRunner`.

Les comportements compilés et exercés à ce jour sont décrits dans la
[spécification `Perso.emit`](../specs/perso-emit-v2-spec.md). Ce plan conserve
uniquement les validations qui manquent.

## Gates restantes

- [ ] Valider l'émission depuis `visibility: 'scene'` et `visibility: 'public'`,
  ainsi que la valeur par défaut quand `visibility` est omise.
- [ ] Valider les deux modes d'insertion supportés par la règle ordinaire.
- [ ] Valider plusieurs actions déclarées sous un même trigger et leur ordre.
- [ ] Valider le maintien d'un seul écouteur après Seek, reparentage et
  reconstruction, puis son retrait à la destruction.
- [ ] Valider une même scène qui déclare des règles ordinaires et capturées :
  chaque source doit alimenter son propre adaptateur sans double émission.
- [ ] Rejouer dans le navigateur les scénarios qui couvrent ces frontières sur
  le chemin réel `DOM → HtmlPlayerRunner → RuntimePlayer.emit() → dispatcher →
  journal → materializer`.

Les événements immédiats produits par les straps et leur réinjection sont
couverts par la [spécification événementielle](../specs/event-pipeline-v2-spec.md)
et ses tests ; ils ne sont pas une seconde source `Perso.emit`.

## Critère de sortie

Mettre à jour la spécification uniquement avec les comportements de ces gates
qui auront été implémentés et vérifiés. Retirer ce plan lorsque toutes les gates
sont closes et que la spécification décrit le contrat établi.
