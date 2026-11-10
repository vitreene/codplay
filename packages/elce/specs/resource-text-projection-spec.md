# Elcé — projection du texte riche dans les ressources

## Statut

**Fixe — contributions de projection vérifiées dans les éditeurs et les lecteurs Learning et Quiz Hunt.**

## Contrat

Les ressources qui affichent un `AuthoredTextValue` utilisent la projection
neutre `authoredTextToPlainText` par défaut. Une composition de mod peut fournir
`ResourceTextFieldFeature.toPlainText` lorsqu’elle doit présenter ses propres
labels. Learning garde ainsi ses références de profil, ses liens de page, ses
dates locales et les séparations de paragraphes. Une ressource ne dépend jamais
directement d’un mod.

L’aperçu d’une Carte ancrée reçoit la même fonction de projection par les
options d’ancre ; hors injection, il utilise la projection neutre. L’éditeur de
Section reçoit séparément les extensions de texte propres au mod. Le builder
de Section reçoit un `ResourceInlineTextSceneFeature` : Learning y projette ses
liens de page dans les slots CodPlay existants, tandis que Quiz Hunt garde les
libellés de repli et ne crée pas de lien Learning.

Ces contributions ne changent ni le JSON riche stocké ni le markup statique de
Section. La ressource conserve ses builders et commandes existants ; seul le
comportement dépendant du mod est injecté à la frontière de composition.

## Preuves

- [`learning-inline-text-value.test.ts`](../src/mods/learning/inline-text/learning-inline-text-value.test.ts)
  vérifie les labels Learning, les retours de paragraphe et la projection neutre.
- [`remix-statistical-graph-editor.test.tsx`](../src/mods/learning/integration/remix-statistical-graph-editor.test.tsx)
  vérifie les champs auteur du Graphe avec la contribution Learning.
- [`elce-anchor-extension.test.ts`](../src/resources/anchoring/authoring/elce-anchor-extension.test.ts)
  vérifie l’aperçu ancré avec la projection injectable et son défaut neutre.
- [`learning-player.test.ts`](../src/mods/learning/reading/learning-player.test.ts)
  vérifie le montage d’une Carte image dans l’ancre de Section du lecteur réel.
- [`quiz-hunt-player.test.ts`](../src/mods/quiz-hunt/reading/quiz-hunt-player.test.ts)
  vérifie le rendu d’une Section de banque dans le lecteur réel Quiz Hunt.
- [`check-mod-boundaries.mjs`](../scripts/check-mod-boundaries.mjs)
  vérifie que le graphe de production ne comporte aucun import interdit d’une
  ressource ou du core vers un mod.
