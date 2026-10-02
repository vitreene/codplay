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
scénario et les pages du catalogue sont indexées séparément. Un bdc a un emplacement unique :
une page ou le catalogue. Une ressource média est indépendante du bdc qui la
référence et peut donc être référencée par plusieurs bdc.

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
retourne une nouvelle valeur. Elles couvrent la création et le déplacement de
chapitres, pages et bdc, le retrait vers le catalogue, la suppression
définitive d’une page, la mise à jour d’une Section, l’ajout de métadonnées
média et le renommage du document. La suppression définitive d’une page
supprime ses bdc, mais conserve les médias du catalogue.

`assertDocumentInvariants()` vérifie les affectations uniques et les
références page/bdc. Les commandes peuvent créer et supprimer un chapitre
vide, déplacer une page entre chapitre, racine du scénario et catalogue,
retirer une page vers le catalogue ou la supprimer définitivement avec ses bdc. Le
contrôleur XState possède le document et n’accepte les changements que par
un événement de commande (`document.apply` ou `page.create`).
React ne conserve pas de copie métier.

## Preuves

- [`document-commands.test.ts`](../src/app/commands/document-commands.test.ts)
  vérifie création, déplacement, retrait, suppression, réemploi d’un média,
  suppression conditionnelle d’un chapitre, exclusivité et aller-retour JSON.
- [`controller-machine.test.ts`](../src/app/controller/controller-machine.test.ts)
  vérifie la possession du document par XState et une modification visible
  par commande.
