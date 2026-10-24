# Plan de réalisation de l’onglet Style Elcé

**Statut : En cours — implémentation demandée le 24 octobre 2026.** P0 est
Fixe pour le projet, les pages et tous les types de BDC. P1 à P5 restent en
cours ; les travaux autrefois regroupés dans P6 sont intégrés à P2, P3 et P5.
Cette demande n’autorise pas une modification du cœur CodPlay.

L’[analyse associée](../notes/2026-10-22-style-tab-analysis.md) explique les
enjeux d’interface, d’héritage et de projection. Ce plan possède les décisions
ouvertes et le suivi de leur future application.

## Exigences exprimées

- Personnaliser l’apparence d’un projet avec une complexité faible.
- Fournir des presets généraux avec des duos titraille/texte et des gammes de
  couleurs par ambiance, clair/sombre et contraste.
- Garder les contraintes de taille de texte sous le contrôle de l’application.
- Pour le contenu du document rendu, exprimer les tailles et espacements du
  texte en unités relatives, avec `rem` comme base et les unités de conteneur
  pour les adaptations nécessaires. Cette règle ne concerne pas le chrome de
  l’interface d’édition.
- Fournir un même onglet Style au projet, à chaque page et à tous les types de
  BDC. L’inset sur fond opaque vise les surfaces textuelles définies en D7 ;
  les racines média ou mixtes n’en reçoivent pas pendant ce premier débogage.
- Proposer typographie, fond, padding, couleur du texte et contraste contextuel,
  avec un picker accompagné de teintes prédéfinies.
- Donner priorité au réglage le plus proche du contenu : bloc, page, app.
- Prévoir ensuite des dégradés. L’extension administrable et le panneau avancé
  sont différés selon la décision de périmètre ci-dessous.

## Décisions acceptées et non encore appliquées

Les décisions suivantes ont été acceptées les 22, 23 et 24 octobre 2026 :

- **Périmètre des réglages et du rendu :** l’auteur dispose d’une interface de
  style pour le contenu édité. Certains éléments de navigation peuvent aussi
  être restylés en fonction de ses choix, sans paramètres dédiés accessibles à
  l’auteur. Cette précision du 22 octobre remplace l’exclusion visuelle de la
  navigation. **Précision du 24 octobre :** ignorer cette adaptation dans le
  premier état. Anticiper son besoin futur, par exemple l’aiguillage du
  chargement CSS selon un choix clair/sombre, sans arrêter ni construire ce
  mécanisme maintenant. La liste des éléments et leurs correspondances sera
  définie lors de cette extension ; elle ne conditionne pas le premier état.
- **Changement général :** conserver les exceptions locales et actualiser les
  valeurs héritées.
- **Changement de preset au même périmètre — 24 octobre :** conserver aussi
  les ajustements explicites du périmètre dont le preset change. Une Carte
  avec un fond rouge personnalisé conserve ce rouge après changement de preset.
- **Périmètre des BDC — décision confirmée :** inclure dès cette tranche tous
  les types : Section, Carte, Carousel, Question, Résultat et Graphe. Ils
  partagent les propriétés d’apparence définies par D3/D6/D7/D8 ; leurs
  surfaces et valeurs physiques restent adaptées à leur rôle. Les couleurs
  fonctionnelles de correction, d’état, de données et de navigation gardent
  leur sens et ne deviennent pas la couleur du texte courant.
- **Accès au style — 24 octobre :** supprimer le sélecteur de cible du panneau.
  Fournir un bouton accessible sur chaque page et chaque BDC, tous types
  compris, ainsi qu’une icône palette pour le projet dans l’en-tête Scénario.
  Dans les commandes BDC, l’icône palette est placée à côté de la corbeille.
  Les boutons d’action d’icône d’un en-tête BDC partagent le gabarit standard
  de `1.7rem` ; leurs pictogrammes restent à `14px`.
  Chaque bouton sélectionne sa cible et ouvre l’onglet Style ; les défauts
  globaux de l’application ne sont pas réglables par l’auteur. Les contrôles
  sont disponibles pour Carousel, Question, Résultat et Graphe dans cette
  tranche, sur leurs surfaces propres.
- **Informations de provenance du panneau — 24 octobre :** n’afficher ni les
  libellés d’héritage (`Hérité de …`), ni les origines locales, du preset du
  projet ou des défauts de l’application. Les contrôles montrent directement
  la valeur effective ; le bouton de réinitialisation apparaît pour une
  exception locale.
- **Défauts du projet et de l’app — 23 octobre :** compléter la chaîne par
  les défauts du projet, puis ceux de l’app. Les réglages généraux du projet
  définissent ses défauts ; une propriété absente hérite des défauts de l’app.
  La priorité reste bloc → parent BDC éventuel → page → défauts du projet
  → défauts de l’app.
- **Base provisoire de l’app — 23 octobre :** reprendre les couleurs des
  styles actuels et le duo Crimson Text/DM Sans pour la typographie. Ce choix
  est une commodité de démarrage, révisable ; il ne fixe pas l’identité finale.
- **Export des seuls usages — 23 octobre :** conserver uniquement les valeurs
  et définitions de style réellement utilisées par les scènes exportées,
  notamment les couleurs et les typographies, avec les références CSS
  nécessaires. Les défauts hérités ne sont retenus que s’ils sont utilisés ;
  les catalogues complets de palettes et de duos ne sont pas exportés.
- **Fontes dans le package — 23 octobre :** inclure par défaut les fichiers des
  fontes utilisées comme ressources du package et les charger depuis celui-ci.
- **Padding — 24 octobre :** hériter d’une densité adaptée au projet, à la page
  et au bloc ; Aucun, Compact, Normal et Large sont adaptés par l’application
  au rôle du contenu. Aucun met les paddings de ce rôle à zéro.
- **Inset sur fond opaque — précision du 24 octobre :** l’inset est réservé
  aux surfaces textuelles avec un fond opaque. Le débogage commence par la
  Section, les Cartes textuelles, Question et Résultat. Photo n’ajoute pas
  d’inset autour du média ; les racines Carousel et Graphe n’ajoutent pas
  d’inset autour de contenus mixtes. Leur portée éventuelle sera reprise après
  validation du chemin texte. Une densité explicitement choisie reste
  prioritaire sur Normal.
- **Presets de padding — 24 octobre :** proposer Aucun, Compact, Normal et
  Large, avec des valeurs adaptées par l’application au rôle du contenu.
  « Large » remplace la proposition « Aéré ».
- **Fond et héritage — 24 octobre :** le fond hérite par défaut ; « Hériter »
  n’apparaît pas comme choix. Transparent et Couleur expriment des choix locaux
  distincts.
- **Cibles du fond — 24 octobre :** le fond réglé au projet cible le layout du
  lecteur ; celui réglé sur un BDC cible sa surface propre. Ces valeurs restent
  portées par leurs cibles distinctes dans la chaîne d’héritage.
- **Héritage implicite et réinitialisation — 24 octobre :** généraliser ce
  principe à toutes les propriétés. Aucun choix « Hériter » n’est affiché ;
  une commande de réinitialisation par réglage supprime son exception locale.
- **Preset général coordonné — 24 octobre :** un preset applique ensemble
  palette, duo typographique et espacement. Ces réglages restent ensuite
  ajustables séparément au niveau du projet, avec conservation des ajustements
  au changement de preset selon D4. **Précision du 24 octobre :** seul le
  projet choisit ce preset général ; pages, Sections et Cartes héritent de ses
  valeurs, puis personnalisent uniquement les propriétés voulues.
- **Personnalisation sous le projet — 24 octobre :** aucun preset général ni
  champ `presetId` d’apparence à la page, à la Section ou à la Carte. Ces
  périmètres ne modifient que leurs propriétés individuelles ; les propriétés
  sans exception locale héritent du contexte.
- **Blocs au catalogue — 24 octobre :** un bloc sans page ni parent conserve
  ses exceptions et hérite des défauts du projet, puis de ceux de l’app pour
  les propriétés absentes au projet. Sa réaffectation lui donne son nouveau
  contexte d’héritage sans retirer ses exceptions.
- **Couleurs liées ou libres — 24 octobre :** le sélecteur Palette est regroupé
  avec Fond et Couleur du texte. Une teinte choisie dans une palette conserve
  sa référence sémantique et suit les changements de palette applicables. Une
  couleur personnalisée conserve sa valeur fixe.
- **Catalogue de couleurs initial :** créer cinq presets de couleurs
  harmonisées pour alimenter les teintes du picker. Enrichir ce catalogue
  ultérieurement.
- **Duos typographiques :** sélectionner au moins cinq associations
  titraille/texte composées de familles Google Fonts et adaptées à la lecture
  à l’écran. Figma peut inspirer la sélection sans imposer ses noms ni ses
  associations. Écarter les écritures manuscrites et les frakturs. La sélection
  initiale figure ci-dessous.
- **Exception typographique :** ajouter Bubblegum Sans pour la titraille avec
  Open Sans pour le texte courant, comme choix ludique autorisé par l’utilisateur.
- **Duo Crimson :** afficher les noms Google Fonts ; utiliser Crimson
  Text/DM Sans en remplacement de Roboto/Lora. Figma n’impose pas le nom de la
  famille ni l’association ; conserver Bubblegum Sans/Open Sans.
- **Picker natif prioritaire :** utiliser le champ natif `input` de type
  `color`, accompagné simplement des teintes prédéfinies. Aucun picker
  personnalisé ni bibliothèque supplémentaire dans le périmètre initial.
- **Extension administrable différée :** laisser de côté l’ajout de presets
  par fichiers et le panneau avancé. L’utilisateur reprendra le sujet après
  un premier état correct du reste. Aucun travail ni arbitrage de cette
  extension ne conditionne ce premier état.
- **CSS first :** privilégier les techniques web natives pour les thèmes,
  et l’héritage : propriétés personnalisées CSS, cascade et règles contextuelles.
- **Classes CSS en preview — 24 octobre :** les réglages et déclarations CSS
  statiques ou calculées des scènes de preview passent par des classes et les
  feuilles CSS de scène existantes, pas par `style` ni par des attributs HTML
  `style`. Dans les scènes CodPlay Elcé, `style` est réservé aux propriétés
  réellement animées, y compris leur état initial de repos. Les valeurs
  calculées propres à une cible utilisent une classe de cible et une règle CSS
  de la scène concernée. Ne pas modifier le cœur CodPlay.
- **Contraste :** adapter uniquement la couleur du texte à la couleur CSS de
  son background, exclusivement au moyen des fonctions CSS disponibles.
  Aucune analyse des pixels, images ou vidéos, aucun calcul ni mécanisme de
  remplacement JavaScript ne fait partie de ce réglage.
- **Commande de contraste — 24 octobre :** présenter une simple case
  « Contraste auto ». Aucun sélecteur de modes « Automatique ou Couleur ».
- **Version documentaire — 24 octobre :** créer une nouvelle version pour les
  réglages d’apparence ; aucune compatibilité générale avec v5 ni conversion
  automatique. Le seul document à conserver, Demo5, peut être converti dans la
  nouvelle version. **Structure v6 acceptée :** champ facultatif `appearance`
  sur le document, chaque page et chaque BDC ; seul le document porte le preset
  général, et chaque périmètre peut porter ses ajustements facultatifs
  (palette, duo typographique, densité, fond, couleur du texte, contraste auto).
  Une valeur absente hérite du contexte. Le fond accepte une référence de
  palette, une couleur fixe ou `transparent`.

Les décisions D1 à D16 sont **Fixe** pour le périmètre complet. Les
comportements déjà vérifiés dans les spécifications actuelles restent
prioritaires.

## Détails et décisions à valider

| Repère | Sujet | Proposition et point à arrêter |
| --- | --- | --- |
| D1 | Périmètre des réglages et du rendu | Fixe : réglages auteur sur le contenu ; adaptation de navigation différée après le premier état, sans réglages auteur dédiés. Anticiper le besoin futur d’un rendu dépendant des choix auteur, par exemple un chargement CSS selon clair/sombre ; aucun mécanisme n’est encore décidé. Pour le premier état, identifier les racines de contenu et les surfaces auteur qui les reflètent. Les éléments de navigation, la portée et les correspondances seront arrêtés lors de l’extension. Préserver les comportements et les états accessibles existants. |
| D2 | Preset général du projet | Fixe : cinq gammes de couleurs harmonisées initiales, à enrichir plus tard ; seul le projet choisit le preset général, qui applique ensemble palette, duo typographique et espacement. Les propriétés du projet restent ajustables séparément selon D4. Composer leurs teintes, noms et associations. Ambiance et clair/sombre servent à choisir les palettes ; le contraste du texte suit D8. |
| D3 | Personnalisation locale | Fixe : les pages et tous les BDC ne choisissent pas de preset général ; ils personnalisent uniquement leurs propriétés individuelles. Toute propriété sans exception locale hérite de son contexte. Réutiliser les définitions d’apparence et les mêmes commandes à tous les niveaux. Distinguer explicitement le preset d’apparence du layout `presetId`. |
| D4 | Exceptions et changement de preset | Fixe : remplacer le preset général du projet conserve les ajustements explicites du projet et les exceptions des descendants ; une commande par réglage supprime son exception locale, sans choix « Hériter » affiché. Aux pages, Sections et Cartes, les réglages sont des exceptions directes aux valeurs héritées. Les libellés de réinitialisation restent à préciser. |
| D5 | Priorité par propriété | Chaîne acceptée : bloc → parent BDC éventuel → page → réglages du projet → défauts de l’app. Le preset général et les ajustements explicites du projet constituent ses valeurs ; pour toute propriété absente, l’héritage s’applique depuis le niveau supérieur. Les pages, Sections et Cartes n’ont pas de preset local et ne portent que des ajustements directs. Base provisoire de l’app : couleurs actuelles et Crimson Text/DM Sans. Aucun niveau chapitre dans la première tranche. Fixe : un bloc au catalogue conserve ses exceptions et hérite des défauts du projet puis de l’app ; sa réaffectation lui donne son nouveau contexte d’héritage. |
| D6 | Fond | Fixe — 24 octobre : héritage par défaut, sans choix « Hériter » affiché ; Transparent et Couleur sont des intentions locales distinctes ; la réinitialisation par réglage supprime l’exception. Le fond de projet peint la racine du layout du lecteur, tandis que la typographie et la densité du projet restent projetées sur la zone de contenu. Le fond d’une page peint la racine Flux/Diapo, celui d’une Section sa racine ; celui d’une Carte peint sa surface propre : racine des cartes texte, zone texte de Texte avec image, légende de Image avec légende. |
| D7 | Padding | Fixe — 24 octobre : densité héritée adaptée à chaque rôle ; presets Aucun, Compact, Normal et Large ; héritage implicite et réinitialisation par réglage, sans choix « Hériter ». Aucun met son padding à zéro. **Précision ultérieure du 24 octobre :** l’inset sur fond opaque vise d’abord les surfaces textuelles (Section, Carte textuelle, Question et Résultat). Photo ne reçoit pas d’inset autour du média ; Carousel et Graphe ne reçoivent pas d’inset sur leur racine mixte pendant le débogage du texte. Une densité explicite reste prioritaire. |
| D8 | Texte et contraste | Fixe : simple case « Contraste auto », sans sélecteur de modes « Automatique ou Couleur » ; héritage implicite et réinitialisation par réglage, sans choix « Hériter ». Le contraste adapte la couleur du texte à la couleur CSS de son background exclusivement via les fonctions CSS disponibles. Le premier rendu transporte la couleur du texte et son background de contraste par propriétés personnalisées CSS sur la racine de chaque surface textuelle ; aucun traitement des pixels ou des médias, aucun calcul ou remplacement JavaScript. |
| D9 | Couleurs liées ou libres | Fixe : une teinte de palette conserve une référence sémantique et suit les changements de palette applicables ; une couleur personnalisée conserve sa valeur fixe. Les couleurs personnalisées démarrent unies et opaques ; le fond transparent reste un choix distinct. |
| D10 | Ressources typographiques initiales | Huit duos composés de familles Google Fonts, avec Bubblegum Sans/Open Sans comme exception ludique explicitement retenue ; Figma peut inspirer la sélection sans imposer ses noms ni ses associations. Utiliser les noms Google Fonts dans l’interface et le CSS. Définir les variantes nécessaires aux titres et aux enrichissements existants. Décision acceptée : l’export ne conserve que les typographies utilisées et inclut par défaut leurs fichiers comme ressources du package. Les tailles restent gérées par l’application. L’extension administrable reste hors de cette étape. |
| D11 | Références et version documentaire | Fixe — 24 octobre : créer v6, sans compatibilité générale ni conversion automatique depuis v5 ; convertir uniquement le document Demo5 à conserver. `appearance` facultatif sur le document, les pages et les BDC ; `presetId` d’apparence est autorisé uniquement sur le document. Chaque niveau peut porter ses ajustements directs facultatifs (palette, duo typographique, densité, fond, couleur du texte, contraste auto) ; un champ absent hérite du contexte. Le fond distingue une référence de palette, une couleur fixe et `transparent`. La gestion d’un catalogue administrable reste différée. |
| D12 | Picker natif | Choix Fixe : priorité au champ natif `input` de type `color`. Raccorder la couleur validée aux commandes et à l’historique existants. Présenter simplement les teintes prédéfinies si nécessaire ; aucun cycle spécifique d’aperçu ou d’annulation à construire. |
| D13 | Types de BDC | Fixe — décision confirmée : Carousel, Question, Résultat et Graphe font partie du périmètre immédiat, avec Section et Carte. Tous utilisent le même langage d’apparence et les mêmes commandes ; chaque règle cible la surface de son BDC. L’inset actuel est réservé aux surfaces textuelles définies en D7 ; il ne s’applique pas aux racines Carousel/Graphe ni aux médias Photo. Les couleurs de correction, d’état, de données et de navigation gardent leur sens ; elles ne deviennent pas automatiquement la couleur du texte courant. |
| D14 | Unités CSS du document | Fixe — 24 octobre : dans les CSS du contenu document (preview, lecteur, exports), les propriétés qui règlent le rythme du texte (taille, interlignage, marges, espacements et padding de sa surface) utilisent des unités relatives, avec `rem` comme base ; `vw` et `cqw` servent à l’adaptation au layout. Aucune de ces propriétés textuelles n’est déclarée en pixels ; les pixels observés dans les styles calculés du navigateur restent des mesures résolues. Cette décision ne s’applique pas au chrome de l’interface d’édition, qui conserve ses propres règles. |
| D15 | Organisation des définitions CSS | Fixe — 24 octobre : les définitions stables des palettes, duos typographiques et densités sont regroupées et consultables dans des fichiers CSS du document, principalement CSS ; elles ne sont pas reconstruites propriété par propriété par des fonctions. Le code choisit les classes en fonction des réglages résolus. Les valeurs personnalisées saisies par l’auteur peuvent conserver une règle de classe ciblée. Les styles du chrome d’édition restent dans leurs propres feuilles et sont hors de cette décision. |
| D16 | Transport des fichiers CSS | Fixe — 24 octobre : servir les feuilles d’apparence comme assets CSS via le routeur Remix. En preview, le player ajoute au document lecteur les seuls liens CSS utilisés ; ils restent séparés des feuilles de l’interface d’édition. Pour l’export, le scénario Sighty importe les seules feuilles CSS utilisées et le paquetage CodPlay les développe dans la feuille scoped de la scène layout, via le circuit d’import CSS local existant. Aucun import `?inline` CSS ni générateur de règles thématiques propriété par propriété. Les teintes nécessaires au picker sont des métadonnées générées depuis les fichiers palette CSS. |

Les décisions D1 à D16 sont Fixe pour le périmètre de cette tranche. Les
propriétés communes s’appliquent à tous les types de BDC ; les valeurs
physiques et leurs surfaces de projection sont adaptées à leur rôle selon D6
et D7.

## Sélection initiale des duos typographiques

Les duos utilisent les familles officielles Google Fonts. Les associations
Figma consultées le 22 octobre 2026 ont servi d’inspiration, sans contrainte sur
les noms affichés ni sur les associations retenues. Les liens renvoient aux
métadonnées Google Fonts. Les appréciations de caractère sont les motifs de
sélection pour Elcé ; le rendu dans l’application reste à vérifier.

| Titraille | Texte courant | Caractère recherché |
| --- | --- | --- |
| [Inter](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/METADATA.pb) | [Krub](https://raw.githubusercontent.com/google/fonts/main/ofl/krub/METADATA.pb) | Sobre, entièrement sans empattements. |
| [Montserrat](https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/METADATA.pb) | [Karla](https://raw.githubusercontent.com/google/fonts/main/ofl/karla/METADATA.pb) | Titres géométriques, texte sans empattements. |
| [Nunito](https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/METADATA.pb) | [PT Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/ptsans/METADATA.pb) | Titres arrondis, texte sans empattements. |
| [Raleway](https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/METADATA.pb) | [Merriweather](https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/METADATA.pb) | Titres fins dans leur dessin, texte à empattements. |
| [Crimson Text](https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/METADATA.pb) | [DM Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/METADATA.pb) | Titres classiques à empattements, texte courant sans empattements. |
| [Instrument Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/METADATA.pb) | [Geist](https://raw.githubusercontent.com/google/fonts/main/ofl/geist/METADATA.pb) | Alternative sobre : dessin discret, entièrement sans empattements. |
| [Philosopher](https://raw.githubusercontent.com/google/fonts/main/ofl/philosopher/METADATA.pb) | [Mulish](https://raw.githubusercontent.com/google/fonts/main/ofl/mulish/METADATA.pb) | Titres expressifs, texte courant sobre sans empattements. |
| [Bubblegum Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/bubblegumsans/METADATA.pb) | [Open Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/METADATA.pb) | Exception ludique pour les titres, texte courant sobre sans empattements. |

**D10 — nom confirmé le 24 octobre.** L’interface et le CSS emploient les noms
Google Fonts ; la famille utilisée est Crimson Text/DM Sans. Figma ne contraint
ni le nom de la famille ni le choix de l’association. Les fichiers locaux
contiennent les variantes normales et italiques 400/700 pour les familles qui
les proposent ; Bubblegum Sans utilise sa variante normale 400. Le rendu dans
preview et export reste à valider.

Le panneau propose le duo comme un choix unique ; la titraille et le texte
gardent leurs rôles définis. Les variantes utiles au gras et à l’italique
existants sont conservées. La sélection n’ajoute aucun réglage de taille ni
d’axes typographiques.

## Circuits propriétaires et invariants à conserver

| Concerné | Contrat à relire | Circuit à prolonger |
| --- | --- | --- |
| Réglages persistés et intentions | [Modèle documentaire](../specs/document-model-spec.md) | Types, invariants et commandes purs ; façades applicatives vers le même acteur XState. |
| Historique et sauvegarde | [Historique](../specs/document-history-spec.md), [projet actif](../specs/project-session-spec.md) | Historique unique, IndexedDB, synchronisation et droits d’édition existants. |
| Panneaux et sélection | [Entrée Remix](../specs/remix-spa-spec.md), [Section](../specs/section-editor-spec.md) | Vues Remix et adaptateur Tiptap existants ; pas de styles libres injectés dans le texte pour simuler le style du bloc. |
| Structure des blocs | [Modèle documentaire](../specs/document-model-spec.md), [Carousel](../specs/carousel-bdc-spec.md) | Configuration de presets et `ElceCardPresetBuilder` pour le markup ; le layout reste indépendant de l’apparence. |
| Projection réelle | [Flux](../specs/flux-scene-builder-spec.md), [Diapo](../specs/diapo-scene-builder-spec.md), [ancres](../specs/codplay-anchor-integration-spec.md) | Builders et racines utiles existants ; relations parent/enfant conservées, réservations de flux et cadrages média préservés. |
| Preview et diffusion | [Lecteur](../specs/player-preview-spec.md), [export Sighty](../specs/sighty-export-spec.md), [export SCORM](../specs/scorm-export-spec.md) | Même producteur de scénario ; CSS commune sur le layout, CSS de page sur sa scène, ressources embarquées par le paquetage existant. |

La projection traduit les choix documentaires en classes et règles CSS sur les
surfaces existantes. Les valeurs variables propres à une cible sont déclarées
dans la feuille de sa scène, puis appliquées par sa classe ; les réglages ne
sont pas portés par des propriétés `style` ni des attributs HTML `style`. La
cascade et l’héritage portent le rendu ; les contrôles présentent directement
la valeur effective et la réinitialisation supprime une exception locale. Aucun
libellé d’origine n’est affiché. Lorsque parenté métier et arbre DOM diffèrent,
définir la traduction minimale nécessaire dans les builders
existants, sans dupliquer la cascade dans un moteur JavaScript. Le domaine ne
lit pas le DOM pour décider ce qui est sauvegardé. Les propriétés CSS ne
deviennent pas un second stockage éditorial.

Les tailles de texte restent réglées par l’application. Les réglages visuels
préservent les niveaux de titre, les contenus riches, les médias, les événements
de fin de page, les transitions, les commandes et la progression. La navigation
de preview reste indépendante, avec synchronisation manuelle.

## Étapes et critères de sortie

Le cadrage P0 est **Fixe** pour le projet, les pages et tous les types de BDC ;
le travail produit par P1 à P5 reste **En cours**. Les étapes s’engagent dans
l’ordre de leurs dépendances.

### Démarrage et validations restantes

- Circuit identifié : `config/presets.ts` possède les layouts ; le catalogue
  d’apparence demandé en D3 est distinct des layouts et sera déclaré dans
  `config/appearance/`. Aucun circuit de thème ou picker existant n’a été trouvé
  dans Elcé lors de la recherche ciblée du 24 octobre.
- Catalogue de P1 déclaré et vérifié : cinq palettes à rôles communs, huit
  références de duos, quatre densités et cinq presets coordonnés. Références
  et rejet des inconnues vérifiés par chargement Vite SSR ; typecheck et build
  réussis. Le contrat limité de ce lot et ses preuves figurent dans la
  [spécification d’apparence](../specs/appearance-spec.md). P1 reste **En cours**.
- P1/P3 — modèle v6, commandes, SQLite et conversion ciblée de Demo5 sont
  implémentés. Les boutons ouvrent le style du projet, de chaque page et de
  chaque BDC ; le panneau commun expose les propriétés et le preset général
  uniquement au projet. Le test du panneau vérifie les valeurs réellement
  sélectionnées et le passage d’un changement de densité vers la classe de
  scène. Demo5 est en v6, révision 26, avec 11 pages et 21 BDC ; les médias
  référencés ont été restaurés dans FileStorage depuis les assets Demo5. Les
  spécifications modèle et API décrivent maintenant v6. Persistance complète,
  historique, accessibilité clavier et retour du focus restent à valider.
- P1/P3 — précision acceptée le 24 octobre : le preset général est choisi
  uniquement au niveau du projet. Le panneau ne le présente qu’au projet ; les
  pages et BDC gardent leurs réglages directs par propriété. Les
  types de commandes lient le choix de `presetId` au projet et les invariants
  rejettent ce champ sur les cibles inférieures. Safari MCP confirme le
  contexte Question, le groupe « Couleurs », l’absence de provenance et les
  options effectivement sélectionnées. Le parcours clavier, chaque cible,
  Undo/Redo et le retour du focus restent à valider.
- Projection CSS — optimisation du 24 octobre : les propriétés communes aux
  surfaces sont émises une seule fois par feuille ; les déclarations calculées
  identiques partagent une règle avec plusieurs sélecteurs. Les déclarations
  propres à une cible restent portées par sa classe CSS. Le nom des classes
  conserve le rôle et utilise un suffixe de hachage compact au lieu d’encoder
  l’identifiant cible caractère par caractère. Les défauts de
  l’application ne répètent plus les valeurs déjà définies par le preset
  Classique ; le contraste auto reste un réglage distinct. Safari vérifie les
  familles, fonds et paddings calculés par classes sur la preview réelle, sans
  attribut `style` sur les surfaces inspectées. L’export et les interactions
  complètes restent à accepter.
- Fontes de preview — correction du 24 octobre : la feuille layout déclare
  maintenant une seule fois chaque face (famille, style et poids) utilisée dans
  les scènes du document ; les feuilles de page ne redéclarent plus les mêmes
  `@font-face`. Leur `src` utilise `/fonts/`, servi depuis `src/assets` par Vite
  et conservé comme chemin relatif dans le paquet Sighty. Safari a reçu
  Crimson Text avec le type `font/ttf` et calculé Crimson Text/DM Sans sur la
  preview. Le chargement autonome en export reste à vérifier lors de P4.
- Demo5 — la migration `20261024190000_flatten_demo5_local_appearance_presets`
  développe les presets locaux en ajustements de propriétés et conserve les
  exceptions existantes. La lecture de Demo5 dans l’éditeur et dans la preview
  est vérifiée sur le serveur local.
- D6/D7 — le fond projet cible la racine layout, celui d’une page la racine de
  page et celui d’un BDC sa propre surface. Safari mesure sur la preview un
  fond de layout `rgb(245, 247, 239)`, une Section Ardoise dont la règle source
  utilise `clamp(1rem, 3vw, 2rem)` et une Question Prune avec
  `clamp(1rem, 3vw, 1.6rem)`. Ces surfaces portent des classes CSS et aucun
  attribut `style`. L’inset opaque est limité aux rôles textuels
  de D7 ; le test de feuille confirme l’absence de padding sur les racines
  Carousel/Graphe et la Photo.
- D11 — réponse reçue le 24 octobre : nouvelle version documentaire, aucun
  héritage de version, conversion ciblée du seul document Demo5 à conserver.
  Structure `appearance` facultative confirmée pour document, pages et BDC ;
  le preset général est réservé au projet, les autres niveaux portent des
  ajustements par propriété.
- D8 : Safari exposé par le serveur MCP configuré `safari-mcp` accepte
  `contrast-color(#ffffff)` et refuse l’ancienne syntaxe `color-contrast(...)`
  lors du contrôle `CSS.supports` du 24 octobre. Cela ne valide pas encore la
  projection ni le contraste effectif des scènes.
- D10 — réponse reçue le 24 octobre : utiliser les noms Google Fonts ; Figma
  n’impose ni les noms ni les associations. Le duo est affiché Crimson Text /
  DM Sans. Les variantes locales des seize familles retenues ont été récupérées
  depuis Google Fonts avec leurs licences OFL ; les feuilles de scène ne
  déclarent que les familles utilisées et l’export copie les faces et licences
  correspondantes. Typecheck et build passent ; preview et paquets Sighty/SCORM
  restent à valider.
- P2/P5 — classes CSS en preview, 24 octobre : les builders Elcé projettent
  les déclarations statiques ou calculées via des classes et les feuilles de
  style existantes, y compris l’apparence, la géométrie des ancres, les médias,
  les marqueurs, le Graphe et le Carousel. Le balayage des builders ne laisse
  dans `PersoDoc.style` que les valeurs d’état initial et les transitions des
  propriétés animées ; les builders n’émettent plus d’attribut `style` pour
  leur présentation statique. Les tests complets (71 fichiers, 461 tests), le
  typecheck et le build passent ; le build garde un avertissement de taille de
  chunk. Safari valide le rendu réel des surfaces Section et Question. Les
  parcours complets Play/Seek, resize, exports, ancres, cycle de vie et focus
  restent à faire. P2/P5 restent En cours.
- D14 — unités CSS du contenu document, 24 octobre : le balayage des règles du
  lecteur et des surfaces de Graphe ne trouve plus de taille, interlignage,
  marge, gap ni padding textuel déclaré en `px`. Safari accepte la formule
  `rem`/`cqw` du Graphe et expose les règles `font-size` sans unité `px`. La
  règle exclut les feuilles de chrome de l’interface d’édition ; leurs unités
  restent indépendantes. L’acceptation visuelle complète des quatre rendus du
  Graphe reste suivie par P5.
- D15/D16 — organisation et transport CSS, 24 octobre : décision acceptée de
  garder les définitions stables des palettes, des duos typographiques et des
  densités dans des fichiers CSS du document. Le chargement `?inline` a été
  rejeté par Remix (`IMPORT_NOT_SUPPORTED`). D16 fixe désormais leur service
  comme assets en preview et leur import local pour l’export Sighty. Le player
  seul charge ces assets dans le document lecteur ; le chrome d’édition garde
  ses propres feuilles. Les teintes du picker sont générées depuis les CSS,
  sans seconde définition éditable. Safari MCP confirme les huit assets
  réellement utilisés par Demo5 chargés dans la preview, sans erreur HTTP ; les
  polices et styles calculés correspondent aux règles de scène. Les tests
  d’export confirment l’inclusion des seuls CSS de thème utilisés dans le CSS
  scoped du layout Sighty. Les validations complètes d’export restent suivies
  en P4.

| Étape | Travail | Preuve nécessaire avant de passer à la suite |
| --- | --- | --- |
| P0 | Arrêter D1 à D16 pour le projet, les pages et tous les types de BDC ; définir la matrice propriétés/périmètres et identifier les déclarations CSS à rendre configurables. Anticiper l’adaptation future de navigation sans en faire un préalable ni construire un mécanisme dédié. Vérifier les circuits existants de résolution, de configuration et de picker avant tout ajout. **Statut : Fixe pour tous les types de BDC.** | Décisions D1 à D16 acceptées ; exemple projet → page → Section → Carte et Carte enfant de Carousel ; cibles des BDC Carousel, Question, Résultat et Graphe identifiées ; aucune ambiguïté sur fond, padding, contraste, unités relatives du texte, organisation et transport des définitions CSS. |
| P1 | Déclarer les défauts de l’app avec les couleurs actuelles et Crimson Text/DM Sans comme base provisoire ; permettre leur surcharge par les défauts du projet. Composer et déclarer simplement les cinq presets de couleurs harmonisées initiaux, définir les ressources typographiques et la forme documentaire des seules exceptions. Prolonger commandes, invariants, façades et sélecteurs existants. | Héritage des défauts de l’app en l’absence de valeur projet, surcharge et retour aux défauts de l’app par propriété ; cinq presets de couleurs disponibles avec leurs teintes pour le picker ; aller-retour JSON v6, rejet de v5 et des références invalides, conversion ciblée de Demo5, priorité par propriété, réinitialisation, changement de preset, déplacement et Undo/Redo couverts par des fixtures de tests autonomes. |
| P2 | Projeter le fond du projet sur la racine du layout du lecteur, et ses propriétés typographiques et de densité sur la zone de contenu. Projeter les réglages des pages Flux/Diapo et de tous les types de BDC sur leurs racines et surfaces propres, sans confondre leurs cibles. Exprimer les déclarations statiques non animées par classes CSS ; réserver `style` aux propriétés animées. Garder les règles fixes de palettes, typographies et densités dans des fichiers CSS du document ; le code choisit les classes et limite les règles ciblées aux valeurs auteur qui ne peuvent pas être prédéfinies. Les CSS utilisés sont servis comme assets au player en preview et importés localement par la feuille layout en export Sighty. L’inset sur fond opaque vise d’abord Section, Cartes textuelles, Question et Résultat ; il n’entoure pas les médias Photo ni les racines Carousel/Graphe. Le rythme du texte du document utilise des unités relatives, avec `rem` comme base ; ce critère ne couvre pas le chrome de l’interface d’édition. | Composition réelle Sighty/CodPlay : fonds layout/page/BDC distincts ; inset calculé sur Section, Question et les trois layouts de Carte textuelle avec valeurs effectives ; absence d’inset sur Photo, Carousel et Graphe. Les fichiers CSS exposent directement les règles fixes du document et les scènes utilisent les classes correspondant aux réglages résolus. Tailles, interlignages, marges, gaps et paddings textuels du document sans longueurs px déclarées. Cartes directes, ancrées et enfants de Carousel ; resize, réservations média et comportements accessibles conservés. Aucune présentation statique dans les propriétés CodPlay `style` ni dans les attributs HTML `style`. |
| P3 | Remplacer le sélecteur « Cible » par une icône palette accessible pour le projet dans l’en-tête Scénario, et un bouton sur chaque page et chaque BDC de tous types, y compris les Cartes enfants et les BDC disponibles au catalogue. Dans les commandes BDC, placer l’icône palette à côté de la corbeille. Chaque bouton sélectionne sa cible et ouvre l’onglet Style. Réserver le preset général au projet ; garder les réglages par propriété sur les pages et tous les BDC. Ne présenter aucun libellé de provenance ou d’héritage ; la valeur effective figure dans chaque contrôle, et le bouton de réinitialisation apparaît pour une exception locale. | Boutons clavier accessibles et libellés ; chaque activation ouvre l’onglet Style sur la bonne cible ; fermeture du panneau rend le focus au bouton d’origine ; le preset général est présent uniquement sur Projet ; tous les types de BDC exposent leurs propriétés communes sur leur surface propre ; aucune commande ne peut stocker `presetId` hors projet ; aucun libellé d’origine ou d’héritage affiché. Couleur validée transmise à XState et au rendu ; Annuler/Rétablir existants ; conservation du même éditeur Tiptap et de sa sélection pendant les changements applicables. |
| P4 | Vérifier que la fonction CSS de contraste adapte la couleur du texte à la couleur de background applicable, puis le transport des choix vers la popup et la preview réseau. L’export des feuilles CSS du document et fontes locales est raccordé au paquetage Sighty existant ; valider la sélection des seuls usages, le chargement autonome et la conservation des licences. | Changement de couleur de background reflété par la fonction CSS ; couleur de texte manuelle conservée ; seuls les CSS, règles et fontes réellement utilisés présents dans les packages Sighty et SCORM ; chargement autonome et conservation des licences vérifiés. |
| P5 | Déboguer le périmètre complet, exécuter son acceptation, corriger uniquement dans les circuits propriétaires et transférer les comportements vérifiés dans les spécifications. | Matrice ci-dessous satisfaite pour le projet, les pages et tous les BDC ; tests/typecheck/build Elcé et vérifications navigateur pertinentes ; spécifications et suivi alignés. Les scènes utilisent des classes pour les déclarations non animées ; seules les propriétés liées à une animation restent dans `style`. |

P1 et P2 n’introduisent pas une API runtime Style, un registre global de CSS ou
un moteur de thèmes parallèle. Si le circuit existant laisse un besoin sans
propriétaire, consigner ce manque ici et faire valider sa frontière avant de
l’implémenter. Toute modification nécessaire de `packages/codplay` demande une
autorisation explicite et un plan accepté distinct.

## Matrice d’acceptation

Les tests possèdent leurs documents, valeurs, fontes et ressources. Un projet
d’essai navigateur valide le parcours auteur et le runtime réel ; les démos ne
deviennent pas des dépendances des tests.

| Cas | Résultat attendu après validation des décisions |
| --- | --- |
| Nouveau projet sans personnalisation | Couleurs reprises des styles actuels et duo Crimson Text/DM Sans hérités des défauts provisoires de l’app ; hiérarchie typographique maintenue et mêmes commandes disponibles aux périmètres retenus. |
| Défauts du projet et retour aux défauts de l’app | Une valeur générale du projet prévaut sur le défaut de l’app pour la même propriété ; retirer cette valeur rétablit le défaut de l’app. Les exceptions locales des pages et blocs restent prioritaires. |
| Catalogue initial du picker | Cinq presets de couleurs harmonisées sélectionnables ; les teintes proposées correspondent au preset actif. |
| Preset général coordonné | Le projet seul choisit le preset ; palette, duo typographique et espacement s’appliquent ensemble, puis restent ajustables séparément avec conservation des ajustements conformément à D4. |
| Personnalisation sous le projet | La page, la Section ou la Carte n’affiche pas de preset général ; chacune peut ajuster ses propriétés disponibles, tandis que les autres continuent d’hériter du contexte. |
| Duos typographiques initiaux | Les huit duos proposés ci-dessus sont sélectionnables avec leurs rôles titraille/texte ; vérifier le chargement des familles, les accents français et les enrichissements existants dans l’éditeur, le lecteur et les exports. |
| Changement du preset général du projet | Valeurs héritées actualisées et exceptions conservées conformément à D4 ; une Carte au fond rouge personnalisé garde ce rouge après changement du preset du projet ; palette liée et couleur libre suivent D9. |
| Modification et réinitialisation d’une seule propriété | Les autres propriétés continuent d’hériter ; origines locales, preset et défaut d’application restent lisibles, sans libellé d’héritage ; aucune option « Hériter » affichée. La commande de réinitialisation du réglage supprime uniquement son exception locale. |
| Fond sombre de page et Carte sans couleur locale | La fonction CSS de contraste utilise la couleur de background applicable au texte de la Carte. |
| Cibles distinctes du fond | Le fond réglé au projet cible la racine du layout ; un réglage de page, Section ou Carte cible sa propre surface. Modifier un BDC ne modifie ni le réglage projet ni celui d’un autre BDC ; en l’absence d’exception, l’héritage D5 s’applique. |
| Inset texte sur fond opaque | Section, Question, Résultat et les trois layouts de Carte textuelle reçoivent leur padding Normal quand leur fond est opaque ; une densité explicite reste prioritaire. Photo ne reçoit pas de padding autour du média. Le padding des racines Carousel et Graphe reste hors du premier débogage texte. |
| Fond par défaut, transparent et Aucun padding | Sans choix local, le fond hérite sans option « Hériter » affichée. Transparent et Aucun padding sont des intentions locales distinctes de l’absence de réglage ; géométrie conforme à D6 et D7, y compris aux petites largeurs. |
| Presets de padding | Aucun, Compact, Normal et Large disponibles ; valeurs adaptées au rôle du contenu selon D7. |
| Section contenant une Carte ancrée | Héritage par la Section malgré le montage runtime ; réserve du cadre, ratio et lecture média conservés. |
| Carte enfant de Carousel | Héritage par son parent ; changement de vue et retour sur la page sans perte des styles ni fuite vers une autre Carte. |
| Déplacement vers une autre page ou un autre parent | Identité, contenu et exceptions conservés ; valeurs héritées recalculées depuis le nouveau contexte. |
| Retour au catalogue et réaffectation | Réglages locaux conservés ; hors page et sans parent, héritage des défauts du projet puis de l’app ; nouveau contexte pris en compte lors de la réaffectation sans perte des exceptions. |
| Changement de layout Carte | Valeurs métier et style conservés ; propriétés sans cible textuelle visibles comme telles ; retour à un layout textuel correct. |
| Historique, persistance et accès | Un changement puis Annuler/Rétablir, rechargement, fermeture/réouverture et Enregistrer sous conservent les valeurs attendues ; projet lecteur incapable de modifier le style. |
| Picker natif | Le champ natif valide une couleur par le circuit documentaire existant ; Annuler/Rétablir fonctionne sans gestion spécifique au picker. |
| Preview | Style reçu à l’ouverture puis au clic Synchroniser ; aucun rafraîchissement automatique ajouté. Preview réseau conforme à la révision serveur confirmée. |
| Lecture et cycle de vie | Play, seek et replay sur les scènes concernées ; navigation A → B → A, resize, remontage et destruction sans perte de style ni contamination d’un autre projet. |
| Réglages de contenu et navigation existante | Contenu personnalisé dans l’éditeur et le lecteur ; réinitialisation et Undo/Redo fonctionnels, absence d’effet des exceptions locales hors de leur portée, comportements et états accessibles de navigation conservés. L’adaptation visuelle de navigation n’est pas un critère du premier état. |
| Export des seuls usages | Les définitions et valeurs utilisées par les contenus et états des scènes exportées sont présentes, y compris les défauts hérités nécessaires. Les palettes, duos, couleurs et fontes inutilisés sont absents ; la sélection ne se limite pas à l’affichage initial. |
| Export autonome avec fontes | Rendu conforme à la preview dans les paquets Sighty et SCORM ; les fichiers des fontes utilisées sont inclus par défaut comme ressources du package et chargent depuis celui-ci. |
| Contraste et accessibilité du panneau | Simple case « Contraste auto », sans sélecteur de modes ; cas limites de D8, états focus/sélection/erreur distinguables, libellés accessibles, case, picker et réinitialisation utilisables au clavier. |

L’acceptation du contraste vérifie uniquement l’application de la fonction CSS
à la couleur de background du texte, y compris dans les contextes hérités et
les exports. P0 identifie les fonctions CSS disponibles ; P2 exprime les
propriétés nécessaires dans les feuilles et racines existantes ; P4 vérifie
leur application. Aucune analyse de média ni solution JavaScript n’est prévue.

La configuration locale et l’inventaire complet des outils Safari MCP ont été
comparés avant la validation du 24 octobre. L’acceptation navigateur restante
est suivie dans P2/P4/P5 ; le rendu réel des surfaces vérifiées ne valide pas
encore toutes les interactions, exports et cycles de vie.

Les catégories de validation ci-dessus ne peuvent être omises qu’avec une
justification causale explicite de leur absence d’impact. Un build ou un test
isolé ne remplace pas la preuve du parcours réel.

## Extensions ultérieures

Le catalogue de couleurs sera enrichi après les cinq presets initiaux.

1. Ajouter un catalogue limité de dégradés et vérifier leur rendu dans les exports.
2. Reprendre l’extension administrable et le panneau avancé lorsque l’utilisateur
   y reviendra après un premier état correct du reste.
3. Définir et réaliser l’adaptation de navigation anticipée en D1, sans
   réglages auteur dédiés, puis préciser les options spécifiques du niveau app.
   Arrêter les correspondances, leur portée et le mécanisme utile avant leur
   implémentation, avec les mêmes garanties de stockage et de diffusion.

## Documentation de sortie

Après implémentation et vérification, créer une spécification ciblée de
l’apparence Elcé : rôle, réglages, priorité par propriété, surfaces, ressources,
périmètre du contraste CSS et preuves. Mettre à jour les spécifications propriétaires
du modèle, de l’éditeur, des builders, du lecteur et des exports pour les seuls
comportements effectivement changés et vérifiés.

Ajouter ensuite un exemple simple d’utilisation dans le guide utilisateur
approprié. Quand tout le périmètre accepté sera couvert, transférer les preuves
dans la spécification, mettre à jour les liens entrants puis retirer ce plan et
ses notes préparatoires. Les extensions encore retenues mais inappliquées
doivent d’abord être transférées vers un plan actif.
