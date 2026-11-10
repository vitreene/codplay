# Plan d'acceptation — composants `img`, `input` et `polygon` V2

## Statut

> Status: En cours — du code est présent et des comportements ciblés sont
> vérifiés ; les critères de clôture ci-dessous restent ouverts.
> CodPlay version: V2 foundation

Les contrats vérifiés sont séparés par composant :

- [composant image `img`](../specs/image-component-v2-spec.md) ;
- [composant de saisie `input`](../specs/input-component-v2-spec.md) ;
- [composant SVG `polygon`](../specs/polygon-component-v2-spec.md).

## Acceptation restante

- [ ] Exécuter les suites V2 complètes et les typechecks CodPlay/démos avant la
      clôture de cette tranche.
- [ ] Image : vérifier le nombre d'affectations de `src` sur un nœud déjà mis
      en cache pour l'acceptation générale du composant. Le chemin `replace`
      image est vérifié dans les spécifications [média](../specs/replace-media-v2-spec.md)
      et [présentation](../specs/replace-presentation-v2-spec.md).
- [ ] Input : valider dans un parcours quiz réel les états natifs, la sélection
      et la désactivation des réponses, la révélation de correction et les
      classes de résultat. Compléter la preuve du parcours quiz intégré.
- [ ] Décider si l'export V2 `resolveInputStandardActions` fait partie du contrat
      auteur public : il est exposé par le sous-chemin `runtime/components/input`
      et porte les actions quiz compatibles V1, mais aucun consommateur ni test
      V2 du dépôt ne valide sa fusion avec les actions auteur. S'il est conservé
      comme contrat, ajouter sa preuve avant de le décrire dans la spécification.
- [ ] SVG et `polygon` : vérifier les services sur racine et parts ainsi que
      parentage, détachement et destruction dans le materializer.
- [ ] Polygon : exercer Seek avant, pendant et après un morph, puis vérifier le
      retour par reset/replay. Le test runner courant valide les morphs en Play,
      pas le Seek de leur intervalle.
- [ ] Rejouer les parcours HTML concernés dans un navigateur Safari avant de
      déclarer la tranche `Fini`.


Le glyph de correction et le rendu image alternatif sont séparés dans les
[évolutions de composants](./evolutions/evolution-backlog.md#extensions-des-composants-input-et-img).
