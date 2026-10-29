# Repères de typographie pour le contenu Elcé

Recherche du 25 octobre 2026 pour compléter le
[plan Style](../plan/2026-10-22-elce-style-tab-plan.md).
Cette note rassemble des références et leur contexte. Les valeurs retenues
pour Elcé seront déterminées par les essais suivis dans le plan.

L’utilisateur retient l’ensemble de [Practical Typography](https://practicaltypography.com/)
comme référence pour les variantes de densité. Le rythme du texte se construit
en associant interligne, paragraphes, titres et marges, avec des réglages
adaptés à chaque police et à chaque rôle de contenu.

## Sources et portée

| Source | Repère documentaire | Contexte et portée pour Elcé |
| --- | --- | --- |
| [Butterick — longueur de ligne](https://practicaltypography.com/line-length.html) | Moyenne de 45 à 90 caractères, espaces compris. | Guide typographique général, couvrant notamment la composition imprimée. Une plage à comparer, sans fixer le seuil d’Elcé. |
| [Baymard — longueur de ligne](https://baymard.com/research-articles/line-length-readability) | Environ 50 à 75 caractères pour le corps de texte ; ajustement de la largeur selon la police. | Recherche sur la lecture à l’écran en e-commerce, dont les descriptions de produits. Ce contexte diffère du contenu pédagogique composé dans Elcé. |
| [Butterick — taille](https://practicaltypography.com/point-size.html) | Ajuster le corps à la police et à la composition. | Repère de confort sans taille universelle. Un plancher de sécurité ne définit pas à lui seul une taille de lecture. |
| [Butterick — interligne](https://practicaltypography.com/line-spacing.html) | Interligne de 1,20 à 1,45 fois le corps pour de nombreux textes. | Repère de composition à comparer aux lignes, aux familles et aux supports réellement employés. |
| [Butterick — espace entre paragraphes](https://practicaltypography.com/space-between-paragraphs.html) | Espace de l’ordre de 0,5 à 1 fois le corps ; espacement porté de préférence après le paragraphe. | Les paragraphes doivent rester distincts et former un ensemble continu. Ce repère s’exprime naturellement en `em`. |
| [Butterick — espace avant et après](https://practicaltypography.com/space-above-and-below.html) | L’espace participe à la mise en valeur ; un titre doit rester visuellement proche du texte qu’il introduit. | Comparer les marges autour des titres avec le rythme des paragraphes dans chaque densité. |
| [Butterick — titres](https://practicaltypography.com/headings.html) | La hiérarchie visuelle peut s’appuyer sur des espacements et des différences de corps mesurées. | Évaluer les titres avec leur contenu environnant, en complément du réglage du corps courant. |
| [Butterick — marges de page](https://practicaltypography.com/page-margins.html) | Les marges délimitent la zone de texte et influencent la longueur des lignes ; les dimensions adaptées dépendent du support. | Examiner la relation entre largeur de lecture et espace périphérique dans la composition Elcé existante. |
| [CSS-Tricks — interpolation avec clamp](https://css-tricks.com/linearly-scale-font-size-with-css-clamp-based-on-the-viewport/) | Interpolation entre deux tailles et deux largeurs, bornée par `clamp()`. | Méthode de calcul, qui ne choisit ni les bornes de confort ni la largeur de lecture à notre place. |
| [MDN — unités de longueur](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length) | `ch` mesure l’avance du glyphe « 0 » ; `em` et `rem` dépendent des tailles de police. | Une largeur en `ch` ne garantit pas un nombre identique de caractères avec une police proportionnelle. |
| [MDN — requêtes de conteneur](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries) | `cqi` représente 1 % de la dimension en ligne d’un conteneur de requête. | Une Carte étroite peut demander une adaptation différente d’une page large dans le même viewport. L’existence et le rôle du conteneur doivent être vérifiés. |
| [MDN — clamp](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp) | Minimum, expression préférée et maximum. | Les limites et les unités doivent aussi permettre l’agrandissement du texte. La présence de `clamp()` ne suffit pas à valider ce comportement. |
| [W3C — espacement du texte, 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) | Tolérer notamment un interligne de 1,5 et un espace après paragraphe de 2 fois le corps, avec les autres espacements de ce critère, sans perte de contenu ni de fonction. | Il s’agit de supporter des réglages utilisateur ; ces valeurs ne sont pas des valeurs par défaut imposées à tous les paragraphes. |
| [W3C — présentation visuelle, 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html) | Le critère AAA traite notamment d’un mécanisme permettant une largeur d’au plus 80 caractères et l’agrandissement du texte. | Repère d’accessibilité distinct du choix typographique courant. Il ne fixe pas automatiquement la largeur par défaut du projet. |

Les références décrivent des usages différents et ne convergent pas vers un
seuil universel. Pour Elcé, l’utilisateur demande une moyenne de 60 à 85
caractères par ligne, espaces compris, quand la largeur du conteneur le permet.
Sur petit écran, la taille conserve un plancher confortable et les lignes
peuvent être plus courtes. La calibration finale se fait avec les fontes,
contenus et compositions réellement affichés.

## Composition de référence désignée par l’utilisateur

L’utilisateur retient la composition de
[cette page](https://practicaltypography.com/line-length.html) comme référence
de justesse typographique. Relevé dans ses
[CSS publiés](https://practicaltypography.com/styles.css), sans mesure du rendu
dans un navigateur :

| Profil de corps | Taille déclarée | Interligne |
| --- | --- | --- |
| Valkyrie | `0.91rem` | `1.45` |
| Equity | `0.98rem` | `1.4` |
| Concourse | `1rem` | `1.35` |

Les paragraphes ont une marge après de `1em`. Pour sa composition desktop,
une conversion en unités relatives donne une page plafonnée à `41.67rem`, des
marges de contenu de `0.5rem` et `2.5rem`, et une colonne d’environ `27.17rem`.
Avec Valkyrie, le corps nominal est `0.91rem`. Ces calculs décrivent la source,
sans certifier le rendu actuel de l’utilisateur. Le
[script publié](https://practicaltypography.com/functions.js)
sélectionne Valkyrie par défaut et conserve le choix de famille.

L’exemple montre un réglage conjoint famille/taille/interligne dans une classe
directe, avec des proportions adaptées à chaque police. Ses dimensions et ses
fontes ne deviennent pas des valeurs imposées à Elcé ; les unités relatives et
la plage de test du plan restent applicables.

## Relation entre largeur, taille et nombre de caractères

Pour une estimation, si `W` est la largeur disponible, `F` la taille de police
et `g` l’avance moyenne d’un caractère exprimée en proportion du corps :

`nombre de caractères par ligne ≈ W / (F × g)`

`g` varie selon la famille, la graisse et le texte. La largeur du zéro utilisée
par `ch` n’est pas cette moyenne. Un changement de police peut donc modifier
le nombre de caractères même si la largeur en `ch` reste identique.
Les vérifications se font avec les fontes locales chargées et des textes
représentatifs, en distinguant les lignes pleines des fins de paragraphes.

Une largeur maximale de lecture et une taille bornée répondent à deux besoins
complémentaires : empêcher l’allongement indéfini des lignes sur grand écran
et conserver un corps lisible quand le contenant devient étroit. Sur un petit
écran, le texte peut naturellement comporter moins de caractères par ligne.

## Interpolation bornée

La méthode décrite par CSS-Tricks relie deux points `(Wmin, Fmin)` et
`(Wmax, Fmax)` :

`a = (Fmax − Fmin) / (Wmax − Wmin)`

`b = Fmin − a × Wmin`

`F(W) = min(Fmax, max(Fmin, a × W + b))`

Ce calcul aide à écrire une expression `clamp()` dans une règle CSS. Les
quantités doivent être exprimées de façon cohérente. Une adaptation à la
largeur du contenant demande un conteneur approprié ; la largeur du viewport
n’est pas nécessairement celle du texte. Le fonctionnement avec la taille
racine du navigateur et le zoom reste à vérifier dans le rendu réel.

## Rythme de lecture

L’interligne, l’espace entre paragraphes, la largeur et la taille doivent être
comparés ensemble. Une seule valeur d’interligne ne permet pas de conclure à
la lisibilité de toutes les familles. Les marges CSS donnent un rythme aux
paragraphes sans transformer ce rythme en lignes vides ajoutées au contenu.

Le préréglage Transparent sélectionne `density: none`, dont les règles
regroupent fond transparent et padding nul. L’interligne et les espaces entre
paragraphes restent des réglages de lecture à calibrer dans ce profil, selon
les mêmes critères de confort que pour les autres densités.
