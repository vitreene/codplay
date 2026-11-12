# Widgets autonomes — présentation foreign et échanges Sighty

**Statut : A relire.** Plan distinct de conception et de réalisation.
L'orientation métier est retenue ; les signatures et le raccord public de
montage restent à valider avant les modifications qui en dépendent.
Aucune intégration nouvelle n'est présentée comme disponible.

## Objectif

Normaliser l'accueil de widgets JavaScript autonomes, dont le fonctionnement
interne n'appartient pas au récit CodPlay. Un même widget doit pouvoir être
présenté comme une illustration et, selon sa configuration, servir de menu
en émettant des événements vers Sighty. Le Sommaire global de l'aside et le
Calendrier sont les premiers consommateurs de ce raccord commun.

Le plan prolonge la [décision sur les composants standard](../notes/2026-10-07-composants-standard-scenario.md).
Les recherches propres au renderer Calendrier restent dans
l'[étude existante](../../elce/mods/notes/2026-10-20-sequence-scheduler-study.md#rendre-le-bdc-calendrier-dans-codplay--étude-du-composant).
Le calendrier métier et les programmes restent dans leur
[plan Sighty-TV](../../elce/mods/plan/2026-11-11-digital-signage-calendar-program-plan.md).

## Dépendances et place dans l'ordre commun

L'[ordre commun des cinq chantiers](../../elce/mods/plan/2026-11-11-digital-signage-calendar-program-plan.md#liens-entre-chantiers-et-ordre-de-réalisation)
coordonne ce plan avec le moteur, le BDC, le mod Sighty-TV et le sélecteur.

- Le raccord foreign et la migration du Sommaire global utilisent les
  données du parcours existant. Ils n'attendent ni le moteur calendaire,
  ni les programmes, ni l'ajout du mod Sighty-TV au sélecteur.
- Le Calendrier illustratif reçoit la projection du moteur commun et le
  raccord BDC. Son rendu complet attend donc ces données et le raccord
  widgets qualifié avec le Sommaire. Ses maquettes et tests de renderer
  peuvent être préparés plus tôt avec leurs propres fixtures.
- Le BDC est une ressource partagée ; Learning est son premier consommateur
  à intégrer. Sa livraison dans Learning n'attend pas le scheduler ou les
  programmes, qui restent propres à `digital-signage`.
- Le Calendrier-menu reprend le renderer illustratif qualifié et les
  échanges Sighty déjà exercés par le Sommaire. Il peut viser une scène
  existante ; aucun programme Sighty-TV factice n'est nécessaire.

Les lots ci-dessous s'insèrent dans cet ordre ; ils ne forment pas une
chaîne qui attendrait la fin de tout le projet digital-signage.

## Deux usages du même principe

| Usage | Présentation et comportement |
| --- | --- |
| Illustration | Le widget affiche ses données dans un hôte. Par exemple, un planning hebdomadaire dans une page. Il peut recevoir une mise à jour de données sans devenir un élément de la chronologie. Aucune navigation n'est attachée à ses items. |
| Menu | Le widget affiche ses données et émet une intention lorsqu'un item est activé. L'intégration transmet l'événement à Sighty ; les actions et guards du scénario choisissent la réponse, par exemple ouvrir une scène. |

Ces usages ne demandent pas deux implémentations du même renderer. Le
Sommaire représente l'organisation du parcours ; le Calendrier représente
des occurrences datées. Ils partagent le raccord, pas leur modèle métier.
Le widget peut aussi recevoir les données ou commandes de présentation
prévues par son profil : état actif/verrouillé du Sommaire, période et
occurrences du Calendrier, par exemple.

## Périmètre et décisions retenues

- Le widget possède son DOM interne, son rendu et ses ressources. Ses items
  ne sont ni des persos ni des parts CodPlay. Une boîte hôte peut participer
  à la présentation du récit sans y faire entrer les mécanismes du widget.
- Le mode illustratif fonctionne sans imposer Sighty. Le raccord Sighty
  fournit les échanges et la coordination lorsqu'ils sont nécessaires.
- Un clic produit une intention configurable. Le widget ne choisit pas une
  occurrence CodPlay, ne lance pas un player et ne contourne pas les guards.
  Le nom d'un item ou d'un événement ne porte aucune action implicite.
- La gestion auteur du calendrier reste séparée de sa diffusion. La vue
  illustrée et le menu ne proposent pas les gestes d'édition du scheduler.
- Le premier Sommaire concerné est celui de l'aside global, indépendant des
  pages. La page Sommaire et le BDC Sommaire ne sont pas inclus dans sa
  migration par simple assimilation de leur nom.
- L'accueil foreign, l'alimentation, les émissions et le nettoyage suivent
  une approche commune. Ne pas créer un montage distinct pour chaque widget,
  un second bus d'événements ou un registre générique de plugins.
- Les besoins futurs de `Perso.emit`, de parts dans les cellules ou de
  reconstruction temporelle fine restent une évolution de composant intégré,
  à décider à partir de l'usage. Ils ne conditionnent pas ce premier accueil.

## Contrats et circuits existants

Lire ces références avant toute réalisation :

- [Slot CodPlay](../../codplay/specs/slot-component-spec.md) : boîte hôte,
  contenu opaque, surface `foreignContent`, séparation entre détachement et
  destruction. La façade `instances.mount` vérifiée monte une instance
  CodPlay enfant ; elle ne certifie pas déjà un widget arbitraire.
- [Plan foreign propriétaire](../../codplay/plan/foreign-scene-component-plan.md) :
  représentation générique et disponibilité asynchrone encore à formaliser.
  Prolonger ce circuit, sans scène enfant factice ni montage manuel dans Sighty.
- [Intégration Sighty](../specs/authoring-library-spec.md#4-api-dintégration-publique) :
  `runtime.dispatch` admet les intentions extérieures et
  `runtime.events.onEvent` expose les événements publics. Un `dispatch`
  n'est pas automatiquement diffusé aux abonnés. Une action d'intégration
  peut porter une commande explicite vers le propriétaire du widget.
- [Sommaire Elcé](../../elce/specs/summary-profile-spec.md) : navigation,
  visibilité, états d'accès et présentation à conserver lors de la migration.
- [Export de scénario](../specs/authoring-library-spec.md#paquet-de-diffusion) :
  chargement et composition de diffusion à qualifier aussi avec les widgets.

Le Sommaire actuel fournit l'inventaire concret à préserver :

| Rôle | Fichiers actuels |
| --- | --- |
| Région aside et slot | `packages/elce/src/mods/learning/reading/learning-layout-scene-builder.ts` |
| Sélection persistante du menu | `packages/elce/src/mods/learning/reading/learning-scenario-builder.ts` |
| Rendu et émissions du Sommaire | `packages/elce/src/mods/learning/organization/reading/learning-summary-scene-builder.ts` |
| Projection des états du parcours | `packages/elce/src/mods/learning/reading/learning-scenario-actions.ts` et `learning-presentation-service.ts` |
| Tiroir mobile, focus et abonnements | `packages/elce/src/mods/learning/reading/learning-menu-drawer.ts` |

## Propriétaires à respecter

| Propriétaire | Responsabilité |
| --- | --- |
| Widget autonome | Présentation de données typées, mises à jour et intentions ; aucune dépendance nécessaire au runtime CodPlay ou au modèle d'un mod. |
| CodPlay | Boîte hôte, placement, présentation de cette boîte et attachement/détachement foreign. |
| Intégration Sighty | Composition et cycle des widgets retenus, traduction des intentions, commandes et abonnements au circuit existant. Aucun DOM de scène fabriqué ou déplacé par le routeur. |
| Sommaire/navigation standard | Présentation de l'organisation et des états du parcours. Emplacement de fourniture à arrêter selon la décision Sighty existante. |
| Ressource Calendrier Elcé | Moteur commun et BDC partagé, données et raccord du renderer ; Learning le compose en premier, sans dépendance au scheduler/programmes de `digital-signage`. |
| Composition d'un mod | Sélection/configuration des ressources et adaptation de son document au raccord commun. |

Le renderer Calendrier peut employer EventCalendar et sa bibliothèque tierce.
Cette dépendance ne devient pas celle du Sommaire ni du mécanisme de montage.
Le fournisseur possède le chargement de son code et de ses styles. Un simple
slot ne fait pas dériver automatiquement un requirement de bibliothèque.

## Décisions à arrêter avant le code concerné

| Sujet | Décision et dépendance |
| --- | --- |
| Montage public | Définir le raccord minimal du fournisseur extérieur à la surface foreign existante : adresse de l'hôte, propriété des racines, handle et retrait. Faire accepter toute modification core dans son plan propriétaire avant de la réaliser. |
| Cycle commun | Fixer création, alimentation, mises à jour, retrait, réutilisation éventuelle et destruction. Distinguer un hôte masqué d'un widget détruit. Nommer les opérations et leurs signatures après accord sur ces responsabilités. |
| Échanges | Définir l'identité de provenance du widget, le mapping des intentions et les commandes reçues. Conserver une `sourceSceneKey` réservée aux vraies scènes actives ; aucun DOM ou handle dans les payloads. |
| Données | Fournir un état de présentation suffisant au widget, avec identités stables, sans lui recopier un document métier mutable ni l'index du routeur. Arrêter séparément les projections Sommaire et Calendrier. |
| Mise à disposition | Choisir les exports et dossiers de l'intégration commune et des widgets standard ; composition TypeScript explicite, sans dépendance entre mods. |
| Transport et publication | Définir le comportement au reset/Seek du seul hôte, l'éventuel maintien de l'état externe, la livraison des styles et le chargement du fournisseur dans l'export. Le contenu opaque ne promet pas un rewind. |

La finalisation de ces décisions précède les lots dépendants. Ce plan n'est
pas une autorisation implicite de modifier `packages/codplay`.

## Ordre de réalisation proposé

1. **Fixer le raccord commun.** Qualifier les surfaces existantes avec un
   fournisseur minimal possédant ses fixtures de test ; arrêter les décisions
   ci-dessus et les changements nécessaires dans les plans propriétaires.
   Garder le besoin commun Sommaire/Calendrier comme critère de simplicité.
2. **Migrer le Sommaire de l'aside.** Remplacer sa scène et ses persos par le
   widget autonome. Conserver le slot du layout, la présence persistante,
   les intentions de navigation, les guards et les états projetés. Adapter
   le tiroir, le clavier et le focus au même cycle. Supprimer les chemins
   remplacés après vérification, sans maintenir deux Sommaires globaux.
3. **Raccorder le Calendrier illustratif.** Après qualification du raccord
   avec le Sommaire, employer le même accueil foreign avec la projection du
   moteur commun et le BDC partagé intégré à Learning. Conserver son édition
   séparée. Tester son rendu réel sans raccorder ses clics au journal ou aux
   actions de la scène CodPlay. Ce lot n'attend pas les programmes Sighty-TV.
4. **Qualifier le Calendrier-menu.** Sur le même renderer, configurer une
   activation d'item vers Sighty et une action de scénario ouvrant une scène.
   Vérifier aussi le refus par une garde et une commande de présentation
   reçue par le widget. Le comportement du scheduler n'est pas ce menu.

Les commandes de navigation autonomes prévues par la note Sighty rejoindront
le même raccord ; leur migration complète n'est pas un préalable artificiel
au premier calendrier. Aucun lot ne recrée un moteur calendaire ou un routeur.

## Acceptation

- Deux widgets indépendants utilisent le même mécanisme d'accueil ; retirer
  ou remplacer l'un conserve l'autre et ne laisse aucun abonnement actif.
- Le Sommaire global garde ses états, ses refus d'accès, son comportement
  desktop/mobile et son focus ; les pages et leurs Sommaires ne régressent pas.
- Le Calendrier illustratif affiche ses occurrences sans action d'item ; la
  même présentation en menu émet une seule intention par activation.
- Une action Sighty ouvre la scène attendue par le parcours normal, avec ses
  guards ; la réception d'un état met à jour le widget sans boucle d'écho.
- Le montage foreign réel, resize, masquage, retrait/remplacement, reset,
  Seek de l'hôte et destruction respectent le cycle décidé. Les références
  de contenu restent stables ; aucun état n'est reconstruit depuis le DOM.
- Preview et publication autonome livrent les styles et fournisseurs utiles.
  Les tests possèdent leurs fixtures, sans dépendre de démos.

Depuis chaque package modifié, lancer les tests ciblés du raccord, puis les
typechecks, tests et builds requis. Pour Elcé, ajouter `check:architecture`.
Les suites existantes à prolonger comprennent
`packages/codplay/tests/facade/foreign-mount.spec.ts`,
`packages/sighty/tests/runtime-features.spec.ts` et les tests Sommaire/scénario
Elcé. Aucun test ne s'exécute depuis la racine du dépôt.
Valider ensuite le vrai parcours dans le navigateur connecté en suivant les
règles MCP/focus d'AGENTS. Les tests isolés ne certifient pas le montage.

Après réalisation et vérification, consolider les spécifications propriétaires
CodPlay, Sighty et Sommaire Elcé. Les décisions ouvertes restent dans ce plan ;
la présente conception ne devient pas une spécification de comportement livré.
