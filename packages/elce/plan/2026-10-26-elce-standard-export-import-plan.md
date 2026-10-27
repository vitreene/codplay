# Elcé — export standard et import de projet coordonnés

**Statut : A relire — plan préparé le 26 octobre 2026 ; aucune réalisation autorisée par ce document avant validation.**

## Résultat attendu et décisions

Définir ensemble le prochain export standard Sighty et son import vers un
nouveau projet Elcé. Le paquet reste autonome à la lecture ; il conserve aussi
les données nécessaires à la reprise de l’édition. La présente tâche prépare
uniquement le plan, sans changer le code ni les données des projets.

| Décision | État | Application proposée |
| --- | --- | --- |
| Export et import définis ensemble sur la base de l’existant ; format standard, hors SCORM | Accepté par l’utilisateur | Étendre l’adaptateur Elcé existant ; conserver le circuit Sighty/CodPlay de lecture. |
| Données complémentaires facultatives avec défauts de l’application en cas d’absence | Principe accepté ; distinction à relire | Les réglages sont facultatifs ; les contenus et relations nécessaires à l’édition restent requis. Détail dans la note liée ci-dessous. |
| Socle fonctionnel actuel, proche d’une v1 ; compatibilité des évolutions futures des BDC | Accepté par l’utilisateur | Prendre le document v7 actuel comme référence ; figer une fixture de paquet initiale. Pas de moteur général de migration maintenant. |
| Document auteur complet et tous ses médias, y compris le catalogue | Proposition à valider | Ajouter `authoring/project.json` et les originaux dans `authoring/media/`, hors modules runtime. Aucun format différentiel à reconstruire depuis les scènes. |
| Absence complète du document auteur | Proposition à valider | Paquet lisible ; import éditable refusé explicitement. Pas de reconstruction d’anciens paquets compilés dans cette tranche. |
| Identité et publication du projet importé | Proposition à valider | Créer une copie indépendante ; renouveler les IDs projet et média ; conserver les IDs internes des autres entités et leurs relations. Réutiliser cache, session, droit et synchronisation actuels. |
| Entrée utilisateur | Proposition à valider | Dans le menu projets : importer le ZIP standard ou son dossier extrait ; ouvrir la copie et annoncer séparément la préparation locale et la confirmation en base. |

La [note de conception](../notes/2026-10-26-elce-standard-export-import-design.md)
précise la forme proposée, les défauts, les frontières et les échecs. Ses choix
sont des propositions rattachées à ce plan, pas des contrats vérifiés.

## Propriétaires et invariants à préserver

- Lire les contrats [export](../specs/sighty-export-spec.md),
  [document](../specs/document-model-spec.md),
  [API et stockage](../specs/project-api-spec.md),
  [session projet](../specs/project-session-spec.md) et
  [accès d’édition](../specs/editor-window-access-spec.md) avant réalisation.
  Pour les contenus : [Sections](../specs/section-editor-spec.md),
  [ancres](../specs/anchor-spec.md),
  [Sommaire/profil](../specs/summary-profile-spec.md),
  [apparence](../specs/appearance-spec.md) et
  [défauts de lecture](../specs/editor-settings-spec.md).
- `EditorActionsFacade` → `project.operation` → `ProjectSessionCoordinator`
  reste le circuit de gestion ; XState reste seul propriétaire du document.
  `ProjectSyncCoordinator`, l’API projets et FileStorage publient les données.
  Aucun import par SQL direct, second catalogue, second acteur ou nouvel upload.
- Exporter l’instantané pris au clic sans suspendre les commandes auteur ou
  leur synchronisation. Document auteur, médias et scènes appartiennent à ce
  même instantané. L’export ne persiste rien et n’initialise pas le player.
- L’import ne remplace aucun projet. Une erreur de préparation conserve le
  document, le verrou et le cache du projet courant. Une publication incomplète
  conserve la copie locale en attente ; elle ne vaut pas un succès en base.
- Aucun changement de `packages/codplay`, de `packages/sighty` ou du contrat
  SCORM n’est prévu. Un besoin de les modifier impose de revenir au plan ;
  le cœur CodPlay requiert en plus une autorisation explicite.

## Ordre d’application après validation

Toutes les actions sont **À faire**. Ne commencer aucune modification de code
tant que ce plan est `A relire` ou qu’une décision dont elle dépend reste ouverte.

| Ordre | Fichiers / propriétaires à modifier | Action et résultat vérifiable |
| --- | --- | --- |
| 0 | Ce plan et sa note | Faire valider les propositions du tableau ; inscrire les arbitrages ici. Vérifier le document v7 et les propriétaires à la reprise ; les autres travaux Style, Mods et Rise ne sont pas implicitement acceptés par ce plan. |
| 1 | Nouveau dossier `src/project-package/` : `project-package-types.ts`, `project-package-codec.ts`, `project-package-media.ts` et tests | Définir l’enveloppe v1, normaliser les seuls réglages facultatifs, valider les entrées inconnues puis les invariants métier. Préparer la copie et la table des nouveaux IDs média. Figer la fixture initiale et couvrir les six types de BDC. |
| 2 | `src/export/elce-sighty-export-client.ts`, `elce-scenario-exporter.ts`, `src/server/export/sighty-export-api-controller.ts`, leurs tests | Ajouter l’option multipart `includeAuthoring`, absente = `false`. À `true`, joindre tous les médias du document, puis ajouter le complément auteur au dossier produit avant ZIP. À `false`, conserver l’export actuel. `scenarioExportMediaIds` continue de décider des seuls médias des scènes runtime. |
| 3 | Nouveau `src/project-package/project-package-reader.ts`, tests ZIP/dossier | Ramener ZIP et liste de fichiers du dossier à la même lecture typée. Lire JSON et octets sans exécuter les modules exportés. Refuser les versions, références ou fichiers invalides avant toute écriture ; même résultat pour ZIP et dossier. Charger `fflate` dynamiquement sur le seul chemin ZIP. |
| 4 | `src/infrastructure/indexed-db/document-store-types.ts`, `document-store.ts`, tests ; `src/app/projects/project-session-types.ts`, `project-session-coordinator.ts`, tests | Ajouter l’enregistrement transactionnel du projet importé et de ses blobs au store existant. Étendre le circuit de copie indépendante pour les imports sans projet source ; réutiliser publication, verrou et reprise. Voir séquence exacte et marqueur local proposés dans la note. |
| 5 | `src/app/facades/editor-actions-facade.ts`, `src/app/controller/controller-machine.ts` et types si nécessaires ; `src/app/remix/project-application.tsx`, `project-application-types.ts`, tests ; CSS de layout au besoin | Ajouter l’intention d’import au même événement `project.operation`, puis les deux sélecteurs ZIP/dossier au menu projets. L’export standard demande explicitement `includeAuthoring=true` ; son appel SCORM garde `false`. Annulation du sélecteur = aucune opération ; états attente/erreur/synchronisation accessibles, IDs explicites des éléments parents. |
| 6 | Tests dédiés et existants listés ci-dessous | Prouver l’aller-retour complet dans SQLite/FileStorage, puis l’édition et la lecture réelles. Garder le plan `En cours` si l’acceptation navigateur ou une reprise après échec manque. |
| 7 | Spécifications propriétaires, ce plan et la note | Reporter seulement le comportement implémenté et ses preuves dans les specs export, document, API, session et une nouvelle spec ciblée du paquet auteur. Garder les décisions non appliquées dans le plan. Retirer note et plan après acceptation complète et correction des liens entrants. |

## Acceptation obligatoire

| Frontière | Preuve attendue |
| --- | --- |
| Socle et défauts | Fixture figée v1/v7 : Section, Carte, Carousel, Question, Résultat et Graphe ; variantes de layout ; JSON Tiptap et HTML conservés ensemble ; paramètres explicites conservés ; absences permises normalisées depuis leurs propriétaires ; valeur invalide refusée. |
| Export | Tests client/contrôleur/exporteur : snapshot concurrent inchangé ; catalogue et médias non lus présents dans le complément ; seuls médias nécessaires dans les scènes ; pas d’écriture serveur ; pas de source auteur dans `scenario.mjs` ; `includeAuthoring=false` conserve le résultat précédent. |
| Lecture autonome | Charger le paquet enrichi avec le loader réel après déplacement hors des sources ; le charger aussi après retrait du seul dossier `authoring/`. Préparation, initialisation, navigation, média et quiz fonctionnent dans les deux cas. |
| Base et fichiers | Nouveau test intégré `src/project-package/project-package-round-trip.test.ts` : exporter réellement → lire ZIP puis dossier → intention XState/session → vrai serveur HTTP isolé → SQLite/FileStorage → relire après réouverture. Comparer tout le document modulo les IDs renouvelés et les octets MIME/taille/SHA-256 de chaque média. Aucun projet utilisateur comme fixture. |
| Indépendance et relations | Importer deux fois, avec la source déjà ouverte/cache existant ; aucun écrasement de blob. Préserver racine mixte, pages de chapitre/catalogue, BDC disponibles, ancres, enfants Carousel, fond Sommaire, profils et contraintes. Éditer/reparenter/supprimer dans une copie puis vérifier l’autre et la source. |
| Échecs et reprise | JSON ou fichier manquant, document/version/type BDC inconnu, quota local, conflit du projet courant : aucune création importée avant préparation valide. Perte réseau pendant publication : copie locale et checkpoint repris au rechargement ; pas de faux succès, pas de droit source réutilisé. Rejouer les tests des copies « Enregistrer sous… ». |
| Player et lifecycle | Dans l’application réelle : importer ZIP et dossier, éditer une Section, rouvrir le projet, naviguer Flux/Diapo, tester ancres et Carousel, Question et Résultat, resize, fermeture/réouverture et reset de la progression neuve. Play/Seek/replay passent par les contrôles existants lorsqu’ils sont exposés ; consigner le parcours réellement disponible. Aucun contournement de montage ou démo locale corrective. |
| Régression du consommateur SCORM | Vérifier que son appel produit toujours le Sighty sans complément auteur et que ses tests d’export restent verts. Aucun import SCORM ni nouveau parcours LMS demandé. |

Depuis **`packages/elce`**, exécuter les tests ciblés des fichiers modifiés,
puis `npm test`, `npm run typecheck` et `npm run build`. Les tests ne se lancent
pas depuis la racine. Aucun changement runtime Sighty/CodPlay n’étant prévu,
leurs suites complètes ne sont pas requises ; leurs chemins réels restent
exercés par l’export et la lecture intégrés. Toute divergence découverte impose
un arrêt et un arbitrage dans le plan propriétaire, sans fallback ajouté.

Pour le navigateur : avant tout appel MCP, inspecter la configuration locale
et l’inventaire complet des outils réellement exposés ; comparer les serveurs
configurés et appelables. Si la frontière nécessaire reste inaccessible,
noter l’acceptation en attente ; ne pas substituer une autre application.

## État de la préparation

- Contrats et raccords relus ; aucun code, test comportemental ou projet modifié
  par cette préparation. La base `.elce-data/elce.sqlite` était déjà modifiée
  au début de la tâche ; elle ne constitue pas une fixture ni une preuve ici.
- Deux écarts documentaires de contexte sont à respecter : le plan général
  garde des descriptions historiques React/monodocument ; la spec Sommaire
  mentionne son introduction en v5. Les specs document/session actuelles
  décrivent v7 et les caches multiprojets. Cette tâche ne réécrit pas ces travaux.
- La validation de ce plan et de ses propositions reste la prochaine étape.
