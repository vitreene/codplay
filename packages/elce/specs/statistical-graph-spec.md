# Elcé — BDC Graphe

## Statut

**Fixe — modèle, éditeur, rendus et placements vérifiés dans les circuits Elcé
existants.** Le graphe peut être un BDC direct de Flux ou Diapo, un enfant de
Carousel, ou un BDC ancré dans une Section.

## Modèle et édition

`StatisticalGraphContent` porte les textes éditoriaux, les libellés des axes,
le type de rendu, les options d’intitulés et de transposition, les catégories,
les séries, les valeurs et les sélections des secteurs. Les catégories et
séries ont des identifiants stables ; une cellule vide n’a pas de valeur
stockée, tandis que zéro reste une valeur. À la création, l’éditeur prépare
quatre catégories et deux séries. La grille garde une ligne et une colonne
supplémentaires pour étendre la saisie ; elle suit les données sans plafond
fixe.

Deux boutons activent séparément les intitulés de colonne et de ligne ; ils
sont actifs par défaut. Le collage remplace toute la matrice et traite la
première ligne et la première colonne comme des intitulés selon ces options.
Le collage et la saisie étendent la grille selon leurs données. Le lecteur
extrait les cellules tabulaires simples, qu’elles arrivent sous forme tabulée
ou CSV-like ; il n’interprète pas les formules ni les formats propres à Excel.

Dans la grille, Tab valide la cellule puis sélectionne la suivante sur la même
ligne ; Entrée ou Retour sélectionne la suivante dans la même colonne. Les
flèches déplacent la sélection entre cellules. L’auteur peut saisir dans la
grille ou dans le champ de cellule sélectionnée, précédé d’une icône d’édition.
Ce champ n’a pas de libellé visible ; il garde son nom accessible. Les boutons
d’intitulés reprennent le style des commandes d’icônes de la barre Section.
Les cellules sont jointives, avec une largeur réduite de moitié, une hauteur
réduite d’environ 30 % et un padding plus faible que la grille précédente.

Les commandes et façades Elcé existantes enregistrent l’édition dans le
document. L’auteur peut modifier les textes, libellés, cellules, rendu et
layout. Il y a toujours au moins une catégorie et une série. Les nombres
acceptent les virgules décimales et les valeurs négatives. Les secteurs ne
représentent que les valeurs positives ; une cellule absente reste vide et est
ignorée dans les rendus graphiques.

Le formulaire sépare les titres et le commentaire, les réglages de représentation,
puis le « Tableau de saisie ». Dans la grille, les catégories occupent les lignes,
les séries les colonnes et les valeurs leurs intersections.

La transposition est active par défaut pour les quatre rendus. Elle échange les
catégories et les séries dans le rendu et leurs libellés d’axes, sans modifier
la matrice de saisie ; l’auteur peut la désactiver. En secteurs, la sélection
choisit une série quand la transposition est désactivée et une catégorie quand
elle est active. Ces deux sélections sont conservées indépendamment.

SQLite conserve le contenu complet `StatisticalGraphContent` sous forme de JSON
opaque dans `statistical_graphs.content_json`. La ligne relationnelle conserve
l’identité du BDC ; les tables `graph_categories`, `graph_series` et
`graph_values` n’existent plus. Les tables relationnelles des autres BDC,
notamment Question/Réponses, restent inchangées. Le placement reste celui du
BDC générique.

## Rendu

Les modes sont `bar`, `line`, `pie` et `table`. Barres, courbes et secteurs
sont dessinés en SVG sans bibliothèque de graphique. Leur image porte un nom
accessible lié au titre et une courte description ; le même modèle fournit
une table HTML sémantique accessible. Le mode Tableau n’émet pas de SVG et
affiche la matrice HTML avec ses libellés, son `caption` et ses en-têtes
scopés ; seules les lignes contenant une valeur sont visibles et les colonnes
s’arrêtent à la dernière colonne contenant une valeur dans l’orientation
affichée. Les cellules vides avant cette limite restent visibles. Zéro compte
comme une valeur. L’alternative sémantique des rendus SVG conserve les
dimensions complètes de la matrice.

Les couleurs des rendus SVG forment une palette fixe, indépendante de l’apparence
du projet. Barres et courbes associent ses teintes à l’ordre des séries ; les
secteurs les associent à l’ordre des catégories. Les repères de légende
réutilisent le même index, avec répétition après la huitième teinte.

| Index | Couleur |
| ---: | --- |
| 0 | `#326c64` |
| 1 | `#c27b3a` |
| 2 | `#5376a2` |
| 3 | `#a64f4f` |
| 4 | `#7a6599` |
| 5 | `#7f8f45` |
| 6 | `#4c8491` |
| 7 | `#bd6688` |

La légende conserve uniquement les entrées nommées et disparaît quand aucune
entrée applicable n’a de nom. Dans les secteurs transposés, elle identifie les
séries de la catégorie choisie ; sans transposition, elle identifie les
catégories de la série choisie.

L’éditeur propose un bouton d’aperçu du graphe seul dans une modale accessible.
Échap ferme la modale et le focus retourne au bouton qui l’a ouverte.
L’aperçu monte le balisage et la feuille de style retournés ensemble par le
builder ; la palette SVG et les règles propres au tableau y sont donc actives.

Dans les graphiques, les libellés denses sont espacés automatiquement : tous
jusqu’à 10 entrées, un sur cinq jusqu’à 20, puis un sur dix, avec le dernier
libellé conservé. Le tableau sémantique donne accès à toutes les données.

Dans le tableau visible, toute la matrice partage une seule taille de police,
calculée d’après les cellules les plus contraignantes. Le texte peut devenir
très petit dans une matrice dense ; le contenu n’est pas tronqué. Le navigateur
et son zoom permettent d’agrandir la lecture. À partir de 12 lignes ou colonnes,
les en-têtes de série sont orientés verticalement et la taille s’adapte à la
zone disponible. Les tableaux ne défilent pas à l’intérieur de leur zone.

Le rythme CSS du texte des axes, valeurs, légendes et tableaux — taille,
interlignage, marges et padding — utilise des unités relatives, avec `rem`
comme base et `cqw` pour l’adaptation au graphe. Aucune de ces propriétés
textuelles n’est déclarée en pixels. Le navigateur peut présenter les valeurs
résolues en pixels dans ses styles calculés.

## Layout et placements

Le layout présente le graphe au-dessus du commentaire éditorial ou à côté de
lui. La disposition côte à côte devient une colonne sur écran mobile, avec le
commentaire sous le graphe. Les proportions et le seuil suivent les réglages
communs de l’application et sa grille CSS existante.

Le BDC reprend les builders de page existants pour un placement direct dans
Flux ou Diapo. Carousel le séquence par identifiant dans sa liste de vues. Dans
une Section, le BDC quitte le catalogue, devient enfant de la Section, puis le
builder Flux monte ce même BDC dans le slot d’ancre existant ; aucune voie
d’insertion parallèle n’est créée.

La réserve du slot suit le rendu : le Tableau prend sa hauteur naturelle et
réserve `100%` de la largeur de ligne ; les rendus SVG réservent `56.25%`. Le
slot existant est réorganisé par le layout CodPlay. Le cœur CodPlay n’a pas été
modifié.

## Preuves

- [`statistical-graph-service.test.ts`](../src/domain/statistical-graph/statistical-graph-service.test.ts)
  couvre la grille, les nombres et le remplacement de matrice.
- [`statistical-graph-scene-builder.test.ts`](../src/builders/statistical-graph/statistical-graph-scene-builder.test.ts)
  couvre les quatre rendus, l’alternative accessible et le choix d’une taille
  commune selon le contenu le plus contraignant ; ses assertions vérifient les
  huit couleurs fixes pour chaque rendu SVG et sa légende.
- [`statistical-graph-placements.test.ts`](../src/builders/statistical-graph/statistical-graph-placements.test.ts)
  compile les placements Flux, Diapo, Carousel et Section par les builders et
  le runtime CodPlay réels ; les placements Flux, Diapo et Carousel conservent
  aussi la feuille de couleurs du graphe.
- [`sqlite-project-persistence.test.ts`](../src/server/projects/sqlite/sqlite-project-persistence.test.ts)
  vérifie l’aller-retour JSON, la migration depuis les anciennes lignes
  relationnelles et son retour, la suppression des tables de détail et la
  conservation de Question/Réponses.
- [`remix-statistical-graph-editor.test.tsx`](../src/app/editor/statistical-graph/remix-statistical-graph-editor.test.tsx)
  vérifie la saisie contrôlée, l’extension de grille par collage et le transfert
  de la feuille de style du builder dans l’aperçu auteur.
- Le 27 octobre 2026, Brave montre les barres colorées dans l’aperçu du graphe
  auteur et dans la page Lecture ouverte depuis l’éditeur. Le SVG réel de cette
  page calcule les remplissages `#326c64`, `#c27b3a` et `#5376a2` depuis sa
  palette ; les consoles des deux pages ne contiennent que le message de
  connexion HMR.
- Brave, sur le projet de test temporaire, affiche une matrice 40 × 40 ancrée
  dans une Section. À 390 × 844, la table fait `300 × 135.42 px`, la réserve
  `300 × 332 px` et le texte suivant reprend au bas du slot. À 1280 × 900, la
  table fait `918 × 292.52 px`. Les 1 681 cellules sont présentes, aucune
  plage de texte ne déborde de sa cellule, la page ne déborde pas et la console
  Brave est vide. Les valeurs en pixels de cette preuve mesurent la géométrie
  rendue ; les règles des tailles de texte sont relatives.
- Safari Technology Preview, dans la preview Demo5 du 24 octobre 2026, accepte
  (`CSS.supports`) la formule `rem`/`cqw` des libellés SVG et expose les règles
  sources sans unité `px` pour `font-size`. Ce contrôle confirme leur analyse
  CSS ; il ne remplace pas l’acceptation visuelle du Graphe prévue par P5.
- Le 9 octobre 2026, Brave sur `5175` montre le formulaire en sections et sa
  grille éditable avec les libellés de lignes et colonnes. Ajouter puis
  supprimer une ligne et une colonne met à jour la grille ; la dernière entrée
  reste protégée. La console est vide.
- Le 9 octobre 2026, dans Projet 1, la création d’un Graphe dans le Carousel
  de la Page B affiche quatre lignes de catégories et deux colonnes de séries
  (5 × 3 en-têtes compris). Le graphe temporaire est supprimé par son action
  d’édition ; le Carousel retrouve ses cinq vues et l’état repasse à
  « Synchronisé ».
- Le 14 octobre 2026, les quatre fichiers de tests Graphe et persistance
  passent : 28 tests réussis, un test réseau média ignoré. Typecheck et build
  passent. Le parcours Brave de l’éditeur confirme le collage avec intitulés
  actifs puis désactivés, les raccourcis clavier, les quatre rendus, la
  transposition, les deux sélections des secteurs et la fermeture accessible
  de l’aperçu ; la console ne contient ni erreur ni avertissement. Les icônes
  d’intitulés ont la même couleur, le même fond, la même bordure, les mêmes
  dimensions et la même classe SVG que les commandes de texte de la Section.
- Le 14 octobre 2026, après correction des bornes du Tableau transposé, les
  cinq fichiers de tests Graphe et persistance passent : 34 tests réussis et
  un test réseau média ignoré. Typecheck et build passent. Dans l’aperçu Brave,
  le tableau s’arrête aux lignes 2024–2025 et aux colonnes Nord–Sud ; la colonne
  intérieure vide Centre est conservée, sans ligne 2026 ni colonne Est. La
  console ne contient ni erreur ni avertissement.
- La suite complète du paquet donne 288 tests réussis et 9 échecs dans les
  tests de composition du lecteur, du client API et du serveur média. Ces
  échecs sont hors des fichiers Graphe modifiés ; le test média échoue sur
  `listen EPERM` dans cet environnement.
