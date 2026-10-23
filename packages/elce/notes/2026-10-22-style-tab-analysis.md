# Analyse de l’onglet Style Elcé

L’onglet Style doit permettre de donner une identité visuelle à un projet,
puis de personnaliser une page ou un bloc avec les mêmes commandes. La
simplicité vient d’un petit nombre de choix coordonnés, de valeurs héritées
visibles et d’un retour facile au style du parent.

L’interface Style donne à l’auteur des réglages sur le contenu du projet.
La portée visuelle de ses choix peut aussi inclure certains éléments de
navigation, dont l’apparence s’adapte sans réglages dédiés accessibles à l’auteur.
Un changement général conserve les exceptions locales ; le padding suit une
densité héritée adaptée au projet, à la page et au bloc. Ces décisions sont
acceptées et leur application reste à réaliser dans le plan.

Cette étude accompagne le [plan de réalisation](../plan/2026-10-22-elce-style-tab-plan.md).
Les arbitrages et propositions à valider sont réunis dans ce plan. Les
comportements décrits ci-dessous comme cible ne sont pas encore des contrats
implémentés.

## Les circuits existants

Le [modèle documentaire](../specs/document-model-spec.md) distingue le projet,
les pages Flux ou Diapo et les BDC, avec des relations parent/enfant. Une Carte
peut être directe, ancrée dans une Section ou enfant d’un Carousel. Son
`presetId` désigne une structure de contenu ; changer ce layout conserve ses
champs. Il faut préserver cette indépendance entre structure et apparence.

Les objets de `src/config/presets.ts` déclarent aujourd’hui le markup et les
zones des blocs. Le contrôle ciblé de `document-types.ts` confirme que le
document v5 ne possède pas de personnalisation visuelle commune à ces niveaux.
`elce-player-style.ts` porte de nombreuses couleurs et espacements explicites ;
le builder Flux fixe aussi un padding dans le style initial de son article.
L’ajout d’un sélecteur seul ne suffirait donc pas à rendre le projet thémable.
Ces observations établissent le travail à prévoir, sans signaler une divergence
avec un contrat Style qui n’existe pas encore.

Les écritures empruntent déjà les façades applicatives, les commandes et
l’acteur XState. La [chronologie documentaire](../specs/document-history-spec.md)
et la persistance doivent recevoir les gestes Style par cette même voie.
L’[entrée Remix](../specs/remix-spa-spec.md) fournit les surfaces auteur sans
posséder un second document.

Le [lecteur](../specs/player-preview-spec.md#sources-de-style-du-scénario) et
l’[export Sighty](../specs/sighty-export-spec.md) partagent
`createElcePlayerScenario`. Les styles communs sont attachés à la scène layout,
ceux des builders à leur scène de page. C’est le circuit de diffusion à
prolonger. La popup conserve sa synchronisation manuelle actuelle.

## Une identité générale et des exceptions locales

L’interface de réglage et la portée du rendu sont deux périmètres distincts.
L’auteur agit sur le contenu et l’identité du projet ; la navigation concernée
peut reprendre automatiquement des choix de palette ou de typographie selon
des règles définies par l’application. Par exemple, un preset pourrait accorder
les boutons de navigation à son accent, sans ajouter un champ « couleur des
boutons » au panneau. Le plan doit préciser les éléments concernés et les
correspondances ; leur comportement et leurs états accessibles restent préservés.

Un preset général peut réunir un duo typographique, une palette et des valeurs
d’apparence coordonnées. L’auteur obtient un résultat complet en une action,
puis ajuste seulement ce qui lui est utile. Le duo associe une police de
titraille à une police de texte ; les tailles, la hiérarchie et les adaptations
responsive restent sous le contrôle de l’application.

La sélection proposée comprend huit duos issus de la
[ressource Figma sur les associations de polices](https://www.figma.com/fr-fr/resource-library/associations-de-polices/) :
Inter/Krub, Montserrat/Karla, Nunito/PT Sans, Raleway/Merriweather, Crimson Serif/DM Sans,
Instrument Sans/Geist, Philosopher/Mulish et Bubblegum Sans/Open Sans.
Ce dernier est l’exception ludique demandée pour la titraille ; le texte courant
conserve Open Sans.
La première famille sert à la titraille, la seconde au texte courant.
Les références Google Fonts, les rôles de chaque duo et le nom exact à
confirmer pour la famille désignée « Crimson Serif » par Figma figurent dans le
[plan](../plan/2026-10-22-elce-style-tab-plan.md#sélection-initiale-des-duos-typographiques).
Cette sélection privilégie la lecture à l’écran et écarte les écritures
manuscrites et les frakturs. Elle offre des textes courants avec ou sans
empattements, sans ajouter de réglages typographiques fins au panneau.

Pour les couleurs, l’ambiance et les contraintes répondent à deux questions
différentes. L’ambiance donne une dominante ; clair ou sombre organise les
surfaces ; le contraste caractérise la lisibilité. Une palette doit donc
contenir des rôles utilisables ensemble, par exemple fond, surface, texte et
accent, plutôt qu’une simple rangée de couleurs décoratives. L’interface peut
filtrer les presets par ces critères sans multiplier les réglages initiaux.

Au niveau local, le même onglet conserve les mêmes groupes : preset,
typographies, fond, texte et espacement intérieur. Le titre du panneau indique
le périmètre concerné. Un aperçu montre au moins un titre et un paragraphe pour
éviter de choisir une police ou une couleur sans contexte.

| Commande commune | Projet | Page Flux ou Diapo | Section ou Carte |
| --- | --- | --- | --- |
| Preset d’apparence | Identité de départ | Variante de page | Variante de bloc |
| Duo typographique | Défaut du projet | Exception de page | Exception de bloc |
| Fond | Surface générale | Surface de page | Surface du bloc |
| Texte | Couleur ou contraste automatique | Même choix | Même choix |
| Padding | Densité générale proposée | Adaptation au cadre de page | Adaptation au cadre du bloc |
| Retour aux valeurs de référence | Défauts de l’app | Défauts du projet | Héritage du parent |

Cette cohérence n’exige pas de rendre éditables les polices d’une Carte Photo
sans texte visible. Le panneau peut indiquer que le réglage sera utilisé par
un layout textuel, sans supprimer sa valeur ni créer une autre interface.

## Un héritage par propriété

L’ordre de priorité est bloc → parent BDC éventuel → page → défauts du projet
→ défauts de l’app. Une Carte ancrée dépend de sa Section, une Carte de Carousel
de son Carousel. Les réglages généraux du projet définissent ses défauts ;
pour chaque propriété non définie à ce niveau, les défauts de l’app prennent
le relais. Un chapitre ne devient pas automatiquement un niveau de style.

Pour commencer, les défauts de l’app reprennent les couleurs des styles actuels
et le duo Crimson Serif/DM Sans pour la typographie. Ce sont des choix de
démarrage révisables, pas une identité visuelle définitive. Un projet sans
personnalisation bénéficie de cette base ; ses propres défauts peuvent ensuite
la surcharger sans modifier les exceptions locales des pages ou des blocs.

Résoudre chaque propriété séparément permet de changer le fond d’une Carte
sans figer sa typographie. La copie complète du style du parent empêcherait
les changements généraux de se propager ; elle rendrait aussi le retour à
l’héritage difficile à comprendre.

Exemple cible : le projet utilise une palette bleue et un duo A ; une page
choisit un fond sombre ; une Carte choisit seulement un duo B. La Carte garde
le fond applicable dans cette page et son texte automatique s’adapte à ce fond.
Un changement de duo général laisse B en place. « Reprendre du parent » sur la
typographie de cette Carte retire son exception et rétablit le duo du projet.

La provenance doit rester visible, par exemple « Projet », « Page » ou
« Section parente ». « Hériter », « transparent » et « aucun padding » sont
trois intentions différentes : la première suit une référence ; les deux
autres expriment des valeurs locales.

## Ce que CSS peut porter et ce que le produit doit décider

La police et la couleur du texte peuvent se transmettre naturellement dans
l’arbre DOM. Le fond et le padding demandent une politique de produit. Un fond
transparent laisse voir une surface sous-jacente ; il ne copie pas son fond.
Un padding placé sur chaque conteneur s’ajoute visuellement aux autres.

La densité héritée retenue, déclinée en espacements adaptés au rôle du projet,
de la page et du bloc, limite cet empilement. Les valeurs physiques restent réglées
par l’application. Cela conserve une commande simple tout en permettant une
page aérée et des cartes compactes.

L’ascendance métier reste la référence même lorsque les nœuds matérialisés ne
reproduisent pas cette hiérarchie, notamment pour les Cartes ancrées. La
projection doit traduire les valeurs vers les racines et zones existantes,
sans ajouter des conteneurs uniquement pour transmettre une couleur.

## Le thème et le contraste suivent une approche CSS first

Le thème utilise les propriétés personnalisées CSS, la cascade et l’héritage.
L’option Contraste concerne uniquement la couleur du texte par rapport à la
couleur CSS de son background. La fonction identifiée est
[`contrast-color()`](https://drafts.csswg.org/css-color-5/#contrast-color) :
elle reçoit une couleur et choisit noir ou blanc. La même variable CSS peut
alimenter `background-color` et l’argument de la fonction, comme dans
l’[exemple WebKit](https://webkit.org/blog/16929/contrast-color/).

La déclaration `color` doit réappliquer la fonction dans chaque périmètre
Style. Hériter d’une couleur déjà calculée sur l’ancêtre ne suffit pas lorsqu’un
bloc change de background. Un essai isolé dans Brave a confirmé ce point et
le maintien d’une couleur manuelle prioritaire. La proposition CSS, les
résultats et l’acceptation encore nécessaire dans Elcé figurent dans le
[plan](../plan/2026-10-22-elce-style-tab-plan.md#d8-exploration-du-contraste-css).

Ce réglage ne comporte ni analyse des pixels, des images ou des vidéos,
ni calcul ou mécanisme de remplacement JavaScript.

## Un picker guidé par les presets

Le choix d’une couleur utilise en priorité le picker natif du navigateur,
avec un champ `input` de type `color`. Les cinq presets de couleurs harmonisées
fournissent les teintes prédéfinies, présentées simplement à côté du champ si
nécessaire. Le catalogue sera enrichi plus tard.

La première version réutilise le contrôle natif et le circuit de commande
existant. Elle ne prévoit ni bibliothèque de picker, ni composant personnalisé,
ni gestion spécifique d’aperçu et d’annulation. Chaque champ possède un libellé.

## Export des styles et des fontes utilisés

L’export retient uniquement les valeurs et définitions réellement utilisées
par les scènes exportées : couleurs, typographies et références CSS nécessaires,
y compris les défauts hérités lorsqu’ils sont utilisés. Il n’embarque pas le
catalogue complet des palettes et des duos proposés à l’auteur.

Par défaut, les fichiers des fontes utilisées sont inclus comme ressources
dans le package. Leur chargement dans l’export utilise ces ressources locales.
Cette sélection s’appuie sur les contenus et états prévus par les scènes
exportées, et pas seulement sur ce qui est visible au démarrage.

## Périmètre du premier état

Le premier état porte sur les réglages Style, leur héritage, les cinq palettes,
les duos typographiques, le picker natif et le contraste CSS. L’extension
administrable et le panneau avancé sont laissés de côté jusqu’à la reprise du
sujet par l’utilisateur, après un premier état correct du reste.

La [note antérieure sur la personnalisation](./2026-10-07-personnalisation-rendus-document.md)
distinguait réglages, thème et invariants de layout. Cette séparation reste
utile. L’onglet Style précise maintenant les niveaux et les commandes ; les
transitions et les comportements de mise en page ne sont pas ajoutés à son
périmètre par simple association avec le mot « thème ».
