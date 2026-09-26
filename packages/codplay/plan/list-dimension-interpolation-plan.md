# Acceptation — dimensions de liste et de ses items V2

> Status: En cours — `move.resize` est compilé et porté jusqu'au host HTML ;
> l'acceptation géométrique de la largeur, de `container` et des combinaisons
> reste ouverte.
> CodPlay version: V2 foundation

La forme auteur de `move.resize` et le comportement vérifié de réservation
`preserve` sont définis dans la [spécification move](../specs/move-v2-spec.md).
Ce plan ne redéfinit pas ce contrat ; il suit les combinaisons de dimension
qui restent à accepter. Les trajectoires, matrices de position et règles de
parentage restent aux spécifications et plans motion.

## Décisions et cas à accepter

Les variantes par axe sont `auto`, `preserve` et `container`. Une propriété de
liste supplémentaire ne sera retenue que si une règle CSS ne suffit pas et que
le runtime doit appliquer une opération de dimension. Ces variantes sont déjà
portées par la compilation et le schedule, mais leur présence dans ces couches
ne vaut pas preuve de leur résultat géométrique.

| Cas | Cible d'acceptation | État |
|---|---|---|
| `auto` | Interpoler les dimensions naturelles CSS FIRST et LAST. | Partiellement exercé dans le cas Firefox `flip-nested`; variantes indépendantes non couvertes. |
| `preserve` | Vérifier la largeur et les combinaisons d'axes ; la hauteur vérifiée est définie par la [spec move](../specs/move-v2-spec.md). | Largeur et combinaisons encore ouvertes. |
| `container` | Résoudre une dimension depuis la place disponible après contraintes et autres enfants. | Code présent, résultat géométrique non vérifié. |
| CSS et overflow | Respecter `min-*`, `max-*`, gaps, flex/grid, contenu intrinsèque et `overflow` sans option auteur redondante. | Matrice complète à vérifier. |

## Acceptation restante

- [ ] Tester largeur seule, hauteur seule et largeur + hauteur simultanées.
- [ ] Vérifier `preserve` sur chaque axe et la restauration des contributions
      transitoires après la dernière frame active.
- [ ] Vérifier `container` sur largeur et hauteur, avec contraintes CSS et
      plusieurs enfants.
- [ ] Vérifier `overflow: clip`, `auto` et `scroll`, ainsi que les limites
      `min-*`/`max-*` et les configurations flex/grid pertinentes.
- [ ] Comparer les mêmes dimensions naturelles, intermédiaires et finales en
      Play et Seek.
- [ ] Rejouer `?demo=flip-nested` avant la frontière, au début, pendant la
      transition, à LAST et sur la frame suivante ; vérifier la disposition des
      voisins et la restauration des styles.
- [ ] Rejouer les non-régressions `flip-stress` et `position` dans le même
      parcours navigateur.

La tranche pourra passer à `Fini` lorsque les cas ouverts auront leurs preuves
ciblées, le parcours navigateur et les non-régressions demandés ci-dessus.
