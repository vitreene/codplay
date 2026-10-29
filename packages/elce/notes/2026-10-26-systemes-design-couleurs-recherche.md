# Notes — repères pour la palette dérivée d’Elcé

Cette recherche éclaire la proposition de palette du
[plan Style](../plan/2026-10-22-elce-style-tab-plan.md). Elle ne constitue pas
un contrat implémenté ; les décisions et points ouverts restent dans le plan.

## Repères comparés

- **shadcn/ui est la référence principale pour Elcé.** Ses paires
  `background/foreground`, `card/card-foreground` et
  `primary/primary-foreground` séparent clairement la surface de la couleur
  lisible au-dessus. Les rôles `secondary`, `muted` et `accent` complètent la
  hiérarchie sans demander une couleur par composant. Les valeurs de thème
  documentées sont en OKLCH. Elcé reprend ce principe de jetons et de paires,
  pas ses composants ni ses variables CSS.
- **Tailwind** traite ses valeurs de thème comme les jetons d’un design system,
  puis les expose sous forme de classes utilitaires. L’idée utile est le point
  d’édition central ; l’approche utilitaire n’est pas nécessaire à Elcé.
- **Figma Variables** permet de faire référencer un jeton sémantique par une
  variable primitive. Une modification de la primitive se propage aux alias,
  tandis que le nom sémantique indique l’usage. Ce modèle aide à séparer la
  couleur calculée de sa destination dans le rendu.
- **OKLCH** sépare lumière, chroma et teinte dans un espace conçu pour être plus
  perceptuellement uniforme que CIELCH. Il convient à la génération de variantes
  réglées par petites fonctions compréhensibles ; il ne garantit pas à lui seul
  le contraste ni la validité dans le gamut de sortie.
- **WCAG 2.2** donne les garde-fous de contraste : 4,5:1 pour le texte courant,
  3:1 pour le grand texte et les indicateurs de composants d’interface.

## Proposition Elcé

Sans ajouter ni déplacer de contrôle, conserver les choix auteur « Fond » et
« Couleur du texte ». Fond fournit la teinte maîtresse ; Texte reste la couleur
de premier plan de référence. Le nouveau générateur remplace le circuit actuel
de projection des couleurs et devient l’unique source de rendu dans le lecteur.
Une fonction pure dérive une gamme courte en OKLCH ; une correspondance
sémantique centrale assigne les couleurs documentaires et leurs déclinaisons de
menu/navigation. Le CSS rend les sorties du générateur, sans repli sur les
anciennes classes de palette.

Garder une liste brève de rôles pour la partie documentaire : arrière-plan,
texte courant, titre, intertitre et deux accents coordonnés. Les titres,
intertitres et accents sont appariés à leur fond visible ; le contraste du texte
courant reste prioritaire. Le sommaire/menu et la navigation reprennent cette
gamme sous forme de déclinaisons tonales de la teinte maîtresse, sans palette
autonome. Leur correspondance reste stable sur mobile et desktop.

La première version du générateur gère les couleurs et leur effet direct sur le
padding : une surface qui peint un fond a du padding ; une surface transparente
a un padding nul. Le montant de l’inset et son rapport aux densités actuelles
restent à stabiliser. Les autres règles d’apparence restent hors de ce noyau et
pourront être proposées après sa stabilisation.

La documentation à écrire avec l’implémentation devrait présenter le chemin
des valeurs, les entrées et sorties de chaque fonction, la table région/rôle et
un exemple modifiable. Les paramètres de lumière, chroma, écart de teinte,
gamut mapping et reprise du contraste restent à arrêter dans le plan avant code.

## Sources

- [shadcn/ui — Theming](https://ui.shadcn.com/docs/theming)
- [Tailwind CSS — Theme variables](https://tailwindcss.com/docs/theme)
- [Figma — Variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes)
- [W3C — CSS Color 4, OKLab and OKLCH](https://www.w3.org/TR/css-color-4/#ok-lab)
- [W3C — WCAG 2.2, Contrast Minimum](https://www.w3.org/TR/WCAG22/#contrast-minimum)
- [W3C — WCAG 2.2, Non-text Contrast](https://www.w3.org/TR/WCAG22/#non-text-contrast)
