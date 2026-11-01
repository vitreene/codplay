# Éditeur — blocs et placement racine

## Rôle

Le flux de création de blocs ajoute un item vide sur la scène. Le décor initial
permet ensuite de modifier son apparence. La création et le placement passent
par le contrôleur, les commandes de document et le Builder Éditeur existants.

## Contrat

- `bloc` est une valeur distincte d’`ItemType`. Un bloc n’a pas de `Content`,
  mais possède un décor initial modifiable.
- Le mode de placement est porté par la grille de `EditorScene.rootCapsule` :
  une scène neuve démarre sur `90 rangées × 160 colonnes` (`fine-grid`). Le mode
  `1 × 1` (`transform`) reste disponible pour tracer une géométrie propre par
  `Decor.offset` quand aucune zone racine n’existe.
- En mode `transform`, le tracé libre produit un rectangle local, converti en
  unités `cqw` dans l’offset du décor.
- Les dimensions libres d’auteur, leur palette et leur sauvegarde restent en
  valeurs `cqw` ; les unités CSS en pixels ne sont pas des données auteur. Les
  emprises de zones, elles, restent exprimées en indices de pistes et spans.
- En mode `fine-grid`, l’éditeur de zones déclare séparément les zones racine.
  L’auteur sélectionne une zone existante puis crée le bloc ; le bloc référence
  son `Zone.id` par `Decor.zoneId` et n’ajoute pas de zone. Si aucune zone n’est
  sélectionnée, la création du bloc est désactivée. Capsule Automation fournit
  l’emprise de la zone à la cible structurelle V2 ; le bloc occupe cette emprise
  dans la projection courante.
- Le tracé combiné zone+bloc n’est pas le parcours courant ; il ne sera
  réévalué que si la méthode par zones atteint une limite d’usage concrète.
- À la projection V2, le bloc reste un type d’item distinct et devient un perso
  `tag` initialisé comme `div`, sans propriété `content`.
- Le choix du mode racine est enregistré dans le document et survit au
  rechargement SQLite. La création d’un bloc dans une zone est une commande
  auteur, sélectionne le bloc et ouvre son décor. Les zones et les blocs
  utilisent la voie de mutation et l’historique du contrôleur existant. Une
  racine contenant des zones ne peut pas être remise en mode `1 × 1`.
- La palette du bloc expose Forme, Custom et Presets, sans Typo ni Contenu.

## Portée et preuves

Cette tranche ne crée pas d’items image, vidéo ou son et ne modifie pas CodPlay.
- `tests/block-creation-v2.spec.ts`,
  `tests/commands/root-placement-commands.spec.ts`,
  `tests/builder-v2/build-scene.spec.ts` et
  `tests/decor-editor-bridge-integration-v2.spec.ts` couvrent le flux document,
  le placement et le pont de décor.
- `tests/app/persistence/sqlite-editor-scene-persistence.spec.ts` couvre la
  restauration des documents et des dimensions de grille.
- Safari MCP a vérifié dans Editor la déclaration seule de `z1` par le zone-editor,
  la sélection, la création d’un bloc dans `z1` sans ajout d’une deuxième zone,
  et l’égalité de l’emprise DOM du bloc avec la cible de zone Capsule Automation.
  Undo a retiré le bloc ; l’annulation des mutations de vérification puis le
  rechargement SQLite ont restauré la scène sans données de vérification.
- [`tests/browser/zone-movement.html`](../tests/browser/zone-movement.html)
  présente un bloc sans offset, affecté de `z1` à `z2` sur deux KF pose. Safari
  a vérifié par Seek à 0, 2500 et 5000 ms que le visuel suit la taille et la
  position de l’emprise interpolée ; le snapshot V2 conserve le `move` vers z2.
  Le fixture charge la feuille `app-layout.css` réelle : le scroll interne du
  menu ne déplace ni l’hôte de scène ni l’item, et le document ne déborde pas du
  viewport.
