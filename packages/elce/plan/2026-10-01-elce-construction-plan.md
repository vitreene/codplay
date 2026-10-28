# Elcé — plan de construction

**Statut : cadre fixe ; bilan révisé le 28 octobre 2026.** Le séquencement
initial n’est plus un relevé fiable de l’avancement : le socle auteur, le player
et la plupart des modules prévus sont réalisés et documentés. Le tableau
ci-dessous remplace les anciens statuts génériques « En cours ». Les
spécifications liées décrivent le comportement vérifié ; les plans dédiés
portent les validations encore ouvertes.

## Cadre retenu

- Elcé est une application métier distincte dans `packages/elce`. XState
  reçoit les commandes de l’application ; React rend son état.
- Le document et les médias sont conservés localement dans IndexedDB. Le POC
  porte un seul document et ne restaure pas la progression ni les réponses de
  lecture.
- La racine Sighty contient une liste ordonnée où pages et chapitres alternent.
  Les pages d’un chapitre restent sous ce chapitre. Déplacer une page reconstruit
  le scénario ; éditer une page reconstruit sa scène.
- CodPlay et Sighty portent la lecture et la navigation, en suivant la démo 5.
  Le builder de scène et le constructeur de scénario sont distincts. La lecture
  auteur commence à la page courante.
- L’éditeur est destiné à l’ordinateur ; le player doit fonctionner sur mobile.
  L’auteur n’écrit jamais de HTML. Le JSON reste la source et le builder produit
  le markup statique.
- Un BDC n’est utilisé qu’à un emplacement. Les images et médias sont des
  ressources réutilisables du catalogue.
- Le premier parcours comprend l’organisation, le Flux, les Questions et
  l’Évaluation. La Diapo vient après cette première démonstration.

Les contrats détaillés et vérifiés sont dans les
[spécifications Elcé](../specs/). Ce plan fixe leur ordre d’application et les
preuves qui permettent de fermer chaque tranche.

## Étude distincte — articulation des mods

Le [sujet Mods](../mods/index.md) regroupe les études d’une application
auteur unique et du réemploi des contenus. Le
[plan de reconfiguration](../mods/plan/2026-10-20-elce-mods-reconfiguration-plan.md)
réunit les conclusions et décisions de cette étude ; les choix techniques
non arrêtés y restent **A relire**. L’[étude technique Learning](../mods/notes/2026-10-20-learning-extraction-study.md)
détaille les découpages et raccords envisagés. Les contrats et acceptations du
présent plan restent propriétaires du mod actuel, désormais nommé Learning.

## Étude distincte de l’onglet Style

L’[analyse de l’onglet Style](../notes/2026-10-22-style-tab-analysis.md) et son
[plan dédié](./2026-10-22-elce-style-tab-plan.md) suivent les presets, les
réglages par projet/page/bloc et leur héritage. Le premier état est **En cours** ;
les comportements vérifiés sont décrits dans la
[spécification d’apparence](../specs/appearance-spec.md). Le plan dédié
regroupe les décisions et acceptations restantes ; la méthode de construction
et d’application des classes est **A relire**. Ses détails sont conservés
dans les notes Style.

## Export standard réimportable — plan à relire

Le [plan export/import coordonnés](./2026-10-26-elce-standard-export-import-plan.md)
prépare le prochain paquet standard à partir de l’export Sighty existant et sa
reprise en projet éditable. Le socle est le document actuel ; les propositions
de format, de périmètre et de publication restent **A relire**. Aucun changement
de code ou de contrat SCORM n’est réalisé par cette préparation.

## État actuel des tranches

Les contrats détaillés restent dans les spécifications ; ce tableau ne répète
que ce qui est livré et l’acceptation qui reste ouverte.

| Tranche | État réalisé | Reste à accepter |
| --- | --- | --- |
| 0 — Application, workspace et stockage | Entrée Remix SPA, cache IndexedDB, API de projets, synchronisation manuelle et preview dans une fenêtre distincte sont implémentés et documentés. Voir [Remix SPA](../specs/remix-spa-spec.md), [cache documentaire](../specs/document-store-spec.md), [session projet](../specs/project-session-spec.md) et [preview](../specs/player-preview-spec.md). | Essai sur téléphone réel et acceptation complète de la synchronisation/reprise inter-navigateurs ; voir les [plans mobile](./2026-10-13-preview-mobile-reseau-plan.md), [accès exclusif](./2026-10-11-elce-acces-exclusif-inter-navigateurs-plan.md) et [local-first](./2026-10-06-elce-local-first-synchronisation-plan.md). |
| 1 — Modèle, commandes et organisation | Modèle v7, commandes XState, scénario racine mixte et interface d’organisation sont en place. Voir [modèle documentaire](../specs/document-model-spec.md) et [organisation](../specs/organization-editor-spec.md). | Parcours navigateur des réglages de chapitre et du retour d’un BDC au catalogue, explicitement ouverts dans la spécification Organisation. |
| 2 — Lecture Flux Sighty/CodPlay | Builder Flux, scénario et intégration Sighty/CodPlay fonctionnent ; les structures et leur persistance sont couvertes par les preuves des [builders Flux](../specs/flux-scene-builder-spec.md) et [d’ancrage CodPlay](../specs/codplay-anchor-integration-spec.md). | Vérifier visuellement dans le player la navigation entre chapitre et page racine. |
| 3 — Section, médias et ancres | L’éditeur WYSIWYG, les commandes média et les ancres utilisent le circuit Learning existant. Le 28 octobre, Safari MCP a vérifié le dépôt sur l’image d’une Carte ancrée, le refus d’un dépôt sans cible et la restauration/réapplication média par Annuler/Rétablir. Voir [Section](../specs/section-editor-spec.md), [ancres](../specs/anchor-spec.md) et [historique](../specs/document-history-spec.md). | Geste physique Finder, réouverture d’un BDC, rendu de plusieurs ancres et rendu persistant après effacement d’une ancre. |
| 4 — Quiz simple | Modèle, édition et parcours de validation des Questions sont intégrés au player réel. Voir [BDC Question](../specs/question-bdc-spec.md). | Les actions Recommencer/Relire et l’affichage des réponses sont rattachés à la tranche Évaluation ci-dessous. |
| 5 — Évaluation de chapitre | Calcul, garde Sighty, réglages du chapitre, machine métier, BDC Résultat et montage des branches dans le player sont réalisés. Voir [résultat de chapitre](../specs/chapter-evaluation-spec.md) et [machine d’évaluation](../specs/evaluation-machine-spec.md). | Raccorder et accepter Recommencer/Relire ainsi que la visibilité des réponses dans le parcours réel. |
| 6 — Première démonstration | La majeure partie du parcours auteur et lecteur est construite ; l’éditeur et le player ont été exercés en navigateur. | Acceptation de bout en bout à partir des points ouverts ci-dessus, avec la validation mobile réelle suivie dans le plan dédié. |
| 7 — Carousel, Carte et Graphe | Le modèle Carousel v4, les BDC Carte/Graphe, leurs commandes, l’éditeur et les builders sont implémentés ; le parcours player et le layout Centré en Flux ont des preuves navigateur. Voir [spécification Carousel](../specs/carousel-bdc-spec.md) et [plan Texte avec image centrée](./2026-10-27-centered-text-image-card-plan.md). | Contrôles visuels des autres layouts, import fichier dans le navigateur, puis validation Centrée en Diapo, Carousel et aperçu d’ancre ; vérifier aussi portrait, rechargement, changement de layout, Undo/Redo et export, comme détaillé dans le plan dédié. |
| 8 — Page Diapo | Builder distinct, Carousel par défaut, alternatives Carte/Quiz/Graphe, progression et fin fonctionnelle sont implémentés et couverts par les preuves de la [spécification Diapo](../specs/diapo-scene-builder-spec.md). | Appliquer et valider le comportement vocal facultatif et ses règles de répartition de durée, encore ouverts dans ce plan. |
| 9 — Acceptation intégrée | Preview distincte, synchronisation manuelle, récupération de session et plusieurs parcours auteur/player sont vérifiés ; voir les spécifications Preview et Remix SPA. | Fermer les parcours restant dans les tranches 1–8 et les plans d’accès, de synchronisation, de style et d’historique. L’écart ARIA 800/801 est suivi séparément côté CodPlay ; ne pas le corriger localement dans Elcé. |

Les extensions Sommaire/profils, Style, Undo/Redo et SCORM ont chacune leur
plan dédié : leurs statuts ne doivent pas être déduits de l’ancien avancement
du POC. Le [plan export/import standard](./2026-10-26-elce-standard-export-import-plan.md)
reste **A relire**.

**Éditeur central de page — appliqué et vérifié le 22 octobre 2026.** La
rangée d’actions de création précède maintenant les titres ; le titre de page
est plus affirmé et distinct du titre de chapitre. `workspace/page-editor.test.tsx`
vérifie l’ordre de la structure, et Brave confirme l’affichage dans l’éditeur.

**Mise à jour du 22 octobre 2026 — tranche 3.** Les dix ancres média de Demo5
ne conservent plus `12rem` : ses neuf images utilisent leur ratio intrinsèque
(`65.88888889%`, `65%` ou `65.78125%`) et sa vidéo suit le cadre Elcé existant
`16 / 9` (`56.25%`). Ces valeurs ont été produites puis synchronisées par les
transactions de l’éditeur jusqu’à la révision 12. Le défaut général d’ancre
image est maintenant `75%` ; une ancienne ancre vidéo est normalisée à
`56.25%` au montage de son NodeView par le même circuit Tiptap/XState.

Le panneau Remix d’édition d’une Carte ancrée se positionne sur le cadre média
réel via CSS Anchor Positioning ; il n’est plus rendu visuellement à la fin de
la Section. Le clic existant défile jusqu’à cette zone. Brave vérifie dans
l’éditeur la superposition exacte (`643.6 × 424.1 px`) et la preview fraîche
vérifie les deux images de la première page (`918 × 604.86 px` et
`918 × 596.70 px`) avec les ratios enregistrés. Les tests ciblés (15), le
typecheck et le build Elcé passent. La suite complète compte 426 tests réussis
sur 427 ; le seul échec restant est le test serveur SQLite, qui échoue ici sur
`listen EPERM: operation not permitted 127.0.0.1`.

Le bouton qui retire le média d’une Carte affiche une corbeille `Trash2` ; la
croix ferme le panneau d’édition. Le test de production
`remix-section-production.test.tsx` distingue les deux icônes ; son test ciblé
et le typecheck Elcé passent.

### Hiérarchie des titres dans l’éditeur Tiptap

Dans le contenu d’une Section, `h1` doit être visuellement plus grand que `h2`.
La règle générale `.elce-panel h1` donnait `1rem` à tous les `h1` du panneau,
y compris ceux de Tiptap, tandis que `h2` gardait sa taille native. Des règles
scopées au contenu Tiptap rétablissent `2em` pour `h1` et `1.5em` pour `h2`.

**État : correction CSS appliquée ; vérification visuelle dans Brave en attente.**
Transférer ce comportement dans la [spécification Section](../specs/section-editor-spec.md)
après cette vérification.

### Conserver la sélection pendant la mise en forme Tiptap

Les commandes de la barre doivent appliquer l’enrichissement à la sélection
ProseMirror courante sans la perdre. Le `mousedown` sur une commande empêche le
déplacement natif du focus vers le bouton, selon le même mécanisme déjà utilisé
par le bouton d’édition d’ancre. La commande existante continue d’appliquer le
format via Tiptap et de restaurer le focus pour les activations clavier.

**État : décision acceptée, réalisation en cours.** Vérifier dans l’éditeur de
production qu’une sélection reste disponible après une mise en forme et qu’un
enrichissement suivant s’applique toujours à cette même sélection avant de
mettre à jour la spécification Section.

### Boutons compacts de la barre Tiptap — décision acceptée

Réduire le padding des commandes de mise en forme sans changer leurs icônes,
leurs états actifs ni leurs actions. Le padding CSS est réduit le 9 octobre
2026 ; contrôle visuel dans Brave en attente.

### Décision acceptée — texte du bouton de validation Question

En mode éditeur, le bouton de validation n’est pas affiché : seul son texte est
proposé dans un champ éditable. Le libellé appartient au contenu de la Question,
est sauvegardé par la façade et la commande Question existantes, puis projeté
sur le vrai bouton de validation du player. Une Question v4 déjà enregistrée
sans ce champ conserve le libellé configuré « Valider la réponse » jusqu’à sa
modification. Le stockage SQLite du projet doit conserver ce libellé après
réouverture et synchronisation.

**État : accepté, réalisation et preuves en cours.** La sortie exige le champ
éditable dans Remix sans bouton factice, le montage du libellé enregistré dans
la story Question, et les parcours de sauvegarde locale et SQLite. Les preuves
restent à ajouter ou à rejouer avant d’actualiser la spécification Question.

### Décision acceptée — disposition Question dans l’éditeur

Dans le mode éditeur, la zone d’illustration et la zone qui contient l’énoncé
et les réponses s’affichent côte à côte. La zone illustration occupe 25 % de la
largeur disponible et la zone question-réponses 75 %. Ce changement concerne
uniquement l’éditeur Remix ; il ne modifie pas la projection ni la disposition
du player.

**État : accepté, réalisation en cours.** La sortie exige que le markup de
l’éditeur regroupe les deux zones dans la même grille au rapport 25/75 et que
les actions d’édition de la question et des réponses restent raccordées aux
façades existantes. La validation de cette disposition reste à effectuer avant
d’actualiser la spécification Question.

### Décision acceptée — illustration d’une Question Flux

Dans le player, la photo d’une Question utilise `contain`, en Flux comme en
Diapo. En Flux, elle reste dans son cadre `4:3` ; en Diapo, son cadre flexible
est réservé par le layout et l’image le remplit en largeur et en hauteur. Les
styles du sélecteur de média restent propres à l’éditeur ; ni l’éditeur ni le
player n’imposent de hauteur maximale fixe à cette image. Son effet
d’apparition se déclenche une seule fois, y compris lorsque la photo est déjà
visible au démarrage ; quitter le cadre ne relance pas l’effet et ne fait pas
disparaître la photo. Réutiliser l’observation `emit.observe` existante et son
option `once`, sans modifier CodPlay ni le comportement des autres médias.

**État : effet appliqué et vérifié le 13 octobre 2026 ; cadrage Flux `contain`
mis à jour et vérifié par les builders, rendu visuel encore à confirmer.** Le
test ciblé Flux, le typecheck et le build Elcé passent. Brave sur le port 5175
avait confirmé pour la Question réelle de « Document Elcé », page « Titre »,
que cadre, wrapper et image font tous 512 × 384 px ; l’entrée se joue une fois
et une sortie puis un retour dans le viewport ne la rejouent pas. Cette
observation précédait `contain` et ne vérifie que l’effet et la géométrie.

### Revue en cours — occupation des images selon leur contexte

Le cadre Flux de l’illustration Question est en `4:3` avec `contain`.
Cette règle ne décrit pas les autres surfaces : l’éditeur Question conserve
actuellement le ratio intrinsèque de l’image dans sa colonne 25 %. Pour la
Question Diapo, décision acceptée le 13 octobre : garder `contain`, réserver
la zone de l’illustration dans le layout plein écran avec Flex, et faire
remplir cette zone par l’image à `100 %` en largeur et en hauteur. Le plafond
`28vh` du builder doit disparaître ; l’illustration et le formulaire se
partagent l’espace disponible après le titre.

Les Cartes Carousel disposent déjà du réglage `imageFit` (`cover` ou
`contain`) dans leurs cadres de layout ; l’aperçu média de l’éditeur non
proportionnel a un plafond de `18rem`, tandis que les layouts proportionnels
remplissent leur cadre. L’acceptation visuelle des trois autres layouts reste
à effectuer dans le parcours navigateur indiqué plus bas. Les Cartes Photo
ancrées suivent déjà le ratio intrinsèque réservé par l’ancre et le rendu
`cover` ; la parité de cadrage vidéo est suivie séparément dans la
spécification Ancre.

Brave, le 13 octobre, mesure dans « Document Elcé » une illustration Question
éditeur de `189 × 246 px` avec sa photo intrinsèque à `187 × 244 px`, puis le
cadre et l’image Question Flux à `512 × 384 px`. Cette mesure Flux précédait
le cadrage `contain` et n’en valide pas l’apparence. La Carte Photo sélectionnée
en `contain` a un cadre proportionnel de `791 × 445 px` dans l’éditeur et
`916 × 515 px` dans le player ; l’image remplit ces boîtes et garde le cadrage
`contain` dans les deux surfaces. Ces mesures ne couvrent ni la Question Diapo
ni les autres layouts Carte.

**État : application en cours.** Les builders Flux et Diapo appliquent
`contain` ; les deux tests ciblés passent (20 tests), ainsi que le typecheck et
le build Elcé. La validation Brave reste à faire sur un viewport large et
étroit. Le 13 octobre,
le parcours n’a pas pu être constitué : la Diapo temporaire créée dans Brave
contenait encore son Carousel par défaut, et l’auto-review de l’outil a refusé
le clic sur son bouton de suppression, y compris après un nouveau snapshot.
Le projet temporaire a ensuite été supprimé ; l’API ne liste plus que
« Document Elcé ». Aucune mesure du rendu Question Diapo n’a donc été prise,
et l’ancienne mesure Flux a été prise avec `cover`. La spécification Question
décrit maintenant le cadrage Flux `contain` et ses tests de builder ; compléter
les preuves visuelles Flux/Diapo après leur validation. La revue contextuelle
des autres layouts Carte reste ouverte selon les acceptations déjà listées
dans ce plan.

### Médias indépendants — tranche réalisée le 14 octobre 2026

Les builders emploient `media.sync: 'independent'`. La sortie de page utilise
le circuit existant Sighty/CodPlay pour envoyer `STOP`, arrêt et remise à zéro
ensemble ; aucune réinitialisation supplémentaire au retour. Le contrat et
les preuves sont transférés à la [spécification preview](../specs/player-preview-spec.md#lecture-des-vidéos-et-sortie-de-page)
et à la [spécification CodPlay](../../codplay/specs/media-sync-v2-spec.md).
Les typechecks et le build passent ; le cycle A → B → A est vérifié par test et
Safari. Neuf échecs de la suite générale sont reproduits avant modification
et restent distincts de cette tranche. L’agrandissement et les intégrations
tierces restent différés.

### Agrandissement des contenus dans le viewport — A relire

Le [plan de réalisation](./2026-10-14-elce-viewport-expansion-plan.md) porte
les décisions ouvertes, les étapes, les gates et le chemin d’acceptation de
l’agrandissement interpolé dans le lecteur Elcé : images d’abord, vidéos
ensuite, puis Graphes. Les [notes d’enquête](../notes/2026-10-14-elce-viewport-expansion-enquete.md)
conservent le contexte technique et le raisonnement ; elles ne font pas office
de plan ni de spécification. La cible reste dans la même scène que la source ;
sa projection `position: fixed` occupe le viewport. La fermeture du Carousel
conserve sa sélection. Les vidéos restent indépendantes
de la timeline ; le replay du parcours Elcé est hors périmètre. Aucune
implémentation d’agrandissement n’est engagée.

### Décision acceptée — montage du BDC Résultat dans CodPlay

Le player doit compiler une story CodPlay distincte pour Réussite et pour
Échec. L’action de cycle de vie Sighty lit l’état d’Évaluation après l’admission
de la page, puis envoie à la scène l’événement correspondant ; l’action
CodPlay de la story concernée déclenche son montage. Chaque racine commence
détachée (`move: '@off'`) et rejoint `mountPartId`, le marqueur commun du BDC
dans l’article Flux. Aucune classe `pending` ni règle CSS `display:none` ne
choisit la branche.

La cible est `mountPartId`, le marqueur commun du BDC dans l’article Flux.
CodPlay définit `move: '@root'` comme la racine de la scène ; l’utiliser ici
sortirait le BDC de sa place dans le flux.

Le routage actuel de CodPlay place un événement de cible `scene` sur la track
globale et inclut cette track dans la projection de chaque story. Il n’y a pas
de modification CodPlay à faire pour ce montage ; le correctif reste dans les
builders Elcé et son action Sighty.

**Preuve automatisée :** [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
parcourt la navigation Sighty et vérifie que Réussite ou Échec monte seul son
contenu sous `mountPartId`. Les builders Flux et Diapo vérifient la structure
des deux stories et leur action de montage. La vérification interactive Brave
du Projet 1 reste en attente : l’auto-review a refusé l’action de sélection de
page dans l’éditeur, car elle peut modifier les données du projet ; aucun
contournement de ce refus n’est prévu.

**Correction vérifiée le 8 octobre 2026 — tranche 3 :** la preview de Page A
du Projet 1 réservait le bon ratio d’image, mais la règle `height:100%` de la
Carte Photo limitait sa racine à la hauteur d’une ligne de texte. Le builder
donne maintenant une hauteur automatique à la racine ancrée ; Brave confirme le
ratio complet après rechargement et resize. La cause, les dimensions mesurées
et les suites passées sont dans la [spécification d’ancre](../specs/anchor-spec.md).

### Régression de fin de page et de navigation — 8 octobre 2026

**Statut : En cours.** Dans Brave, Page A atteint le bas de son scrollport et
son repère est visible, mais « Suivant » reste désactivé et Page B verrouillée.
La sortie du perso racine de la Carte Photo produit une erreur de tween sans
valeur de départ matérialisée ; son rejet interrompt le lot d’émissions
`IntersectionObserver` avant l’événement `elce:page:finished`. Sans progression
enregistrée pour Page A, Sighty garde les pages suivantes verrouillées. Sur un
démarrage direct à Page B, « Suivant » peut être affiché actif alors que Page C
reste inaccessible, car la présentation ne vérifie que la sortie de Page B.
Sur le bundle servi par 5175, la preview directe de Page F reproduit la même
incohérence après validation de la réponse : « Suivant » est actif, Page G garde
`data-locked="true"`, et le clic ne change pas la page active.

**Correction acceptée :** initialiser la racine de chaque Carte Flux aux valeurs
stables de sa transition d’entrée pour que les actions de sortie existantes
puissent matérialiser leur départ. Dans la présentation Sighty Elcé, n’activer
« Suivant » que lorsque la garde de sortie courante et l’accès à la prochaine
page l’autorisent. Garder le marqueur `emit.observe`, l’événement public et les
gardes `canExit`/`canAccess` existants ; aucun nouveau relais ni changement
CodPlay n’est prévu.

**Acceptation :** une régression player envoie dans un même lot la sortie d’une
Carte ancrée et l’entrée du repère bas ; l’événement atteint Sighty, le bouton
s’active et Page B se déverrouille. Dans le parcours légitime Projet 1, terminer
Page A, ouvrir la Diapo Page B, terminer son Carousel, vérifier le
déverrouillage de Page C, puis cliquer « Suivant » et constater Page C. Quand
la preview démarre directement sur une page choisie dans l’éditeur, cette page
devient l’origine de la progression avant : « Suivant » attend les conditions
de sortie Sighty de chaque page atteinte, puis déverrouille la suivante sans
exiger la relecture des pages antérieures à l’origine. Cela couvre le départ
direct à la Question D et l’accès à F après réponse et scroll-end de D. Cette
origine ne remplit aucune progression ni réponse à la place de Sighty. Un BDC Résultat conserve son garde d’accès
global : démarrer directement à la Question F ne rend pas G accessible tant que
les pages antérieures nécessaires à l’évaluation restent inachevées. Compléter
les tests Flux/Sighty ciblés, le typecheck, la suite Elcé, le build et le
parcours Brave ; ne pas modifier les données du Projet 1.

**État de l’extension : code appliqué, validation partielle.** La garde
`PAGE_ACCESS` reçoit la page de départ de la preview et applique cette origine
aux pages accessibles en avant ; les pages portant un BDC Résultat gardent le
préfixe global. Les 28 tests de composition, le typecheck et le build passent.
La suite complète compte 218 succès et un échec du test de persistance SQLite,
qui ne peut pas ouvrir son listener local (`listen EPERM: operation not
permitted 127.0.0.1`). Le parcours Brave de Projet 1 reste en attente :
l’auto-review a rejeté deux fois la sélection de Page D, sans modification des
données. Ne pas fermer la tranche avant le parcours navigateur autorisé et la
résolution ou qualification de l’échec d’environnement.

Complément d’acceptation pour Page F : après un démarrage direct à F et la
validation de sa Question, « Suivant » reste désactivé tant que Page G demeure
inaccessible. Dans le parcours accessible, valider la Question de F après les
pages précédentes, vérifier l’accès à G, puis cliquer « Suivant » et constater
Page G.

**Correction acceptée, 25 octobre — révélation :** défaut projet `swipe-right`
à l’entrée et à la sortie ; conserver les remplacements existants. Pour une
Carte média Flux, garder l’observation sur la racine fixe et porter l’animation
par le média enfant.

**Décision acceptée — simplifier « Suivant/Précédent », 25 octobre :** la garde
de sortie répond uniquement aux conditions pour quitter la page ; le calcul des
boutons décide séparément si leur destination existe et est accessible. Pour
« Précédent », seule la destination compte. Pour « Suivant », `canExit` vérifie
la page courante et `canAccess` vérifie la page cible, ou l’identifiant stable
du SCO cible à une frontière. Retirer de `pageExitGuard` ses vérifications de
présence d’un chapitre adjacent. À la frontière, l’action SCORM sans `go`
revalide la complétion et l’identifiant avant l’appel LMS, car Sighty ne peut
pas appliquer les gardes d’une route qu’elle n’effectue pas. Ne pas changer
Sighty/CodPlay. Vérifier les boutons, les gardes de page, le clic inter-SCO et
le refus d’une action directe si la page n’est pas terminée.

**État, 25 octobre :** le défaut est appliqué au code et au projet Demo5 par la
commande `document.revelation.update` (révision 32) ; aucun remplacement local
de BDC n’a été modifié ; le défaut des transitions entre cartes reste « Fondu ».
Le bouton « Précédent » ne vérifie plus de garde de sortie, et « Suivant » sépare
la sortie courante de l’accès à sa destination ; à la frontière SCO, le handler
revalide la page et l’identifiant cible. Le test de scénario couvre les deux
boutons et refuse une action inter-SCO directe si la page est incomplète ou si
l’identifiant manque. Les 468 tests passants, le typecheck, le build et
`git diff --check` sont confirmés. Le seul échec de la suite complète reste
l’écouteur SQLite refusé par l’environnement (`listen EPERM`). La preview
n’avait pas d’onglet dédié ; l’unique onglet Safari étant l’éditeur, il a été
laissé intact. La validation visuelle native reste donc à faire.

### Snap des BDC Flux — retrait demandé le 15 octobre 2026

**Statut : appliqué et vérifié dans Brave le 26 octobre 2026.** Lors de ses
vérifications, l’auteur a reproduit un recul du scroll quand un BDC dépasse la
hauteur du viewport, ce qui empêche de lire le document. Cette observation
invalide la précédente acceptation visuelle. La règle
`scroll-snap-type: y proximity` laisse le navigateur décider quand déclencher
l’alignement ; CSS n’expose pas de seuil réglable par l’auteur
([CSS Scroll Snap, §4.1.2](https://www.w3.org/TR/css-scroll-snap-1/#scroll-snap-type)).

- Décision appliquée : retirer le snap du scrollport Flux et les alignements
  des BDC directs. Le défilement natif reste libre ; aucun snap JavaScript ni
  nouveau paramètre n’est ajouté.
- Le style Flux ne déclare plus `scroll-snap-type` ni `scroll-snap-align`. Les
  41 tests de composition, le typecheck et le build passent.
- La régression distincte reproduite dans Brave le 26 octobre venait du
  chaînage natif : une commande PageDown au bas du `.elce-flux-scrollport`
  défilait le document de la fenêtre. La décision utilisateur complète le
  contrat : atteindre la limite du scrollport ne déclenche pas le défilement de
  la preview parente. `overscroll-behavior-y: contain` est appliqué au
  scrollport Flux existant ; son défilement natif intérieur est préservé, sans
  snap ni gestionnaire JavaScript.
- Brave a vérifié PageDown dans un contenu long, l’arrêt du document parent à la
  limite, le maintien du cadre de preview et l’activation de « Suivant » par le
  repère de fin. Le test de composition ciblé (47 tests), le typecheck et le
  build passent.

Chaque tranche dépend des précédentes uniquement lorsqu’elle en utilise le
contrat. Un échec de preuve garde la tranche « En cours » et bloque son
intégration dépendante ; les travaux indépendants continuent.

### Catalogue responsive de l’éditeur — implémenté et vérifié

- À 1200 px et moins, Contenus est masqué au départ ; sa commande
  iconique sans fond ni contour se trouve au bord droit de la zone centrale.
  À 800 px et moins, les deux panneaux latéraux sont masqués au départ et leurs
  commandes encadrent la zone centrale. `responsivePanel` reste l’état exclusif
  existant : ouvrir un panneau ajoute sa colonne à gauche ou à droite et réduit
  la zone centrale sans la masquer ni la recouvrir.
- Les commandes restent de vrais boutons accessibles avec nom, `aria-expanded`
  et `aria-controls`. Échap ferme le panneau et rend le focus à sa commande ;
  aucune surcouche, fenêtre modale ou capture du focus n’est utilisée. Le
  défilement indépendant reste suivi dans la tranche dédiée ci-dessous.
- Entre 801 et 1200 px, Scénario reste à gauche ; quand le catalogue est ouvert,
  les trois colonnes restent visibles. À 800 px et moins, le panneau ouvert et
  la zone centrale occupent chacun une colonne ; fermés, les deux panneaux
  laissent toute la largeur à la zone centrale. À plus de 1200 px, les trois
  colonnes restent visibles et les commandes responsives des panneaux
  disparaissent. Le bandeau ne montre que « Elcé ». Le comportement appartient
  au layout Remix, hors scène CodPlay.
- La commande « Prévisualiser » reste toujours visible dans la barre au-dessus
  de la zone centrale. Aux largeurs où les accès de panneaux s’affichent, ils
  partagent cette barre : Scénario à gauche, preview au milieu et Contenus
  disponibles à droite jusqu’à 800 px ; preview puis accès Contenus
  à droite entre 801 et 1200 px. Le test de
  [`editor-workspace.test.tsx`](../src/app/remix/workspace/editor-workspace.test.tsx)
  vérifie le placement, l’action et la présence dans la vue de chapitre.
- Brave confirme à 390 × 844 px la zone centrale seule quand les panneaux sont
  fermés, puis l’ouverture exclusive de Scénario (137 px / 205 px) et de
  Contenus (205 px / 137 px), sans débordement horizontal. Échap
  ferme le panneau et rend le focus à sa commande. À 1024 px, la vue fermée garde
  Scénario à 288 px et le centre à 688 px ; la vue ouverte mesurée précédemment
  garde les trois colonnes à 288/384/288 px. Le test visuel ouvert à 1024 px a
  précédé le dernier ajustement, limité au breakpoint mobile. Typecheck passe et
  `git diff --check` est propre. Le contrat vérifié figure dans la
  [spécification Organisation](../specs/organization-editor-spec.md).
- À 390 px, la règle responsive de masquage perdait contre le sélecteur plus
  spécifique qui impose `display:flex` au Scénario pendant l’édition ; le panneau
  fermé restait donc dans la grille et repoussait la zone centrale. Le sélecteur
  de masquage est maintenant limité au panneau latéral fermé dans l’espace auteur.

### Placement du bouton d’export Sighty — décision acceptée

Le bouton « Exporter le scénario » rejoint le côté droit de la barre de titre
du projet. « Prévisualiser » reste dans la barre de commandes au-dessus de la
zone centrale. Le même gestionnaire d’export, l’état occupé et les annonces
d’erreur ou de téléchargement sont conservés.

- [x] Déplacer le bouton dans la barre de titre, à droite, et le retirer de la
  barre responsive du workspace.
- [x] Vérifier l’emplacement, l’action et l’état occupé, puis mettre à jour les
  spécifications, les tests, le typecheck et le build. Les tests
  `project-application.test.tsx` et `editor-workspace.test.tsx` couvrent le
  nouvel emplacement et l’action ; typecheck, build et `git diff --check`
  passent.

### Minification de `elce-engine.js` — décision acceptée

Le bundle d’intégration Elcé n’a besoin que du prédicat `isPlainRecord` pour
valider la capacité `scroll-container`. Le validateur local de
`component-v2` copie ce petit prédicat au lieu d’importer la barre
`codplay/shared`. Il importe également le garde DOM depuis son fichier précis,
pas depuis la barre complète `codplay/runtime/runner-html`. Ces deux barres
peuvent tirer des services sans rapport avec la capacité, dont la table de
couleurs ACE. La configuration engine Elcé importe ses définitions de
composant et de module depuis leurs modules précis ; elle ne charge pas la
barre qui réexporte également l’adaptateur HTML utilisé par le player Elcé.
Le moteur et son builder CodPlay restent inchangés.

- [x] Copier le prédicat dans le validateur `scroll-container` de
  `component-v2`, retirer l’import de la barre partagée et cibler le fichier du
  garde DOM directement ; cibler aussi les deux définitions requises depuis
  les modules précis dans la configuration engine Elcé.
- [x] Vérifier les tests de la capacité, puis reconstruire l’engine Elcé et
  confirmer que la table de couleurs ACE n’est plus embarquée ; mettre à jour
  la spécification d’export et le présent suivi. Le bundle passe de 23 073 à
  8 672 octets (−62,4 %) ; les tests `component-v2` et d’export, le typecheck
  Elcé et `git diff --check` passent.

### Défilement indépendant des colonnes — décision acceptée, implémentation en cours

Quand l’éditeur est ouvert, son bandeau supérieur reste fixe dans la fenêtre et
la grille occupe la hauteur disponible. Au-delà de cette hauteur, la colonne
centrale défile seule ; le Scénario et les Contenus gardent chacun
leur propre défilement. Dans le Scénario, le titre et les commandes restent
fixes pendant le défilement de l’arborescence et du catalogue de pages. Les
panneaux des colonnes responsives gardent leur défilement indépendant.

**Acceptation :** avec du contenu assez long dans chaque colonne, faire défiler
la colonne centrale ne déplace ni l’en-tête de l’application ni les colonnes
latérales ; chaque colonne latérale peut ensuite défiler sans déplacer les deux
autres ; le titre « Scénario » reste visible. Refaire le contrôle aux largeurs
des colonnes responsives. Garder la réalisation en cours jusqu’au contrôle dans
Brave ; ne pas ouvrir 5173.

**État : implémentation en place, validation restante.** L’espace auteur est
borné à la hauteur de la fenêtre, les zones centrale et latérales ont leur
propre débordement vertical, et le contenu du Scénario défile sous son en-tête
fixe. Le contrôle navigateur n’a pas encore été rejoué après ces changements.

### Libellés sous les icônes d’ajout — décision acceptée, validation restante

Les commandes d’ajout de contenu affichent un libellé court sous leur icône :
un mot, deux au maximum si le sens l’exige. Le seul cas conservé en icône seule
est l’ajout Page/Diapo dans les lignes du Scénario ; ces actions gardent leur
nom accessible et infobulle complets. Les quatre actions d’ajout du bandeau
Scénario conservent leurs libellés. Les autres actions concernées sont les
créations de BDC et de vues Carousel ainsi que les ajouts de média,
d’illustration, de réponse, de ligne et de colonne. Les commandes et leurs
règles de disponibilité restent inchangées.

**Acceptation :** parcourir dans Brave le Scénario, la barre d’ajout de page,
les vues Carousel, le BDC Résultat, la Question et son illustration, la Carte
et sa cible média vide, et la grille Graphe. Vérifier les libellés sous les
icônes, ainsi que les boutons Page/Diapo iconographiques dans les lignes du
Scénario ; aucun libellé ne doit être coupé ni commande déplacée dans un autre
circuit. Garder l’état en cours jusqu’à cette vérification.

Le 9 octobre 2026, Brave sur `5175` vérifie les libellés des quatre boutons
dans le bandeau Scénario, la barre d’ajout de page, les boutons d’ajout
Carte/Graphe au Carousel, et Ligne/Colonne du Graphe, à 1024 px et 390 px.
Les libellés restent sous les icônes, ne sont pas coupés et les boutons gardent
leurs noms accessibles complets. Les boutons Page/Diapo des lignes de chapitre
restent compacts et iconographiques après le retour demandé. La vérification
visuelle de la Question, du BDC Résultat et de l’invite média de Carte reste à
faire.
Clarification validée le 9 octobre : les boutons d’ajout Carte et Graphe du
Carousel montrent l’icône du BDC concerné (`RectangleHorizontal` et `Activity`)
au-dessus de leur libellé, sans icône générique « + ». Brave sur 5175 confirme
le rendu et les libellés à 1024 px ; leurs commandes et noms accessibles
restent inchangés.
Après un premier refus, un snapshot a11y complet montrait Page D comme un bouton ;
l’auto-review a encore refusé le clic, indiquant que l’UID n’était pas
identifiable dans le snapshot et que la sélection pouvait déclencher une
commande d’édition ou destructive. Ne pas contourner ce refus par une exécution
indirecte ; reprendre la vérification quand Page D pourra être sélectionnée de
façon autorisée.

### Icône du type de page devant son titre — décision acceptée

Le titre central de chaque page affiche l’icône de son type avant le nom, sans
retirer l’édition inline. Réutiliser les icônes déjà associées aux types dans
les commandes du Scénario : FilePlus pour Flux et Presentation pour Diapo. Le marqueur de la page sélectionnée suit la hauteur de capitale (`1.4cap`) comme le marqueur du chapitre courant.
Implémenté le 9 octobre 2026 dans le titre de page Remix et dans la commande
d’icône partagée avec le Scénario. Le 9 octobre, l’ajout de ce helper avait
laissé deux imports sans extension ; le serveur a répondu 404 sur
`/assets/elce/app/remix/workspace/page-type-icon`, ce qui empêchait le montage
de l’interface. Les imports pointent maintenant explicitement vers le module
`.ts`. Après rechargement dans Brave sur 5175, Projet 1 s’affiche avec le
statut « Synchronisé », l’icône Presentation précède le titre Page B et la
console ne signale plus d’erreur. Le typecheck et `git diff --check` passent.
Safari MCP, le 25 octobre 2026, avait confirmé que les SVG du marqueur de chapitre et de page n’ont pas d’attribut de taille fixe et utilisaient `block-size: 1cap`. La règle est passée à `1.4cap` et doit être revalidée visuellement ; l’affichage du titre Flux reste à contrôler dans Brave.

### Taille des icônes d’interface — règle appliquée

Les SVG Lucide de l’interface utilisent `.elce-ui-icon` avec `block-size: 1.4cap` et une largeur automatique. Le renderer retire les attributs SVG `width`/`height` ; l’icône d’ancre réutilise la même classe. La flèche de sélection CSS suit aussi `1cap`. Les dimensions des boutons restent propres à leur rôle, avec le padding de 2 px et l’écart de 4 px déjà définis. Les SVG de graphe et d’illustration gardent leur contrat de rendu.

Safari MCP, le 25 octobre 2026, avait vérifié la prise en charge de `1cap` et l’absence de taille fixe sur les 78 icônes d’éditeur présentes. La règle `1.4cap` reste à vérifier visuellement ; les feuilles du popup utilisent la même règle.
### Sommaire responsive du player — décision acceptée, défaut détecté à la frontière

- **Régression confirmée le 26 octobre 2026 — En cours ; décision utilisateur
  appliquée dans la scène, acceptation navigateur restante.** Brave MCP, popup
  locale de « Démo 5 — comparaison Elcé », à
  1034 × 892 : le sommaire est visible, mais son unique
  `.elce-player-menu-drawer` conserve `aria-hidden="true"`, `inert` et
  `data-open="false"`. Les boutons « Distinguer les plans » et « Suivre le
  regard » ne sont pas désactivés ; `elementFromPoint()` à leur centre cible
  leur ancêtre, pas le bouton. La console ne signale aucune erreur. Le défaut
  constaté concerne donc l'interaction sur ordinateur, au-delà de
  l'incohérence ARIA 800/801 déjà suivie.
  `elce-player-style.ts` force l'affichage au-dessus de 800 px ;
  `summary-scene-builder.ts` déclarait aussi `inert` dans son HTML et ses actions
  d'ouverture/fermeture. Sur instruction utilisateur, ces déclarations ont été
  retirées ; le gestionnaire responsive conserve `inert` seulement pour le
  tiroir mobile fermé. Le moment exact où il a été réappliqué dans la popup
  observée reste à établir.
  Les tests de composition consultés appellent directement `.click()` et ne
  couvrent pas l'atteignabilité réelle des boutons dans le navigateur.
  Acceptation restante :
  clic réel sur une page autorisée dès le démarrage sur ordinateur, après
  navigation et synchronisation ; parcours mobile ouvert/fermé, transitions
  800/801 dans les deux sens, clavier et focus ; puis tests ciblés, typecheck,
  suite Elcé, build et mise à jour de la spécification après vérification.
- Décision validée le 5 octobre 2026 : à 800 px et en dessous, une icône ouvre
  un tiroir latéral gauche superposé au contenu ; au-dessus, le sommaire reste
  dans la colonne latérale. Le tiroir se ferme par son icône de fermeture, un
  clic à l’extérieur, Échap ou le choix d’une page.
- Précision acceptée le 5 octobre 2026 : le bouton reprend le fond du sommaire
  (`#263b3a`) et CodPlay déclenche les animations d’entrée et de sortie par les
  événements et actions de style de la scène. Le tiroir garde les événements de
  navigation de page Sighty/CodPlay existants ; aucune navigation parallèle ni
  animation pilotée par React n’est ajoutée.
- Le sélecteur responsive reste dans la feuille du player pour fonctionner
  dans une fenêtre de preview distincte. L’implémentation remplace le premier
  montage en dialogue natif par le tiroir animé dans le circuit CodPlay ; les
  états accessibles et le retour du focus restent synchronisés avec les
  commandes.
- Brave DevTools, le 5 octobre 2026, vérifie à 390 × 844 l’ouverture du tiroir,
  la sélection de Page A et l’absence de débordement horizontal. À 800 × 900,
  le tiroir s’ouvre, son animation de CodPlay est visible, puis Échap et le
  bouton de fond le ferment et rendent le focus au bouton d’ouverture.
- Écart détecté lors du passage de 800 à 801 px avec le tiroir fermé : le
  bouton passe en `display: none` et le tiroir reste `data-open="false"`,
  `aria-hidden="true"` et `inert`, mais le bouton porte
  `aria-expanded="true"`. Cette incohérence garde l’acceptation en cours.
- Lors de la sélection d’une page dans le tiroir, le navigateur émet aussi un
  avertissement indiquant que le bouton de page garde le focus quand son
  ancêtre reçoit `aria-hidden`. Le focus finit sur le bouton d’ouverture, mais
  l’ordre de fermeture reste à corriger pour éviter cet état intermédiaire.
- Précision acceptée le 5 octobre 2026, non appliquée : le bouton du menu, le
  tiroir, ses commandes, le comportement responsive et la gestion du focus
  doivent être portés par des persos, événements et actions CodPlay dans la
  scène `layout`. Le tiroir ne doit pas être une scène séparée, et
  `ElcePlayerComposition` ne doit pas en reprendre l’état accessible ou le
  focus dans un adaptateur DOM impératif.
- Direction validée le 5 octobre 2026, application en attente : le materializer
  HTML reçoit `htmlElementMethod` dans les actions et appelle la méthode sur le
  nœud courant sélectionné (`focus`, `blur`, `preventscroll`). La combinaison
  `focus` avec `preventscroll` appelle
  `htmlElement.focus({ preventScroll: true })`, et `preventscroll` seul est
  invalide. Une action est exécutée une fois en lecture normale ; Seek et
  reconstruction ne lancent pas ces méthodes, et un perso démonté est ignoré.
  Les formes ambiguës ou répétées déclenchent un avertissement du compilateur
  auteur hors du core CodPlay, puis sont ignorées. À l’ouverture, les attributs
  précèdent le focus ; à la fermeture, le retour du focus précède
  `aria-hidden`/`inert`. Elcé n’appelle aucune méthode DOM et n’ajoute pas de
  scheduler RAF. La spécification Elcé sera mise à jour après validation réelle
  de la projection. Le détail de réalisation est dans le
  [plan de projection HTML](../../codplay/plan/node-method-capability-plan.md).
- Décision du 6 octobre 2026 : aucun traitement media query n’est ajouté par
  un patch local Elcé ni à la projection HTML dans cette tranche. L’évolution
  est reportée à une prochaine version de CodPlay et devra être étudiée à une
  frontière indépendante de la matérialisation, pertinente pour les cibles
  HTML comme canvas. L’incohérence ARIA constatée au passage de 800 à 801 px
  reste consignée comme travail différé et ne bloque pas la tranche actuelle.
  Ne pas ajouter de capacité de breakpoint au travail de focus.
- Précision utilisateur du 26 octobre 2026, appliquée : la scène ne déclare plus
  `inert` dans son HTML ni dans ses actions d’ouverture et de fermeture. Le
  gestionnaire existant l’ajoute seulement au tiroir mobile fermé et le retire
  sur ordinateur. La popup observée gardait malgré tout `inert` sur ordinateur ;
  le parcours navigateur doit confirmer qu’elle reste désormais interactive
  au démarrage, après navigation et après synchronisation. La coordination
  générale du focus responsive reste à accepter avant de la modifier.
- Après correction, rejouer le typecheck, la suite Elcé, le build et le
  parcours Brave sur les tailles concernées par le transfert de focus.
  Confirmer l’animation, Échap, le clic extérieur, la sélection d’une page et
  le retour du focus sans avertissement console avant d’enregistrer le
  comportement dans la spécification. Le défaut 800/801 reste non résolu et
  sera réexaminé avec l’évolution CodPlay indépendante de la matérialisation.

### Lecture dans une fenêtre distincte — tranche 9 en cours

- Décision du 5 octobre 2026 : la popup devient le parcours de
  preview actif. Le code de la modale intégrée reste disponible mais son accès
  est désactivé pour comparer les choix pendant le POC. Le mode de diffusion
  qui projette le projet derrière l’éditeur viendra après la popup.
- À l’ouverture, la popup présente la page affichée dans l’éditeur. Sa
  navigation Sighty/CodPlay reste ensuite indépendante. Une commande distincte
  permet de réafficher la page éditée. Une synchronisation affiche également
  cette page. Si cette page a été créée depuis la dernière synchronisation,
  cette commande synchronise automatiquement une fois pour pouvoir l’afficher.
- Première étape : une commande de synchronisation manuelle au-dessus du rendu
  transmet le document courant de l’éditeur et reconstruit le projet selon la
  règle déjà retenue : une édition ne reconstruit que la scène de sa page ; un
  changement d’organisation reconstruit le scénario entier en réutilisant les
  scènes inchangées. La popup monte sa propre composition Sighty/CodPlay et
  possède son cycle de vie. La lecture repart de la page éditée avec temps,
  réponses et historique remis à zéro ; le POC ne persiste pas ces éléments.
- Étapes suivantes, non appliquées : signaler visuellement sur la commande
  qu’une mise à jour est demandée, puis proposer un mode automatique
  débrayable qui calcule le nouvel état du projet. Ne pas confondre ce mode
  avec la lecture automatique d’un BDC Carousel.
- Le document XState de l’éditeur reste la source unique. Les deux contextes
  navigateur imposent un transport entre eux ; aucune voie équivalente
  n’existe actuellement dans Elcé. Ce transport ne possède ni document, ni
  navigation, ni catalogue parallèles. Les médias continuent de passer par le
  stockage IndexedDB existant et sont chargés dans le contexte de la popup.
- Brave DevTools, le 5 octobre 2026, vérifie l’ouverture d’une popup depuis la
  page éditée, la navigation indépendante A → B, l’attente d’une synchronisation
  après correction, le retour à la page éditée et la synchronisation unique
  lorsqu’elle a été créée depuis le dernier instantané. Après réorganisation,
  le nouveau scénario commence sur la page éditée en première position ; le
  test de composition vérifie l’identité des sources de scènes inchangées.
  Brave vérifie aussi les icônes et les noms accessibles des commandes : les
  libellés sont masqués avec `title` à 390 px et 800 px, puis visibles à 801 px.
- Un fichier image de test chargé par l’événement `change` de l’input produit
  une image décodée dans la popup après synchronisation, puis après fermeture
  et réouverture depuis IndexedDB. Le MCP a refusé le chemin local pour son
  action `upload_file` ; la boîte de dialogue système n’est donc pas couverte
  par cette preuve.
- Typecheck réussi, suite Elcé réussie (130/130) et build réussi le
  5 octobre 2026. Le build signale un chunk supérieur à 500 kB.
- Avant de clore cette tranche, corriger l’écart `aria-expanded` et l’ordre de
  transfert du focus du sommaire décrits ci-dessus, puis rejouer l’acceptation
  responsive. Le signal visuel de synchronisation et le mode automatique
  restent des étapes ultérieures non appliquées.

## BDC Carousel — périmètre en cours

### Direction des transitions de glissement — acceptée, preuve restante

- Décision du 5 octobre 2026 : pour un glissement vers la gauche, la vue
  entrante et la vue sortante se déplacent toutes deux vers la gauche sans se
  croiser. La même règle directionnelle s’applique aux glissements vers la
  droite, vers le haut et vers le bas.
- Le réglage reste porté par AutoCapsule et les actions de style CodPlay déjà
  utilisées par le builder du Carousel. Corriger les définitions nommées
  existantes ; ne pas ajouter un second circuit de transition.
- La preuve d’acceptation devra contrôler des instants intermédiaires des
  deux vues dans le player Elcé réel pour les quatre directions. La
  spécification du Carousel reste inchangée jusqu’à cette vérification.

### Comportements retenus

- Le travail courant construit le BDC Carousel dans la séquence des BDC d’une
  page Flux, ajouté par l’icône de la barre de page. Son insertion ultérieure
  dans le contenu d’un BDC Texte reste prévue, mais ne fait pas partie de cette
  première version à la suite. La page reste une page Flux défilante ; le type
  de page Diapo et son builder ne font pas partie de cette tranche.
- Le BDC Carousel est un objet Elcé placé dans une page Flux. Chaque vue de sa
  séquence est un BDC Carte identifié, enfant unique du Carousel. Les BDC ne
  sont pas des objets CodPlay ; les images et vidéos restent des ressources
  réutilisables du catalogue.
- La création ou la réouverture d’un BDC Carousel ouvre directement son espace
  d’édition au centre. L’entête identifie « Carousel » et place la suppression
  en haut à droite. La création ajoute une première Carte en layout Texte
  court. L’auteur choisit un layout pour chaque BDC Carte, puis peut
  revenir à la page et prévisualiser celle-ci en entier ; aucun preset des vues
  suivantes n’est défini globalement.
- Le Carousel s’étend dans les limites de son parent. Le ratio se choisit parmi
  16:9, 4:3 et 1:1 ; il détermine le cadre de lecture, sans inclure la rangée de
  points. Une vue à la fois occupe ce cadre, sans défilement ni empilement
  vertical.
- Une seule carte est visible à la fois. Les points sont cliquables dans les deux
  modes et sélectionnent la vue correspondante. En mode automatique, les
  changements temporisés restent actifs après une sélection par point. Chaque
  entrée utilise la durée commune choisie pour le Carousel ; une durée
  particulière peut remplacer cette durée. La durée totale est la somme des
  durées d’entrée. Le mode manuel avance par les points du mini-navigateur
  uniquement. Le Carousel
  expose son choix de transition dans ses paramètres. En lecture automatique,
  « Répéter [x] fois » accepte de 0 à 10 passages supplémentaires après le
  premier ; la valeur par défaut est 10 et 0 désactive les répétitions.
  Pause/lecture reste hors du POC.
- Le premier BDC Carte commence en layout Texte court. Chaque carte conserve
  surtitre, titre, description, message (250 caractères maximum), note,
  légende, position et cadrage de l’image et référence média dans le même BDC,
  quel que soit son layout actif. Le cadrage choisit `contain` ou `cover` et
  vaut `cover` par défaut afin de garder le rendu existant ; il concerne les
  images, pas les vidéos. Les anciens documents v3 qui n’ont pas encore ce
  champ reçoivent `cover` à la lecture, sans réintroduire le support v1/v2.
  Texte avec image reprend ces champs et propose une image à gauche ou à droite,
  cadrée selon ce réglage dans la zone prévue par la carte. Les autres presets initiaux
  sont Photo/vidéo plein cadre et Image avec légende. Le preset Question et son
  comportement de questions-réponses sont reportés à la tranche dédiée.
-  Le changement de layout masque les valeurs qui ne sont pas projetées sans
  les effacer ; les quatre présentations modifient le même BDC Carte. Photo ou
  vidéo plein cadre accepte image ou vidéo ; Texte avec image et Image avec
  légende acceptent l’image ; Texte court ne projette pas de média. Une
  référence média déjà présente reste attachée même dans un layout qui ne la
  projette pas. Les zones et le markup sont ceux des presets de configuration.
- Dans une carte média, la zone vide et l’aperçu sont un label associé à
  l’input natif ; `accept` fournit extensions explicites et types MIME depuis la
  configuration. Le dépôt et les médias du catalogue utilisent les commandes
  média de la Carte ; le bouton de retrait reste distinct.

### Circuit technique et état des preuves

- `AutoCapsule` fournit le type `carousel` et sa grille forcée 1×1. Il exige
  une plage `timeRange` déjà résolue pour chaque BDC Carte et transmet ces
  plages ; il ne calcule pas la durée cumulée. Les transitions disponibles
  sont les définitions nommées de la bibliothèque.
- Le builder traduit la durée d’entrée et son éventuelle durée particulière en bornes
  séquentielles explicites, puis utilise `CapsuleDistribution` dans
  `packages/authoring/scene-factory` pour résoudre les plages transmises à
  `AutoCapsule`. Il projette chaque enfant par ID avec
  `ElceCardBdcSceneBuilder`. Il n’y a pas de minuteur parallèle dans Elcé.
- La sélection par point passe par un événement, un strap et des actions
  CodPlay dans les deux modes. Les tests de composition exécutent le runtime
  player ; Brave DevTools confirme la sélection et l’avance automatique dans la
  fenêtre de lecture. Aucun état de navigation ni minuteur parallèle n’est
  ajouté dans React.
- L’ajout à la suite doit conserver le BDC unique et sa place dans l’ordre des
  BDC. Son insertion ultérieure dans le texte pourra réutiliser le circuit
  d’ancre. Le cadre du Carousel reste responsive selon son parent et son ratio ;
  aucun code CodPlay core ne change.
- Le builder construit séparément la story autonome du BDC Carousel et
  l’assemble à la scène Flux. La story donne accès à ses persos et à son état ;
  elle n’est pas un élément DOM. Les actions et événements sont déclarés dans
  les persos et utilisent les circuits CodPlay documentés.
- Le contrat `AutoCapsule` résout des durées finies. La répétition demandée est
  elle aussi finie : le builder répète les occurrences CodPlay selon le nombre
  choisi, en décalant chaque passage par la durée totale du premier. Aucun
  minuteur local ni changement CodPlay core n’est prévu. Pause/lecture reste
  différée.
- Les comportements vérifiés, dont l’identité Carte, la conservation des
  champs, l’absence de migration v1/v2 et l’acceptation player, sont consignés
  dans la [spécification du BDC Carousel](../specs/carousel-bdc-spec.md). L’insertion
  dans un BDC Texte reste une décision retenue mais non appliquée.

### Refonte Carousel vers BDC Carte — implémentation vérifiée, stockage existant à décider

- Le BDC Carousel reste le conteneur de lecture : il porte le mode, les
  répétitions, le ratio, la transition et la durée commune. Sa séquence ordonnée
  référence des BDC Carte enfants ; chaque entrée porte sa durée particulière.
- Chaque carte devient un BDC identifié du document avec un parent unique. Le
  conteneur possède l’ordre de ses enfants. Les quatre formes actuelles — Texte
  court, Texte avec image, Photo/vidéo plein cadre, Image avec légende — sont
  des choix de layout d’un même BDC Carte, pas quatre types de BDC.
- Le BDC Carte garde son jeu de champs complet indépendamment du layout choisi.
  Le layout sélectionne les champs projetés ; il ne supprime ni ne réinitialise
  les champs masqués. Les références média restent attachées au BDC. Les règles
  d’acceptation et de projection d’un média restent propres au layout.
- Décision acceptée et implémentée, validation manuelle en attente : « Ajouter
  une vue » reprend le layout et ses options de présentation depuis la dernière
  vue du Carousel. Pour les options actuelles, cela reprend `imagePosition` et
  `imageFit` ;
  le contenu texte, la légende, le média et la durée propre à l’entrée ne sont
  pas copiés. La nouvelle carte reste vide et sa durée suit le défaut commun.
  La première carte créée avec le Carousel conserve son layout initial
  configuré. Vérifier dans le player l’ajout après plusieurs layouts, les deux
  positions et les deux cadrages d’image avant de reporter ces comportements
  dans la spécification.
- Décision acceptée et implémentée, validation visuelle en attente : l’éditeur
  offre aux layouts qui projettent une image le cadrage « Contenir » (`contain`)
  ou « Couvrir » (`cover`). La valeur est portée par le BDC Carte et projetée
  par une classe CSS de l’image ; le rendu de vidéo plein cadre reste inchangé.
  L’éditeur place représentation, durée, cadrage et position de l’image dans la
  barre supérieure en une seule rangée, chaque libellé au-dessus de son
  contrôle. Les colonnes ne sont présentes que pour les réglages du layout
  courant. Vérifié dans Brave pour Photo/vidéo plein cadre à un viewport de
  1408 px (barre de 704 px) ; l’acceptation visuelle des autres layouts reste
  à faire.
- Décision acceptée et implémentée, acceptation navigateur en attente : le
  multi-import commence dans la zone image d’une carte, comme l’import unitaire
  actuel. Pour N images,
  l’image 1 est affectée à la carte ciblée et N−1 nouvelles cartes sont créées
  immédiatement après, dans l’ordre des fichiers sélectionnés. Elles reprennent
  le même layout et les mêmes réglages de présentation ; leur texte, légende,
  média antérieur et durée particulière ne sont pas copiés. Le flux réutilisera
  les commandes de création de BDC Carte et l’import média existant ; il
  n’ajoute pas de circuit d’import parallèle. Vérifier avec la sélection de
  fichiers et le glisser-déposer que le nombre, l’ordre, le layout, les réglages,
  l’attachement des médias et la persistance après rechargement sont corrects
  dans le player et l’éditeur réels.
- Le Carousel n’accepte que des BDC Carte dans cette tranche. Les autres types
  enfants seront décidés pour la Diapo dans sa tranche ; la Question reste hors
  du périmètre Carousel actuel.
- Les réglages Lecture, Répéter, Durée par vue, Transition et Ratio restent sur
  une rangée. Dans Brave, cette rangée tient sur 704 px de largeur.
- Correction autorisée et implémentée : le perso layout Capsule matérialise
  l’article de la carte et reprend maintenant les classes racines et de zones du
  preset. Avant correction, Brave observait un hôte média de 916 × 644 px et une
  image de 412 × 640 px dans un cadre de 916 × 515 px. Après correction, le
  layout Photo/vidéo plein cadre garde l’article, l’hôte média et l’image dans
  le même cadre : 916 × 515 px sur ordinateur et 298 × 168 px à 390 px. Le
  cadrage de l’image utilise `object-fit` ; le typecheck Elcé passe et aucun
  changement du core CodPlay n’est requis.
  Vérifier visuellement le confinement des contenus dans les trois autres
  layouts avant de clore cette acceptation.
- **Responsive vidéo plein cadre — accepté le 23 octobre 2026, En cours :**
  une vidéo Carte doit remplir son logement responsive comme le média image du
  même preset. Le builder Carte applique la classe de dimensionnement au
  conteneur CodPlay ; la feuille centrale du player contraint la vidéo native à
  100 % du cadre avec `object-fit: cover`, le cadrage déjà prévu.
  La règle s’applique par le builder Carte partagé aux Cartes directes, ancrées,
  Carousel Flux et Carousel Diapo.
  - [x] Vérifier le perso, son montage dans le player CodPlay, les règles de la
    feuille centrale et leur présence dans le package exporté ; la suite Elcé
    passe avec 462 tests, le typecheck et le build.
  - [ ] Vérifier dans la preview le logement vidéo à grande et petite largeur.
    L’appel Brave DevTools `list_pages` n’a pas répondu le 23 octobre 2026 ; ce
    contrôle visuel reste en attente.
- Étendre le modèle documentaire et ses invariants de placement unique aux
  relations parent/enfant, puis aligner les commandes, la sélection d’édition,
  l’éditeur Carousel, le traitement des médias et la composition de scène sur
  ces identifiants de BDC. Chaque layout de Carte est décrit comme une grille
  CSS de type `card`, avec des zones nommées. Les items du contenu sont placés
  dans ces zones. `capsule-automation` doit produire les styles qui adaptent
  leurs positions à l’orientation (par exemple, une image à gauche en horizontal
  se place en haut en vertical). Le builder Elcé consommera cette description
  et ces styles, sans circuit local parallèle de placement.
- Décision acceptée, application en attente : reprendre le mécanisme du
  [plan Editor des variantes d’orientation](../../editor/plan/modules/2026-07-11-zone-orientation-variants-plan.md).
  `capsule-automation` produit les styles CSS conditionnels de la grille `card`
  et de ses zones nommées. `@container (orientation: landscape | portrait)`
  évalue le ratio largeur/hauteur de la propre boîte du BDC Carte ; le rendu ne
  dépend donc pas de l’orientation du téléphone ou de l’ordinateur. Les mêmes
  règles CSS responsive doivent fonctionner dans le player Elcé sur les deux
  types d’appareil. Le contrat actuel de `capsule-automation` ne fournit pas
  encore ces variantes : l’entrée `orientation` ne pilote que le mode de grille
  `derived`. Implémenter d’abord le plan Editor dans `capsule-automation`, puis
  adapter le builder Elcé ; ne pas contourner ce manque par des règles de layout
  locales dans Elcé.
- La durée particulière appartient à l’entrée de séquence du Carousel, car
  elle règle le temps de présentation dans ce conteneur et non le contenu
  intrinsèque de la carte. Le service de distribution Capsule reste le seul
  circuit de résolution temporelle.
- Acceptation exécutée le 6 octobre 2026 : créer, éditer, supprimer,
  réordonner et déplacer un BDC Carte ; conserver ses champs et média parmi
  les quatre layouts ; lire dans le player en manuel et en automatique. Le
  contrôle Brave vérifie aussi l’ordre persisté dans IndexedDB v3, le
  rechargement, la lecture distincte et le ratio 16:9 à 390 px. Les tests
  couvrent le montage média image dans le player ; aucun fichier média n’a été
  importé pendant le parcours navigateur.
- Acceptation restante pour les variantes d’orientation : dans le player réel,
  vérifier qu’une même carte change le placement de ses zones nommées lorsque
  le ratio largeur/hauteur de son propre conteneur passe de paysage à portrait,
  sur smartphone et ordinateur. Le test ne doit pas dépendre de l’orientation
  physique de l’appareil.
- Décisions acceptées pour le responsive du Carousel, application en attente :
  le ratio largeur/hauteur est celui du cadre du BDC. La réponse de chaque
  layout se traite au cas par cas ; les layouts étagés simples restent tels
  quels, et le layout Texte avec image place l’image sur le côté en paysage puis
  en haut en portrait. Ces placements et leurs variantes responsive sont
  produits par `capsule-automation`; des profils C-A peuvent être ajoutés ou
  complétés selon les besoins. Les vues du Carousel sont bornées au cadre de la
  scène et ne défilent jamais à l’intérieur, dans aucun ratio. L’acceptation
  demande des essais visuels conduits avec l’auteur sur smartphone et ordinateur,
  avec les ratios portrait et paysage.
- Le Carousel doit utiliser une piste de défilement et
  `scroll-snap-type`, avec les propriétés CSS adjointes nécessaires pour
  l’alignement et le comportement responsive. « 100 % » désigne la taille du
  viewport de lecture du Carousel : chaque vue en occupe 100 %, et la piste
  s’étend selon le nombre de vues. La scène et le player exposent cette taille
  avec des unités de viewport mobiles, sans faire dépasser aux vues la zone de
  scène qui leur est allouée. `dvh`/`dvw` suivent le viewport dynamique quand
  l’interface du navigateur mobile se replie ou se déploie ; `svh`/`svw` gardent
  la taille sûre correspondant à l’interface déployée. Choisir le profil au
  cours des essais visuels sur mobile. Chaque vue reste à 100 % du viewport de
  lecture, et seul le conteneur externe défile. Définitions :
  [CSS Values and Units, §6.1.2](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths).
- `scroll-snap-type` sert d’abord au passage manuel par geste, surtout au doigt
  sur mobile. L’approche recommandée est d’abord de l’exprimer dans les profils
  CSS de `capsule-automation`, en préservant les actions, commandes, événements
  et transitions CodPlay qui fonctionnent déjà. Retirer les règles Elcé qui
  feraient doublon, et privilégier le nettoyage à l’ajout. Cette préférence
  n’exclut pas un autre changement si l’analyse montre qu’il est nécessaire ;
  tout écart devra être justifié dans le plan avant implémentation.
  La spécification CSS Scroll Snap autorise le défilement libre à l’intérieur
  d’une zone de snap plus grande que son viewport, ce qui ne convient pas à la
  contrainte « sans scroll dans ces vues » :
  [CSS Scroll Snap, §5.2.2](https://www.w3.org/TR/css-scroll-snap-1/#snap-overflow).
- Acceptation restante pour le Carousel responsive : dans le player réel,
  vérifier le snap tactile, le respect du cadre et l’absence de défilement
  intérieur dans les orientations portrait et paysage. Vérifier aussi que les
  commandes et transitions existantes gardent leur comportement. Les profils
  CSS doivent être éprouvés visuellement avec l’auteur sur smartphone et
  ordinateur ; ces essais ne sont pas encore validés. Si le rendu révèle un
  conflit fonctionnel, arrêter et revoir la spécification avant d’ajouter une
  logique d’exécution.
- `npm run typecheck --workspace=@codplay/elce` réussit ; les 140 tests Elcé
  passent dans 20 fichiers ; `npm run build --workspace=@codplay/elce` réussit
  avec l’avertissement existant sur un chunk JavaScript supérieur à 500 kB.
  L’application Elcé n’expose pas de commande Seek distincte ; cette tranche
  conserve le circuit temporel Capsule existant et n’ajoute pas de contrôle de
  recherche temporelle.
- Le détail du modèle v3, des relations parent/enfant, des layouts et des
  preuves figure dans la [spécification du BDC Carousel](../specs/carousel-bdc-spec.md),
  la [spécification du modèle de document](../specs/document-model-spec.md) et
  la [spécification du builder Flux](../specs/flux-scene-builder-spec.md).
- Les documents v1/v2 ne sont pas migrés. Le chemin actuel rejette leur
  réhydratation ; `main.tsx` journalise l’erreur, l’éditeur reste sur son
  document initial en mémoire, la persistance n’est pas attachée et
  l’enregistrement IndexedDB antérieur reste intact. Le parcours avec nouveau
  document v3 est vérifié, mais le comportement de démarrage face à cet ancien
  enregistrement attend la réponse à la question posée le 6 octobre 2026 :
  réinitialiser automatiquement en v3 vierge ou conserver et bloquer jusqu’à un
  effacement manuel. Ne pas déclarer la tranche terminée avant ce choix et sa
  vérification.

## Page Diapo — décisions et tranche active

- Décision acceptée le 6 octobre 2026 : quand une Diapo contient un BDC
  Carousel, celui-ci reste propriétaire de l’ordre et des durées de sa séquence
  de BDC Carte. Une nouvelle Diapo propose le Carousel comme BDC par défaut,
  avec sa première Carte selon le défaut déjà configuré. Une Diapo contient un
  seul BDC direct : l’auteur peut supprimer le Carousel et le remplacer par le
  BDC Question/Quiz existant ou par le même BDC Carte que celui du Carousel,
  utilisé seul. La Carte autonome conserve son modèle, ses layouts et ses
  champs. Aucun empilement, overlay ou autre circuit de composition n’est
  ajouté.
- Le Carousel garde seul son modèle de séquence temporisée et sa lecture. Une
  proposition à évaluer plus tard consiste à créer un BDC séquence spécialisé
  capable d’enchaîner plusieurs types existants dans une même présentation
  (par exemple vidéo, Question, puis Résultat et explication). Ce BDC n’est ni
  décidé ni implémenté dans la tranche Diapo.
- Convention acceptée le 6 octobre 2026 : dans l’interface, les types sont
  nommés « Page » et « Diapo ». Le code conserve les types internes `flux` et
  `diapo` ; `Page` désigne le type utilisateur correspondant à Flux. Aucun
  renommage de modèle n’est requis à ce stade.
- Exigence responsive acceptée le 6 octobre 2026, application et arbitrage
  visuel en attente : quand le conteneur de lecture est portrait, le Carousel
  vise à occuper toute la scène, qu’il se trouve dans une Page ou une Diapo.
  Dans un conteneur paysage, le plein écran ne s’applique qu’à la Diapo ; le
  Carousel d’une Page garde son cadre de contenu. Il reste à comparer deux
  rendus : inversion du ratio choisi (par exemple 16:9 vers 9:16) et adaptation
  du contenu à la taille disponible. Ces comportements ne sont pas équivalents :
  à 350 px de large, un cadre 9:16 mesure environ 622 px de haut et ne remplit
  pas un viewport portrait de 1016 px.
- Vérification Brave du 6 octobre 2026 sur la preview existante de 5175 : dans
  un viewport de 442 × 1016 px, le Carousel de Page garde son ratio 16:9 ; son
  cadre mesure 350 × 197 px. Le builder passe le ratio choisi en style inline.
  `AutoCapsule` n’utilise `orientation` que pour dériver les grilles de type
  `derived` ; le Carousel force une grille 1×1. La génération CSS actuelle ne
  produit pas de variante `@container (orientation: ...)`, et le layout Texte
  avec image reste en deux colonnes. Ni l’inversion du ratio ni l’adaptation
  portrait demandée ne sont donc implémentées. L’orientation des zones nommées
  reste suivie dans le plan actif Capsule Automation ci-dessus ; ne pas ajouter
  de règles locales parallèles dans Elcé.
- Modèle temporel accepté le 6 octobre 2026 : la séquence temporisée des BDC
  Carte est portée par le BDC Carousel enfant. Ce choix fixe le parent des
  cartes, le contenu initial et le circuit de lecture ; il ne restreint pas les
  autres BDC page de la Diapo.
- Décision appliquée et vérifiée le 6 octobre 2026 : la progression
  de page reste globale et appartient à Sighty, selon les règles définies par
  l’application pour toutes les pages. À la fin fonctionnelle d’une Diapo, la
  scène publie exactement l’événement de fin des Pages Flux :
  `elce:page:finished`, visibilité `public`, données `{ pageId }`. Sighty réutilise
  son action existante pour réévaluer l’accès à « Page suivante ». Cet événement
  ne déclenche pas lui-même la navigation. `scene:end` et `sequence:end` gardent
  leur sémantique CodPlay distincte et ne servent pas au déverrouillage de page.
- `sequence:end` est le signal technique distinct indiquant que CodPlay a
  terminé la lecture de la séquence. Le player arrête sa lecture, termine son
  cycle et nettoie ses captures actives ; l’occurrence reste montée et devient
  « prête au démontage ». CodPlay ne détruit ni l’instance, ni le montage, ni
  ses ressources : Sighty garde la décision de les démonter. Voir la
  [spécification Engine/Player CodPlay](../../codplay/specs/engine-player-v2-spec.md)
  et la [spécification Sighty](../../sighty/specs/authoring-library-spec.md).
- Décision du 6 octobre 2026 : pour une Diapo Quiz, l’événement commun
  `elce:page:finished` est envoyé après validation de la réponse, quelle que soit
  sa justesse. « Page suivante » se déverrouille alors ; la scène reste montée
  et le Quiz continue de s’afficher.
- Règle appliquée et vérifiée le 6 octobre 2026 : chaque type de BDC Diapo
  publie le même événement public `elce:page:finished` avec `{ pageId }` au
  moment où sa fin fonctionnelle est atteinte. La Carte autonome le publie dès
  son affichage ; le Quiz après validation ; le Carousel quand sa dernière
  vue apparaît. Sighty réutilise son action existante. Aucun changement
  CodPlay n’est requis. Voir la [spécification Diapo](../specs/diapo-scene-builder-spec.md).
- Travail appliqué et vérifié le 7 octobre 2026 : les markup Elcé emploient les
  commentaires `<!-- data-part="…" -->` comme ancres CodPlay d’insertion. Un
  commentaire remplace l’hôte vide ; lorsqu’un conteneur porte une fonction
  sémantique ou visuelle, il reste en place et reçoit le commentaire. Les
  éléments texte vides en doublon sont retirés afin que le perso inséré soit
  lui-même le titre, le paragraphe ou le pied de carte. Le preset Question ne
  garde pas de conteneur vide dédié à ses contrôles de validation. Les 158 tests,
  le typecheck et le build Elcé passent ; Safari MCP vérifie le montage d’une
  image de Carousel dans une Diapo par la composition réelle Sighty/CodPlay et
  une console sans erreur ni avertissement. Les conteneurs nécessaires au rendu
  (cadres, grilles, régions sémantiques et contrôles) restent présents.
- Changement implémenté et vérifié le 7 octobre 2026 — **DOM du Carousel Diapo** :
  la région `content` du layout et son slot sont une seule `section` portant les
  attributs et classes de la région ; la racine du Carousel Diapo réunit le
  layout, le cadre, la grille Capsule et le `scroll-container` observé, sans
  hôte Diapo ni wrappers `frame`/`completion-root` supplémentaires. Les cartes
  ciblent cette racine directement par son ID de perso. La racine Photo reste
  présente et porte les classes de la vue (l’`article` extérieur est retiré
  pour ce cas) ; elle pourra évoluer vers `<picture>` avec légende. Le
  conteneur vidéo peut accueillir des éléments `<track>`. Le BDC Carte qui porte
  le marqueur final reste présent, ainsi que le conteneur média CodPlay et
  `img.cp-img-inner` requis par le composant `img`.
  Acceptance vérifiée : Safari MCP observe cinq éléments entre la région de
  contenu et l’image, son chargement, le changement de carte par les points,
  une seule vue visible, la grille en deux lignes et une console sans erreurs.
  Les tests player vérifient le signal de fin, la chaîne de six éléments au
  maximum et le replay A → B → A : structure et source de l’image identiques au
  retour, première carte réactivée. Les parcours Flux et Carte/Question Diapo
  sont couverts par la suite Elcé (22 fichiers, 160 tests réussis) ; typecheck
  et build passent. Le build conserve son avertissement existant de chunk
  supérieur à 500 kB. Voir les preuves dans les spécifications du
  [builder Diapo](../specs/diapo-scene-builder-spec.md) et du
  [Carousel](../specs/carousel-bdc-spec.md).
- Revue transversale acceptée le 7 octobre 2026 — **structure DOM des BDC,
  Fini** : seuls restent les éléments HTML qui remplissent une fonction
  vérifiée (sémantique, mise en page/cadrage, interaction ou montage CodPlay).
  Les parts de montage seules sont des commentaires. Les contenus texte
  facultatifs vides ne produisent pas de perso ni de balise ; un hôte Question
  n’est présent que si son titre ou son illustration existe. Le paragraphe de
  retour du Quiz reste un perso caché `aria-live`, car CodPlay y affiche le
  résultat après validation. Les branches et titres du BDC Résultat, le
  formulaire/fieldset, les médias, grilles, cadres de ratio et boutons gardent
  leur rôle. Le wrapper `body` de Section est la frontière contractuelle du HTML
  Tiptap et reste en place. Le wrapper Photo reste disponible pour un futur
  `<picture>`/une légende ou des `<track>` vidéo. Le wrapper `frame` du Carousel
  Flux a été retiré : le commentaire d’insertion Capsule suffit et la grille
  garde Capsule et navigation comme enfants directs ; les règles CSS dédiées à
  l’ancien wrapper et ses classes obsolètes du root Diapo ont aussi été
  retirés. Le preset `Message`, qui
  n’était ni sélectionnable ni pris en charge par le builder, a été retiré ; la
  configuration contient maintenant seulement les quatre layouts Carte
  contractuels et les presets consommés par les autres BDC. Les tests vérifient
  les sorties vides et remplies, et les variantes Flux/Diapo. 22 fichiers de
  tests (163 tests), typecheck et build passent. Safari MCP vérifie une vraie
  composition Sighty/CodPlay du Carousel Flux : Capsule et `nav` sont enfants
  directs de sa racine, aucun wrapper `frame` n’existe, le ratio calculé est
  16:9, l’image charge et les points sélectionnent les deux vues. Le build garde
  son avertissement de chunk supérieur à 500 kB. Les preuves détaillées sont
  dans les spécifications [Question](../specs/question-bdc-spec.md),
  [Résultat](../specs/chapter-evaluation-spec.md), [Carte/Carousel](../specs/carousel-bdc-spec.md),
  [Flux](../specs/flux-scene-builder-spec.md) et [Diapo](../specs/diapo-scene-builder-spec.md).
- Acceptation du 6 octobre 2026 : Brave DevTools sur le serveur de référence
  5175 vérifie les trois chemins avec une page suivante : la Carte autonome
  déverrouille « Suivant » dès son affichage, le Quiz après validation et le
  Carousel manuel à deux vues après sélection de la dernière vue. Le Carousel
  garde le bouton verrouillé avant cette sélection. Les parcours restent sur
  la scène Diapo et ne produisent pas d’erreur console. Un test player vérifie
  le nom exact `elce:page:finished`, la visibilité publique, `{ pageId }` et
  l’absence de `scene:end` pour le Carousel. Les tests ciblés (30/30) et le
  typecheck passent. La frontière de compilation CodPlay est respectée par un
  `scroll-container` dans la story Carousel ; aucun changement CodPlay ni
  relais Elcé distinct n’est nécessaire. La tranche reste en cours pour le
  comportement vocal décrit ci-dessous.
- La voix facultative appartient à la page Diapo : elle démarre au lancement et
  s’arrête en quittant la page. En mode automatique, sa durée peut fournir la
  durée totale répartie entre les vues ; les durées auteur par vue la remplacent
  pour les vues concernées. Le mode manuel remplace les avances temporisées sans
  boucler ni couper la voix avant la sortie de la page.

### Décision acceptée — un point du Carousel arrête l’automatique

Cliquer sur un point sélectionne sa Carte et bascule la lecture de cette
instance du Carousel en mode manuel. La progression temporisée s’interrompt
immédiatement ; une Carte ou un point automatique ne doit plus redevenir actif
après la sélection. Le clic suivant sur un autre point reste fonctionnel.
Cette bascule est propre à la lecture en cours : elle ne modifie pas le réglage
`playbackMode` enregistré dans le document.

**Cause constatée :** le strap ciblait la track `${pageId}-${bdcId}` créée par
le builder Carousel. `buildDiapoScene` remplace ensuite l’identité de sa story
par `${pageId}-diapo-page` ; CodPlay n’a donc jamais désactivé la track effective
de cette Diapo. Le test Flux passait, car son identité de story n’est pas
remplacée. Brave sur la vraie Page B a reproduit la double vue après le clic.

Le builder Carousel reçoit l’identité finale de story fournie par son parent
quand il est incorporé. Le strap envoie `track:deactivate` à cette même track,
en gardant les sorties de sélection dans le circuit strap existant. Ne pas
ajouter de minuteur, d’état React ou un circuit de progression parallèle.

**État : décision acceptée, correctif implémenté et vérifié.** Un test player
Diapo a d’abord reproduit le doublon ; après correction, il vérifie qu’une
sélection manuelle résiste au passage automatique suivant et qu’un clic
ultérieur reste fonctionnel. Les suites composition player, builders Diapo et
Flux passent (47 tests), ainsi que le typecheck, le build et `git diff --check`.
Brave charge en lecture seule le document réel du Projet 1 et lance la
composition Sighty/CodPlay sur Page B : après un clic sur la vue 5, la
prochaine échéance laisse une seule vue active ; le clic suivant fonctionne.
La révision serveur reste 93 et le mode enregistré reste `automatic`.

Le serveur local avait figé ses assets au démarrage (`watch: false`) ; il a été
redémarré uniquement sur 5175/5181 pour servir le changement. L’auto-review a
bloqué le clic sur le bouton d’interface « Prévisualiser » comme pouvant
modifier le projet ; la vérification Brave a donc construit le player réel en
mémoire à partir du document serveur, sans action d’écriture. Recharger une
fenêtre d’éditeur déjà ouverte est nécessaire pour qu’elle récupère les assets
du serveur redémarré.

## Suite différée après le BDC Carousel

- La scène Questions-Réponses complète, avec son comportement player et ses
  règles de correction, sera traitée dans une tranche ultérieure.
- Les commandes pause/reprise locale du Carousel sont reportées hors du POC.
- Le bouclage sans fin est remplacé par le nombre fini de répétitions réglé dans
  la tranche Carousel. La lecture s’arrête après le dernier passage.
- Le réglage fin des durées auteur par vue restera dans le circuit existant
  Capsule Automation ; il ne bloque pas l’édition et l’insertion du BDC
  Carousel dans le POC.

## Évolution acceptée — BDC disponibles au catalogue

Le panneau « Blocs disponibles » doit pouvoir conserver tous les types de BDC
du document, pas seulement les Cartes image/vidéo actuellement proposées comme
ancres dans une Section. Cette whitelist d’ancrage est une restriction du
circuit existant, distincte du placement général au catalogue. La Carte est
également le premier BDC élargi à l’insertion dans le flux d’une Section, selon
le cadrage ci-dessous.
Le déplacement vers le catalogue et le retour vers une page doivent réutiliser
les commandes documentaires existantes, conserver l’identité et le contenu du
BDC, et respecter les contraintes de type de page et de parent.

**Décision acceptée — geste de retour au catalogue :** la poignée de placement
du BDC posé est la source de glisser-déposer vers l’onglet « Blocs disponibles ».
La colonne ne présente pas de liste « Blocs dans la page » ni de bouton
d’archivage par BDC. Le dépôt réutilise la commande de retour au catalogue
existante ; le retour d’une ancre reste sur son circuit dédié.

Déplacer un BDC conteneur conserve ses enfants dans la même relation : les
Cartes ancrées restent dans leur Section et les Cartes de lecture restent dans
leur Carousel. Le catalogue affiche le BDC conteneur comme une seule entrée ;
il ne détache ni ne duplique ses enfants.

**État : décision acceptée, réalisation en cours.** L’UI et les commandes
utilisent `bdc.remove`, `bdc.move` et `bdc.anchor.attach` existants ; le contrôle
de compatibilité de placement appelle le même `applyDocumentCommand`. Les tests
ciblés couvrent les cinq types racines, la conservation des enfants, les Cartes
Texte court sans média, les trois aperçus Carte hors Photo, et le glisser d’une
Carte entre catalogue et page dans le workspace Remix. Les 62 tests ciblés,
`typecheck`, `build` et `git diff --check` passent. Le dernier passage de la
suite complète a échoué sur un test SQLite qui tente d’ouvrir un port local
(`EPERM`).

Le 9 octobre 2026, Brave confirme sur 5175 l’absence du groupe « Blocs dans la
page » et affiche l’instruction de glisser la poignée de placement vers
« Blocs disponibles ». Le parcours complet de retour, l’ancre Carte et la
persistance restent à valider ; ne pas toucher à 5173.

### Contour de la poignée de placement — décision acceptée

La poignée de déplacement des BDC reprend le bouton contouré
`.elce-bdc-icon-button`, comme les poignées de réordonnancement des réponses
Quiz. Son emplacement réserve assez d’espace pour que le contour ne chevauche
pas le BDC. CSS appliqué le 9 octobre 2026 ; contrôle visuel Brave en attente.

## Outillage de développement accepté — HMR Remix

`npm run dev:elce` utilise le superviseur `node-hmr` et le canal HMR Remix,
avec surveillance des sources et des assets. Toute mise à jour non vide, CSS
ou JavaScript/JSX, recharge automatiquement l’onglet. Dans l’éditeur Elcé,
l’acceptation en place du module racine avait laissé le DOM inchangé dans
Brave ; le rechargement complet rend chaque changement visible et restaure
l’état par la persistance et la synchronisation existantes.

L’interface reste le seul serveur applicatif public sur 5175 et l’API appariée
reste sur 5181. Le canal SSE interne peut utiliser un port éphémère ; il ne
démarre pas un second serveur d’interface et ne doit pas utiliser 5173. Le
serveur Vite en middleware continue uniquement à charger les modules du serveur,
sans servir l’interface ni ouvrir un serveur HMR Vite.

**État : implémenté et vérifié dans Brave.** Une modification JSX temporaire
devient visible après rechargement automatique sans redémarrage ; une
modification CSS temporaire suit le même circuit. Après les deux rechargements,
Projet 1 reste ouvert et l’état revient à « Synchronisé ». Les modifications
temporaires sont retirées. L’interface reste sur 5175, l’API sur 5181 et aucun
serveur n’est ouvert sur 5173.

### Indications de préchargement en développement — décision acceptée

Le navigateur avertit que des dizaines de modules annoncés par
`entry.preloads` ne sont pas utilisés dans les secondes après le chargement.
La réponse HTML de développement n’émettra pas ces `modulepreload` : le client
chargera les modules à leur import. Le build de production conservera les
préchargements. Le log de connexion HMR reste disponible ; aucune interception
globale de la console n’est ajoutée.

- [x] Omettre `entry.preloads` du HTML en développement et les conserver en
  production.
- [x] Vérifier les deux rendus par test, puis typecheck et build Elcé.

## Évaluation initiale — BDC insérables dans le flux d’une Section

Le stockage au catalogue et l’insertion dans le texte sont deux capacités
distinctes. Cette première évaluation répondait au cas citation/exergue ; ses
résultats décrivent la situation actuelle. Pour les compositions parent/enfant
traitées ici, les seuls nouveaux placements retenus dans cette tranche sont
ceux du BDC Graphe dans une Section et dans un Carousel.

| BDC | Pertinence pour une insertion dans le texte | Décision de cadrage |
| --- | --- | --- |
| Carte | Convient aux citations et exergues ; les layouts de Carte existants conservent leur usage. Texte court est le cas d’usage initial. | Acceptée pour l’insertion dans le flux, en réutilisant le BDC Carte, son layout, ses champs, ses médias, les commandes d’ancre existantes et la projection Flux. L’aperçu auteur doit rendre le contenu du layout choisi. Aucun type « citation » séparé. |
| Section / Texte | Une Section dans une autre Section introduirait un éditeur de flux imbriqué et une composition récursive. | La restriction actuelle reste en place ; aucune nouvelle composition Section/Section n’est décidée dans cette tranche. |
| Carousel | Une séquence à vues et commandes dans le flux aurait une hauteur et un comportement de lecture distincts. | L’insertion actuelle du Carousel dans une Section ne change pas. Le BDC Graphe comme enfant du Carousel est accepté séparément. |
| Question | Le Quiz porte une validation, une réponse et des conditions de progression attachées à une page. | Les placements actuels restent en place ; aucune insertion de Question dans une Section n’est décidée dans cette tranche. |
| Résultat d’évaluation | Ses branches dépendent de l’état d’Évaluation Sighty et de l’admission de la page de résultat. | Le contexte actuel du chapitre Évaluation reste en place ; aucune nouvelle composition n’est décidée dans cette tranche. |

## Principe accepté — composition ouverte des BDC

Lorsqu’un nouveau placement ou une nouvelle composition est étudié, viser le
plus grand nombre de types compatibles. Une whitelist d’interface peut décrire
les types proposés ; elle doit inclure les compositions compatibles, en
excluant celles qui sont structurellement, sémantiquement ou fonctionnellement
contradictoires. Ce principe n’ouvre pas à lui seul les placements déjà
restreints : les contrats actuels restent la base tant qu’une évolution
explicite n’est pas décidée.

Le BDC Graphe est accepté comme enfant de Carousel ; cette composition est
maintenant implémentée et vérifiée dans Brave par le circuit documentaire,
l’éditeur et le builder Carousel existants. Son contrat vérifié figure dans la
[spécification Carousel](../specs/carousel-bdc-spec.md). Le placement Graphe
dans une Section est également implémenté et vérifié ; ses contrats et preuves
figurent dans les spécifications du
[Graphe](../specs/statistical-graph-spec.md) et des
[ancres](../specs/anchor-spec.md).

Le chantier actif rend tous les layouts Carte existants disponibles comme
ancres. Pour rédiger une citation ou une exergue, le layout Texte court est le
cas de référence. L’aperçu Tiptap affiche les champs et le média compatibles
avec le layout choisi ; le builder Flux et le player gardent leur projection
Carte existante. Le futur projet « Graphe de données » pourra préciser des
types ou usages supplémentaires ; le BDC Graphe actuel est défini
dans sa [spécification dédiée](../specs/statistical-graph-spec.md).

Le réglage permettant de décaler la Carte par rapport au flux grâce à des
marges adaptées est reporté à une évolution ultérieure. Son comportement
n’est pas formalisé et ne fait pas partie de la première extension d’ancre.

## Fonctionnalité à faire — copier, couper et coller un BDC

Ajouter ultérieurement les commandes auteur copier/couper/coller d’un BDC.
Cette fonctionnalité devra définir l’identité créée par la copie, le traitement
des ressources média partagées et celui des BDC composites avant son
implémentation. Elle reste dans la liste des fonctionnalités à faire et ne fait
pas partie du changement de catalogue en cours.

Le réemploi de contenus entre projets et mods doit être coordonné avec ce
contrat de copie, selon D5 du
[plan de reconfiguration](../mods/plan/2026-10-20-elce-mods-reconfiguration-plan.md).

À coordonner avec Undo/Redo : Copier seul change le presse-papiers, pas le
document ; Couper et Coller entraînent des mutations documentaires. La tranche
Undo/Redo devra pouvoir annuler et rétablir les mutations effectivement
commitées par Couper/Coller, une fois leurs règles d’identité et de placement
fixées. Le fait de livrer ces fonctions dans des tranches distinctes est
compatible avec ce lien ; l’atomicité exacte de Couper reste à définir.

## Fonctionnalité à faire — annuler et rétablir les modifications

Construire un système auteur d’annulation et de rétablissement à travers la
façade et l’acteur XState déjà utilisés par l’éditeur. L’objectif porte sur les
modifications du document ; les changements de sélection, de projet, de
synchronisation et d’accès ne sont pas des actions éditoriales à annuler.

**Priorité produit et granularité signalées par l’auteur :** après le POC,
l’éditeur vise un public amateur ; Undo/Redo est essentiel pour sécuriser son
usage. Le calendrier de cette tranche reste à décider, avec une cible avant
l’ouverture au grand public. Une action annulable peut correspondre à l’échelle
du contexte édité : une portion de texte, la suppression d’un BDC ou le
déplacement d’une page. L’historique local de Tiptap peut gérer les actions de
texte ; l’historique documentaire gère les commandes auteur hors de cette
surface. Il faut distinguer leur propriétaire même quand deux actions
produisent une commande documentaire de même forme, et vérifier leur
cohabitation dans une suite d’actions. La sélection de texte/caret nécessaire
pour poursuivre l’édition après une annulation n’est pas elle-même une mutation
du document ; il reste à décider si Tiptap la restaure avec l’action texte.

**Exigence du cahier des charges initial :** l’Undo est hors du POC, mais dès
la construction l’application doit utiliser commandes et machine d’état afin
que l’historique puisse être ajouté ensuite sans refaire le circuit de
modification. Cette tranche doit donc étendre la façade et les commits existants ;
elle ne doit pas introduire une seconde voie d’écriture. Le point à construire
est la capture d’une action éditoriale cohérente au moment où le contrôleur l’a
effectivement commitée.

**Évaluation au 9 octobre 2026 :** Elcé déclare XState `^5.32.2`. Le contrôleur
possède le document et applique `DocumentCommand` par `applyDocumentCommand` ;
les façades transmettent les actions au même acteur. Le modèle produit de
nouvelles valeurs de document, mais aucune pile d’historique ni commande inverse
n’existe. Les commandes décrivent surtout l’opération vers l’avant : certaines
ne contiennent pas l’état nécessaire pour reconstruire leur inverse, notamment
les suppressions et `media.merge`. Les changements Section et imports média
passent d’abord par la file asynchrone du contrôleur ; l’historique devra donc
retenir le commit réussi, pas l’intention encore en attente. `media.merge`
retire les anciennes métadonnées et la persistance supprime alors les blobs
correspondants : restaurer le seul JSON ne suffirait pas à restaurer le média.

XState permet de conserver un historique dans le `context` de cet acteur par
ses transitions et `assign`. Les history states du statechart mémorisent une
branche d’état active, pas les versions antérieures du document. Un autre
précédent du projet éditeur décrit un acteur historien séparé, relié à la
façade, qui conserve les snapshots au commit ; une commande peut former une
entrée et une transaction en grouper plusieurs. Le cahier des charges initial
d’Elcé exige la façade unique et la machine d’état ; il ne fixe pas le
propriétaire de l’historique.

La fonction
`undoRedo` documentée par Stately appartient à `@xstate/store` et à son API
`createStore` ; ce paquet n’est pas déclaré par Elcé. Stately documente aussi
`fromStore`, qui rend une logique Store compatible avec un acteur XState.
Références : [XState Store](https://stately.ai/docs/xstate-store) et
[extension Undo/Redo](https://stately.ai/docs/xstate-store/undo-redo).

**Orientation retenue le 9 octobre 2026 :** employer `@xstate/store` comme
propriétaire unique du document et de son historique, intégré à la machine XState
existante. La raison donnée est la compatibilité avec l’écosystème XState. Le
document `ElceDocument` en mémoire peut être transféré au Store comme état
initial ; il ne doit ensuite pas rester dupliqué dans le contexte du contrôleur.
Le contrôleur continue d’orchestrer l’accès au projet, les opérations asynchrones,
la persistance et la synchronisation ; il consulte ou fait évoluer le document
par le Store. Ce choix implique de rerouter les lectures, commits, sélecteurs,
éditeurs, preview et raccords de persistance/synchronisation vers cet unique
propriétaire. C’est une refonte réelle, acceptée comme coût de l’orientation ;
elle ne doit pas créer de second document de référence.

La documentation Store décrit l’historique par événements, l’historique par
snapshots, le regroupement par transaction et l’exclusion d’événements. La
représentation reste à valider avec les commandes concrètes Elcé : notamment,
une mise à jour documentaire qui n’entre pas dans l’historique doit quand même
rester présente lors d’un Undo/Redo. Le rejeu doit aussi préserver les bases
installées depuis le serveur et ne pas répéter les effets de persistance ou
d’import. La stratégie ne sera choisie qu’après un essai d’intégration avec ces
cas et l’historique Tiptap.

Pour Tiptap, le contrat visé est que son historique traite les éditions de
texte. Ces mutations continuent d’être commitées dans le Store documentaire pour
que l’aperçu, la sauvegarde et les autres vues voient le même document ; elles
ne doivent pas devenir une seconde entrée d’historique documentaire. À l’inverse,
un Undo/Redo documentaire ne doit pas être exécuté en plus par Tiptap pour la
même transaction. La classification doit tenir compte de l’origine et du
propriétaire d’une action, pas seulement de l’égalité de deux commandes.

**Étapes de cadrage et de construction :**

1. **Intégrer `@xstate/store` sans second propriétaire.** Ajouter et vérifier
   l’intégration Store comme acteur de la machine XState existante, puis transférer
   le document courant dans cet acteur. Retirer la copie de `ElceDocument` du
   contexte du contrôleur et raccorder les mêmes façades, lectures, sélecteurs,
   persistance et synchronisation au Store. Le contrôleur reste propriétaire de
   l’orchestration du projet et des opérations asynchrones.
2. **Classer les actions par propriétaire d’historique.** Tiptap possède Undo et
   Redo des éditions de texte ; le Store possède l’historique des commandes
   documentaires des autres surfaces. Chaque mise à jour Tiptap continue de
   mettre à jour le document canonique, mais n’est pas comptée deux fois.
   Définir le routage des commandes Undo/Redo selon le contexte d’édition et
   vérifier les séquences qui alternent texte et opérations structurelles.
   Les changements de sélection, projet, accès et statut de synchronisation ne
   sont pas des actions auteur.
3. **Centraliser la capture au commit réussi.** Les commandes directes et `page.create`
   sont appliquées dans le contrôleur ; Section et imports média passent par le
   worker asynchrone. Une intention de façade ou `Actor.send` ne suffit pas pour
   enregistrer l’historique ; les workers peuvent échouer. Le Store ne capture
   qu’après le commit effectif, avec la commande résolue pour `page.create` et
   les imports. Un import annulé avant commit ou échoué ne modifie pas le
   document et ne crée aucune entrée Undo/Redo ; il ne peut donc pas être
   rétabli. Décider si un import réussi est annulable. Undo/Redo attend la fin de
   `documentChanges` pour préserver l’ordre.
4. **Choisir et prouver la représentation Store.** Comparer le rejeu d’événements
   et les snapshots de `@xstate/store` avec les commandes normalisées, les
   événements exclus et les bases de document installées par le serveur. Vérifier
   que l’exclusion d’une mise à jour Tiptap ne la fait pas disparaître au rejeu,
   et qu’une nouvelle action après Undo vide la branche Redo. Si un essai ne
   préserve pas le document canonique, corriger le modèle d’intégration avant de
   choisir cette stratégie.
5. **Fixer regroupement et contexte restauré.** L’historique Tiptap regroupe ses
   transactions texte selon son propre contrat ; l’historique Store regroupe les
   commandes documentaires en actions compréhensibles. Vérifier les alternances
   entre texte et commandes structurelles afin qu’une action ne soit jamais
   annulée deux fois et que le routage Undo/Redo reste prévisible. Restaurer le
   caret/la sélection texte avec Tiptap si son historique le permet sans créer
   d’action documentaire. Définir aussi si Undo restaure la sélection de page
   ou de BDC, la limite des historiques et leur conservation après rechargement.
6. **Garantir la restauration des médias.** Les snapshots du document ne
   contiennent pas les octets conservés dans IndexedDB. La suppression d’un BDC
   conserve normalement son média, mais `media.merge` et le retrait de
   métadonnées média peuvent supprimer un blob. Si un import réussi est annulé
   puis rétabli, garder ses octets jusqu’à l’expiration de la branche Redo sans
   supprimer un média partagé. Distinguer ce cas d’un import annulé avant
   commit, qui n’a rien à rétablir.
7. **Brancher l’interface et valider le circuit complet.** Exposer Undo/Redo
   documentaire par la même façade, avec état activé/désactivé dérivé du Store
   et de l’accès d’édition. Quand le focus est dans Tiptap, vérifier le transfert
   des commandes à son historique. Une restauration documentaire est un nouveau
   commit : elle suit la persistance locale et la synchronisation ordinaires,
   qui créent une nouvelle révision serveur ; elle ne réécrit pas l’ancienne.
   Couvrir texte, caret, Section et Cartes ancrées, BDC composites, déplacement
   de page, imports échoués/annulés et réussis, blobs, limites de projet/révision,
   puis le parcours navigateur réel.

**Critère d’acceptation à établir :** `@xstate/store` est l’unique propriétaire
du document et de l’historique, sous l’orchestration XState existante. Les
actions documentaires Undo/Redo passent par les façades et alimentent la
persistance/synchronisation courante. TipTap annule ses mutations texte sans
entrée documentaire en double ; les alternances de texte et de commandes
structurelles restent prévisibles. Un import annulé ou échoué avant commit ne
crée aucune entrée ; les opérations réussies couvertes par Undo/Redo préservent
leurs métadonnées et octets média. Les identifiants, placements et BDC composites
sont restaurés. Une annulation synchronisée crée une nouvelle révision serveur ;
une révision serveur effectivement installée et un changement de projet ne
rejouent pas un ancien historique. La durée de conservation après rechargement,
les frontières serveur, le statut Undo des imports réussis, le caret et la
rétention des blobs doivent être décidés avant de fermer la tranche.

## Extension Sommaire profils et contraintes

**Statut : En cours — intégration Elcé terminée ; 345 tests, typecheck et build
passent. Le parcours navigateur réseau et sa validation mobile restent à faire.**

- [Plan Sommaire et profils](2026-10-14-elce-sommaire-profils-plan.md) : étapes,
  acceptation et points restant à vérifier.
- [Spécification Sommaire et profils](../specs/summary-profile-spec.md) :
  comportements intégrés et vérifiés.
- [Notes d’enquête](../notes/2026-10-14-sommaire-profils-contraintes.md) et
  [étude des raccords](../notes/2026-10-14-sommaire-profils-etude-raccords.md) :
  exploration et raisons des choix.

Qualifications dynamiques, variantes grammaticales, ACL et lot d’utilisateurs
restent différés. Les formats internes intégrés sont disponibles pour relecture
auteur ultérieure.

## Export SCORM

**Statut : En cours — réalisation du dossier SCORM autorisée ; intégration et
validation du package à poursuivre selon le plan dédié.**

- [Spécification session SCORM](../specs/scorm-session-spec.md) : reprise,
  écritures CMI et raccords vérifiés dans le player.
- [Plan d’export SCORM](2026-10-21-elce-scorm-export-plan.md) : versions,
  reprise de consultation, classe métier, appels depuis les actions de page
  Sighty, commande et dossier de package SCORM distincts, réutilisation de
  l’export existant sans reconfiguration, codec, session et raccords au player
  réalisés ; l’export autonome Sighty est disponible et spécifié ; assembleur,
  commande SCORM, lanceur de lecture du paquet et validation LMS restent à
  finaliser.

## Décisions ouvertes

- **Réglages du Carousel quand la colonne centrale est étroite :** la
  spécification actuelle demande une rangée unique. Le contrôle Brave sur
  `localhost:5175` révèle que le contenu des réglages mesure 711 px pour une
  colonne centrale de 615 px à un viewport de 1024 px ; à 390 px, la colonne
  mesure 285 px et le libellé « Durée par vue » est tronqué. La solution reste à
  décider : permettre le retour à la ligne lorsque l’espace manque, ou conserver
  une rangée défilante. Ne pas modifier le code avant mise à jour du contrat.
- Le Carousel pourra être inséré dans un BDC Texte, mais la spécification de sa
  version en séquence l’exclut. Confirmer si cette insertion est requise avant
  la fin du POC ou si elle reste après.
- Vérifier dans Brave DevTools que le cadre, la zone de dépôt et l’aperçu chargé
  respectent les ratios 4:3 et 1:1, et que seule la carte active occupe le
  cadre. La version 16:9 a été vérifiée dans le parcours d’acceptation du
  6 octobre 2026.

Pour finaliser les icônes Image et Vidéo de la barre, préciser si leur action
crée un BDC vide à compléter ou lance le choix du média. Le dépôt direct d’un
fichier ou d’une référence du catalogue dans le texte reste le parcours existant
qui crée ou attache média, BDC et ancre par les commandes.
