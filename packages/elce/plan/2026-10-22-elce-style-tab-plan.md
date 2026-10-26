# Plan — CSS de contenu Elcé

**Statut : En cours.** Le modèle v7 et le circuit de classes sont implémentés ;
Demo5 est convertie en v7. Le générateur couleur OKLCH de la preview est
implémenté. Le typecheck et le build du paquet Elcé passent ; Brave confirme
partiellement les surfaces projet, page et BDC sur écran large et étroit. La
cible vient d’être ramenée à 60–85 caractères ; son recalibrage reste à faire.
Le test typographique ciblé passe et la preview confirme ses espacements sur
grand et petit écran. Le padding Normal des surfaces bordées sans fond est
appliqué et vérifié sur Question ; cinq suites ciblées couvrant Question,
graphe et placements passent (44 tests), dont les couleurs fixes des trois
rendus SVG. La dernière suite Elcé complète connue passe 483 tests sur 484 ;
un test de persistance SQLite est bloqué par l’interdiction du socket local. Le sommaire
ouvert, les autres BDC et le facteur `1.41` des titres restent à vérifier. Le
build global échoue dans `codplay-v1` sur des erreurs TypeScript de tests et
démos hors du paquet Elcé.
La mesure s’applique à la racine `.bdc` de tous les types. Décision utilisateur
du 26 octobre : autoriser le bloc à s’étendre jusqu’à `55rem`, quelle
que soit la densité, et continuer à augmenter la taille du texte au-delà de son
plafond actuel pour viser 60–85 caractères par ligne. Les planchers de taille
et les retours à la ligne naturels restent actifs sur écran étroit. La formule
et ses paramètres sont isolés dans la
[spécification de taille responsive](../specs/responsive-text-sizing-spec.md).
Le recalibrage réel des fontes et la vérification des autres BDC restent ouverts.

## Sources propriétaires

- `src/config/appearance/appearance-definitions.ts` référence les choix ; les
  CSS de palette fournissent les échantillons du picker via
  `scripts/generate-appearance-palette-metadata.mjs`.
- `src/domain/appearance/appearance-color-generator.ts` transforme les choix
  Fond/Texte résolus en rôles sémantiques OKLCH.
- `css/typography/<font>.css` règle les familles ;
  `css/typography/reading.css` et `css/densities/` appliquent la mesure décrite
  dans la [spécification de taille responsive](../specs/responsive-text-sizing-spec.md).
- `src/domain/appearance/appearance-resolver.ts` résout les ancres et le fond
  de contraste ; `src/app/appearance/appearance-panel.tsx` garde un seul choix
  de duo typographique.
- `src/builders/scenario/scenario-builder.ts` et
  `src/builders/scene-style/appearance-class-names.ts` séparent aujourd’hui la
  portée de chaque cible des classes de rôle, densité et layout.
- `src/player/appearance-scene-style-sheet.ts` produit les variables CSS par
  cible ; `src/player/elce-player-style.ts` les consomme pour les régions du
  lecteur ; `src/builders/viewport-expansion/viewport-expansion-style.ts`
  dérive l’overlay de la même palette. `src/app/layout/app-layout.css` garde
  seulement la géométrie du cadre ; sa couleur vient de la feuille générée.

Le résolveur et le générateur produisent les variables sémantiques de chaque
cible dans la feuille commune du projet ; la preview et l’export Sighty
consomment cette palette. Les CSS de palette ne sont plus chargées pour peindre
le lecteur. L’interface ne propose qu’un duo typographique ; `headingFontId` et
`bodyFontId` restent distincts dans `appearance`.

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
- Les champs des presets Texte court et Texte avec image partagent les classes
  de rôle CSS `elce-card__meta`, `elce-card__title` et `elce-card__copy` ; leurs
  identifiants de zone restent portés par les `data-part`. Le player et l’aperçu
  auteur utilisent ces rôles courts au lieu de classes propres à chaque layout.
  Les tests ciblés dans quatre fichiers (77 tests), le typecheck et le build
  passent après le renommage.

## Actions restantes

1. **Valider la palette générée.** Terminer en rendu réel à desktop et mobile :
   cadre, sommaire ouvert/fermé, titre, navigation, contenu, fond transparent
   et exceptions page/BDC. Les espacements ont une assertion ciblée ; compléter
   la couverture du facteur `1.41` H1–H6 et des titres dédiés. La suite Elcé a
   été exécutée (483/484, un échec `listen EPERM` sur le socket local) ; le
   typecheck et le build du paquet passent. Rejouer ces contrôles après les
   changements restants. Brave ne couvre pas encore l’ouverture du sommaire
   mobile.
   **Décision acceptée par l’utilisateur le 26 octobre :** conserver les huit
   couleurs fixes du builder, indépendantes du Fond du projet. Le builder les
   émet déjà ; des assertions les couvrent désormais pour barres, courbes,
   secteurs et légendes, ainsi que dans les placements Flux, Diapo et
   Carousel.
   Une fixture Brave confirme leur rendu CSS. Demo5 ne montre qu’un Graphe en
   Tableau ; inspecter un rendu SVG monté par le runtime reste à faire.
2. **Compléter les mesures BDC.** Vérifier en rendu réel chaque type présent
   dans Demo5 à largeur large et mobile. La passe de mesure confirme Section,
   Photos ancrées et Question sans débordement aux deux formats. La preview
   Brave ouverte le 26 octobre montre les pages accessibles 1–5, sans layout
   Carte ; la vérification visuelle de ces rôles CSS reste à faire sur une Carte.
   Le Résultat reste verrouillé ; ne pas répondre au quiz pour le valider.
   **Décision acceptée et appliquée le 26 octobre :** un BDC dont la bordure est
   visible conserve un padding Normal même sans fond. Cela concerne la Question
   et le Carousel en Flux ; leurs bordures sont retirées en Diapo, qui reste
   plein cadre. La Question réelle est vérifiée sur grand et petit écran ; une
   fixture Brave contrôle le Carousel et un test CSS protège les deux règles.
3. **Calibrer.** Mesurer les lignes réelles avec les fontes du projet sur
   conteneur étroit et jusqu’à la borne `55rem`. Confirmer que la taille qui
   suit le conteneur garde 60–85 caractères par ligne quand la largeur le
   permet, sans débordement ni effet de zoom excessif. Le panneau auteur
   n’ajoute aucun réglage de largeur ou de taille.
4. **Clore.** Mettre les preuves MCP et les résultats de calibration dans cette
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
  Brave MCP est exposé dans la session actuelle. La fusion n’achève pas les
  validations visuelles et le calibrage du plan.

## Apparence de toute la preview — portée confirmée par l’utilisateur le 26 octobre 2026

- **Décision confirmée et appliquée :** tout ce qui est visible dans la
  preview relève de l’apparence auteur du projet : scène/cadre, sommaire,
  titre, contenu et navigation, y compris le panneau du sommaire sur mobile.
  Seule la barre technique supérieure et ses commandes en sont exclues.
  Les contrôles du panneau auteur restent inchangés : « Fond » et « Couleur du
  texte » désignent les couleurs maîtresses d’arrière-plan et de premier plan.
  **Choix confirmé :** Fond fournit la teinte maîtresse ; Texte reste la couleur
  de premier plan de référence. L’application dérive automatiquement les
  couleurs des régions ; aucun réglage auteur indépendant par région n’est
  ajouté. Les exceptions locales
  de page et de BDC gardent la priorité déjà définie par le résolveur ; les
  surfaces transparentes laissent voir le fond du projet.
- **Constat initial Brave :** sur la page de comparaison, page 2 portait
  `project-layout has-background bg-forest-text`, mais son fond calculé est
  transparent ; le cadre `.elce-player-stage` reste beige (`rgb(232, 228, 219)`),
  alors que le texte hérité est vert pâle (`rgb(208, 219, 200)`). Le sommaire
  est vert foncé, le titre et la navigation crème. Page 1 masque partiellement
  le défaut par ses couleurs locales ; page 2 les expose. Le même écart est
  confirmé sur écran étroit, avec le panneau mobile qui conserve aussi ses couleurs
  fixes.
- **Cause initiale corrigée :** `appearance-class-names.ts` plaçait la couleur
  de texte du projet
  sur le contenu seulement. Les règles de palette sont scoppées sous
  `.elce-player-layout`, mais la racine qui porte `.project-layout` est exclue
  de ce scope ; le fond projet ne peint donc pas cette racine. Enfin,
  `elce-player-style.ts` et `app-layout.css` imposaient des couleurs opaques au
  sommaire, au titre, à la navigation et au cadre. Le nouveau circuit génère
  les rôles par cible ; `:scope` peint le cadre, racine de portée CodPlay.
- **Décision acceptée par l’utilisateur :** remplacer la projection de couleurs
  actuelle par un générateur unique. `resolveAppearance()` reste l’entrée des
  valeurs effectives ; aucune classe de palette fixe ne sert de repli dans le
  lecteur. Le fond choisi reste la couleur exacte d’arrière-plan ; le texte
  choisi reste l’ancre exacte de premier plan quand Contraste auto est désactivé.
  Quand il est activé, seule cette couleur de texte peut être ajustée pour
  atteindre le contraste cible avec le fond peint le plus proche. Les exceptions
  locales de page/BDC gardent leur priorité.
- **Table de rôles appliquée :** arrière-plan, texte courant, titre (même couleur
  que le texte courant), intertitre dérivé du texte courant, deux accents dérivés
  de la teinte du fond. Le menu et la navigation reprennent cette teinte sous
  deux lumières distinctes ; leur premier plan dérive de l’ancre Texte et est
  ajusté si nécessaire pour le contraste. Une cible locale recalcule ses rôles
  depuis ses valeurs résolues ; le menu et la navigation restent liés au projet.
- **Règles de calcul appliquées :** conversion sRGB ↔ OKLCH dans une fonction
  pure ; réglage des rôles par une courte table de constantes nommées ; gamut
  mapping par réduction de chroma ; contraste minimum 4,5:1 pour les textes et
  3:1 pour les accents graphiques. Une teinte neutre reprend celle de Texte ; si
  les deux ancres sont neutres, la teinte Elcé de référence est 165°. Les
  fonctions et constantes devront rester courtes, commentées et faciles à
  modifier. Ces valeurs sont les paramètres initiaux, pas des contrôles UI.
- **Padding appliqué :** conserver les espacements déjà définis par Normal,
  Compact et Large quand le fond est peint. Une surface transparente sans bordure reçoit
  zéro padding ; une Question ou un Carousel Flux conserve Normal tant que sa
  bordure reste visible. Les surfaces Diapo sans bordure ne reçoivent pas ce
  fallback. Le générateur décide uniquement si la surface peint ; il ne duplique
  pas les mesures CSS. Les autres règles typographiques, structurelles ou d’état
  restent hors de ce premier générateur.
- **Sortie CSS appliquée :** variables sémantiques générées par cible document/page/BDC ;
  styles des menus, titres, contenu, navigation, sommaire et cadre consomment ces
  variables. La feuille générée peint les seules surfaces dont le fond s’applique
  à la cible. Les fichiers de palette continuent d’alimenter le picker, mais ne
  sont plus chargés pour peindre le lecteur. Aucun changement d’interface.
- **Références examinées :** shadcn/ui est la référence principale pour les
  rôles sémantiques et les paires surface/premier plan. Tailwind et Figma
  éclairent seulement la centralisation et l’alias des valeurs. La synthèse est dans
  [`2026-10-26-systemes-design-couleurs-recherche.md`](../notes/2026-10-26-systemes-design-couleurs-recherche.md).
- **Documentation ajoutée :** la
  [spécification d’apparence](../specs/appearance-spec.md) expose le chemin
  « choix utilisateur → résolution et priorité → générateur → palette
  documentaire → teintes du menu/navigation et padding → CSS », les entrées,
  sorties, règles de contraste, couleurs personnalisées, exceptions locales et
  points d’édition. Un guide court est placé dans le générateur.
- **Suivi :** le code et la spécification décrivent le nouveau rendu. Le
  typecheck et le build `@codplay/elce` passent ; Brave confirme partiellement
  les états de couleur. Le build racine s’arrête sur des erreurs TypeScript
  hors Elcé. La tranche reste `En cours` jusqu’à validation complète des états
  du lecteur et des tests actualisés. Aucun ancien circuit de couleurs n’est
  chargé dans le lecteur.
- **Propriétaires modifiés :**
  `src/domain/appearance/appearance-color-generator.ts`,
  `src/builders/scene-style/appearance-class-names.ts`,
  `src/domain/appearance/appearance-resolver.ts`,
  `src/config/appearance/css/palettes/`,
  `src/player/appearance-scene-style-sheet.ts`,
  `src/app/layout/app-layout.css`,
  `src/player/elce-player-style.ts`,
  `src/builders/viewport-expansion/viewport-expansion-style.ts` et les feuilles
  de densité.
- **Acceptation restante :** contrôler en rendu réel à desktop et mobile le
  cadre, le sommaire ouvert et fermé, le titre, la navigation et le contenu ;
  vérifier les fonds transparents et les exceptions locales de page/BDC.
  Compléter les cas du générateur (couleurs personnalisées, contraste, gamut,
  padding avec fond/transparent), exécuter la suite Elcé, puis ajouter les
  preuves finales à cette spécification.

## Ajustements preview — direction appliquée, validation en cours

- **Constat Brave sur écran étroit :** `.elce-popup-reader__main` ajoute un
  inset autour du cadre, qui porte aussi un fin bord de présentation ;
  `.elce-player-layout__content` n’a aucun padding. Une page avec fond local
  compense par son inset de densité Large, tandis qu’une page transparente peut
  aller au bord.
- **Décision de layout :** supprimer l’inset et le bord de présentation autour
  du cadre ; garder 1 rem de padding minimum à l’intérieur du contenu lecteur.
  Les paddings de densité des pages et BDC restent cumulables avec ce minimum.
- **Décision typographique de l’utilisateur :** lier la taille du texte à la
  largeur de son vrai conteneur et viser 60–85 caractères par ligne en moyenne.
  La formule du corps et les règles responsive des titres sont isolées dans la
  [spécification de taille responsive](../specs/responsive-text-sizing-spec.md).
  Le facteur `1.41` des titres H1–H6 s’applique aussi aux titres dédiés du
  lecteur, en conservant leurs échelles respectives.
  Les fontes de corps gardent leur interligne propre dans la plage `1.35–1.45`.
  Les paragraphes n’ajoutent qu’une marge après (`0.5/0.75/1em` selon densité).
  Les titres de BDC reçoivent `1.25em` avant, `0.5em` après et `1.2` d’interligne ;
  le premier enfant titre n’a pas de marge avant. Les cartes flex utilisent ces
  marges sans cumuler leur ancien `gap`. Les titres dédiés du lecteur utilisent
  aussi un interligne de `1.2`.
  Cette adaptation couvre le titre et le texte documentaire de tous les BDC.
  La largeur du zéro n’est qu’une approximation ; sous la largeur permettant
  de tenir cette cible au-dessus du plancher de lecture, le texte garde son
  minimum et ses retours à la ligne naturels. Aucun contrôle UI ni mesure JS.
- **Décision utilisateur du 26 octobre, appliquée :** la racine
  `.bdc` peut s’élargir jusqu’à `55rem` pour exploiter davantage la
  surface disponible. À mesure que le conteneur s’élargit, la taille du corps
  et des titres continue à suivre ses facteurs `cqi`, au-delà des plafonds
  actuels, afin de garder la cible de 60–85 caractères par ligne. Les
  planchers de densité, les lignes courtes sur petit écran et l’absence de
  contrôle auteur restent inchangés. La règle est implémentée et documentée
  dans la
  [spécification de taille responsive](../specs/responsive-text-sizing-spec.md).
  Brave mesure
  76,9 caractères par ligne en moyenne sur le texte long de Demo5 à la borne ;
  sur mobile, le plancher reste actif sans débordement horizontal. La validation
  ciblée passe 54 tests de style et composition, le typecheck et le build. La
  validation des autres BDC, fontes et contenus reste ouverte.
- **Décision utilisateur — appliquée et vérifiée :** doubler l’espace extérieur
  des BDC.
  Le `gap` du Flux passe de `1.25rem` à `2.5rem` ; les marges haute et basse
  des BDC ancrés passent de `1rem` à `2rem`. Les marges de paragraphes et de
  titres à l’intérieur des BDC gardent leurs règles existantes. Cinq suites
  ciblées passent (85 tests), ainsi que le typecheck et le build. Brave mesure
  `2.5rem` entre BDC directs en mobile et ordinateur ; deux BDC ancrés gardent
  `2rem` au-dessus et au-dessous, sans débordement horizontal. Les contrats
  Flux, ancre et apparence sont documentés dans leurs spécifications.
- **Contrôle Brave après application sur écran étroit :** l’inset principal et
  le bord de présentation sont supprimés ; le padding minimal du slot contenu
  reste actif. La page garde son inset local Large et le BDC conserve le sien.
  Le paragraphe mesuré fait 1167 caractères et revient naturellement à la ligne
  au plancher de lecture ; ce contrôle confirme le comportement étroit, pas la
  cible de longueur desktop.
- **Mesure Brave antérieure au changement de cible :** sur écran large, le cadre
  n’a plus de bord, le slot conserve son padding minimal et le titre suit son
  conteneur. Le paragraphe de 1167 caractères occupait 13 lignes, soit environ
  90 caractères par ligne avec l’ancien coefficient. Cette mesure sert de
  référence ; recalibrer le rendu selon la formule isolée dans la
  [spécification de taille responsive](../specs/responsive-text-sizing-spec.md).
- **Validation typographique Brave :** sur la preview v7, les styles calculés
  confirment un interligne de corps à `1.45`, un espace après paragraphe de
  `0.75em`, un interligne de titre à `1.2`, une marge de titre `1.25em` avant
  et `0.5em` après, ainsi qu’une marge avant nulle pour le premier titre. Les
  mêmes règles sont présentes en émulation mobile, sans débordement horizontal.
  Cette passe porte sur une page et ne valide pas encore toutes les formes de
  BDC, contenus, fontes, resize et zoom.
- **Contrôles de code :** `npm run typecheck --workspace=@codplay/elce` et
  `npm run build --workspace=@codplay/elce` passent. Le test ciblé
  `src/player/appearance-scene-style-sheet.test.ts` passe (7 tests). La suite
  Elcé passe 483 tests sur 484 ; le test restant, dans
  `sqlite-project-persistence.test.ts`, échoue car le bac à sable interdit
  l’ouverture du socket local (`listen EPERM: operation not permitted 127.0.0.1`).
  `npm run build` racine échoue également sur des erreurs TypeScript dans les
  tests de `codplay-v1` et des scènes de `demos`, hors du paquet Elcé.
- **Acceptation restante :** contrôler en rendu réel les textes longs et courts,
  titres et leurs nouveaux espacements, enrichissements, fontes, BDC étroits,
  page avec/sans fond, écran étroit, resize et zoom. Recalibrer avec les fontes
  locales et garder la tranche `En cours` jusqu’à cette validation.
