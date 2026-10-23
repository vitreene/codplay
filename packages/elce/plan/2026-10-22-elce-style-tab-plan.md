# Plan de réalisation de l’onglet Style Elcé

**Statut : A relire — analyse et proposition produites le 22 octobre 2026 ;
implémentation non engagée.** Les étapes de code restent suspendues à la
validation des décisions ci-dessous. La demande porte sur l’analyse et le
plan ; elle n’autorise pas une modification du cœur CodPlay.

L’[analyse associée](../notes/2026-10-22-style-tab-analysis.md) explique les
enjeux d’interface, d’héritage et de projection. Ce plan possède les décisions
ouvertes et le suivi de leur future application.

## Exigences exprimées

- Personnaliser l’apparence d’un projet avec une complexité faible.
- Fournir des presets généraux avec des duos titraille/texte et des gammes de
  couleurs par ambiance, clair/sombre et contraste.
- Garder les contraintes de taille de texte sous le contrôle de l’application.
- Fournir un même onglet Style aux périmètres concernés : projet, page Flux
  ou Diapo, Section et Carte ; permettre des options propres à l’app à préciser.
- Proposer typographie, fond, padding, couleur du texte et contraste contextuel,
  avec un picker accompagné de teintes prédéfinies.
- Donner priorité au réglage le plus proche du contenu : bloc, page, app.
- Prévoir ensuite des dégradés. L’extension administrable et le panneau avancé
  sont différés selon la décision de périmètre ci-dessous.

## Décisions acceptées et non encore appliquées

Les décisions suivantes ont été acceptées les 22 et 23 octobre 2026 :

- **Périmètre des réglages et du rendu :** l’auteur dispose d’une interface de
  style pour le contenu édité. Certains éléments de navigation peuvent aussi
  être restylés en fonction de ses choix, sans paramètres dédiés accessibles à
  l’auteur. Cette précision du 22 octobre remplace l’exclusion visuelle de la
  navigation ; la liste des éléments et leurs correspondances restent à arrêter.
- **Changement général :** conserver les exceptions locales et actualiser les
  valeurs héritées.
- **Défauts du projet et de l’app — 23 octobre :** compléter la chaîne par
  les défauts du projet, puis ceux de l’app. Les réglages généraux du projet
  définissent ses défauts ; une propriété absente hérite des défauts de l’app.
  La priorité reste bloc → parent BDC éventuel → page → défauts du projet
  → défauts de l’app.
- **Base provisoire de l’app — 23 octobre :** reprendre les couleurs des
  styles actuels et le duo Crimson Serif/DM Sans pour la typographie. Ce choix
  est une commodité de démarrage, révisable ; il ne fixe pas l’identité finale.
- **Export des seuls usages — 23 octobre :** conserver uniquement les valeurs
  et définitions de style réellement utilisées par les scènes exportées,
  notamment les couleurs et les typographies, avec les références CSS
  nécessaires. Les défauts hérités ne sont retenus que s’ils sont utilisés ;
  les catalogues complets de palettes et de duos ne sont pas exportés.
- **Fontes dans le package — 23 octobre :** inclure par défaut les fichiers des
  fontes utilisées comme ressources du package et les charger depuis celui-ci.
- **Padding :** hériter d’une densité adaptée au projet, à la page et au bloc.
- **Catalogue de couleurs initial :** créer cinq presets de couleurs
  harmonisées pour alimenter les teintes du picker. Enrichir ce catalogue
  ultérieurement.
- **Duos typographiques :** sélectionner au moins cinq associations
  titraille/texte à partir de la ressource Figma, exclusivement avec des
  familles Google Fonts et une orientation lecture à l’écran. Écarter les
  écritures manuscrites et les frakturs. La sélection initiale figure ci-dessous.
- **Exception typographique :** ajouter Bubblegum Sans pour la titraille avec
  Open Sans pour le texte courant, comme choix ludique autorisé par l’utilisateur.
- **Duo Crimson :** retenir l’association 37 de Figma, Crimson Serif/DM Sans,
  en remplacement de Roboto/Lora ; conserver Bubblegum Sans/Open Sans.
- **Picker natif prioritaire :** utiliser le champ natif `input` de type
  `color`, accompagné simplement des teintes prédéfinies. Aucun picker
  personnalisé ni bibliothèque supplémentaire dans le périmètre initial.
- **Extension administrable différée :** laisser de côté l’ajout de presets
  par fichiers et le panneau avancé. L’utilisateur reprendra le sujet après
  un premier état correct du reste. Aucun travail ni arbitrage de cette
  extension ne conditionne ce premier état.
- **CSS first :** privilégier les techniques web natives pour les thèmes,
  et l’héritage : propriétés personnalisées CSS, cascade et règles contextuelles.
- **Contraste :** adapter uniquement la couleur du texte à la couleur CSS de
  son background, exclusivement au moyen des fonctions CSS disponibles.
  Aucune analyse des pixels, images ou vidéos, aucun calcul ni mécanisme de
  remplacement JavaScript ne fait partie de ce réglage.

Ces décisions sont **Fixe** et restent à appliquer. Les autres propositions et
leurs détails ci-dessous sont **A relire** ; le plan global attend leur
validation avant le code dépendant. Aucune décision ci-dessous ne remplace un
comportement vérifié dans les spécifications actuelles.

## Détails et décisions à valider

| Repère | Sujet | Proposition et point à arrêter |
| --- | --- | --- |
| D1 | Périmètre des réglages et du rendu | Principe Fixe : réglages auteur sur le contenu, adaptation possible de certains éléments de navigation sans paramètres dédiés. Identifier les racines de contenu, les surfaces auteur qui les reflètent, les éléments de navigation concernés, la portée projet/page/bloc des choix qui les affectent et les correspondances de palette ou de typographie. Préserver les comportements et les états accessibles. |
| D2 | Presets généraux | Nombre initial de presets de couleurs Fixe : cinq gammes harmonisées, à enrichir plus tard. Composer leurs teintes et leurs noms. Une sélection applique un ensemble coordonné ; le duo typographique et la palette restent ensuite ajustables séparément. Ambiance et clair/sombre servent à choisir les palettes ; le contraste du texte suit D8. |
| D3 | Presets locaux | Réutiliser les définitions d’apparence et les mêmes commandes à tous les niveaux, avec uniquement les propriétés applicables au périmètre. Distinguer explicitement le preset d’apparence du layout `presetId`. Éviter un catalogue par type de panneau. |
| D4 | Exceptions et changement de preset | Conservation des exceptions des descendants Fixe. Au périmètre modifié, proposer de remplacer sa référence de preset tout en conservant ses ajustements explicites ; une action séparée rétablit le preset sans ajustements. Arrêter cette sémantique locale et les libellés. |
| D5 | Priorité par propriété | Chaîne acceptée : bloc → parent BDC éventuel → page → défauts du projet → défauts de l’app. Les réglages généraux du projet constituent ses défauts et héritent de l’app pour les propriétés absentes. Base provisoire de l’app : couleurs actuelles et Crimson Serif/DM Sans. Au sein d’un niveau, la priorité proposée reste ajustement explicite puis valeur du preset local. Aucun niveau chapitre dans la première tranche. Définir aussi le rendu des objets conservés au catalogue. |
| D6 | Fond | Distinguer fond hérité, fond transparent et fond uni explicite. Formaliser, pour chaque racine existante, la surface qui peint le fond et celle réellement placée derrière le texte ; éviter de repeindre arbitrairement toutes les zones internes. |
| D7 | Padding | Densité héritée adaptée à chaque niveau Fixe. Proposer Aucun, Compact, Normal et Aéré, avec Hériter aux niveaux locaux. Arrêter les libellés, valeurs et correspondances Flux, Diapo, Section, Carte et conteneurs imbriqués. |
| D8 | Texte et contraste | Périmètre Fixe : couleur du texte par rapport à la couleur CSS de son background, exclusivement via CSS. Fonction identifiée : `contrast-color()`, noir ou blanc à partir de la couleur fournie. La proposition ci-dessous réapplique la déclaration dans chaque périmètre et préserve une couleur manuelle. Valider son raccord aux racines Elcé et les libellés Hériter, Automatique et Couleur. Aucun traitement des pixels ou des médias, aucun calcul ou remplacement JavaScript. |
| D9 | Couleurs liées ou libres | Une teinte de palette conserve une référence sémantique ; une couleur personnalisée conserve sa valeur. La première suit les changements de palette applicables, la seconde reste fixe. Démarrer avec des couleurs unies opaques ; le fond transparent reste un choix distinct. |
| D10 | Ressources typographiques initiales | Huit duos proposés ci-dessous, issus de Figma et composés de familles Google Fonts, avec Bubblegum Sans/Open Sans comme exception ludique explicitement retenue. Définir les variantes nécessaires aux titres et aux enrichissements existants. Décision acceptée : l’export ne conserve que les typographies utilisées et inclut par défaut leurs fichiers comme ressources du package. Les tailles restent gérées par l’application. L’extension administrable reste hors de cette étape. |
| D11 | Références et version documentaire | Arrêter la forme minimale des réglages et les références aux presets initiaux. Le contrat v5 rejette les anciennes versions sans conversion : aucun mécanisme de migration ou de remplacement silencieux ne peut être présumé. La gestion d’un catalogue administrable reste différée. |
| D12 | Picker natif | Choix Fixe : priorité au champ natif `input` de type `color`. Raccorder la couleur validée aux commandes et à l’historique existants. Présenter simplement les teintes prédéfinies si nécessaire ; aucun cycle spécifique d’aperçu ou d’annulation à construire. |
| D13 | Autres BDC | Prévoir le même langage pour Carousel, Question, Résultat et Graphe, mais décider les propriétés actives et leur jalon. Les couleurs de correction, d’état, de données et de navigation gardent leur sens ; elles ne deviennent pas automatiquement la couleur du texte courant. |

Les trois questions de cadrage ont reçu les réponses conservées ci-dessus.
Les autres arbitrages seront traités dans la première étape, avant le code
dépendant.

## Sélection initiale des duos typographiques

Ces huit associations proviennent des exemples 7, 18, 23, 5, 37, 39, 32 et 34 de la
[ressource Figma](https://www.figma.com/fr-fr/resource-library/associations-de-polices/).
Les liens de chaque famille renvoient aux métadonnées du catalogue officiel
Google Fonts, consultées le 22 octobre 2026, sauf « Crimson Serif » qui renvoie
à sa désignation dans Figma. Les appréciations de caractère
sont les motifs de sélection pour Elcé ; le rendu dans l’application reste à
vérifier lors de la réalisation.

| Titraille | Texte courant | Caractère recherché |
| --- | --- | --- |
| [Inter](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/METADATA.pb) | [Krub](https://raw.githubusercontent.com/google/fonts/main/ofl/krub/METADATA.pb) | Sobre, entièrement sans empattements. |
| [Montserrat](https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/METADATA.pb) | [Karla](https://raw.githubusercontent.com/google/fonts/main/ofl/karla/METADATA.pb) | Titres géométriques, texte sans empattements. |
| [Nunito](https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/METADATA.pb) | [PT Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/ptsans/METADATA.pb) | Titres arrondis, texte sans empattements. |
| [Raleway](https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/METADATA.pb) | [Merriweather](https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/METADATA.pb) | Titres fins dans leur dessin, texte à empattements. |
| [Crimson Serif](https://www.figma.com/fr-fr/resource-library/associations-de-polices/#association-37-crimson-serif-dm-sans) | [DM Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/METADATA.pb) | Titres classiques à empattements, texte courant sans empattements. |
| [Instrument Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/METADATA.pb) | [Geist](https://raw.githubusercontent.com/google/fonts/main/ofl/geist/METADATA.pb) | Alternative sobre : dessin discret, entièrement sans empattements. |
| [Philosopher](https://raw.githubusercontent.com/google/fonts/main/ofl/philosopher/METADATA.pb) | [Mulish](https://raw.githubusercontent.com/google/fonts/main/ofl/mulish/METADATA.pb) | Titres expressifs, texte courant sobre sans empattements. |
| [Bubblegum Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/bubblegumsans/METADATA.pb) | [Open Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/METADATA.pb) | Exception ludique pour les titres, texte courant sobre sans empattements. |

**D10 — nom Google Fonts de Crimson à confirmer avant intégration.** Figma
nomme la famille « Crimson Serif » et l’attribue à Sebastian Kosch. Le catalogue
Google Fonts référence [Crimson Text](https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/METADATA.pb)
du même auteur. Cette concordance est une piste d’identification ; le nom de
chargement reste à confirmer et aucune substitution silencieuse n’est décidée.

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

La projection traduit les choix documentaires en déclarations et propriétés
personnalisées CSS sur les surfaces existantes. La cascade et l’héritage portent
le rendu ; les panneaux présentent les choix et leur provenance selon les mêmes
priorités. Lorsque parenté métier et arbre DOM diffèrent, définir la traduction
minimale nécessaire dans les builders existants, sans dupliquer la cascade dans
un moteur JavaScript. Le domaine ne lit pas le DOM pour décider ce qui est
sauvegardé. Les propriétés CSS ne deviennent pas un second stockage éditorial.

Les tailles de texte restent réglées par l’application. Les réglages visuels
préservent les niveaux de titre, les contenus riches, les médias, les événements
de fin de page, les transitions, les commandes et la progression. La navigation
de preview reste indépendante, avec synchronisation manuelle.

## Étapes et critères de sortie

Toutes les étapes sont **A relire**, à engager dans l’ordre après validation.

| Étape | Travail | Preuve nécessaire avant de passer à la suite |
| --- | --- | --- |
| P0 | Arrêter D1 à D13, dessiner le panneau commun, définir la matrice propriétés/périmètres et identifier les déclarations CSS qui doivent devenir configurables. Définir aussi les éléments de navigation adaptés automatiquement, les choix qui les affectent et leur portée, sans réglages dédiés. Vérifier les circuits existants de résolution, de configuration et de picker avant tout ajout. | Décisions acceptées, exemple projet → page → Section → Carte et exemple Carousel, cibles de projection et correspondances de navigation identifiées ; aucune ambiguïté sur fond, padding et contraste. |
| P1 | Déclarer les défauts de l’app avec les couleurs actuelles et Crimson Serif/DM Sans comme base provisoire ; permettre leur surcharge par les défauts du projet. Composer et déclarer simplement les cinq presets de couleurs harmonisées initiaux, définir les ressources typographiques et la forme documentaire des seules exceptions. Prolonger commandes, invariants, façades et sélecteurs existants. | Héritage des défauts de l’app en l’absence de valeur projet, surcharge et retour aux défauts de l’app par propriété ; cinq presets de couleurs disponibles avec leurs teintes pour le picker ; aller-retour JSON, rejet de références invalides selon D11, priorité par propriété, réinitialisation, changement de preset, déplacement et Undo/Redo couverts par des fixtures de tests autonomes. |
| P2 | Projeter les choix dans le layout du lecteur, les pages Flux/Diapo, les Sections et les Cartes, sur leurs racines et zones existantes, ainsi que dans les éléments de navigation retenus en D1 selon leurs correspondances. Traiter les styles explicites qui empêchent la personnalisation, y compris le padding initial Flux. | Composition réelle Sighty/CodPlay : cas directs, ancrés et Carousel ; typographie, couleurs et espacement effectifs mesurés. Adaptation de la navigation conforme à D1, réservations et layouts média fonctionnels après resize. |
| P3 | Raccorder le même panneau aux périmètres retenus, avec picker natif, preset, provenance, exception locale et retour à l’héritage. Montrer les choix dans les surfaces de contenu auteur ; les adaptations de navigation restent dérivées sans paramètres dédiés. | Couleur validée dans le champ natif transmise à XState et au rendu ; Annuler/Rétablir existants ; champs libellés ; conservation du même éditeur Tiptap et de sa sélection pendant les changements applicables. |
| P4 | Vérifier que la fonction CSS de contraste adapte la couleur du texte à la couleur de background applicable, puis le transport des choix vers la popup et la preview réseau. Raccorder au paquetage existant l’export des seules valeurs et définitions utilisées, avec les fichiers des fontes utilisées inclus par défaut comme ressources locales. | Changement de couleur de background reflété par la fonction CSS ; couleur de texte manuelle conservée ; définitions utilisées présentes, couleurs et typos inutilisées absentes ; fontes réellement chargées depuis les paquets Sighty et SCORM. |
| P5 | Exécuter l’acceptation complète, corriger uniquement dans les circuits propriétaires et transférer les comportements vérifiés dans les spécifications. | Matrice ci-dessous satisfaite, tests/typecheck/build Elcé et vérifications navigateur pertinents ; spécifications et suivi alignés. Le plan reste ouvert si une décision acceptée est encore inappliquée. |

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
| Nouveau projet sans personnalisation | Couleurs reprises des styles actuels et duo Crimson Serif/DM Sans hérités des défauts provisoires de l’app ; hiérarchie typographique maintenue et mêmes commandes disponibles aux périmètres retenus. |
| Défauts du projet et retour aux défauts de l’app | Une valeur générale du projet prévaut sur le défaut de l’app pour la même propriété ; retirer cette valeur rétablit le défaut de l’app. Les exceptions locales des pages et blocs restent prioritaires. |
| Catalogue initial du picker | Cinq presets de couleurs harmonisées sélectionnables ; les teintes proposées correspondent au preset actif. |
| Duos typographiques initiaux | Les huit duos proposés ci-dessus sont sélectionnables avec leurs rôles titraille/texte ; vérifier le chargement des familles, les accents français et les enrichissements existants dans l’éditeur, le lecteur et les exports. |
| Changement de preset général | Valeurs héritées actualisées, exceptions locales préservées conformément à D4 ; palette liée et couleur libre suivent D9. |
| Modification d’une seule propriété | Les autres propriétés continuent d’hériter ; provenance lisible et réinitialisation effective. |
| Fond sombre de page et Carte sans couleur locale | La fonction CSS de contraste utilise la couleur de background applicable au texte de la Carte. |
| Fond transparent et Aucun padding | Intentions locales distinctes d’Hériter ; géométrie conforme à D6 et D7, y compris aux petites largeurs. |
| Section contenant une Carte ancrée | Héritage par la Section malgré le montage runtime ; réserve du cadre, ratio et lecture média conservés. |
| Carte enfant de Carousel | Héritage par son parent ; changement de vue et retour sur la page sans perte des styles ni fuite vers une autre Carte. |
| Déplacement vers une autre page ou un autre parent | Identité, contenu et exceptions conservés ; valeurs héritées recalculées depuis le nouveau contexte. |
| Retour au catalogue et réaffectation | Réglages locaux conservés ; aperçu hors page conforme à D5 ; nouveau contexte pris en compte lors de la réaffectation. |
| Changement de layout Carte | Valeurs métier et style conservés ; propriétés sans cible textuelle visibles comme telles ; retour à un layout textuel correct. |
| Historique, persistance et accès | Un changement puis Annuler/Rétablir, rechargement, fermeture/réouverture et Enregistrer sous conservent les valeurs attendues ; projet lecteur incapable de modifier le style. |
| Picker natif | Le champ natif valide une couleur par le circuit documentaire existant ; Annuler/Rétablir fonctionne sans gestion spécifique au picker. |
| Preview | Style reçu à l’ouverture puis au clic Synchroniser ; aucun rafraîchissement automatique ajouté. Preview réseau conforme à la révision serveur confirmée. |
| Lecture et cycle de vie | Play, seek et replay sur les scènes concernées ; navigation A → B → A, resize, remontage et destruction sans perte de style ni contamination d’un autre projet. |
| Réglages et adaptation de navigation | Contenu personnalisé dans l’éditeur et le lecteur ; éléments de navigation retenus en D1 adaptés aux choix concernés sans paramètre dédié. Vérifier aussi la réinitialisation et Undo/Redo, l’absence d’effet des exceptions locales hors de leur portée, et la conservation des comportements et états accessibles. |
| Export des seuls usages | Les définitions et valeurs utilisées par les contenus et états des scènes exportées sont présentes, y compris les défauts hérités nécessaires. Les palettes, duos, couleurs et fontes inutilisés sont absents ; la sélection ne se limite pas à l’affichage initial. |
| Export autonome avec fontes | Rendu conforme à la preview dans les paquets Sighty et SCORM ; les fichiers des fontes utilisées sont inclus par défaut comme ressources du package et chargent depuis celui-ci. |
| Contraste et accessibilité du panneau | Cas limites de D8, états focus/sélection/erreur distinguables, libellés accessibles, picker et réinitialisation utilisables au clavier. |

L’acceptation du contraste vérifie uniquement l’application de la fonction CSS
à la couleur de background du texte, y compris dans les contextes hérités et
les exports. P0 identifie les fonctions CSS disponibles ; P2 exprime les
propriétés nécessaires dans les feuilles et racines existantes ; P4 vérifie
leur application. Aucune analyse de média ni solution JavaScript n’est prévue.

## D8 Exploration du contraste CSS

**23 octobre 2026 — mécanisme natif éprouvé dans une page isolée ; raccord
Elcé non implémenté.** La proposition reste **A relire** pour son intégration.

La fonction [`contrast-color()`](https://drafts.csswg.org/css-color-5/#contrast-color)
prend une couleur CSS et renvoie noir ou blanc. Elle ne lit pas une propriété
`background-color` par son nom : il faut lui transmettre la valeur. Une même
variable fournit donc le fond et l’entrée de la fonction. L’implémentation
native est documentée par [WebKit](https://webkit.org/blog/16929/contrast-color/)
et livrée dans [Chrome 147](https://developer.chrome.com/blog/new-in-chrome-147).

Proposition minimale, avec des noms illustratifs de propriétés non enregistrées :

```css
.style-scope {
  background-color: var(--background);
  color: var(--text-color, contrast-color(var(--background)));
}
```

Le fond applicable est porté par `--background`, défini ou hérité selon la
chaîne app/projet/page/bloc. Une couleur manuelle définit `--text-color`.
Le mode automatique local pose `--text-color: initial`, ce qui réactive la
fonction même sous un parent à couleur manuelle. Reprendre du parent retire
la déclaration locale. Ces trois gestes utilisent les réglages documentaires
et les racines existants, sans moteur de contraste supplémentaire.

La déclaration `color` est appliquée à chaque périmètre Style. Définir une
variable de couleur automatique une seule fois sur l’ancêtre peut figer son
argument : dans l’essai, `--cached-text: contrast-color(var(--background))`
défini sur un fond blanc a donné du texte noir dans un enfant devenu noir.
La règle proposée évite ce problème en évaluant la fonction localement.

### Preuve native isolée

La configuration locale indique Brave actif et Firefox désactivé. L’inventaire
vivant expose les outils Brave ; aucun outil Safari n’est exposé. L’essai a
utilisé une page `about:blank` dans un contexte isolé, fermée après lecture des
styles calculés. Le navigateur a annoncé `Chrome/156.0.0.0` dans son user-agent.

| Cas essayé | Résultat observé |
| --- | --- |
| `CSS.supports('color', 'contrast-color(white)')` | `true` |
| `contrast-color(background-color)` | Syntaxe refusée ; une valeur est nécessaire. |
| Ancienne écriture `color-contrast(white vs black, white)` | Syntaxe refusée. |
| App blanche → page noire → bloc blanc | Texte noir → blanc → noir. |
| Enfant sans fond local sous une page noire | Fond noir hérité, texte blanc. |
| Page passée de noir à blanc | Texte de la page et de ses enfants automatiques passé de blanc à noir. |
| Bloc passé de blanc à noir | Texte passé de noir à blanc. |
| Texte manuel `#cc0000`, puis changement du fond parent | Texte manuel conservé, également sur l’enfant qui l’hérite. |
| Automatique sous un parent manuel avec `--text-color: initial` | Texte blanc sur noir, puis noir sur blanc. |
| Retrait de la couleur manuelle locale | Retour au texte automatique noir sur le fond blanc. |

### Acceptation dans Elcé encore à réaliser

P0 peut retenir `contrast-color()` comme fonction native identifiée. P2 doit
raccorder la règle aux surfaces existantes sans laisser des couleurs fixes de
titres ou de textes la supplanter. Le fond à transmettre reste une couleur CSS ;
le traitement des pixels et des médias reste hors périmètre.

P4 doit rejouer depuis le panneau réel : modifier la couleur du fond au picker,
passer en texte automatique, choisir une couleur manuelle, reprendre du parent,
puis Annuler/Rétablir. Vérifier une page, un bloc direct, une Carte ancrée et
une Carte de Carousel. Le cas où parenté métier et DOM diffèrent reste à
valider dans les builders ; l’essai isolé ne le certifie pas.

L’export doit conserver la fonction et les variables dont elle dépend parmi
les définitions réellement utilisées, pour garder le même comportement dans
le package. Aucun calcul JavaScript ni polyfill n’est prévu. La fonction doit
être native dans le navigateur de lecture ; la validation Safari et celle des
packages restent en attente, sans lancement d’un autre navigateur local.

Avant chaque validation navigateur ou autre tâche MCP, relire la configuration
locale complète des serveurs et l’inventaire vivant complet des outils exposés,
puis comparer les capacités. Une capacité configurée sans outil appelable reste
en attente. L’essai natif ci-dessus ne vaut pas acceptation du parcours Elcé.

Les catégories de validation ci-dessus ne peuvent être omises qu’avec une
justification causale explicite de leur absence d’impact. Un build ou un test
isolé ne remplace pas la preuve du parcours réel.

## Extensions ultérieures

Le catalogue de couleurs sera enrichi après les cinq presets initiaux.

1. Ajouter un catalogue limité de dégradés et vérifier leur rendu dans les exports.
2. Reprendre l’extension administrable et le panneau avancé lorsque l’utilisateur
   y reviendra après un premier état correct du reste.
3. Étendre les commandes aux BDC retenus en D13 et aux options spécifiques du
   niveau app, avec les mêmes garanties de stockage, d’héritage et de diffusion.

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
