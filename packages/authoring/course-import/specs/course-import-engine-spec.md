# Moteur générique d’import XML

## Rôle et frontière

`@codplay/course-import` fournit des outils d’analyse XML et de conversion
réutilisables pour les projets de formation. Les documents sources, leurs
feuilles CSS et leurs tables de ressources sont fournis par l’appelant. Le
moteur ne dépend d’aucun projet de démonstration et ne contient aucune règle
fondée sur un identifiant, un style ou une ressource SAMERA ou SPIE.

Le paquet produit une représentation `SceneDoc` partielle et un rapport de
conversion. Il ne produit pas encore de document `EditorScene`, de module prêt
à importer ni de copie de ressources. Les décisions qui dépendent du lecteur
source sont fournies par `PageConversionContext`; si elles manquent, le moteur
conserve un diagnostic au lieu d’inventer une interprétation.

## Lecture des documents et références

[`parseXmlDocument`](../src/xml-document-reader.ts) analyse un document XML en
arbre ordonné, avec les attributs source, les nœuds texte et les positions des
éléments. Un XML mal formé ou sans racine provoque une erreur de lecture.

[`CourseSourceReader`](../src/course-source-reader.ts) expose les résolutions
génériques suivantes :

- index du sommaire `menu → chap → page` en conservant l’ordre source; les noms
  de tags et attributs peuvent être fournis par `SummarySchema`;
- résolution d’une page dans un document de chapitre et d’une page de sommaire
  dans un chapitre donné; les IDs identiques de chapitres distincts ne sont pas
  fusionnés;
- recherche exacte d’une déclaration `properties` par `name` ou `id`, sans
  appliquer de priorité ni fusionner des déclarations concurrentes;
- résolution d’une traduction par tags, attribut de clé et filtre de langue
  explicitement fournis;
- résolution exacte d’un chemin média dans une table source-vers-sortie.

Les résolutions retournent `resolved`, `missing` ou `ambiguous` et conservent
les candidats. Le lecteur ne choisit jamais une déclaration parmi plusieurs.
La fusion des propriétés, la priorité `override`, les dialectes de langue et
les conventions de chemins restent du ressort de l’adaptateur du projet.

## Reconstruction de la présentation source

[`SourceStyleReader`](../src/source-style-reader.ts) parse les feuilles fournies
une fois, puis résout les sélecteurs simples de type, classe, ID, descendant
et enfant. Il applique l’ordre de cascade, la spécificité et `!important`.
Les valeurs contenant des longueurs `px` simples deviennent des `cqw` si la
largeur du canevas source est fournie. Les variables CSS, longueurs non
convertibles, déclarations de propriétés personnalisées, URL de ressources,
sélecteurs hors grammaire et règles conditionnelles qui peuvent concerner
l’élément sont rapportés avec leur fichier et leur position.

`PageConverter` conserve les classes source et compose les valeurs résolues
avec `cssStyle`, les attributs explicites de couleur, taille, graisse,
typographie et opacité, ainsi qu’une géométrie fournie par l’adaptateur. Les
attributs de taille numériques ou en pixels nécessitent une largeur de canevas
pour être convertis en `cqw`. La géométrie n’est pas déduite des noms `x`,
`left`, `centered` ou équivalents : le repère et les ancres sont propres au
lecteur source.

## Conversion structurelle d’une page

[`PageConverter`](../src/page-converter.ts) traite une page directe `<page>` et
ses sections directes `<sequency>`. Chaque section devient une `StoryDoc` dans
l’ordre source. Les IDs de perso sont qualifiés par l’ID de story; un élément
sans ID reçoit un identifiant déterministe fondé sur son type et sa position
source. Les collisions d’ID reçoivent un suffixe déterministe pour garder un
`SceneDoc` structurellement distinct; le rapport les bloque et les références
à cet ID restent ambiguës. Un `<container>` devient un perso `layout` parent
dont la racine HTML porte un ID explicite.

Les règles de profils génériques sont :

| Source | Profil CodPlay | Condition de conversion |
|---|---|---|
| `<img>` | `img` | Une source est déclarée et résolue. |
| `<sub>` | `tag` | Le texte littéral ou sa traduction est résolu. |
| `<container>` | `layout` | Les éléments enfants peuvent être représentés comme persos enfants. |
| `<sound>` | `media` avec `tag: 'audio'` | La source est résolue; rôle d’horloge et départ sont fournis ou signalés. |
| `<video>` | `media` avec `tag: 'video'` | La source est résolue; rôle d’horloge et départ sont fournis ou signalés. |

Les longueurs et rôles médias ne sont pas inférés des noms d’attributs seuls.
Un média sans chemin, un texte imbriqué non interprétable ou un type de balise
inconnu produit un diagnostic. Le chemin source d’un média peut rester dans la
scène partielle si aucune table de copie n’est fournie; le rapport indique
alors que la ressource n’est pas préparée pour l’import.

Les `<tween>` sont convertis uniquement quand l’adaptateur fournit une cible,
un temps absolu, une durée, les deux bornes de chaque canal et une courbe
compatible. Le résolveur reçoit aussi le timing effectif du perso qui porte le
tween. Le moteur crée alors une action avec un `eventime` de story. Les segments
enchaînés, répétitions, `yoyo`, expressions et temps relatifs ne sont pas
déduits automatiquement.

## Timing visuel commun

Pour `<container>`, `<img>` et `<sub>`, `delay` et `duration` sont des nombres
en secondes. Le début effectif additionne les délais des conteneurs visuels
ancêtres et le délai de l’élément. Une durée positive propre à l’élément
remplace celle héritée du conteneur; une durée absente ou nulle hérite de la
durée du conteneur. Ces deux attributs gardent leur résolution source pour les
médias, les sections, les tweens et les interactions.

Un délai effectif positif initialise `display: none` et crée un événement
`<perso-id>:source-timing:start` à son échéance, qui restaure l’affichage résolu
du perso. Une durée effective crée `<perso-id>:source-timing:end` à
`début + durée`, qui masque le perso. La politique des éléments visuels sans
durée reste une décision du lecteur source et produit le diagnostic
`source-no-duration-end-hide-unresolved`. Un adaptateur peut prolonger cette
frontière lorsqu’un effet de sortie source doit se terminer avant le masquage.

Les images converties gardent `type: 'img'`. Leur repère, leur taille issue de
`scale` et leur `object-fit` dépendent du résolveur géométrique et de la
présentation CodPlay fournis par l’appelant; le moteur ne crée pas de
transformation CSS `scale` à partir de l’attribut source.

## Analyse statique des routines

[`parseJavaScriptCalls`](../src/javascript-call-reader.ts) reconnaît une
sous-grammaire de calls, arguments littéraux, tableaux, objets et identifiants.
Il n’exécute pas JavaScript. Les expressions et syntaxes hors grammaire restent
dans le rapport avec leur extrait source.

Les callbacks ne sont appliqués que si tous leurs calls sont compris :

- `onClick` fournit un événement HTML `click`; les autres phases demandent un
  déclencheur fourni par l’adaptateur;
- `showItem` et `hideItem` exigent une cible littérale unique et une
  transposition de visibilité non vide fournie par l’adaptateur;
- `gsap.to` est reconnu seulement pour une cible ID littérale, une destination
  d’opacité littérale, une durée explicite et, si elle est non nulle, une
  courbe mappée. Le départ d’opacité au moment du déclencheur doit être résolu
  par l’adaptateur. Une durée nulle produit une valeur instantanée;
- une routine inconnue, une cible ambiguë ou un mélange de calls dont un seul
  échoue ne produit aucune action partielle pour ce callback.

Un même callback peut déclarer une action sous la même clé sur plusieurs
persos. Pour un déclencheur interactif, le perso émet l’événement de story; pour
un déclencheur temporel, le moteur déclare l’`eventime` correspondant. Ces
formes utilisent les contrats existants de
[`Perso.emit`](../../../codplay/specs/perso-emit-v2-spec.md), du
[pipeline événementiel](../../../codplay/specs/event-pipeline-v2-spec.md) et des
[actions](../../../codplay/specs/action-sequence-tween-v2-spec.md).

[`factorRepeatedInteractions`](../src/interaction-factor.ts) regroupe les
callbacks dont le déclencheur et la structure des calls concordent. Il fournit
les occurrences et les chemins de valeurs divergentes comme recette d’analyse;
il ne réécrit pas ces déclarations en boucle.

## Rapport et limites de la scène partielle

Chaque `ImportIssue` porte un code, une sévérité, un ID stable, la position XML
ou CSS, l’extrait disponible et une prochaine étape éventuelle. Les résultats
peuvent donc contenir les éléments convertibles même si d’autres éléments
bloquent la page.

La conversion n’établit pas encore le démarrage séquentiel des stories, leur
condition de fin, la règle de masquage des éléments sans durée, ni
l’interaction entre la fin d’un média et les pop-ups. Ces cas restent des
blockers dans le rapport. Leur résolution exige une règle source commune ou un
adaptateur dont la sémantique a été établie. Le moteur n’infère pas une durée
de story à partir de la durée média seule.

Les résultats partiels doivent être validés par le builder et par le parcours
de lecture CodPlay avant d’être livrés. La projection directe vers Editor, la
CLI de préparation de module et la copie persistante des médias sont des étapes
distinctes du moteur décrit ici.
