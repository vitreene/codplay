# Elcé — Sommaire, profils et test auteur

Cette spécification décrit les contrats en place pour le Sommaire, la collecte
initiale du profil, les règles de visibilité, les étiquettes et l’état du test
auteur. Les formats du document et de l’état test sont des choix internes que
l’auteur pourra relire séparément.

## Modèle auteur

`ElceDocument` v5 porte un seul objet `data.summary` et une définition
`data.profile`. Le Sommaire conserve son titre, sa description, son média de
fond, ses réglages d’affichage du menu et de la page de Sommaire, son niveau de
liste, le mode d’accès aux pages `endpage | free` (`endpage` par défaut),
l’accès permanent et la destination de fin de chapitre. Ses deux présentations
utilisent les mêmes entrées retenues, le titre et la description.

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

`summary.showInMenu`, édité par la case « Afficher le menu », commande le
panneau entier à gauche du contenu. Désactivé, il masque ce panneau et retire
sa colonne du layout : le contenu utilise toute la largeur disponible. À
800 px et en dessous, le bouton d’ouverture et le tiroir sont également
masqués. Réactivé, le menu présente à nouveau toutes ses entrées. Le réglage
ne modifie ni les pages ni leurs règles d’accès, et reste indépendant de
« Afficher comme page ».

`summary.showAtRoot`, présenté par la case « Afficher comme page », place le
Sommaire avant les pages de contenu dans le parcours du lecteur. C’est la page
1 ; « Suivant » ouvre la première page de contenu, et « Précédent » depuis
celle-ci revient au Sommaire sans exiger que cette page soit terminée. Le
compteur inclut le Sommaire. Quand ce réglage est désactivé, le parcours
commence sur la première page de contenu et celle-ci n’a pas de page
précédente. Une page éditée choisie expressément au démarrage reste la page de
départ de cette session.

Dans le scénario de l’éditeur, le réglage ajoute une entrée fixe « Sommaire »
au-dessus des pages et chapitres. L’entrée ouvre les réglages du Sommaire ; elle
ne crée pas de page métier et ne change pas l’ordre enregistré des contenus.
La décocher retire cette entrée. L’accès au Sommaire depuis le menu reste
gouverné par « Accès au sommaire dans la navigation » : le lien reste
accessible pendant une page inachevée quand ce réglage est activé ; sinon, il
devient accessible après la fin de la page. La case est désactivée tant que
« Afficher comme page » est décochée. Si « Après un chapitre » est réglé sur
« Revenir au Sommaire », la fin du chapitre revient à cette page lorsqu’elle est
activée.

Le builder déclare ce choix par `data-menu-visible` sur le layout. La feuille
partagée du lecteur règle la visibilité et la grille ; le montage Sighty, les
routes et le circuit de navigation restent identiques. Le menu conserve ses
entrées, même lorsqu’il est masqué. Ce scénario et cette feuille sont communs
à la preview et à l’export.

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

Le mode `chapters` affiche uniquement les chapitres dans les deux présentations
du Sommaire ; les pages autonomes de la racine et les titres de page sont
masqués. Une entrée de chapitre ouvre sa première page retenue. Le mode `pages`
affiche les titres de page dans l’ordre racine/chapitres. Sur la page Sommaire,
les titres de chapitre occupent la première colonne et les titres de page la
seconde. À 800 px ou moins, `chapters` garde une seule colonne et chaque titre
de chapitre utilise toute la largeur disponible, sans colonne vide. Le titre du
Sommaire apparaît une seule fois dans l’en-tête global du lecteur ; le contenu
de la page ne le répète pas.

L’état de lecture des chapitres est projeté à gauche de leur titre, hors du flux
du texte (`list-style-position: outside`), dans une gouttière située à l’intérieur
de la zone visible du contenu afin que le padding ne coupe pas l’icône en colonne
étroite. Il réutilise `finishedPages` et les gardes d’accès existantes : un
chapitre inaccessible affiche un cadenas ; toutes ses pages retenues terminées
affichent un œil plein ; une partie seulement terminée affiche un œil contour ;
aucun état de lecture ne masque l’icône. Le cadenas prévaut sur la progression.
Le nom accessible du lien annonce aussi l’état. Aucun état parallèle n’est
stocké.

Dans la barre de navigation, un bouton désactivé « Précédent » est masqué. Sur
la page Sommaire, il n’y a donc ni bouton Précédent ni raccourci « Sommaire » ;
« Suivant » ouvre la première page et garde sa largeur normale. Les zones de
grille restent affectées explicitement lorsque le raccourci Sommaire est masqué,
sur ordinateur comme sur petit écran.

Les prérequis non satisfaits gardent le contenu visible mais verrouillé. Une règle de
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

Chaque page propose aussi « Ignorer la contrainte de lecture » dans l’onglet
« Style » du panneau droit, lorsque la page est la cible de ce panneau. Le
réglage s’applique à la page source : lorsqu’il est actif, Suivant et un lien
interne peuvent la quitter sans attendre sa fin fonctionnelle. Il est disponible
même sans lien. Si `allowEarlyExit` n’a pas de choix explicite, le réglage est
actif par défaut quand un lien interne figure dans les BDC de la page ou de ses
BDC enfants ; il est désactivé par défaut sinon. Un choix explicite par page
remplace ce défaut. Le réglage ne modifie pas la progression enregistrée.

Le clic sur un lien interne permet d’ouvrir sa destination même si elle est
verrouillée par l’ordre séquentiel. Cette exception concerne uniquement ce
verrou de progression : les règles de Visibilité, les prérequis de chapitre,
les exigences de profil et les résultats d’Évaluation restent appliqués. Le
lien ne marque pas la destination comme lue. Le réglage de la page source et
l’accès exceptionnel à la destination sont deux gardes distinctes.
Si le lecteur reçoit une page de départ verrouillée, il ouvre le Sommaire racine
quand celui-ci est activé ; sinon il démarre sur la première page accessible.
La composition lecteur vérifie que `chapters` n’émet que des entrées de chapitre
dans la page racine et le menu, et que le changement du sélecteur enregistre le
mode choisi. Les tests de composition vérifient les quatre états de progression,
le lien de chapitre verrouillé, l’absence de titre répété et la navigation. La
preview réelle sur le document Nutrition & Santé confirme les huit chapitres
sans titres de page, l’œil contour du chapitre partiel, le titre unique,
l’absence des deux boutons sans destination, la largeur normale de « Suivant »
et, à 390 px, une seule colonne de 318 px sans dépassement horizontal. La même
preview confirme que l’icône reste entièrement dans la zone visible (x=47–72 px
dans un viewport de 390 px). Un test de composition couvre aussi les placements
des icônes dans les titres statiques et les liens.
Les tests sont dans [le lecteur Learning](../src/mods/learning/reading/learning-player.test.ts),
[le scénario Learning](../src/mods/learning/reading/learning-scenario-builder.test.ts)
et [les réglages du Sommaire](../src/mods/learning/authoring/summary-profile-settings.test.tsx).

Les routes vers le Sommaire racine et la scène de transition Profil ciblent
l’entrée de scène sous le slot contenu, pas le conteneur qui déclare ce slot.

Les champs textuels utilisent `{{profile:<id>}}`. Dans une Section, l’étiquette
est un nœud Tiptap avec `profilePropertyId`, sérialisé en `span`
`data-elce-profile-property`. Le lecteur résout ces références dans les titres
du Sommaire, des chapitres et des pages, et dans les textes des Sections,
Cartes, Questions, Graphes et BDC Résultat. Une valeur absente sans défaut
produit une chaîne vide ; le texte injecté est échappé pour le HTML.

Un lien de page inline peut être présenté comme texte souligné ou comme bouton.
Le bouton garde une marge extérieure minimale de `0.5em` sur chaque côté,
dans l’éditeur comme dans le lecteur, afin de le séparer du texte voisin. Cette
marge est visuelle et n’ajoute aucun caractère aux données auteur.

Dans une Section, le markup sérialisé de l’étiquette de lien est une projection
éditoriale, pas la cible interactive du lecteur. La contribution Learning
remplace chaque étiquette de page disponible par le slot CodPlay associé au
perso lien qu’elle produit. Le scénario route l’événement de ce perso vers la
page cible, en appliquant les gardes de lecture prévues ci-dessus. Une cible
indisponible reste un libellé texte.

## Configuration et insertion dans l’éditeur

Le panneau latéral droit s’intitule « Contenus ». Son onglet « Variables »
apparaît lorsqu’un champ textuel compatible a le focus. Il regroupe les
propriétés de profil disponibles, les liens vers les pages de scénario permis
par le champ et les dates locales. Les champs simples insèrent
`{{profile:<id>}}` à la sélection ; l’éditeur de Section insère le nœud Tiptap
`profileLabel` au caret. L’identifiant stable de propriété est conservé dans
les deux cas.

Le groupe « Liens vers les pages » utilise un sélecteur de destination, un
libellé facultatif, un choix de présentation et un seul bouton d’insertion ; ce
bouton reste désactivé tant qu’aucune destination n’est choisie. « Dates
locales » propose la date du jour, l’heure locale et une date relative avec son
décalage en jours. Les champs et les commandes d’insertion partagent la même
largeur, hauteur, typographie, bordure, couleur de fond et forme. Les groupes et
leurs commandes gardent un espacement régulier ; l’action désactivée se
distingue visuellement. Les commandes d’insertion restent accessibles par clic
et glisser-déposer, sans barre globale ni bouton par champ.

Un clic sur une étiquette Tiptap déjà posée sélectionne son nœud, ouvre
« Variables » et sélectionne l’onglet « Modifier », distinct de « Créer ». Le
formulaire d’édition n’affiche que les attributs du type sélectionné : pour un
lien vers une page, sa cible, son libellé, sa présentation et « Mettre à jour
l’étiquette » ; pour un profil ou une date, les seuls champs propres à ce type.
« Créer » garde le catalogue complet des propriétés de profil, des pages et des
dates. L’auteur peut passer d’un onglet à l’autre sans appliquer de changement.
« Mettre à jour l’étiquette » applique une transaction sur le nœud qui
correspond encore aux attributs affichés, puis conserve sa sélection pour que
le panneau reste ouvert. Le changement passe par le `onChange` déjà utilisé par
le champ ou par la Section ; sélectionner un autre contenu ferme l’édition de
l’étiquette.

Le bouton « Sommaire » de l’arborescence ouvre les réglages du Sommaire et du
profil. Il partage l’icône Lucide List avec le bouton « Test auteur » de la
popup, qui ouvre les réglages du profil et de la progression du test.
La case « Accès au sommaire dans la navigation » est désactivée tant que la
case « Afficher comme page » n’est pas cochée. Dans le menu de lecture, elle
indique si le lien Sommaire est accessible avant la fin de la page courante.

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
l’écran ouvert. Les réglages de « Présentation du Sommaire » s’appliquent
immédiatement par les commandes documentaires. À l’ouverture du panneau, chaque
sélecteur affiche la valeur enregistrée dans le document, même si elle ne
correspond pas à la première option. Les propriétés de profil restent en
brouillon jusqu’à « Enregistrer » ; une propriété ajoutée reste présente à la
réouverture du panneau après sa sauvegarde.
Les contrôles des deux familles restent présents sans cible
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
son `PUT` de l’état complet reste refusé. Elle peut aussi lire le document et
ses médias, qui ne sont pas modifiés depuis la preview.

Dans le popup local, une soumission valide de la page Profil enregistre
`profileSubmitted` et `profileValues` par `PUT /test-state/profile`. Cette
route incrémente la même révision et ne remplace pas la progression ni les
réponses. La prochaine prévisualisation recharge le profil soumis, saute la
page Profil et résout ses valeurs dans le contenu. Les réponses, la
progression, les évaluations et la navigation restent dans la session de
consultation ; fermer le popup détruit ces changements non enregistrés.

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
- Le même fichier vérifie la sortie anticipée autorisée depuis la page source,
  l’ouverture par lien d’une destination séquentiellement verrouillée, et le
  maintien des gardes de Visibilité, de chapitre et de résultat d’Évaluation.
  [`page-early-exit.test.ts`](../src/domain/inline-text/page-early-exit.test.ts)
  couvre le défaut dérivé de la présence d’un lien, les choix explicites et les
  pages sans lien ; [`appearance-panel.test.tsx`](../src/app/appearance/appearance-panel.test.tsx)
  vérifie le réglage dans Style et l’envoi de sa commande, et
  [`page-editor.test.tsx`](../src/app/remix/workspace/page-editor.test.tsx)
  confirme son absence dans la zone centrale.
- [`flux-scene-builder.test.ts`](../src/mods/learning/integration/flux-scene-builder.test.ts)
  vérifie que la Section projette l’étiquette sérialisée vers le slot exact de
  son perso interactif ; [`learning-player.test.ts`](../src/mods/learning/reading/learning-player.test.ts)
  vérifie dans le lecteur Sighty/CodPlay le clic vers une destination verrouillée
  par l’ordre séquentiel et le retour à la page source. Brave confirme ce
  parcours dans « Test Elcé — liens et date » sur la copie intégrée isolée, le
  2 novembre 2026. Modifier le libellé de ce lien dans l’onglet dédié de
  « Variables et liens » est enregistré par l’API ; le GET suivant et le
  rechargement de l’éditeur conservent le nœud Tiptap et son markup.
- Le 2 novembre 2026, Brave confirme sur « Test Elcé — liens et date » que le
  bouton de style de la page ouvre le panneau droit sur « Style », où apparaît
  « Ignorer la contrainte de lecture ». La case est active par défaut sur la
  page qui contient un lien interne ; la zone centrale n’en affiche pas.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie la marge de `0.5em` du bouton inline dans le lecteur. Brave confirme
  la même marge dans l’éditeur et dans la preview du document de test.
- [`profile-token-insertion.test.tsx`](../src/app/editor/profile/profile-token-insertion.test.tsx),
  [`profile-label-extension.test.ts`](../src/app/editor/profile/profile-label-extension.test.ts)
  et [`remix-section-production.test.tsx`](../src/app/editor/section/remix-section-production.test.tsx)
  couvrent l’insertion et la sérialisation des étiquettes.
- [`inline-text-field.test.tsx`](../src/app/editor/inline-text/inline-text-field.test.tsx),
  [`section-editor-tiptap-adapter.test.ts`](../src/app/editor/section/section-editor-tiptap-adapter.test.ts)
  et [`profile-token-insertion.test.tsx`](../src/app/editor/profile/profile-token-insertion.test.tsx)
  couvrent la sélection transmise au panneau, les formulaires profil/lien/date,
  la séparation « Créer »/« Modifier » et la transaction éditée dans les champs
  Tiptap et la Section. Le parcours Brave du 2 novembre 2026 confirme le clic
  sur un lien dans une Section, l’onglet d’édition séparé avec seulement ses
  champs, la mise à jour locale et le maintien du formulaire après validation.
  Le serveur de test a répondu HTTP 400 à l’enregistrement du document ; la
  persistance synchronisée reste à valider.
- Le 2 novembre 2026, Brave vérifie le catalogue « Variables et liens » dans
  « Test Elcé — liens et date » à 855 px : champs et commandes d’insertion ont
  la même hauteur de 36 px, typographie de 12,16 px, bordure et rayon. Les
  contrôles sont pleine largeur, leurs espacements sont réguliers et l’insertion
  de lien sans cible est visiblement désactivée.
- [`editor-workspace.test.tsx`](../src/app/remix/workspace/editor-workspace.test.tsx)
  et [`project-application.test.tsx`](../src/app/remix/project-application.test.tsx)
  couvrent l’onglet Profil contextuel, l’insertion dans un champ simple et sa
  disparition quand le contexte actif est quitté. Ils vérifient aussi le titre
  « Contenus », l’accès « Sommaire » avec son icône et, dans le scénario,
  l’entrée fixe qui ouvre les réglages du Sommaire.
- [`summary-profile-settings.test.tsx`](../src/app/remix/workspace/summary-profile-settings.test.tsx)
  vérifie le libellé « Afficher le menu », sa commande documentaire et son
  annulation dans l’historique. Il couvre l’arbre hiérarchique, l’absence de
  commandes et de BDC dans cette zone, la sélection de toutes les pages par le
  chapitre, la sélection directe
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
  Précédent ou multichapitre, que « Accès au sommaire dans la navigation »
  dépend de la présentation racine et que le sélecteur de fond partage le
  contrôle média du Quiz. Le mode d’accès à la
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
  Sommaire et le lien du menu vers ce Sommaire. Avec la page Sommaire activée et
  désactivée, il vérifie l’ordre de lecture, le compteur, Suivant, Précédent
  avant la fin de la première page, et le parcours standard sans Sommaire. Il
  vérifie aussi que les pages et chapitres verrouillés restent visibles,
  portent un cadenas accessible
  et ne peuvent pas être ouverts. Avec le menu activé comme désactivé, il
  vérifie le choix porté par le layout, le maintien des entrées, l’ouverture
  d’une page depuis le Sommaire racine puis la navigation vers la suivante.
  En mode `free`, le test de composition garde
  le BDC Résultat d’Évaluation inaccessible tant que les réponses requises
  manquent.

Validation du menu le 30 octobre 2026 : 79 tests ciblés réussis, puis la suite
Elcé complète (76 fichiers, 526 tests), le typecheck, le build et
`git diff --check` passent. Brave utilise un projet autonome sur une instance
isolée : le menu activé réserve 272 px à gauche à 1280 px ; désactivé, sa
région est en `display: none` et le contenu commence à 0 px. À 390 px, le menu
et son bouton sont masqués et le contenu utilise les 390 px. Un chargement
depuis l’API conserve le choix désactivé et présente le Sommaire racine ; ses
entrées ouvrent Page A et « Suivant » ouvre la seconde page. Réactiver le
réglage rétablit le bouton mobile, l’ouverture du tiroir et ses routes, puis
la colonne sur ordinateur. L’avertissement de focus sous `aria-hidden` à la
fermeture du tiroir reste celui déjà suivi dans le plan de construction.

Validation de « Afficher comme page » le 30 octobre 2026 : les quatre fichiers
ciblés réussissent (87 tests), puis la suite Elcé complète réussit (76 fichiers,
529 tests), avec le typecheck, le build et `git diff --check`. La composition
réelle vérifie le parcours et les compteurs avec et sans Sommaire, y compris le
retour avant la fin de la page ; Brave vérifie la première entrée fixe du
scénario et le parcours lecteur.

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
