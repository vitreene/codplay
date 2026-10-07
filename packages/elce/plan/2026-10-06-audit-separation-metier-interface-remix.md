# Elcé — audit des frontières métier et interface avant Remix

**Statut : migration engagée le 7 octobre 2026 sur instruction de l’auteur ; Remix `3.0.0-rc.4` est installé.** Le portage porte sur l’interface auteur. Les validations POC restantes ne sont pas un préalable ; le POC reste la référence de comportement à préserver. Le rendu du player reste géré par Sighty/CodPlay et est hors périmètre.

## But et limites

Préparer le portage de l’éditeur vers Remix en rendant explicite la séparation entre modèle métier, application XState, adaptateurs d’infrastructure et interface auteur. Le travail futur doit clarifier ces frontières sans modifier les comportements Elcé, le format v3, les scènes CodPlay ni le circuit de commandes. Il ne prévoit pas de porter le player.

Le document complète le [plan de transposition Remix](./2026-10-06-plan-transposition-remix-3.md) et le [plan local-first](./2026-10-06-elce-local-first-synchronisation-plan.md). Il ne remplace ni les spécifications de comportement ni le plan de construction du POC.

Règles impératives pour la mise en œuvre ultérieure :

- Appliquer cet audit pendant la migration autorisée, indépendamment des validations POC restantes ; préserver les comportements Elcé déjà définis et ne pas porter le player.
- Relire les spécifications citées ci-dessous et vérifier que les fichiers n’ont pas changé depuis cet audit.
- Ne pas changer de comportement métier, de schéma v3, de layout, de navigation ou de résultat CodPlay pendant ce refactoring.
- Toute modification documentaire suit une modification implémentée et vérifiée ; une divergence de spécification bloque le code dépendant jusqu’à clarification.
- Chaque mutation du document continue de passer par les événements et commandes du contrôleur XState existant. Ne pas créer une seconde voie d’écriture.
- Conserver les whitelists d’ajout de BDC dans l’interface : elles sont une règle de logique UI, pas une contrainte de schéma métier.
- Ne pas convertir toutes les classes en fonctions par principe. Le critère est la responsabilité et la dépendance, pas la syntaxe de classe.
- Ne pas modifier `packages/codplay` ni les composants CodPlay dans le cadre de cet audit.

## Diagnostic établi

Le modèle documentaire, ses transformations immuables, la machine d’Évaluation, les builders de scène et l’adaptateur IndexedDB sont déjà distincts de React. Le contrôleur XState reste la source du document et les composants d’édition envoient leurs modifications par ce contrôleur.

La séparation n’est toutefois pas complète à plusieurs endroits : des façades d’application sont rangées dans `domain/` et importent `app/commands`; `AppLayout` construit encore beaucoup de commandes et de décisions d’orchestration dans le composant; le worker de la machine XState dépend directement du contrat IndexedDB et appelle `URL.createObjectURL`. Les builders et le player Sighty/CodPlay sont déjà séparés de l’interface auteur ; ils restent hors des modifications prévues par cet audit.

## Architecture cible

- `domain/` : `ElceDocument`, types métier, règles et transformations déterministes du document. La machine métier d’Évaluation peut dépendre de XState conformément à sa spécification. Le domaine ne dépend pas de React, du DOM, de Remix ni de `app/`.
- `app/` : contrôleur XState, façades de cas d’usage, sélection des données pour l’éditeur et orchestration de l’interface auteur. Les façades appellent les commandes métier et envoient les événements au contrôleur ; elles ne possèdent pas une seconde copie du document.
- `infrastructure/` : implémentations des ports de stockage et des accès réseau/fichiers. Le stockage local IndexedDB et les accès serveur SQLite/filesystem restent des frontières distinctes définies par leurs contrats respectifs.
- `builders/` et `player/` : projection des valeurs Elcé vers les scènes et persos CodPlay, puis cycle de vie de Sighty/CodPlay. Ces modules ne dépendent pas du runtime de composants de l’éditeur et ne sont pas portés vers Remix.
- L’interface de l’éditeur traduit les gestes DOM en intentions typées, affiche un modèle de vue et appelle les façades. Aucun composant ne compose une commande documentaire en manipulant directement le modèle.
- Les événements DOM de glisser-déposer restent dans l’adaptateur d’interface. Seules les références et intentions métier typées franchissent la frontière.

## Modifications et état

### 1. Placer les commandes documentaires dans le domaine — Fini le 7 octobre 2026

Les contrats `DocumentCommand`, `PagePlacement`, `BdcPlacement` et les
transformations de `document-commands/` résident maintenant dans
`src/domain/commands/`. Le contrôleur, les façades, les builders et les tests
utilisent ce chemin. Les événements de sélection et d’interface restent dans
le contrat XState. Les commandes continuent d’être appliquées par
`controllerMachine` ; leur comportement n’a pas changé.

**Vérification :** les 164 tests Elcé, le typecheck et le build passent ; les
tests des commandes se trouvent dans `src/domain/commands/`.

### 2. Reclasser les façades d’application — Fini le 7 octobre 2026

Les façades Ancre, Question, Carte et Carousel résident dans
`src/app/facades/<feature>/`. `ElceCardEditorFieldsProps`, qui décrit les slots
de rendu React, est isolé dans `src/app/editor/card/` ; les contrats d’actions
restent avec les façades. Les classes façade orchestrent commandes et
événements XState ; les règles métier restent dans les services de `domain/`.
Les tests du service Ancre et de sa façade sont séparés. Aucun module
d’exécution dans `domain/` n’importe `app/` ou React.

**Vérification :** tests Elcé, typecheck et build passent ; le parcours auteur
Safari démarre avec le même contrôleur XState après déplacement de la
composition dans l’entrée Remix.

### 3. Extraire le raccord entre `AppLayout` et les commandes

`src/app/layout/app-layout.tsx` cumule actuellement affichage, sélection des données, construction d’identifiants, création de commandes, appels `controller.send` et gestion des événements de glisser-déposer.

Créer dans `src/app/facades/` un adaptateur d’actions d’éditeur, assemblé une fois au démarrage de l’application. Il reprend les appels déjà présents dans `AppLayout` et les confie aux fabriques et façades existantes :

- créer une page racine ou dans un chapitre, un chapitre standard ou Évaluation ;
- déplacer et supprimer une page, déplacer ou supprimer un chapitre ;
- déplacer ou renvoyer au catalogue un BDC ;
- ajouter une Section, une Question, un BDC Résultat, un Carousel ou une Carte
  autonome directe dans une Diapo ;
- renommer page et chapitre, modifier les réglages du chapitre Évaluation et éditer/supprimer le BDC Résultat ;
- sélectionner page, chapitre, carte et onglet de catalogue.

L’adaptateur envoie les mêmes événements XState et commandes que le code actuel. Il ne crée ni acteur ni file d’écriture supplémentaire. L’interface reçoit des callbacks d’intention ; elle ne fabrique plus les objets `DocumentCommand` et n’appelle plus directement les services métier.

Extraire les lectures répétées de `AppLayout` dans un modèle de vue applicatif pur : page/chapter sélectionné, BDC visibles et ordonnés, média par identifiant, contenu du catalogue et média de page non ancré. La fonction de sélection reçoit un snapshot et retourne des valeurs dérivées ; elle ne modifie jamais le document.

Garder dans l’adaptateur d’interface les whitelists `pageAllowsQuestion`, `pageAllowsSection` et `pageAllowsEvaluationResult`, ainsi que la disponibilité de création d’une Carte autonome directe dans une Diapo. Ces choix décrivent les commandes que l’interface expose ; ils ne remplacent pas les invariants du domaine. Garder également les textes et icônes, l’état visuel de drop et les `DragEvent`/`DataTransfer`. Au dépôt, appeler le callback correspondant avec un identifiant et un placement métier, jamais transmettre l’événement DOM au domaine.

Conserver localement à la surface d’édition les états purement visuels (`previewOpen`, erreur affichée, séparateur de drop, identifiant glissé). Ne pas les enregistrer dans `ElceDocument` ni les promouvoir dans la machine métier. Les sélections qui déterminent la page, le chapitre, la carte ou l’onglet restent dans le contrôleur XState, comme aujourd’hui.

Scinder le rendu existant en surfaces aux responsabilités déjà visibles, sans modifier le CSS ni l’apparence : organisation Scénario, zone d’édition, panneau des contenus disponibles et commandes de preview. Les lignes et séparateurs de drag restent des vues ; les opérations de déplacement passent par l’adaptateur d’actions.

**Acceptation :** reprendre les cas déjà couverts par `app-layout.test.tsx` avec des tests de l’adaptateur et des surfaces ; vérifier add/move/delete et renommage par le contrôleur ; vérifier au navigateur l’ordre racine page/chapitre, les séparateurs de dépôt et les deux onglets catalogue.

### 4. Garder les éditeurs de BDC comme adaptateurs d’interaction

#### Section et Tiptap

`SectionEditor` est l’adaptateur Tiptap/DOM : il configure les extensions, transforme les transactions en `ElceSectionChange`, exporte JSON et HTML et affiche la toolbar. `ElceAnchorExtension` et son NodeView ProseMirror ne dépendent pas de React et restent en place.

Lors du portage prévu par le plan Remix :

- remplacer seulement `@tiptap/react` (`useEditor`, `useEditorState`, `EditorContent`) par un adaptateur de cycle de vie fondé sur `@tiptap/core` ;
- isoler le montage/démontage de l’éditeur, l’abonnement à ses transactions et l’actualisation de l’état de toolbar hors du rendu ;
- conserver le schéma, le JSON métier, le HTML statique, les commandes Tiptap, les métadonnées de transaction d’ancre et les callbacks typés ;
- garder `ElceAnchorExtension` comme extension ProseMirror, sans lui faire connaître Remix ni XState.

Le callback de Section est branché sur la façade Ancre de l’étape 2. Ne pas faire d’écriture IndexedDB depuis le composant Tiptap.

**Acceptation :** tests de l’adaptateur Tiptap pour JSON/HTML, transaction de texte, sélection et toolbar, insertion/déplacement/retrait/retour d’ancre ; parcours Safari, Firefox et Chromium dans l’éditeur Elcé. Le player reste dans son circuit Sighty/CodPlay.

#### Question, Carte, Carousel et Résultat

- `QuestionEditor`, `CardEditor` et `CarouselEditor` restent des vues d’inputs et de gestes natifs. Ils reçoivent données et callbacks typés ; les règles de réponses, d’ordre, de médias, de layout et de durée passent par les façades et services métier existants.
- Le même BDC Carte et les mêmes champs de carte servent à une Carte autonome directe dans une Diapo et aux Cartes enfants d’un Carousel. Garder l’éditeur partagé ; la whitelist d’interface n’autorise une Carte autonome que comme unique BDC direct d’une Diapo. Le domaine et les commandes préservent également cette règle.
- Le drag de réponses/cartes et le choix natif de fichier restent dans ces adaptateurs. Les callbacks ne reçoivent pas d’objet React ni d’événement DOM.
- `EvaluationResultEditor` ne doit plus importer `ElceEvaluationResultService` ni calculer lui-même le nouveau contenu. Il transmet la branche et le changement à une façade d’application ; celle-ci appelle le service métier puis envoie `bdc.evaluation-result.update` à XState.
- Remplacer les imports d’icônes React par le mécanisme Lucide retenu pour le runtime Remix. Le paquet de remplacement n’est pas fixé par cet audit ; ne pas choisir ni ajouter une dépendance avant la preuve de l’étape 1 du plan Remix.

**Acceptation :** les vues n’importent ni l’entrée `document-commands` ni les services mutationnels ; les tests préservent les invariants Question, le changement de layout sans perte de champs, la durée et l’ordre Carousel, ainsi que les actions Réussite/Échec.

### 5. Player Sighty/CodPlay — hors périmètre

Les builders de scénario et de scène, `ElcePlayerComposition`, le rendu du
player et son cycle de vie restent inchangés. L’éditeur conserve son accès
actuel à la prévisualisation ; ce portage n’extrait pas la session de lecture,
ne change pas le protocole ni ne réécrit le montage du player dans une fenêtre.
Toute évolution de cette frontière relève d’un travail séparé sur Sighty/CodPlay.

### 7. Placer les ports de stockage hors des adaptateurs concrets

`ElceDocumentStore` et `MediaBlob` définissent le contrat utilisé par le contrôleur et la persistance, mais sont actuellement rangés sous `infrastructure/indexed-db/`.

- Déplacer ces contrats vers un port applicatif commun, par exemple `src/app/ports/document-store-types.ts`.
- Faire implémenter ce port par `IndexedDbDocumentStore` sans changer ses transactions, clés ni les données v3.
- Modifier `controller-types.ts`, `controller-machine.ts` et `document-persistence.ts` pour dépendre du port, pas du chemin IndexedDB. Ne pas déplacer ni refactorer l’adaptateur de preview/player.
- Retirer la construction par défaut `new IndexedDbDocumentStore()` de `attachDocumentPersistence`. Construire l’adaptateur concret au point de composition et l’injecter.
- Au travail serveur prévu par le plan local-first, définir des ports/adaptateurs SQLite et filesystem distincts pour l’API. Ne pas forcer les appels réseau et les écritures locales dans un contrat de stockage unique. Les routes Remix valident et délèguent ; elles n’embarquent pas les règles de document.

Ne pas refondre le worker média XState dans cette étape : il reste le seul circuit séquentiel des imports. Garder la déduplication SHA-256, la sauvegarde locale préalable et l’ordre de commit. Le plan local-first reste l’autorité sur la synchronisation et les fichiers serveur. Le worker peut appeler un port applicatif de stockage injecté, mais ne doit pas appeler IndexedDB concrètement.

Le worker appelle aujourd’hui `URL.createObjectURL` après la persistance d’un nouveau blob. Le raccord `document-persistence.ts` restaure les sources des médias chargés et révoque les URL de la session au détachement. Ce sont des opérations d’infrastructure navigateur, pas des règles métier. Les garder dans le parcours client et à leurs propriétaires de cycle de vie ; le point de composition Remix doit garantir que le contrôleur et cette persistance ne sont chargés que dans l’entrée SPA navigateur. Ne pas injecter un port supplémentaire pour `URL` tant qu’un import serveur réel ou un test bloquant ne le justifie pas. Ne pas déplacer cette opération dans la vue Remix ni créer un service asynchrone concurrent.

**Acceptation :** `document-persistence.test.ts` et `controller-machine.test.ts` réussissent avec des stores de test injectés ; restauration, suppression atomique des blobs et import séquencé restent identiques ; aucun module métier n’importe IndexedDB ou un chemin `infrastructure/`.

### 8. Conserver les classes métier et builders sans refonte cosmétique

Décision de cet audit sur les classes examinées :

- **Garder comme classes à état/cycle de vie :** `ElceDocument`, `EvaluationMachine` et `IndexedDbDocumentStore`. `ElcePlayerComposition` et `PopupPreviewHost` restent inchangés hors du portage auteur.
- **Garder comme services métier pour cette migration :** `ElceAnchorDropService`, `ElceAnchorReferenceService`, `ElceAnchorRatioService`, `ElcePageMediaService`, `ElceMediaResourceService`, `ElceQuestionService`, `ElceCarouselService`, `ElceCardService`, `ElceChapterEvaluation` et `ElceEvaluationResultService`. La plupart n’ont pas d’état d’instance ; une fonction suffirait techniquement, mais les convertir n’améliore pas la compatibilité Remix et créerait du churn sans gain fonctionnel. Leur emplacement et leurs dépendances comptent davantage que `class`.
- **Garder les responsabilités de projection :** `ElceCardPresetBuilder`, `ElceCardBdcSceneBuilder`, `ElceCarouselSceneBuilder`, `buildFluxScene` et `buildScenario`. Les builders construisent markup/persos/stories à partir du modèle Elcé ; ils ne doivent pas importer de composants d’interface. Le détail du circuit Sighty/CodPlay et de ses invariants figure à l’étape 5.
- **Classer les façades d’ancre, Question, Carte et Carousel comme adaptateurs applicatifs, pas comme classes métier.** Leur forme de classe peut être conservée car elles reçoivent et gardent des ports d’envoi/import ; elles sont déplacées à l’étape 2. `ElceCardFacade` reste un adaptateur même si sa forme actuelle est sous `domain/card/`.

`ElceMediaResourceService` dépend des types de fichiers/Blob et Web Crypto mais pas de React. Ne pas le réécrire pour le portage UI. Si le serveur doit réutiliser la déduplication, traiter le hash filesystem dans la tranche médias du plan local-first et partager une règle seulement après avoir comparé les contrats réels.

### 9. Remplacer uniquement les raccords React de l’éditeur au stade Remix

`main.tsx` est le point de composition actuel : il crée l’acteur, le store et le rendu React. Son rôle de composition reste ; son entrée de rendu sera remplacée par l’entrée navigateur Remix, sans démarrer deux acteurs ni attacher deux persistances.

Au portage final, supprimer les imports React des surfaces auteur remplacées. Retirer du workspace les dépendances devenues inutiles seulement après avoir confirmé qu’elles ne servent pas à une surface hors périmètre, notamment au player ; ce portage ne demande pas de supprimer React du workspace en bloc. Le retrait du plugin React de Vite ou de Vite lui-même dépend des scripts Remix réellement en place. Ne retirer aucune dépendance des autres workspaces.

Adapter les tests d’interface `app-layout.test.tsx` et `section-editor.test.tsx` aux surfaces et adaptateurs Remix de l’éditeur. Ne pas porter les tests de rendu du player. Conserver les tests métier, commandes et stockage en tant que tests directs de leurs frontières.

### Cartographie des fichiers audités

Cette cartographie fixe le périmètre observé le 6 octobre 2026. Lors de la reprise, vérifier le diff de ces fichiers avant d’appliquer les déplacements ; ne pas élargir le refactoring aux fichiers modifiés par l’intervention POC en cours.

| Frontière | Fichiers de référence et changements attendus |
|---|---|
| Commandes documentaires — Fini | `document-command-types.ts`, `document-commands/` et `document-commands.test.ts` résident dans `src/domain/commands/`. Les imports XState, façades, builders et player visent ces chemins ; les transformations et la projection player n’ont pas changé. |
| Façades d’édition — Fini | Les façades Ancre, Question, Carte et Carousel résident dans `src/app/facades/<feature>/`. `ElceCardEditorFieldsProps` réside dans `src/app/editor/card/card-editor-fields-types.ts`; aucun module d’exécution sous `domain/` n’importe `app/` ni React. Les tests de service et de façade sont séparés. L’extraction de l’orchestration de `AppLayout` reste à faire à la ligne suivante. |
| Orchestration et vues auteur | Extraire les actions actuellement dans `src/app/layout/app-layout.tsx` vers `src/app/facades/editor-actions-facade.ts` ; extraire les sélections dérivées dans `src/app/selectors/editor-view-model.ts`. Garder `app-layout-types.ts`, `app-layout.css` et `app-layout.test.tsx` comme références des états, du rendu et de l’acceptation actuelle. Les composants source concernés sont aussi `src/app/editor/section/section-editor.tsx`, `src/app/editor/question/question-editor.tsx`, `src/app/editor/card/card-editor.tsx`, `src/app/editor/card/card-editor-fields.tsx`, `src/app/editor/carousel/carousel-editor.tsx` et `src/app/editor/evaluation-result/evaluation-result-editor.tsx`. Préserver la whitelist auteur qui limite la Carte directe à une Diapo vide et les autres types de BDC selon leur page. |
| Adaptateur Section/Tiptap | Adapter `src/app/editor/section/section-editor.tsx` et `src/app/editor/section/section-editor-types.ts` au cycle de vie `@tiptap/core`, avec le raccord impératif dans `src/app/editor/section/section-editor-adapter.ts`. Conserver `src/app/editor/anchor/elce-anchor-extension.ts`, `src/app/editor/anchor/anchor-types.ts` et `src/domain/anchor/anchor-types.ts`. Garder `src/app/editor/section/section-editor.test.tsx` et `src/app/editor/anchor/elce-anchor-extension.test.ts` comme corpus des comportements JSON/HTML, sélection et ancre à porter. |
| Player Sighty/CodPlay — hors portage | Garder sans modification `scenario-builder.ts`, `flux-scene-builder.ts`, les builders Carte/Carousel, `ElcePlayerComposition`, le rendu player et son protocole de preview. Le portage de l’éditeur ne réécrit ni ces modules ni leurs tests. |
| Accès éditeur à la preview | Conserver le contrôle de preview et son appel au player existant ; ne pas extraire `PopupPlayer` ni remplacer son rendu. `PopupPreviewHost` et les messages restent à leur contrat actuel. |
| Stockage et composition de l’éditeur | Déplacer `src/infrastructure/indexed-db/document-store-types.ts` vers `src/app/ports/document-store-types.ts` ; garder `document-store.ts` comme implémentation. Adapter `controller-machine.ts`, `controller-types.ts`, `document-persistence.ts` et `src/app/main.tsx` ainsi que leurs tests. `main.tsx` reste le point de composition qui crée l’acteur, le store et l’attachement de persistance. Reporter tout changement qui exigerait une refonte de l’adaptateur player. |
| Dépendances du workspace | Au terme du portage seulement, vérifier `packages/elce/package.json`, `vite.config.ts`, `tsconfig.json` et `index.html`. Garder toute dépendance utilisée par le player inchangée. Ne pas changer le `package.json` racine ni les dépendances des autres workspaces. |

## Mise à jour documentaire après validation

Une fois chaque tranche implémentée et vérifiée :

- mettre à jour `document-model-spec.md` avec l’emplacement des commandes et le port de stockage ;
- corriger `anchor-spec.md` et `section-editor-spec.md` pour distinguer service métier, façade applicative, extension ProseMirror et contrôleur XState ;
- mettre à jour `question-bdc-spec.md`, `carousel-bdc-spec.md` et `chapter-evaluation-spec.md` pour référencer la façade applicative sans déplacer leurs règles métier ;
- ajouter à `plan-transposition-remix-3.md` la présente tranche comme prérequis de son étape 1, puis y reporter les critères restants.

Ne pas publier ces changements comme comportement vérifié avant les tests concernés et un parcours navigateur réel.

## Décisions qui bloquent encore des détails du portage

- **Icônes :** l’usage de Lucide est conservé, mais la bibliothèque/méthode de rendu hors React n’est pas décidée. La trancher dans la preuve Remix de l’interface ; l’état actif, les noms accessibles et les tailles d’icônes doivent rester conformes.
- **Contrat de rendu Remix :** l’abonnement XState et le cycle de vie Tiptap de l’éditeur doivent être prouvés avec le runtime réellement retenu dans l’étape 1 du plan Remix. Aucun pont de state parallèle ni API supposée ne doit être ajouté avant cette preuve.

## Critères de clôture de cet audit

Le refactoring préparatoire est terminé seulement lorsque :

- les imports de runtime sous `domain/` ne pointent ni vers `app/`, React, Remix, le DOM ou l’infrastructure ; l’import XState de la machine métier d’Évaluation reste autorisé ;
- les composants d’interface n’importent plus les fabriques de commandes documentaires ni les services qui transforment les valeurs métier ;
- chaque action durable de l’auteur passe par les façades applicatives puis l’acteur XState existant ;
- les scènes CodPlay et le graphe Sighty restent des projections séparées ; la progression de lecture reste dans le contexte Sighty, sans deuxième circuit d’état ;
- le stockage local IndexedDB est injecté par son port, tandis que les ports serveur restent distincts selon le plan local-first ;
- chaque spécification modifiée correspond à un comportement effectivement vérifié ;
- tests Elcé, typecheck, build et parcours navigateur des frontières touchées sont réussis ;
- les builders et le player Sighty/CodPlay n’ont pas été modifiés par le portage de l’éditeur ;
- l’étape 1 du plan Remix peut démarrer sans ambiguïté sur les frontières de l’éditeur.
