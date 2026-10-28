# Elcé — Sommaire, profils et test auteur

Cette spécification décrit les contrats en place pour le Sommaire, la collecte
initiale du profil, les règles de visibilité, les étiquettes et l’état du test
auteur. Les formats du document et de l’état test sont des choix internes que
l’auteur pourra relire séparément.

## Modèle auteur

`LearningDocument` v7 porte un seul objet `data.summary` et une définition
`data.profile` (voir le [modèle de document](./document-model-spec.md)). Le
Sommaire conserve son titre, sa description, son média de
fond, ses options d’affichage dans le menu et à la racine, son niveau de liste,
le mode d’accès aux pages `endpage | free` (`endpage` par défaut), l’accès
permanent et la destination de fin de chapitre. Ses deux présentations
utilisent les mêmes entrées retenues, le titre et la description. La racine est
une destination dédiée, hors de la séquence précédent/suivant.

Le profil sépare les propriétés des champs réellement demandés au lecteur. Une
propriété porte un identifiant stable, un nom interne, un libellé, un type
`text`, `number`, `choice-one` ou `choice-many`, le caractère requis, un défaut
optionnel et des choix à identifiants stables. Les champs du formulaire
référencent ces propriétés par identifiant.

Les règles de Visibilité ciblent un chapitre, une page ou un BDC. Une règle
contient une liste ordonnée de conditions ; chaque ligne associe une propriété,
une comparaison typée et une valeur. Une propriété peut être répétée. Le
connecteur ET ou OU choisi entre chaque paire est enregistré avec la condition
qui le précède ; l’évaluation donne priorité à ET sur OU. La règle locale la
plus spécifique remplace toute la liste héritée : chapitre, page, BDC ancêtre,
puis BDC lui-même. Sans règle locale, la cible hérite de la règle applicable la
plus proche. Une liste locale vide retire la règle et rétablit l’héritage. Les
textes sont comparés sans tenir compte de la casse ni des espaces de bord. Les
conditions de choix acceptent une correspondance au moins. Une valeur absente
ne valide jamais une condition, y compris une différence.

Une règle de chapitre ou de page peut définir `unmetBehavior` à `hide` ou
`lock` ; l’absence de cette valeur signifie `hide`. Quand les conditions
échouent, `hide` retire les contenus concernés de la projection. `lock` garde
le chapitre ou la page visible dans le Sommaire avec un cadenas et bloque son
ouverture. Le verrouillage s’applique aux chapitres et aux pages ; les règles
ciblant un BDC gardent l’effet Masquer.

Les prérequis de lecture visent un chapitre et désignent soit le chapitre
précédent retenu, soit un ou plusieurs chapitres nommés. Ces choix sont
exclusifs. Tous les chapitres nommés doivent être terminés avant l’ouverture de
la cible. Un cycle est refusé et l’erreur contient sa chaîne de chapitres. Une
dépendance explicite vers un chapitre exclu par profil est également refusée à
la construction de la lecture.

Les commandes documentaires valident la définition entière avant de
l’enregistrer. Elles refusent une propriété inconnue, une condition incompatible
ou un changement qui rendrait ses règles invalides. La suppression d’une
propriété référencée est bloquée ; l’éditeur affiche ses usages dans le
Formulaire, les règles, les titres, les champs textuels et les étiquettes
Tiptap.

## Collecte et projection de lecture

La page Profil est une scène Formulaire séparée du BDC Question. Elle collecte
plusieurs valeurs sur la même page, affiche les erreurs de validation ensemble
et n’émet ni correction ni score. Les champs texte, nombre, choix unique et
choix multiple respectent leurs valeurs par défaut et leurs obligations. La
validation réussie transmet le profil au contexte lecteur et lance le Sommaire
racine s’il est activé, sinon la première page retenue.

Chaque changement de champ met à jour les valeurs du contexte lecteur. Les
événements internes du formulaire restent adressés à sa story ; seuls les
événements `PROFILE_CHANGED` et `PROFILE_SUBMIT` remontent au routeur Sighty.
Une soumission valide ouvre d’abord la scène de transition, puis la nouvelle
composition lecteur démarre sur le Sommaire racine ou la première page retenue.

`projectReaderDocument()` construit une projection immuable à partir du
document, des valeurs et de l’activation du profil. Cette projection alimente
les scènes, les entrées du Sommaire, les routes et l’Évaluation. Elle applique
les règles aux chapitres, pages, BDC et enfants de Carousel, retire les pages
qui ne gardent aucun BDC puis les chapitres sans page retenue, et laisse intact
le document auteur. Les ancres pointant vers des enfants masqués sont retirées
de la projection. Désactiver le profil pour le test auteur désactive les
contraintes de profil et de lecture.

Le Sommaire en mode `chapters` affiche les chapitres et garde les pages
autonomes de la racine ; un chapitre ouvre sa première page retenue. Le mode
`pages` affiche les pages dans l’ordre mixte racine/chapitres. Les prérequis
non satisfaits gardent le contenu visible mais verrouillé. Une règle de
Visibilité configurée en `lock` garde aussi sa cible visible, affiche le cadenas
et refuse la route tant que ses conditions échouent. Le retour permanent au
Sommaire ne valide pas la progression de la page courante.
Le réglage global `pageContinuationMode` contrôle l’accès à la suite. `endpage`
conserve le comportement actuel : la page doit être terminée pour utiliser
Suivant ou ouvrir directement une page ultérieure. `free` autorise ces deux
accès sans exiger la fin des pages précédentes. Il conserve les gardes de
Visibilité et les prérequis de chapitre. Les pages de résultat d’Évaluation
restent verrouillées jusqu’à ce que le parcours requis pour leur résultat soit
terminé ; le seuil d’évaluation reste appliqué.
Si le lecteur reçoit une page de départ verrouillée, il ouvre le Sommaire racine
quand celui-ci est activé ; sinon il démarre sur la première page accessible.
Les routes vers le Sommaire racine et la scène de transition Profil ciblent
l’entrée de scène sous le slot contenu, pas le conteneur qui déclare ce slot.

Les champs textuels utilisent `{{profile:<id>}}`. Dans une Section, l’étiquette
est un nœud Tiptap avec `profilePropertyId`, sérialisé en `span`
`data-elce-profile-property`. Le lecteur résout ces références dans les titres
du Sommaire, des chapitres et des pages, et dans les textes des Sections,
Cartes, Questions, Graphes et BDC Résultat. Une valeur absente sans défaut
produit une chaîne vide ; le texte injecté est échappé pour le HTML.

## Configuration et insertion dans l’éditeur

Le panneau latéral droit s’intitule « Contenus ». Son onglet « Profil » apparaît
uniquement lorsqu’une propriété de profil existe et qu’un champ textuel déclaré
compatible a le focus. Les champs simples insèrent `{{profile:<id>}}` à la
sélection ; l’éditeur de Section insère le nœud Tiptap `profileLabel` au caret.
L’identifiant stable de propriété est conservé dans les deux cas. Le panneau
contient l’unique contrôle d’insertion : aucune barre globale ni bouton par
champ ne duplique cette action.

Le bouton « Sommaire » de l’arborescence ouvre les réglages du Sommaire et du
profil. Il partage l’icône Lucide List avec le bouton « Test auteur » de la
popup, qui ouvre les réglages du profil et de la progression du test.
La case « Sommaire dans la navigation » est désactivée tant que la case
« Afficher comme destination racine » n’est pas cochée.

Le contrôle « Image de fond » partage l’interface média du Quiz : sélection ou
dépôt d’un fichier image, dépôt d’une image du catalogue, aperçu et retrait.
L’import utilise la file de changement média existante ; les fichiers identiques
réutilisent la ressource média déjà présente. Le fond accepte uniquement les
images.

Dans l’éditeur auteur, les contraintes sont présentées en deux colonnes. À
gauche, l’arbre reprend l’ordre du scénario : les chapitres contiennent leurs
pages indentées et chaque ligne porte une case à cocher. Cocher ou décocher un
chapitre coche ou décoche aussi toutes ses pages. Une sélection directe de page
garde le chapitre décoché et le marque comme partiel dès qu’au moins une page
est cochée, même si toutes ses pages sont sélectionnées ; le chapitre reste
ainsi une cible distincte des pages. Une contrainte de profil enregistrée après
un clic sur le chapitre s’applique au chapitre et à ses pages ; la règle portée
par le chapitre s’applique aussi aux nouvelles pages. Les prérequis de lecture
ne ciblent que les chapitres cochés. Cette zone ne contient pas d’action
structurelle ni de BDC. Les contraintes BDC déjà
enregistrées restent conservées dans le document sans être éditables dans cette
vue. À droite, les contraintes de profil et les prérequis de lecture partagent un
formulaire. Le groupe Visibilité propose l’effet appliqué quand les conditions
échouent : « Masquer » (défaut) ou « Verrouiller ». Sur grand écran, les panneaux
Sommaire et Contraintes forment une ligne flex et s’étirent à la même hauteur ; sous 700 px, ils s’empilent. Le
formulaire partagé n’ajoute pas de cadre extérieur aux groupes Profil et
Prérequis. Le groupe « Visibilité » est une liste de lignes compactes : chacune
présente propriété, comparaison et valeur sur la même ligne ; un connecteur ET
ou OU apparaît entre les lignes. Une icône retire une condition, une autre en
ajoute une. La colonne du comparateur est plus étroite que celles de la
propriété et de la valeur ; l’icône de suppression reste à droite dans une
colonne compacte. Pour les propriétés à choix, les comparaisons sont affichées
`=` et `≠`. L’éditeur reste désactivé sans cible sélectionnée. Supprimer toutes
les conditions locales restaure l’héritage. Le prérequis est une liste : `-`
(ignorer), « Précédent », puis les chapitres ; « Précédent » est exclusif, et
plusieurs chapitres nommés peuvent être choisis. Une page cochée seule ne reçoit
pas de prérequis. Le bouton unique
« Enregistrer », placé en haut de l’écran, soumet ce formulaire et revient au
scénario si la validation réussit. Il reste utilisable sans cible cochée lorsque
les contraintes n’ont pas été modifiées ; une erreur de validation laisse
l’écran ouvert. Les autres réglages de
présentation et les propriétés sont déjà appliqués par leurs commandes
documentaires. Les contrôles des deux familles restent présents sans cible
cochée, mais le formulaire commun les désactive. Une sélection active les
contrôles de profil si une propriété existe. Les contrôles de lecture ne
s’activent qu’avec au moins deux chapitres et un chapitre sélectionné ; une
page cochée seule ne les active pas. Chaque famille peut rester inchangée
pendant que l’autre est modifiée.

La composition auteur Learning déclare `summaryProfileEditing` activé dans
`src/mods/learning/authoring/learning-authoring-config.ts`. Désactivé, il ne
rend que les réglages généraux du Sommaire ; l’édition des propriétés de profil
et des contraintes disparaît. Les propriétés et règles déjà enregistrées dans
le document sont conservées. Le bouton « Enregistrer » revient au scénario ;
ce choix de composition ne constitue pas une ACL.

## État test auteur et serveur

L’état du test auteur est séparé du document et de son historique. Il contient
un `schemaVersion`, l’activation et la validation du profil, les valeurs
profil, les pages terminées, les réponses Question et les machines
d’Évaluation. Il est rattaché au projet dans une ligne SQLite distincte.

`GET /api/projects/:projectId/test-state` renvoie `{ state }` et un ETag
numérique fort. `PUT` envoie `{ state }` avec `If-Match`; le serveur compare et
incrémente atomiquement la révision puis renvoie l’état et son nouvel ETag. Une
révision périmée reçoit `412 revision_mismatch` sans écraser la valeur serveur.
Cette révision est indépendante de celle du document.

La preview réseau de l’origine exacte du lecteur peut lire cette route, mais
son prévol `PUT` est refusé. Elle peut aussi lire le document et ses médias,
mais aucune de ces ressources n’est modifiée depuis la preview. Le lecteur
charge éventuellement l’état test existant au démarrage ; les modifications
de profil, les réponses, la progression, les évaluations et la navigation
restent dans la session mémoire de preview, sans `PUT` au serveur. Cela vaut
pour le popup local comme pour la preview réseau. Fermer le popup détruit cet
état de consultation ; une nouvelle preview repart de l’état test initial
disponible côté serveur.

Les deux remises à zéro sont distinctes : la remise à zéro du profil vide ses
valeurs et rouvre le formulaire sans effacer les réponses ou la progression ;
la remise à zéro de la progression efface les pages terminées, les réponses et
les tentatives d’Évaluation sans modifier le profil.

À la réouverture du projet, les valeurs sont filtrées contre les propriétés,
types et choix actuels. Une réponse Question reste valide lorsque seuls les
libellés changent ; elle est écartée si l’identité des choix ou la correction
change. L’état d’Évaluation conserve les réponses encore compatibles, réouvre
les questions manquantes et recalcule l’issue quand toutes les réponses
restantes sont valides. La réconciliation faite par la preview reste locale.
L’API conserve son compare-and-swap : une modification concurrente refuse un
`PUT` périmé sans écraser la valeur serveur.

## Preuves de validation

- [`learning-profile-service.test.ts`](../src/mods/learning/profile/domain/learning-profile-service.test.ts)
  couvre valeurs par défaut, références, usages, types, conditions, cycles à
  plusieurs dépendances et dépendances « Précédent », ainsi que le comportement
  verrouillé.
- [`learning-reader-projection-service.test.ts`](../src/mods/learning/profile/reading/learning-reader-projection-service.test.ts)
  couvre masquage, maintien des pages verrouillées, refus d’un prérequis
  multichapitre filtré, projection des ancres, résolution des étiquettes et
  maintien du document auteur.
- [`learning-scenario-builder.test.ts`](../src/mods/learning/reading/learning-scenario-builder.test.ts)
  couvre les présentations menu/racine, l’ordre des routes, les gardes de
  verrouillage, l’obligation de terminer tous les chapitres requis et le mode
  `free`, qui libère la progression ordinaire sans contourner Visibilité ni
  prérequis ; il vérifie aussi que le seuil d’Évaluation reste appliqué.
- [`profile-token-insertion.test.tsx`](../src/mods/learning/profile/authoring/profile-token-insertion.test.tsx),
  [`profile-label-extension.test.ts`](../src/mods/learning/profile/authoring/profile-label-extension.test.ts)
  et [`remix-section-production.test.tsx`](../src/mods/learning/integration/remix-section-production.test.tsx)
  couvrent l’insertion et la sérialisation des étiquettes.
- [`learning-workspace.test.tsx`](../src/mods/learning/authoring/learning-workspace.test.tsx)
  et [`learning-project-application.test.tsx`](../src/mods/learning/authoring/learning-project-application.test.tsx)
  couvrent l’onglet Profil contextuel, l’insertion dans un champ simple et sa
  disparition quand le contexte actif est quitté. Ces tests vérifient aussi le
  titre « Contenus » et l’accès « Sommaire » avec son icône.
- [`summary-profile-settings.test.tsx`](../src/mods/learning/authoring/summary-profile-settings.test.tsx)
  couvre l’arbre hiérarchique, l’absence de commandes et de BDC dans cette
  zone, la sélection de toutes les pages par le chapitre, la sélection directe
  de pages sans cocher la cible chapitre, l’exception locale même dans un
  chapitre à une page, l’enregistrement au chapitre et aux pages, l’héritage
  par les nouvelles pages, la présence des contrôles désactivés sans cible et
  leur activation après sélection d’un chapitre, l’enregistrement global des
  deux familles, le retour au scénario après validation et l’enregistrement sans cible,
  la conservation des contraintes BDC, les valeurs mixtes, l’héritage et les
  pages créées ensuite. Il vérifie aussi les lignes de Visibilité, l’ajout et
  la suppression d’une condition, le connecteur ET/OU, le remplacement de la
  liste héritée et son rétablissement quand toutes les conditions locales sont
  supprimées, ainsi que l’effet Masquer/Verrouiller et la sélection exclusive
  Précédent ou multichapitre, que
  « Sommaire dans la navigation » dépend de la présentation racine et que le
  sélecteur de fond partage le contrôle média du Quiz. Le mode d’accès à la
  suite démarre sur `endpage` et enregistre `free`. Avec le flag d’édition du
  profil désactivé, il vérifie que seuls les réglages du Sommaire restent et
  que les propriétés et règles du document sont conservées.
- [`controller-machine.test.ts`](../src/mods/learning/integration/controller-machine.test.ts)
  vérifie l’import et la déduplication d’une image de fond dans la file média.
- [`document-commands.test.ts`](../src/domain/commands/document-commands.test.ts)
  vérifie l’attachement d’une image et le refus d’une vidéo comme fond.
- [`learning-page-editor.test.tsx`](../src/mods/learning/authoring/learning-page-editor.test.tsx)
  vérifie que le Quiz conserve la sélection native et le dépôt de médias après
  le partage du contrôle.
- [`learning-test-state-service.test.ts`](../src/mods/learning/reading/learning-test-state-service.test.ts)
  couvre la conservation ou l’invalidation ciblée des réponses.
- [`project-test-state-session.test.ts`](../src/mods/learning/preview/learning-test-state-session.test.ts)
  et [`popup-player.test.tsx`](../src/mods/learning/preview/learning-preview-view.test.tsx)
  couvrent la session API, le mode local hors ligne et la restitution dans le
  lecteur ; le second vérifie aussi l’icône partagée du bouton « Test auteur ».
- [`api-router.test.ts`](../src/mods/learning/integration/api-router.test.ts),
  [`network-preview-api-policy.test.ts`](../src/mods/learning/integration/network-preview-api-policy.test.ts),
  [`project-api-client.test.ts`](../src/core/persistence/project-api/project-api-client.test.ts)
  et [`sqlite-project-persistence.test.ts`](../src/mods/learning/persistence/server/sqlite/learning-sqlite-project-persistence.test.ts)
  couvrent les routes, la politique de preview, les ETags, le compare-and-swap
  et la persistance SQLite. Le test d’intégration
  [`popup-player-cache-integration.test.tsx`](../src/mods/learning/integration/learning-preview-session.test.tsx)
  vérifie que le lecteur garde les interactions en session sans appeler
  l’écriture d’état test. Safari MCP, le 27 octobre 2026, a aussi confirmé le
  refus `403` du prévol `PUT` depuis l’origine réseau de preview.
- [`elce-player-composition.test.ts`](../src/mods/learning/reading/learning-player.test.ts)
  exerce dans la composition réelle Sighty/CodPlay le changement de champ, le
  refus d’un formulaire incomplet, la soumission valide, la réouverture sur le
  Sommaire racine et le lien du menu vers ce Sommaire. Il vérifie aussi que les
  pages et chapitres verrouillés restent visibles, portent un cadenas accessible
  et ne peuvent pas être ouverts. En mode `free`, le test de composition garde
  le BDC Résultat d’Évaluation inaccessible tant que les réponses requises
  manquent.

Validation automatisée le 15 octobre 2026 : 51 fichiers et 374 tests réussis
dans l’exécution complète, avec le test SQLite exécuté avec l’accès à la boucle
locale. Typecheck et build réussis ; Vite signale le chunk JavaScript principal
au-dessus de 500 kB.

Validation du flag d’édition du profil le 15 octobre 2026 : le fichier de
réglages passe avec 13 tests ; le typecheck, le build et la suite complète
(51 fichiers, 374 tests) passent.

Validation ciblée de l’évolution du sélecteur le 15 octobre 2026 : 4 fichiers,
64 tests, typecheck et build réussis.

Validation ciblée de l’éditeur de Visibilité le 15 octobre 2026 : 3 fichiers,
21 tests, typecheck et build réussis. Les tests couvrent la priorité ET dans
les deux ordres, les connecteurs, la répétition d’une propriété, le remplacement
de la liste entière et le retour à l’héritage.

Validation ciblée de `pageContinuationMode` le 15 octobre 2026 : 3 fichiers,
65 tests, typecheck et build réussis. Le défaut `endpage`, la progression libre
des pages ordinaires, les contraintes de Visibilité et de chapitre, et le garde
du BDC Résultat sont vérifiés.

La vérification Safari du parcours auteur et de la preview réseau reste suivie
dans le [plan d’implémentation](../plan/2026-10-14-elce-sommaire-profils-plan.md).
