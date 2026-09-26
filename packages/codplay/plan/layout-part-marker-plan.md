# Acceptation restante — marqueurs `layout`

> Status: En cours — la découverte et le placement sont spécifiés ; il reste
> l'acceptation du parcours public et du navigateur.
> CodPlay version: V2 foundation
> Contrat vérifié: [`layout-component-spec.md`](../specs/layout-component-spec.md)

Ce plan ne reprend pas le contrat des marqueurs `outlet` et `anchor`, déjà
couvert par la spécification et les tests ciblés. Il conserve les gates
d'acceptation encore ouvertes.

## Acceptation restante

- [ ] Ajouter des preuves des refus de la capacité `markup` pour les
      identifiants de cible dupliqués dans une inscription, les propriétaires,
      stories ou types incohérents, et le double enregistrement d'un composant.
      Le code vérifie ces cas, mais la suite citée ne les exerce pas encore ;
      ils ne sont donc pas certifiés par la spécification.
- [ ] Ajouter une preuve de bout en bout que `partMarkerPrefix` traverse
      `HtmlPlayerRunner` et la façade d'instance jusqu'au parseur ; le test
      actuel ne passe l'option qu'à `materializeTemplateString()` directement.
- [ ] Valider dans un navigateur le montage sur ancre, la conservation de
      l'ordre et l'absence de conteneur généré.
- [ ] Vérifier une composition plus large que la démo 1, notamment plusieurs
      anchors partageant un parent et les combinaisons `anchor`, `outlet` et
      `slot` décrites par la spécification.
- [ ] Mettre à jour la spécification avec les seules observations confirmées
      par ces gates, puis clore le plan.

La validation ciblée du 2026-09-25 passe (5 fichiers, 49 tests) ; elle couvre
le parseur, le solveur, le materializer structurel et la fixture Sighty
existante. Elle ne ferme pas le transport public du préfixe ni les parcours
navigateur et de composition ci-dessus.
