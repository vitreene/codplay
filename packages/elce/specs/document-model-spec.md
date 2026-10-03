# Elcé — modèle de document et commandes

## Statut

**Fixe — modèle minimal et organisation de base implémentés et vérifiés dans
les tranches 1 et 4.**

Cette spécification couvre le document métier manipulé par l’application et
la voie de modification utilisée par l’interface. Elle ne certifie pas encore
la projection d’une page vers CodPlay ni la restauration navigateur complète ;
ces preuves restent dans le plan de construction.

## Modèle

Un `ElceDocument` version 1 contient des tableaux de chapitres, pages, bdc et
médias. Une page possède un type (`flux` ou `diapo`), un nom, une affectation
de chapitre éventuelle et un ordre de bdc. Les pages affectées à la racine du
scénario et les pages du catalogue sont indexées séparément. Un BDC est le
transport unique d’une insertion et a un seul emplacement : une page ou le
catalogue. Il référence éventuellement une ressource média, qui est indépendante
du BDC et peut être référencée par plusieurs BDC.

Les valeurs de placement et les constantes de configuration sont déclarées
dans [`document-config.ts`](../src/config/document-config.ts), leurs types
dans [`document-config-types.ts`](../src/config/document-config-types.ts),
les formes du document dans
[`document-types.ts`](../src/domain/document-types.ts), et les commandes dans
[`document-command-types.ts`](../src/app/commands/document-command-types.ts).
Les modules d’exécution ne redéclarent pas ces contrats et ne réintroduisent
donc pas de chaînes de placement dans les commandes.

Un nouveau document de POC contient un chapitre, une page Flux `Page A` et un
bdc Section vide associé au preset `section-basic`. Les presets sont déclarés
comme objets dans `src/config/presets.ts` ; ils ne sont pas éditables dans
cette tranche.

`ElceDocument.toJSON()` fournit la valeur structurée enregistrable et
`ElceDocument.fromJSON()` accepte uniquement la version courante. Les octets
des médias sont conservés à part par la frontière IndexedDB.

## Commandes

Les transformations sont pures : `applyDocumentCommand(document, command)`
retourne une nouvelle valeur après vérification de ses invariants. Elles couvrent
la création, le renommage et le déplacement de chapitres et de pages, le
déplacement et le retrait au catalogue des bdc, la suppression définitive
d’une page ou d’un bdc disponible, la mise à jour d’une Section, l’ajout de
métadonnées média et le renommage du document.
La suppression définitive d’une page supprime ses bdc, mais conserve les médias
du catalogue. `bdc.delete` ne peut supprimer qu’un BDC inutilisé et présent dans
`catalogBdcIds` ; son média reste dans le document.

`page.rename` et `chapter.rename` valident un nom non vide après suppression
des espaces de bord. Ces commandes ne changent ni l’affectation des pages, ni
leur ordre, ni les BDC.

`media.merge` rattache au média canonique tous les BDC qui référencent les
médias en doublon, puis retire leurs métadonnées du document. Les BDC, les
pages, leur ordre et le média canonique ne changent pas ; le nom et les autres
métadonnées du canonique sont conservés. La commande exige des identifiants
distincts déjà présents et des métadonnées compatibles (type, MIME et taille).
Pour la consolidation vidéo réalisée le 2026-10-03, les blobs ont aussi été
comparés par SHA-256 avant l’envoi de cette commande.

`assertDocumentInvariants()` vérifie les affectations uniques, les références
page/bdc et l’intégrité des ancres : une référence désigne un BDC image ou vidéo
de la même page, sans doublon dans une ou plusieurs Sections. Une mise à jour
de Section compare les références avant et après l’édition ; chaque BDC dont
l’ancre a disparu est supprimé dans cette même commande et son média reste
conservé. Pour le geste explicite de retour, `bdc.anchor.return` met à jour le
contenu de la Section et affecte simultanément ce même BDC au catalogue : son
identifiant et son média sont conservés. Cette commande retire l’ancre dans la
même opération. Le clavier Suppr et une édition ordinaire qui efface l’ancre
gardent leur autre résultat : le BDC est supprimé et n’est pas remis au
catalogue ; un nouveau BDC peut être créé pour le même média.
Les commandes peuvent créer et supprimer un chapitre
vide, déplacer une page entre chapitre, racine du scénario et catalogue,
retirer une page vers le catalogue ou la supprimer définitivement avec ses bdc. Le
contrôleur XState possède le document et n’accepte les changements que par
un événement de commande (`document.apply` ou `page.create`). Il possède aussi
l’onglet courant du catalogue (`catalogTab`), initialisé sur les BDC disponibles
et modifié par `catalog.tab.select`.
`CATALOG_TAB` et `CatalogTabType` sont déclarés dans les fichiers de
configuration ; l’interface affiche séparément les BDC disponibles et les
médias réutilisables. React ne conserve pas de copie métier ni d’état d’onglet.

Pour un média affecté directement à la page, le panneau Propriétés propose
« Renvoyer au catalogue ». `ElcePageMediaService` distingue ces médias des
bdc image ou vidéo référencés par une ancre dans le document riche ; l’action
envoie la commande `bdc.remove` par `document.apply`. Le bdc quitte la page et
entre dans `catalogBdcIds`, tandis que la ressource média reste dans le
document et dans IndexedDB. Le retrait d’un bdc ancré continue d’utiliser sa
commande d’ancre afin de retirer aussi la référence du texte.

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
  avec conservation du média,
  suppression conditionnelle d’un chapitre, retrait au catalogue d’un BDC
  placé directement dans une page, suppression d’un BDC ancré sans retour au
  catalogue, conservation et réemploi de son média, exclusivité et aller-retour
  JSON, fusion de médias, conservation des BDC et placements, rejet de
  métadonnées incompatibles.
- [`AppLayout.test.tsx`](../src/app/layout/AppLayout.test.tsx) vérifie les
  actions icônes accessibles de création ainsi que l’édition centrale des noms
  de page et de chapitre via le contrôleur XState.
- [`document-persistence.test.ts`](../src/app/controller/document-persistence.test.ts)
  vérifie que le remplacement d’un média utilisé et la suppression de son blob
  passent par une seule opération de persistance.
- [`controller-machine.test.ts`](../src/app/controller/controller-machine.test.ts)
  vérifie la possession du document par XState, une modification visible par
  commande, la sélection d’onglet du catalogue et `bdc.delete`, ainsi que la
  pose d’ancre d’un BDC inutilisé par `bdc.anchor.attach`, et la
  suppression du BDC ancré (avec conservation du média) lors d’une édition
  ordinaire qui supprime son ancre. Il vérifie aussi le retour dédié par
  `bdc.anchor.return`, qui conserve l’identifiant du BDC et sa ressource média.
- Dans un parcours Safari antérieur au nettoyage du catalogue, la page A
  contenait deux ancres vidéo et un bdc vidéo direct. L’action « Renvoyer au
  catalogue » a fait passer l’aperçu réel à deux vidéos et deux slots. Le BDC
  direct a ensuite été supprimé du catalogue avec les deux autres anciennes
  entrées de test ; les ressources média ont été conservées.
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
