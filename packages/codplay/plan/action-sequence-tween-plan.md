# Plan d'acceptation — ActionSequence et TweenAction V2

## Statut

> Status: En cours — le comportement partiellement vérifié est décrit dans la
> [spécification](../specs/action-sequence-tween-v2-spec.md) ; les cas
> d'acceptation restants ci-dessous ne sont pas certifiés.
> CodPlay version: V2 foundation

## Travail restant sur le contrat logique

- [ ] Vérifier les offsets `startAt` et la durée implicite d'un `TweenAction`
      dans une `ActionSequence` ; vérifier que `durationMs` remplace cette
      durée implicite et que le pas suivant est chaîné sur la durée retenue.
- [ ] Vérifier le remplacement d'un pas séquencé contenant une `TweenAction`.
- [ ] Vérifier `tween:stop` lorsqu'il rencontre une `TweenAction` dans une
      séquence. Le test actuel intitulé « direct and sequenced » n'exerce que le
      cas direct.
- [ ] Fixer et valider le contrat des fonctions qui retournent `undefined`, un
      payload invalide ou qui lèvent une exception ; le résolveur contient déjà
      des branches pour ces résultats, mais les tests ciblés ne les établissent
      pas encore.
- [ ] Vérifier que l'expansion d'une séquence reste dérivée de l'occurrence
      source sans ajouter d'événement au journal.

La validation ciblée existante est donnée dans la spécification. Compléter ces
cas par des tests du pipeline et du player avant d'étendre la portée de la
spécification ou de marquer cette tranche `Fini`.

Les extensions auteur sont séparées dans le
[plan des évolutions à affecter](./evolutions/evolution-backlog.md#comportements-temporels-et-exposition-auteur-ace).
