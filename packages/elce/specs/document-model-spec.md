# Elcé — modèle de document et commandes

## Statut

**Fixe — modèle documentaire v4 ; les médias sont portés par les détails Carte
ou Question, les placements sont page/catalogue/parent ; modèle, commandes et
invariants vérifiés le 7 octobre 2026.**

Cette spécification couvre le document métier manipulé par l’application et
la voie de modification utilisée par l’interface. La projection des cartes
dans le player est décrite dans la spécification du Carousel et du builder
Flux.

## Modèle

Un `ElceDocument` version 4 contient des tableaux de chapitres, pages, BDC et
médias, ainsi que `scenarioEntries`, une séquence ordonnée de références de
type `page` ou `chapter`. Une page autonome est une entrée racine sœur d’une
entrée de chapitre ; ces deux formes peuvent alterner dans la même séquence.
Chaque chapitre conserve son propre ordre de pages. La séquence racine et les
ordres internes des chapitres déterminent ensemble l’ordre de lecture. Les
pages du catalogue restent hors scénario. Une page possède un type (`flux` ou
`diapo`), un nom, une affectation de chapitre éventuelle et un ordre de BDC.

Chaque BDC a un emplacement unique : dans une page, dans le catalogue, ou
comme enfant d’un BDC conteneur. Une page Flux peut contenir plusieurs BDC ; une
page Diapo en contient au plus un, parmi les types proposés par sa whitelist.
La whitelist règle les contextes d’ajout sans créer des types BDC distincts
selon l’emplacement. Le BDC Carousel reste affecté à une page et porte ses
réglages ainsi qu’une séquence ordonnée d’entrées `{ bdcId, durationMs }`.
Chaque identifiant désigne un BDC Carte distinct dont `parentBdcId` désigne le
Carousel. Une Carte peut aussi occuper directement une page ou être enfant
inline d’une Section ; le JSON Tiptap porte alors sa position exacte. Une Carte
porte son layout dans `presetId`, ses valeurs et sa référence média facultative
dans `card.mediaId`. Une Question porte son illustration facultative dans
`question.mediaId`. Les ressources média sont indépendantes et peuvent être
partagées par plusieurs BDC. `MediaMetadata` conserve le MIME, pas une
catégorie image/vidéo : l’application déduit celle-ci du MIME. Changer de layout
masque éventuellement des valeurs, mais ne les retire pas du BDC. La création
propose un Carousel avec sa première Carte enfant.

`ElceDocument.fromJSON()` accepte uniquement la version 4 et rejette les
versions 1, 2 et 3 sans conversion. Le POC ne conserve pas de migration depuis
le format précédent.

Les valeurs de placement et les constantes de configuration sont déclarées
dans [`document-config.ts`](../src/config/document-config.ts), leurs types
dans [`document-config-types.ts`](../src/config/document-config-types.ts),
les formes du document dans
[`document-types.ts`](../src/domain/document/document-types.ts), et les commandes dans
[`document-command-types.ts`](../src/app/commands/document-command-types.ts).
Les modules d’exécution ne redéclarent pas ces contrats et ne réintroduisent
donc pas de chaînes de placement dans les commandes.

Un nouveau document de POC contient un chapitre, une page Flux `Page A` et un
BDC Section vide associé au preset `section-basic`. Les presets sont déclarés
comme objets dans `src/config/presets.ts`. Chaque objet fixe le markup
HTML, ses zones, leur catégorie de contenu et leur caractère requis.
`ElceCardPresetBuilder` instancie ce markup avec un identifiant racine et des
parts CodPlay propres à l’instance ; il ne crée ni BDC ni composant CodPlay.
Le BDC Résultat utilise le preset `evaluation-result-basic` et porte deux
branches, `success` et `failure`. Le BDC Carousel utilise `carousel-basic` ;
il est créé atomiquement avec un BDC Carte enfant au layout initial
`text-short-basic`. Les quatre layouts Carte partagent le même jeu de champs
métier.

`ElceDocument.toJSON()` fournit la valeur structurée enregistrable en version
4. Les octets des médias sont conservés à part par la frontière IndexedDB.

## Commandes

Les transformations sont pures : `applyDocumentCommand(document, command)`
retourne une nouvelle valeur après vérification de ses invariants. Elles couvrent
la création, le renommage et le déplacement de chapitres et de pages, le
déplacement et le retrait au catalogue des bdc, la suppression définitive
d’une page ou d’un bdc disponible, la mise à jour d’une Section, d’une Question,
d’un Résultat ou d’un Carousel, l’ajout de métadonnées média et le renommage du
document.
La suppression définitive d’une page supprime ses bdc, mais conserve les médias
du catalogue. `bdc.delete` ne peut supprimer qu’un BDC inutilisé et présent dans
`catalogBdcIds` ; son média reste dans le document.
`bdc.section.delete` supprime un BDC Section affecté à une page et ses BDC
Carte enfants référencés par des ancres ; les ressources média restent dans le
catalogue. `bdc.question.delete` supprime le BDC Question de sa page et
conserve son illustration média. `bdc.evaluation-result.delete` retire de la
page le BDC Résultat affecté ; il ne le remet pas au catalogue. La commande
`bdc.evaluation-result.update` édite ensemble ses branches Réussite et Échec ;
le service métier vérifie qu’une action choisie est permise pour sa branche.
`bdc.carousel.update` remplace les réglages et l’ordre des entrées, sans
modifier l’ensemble des BDC Carte enfants. `bdc.card.update`,
`bdc.card.layout.set`, `bdc.card.media.set` et `bdc.card.media.attach` modifient
une carte identifiée sans dupliquer une ressource existante.
`bdc.carousel.card.delete` retire un BDC Carte enfant, mais refuse de vider le
Carousel. `bdc.carousel.delete` retire le parent et ses BDC Carte enfants en
conservant les médias référencés. `bdc.move` peut déplacer une carte vers un
autre Carousel ; l’opération enlève son ancienne relation parent/enfant et en
crée une nouvelle tout en gardant le BDC Carte lui-même.

`page.rename` et `chapter.rename` valident un nom non vide après suppression
des espaces de bord. Ces commandes ne changent ni l’affectation des pages, ni
leur ordre, ni les BDC.

`page.create` conserve le `PagePlacement` explicite et crée une page Flux
avec un BDC initial choisi par la configuration du chapitre visé : un BDC
Section pour un chapitre standard ou une page racine, un BDC Question pour un
chapitre Évaluation. Les deux restent des BDC d’une page Flux ; aucun nouveau
format de page n’est créé pour le Quiz. Le preset et le contenu initial
viennent des constantes et services métier existants.

Une création explicitement demandée en Diapo crée un BDC Carousel direct et
sa première Carte enfant. Une Carte peut aussi être le contenu direct d’une
page ; la whitelist de l’éditeur propose ce placement selon le type de page.
Les commandes et invariants refusent plusieurs BDC directs sur une Diapo et
les types qui ne sont pas pris en charge par ce format.

`media.merge` rattache au média canonique les détails Carte et Question qui
référencent les médias en doublon, puis retire leurs métadonnées du document.
Les BDC, les pages, leur ordre et le média canonique ne changent pas ; le nom et les autres
métadonnées du canonique sont conservés. La commande exige des identifiants
distincts déjà présents et des métadonnées compatibles (MIME et taille).
Pour la consolidation vidéo réalisée le 2026-10-03, les blobs ont aussi été
comparés par SHA-256 avant l’envoi de cette commande.

Tout import depuis fichier passe par `ElceMediaResourceService` dans le worker
asynchrone de la file XState. Avant de sauvegarder le blob, il compare sa taille
et son SHA-256 aux ressources documentées et aux blobs correspondants. Une
correspondance réutilise les métadonnées et le blob existants, même si le nom de
fichier diffère. Des octets différents restent deux ressources, même avec le
même nom et la même taille. Le dépôt d’image ou de vidéo crée une Carte distincte
et lui rattache la ressource réutilisable ; il ne crée pas un BDC média. L’import d’une
illustration de Question rattache la ressource dans `question.mediaId`. Le
retrait d’un BDC ne crée pas de copie de la ressource au catalogue.
`media.merge` reste disponible pour consolider explicitement d’anciennes ressources déjà
dupliquées.

`assertDocumentInvariants()` vérifie les affectations uniques, les références
page/BDC et parent/enfant, les données propres au type de BDC, et l’intégrité
des ancres : une référence désigne une Carte enfant de la même page, sans
doublon dans une ou plusieurs Sections. Une Carte a exactement un emplacement :
une page, le catalogue, un parent Carousel ou une Section. Elle porte son
layout, ses champs et, si nécessaire, `card.mediaId`. Une Question porte son
illustration dans `question.mediaId`. Une Diapo contient au plus un BDC direct
parmi les types autorisés par sa whitelist. Les Carousels ne peuvent pas être
vides. Une mise à jour
de Section compare les références avant et après l’édition ; chaque BDC dont
l’ancre a disparu est supprimé dans cette même commande et son média reste
conservé. Pour le geste explicite de retour, `bdc.anchor.return` met à jour le
contenu de la Section et affecte simultanément ce même BDC au catalogue : son
identifiant et son média sont conservés. Cette commande retire l’ancre dans la
même geste. Le clavier Suppr et une édition ordinaire qui efface l’ancre gardent
leur autre résultat : le BDC est supprimé et n’est pas remis au
catalogue ; un nouveau BDC peut être créé pour le même média.
Les commandes peuvent créer et supprimer un chapitre
vide, déplacer une page entre chapitre, racine du scénario et catalogue,
retirer une page vers le catalogue ou la supprimer définitivement avec ses bdc.
`chapter.move` réordonne une entrée de chapitre dans `scenarioEntries` sans
modifier les pages qu’elle contient. `page.move` insère une page racine à un
index de cette même séquence ; déplacer une page de chapitre vers la racine
crée une entrée racine distincte.
Le contrôleur XState possède le document et n’accepte les changements que par
un événement de commande (`document.apply` ou `page.create`). L’événement
`page.create` exige un `PagePlacement` explicite ; les actions d’interface
choisissent entre la racine du scénario et un chapitre précis. La création ne
déduit jamais un chapitre à partir de l’ordre des chapitres. Le contrôleur
possède aussi l’onglet courant du catalogue (`catalogTab`), initialisé sur les
BDC disponibles et modifié par `catalog.tab.select`.
`CATALOG_TAB` et `CatalogTabType` sont déclarés dans les fichiers de
configuration ; l’interface affiche séparément les BDC disponibles et les
médias réutilisables. React ne conserve pas de copie métier ni d’état d’onglet.

Pour une Carte affectée directement à la page, le panneau Propriétés propose
« Renvoyer au catalogue ». `ElcePageMediaService` distingue ces Cartes des
Cartes référencées par une ancre dans le document riche ; l’action envoie la
commande `bdc.remove` par `document.apply`. La Carte quitte la page et entre
dans `catalogBdcIds`, tandis que sa ressource média reste dans le document et
dans IndexedDB. Le retrait d’une Carte ancrée continue d’utiliser sa commande
d’ancre afin de retirer aussi la référence du texte.

Quand une référence de BDC inutilisé est déposée depuis le catalogue, la
commande `bdc.anchor.attach` affecte à la page le même BDC : son identifiant et
sa ressource média ne sont pas recréés, et son identifiant quitte
`catalogBdcIds`. Après cette affectation, le service ne propose plus la
référence comme BDC disponible.

## Persistance média

`attachDocumentPersistence` sérialise les écritures du document. Lorsqu’une
commande retire des métadonnées média, le raccord de persistance appelle
`ElceDocumentStore.saveDocumentAndDeleteMedia`. `IndexedDbDocumentStore`
enregistre le document et supprime les blobs correspondants dans une seule
transaction `readwrite` couvrant les deux magasins IndexedDB. L’opération de
fusion reste déclenchée par `document.apply` dans la machine XState ; le
raccord ne choisit pas quels médias fusionner.

## Preuves

- [`document-commands.test.ts`](../src/app/commands/document-commands.test.ts)
  vérifie création, renommage, déplacement, retrait, suppression, réemploi
  d’un média, la suppression catalogue d’un BDC et le refus d’effacer un BDC de page,
  avec conservation du média, la suppression conditionnelle d’un chapitre,
  le retrait au catalogue d’un BDC
  placé directement dans une page, suppression d’un BDC ancré sans retour au
  catalogue, conservation et réemploi de son média, exclusivité et aller-retour
  JSON, fusion de médias, conservation des BDC et placements, rejet de
  métadonnées incompatibles.
- Le même fichier vérifie la création, la mise à jour des deux branches et le
  retrait par commande du BDC Résultat.
- Le même fichier vérifie que les versions 1, 2 et 3 sont rejetées, le mélange et
  le déplacement d’entrées page/chapitre à la racine, le déplacement d’une
  page de chapitre vers la racine et les invariants de placement correspondants.
- Le même fichier vérifie les champs et médias d’un BDC Carte à travers les
  layouts, le déplacement vers un autre Carousel, la suppression enfant/parent,
  la Carte autonome comme unique BDC direct d’une Diapo, le rejet d’une seconde
  entrée directe et l’exclusivité des données de type.
- [`diapo-scene-builder.test.ts`](../src/builders/diapo/diapo-scene-builder.test.ts)
  vérifie la projection des variantes Carousel, Carte et Question dans une
  scène Diapo réelle.
- [`app-layout.test.tsx`](../src/app/layout/app-layout.test.tsx) vérifie les
  actions icônes accessibles de création à la racine et dans un chapitre,
  l’emplacement produit, ainsi que l’édition centrale des noms de page et de
  chapitre via le contrôleur XState.
- [`document-persistence.test.ts`](../src/app/controller/document-persistence.test.ts)
  vérifie que le remplacement d’un média utilisé et la suppression de son blob
  passent par une seule opération de persistance.
- [`controller-machine.test.ts`](../src/app/controller/controller-machine.test.ts)
  vérifie la possession du document par XState, une modification visible par
  commande, la sélection d’onglet du catalogue et `bdc.delete`, ainsi que la
  création de pages à la racine ou dans le chapitre explicitement indiqué, et
  la sélection de la page créée. Il vérifie aussi la pose d’ancre d’un BDC
  inutilisé par `bdc.anchor.attach` et la
  suppression du BDC ancré (avec conservation du média) lors d’une édition
  ordinaire qui supprime son ancre. Il vérifie aussi le retour dédié par
  `bdc.anchor.return`, qui conserve l’identifiant du BDC et sa ressource média.
- Le même fichier vérifie les imports identiques via les commandes XState :
  le second fichier réutilise le média et le blob déjà conservés tout en
  créant un nouveau BDC ancré ; une illustration réimportée dans une autre
  Question partage également la ressource existante.
- [`media-resource-service.test.ts`](../src/domain/media/media-resource-service.test.ts)
  vérifie que SHA-256 reconnaît les mêmes octets sous un nom différent ou un
  MIME différent, et garde séparés des octets différents de même taille. Le
  MIME stocké sur la ressource est la source de la catégorie de rendu.
- [`card-preset-builder.test.ts`](../src/builders/card/card-preset-builder.test.ts)
  vérifie tous les objets de preset, les catégories et zones requises du preset
  Question, les `id` des éléments produits, la distinction entre deux
  instances du même preset et l’insertion du texte Section dans sa zone.
- Dans Safari, supprimer l’ancre de test sur Page E a supprimé son BDC sans
  augmenter le catalogue des BDC disponibles. Le média est resté disponible ;
  un nouveau dépôt a créé un BDC à identifiant distinct qui référence ce même
  média.
- Dans Safari, les onglets « Blocs disponibles » et « Médias » affichent chacun
  leur collection, et les boutons de sélection changent l’onglet via XState.
  La suppression d’un BDC au catalogue conserve les ressources média ; après
  rechargement, les trois anciens BDC de test restent supprimés, les trois
  médias demeurent au catalogue et Page A conserve ses deux ancres.
- Dans Safari MCP, déposer un BDC ancré directement sur le bouton « Blocs
  disponibles » depuis l’onglet « Médias » active l’onglet et remet le même BDC
  au catalogue après retrait de son ancre. Le geste passe par le `dragend`
  Tiptap, `SectionEditor`, la façade, XState et `bdc.anchor.return` ; aucune
  copie du BDC n’est créée.
