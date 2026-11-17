# Plan — Cartes ancrées avec texte enveloppant

**Statut : En cours — comportement Elcé implémenté ; validation auteur complète
en attente.**

## Objectif

Permettre à une Carte enfant d’une Section de réserver une fraction de la
largeur du texte, à gauche ou à droite, pour que le texte s’enroule à côté de
son média puis reprenne toute la largeur sous celui-ci.

## Contrat et circuit existants

- Une Carte ancrée reste un BDC enfant de sa Section. La position de l’ancre,
  dont `paddingBottom`, est portée par le contenu riche de la Section.
- Le builder Elcé déclare une réservation `layout.initial.flowReservations`.
  Le composant `layout` CodPlay place le même slot après sa ligne visuelle,
  flotte sur toute la largeur et réserve son `blockSize`.
- Le média `media-a481eaf8dfa1a205115fd44c` est réutilisé par trois Cartes
  `photo-basic`. Deux occurrences sont dans la Section de la page 2 et portent
  des réservations différentes : le nouveau choix doit être propre à chaque
  ancre, pas au média partagé.

## Décisions acceptées

1. Proposer quatre largeurs discrètes sur un slider : pleine largeur, `1/2`,
   `1/3` et `1/4`, dans cet ordre. Le slider natif occupe au plus la moitié de
   la ligne, sur la même ligne que les boutons icônes gauche/droite.
   Les boutons réutilisent la taille et le style standard des icônes Elcé ;
   aucun dimensionnement individuel n’est ajouté.
2. Limiter cette première évolution aux Cartes ancrées dans une Section ; les
   Cartes directes, vues Carousel et Graphes gardent leur placement actuel.
3. Le texte suivant l’ancre s’enroule à côté du média jusqu’à son bas, puis
   reprend toute la largeur. Largeur et côté appartiennent à chaque placement
   d’ancre, indépendamment du contenu ou du média partagé.
4. Préserver le ratio de l’image : sa hauteur est déduite de sa largeur de
   rendu. La réservation verticale doit donc suivre la fraction choisie et les
   marges configurées ; revoir la part actuelle correspondant à `1lh`.
5. Le comportement de placement complet — pleine largeur, largeur partielle et
   côté — appartient à un composant optionnel Elcé. Aucun changement du core
   CodPlay n’est autorisé ou prévu pour cette demande.
6. Pour une Carte ancrée dont le layout accepte un média, regrouper Taille,
   Position et Ajustement sous la rangée Disposition/Transition. Les
   libellés gardent la taille standard des réglages Elcé (`0.7rem`). La rangée
   reste en flex sans retour à la ligne ; le slider et les sélecteurs occupent
   leur espace par flex proportionnel, sans largeur fixe. Les contrôles n’ont
   pas de fond gris, un espace de `1.5rem` sépare le slider des icônes, les
   libellés sont alignés en haut et « Pleine largeur » reste sur une ligne.
   Le contrôle partagé d’ajustement remplace son select par les choix icône
   Contenir (`Minimize2`) et Couvrir (`Maximize2`), gardant les valeurs Carte
   `contain` et `cover` et leurs usages dans les éditeurs Carte et Carousel.
7. Ajouter `1rem` de marge extérieure au panneau d’édition Carte ancrée, sur
   ses quatre côtés. Le Graphe ancré conserve son dimensionnement actuel.
8. Quand une Carte ancrée passe en mode édition, son slot auteur occupe
   temporairement toute la ligne et sa hauteur suit celle du panneau d’édition.
   L’aperçu Carte et tout le cadre sont invisibles pendant cette bascule, sans
   retirer la boîte géométrique requise au positionnement CSS du panneau. Le
   contenu de Section reprend sous le slot ; le slot garde la marge basse
   normale de `2rem` des Cartes pleine largeur. En fermant l’édition, l’aperçu
   et le cadre reviennent et le slot restaure largeur, côté, ratio et hauteur du
   média. Cet état reste transitoire dans le DOM et ne modifie pas le document
   riche.

## Raccord retenu

Le composant optionnel est Elcé-owned et porte le comportement complet des
Cartes ancrées : pleine largeur, moitié, tiers ou quart, côté gauche ou droit. Il ne
modifie pas `layout` ni `layout.initial.flowReservations`.
`ElceAnchorExtension` sérialise le choix sur chaque ancre ; la projection Flux
réutilise le `data-part` et l’ancre CSS existants. Le composant Elcé produit le
slot flottant et le cadre média de même largeur, dont la hauteur suit le ratio
du média. Le builder Flux le compose seulement pour les Cartes ancrées. Les
Graphes ancrés gardent leur circuit actuel.
Les choix de placement sont des options de la Carte ancrée dans son éditeur
partagé ; aucun contrôle de placement ne s’affiche sur le cadre image dans la
surface d’édition de la Section. Quand cet éditeur est ouvert, son panneau
occupe la pleine largeur de l’éditeur de Section, quelle que soit la largeur de
placement de la Carte ; le Graphe ancré garde son panneau actuel.
Le réglage de largeur est réservé aux layouts Carte qui acceptent un média. Il
apparaît sous la rangée de réglages contenant « Disposition » et reste absent
des layouts texte seul.
Les placements partiels ajoutent une marge physique de `1rem` entre le cadre
média et le texte voisin. Le cadre de l’aperçu auteur a une bordure tiretée
grise `#9da9a5` de `2px` pour signaler son rôle technique. Les boutons d’édition
restent centrés à `0.5rem` des coins du cadre, entièrement à l’intérieur.

## Actions ordonnées

1. [x] Sérialiser largeur et côté sur l’ancre ; les documents anciens restent
   en pleine largeur.
2. [x] Ajouter le composant optionnel de placement Elcé : le slot Carte et son
   cadre utilisent un float CSS de même largeur et le ratio du média. Les
   Cartes n’emploient plus `flowReservations` CodPlay ; le circuit Graphe reste
   inchangé.
3. [x] Brancher le slider natif auteur pleine largeur, `1/2`, `1/3`, `1/4` et
   deux boutons icônes gauche/droite côte à côte dans l’éditeur partagé de la
   Carte ancrée, sous la rangée contenant « Disposition » et seulement pour les
   layouts qui acceptent un média. Réutiliser le bouton d’icône Elcé standard
   sans dimensionnement individuel. Aucun contrôle de placement ne se superpose
   au cadre média dans la Section.
4. [x] Typecheck Elcé et build de production réussis ; aucune suite de tests
   n’a été lancée.
5. [x] Dans Brave MCP, confirmer les choix pleine largeur, moitié et tiers,
   l’accès à l’éditeur partagé depuis les deux Cartes ancrées de la page, puis
   la circulation du texte sur le player avec `1/2` à gauche et `1/3` à droite.
   La simulation temporaire par styles DOM a été supprimée par rechargement ;
   elle n’a changé aucune donnée du projet.
6. [ ] Tester par l’éditeur l’enregistrement réel des choix gauche/droite et
   moitié/tiers/quart, puis vérifier la reprise pleine largeur sous l’image pendant
   un resize. L’API locale a répondu `409 edit_access_occupied` ; ne pas
   contourner ce verrou ni écrire des valeurs d’essai dans la page partagée.
7. [x] Dans Brave MCP, vérifier que les choix de placement apparaissent dans le
   panneau de la Carte, que le bouton n’est plus sur le cadre média, et que le
   document est visible et focalisé. Aucune erreur console n’est présente.
   Documenter ce contrat et le positionnement du bouton d’édition dans la
   spécification d’ancre. Les spécifications CodPlay restent inchangées.
8. [x] Donner aux deux cercles un diamètre de `1.4rem`, les décaler de `0.5rem`
   vers l’intérieur des coins supérieurs, puis garder l’icône de réglage plus
   petite (`0.7rem`) dans son cercle. Le bouton conserve sa zone cliquable de
   `2.5rem`.
9. [x] Garder le panneau de la Carte ancrée à pleine largeur en mode édition,
   même si le média est placé en moitié ou en tiers. Le Graphe ancré conserve
   le dimensionnement existant de son panneau.
10. [ ] Dans le navigateur connecté, vérifier que les contrôles restent
    visibles en placements pleine largeur, moitié, tiers et quart, puis préciser le
    contrat dans la spécification d’ancre.
11. [ ] Vérifier dans le navigateur connecté que les cercles sont espacés de
    `0.5rem` des bords et symétriques, et que le pictogramme réglages est
    proportionné à la flèche ; décrire le contrat vérifié dans la spécification.
13. [x] Séparer le texte du cadre des placements partiels par une marge de
    `1rem` côté texte, et distinguer le cadre d’aperçu technique par une bordure
    tiretée gris clair `#9da9a5` de `2px`.
14. [ ] Vérifier le flux texte à côté des placements gauche/droite et l’aspect
    tireté du cadre dans le navigateur connecté, puis mettre à jour les
    spécifications d’ancre et Flux.
15. [ ] Vérifier dans le navigateur connecté les quatre étapes du slider, sa
    largeur maximale d’une demi-ligne, les deux icônes standard de côté sur la
    même ligne, sa position sous « Disposition », son absence dans les layouts
    texte seul, la sauvegarde et le rendu `25%`, puis mettre à jour les
    spécifications d’ancre et Flux.
16. [x] Regrouper sous la rangée Disposition/Transition les contrôles Taille,
    Position et Ajustement pour les layouts média. Harmoniser les
    libellés à `0.7rem`, séparer les icônes et supprimer le fond gris. La rangée
    utilise maintenant un flex sans retour à la ligne ; les champs reçoivent
    leur largeur par flex proportionnel plutôt que par largeur fixe. Validation
    navigateur et mise à jour de spécification restent à faire.
17. [x] Aligner les libellés Taille, Position et Ajustement en haut de
    leurs contrôles, et garder « Pleine largeur » sur une seule ligne.
18. [x] Remplacer la croix du bouton de sortie de l’édition Carte/Graphe ancré
    par l’icône Settings2 du mode vue et son libellé accessible « Mode vue ».
    L’assertion UI existante est alignée ; le rendu navigateur reste à confirmer.
19. [x] Ajouter `1rem` de marge extérieure au panneau de Carte ancrée sans
    modifier le panneau de Graphe. Vérifier le retrait visuel dans le navigateur
    et actualiser la spécification d’ancre après cette validation.
20. [x] Donner au bouton « Mode vue » du panneau Carte/Graphe ancré un contour
    circulaire et le placer à gauche du titre. Harmoniser ce bouton avec celui
    de la palette : diamètre standard `1.7rem` et pictogramme `0.75rem`. Le
    navigateur reste requis pour confirmer l’apparence.
21. [x] Étendre temporairement le slot d’une Carte ancrée à pleine largeur et
    à la hauteur observée de son panneau en mode édition, et rendre le cadre
    ainsi que l’aperçu entièrement invisibles sans retirer sa boîte CSS. Le slot
    garde sa marge basse normale de `2rem`; la fermeture restaure aperçu, cadre,
    taille et côté sauvegardés. L’occupation reste un état DOM transitoire. Le
    typecheck Elcé passe.
22. [ ] Valider dans le navigateur connecté la bascule aperçu/édition,
    la hauteur dynamique, le passage du texte sous le panneau, la fermeture et
    le maintien des attributs documentaires ; actualiser la spécification
    d’ancre après preuve.
23. [x] Remplacer le select d’ajustement de l’image du circuit partagé Carte
    par deux boutons icônes exclusifs Contenir/Minimize2 et Couvrir/Maximize2,
    en conservant la valeur métier et son action existantes. Ils gardent la
    forme carrée standard, le diamètre `1.7rem` et des pictogrammes de `0.75rem`.
    Aligner les assertions UI qui ciblaient le select ; le typecheck Elcé passe.
24. [ ] Vérifier dans le navigateur les états sélectionnés Contenir/Couvrir
    dans les éditeurs Carte ancrée, Carte directe et Carousel ; mettre à jour
    les spécifications d’édition après preuve.
25. [ ] Au dragstart, sélectionner l’ancre avant que ProseMirror sérialise le
    glisser natif avec le slot Carte flottant. Valider le déplacement de l’image
    dans le navigateur connecté avant d’actualiser la spécification.

## Critères d’acceptation proposés

- Une nouvelle Carte ancrée peut rester pleine largeur ou occuper la moitié, le
  tiers ou le quart de la colonne de texte, à gauche ou à droite. Le slider
  présente ces quatre étapes dans cet ordre, sur la même ligne que les icônes de
  côté et les sélecteurs média, avec une répartition flex sans largeur fixe.
- Le côté est sélectionné par deux boutons icônes exclusifs, désactivés en
  pleine largeur et avec un état sélectionné visible.
- Le réglage de largeur apparaît après « Disposition » dans les layouts qui
  acceptent un média et reste absent des layouts texte seul.
- Pour une Carte ancrée qui accepte un média, « Taille », « Position » et
  « Ajustement » apparaissent ensemble sous la rangée principale,
  avec des libellés de taille uniforme, sans fond gris, sur une seule ligne
  flex ; le slider et les sélecteurs média occupent des parts flexibles.
- L’ajustement conserve `contain` et `cover` dans le BDC Carte ; leurs boutons
  icônes exclusifs reflètent la valeur courante et conservent l’action existante
  dans les éditeurs Carte ancrée, Carte directe et Carousel.
- Le texte s’écoule à côté du média puis reprend la colonne entière sous le
  média, sans vide vertical calculé sur la largeur pleine.
- Le ratio de l’image, ses marges, le resize et plusieurs ancres dans la même
  Section conservent un flux correct.
- Les ancres existantes gardent leur rendu pleine largeur ; le même média peut
  avoir des placements différents selon la Carte ancrée.
- Le panneau d’édition d’une Carte ancrée reste pleine largeur et ses contrôles
  restent visibles pour les quatre largeurs de placement.
- Le panneau Carte ancrée garde un retrait extérieur de `1rem` dans son cadre ;
  le dimensionnement du panneau Graphe reste inchangé.
- Pendant l’édition, le slot de la Carte sélectionnée prend temporairement
  toute la ligne et la hauteur du panneau, et l’aperçu normal est masqué ; le
  contenu suivant passe dessous avec la marge basse habituelle de `2rem`. À la
  fermeture, l’aperçu et le placement enregistré reprennent sans modification
  du document riche.
- Les cercles de déplacement et d’édition ont la même taille et restent
  espacés de `0.5rem` des coins supérieurs du cadre. Le pictogramme réglages
  est proportionné à la flèche.
- Le texte conserve un écart de `1rem` depuis le cadre des placements partiels ;
  la bordure tiretée grise `#9da9a5` de `2px` reste visible.
