# Couleurs : un seul espace actif, OKLCH

> Statut : **En cours** — le parseur, la normalisation du compilateur,
> l'interpolation et le rendu HTML sont décrits dans la
> [spécification](../specs/color-values-v2-spec.md). Restent la validation en
> navigateur et l'alignement de l'editor.

## Décisions

- Le compilateur ramène toute couleur auteur CSS Color 4 en OKLCH ; le runtime
  ne connaît que cet espace (2026-11-27).
- ACE accepte encore les chaînes couleur au runtime, par précaution. Ce chemin
  est en voie de dépréciation : les scènes compilées portent déjà des
  `ColorValue` OKLCH. La forme intermédiaire sRGB est dépréciée de la même
  façon.

## Périmètre restant

- [ ] Valider en navigateur, aux points Play et Seek du vrai player HTML, une
      scène dont les bornes de tween mélangent hexadécimal, `hsl()` et
      `oklch()`, et un fondu vers `transparent`.
- [ ] Editor : le test `player-interpolation` attend un mi-parcours rouge →
      bleu calculé en sRGB (`#800080`). Il doit attendre le mi-parcours OKLCH,
      et le correctif `alignColorSpaces` du builder editor devient inutile.
      À faire sur la branche editor.
- [ ] Retirer ce plan quand ces gates sont passées.
