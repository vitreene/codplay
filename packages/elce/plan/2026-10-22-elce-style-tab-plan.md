# Plan — CSS de contenu Elcé

**Statut : En cours.** Le modèle v7 et le circuit de classes sont implémentés ;
Demo5 est convertie en v7. La mesure s’applique à la racine `.bdc` de tous les
types, donc au bloc entier, selon sa densité : 70ch par défaut/Normal, 60ch en
Compact et 81ch en Large. Cette baisse d’environ 15 % concerne la largeur ; les
tailles de police restent inchangées. Safari MCP confirme à 1800px et 390px
que Section, son Photo ancrée et Question suivent ce plafond sans débordement
mobile. La vérification live des autres BDC et le calibrage restent ouverts.

## Sources à modifier

- `src/config/appearance/appearance-definitions.ts` associe chaque choix au
  fichier CSS et aux classes à appliquer.
- `css/palettes/forest.css` contient directement les règles de la palette,
  par exemple `.bg-forest-background` ; le générateur du picker lit ces CSS.
- `css/typography/<font>.css` règle les familles ; `css/typography/reading.css`
  limite une seule fois la racine `.bdc` de chaque type. Le contenu interne et
  les médias ancrés suivent cette largeur.
- `css/densities/{compact,large}.css` ajuste ce même plafond à 60ch ou 81ch ;
  la règle commune est de 70ch par défaut. Chaque bloc garde toute la largeur
  disponible sur petit écran.
- `src/domain/appearance/appearance-resolver.ts` remonte le contraste jusqu’au
  premier fond réellement peint ; `src/app/appearance/appearance-panel.tsx`
  garde un seul choix de duo typographique.
- `src/player/elce-player-style.ts` laisse transparents le slot de contenu et
  les racines BDC ; les densités ne mettent un inset que sur `.has-background`.

Le résolveur fournit les classes partagées aux scènes. La CSS documentaire et
les fontes communes sont installées une seule fois sous la scène layout du
projet ; l’export Sighty utilise les mêmes CSS. Les réglages statiques passent
par des classes, sans variables CSS d’apparence. Le fond projet vise uniquement
la racine du layout ; pages et BDC restent transparents tant qu’ils n’ont pas
leur propre réglage. Un futur preset pourra ajouter un fond de BDC par cascade
CSS, sans modifier le document. L’interface ne propose qu’un duo typographique ;
`headingFontId` et `bodyFontId` restent distincts dans `appearance`.

## Déjà réalisé

- Document v7 : polices de titre et de corps indépendantes ; Transparent écrit
  `density: none` ; remettre une couleur sélectionne Normal.
- L’interface conserve le sélecteur de duo ; seuls les champs `headingFontId`
  et `bodyFontId` de `appearance` sont distincts.
- Migration SQLite ciblée sur Demo5 ; tests de migration et d’export ajoutés ou
  adaptés. La migration a aussi été appliquée à la base locale : l’API renvoie
  le document v7 et Safari ouvre son contenu dans l’éditeur.
- Palette, densité et typographie héritées par les pages et tous les types de
  BDC ; CSS communes dédupliquées entre scènes.
- Règle de largeur déplacée sur `.bdc` pour s’appliquer uniformément au bloc
  entier, quels que soient son rôle et son contenu ; suppression des limites
  différentes par sous-élément.
- Les builders Carte et Graphe transmettent leurs classes d’apparence dans
  `rootClassName` ; Flux et Capsule conservent ainsi `.bdc` sur la racine qu’ils
  animent. Les tests vérifient Carte ancrée, Carte dans Carousel, Graphe ancré
  et Graphe dans Carousel.

## Actions restantes

1. **Compléter la validation MCP.** Vérifier la racine BDC en rendu réel à
   largeur large et mobile pour chaque type effectivement présent dans Demo5.
   La passe actuelle confirme Section (766px/284px), deux Photos ancrées
   (702px/252px) et Question (766px/300px), sans débordement à 1800px et 390px.
   Le Résultat reste verrouillé ; ne pas répondre au quiz pour le valider.
2. **Calibrer.** Mesurer les lignes réelles avec les fontes du projet et
   confronter 70ch/60ch/81ch à la cible de test 70–95 caractères. Le panneau
   auteur n’ajoute aucun réglage de largeur ou de taille.
3. **Clore.** Mettre les preuves MCP et les résultats de calibration dans cette
   spec, rejouer le contrôle SQLite requis, puis terminer le plan ou garder les
   valeurs à revoir.

Les discussions et références de conception restent dans
[`2026-10-22-style-tab-analysis.md`](../notes/2026-10-22-style-tab-analysis.md)
et [`2026-10-25-content-typography-references.md`](../notes/2026-10-25-content-typography-references.md).

## Fusion du 26 octobre 2026 — En cours

- **Décisions acceptées et appliquées :** priorité au comportement distant des animations
  Flux : racine observée fixe, transitions Capsule sur le média, défaut
  `swipe-right` et zone `threshold: 0` distante. Conserver la centralisation
  existante pour transmettre ces réglages ; retirer le mouvement image local
  remplacé et ses assertions devenues caduques.
- **Données :** conserver la base distante v7 et son état de test récent,
  en reportant le renommage local de `chapter-1-intro` (« itération 3 »).
  L’ancien Projet 1 v5 local reste dans la sauvegarde temporaire ; la base
  fusionnée conserve le Projet 1 v7 distant.
- **Vérifié :** 481 tests Elcé sur 73 fichiers, typecheck et build passent.
  Les tests couvrent builders, player réel, cycle de vie, persistance et
  exports. Les contrôles SQLite d’intégrité et de références passent.
  La relecture par `SqliteProjectPersistence` reconstruit les deux documents
  v7 (Demo5 : 11 pages/21 BDC ; Projet 1 : 1 page/1 BDC) et le titre fusionné.
  Les spécifications Flux/réglages et le suivi de synchronisation sont alignés.
- **Reste :** valider visuellement le résultat après fusion.
  Brave est configuré mais aucun outil navigateur n’est exposé dans la session.
  La fusion n’achève pas les validations visuelles et le calibrage du plan.
