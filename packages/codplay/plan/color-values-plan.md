# Acceptation des entrées couleur directes dans ACE

> Statut : **En cours** — la normalisation et l'interpolation couleur de base
> sont décrites dans la [spécification](../specs/color-values-v2-spec.md). Le
> passage direct par `prepareTween` et la validation runtime restent ouverts.
> Décision confirmée le 2026-09-25.

## Périmètre restant

Le code d'ACE fait passer les chaînes CSS prises en charge par la préparation
existante. La spécification couvre le comportement vérifié de
`prepareInterval`, du service `style` et du rendu HTML. Ce plan porte sur les
gates suivants :

- [ ] Vérifier un tween ACE préparé directement avec deux chaînes
      hexadécimales, sans appel explicite à `parseColor` par l'appelant.
- [ ] Utiliser la scène scroll existante comme fixture pour vérifier le passage
      de bornes hexadécimales brutes dans ACE et le vrai player HTML, aux points
      Play et Seek. Cette preuve porte sur la valeur couleur ; elle ne rouvre
      pas l'acceptation de la feature scroll.
- [ ] Mettre à jour la spécification avec tout comportement nouvellement
  certifié, puis retirer ce plan lorsque les gates sont passées.
