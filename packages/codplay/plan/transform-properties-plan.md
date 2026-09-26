# Plan d'acceptation — canaux de transformation V2

## Statut

> Status: En cours — la projection vérifiée est décrite dans la
> [spécification](../specs/transform-properties-v2-spec.md) ; la couverture des
> autres canaux et defaults reste à établir.
> CodPlay version: V2 foundation

## Acceptation restante

- [ ] Ajouter des preuves pour l'alias `z`, les canaux restants et leur ordre
      complet de composition.
- [ ] Établir les identités et les règles de borne source des canaux qui ne
      figurent pas dans la [spécification vérifiée](../specs/transform-properties-v2-spec.md).
- [ ] Vérifier les options `loop` et `alternate` au travers d'ACE, de la
      résolution logique et du runner HTML, y compris leurs frontières Play/Seek.
- [ ] Décider si et comment les defaults des autres familles de propriétés sont
      introduits ; ils ne font pas partie du contrat transform actuellement
      certifié.
- [ ] Compléter la validation navigateur de la présentation HTML avant de
      déclarer cette tranche entièrement `Fini`.

La forme publique `UnitValue` reste suivie séparément dans le
[plan des unités](./unit-values-plan.md). La conversion des longueurs au rendu
est décrite dans la [spécification des unités](../specs/unit-values-v2-spec.md).
