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
- Le cadre affiché par Editor conserve temporairement un ratio 16:9, indépendant
  de cette grille de placement. La constante temporaire sera remplacée lorsque
  la configuration du document enregistrera le ratio propre à chaque scène.
- En mode `transform`, le tracé libre produit un rectangle local, converti en
  unités `cqw` dans l’offset du décor.
- En mode racine `fine-grid`, le tracé utilise les pistes `90 × 160`. Les bords
  s’accrochent aux cellules et donnent `row`, `col`, `rowSpan` et `colSpan`.
  Une transaction crée la zone racine correspondant à cette aire et le bloc qui
  la référence par `Decor.zoneId` ; aucune sélection préalable de zone n’est
  requise. Undo retire ensemble le bloc et sa zone.
- L’entrée dans le tracé affiche un curseur en croix jusqu’au commit ou à
  l’annulation. La création sélectionne le bloc par `EditorActionsFacade` et
  ouvre son panneau Décor.
- Les dimensions libres d’auteur, leur palette et leur sauvegarde restent en
  valeurs `cqw` ; les unités CSS en pixels ne sont pas des données auteur. Les
  emprises de zones, elles, restent exprimées en indices de pistes et spans.
- La création d’un item par placement dans une zone existante est distincte de
  la création sur la grille racine fine : dans ce parcours Zone, l’item référence
  le `Zone.id` par `Decor.zoneId` et reprend l’emprise de cette zone dans la
  projection Capsule Automation.
- Lorsqu’une aire de zone est créée explicitement dans l’éditeur Zone, elle reste
  distincte d’un bloc ; la création du bloc sur la grille racine est une seule
  transaction de tracé, de création de cette aire et du bloc associé.
- À la projection V2, le bloc reste un type d’item distinct et devient un perso
  `tag` initialisé comme `div`, sans propriété `content`.
- Le choix du mode racine est enregistré dans le document et survit au
  rechargement SQLite. Le tracé sélectionne le bloc et ouvre son décor via la
  façade d’actions. Les zones et les blocs utilisent la voie de mutation et
  l’historique du contrôleur existant. Une racine contenant des zones ne peut
  pas être remise en mode `1 × 1`.
- La palette du bloc expose Forme, Custom et Presets, sans Typo ni Contenu.
- Un fond absent demeure transparent dans la présentation native ; son champ
  Décor signale l’absence au lieu de présenter le gris de repli du picker comme
  une couleur. Une couleur modifiée est présentée sur le même item et la valeur
  committée reste visible après seek/rebuild.

## Portée et preuves

Cette tranche ne crée pas d’items image, vidéo ou son et ne modifie pas CodPlay.
- `tests/block-creation-v2.spec.ts`,
  `tests/commands/root-placement-commands.spec.ts`,
  `tests/scene-player-bridge-v2.spec.ts`,
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
