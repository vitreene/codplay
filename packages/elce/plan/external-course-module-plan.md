# Plan — Lecture de modules source dans Elcé

**À relire.** Prouver la lecture d’un chapitre dans Elcé avant la mise en
production du [convertisseur](../../authoring/course-import/plan/course-import-plan.md).
Ce pilote importe l’organisation du chapitre et fait exécuter ses pages par
leur lecteur d’origine. Le chapitre de référence proposé est
`RISQUE_CHIMIQUE_2024/01_introduction`, avec `page111` pour la vidéo et
`page112` pour l’enchaînement narré et la persistance entre séquences.

## Périmètre retenu

- Le XML de chapitre donne les pages disponibles. Le sommaire choisi peut
  déclarer une sélection, un ordre et des métadonnées de parcours. Elcé
  importe le chapitre et conserve la référence au module, au chapitre et à
  la page d’origine. Deux chapitres peuvent porter le même ID de page dans
  le XML. Les identités Elcé restent distinctes.
- Le format de page est dérivé de Diapo. Il réutilise son cadre et ses
  parcours de lecture. Son contenu externe se lit en lecture seule.
- L’auteur du scénario peut déplacer et masquer une page importée. Le
  presse-papiers Pages refuse son dépôt et les commandes qui y déplacent
  une page. Le chapitre accepte des pages Flux et des Diapos Elcé dans le
  même ordre, entre les pages importées.
- L’édition du contenu source, le catalogue de modules et les droits
  auteur/client restent des évolutions distinctes.

## Intégration proposée

| Frontière | Raccord |
| --- | --- |
| **Composition Elcé** | Réutiliser le [document Learning](../specs/document-model-spec.md), ses commandes de scénario et le [cadre Diapo](../specs/diapo-scene-builder-spec.md). La page dérivée contient la référence au module et une scène hôte qui présente le lecteur. Elcé/Sighty décide de l’ordre, de la route et de la progression. |
| **Dépendance tierce** | Enregistrer auprès de l’engine Elcé une capacité optionnelle dont le composant hôte déclare la bibliothèque tierce. Utiliser la [préparation de bibliothèque CodPlay](../../codplay/specs/third-party-library-spec.md) pour charger l’adaptateur versionné. L’adaptateur monte la distribution du lecteur sélectionnée pour le module et possède son cycle par page. Les XML, styles et médias du chapitre restent des ressources du module. |
| **Isolation du lecteur** | Pour la première preuve, monter le lecteur dans un document isolé dans le rectangle de la Diapo, par exemple une iframe. RISQUE CHIMIQUE 6.2.1 démarre depuis `src/index.js`, utilise un état global et un routeur à fragment. Sa vue `src/views/Lesson.jsx` pilote la pause des médias, de CreateJS et de la chronologie globale GSAP. L’isolement permet à ces opérations de rester dans le lecteur concerné. Le [plan widgets de Sighty](../../sighty/plan/2026-11-11-widgets-foreign-plan.md) et le [contrat slot](../../codplay/specs/slot-component-spec.md) cadrent le montage et ses limites. |
| **Temps et fin de page** | Autoriser explicitement l’horloge native du lecteur embarqué pour ce profil. Le ticker CodPlay continue d’avancer sa scène hôte. Le pont échange des commandes et faits discrets selon le [contrat du pipeline](../../codplay/specs/event-pipeline-v2-spec.md). Lors de la fin fonctionnelle confirmée par le lecteur, relayer la fin au scénario par `elce:page:finished` pour la page active. Elcé garde la décision d’avancer. |

### Mode piloté par Elcé

- **Ouverture et navigation.** L’amorçage actuel lance le routeur, et même
  `forceGotoPage` écrit la route avant de charger la page. Qualifier un point
  d’entrée embarqué qui ouvre la page par chapitre et ID sur ordre d’Elcé.
  Relayer les demandes de changement de page à Elcé. Préserver l’ouverture
  des pop-ups internes au contenu, qui empruntent aussi le routeur actuel.
- **Télécommande.** Masquer les commandes source dans ce mode. La lecture
  instancie `Navigation` et appelle ses méthodes pendant la pause, la reprise
  et la fin de page. Qualifier la séparation de cette logique et de son
  affichage. Elcé fournit les commandes visibles et le lecteur exécute les
  opérations qu’il sait prendre en charge.
- **Sommaire.** Elcé porte l’ordre du scénario. Dans RISQUE CHIMIQUE, le
  sommaire et `01_introduction.xml` déclarent les mêmes 13 pages dans le
  même ordre. Dans AS BTP, le sommaire client BTP allégé sélectionne 24 des
  99 pages de `03_risques.xml`. Le lecteur 6.2.1 construit ses objets
  Chapitre et Page à partir du sommaire. Pour le pilote, lui fournir par
  `summaryToLoad` une déclaration réduite au module, issue du chapitre et
  complétée par les métadonnées du sommaire choisi, y compris les références
  de pop-ups. Garder ouverte l’injection directe de ces données à
  l’initialisation. Vérifier l’isolation du stockage de session.

### Stratégie d’intégration face aux versions du lecteur — À relire

| Stratégie | Périmètre et limite |
| --- | --- |
| **Adaptateur externe et distribution intacte** | Le document isolé fournit la configuration, le sommaire du module et la page à ouvrir via la route existante. L’adaptateur gère le montage et le démontage. Qualifier les commandes accessibles et le relais de fin de page. |
| **Adaptateur externe avec remplacement de méthodes internes** | Une surcharge peut éprouver une commande ou intercepter la fin sur la version du pilote. Elle dépend de l’implémentation du lecteur et reste une expérience de qualification. |
| **Adaptateur externe et extension officielle du lecteur** | Si le premier essai rencontre une limite, proposer un mode embarqué facultatif maintenu côté lecteur. Il donne l’ouverture par identifiants, le pilotage, le signal de fin et la fermeture. Il délègue la navigation de parcours à Elcé et garde les interactions internes. L’add-on d’Elcé consomme cette interface depuis son document isolé. |

Les manifestes du corpus déclarent `6.1.0`, `6.2.1` et `6.2.2`. Une même
version peut avoir des variantes. RISQUE CHIMIQUE et ROUTEECO déclarent
`6.2.1` avec des différences dans l’amorçage. AMIANTE et AS BTP déclarent
`6.1.0` avec une différence de retour au sommaire dans la vue de lecture.
Qualifier le pilote sur la distribution exacte, puis rejouer le même
parcours sur une variante. Si une extension officielle est retenue, valider
le même contrat pour plusieurs versions et vérifier le mode autonome.

## Ordre de travail et acceptation

1. **Prouver le pilotage d’une scène.** Suivre le
   [plan détaillé du POC](external-course-adapter-poc-plan.md) après
   approbation. Qualifier le transport, la fin fonctionnelle et le démontage
   du lecteur source via la démo V2 partagée.
2. **Importer le chapitre dans Learning.** Raccorder l’import aux commandes
   documentaires et à la persistance. Ajouter une Page Flux et une Diapo
   Elcé parmi les pages importées, déplacer une page externe, la masquer
   puis la réafficher. Vérifier l’ordre et l’état après réouverture. Refuser
   le dépôt au presse-papiers et la commande de placement au catalogue.
3. **Valider dans le lecteur Elcé.** Jouer une page vidéo, une page narrée
   et une interaction qui conditionne la fin. Comparer avec le lecteur
   source. Vérifier en prévisualisation et dans la diffusion retenue que la
   fin marque la bonne page une seule fois et que Précédent/Suivant suit le
   chapitre mixte, y compris après masquage. Consigner cette preuve avant
   la mise en production du convertisseur.

## Chargement et pilotage à qualifier

Le conditionnement de la version source, les commandes disponibles par
module et le raccord de montage, de transport et de démontage restent à
éprouver. Si un changement du core CodPlay est requis, le soumettre au plan
propriétaire et à une autorisation explicite.
