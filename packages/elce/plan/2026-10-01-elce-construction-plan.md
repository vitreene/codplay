# Elcé — cadrage du plan de construction

Date d’ouverture : 2026-10-01.

## Statut et travail en cours

**Fixe — plan accepté le 2026-10-02 ; implémentation en cours aux étapes 1,
2, 3, 4, 6 et 7.**

La [note de présentation](../notes/2026-10-01-presentation-elce.md) est rédigée
à partir de la description initiale. Le travail engagé consiste à préciser
le projet, sujet par sujet, puis à établir un plan de construction validable.
L’ordre des sujets ci-dessous est désormais l’ordre de réalisation retenu.
Les décisions propres à une tranche sont conservées dans cette tranche et ne
bloquent pas les étapes indépendantes.

Le périmètre initial et le principe de génération sont précisés au sujet 1.
Les principes d’organisation du sujet 2 sont retenus : chaque bdc est utilisé
à un seul endroit dans le POC, tandis qu’un même média peut être réemployé.
Les structures peuvent être répétées ; le catalogue accueille les pages
disponibles, les bdc ainsi que les images et médias ajoutés. Le sujet 5
précise le déplacement des ancres par une icône et le retour du bdc au
catalogue lors de la suppression d’une ancre. La création
d’un bdc dans un espace de travail isolé est retenue comme direction ; dans
le POC, l’interface ne propose la création des sections texte que dans les
pages, sans en faire une contrainte du modèle de données. Après création
isolée d’un bdc, l’éditeur revient à la page ; la zone d’édition d’un bdc
ancré le rouvre dans l’espace isolé. Le choix d’un type à créer s’oriente
vers une rangée d’icônes ; une référence du catalogue peut aussi être
glissée pour l’insertion. Tous ces dépôts créent l’ancre au point de dépôt
par la même voie de commandes. Le dépôt d’un fichier image depuis
l’ordinateur enchaîne en plus son ajout au catalogue, la création du bdc
image et son placement. Le parcours « curseur dans le texte, puis clic sur
une icône » est reporté après le POC ; il réutilisera les mêmes commandes.
Les principes d’interface du sujet 3 sont retenus ; la lecture démarre sur
la page en cours d’édition. La section
de texte, son titre facultatif, les alignements et le collage simple sont
précisés au sujet 4. Le terme retenu est « bloc de contenu », abrégé « bdc »
ou « node » dans les échanges. L’éditeur vise l’ordinateur et le player doit
également fonctionner sur mobile. Le modèle de commandes
avec contrôleur à machine d’état est retenu au sujet 11 ; l’Undo reste hors
du POC. On essaiera IndexedDB pour conserver l’unique document et ses médias
dans ce POC temporaire ; un petit helper pourra simplifier cet accès. Plusieurs
documents viendront avec SQLite. La première démonstration couvre
Flux de texte, questions et évaluation de chapitre avant la Diapo, en
reprenant les circuits de lecture de la démo 5.

| Travail | État | Résultat attendu |
| --- | --- | --- |
| Rédiger la note initiale et repérer les références existantes | Réalisé | Présentation fidèle et sources locales identifiées. |
| Préciser le périmètre de la première démo | Fixe — accepté, non appliqué | Organisation sommaire, Flux de texte avec image et vidéo ancrées puis questions et évaluation de chapitre ; Diapo ensuite. |
| Préciser les comportements et les frontières | Fixe — accepté, non appliqué | Bdc à usage unique, médias réemployables, ancres, catalogue et séparation Elcé/CodPlay/Sighty retenus. |
| Définir les preuves et les tranches de construction | Fixe — accepté, non appliqué | Séquence ordonnée et preuves observables au sujet 12. |
| Relire le plan de construction avec l’utilisateur | Réalisé | Plan accepté pour l’implémentation ; les décisions propres à une tranche sont vérifiées au moment de cette tranche. |
| Mettre en place l’application Elcé et son workspace | En cours — automatisation et parcours navigateur vérifiés | Typecheck, tests de fumée, build, serveur de développement et preview HTTP validés ; aucun import privé d’ed2. |
| Construire le modèle documentaire minimal et la façade de commandes | En cours | Document versionné, commandes pures, contrôleur XState et frontière IndexedDB en place ; la restauration navigateur reste à éprouver. |
| Préparer la première projection Flux et le scénario séparé | En cours — cadre complet et scroll-end vérifiés | Le builder produit un `SceneDoc` Flux, le constructeur un graphe Sighty avec menu, titre, contenu et navigation, et la composition monte le player réel en DOM de test ; Safari confirme le passage par le repère bas sur une page longue. |

### Correctif de raccord CodPlay/Sighty — 2026-10-02

Le parcours Safari a d’abord montré que CodPlay produisait bien l’événement du
repère, mais que Sighty refusait la requête parce que le builder Flux écrivait
`elce:page-bottom` alors que la constante de scénario déclarait
`elce:page:bottom`. Le contrôle DOM de page courte dans
`ElcePlayerComposition` masquait cette divergence. La correction aligne le
builder sur la constante, retire le dispatch local et introduit l’option
déclarative `emit.observe.initial` du composant scroll pour les repères déjà
visibles. Les tests Elcé exercent maintenant l’observation CodPlay et le
routage Sighty pour une page courte et après une transition de visibilité ; le
parcours Safari confirme la page longue. Aucune démo ni aucun circuit local ne
contourne CodPlay.

## Arbitrages de produit du lot

**Arbitrages 1 à 16 résolus le 2026-10-02.**
Ce lot rassemble les décisions
qui changeraient le comportement ou le périmètre du POC. Les dimensions CSS,
les API et le choix des bibliothèques restent des travaux de construction,
pas des questions à poser une par une. Les réactions des images, vidéos et
quiz, ainsi que la navigation déjà montrées par la démo 5, ne sont pas
redemandées.

### Organisation et catalogue

1. **Résolu :** deux actions distinctes. « Retirer du chapitre » remet la
   page dans la réserve du catalogue ; « Supprimer définitivement » détruit
   la page et tous ses bdc du document. Les médias, ressources distinctes
   et réemployables, restent dans le catalogue.
2. **Résolu :** retirer un bdc placé directement dans une page le remet au
   catalogue, comme le retrait d’un bdc ancré ; son média reste réemployable.
3. **Résolu :** une page du catalogue peut être éditée et consultée dans
   l’éditeur, mais n’appartient pas au scénario du player. Le scénario peut
   aussi contenir une page à sa racine, au même niveau que les chapitres,
   par exemple une page de présentation : celle-ci appartient au scénario.

### Document et sauvegarde

4. **Résolu :** le POC conserve un seul document local et ses médias.
   La gestion de plusieurs documents est reportée à l’étape SQLite.
5. **Résolu :** le POC conserve le travail de l’auteur et ses médias, mais
   ne restaure pas la progression ni les réponses du lecteur après fermeture.
   Cette persistance sera traitée plus tard dans le cadre de SCORM. Pendant
   une session, la logique de lecture reste celle de la démo 5.

### Composition et parcours après la première démonstration

6. **Résolu :** la Diapo ne bloque pas le défilement à l’intérieur d’une
   page. Le lecteur peut atteindre le bdc suivant sans avoir parcouru
   toutes ses cartes. Les éventuelles conditions de passage à la page
   suivante relèvent de la page.
7. **Résolu :** l’auteur place la Question où il le souhaite dans la page.
   Elle conserve le fonctionnement de réponse de la démo 5 ; la page porte
   les effets de sa validation sur la navigation. « Quiz » ou « évaluation »
   désigne le cumul et l’évaluation des résultats au niveau du chapitre,
   pas un type de page imposé. Un chapitre Évaluation peut mêler des pages
   de texte et des pages avec questions.
8. **Résolu :** construire Flux de texte et questions avec évaluation de
   chapitre dans la première démonstration, en reprenant les circuits de
   la démo 5, puis ajouter la Diapo. Les tranches et leurs preuves sont
   réordonnées au sujet 12.

### Validation et résultat de l’évaluation

9. **Résolu :** dans le POC, les effets du bouton « Valider » sont produits
   automatiquement à partir du contexte de la page et du chapitre
   Évaluation. L’auteur ne les règle pas dans une interface ; cette interface
   viendra plus tard.
10. **Résolu :** un chapitre Évaluation possède un seuil de réussite,
    fixé à 80 % dans le POC, au lieu d’exiger systématiquement toutes les
    réponses justes. Son réglage par l’auteur aura une interface plus tard.
11. **Résolu :** le POC autorise au plus une Question par page, sans imposer
    sa position parmi les bdc. L’auteur peut notamment placer du texte
    avant ou après elle.
12. **Résolu :** une réponse juste n’est pas une condition générale de
    passage à la page suivante dans le POC. L’auteur pourra décider de
    l’exiger dans une interface ultérieure. Le seuil du chapitre Évaluation
    reste une condition distincte, appliquée au résultat cumulé.
13. **Résolu :** le score d’un chapitre Évaluation est le nombre de
    Questions justes divisé par le nombre total de Questions du chapitre.
    Chaque Question a le même poids, une absence de réponse compte comme
    incorrecte et le chapitre est réussi dès que son score atteint 80 %.
14. **Résolu :** sur une page Flux avec Question, « Suivant » se débloque une
    fois le bas de page atteint **et** une réponse validée. Le résultat juste
    ou faux n’intervient pas dans ce garde de page ; le chapitre Évaluation
    applique séparément son seuil à la sortie du chapitre. Sur une page Flux
    sans Question, le repère bas suffit, comme dans la démo 5. La page Diapo
    relève de la règle distincte du sujet 7.
15. **Résolu :** la suppression définitive d’une page détruit ses bdc, y
    compris ceux qu’elle contient par ancre ; ils ne rejoignent pas la
    réserve. Le retrait d’une page ou d’un bdc reste une action distincte.
16. **Résolu :** un chapitre Évaluation sans Question reste lisible dans le
    POC, qui teste le point de vue de l’auteur. Aucun score en pourcentage
    n’est calculable tant qu’il ne contient aucune Question ; cette absence
    ne bloque pas la prévisualisation du parcours. Un mode de diffusion
    imposera une évaluation non vide, mais il n’existe pas encore dans le
    POC.

Les décisions de ce lot sont reprises dans leurs sujets respectifs. Les
questions sur la génération des scènes et les contraintes du runtime seront
traitées en étudiant les contrats existants avant chaque tranche.

## Intentions déjà exprimées, à traduire en travaux

Ces intentions viennent de la présentation initiale ; elles ne constituent
pas des comportements Elcé déjà implémentés et vérifiés.

- Combiner édition du scénario, édition des pages et lecture de la projection.
- Construire une page comme un enchaînement d’un ou plusieurs nodes.
- Prévoir les types initialement nommés Flux de texte, Diapo et Quiz ; le
  sujet 8 précise désormais que le bdc unitaire est une Question et que
  Quiz/évaluation désigne le résultat cumulé au chapitre.
- Limiter l’enrichissement de texte aux options décrites dans la note.
- Étudier l’insertion de contenus par ancre et espace réservé sous une ligne.
- Utiliser `capsule-automation` pour les diaporamas et reprendre la structure
  de quiz de la démo 5 de Sighty.
- S’appuyer sur des cartes de layout et des animations configurées.
- Porter les règles de passage à la page suivante au niveau de la page.
- Définir le modèle de construction des pages avant le player plus élaboré.

## Références et circuits repérés

| Sujet | Référence | Portée pour le cadrage Elcé |
| --- | --- | --- |
| Parcours et contenus de référence | [Démo 5 Sighty](../../demos/specs/sighty-scroll-course-demo-spec.md) | Décrit le cours scrollable, les guards, les repères bas et le quiz utilisant les composants `input`, `listen` et les straps CodPlay. |
| Scénario et navigation | [Spécification Sighty](../../sighty/specs/authoring-library-spec.md) | Sighty possède le parcours et son admission ; CodPlay possède les scènes et leur rendu. La sauvegarde sérialisée du parcours relève de l’intégration hôte. |
| Scènes produites | [Déclaration et compilation d’une scène](../../codplay/specs/scene-authoring-spec.md) | Le builder métier produit les scènes auteur ; le circuit CodPlay conserve la compilation `SceneDoc → CompiledScene`. |
| Racine des pages Flux | [Capacité scroll-container](../../codplay/specs/scroll-container-spec.md) | Le perso `scroll-container` est le scrollport de la scène, accueille les descendants par `move` et fournit l’observation du repère bas. C’est une capacité optionnelle à enregistrer pour le player Elcé. |
| Principe d’application métier | [Modèle de document ed2](../../editor/plan/app/2026-07-11-ed2-document-model.md) | Référence du processus modèle métier → builder évoqué par l’utilisateur ; les schémas Elcé restent propres à l’application. |
| Import de ressources | [Discussion de l’application ed2 sur le chutier](../../editor/plan/notes/2026-07-10-app-construction-discussion.md) | Décrit un même principe d’import par bouton ou dépôt avec typage image/vidéo. C’est une référence de conception à examiner pour Elcé, pas un contrat d’import déjà vérifié dans ed2. |
| Commandes et machine d’état | [Contrôleur central et façade](../../editor/plan/app/2026-07-12-app-controller-definition.md), [construction de l’application](../../editor/plan/app/2026-07-10-app-construction-plan.md) et [organisation V2](../../editor/plan/2026-09-01-editor-v2-organization-plan.md) | Références du modèle retenu : document détenu par le contrôleur, voie d’écriture unique par commandes, transactions et séparation des commandes documentaires et du transport. L’historique reste une extension ultérieure pour Elcé. |
| Relecture des quiz | [Plan de reset Sighty](../../sighty/plan/2026-09-30-sighty-replay-reset-plan.md) | Le plan indique une intégration visuelle Demo 5 encore à valider dans un navigateur ; cette preuve reste distincte du parcours déjà documenté de la démo. |
| Cadre des démos Sighty | [Layout partagé](../../demos/specs/sighty-demo-layout-spec.md) | Repère le propriétaire de la page commune et du cycle de vie si ce cadre est retenu pour une démonstration. |
| Capsules | [Document capsule de l’éditeur](../../editor/plan/2026-07-08-capsule-spec.md) et [distribution](../../authoring/scene-factory/2026-06-12-capsule-distribution-spec.md) | Repèrent `capsule-automation` et le circuit de distribution existants. Leurs éléments historiques ou différés ne valent pas décision d’intégration Elcé. |
| Maintenance V2 | [Guide de reprise](../../codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md) | Oriente vers les spécifications et les plans détaillés des capacités mobilisées. |

Le principe retenu est une application métier Elcé avec ses propres schémas
de données. Le builder de scènes transforme chaque page en `SceneDoc` ; la
construction du scénario Sighty est distincte. Un bdc est normalement projeté
en story de ses persos ; un bdc simple peut se réduire à un perso sans story
autonome. Le raccord détaillé reste à préciser au sujet 11. Toute modification
du cœur `packages/codplay`
reste soumise à l’autorisation explicite et au plan accepté prévus par les
[règles du dépôt](../../../AGENTS.md).

### Frontières à conserver pendant la construction

| Propriétaire | Données ou comportement à produire et vérifier |
| --- | --- |
| Elcé | Document de l’auteur, catalogue, affectation et ordre des pages et bdc, commandes d’édition, sauvegarde du document. Un seul document métier sert de source à la génération. |
| Builder de scènes Elcé | Projection d’une page et de ses bdc en `SceneDoc`. Chaque bdc produit normalement sa story avec ses persos et son état propre ; un bdc simple peut produire un seul perso sans story autonome. Les straps servent aux calculs internes des bdc et de la scène. Aucun ordre d’activation ou séquencement temporel n’est dérivé de l’ordre des bdc. Une édition de page ne reconstruit pas les scènes des autres pages. |
| Construction du scénario Elcé | Projection distincte de l’organisation du document en scénario Sighty, avec le layout à la racine, le slot des pages racine et une entrée de slot par chapitre. Lorsqu’il faut actualiser le scénario, l’éditeur le reconstruit en entier, sans employer la mutation live de Sighty et sans reconstruire les scènes inchangées. Les pages du catalogue restent hors scénario ; l’application gère l’accès direct à la page courante. |
| CodPlay | Compilation et lecture des scènes, persos `img`, `media` et `input`, observation dans le scrollport, actions et événements des persos. |
| Sighty | Graphe du parcours, guards d’accès et de sortie, actions de navigation, état de lecture en session et relecture des pages selon le scénario. |
| Stockage de l’application | Document auteur et octets des médias importés ; la progression du lecteur n’est pas persistée dans le POC. |

La preuve minimale du raccord sera un document Elcé contenant une page de
présentation à la racine du scénario, une page Flux de texte dans un chapitre
et une page du catalogue. La construction du scénario doit produire une définition validée par
`sighty.scenario.validate()` ; le vrai player doit lire les deux premières
pages dans leur ordre et ne proposer aucune route vers la page en réserve.
Cette preuve appartient à la tranche « Première lecture réelle » : la
tranche de faisabilité qui la précède prépare le schéma et vérifie les
contrats, sans prétendre valider déjà l’intégration navigateur.

La démo 5 fournit le comportement attesté de navigation et de questions.
Les nouvelles combinaisons propres à Elcé — une Question parmi plusieurs bdc
d’une page, des pages de texte au sein d’un chapitre Évaluation et un seuil
de 80 % — exigent une règle métier explicite et sa preuve avant leur
implémentation. Le garde de la question du premier chapitre de la démo 5
exige une réponse juste ; cette règle particulière ne devient pas la
politique générale des pages Elcé. Les circuits Sighty et CodPlay restent
les mêmes.

## Sujet 1 — Périmètre de la première démo

**Fixe — décisions de cadrage acceptées le 2026-10-01, non appliquées.**

- L’organisation est volontairement sommaire : créer un chapitre, puis des
  pages à l’intérieur, une par une ; déplacer et supprimer une page.
- Une page peut recevoir un nom saisi par l’auteur ou un nom automatique.
- L’interface générale de réglage des conditions d’accès rattachées aux
  pages viendra ultérieurement. La première démonstration réutilise les
  circuits de gardes et d’actions de la démo 5, avec les effets de
  validation portés par chaque page comme décrit au sujet 8.
- Les premières tranches portent sur le Flux de texte, avec images et vidéos
  ancrées, puis sur les questions et l’évaluation de chapitre en reprenant
  les circuits de la démo 5. La Diapo vient après cette première
  démonstration, sous forme de page entière ou de bdc inséré dans un Flux.
  Le raccord de ce second mode de présentation est suivi au sujet 5 et doit
  être prouvé dans la tranche Diapo avant de la déclarer achevée.
- Elcé suit le même principe de construction que l’éditeur existant : une
  application métier manipule ses propres schémas de données. Un builder
  génère la scène correspondant à chaque page ; une construction distincte
  produit le scénario nécessaire à Sighty.

Les détails des opérations d’organisation restent au sujet 2. La réponse
sur le processus fixe la frontière métier/builder ; la disposition d’édition
et la bascule vers la lecture sont retenues au sujet 3. Le parcours concret
d’acceptation sera construit au sujet 12. Le catalogue est décrit au sujet 2 ;
l’insertion de bdc dans le contenu d’une page et la possibilité de création
hors page sont suivies au sujet 5.

## Sujet 2 — Document, pages et nodes

**En cours — modèle et commandes appliqués ; le catalogue des bdc et médias
reste à construire.**

Décisions retenues :

- Plusieurs chapitres peuvent être créés dès la première version. L’auteur
  peut les renommer et les réordonner. Dans le POC, un chapitre ne peut être
  supprimé que s’il est vide.
- Les chapitres représentent les regroupements nommés et ordonnés de pages
  du parcours, comme dans la démo 5. Cette référence porte sur leur rôle
  dans la structure ; l’édition de leurs conditions d’accès reste reportée
  selon le sujet 1.
- Un chapitre Évaluation peut contenir, dans son ordre de lecture, des pages
  de texte et des pages avec questions. Il cumule et évalue les résultats
  des questions qui lui appartiennent ; une page de texte n’a pas à porter
  elle-même de question pour être admise dans ce chapitre. Le seuil de
  réussite du chapitre est fixé à 80 % dans le POC. Une interface pour
  définir une autre valeur viendra plus tard. Un chapitre Évaluation encore
  dépourvu de Question reste lisible dans la prévisualisation auteur du POC ;
  aucun pourcentage de réussite n’est alors calculé. Le mode de diffusion,
  qui exigera une évaluation non vide, est hors du POC.
- Une page peut être réordonnée dans son chapitre et transférée vers un
  autre chapitre.
- Le scénario peut contenir des pages au même niveau que les chapitres,
  notamment une page de présentation. Ces pages hors chapitre font partie
  du parcours du player et restent distinctes des pages en réserve dans
  le catalogue. Le POC doit permettre de les créer et de les placer à ce
  niveau dans l’éditeur.
- L’auteur dispose de deux actions distinctes sur les pages : « Retirer du
  chapitre » détache la page et la rend disponible dans la réserve du
  catalogue ; « Supprimer définitivement » retire la page et tous ses bdc
  du document, sans les verser au catalogue. Les médias réemployables restent
  dans le catalogue. La présentation précise de ces actions dans
  l’interface reste à construire.
- Les noms automatiques suivent la forme « Page A », « Page B », etc. Le nom
  d’une page reste inchangé lorsqu’elle est déplacée.
- Une page Flux ordonne ses bdc verticalement dans un même défilement. Une
  page de type Diapo, ajoutée après la première démonstration, occupe le
  lecteur sans scroll ; le type de page détermine sa composition et sa règle
  de navigation, indépendamment de son emplacement dans le scénario.
- Une nouvelle page est de type Flux et contient par défaut un bdc Flux de
  texte vide. La création d’une page Diapo sera offerte avec la tranche
  correspondante.
- Les opérations sur les nodes du POC sont l’ajout, le déplacement et la
  suppression. Retirer un bdc placé directement dans une page le remet dans
  le catalogue, comme le retrait d’un bdc ancré ; la duplication n’est pas
  retenue pour ce périmètre.

### Catalogue, exclusivité des bdc et réemploi des médias

**Périmètre accepté le 2026-10-01, non appliqué.**

- Le catalogue recense les pages inutilisées, disponibles en réserve et
  indépendantes du parcours de diffusion. Une page en réserve peut être
  éditée et consultée dans l’éditeur, mais elle n’est pas lue par le player.
- Il accueille aussi les bdc destinés à être insérés dans des contenus de
  page, ainsi que les images et médias ajoutés à l’application.
- Un bdc, avec son contenu éditorial, est affecté à un seul emplacement dans
  le POC : le même bdc n’est pas répété à plusieurs endroits. Une structure,
  par exemple celle d’une question, peut en revanche être employée plusieurs fois
  avec des contenus distincts.
- Un média du catalogue, comme une image, est une ressource réemployable :
  plusieurs bdc distincts peuvent faire référence au même média. Un bdc image
  reste une instance unique, même si son image est utilisée ailleurs.
- Le POC peut afficher une image avec sa légende dans un preset de carte à
  deux zones et à architecture HTML fixe. La légende reste commune à la
  ressource média du catalogue : plusieurs utilisations de ce média
  affichent le même texte. Le markup exact de ce preset, notamment l’emploi
  éventuel de `figure`/`figcaption`, reste à définir ; l’image simple sans
  carte identifiable ne requiert pas `figure`.
- Une page affectée à un chapitre ne peut pas être réutilisée ailleurs.
  L’affectation est exclusive ; le transfert entre chapitres change son
  affectation sans créer une seconde utilisation.
- Une page utilisée dans un chapitre ne fait donc pas partie de cette
  réserve de pages inutilisées. Il en va de même pour une page du parcours
  placée hors chapitre.
- La suppression d’une ancre ramène le bdc associé dans la réserve du
  catalogue ; ce geste conserve le bdc et le rend disponible pour une autre
  insertion. Le média qu’il référence reste réemployable.
- La gestion générale d’une bibliothèque et la réutilisation multiple d’un
  même bdc dépassent le cadre du POC. L’insertion d’un bdc et la création
  envisagée hors page restent au sujet 5 ; la persistance des médias est à
  préciser au sujet 10.

Le schéma minimal de la première tranche comprend l’identité et la version
du document, l’identité, le nom, l’ordre et le type des chapitres, puis les
identités, noms, types, affectations et ordres des pages. Aucun autre champ
éditorial de document ou de chapitre n’est requis avant un besoin établi.
L’algorithme du nommage alphabétique après suppression et au-delà de Z reste
un choix de réalisation de l’étape Organisation. La relation entre le scroll
d’une page Flux et une Diapo insérée est décidée au sujet 7.

Résultat attendu : vocabulaire, structure du document et opérations auteur.

## Sujet 3 — Parcours d’édition et interface

**En cours — première organisation et déplacement par glisser-déposer appliqués ; la preuve navigateur complète reste à consigner.**

Décisions retenues :

- L’éditeur du POC vise l’ordinateur. Le player doit également pouvoir être
  joué sur mobile ; cette exigence de lecture est précisée au sujet 6.
- L’organisation du scénario (pages racine et chapitres) et du catalogue
  occupe la partie gauche, la page est au centre, les réglages à droite.
- L’interface doit rester accessible et compréhensible pour des personnes
  peu formées. Une page se déplace par glisser-déposer depuis sa poignée vers
  un chapitre, la racine du scénario ou le catalogue ; le dépôt sur une
  page l’insère avant ou après elle selon la position du pointeur. La corbeille
  reste l’action explicite de suppression définitive.
- Le texte est édité directement dans la page, en WYSIWYG.
- L’utilisateur de l’éditeur ne saisit jamais de HTML : cette règle vaut
  pour tout Elcé, pendant le POC et au-delà. Les structures HTML nécessaires
  au rendu sont produites par l’application et ses builders.
- La sélection d’un bdc ancré affiche une icône à son point d’insertion.
  Glisser cette icône repositionne l’insertion dans le texte, selon une
  interaction rappelant les traitements de texte ; détails au sujet 5.
- Un bouton de prévisualisation ouvre une surface séparée du WYSIWYG. Pour le
  POC, cette surface est une modale dans l’application ; une fenêtre
  différente reste une évolution possible. Elle utilise les scènes produites
  par le builder et le scénario construit séparément. Cette lecture est la
  prévisualisation en mode auteur du POC ; le mode de diffusion et ses
  contrôles de publication viendront plus tard.
- Depuis l’éditeur, la lecture du scénario démarre sur la page en cours
  d’édition si elle appartient au scénario. Une page du catalogue est
  consultée dans l’éditeur, sans entrer dans le player.
- Le player peut également être lu dans une fenêtre différente.
- Le retour à l’édition retrouve la page, le node sélectionné et la position
  de défilement précédant la lecture.
- L’Undo n’est pas nécessaire pour le POC. L’application doit cependant
  adopter dès sa construction le modèle de commandes et de machine d’état
  qui permettra d’ajouter l’historique ultérieurement, comme décrit au sujet 11.

Les contrôles d’ajout, la sélection et les raccourcis utiles seront précisés
avec les gestes retenus. Le déplacement n’emploie plus de boutons nommés
« Parcours », « Réserve » ou « Chapitre » : les listes de dépôt portent leur
destination explicite.

Résultat attendu : parcours auteur et disposition des outils.

## Sujet 4 — Structure du Flux de texte et enrichissement

**En cours — structure, règles de base et première surface Tiptap appliquées ;
l’insertion des bdc reste à construire.**

Décisions retenues :

- Le terme générique retenu est « bloc de contenu ». « Bdc » et « node »
  peuvent être employés comme formes courtes dans les échanges. Le terme
  « module » est écarté pour cette unité de contenu, car il est déjà employé
  ailleurs dans le projet.
- L’unité de Flux de texte est une section composée d’un titre facultatif
  et d’un texte. Plusieurs sections correspondent à plusieurs unités dans
  l’enchaînement vertical de la page.
- Tiptap est le candidat privilégié pour éditer ce texte dans le POC, **sous
  réserve de prouver le placement d’un bdc dans le flux comme convenu**. Si
  cet essai réussit, le contenu éditable est conservé en JSON Tiptap ; le
  builder en exporte un HTML statique, utilisé comme `markup` du perso
  `layout` qui porte le flux dans la scène. Le player n’a pas besoin d’une
  instance de l’éditeur Tiptap pour lire ce texte.
- Toute page Flux produit une scène dont le perso racine de contenu est un
  `scroll-container`. Les persos générés pour le flux et ses bdc y sont
  placés dans leur ordre documentaire. Le repère de fin est observé depuis ce scrollport,
  selon le circuit de la démo 5 ; cet ordre ne déclenche aucune story.
- Le rapprochement de cette structure avec une `card` est une piste à
  instruire au sujet 6 ; il ne fixe pas encore de correspondance technique.
- Les alignements demandés sont gauche, centré, droite et justifié. Le mot
  « souligné » dans la liste initiale des alignements est corrigé en « droite » ;
  le souligné reste un enrichissement de caractères.
- Pour le collage dans le POC, le choix de base est le texte brut, solution
  la plus simple. Conserver les enrichissements autorisés est une option
  admise si l’effort est faible ; son coût sera évalué lors du choix de
  l’outil d’édition au sujet 11, sans en faire une exigence du premier lot.

La décision de texte brut concerne le collage, question à laquelle répond
l’utilisateur. Les commandes d’enrichissement du texte prévues dans la
présentation initiale restent demandées dans les zones titre et contenu.

Résultat attendu : structure éditable, options exactes et traitement du collage.

## Sujet 5 — Contenus et ancrage dans le texte

**En cours — extension Tiptap et service métier d’ancrage appliqués ; les
sources catalogue, la réouverture et la preuve navigateur du déplacement restent
à vérifier.**

Les premiers contenus ancrés à rendre utilisables sont l’image et la vidéo.
La démo 5 illustre une image qui entre dans le scrollport et une vidéo dont
la lecture démarre puis s’interrompt selon sa visibilité. Dans la V1
d’Elcé, ces apparitions d’image et cette lecture/pause de vidéo sont
automatiques, suivant les exemples de la démo 5. Une interface de réglage
des apparitions sera créée ultérieurement ; elle n’est pas requise dans la
V1. Les images et vidéos restent des composants CodPlay pilotables, générés
par le builder métier. Comme dans la
[scène de contenu de la démo 5](../../demos/src/sighty/demo5/scenes/content-page-scene.ts),
l’image utilise `img` et la vidéo utilise `media` avec ses contrôles natifs
visibles et ses actions de lecture/pause. L’exergue et le carrousel ne sont pas
requis dans cette première démonstration.

### Ancre et disposition

- Le parcours « placer le curseur dans le texte, puis cliquer sur une icône
  de type » est reporté après le POC. Il devra réutiliser les commandes
  documentaires de pose d’ancre, de création et de placement déjà employées
  pour le dépôt direct.
- Le dépôt dans le texte d’une icône de type, d’un bdc ou d’un média du
  catalogue, ou d’un fichier image de l’ordinateur, crée l’ancre au point
  de dépôt en un seul geste, par le même circuit de commandes.
- Le mécanisme demandé génère un `span` avec un `padding-bottom`, contenant
  le bloc inséré, par exemple une image ou un média. Il doit réserver l’espace
  sous la ligne d’ancrage et permettre la superposition du contenu selon
  l’intention initiale, tout en conservant la continuité du texte.
- Dans l’éditeur, le `span` d’ancre réserve la place sans porter le décor de
  manipulation. Un enfant représentant le bdc marque cette surface et accueille
  l’aperçu image ou vidéo lorsque la source est disponible ; la prise est un
  élément superposé qui ne participe pas à la taille. Ce décor d’édition n’est
  pas exporté dans le markup destiné à CodPlay.
- L’extension d’ancre sera écrite pour Elcé sur Tiptap : la piste à éprouver
  représente l’ancre par un nœud inline identifié et exporte un `span`
  portant son `id` et son `data-part` dans le HTML statique.
  Le perso CodPlay du bdc ancré vise cette part par `move`, selon le circuit
  de montage `layout`. Cette piste ne vaut pas choix confirmé de bibliothèque
  tant que le dépôt, le repositionnement de l’ancre, la continuité du texte
  et la réservation CSS n’ont pas été vérifiés dans l’éditeur et le player.
- Le bdc ancré dispose de toute la largeur du flux de texte. La demi-largeur,
  avec placement à gauche ou à droite, est reportée.
- Les formats prédéfinis sont 4:3 pour une image horizontale, 3:4 pour une
  image verticale et 16:9 pour une vidéo. L’image horizontale occupe toute
  la largeur du flux de texte. L’image verticale est moins large afin de
  conserver sensiblement la même surface affichée. À largeur de flux égale
  à `W`, un repère exact est `W × 3W/4` pour l’horizontale et
  `3W/4 × W` pour la verticale. L’image verticale est centrée dans le flux.
  La vidéo 16:9 occupe la largeur disponible du flux à l’intérieur de marges.
  Choix de réalisation proposé : des marges symétriques et adaptatives,
  dont la valeur CSS sera ajustée lors de la validation visuelle, sans en
  faire un réglage de l’auteur.
- Pour un bdc image à contenu unique, le builder génère un seul perso
  CodPlay `img`, sans perso supplémentaire consacré à son rendu. La carte
  « image avec légende » est un autre cas : ses deux zones donnent lieu à
  une composition image et texte dans l’architecture HTML fixe de son
  preset, sans demander au composant `img` de créer la légende. Le choix
  éventuel de `figure` appartient à ce markup de carte, pas au bdc image
  simple.
- Aucun champ de saisie du texte alternatif des images n’est requis dans
  l’éditeur du POC. Cette décision d’interface ne retire pas la propriété
  `alt` du composant image CodPlay ; son éventuel emploi par le builder reste
  à définir lors de la construction.
- Lorsqu’un bdc ancré est sélectionné, une icône montre son point d’insertion
  dans le texte. L’auteur déplace cette icône par glisser-déposer pour
  repositionner l’insertion, en conservant le contenu associé.
- Le fonctionnement de cette ancre doit rappeler celui des traitements de
  texte pour rester compréhensible.
- Supprimer l’ancre ramène son contenu dans le catalogue.

La réservation réelle de l’espace par le mécanisme CSS reste à éprouver
dans le navigateur, y compris après édition du texte et changement de
largeur. Cette description est une décision de construction à valider ;
elle ne certifie pas encore le comportement du `span`.

### Insertion d’un autre bdc et propriété `embedded`

- « Conteneur » désigne ici la possibilité d’insérer un autre bloc de contenu,
  par exemple une Diapo en carrousel.
- Ce bdc est stocké dans le catalogue et inséré dans le contenu d’une page ;
  son insertion ne constitue pas une nouvelle page du scénario.
- La notion `embedded` est une propriété de l’application métier seulement.
  La génération de la scène ignore cette distinction : le contenu suit le
  circuit normal de génération, sans contrat `embedded` à ajouter aux scènes,
  à Sighty ou à CodPlay.
- Cette possibilité est à prendre en compte dès la conception et vérifiée
  dans la tranche Diapo du POC. Un écart du circuit existant doit être
  consigné et tranché dans le plan avant de modifier ce périmètre.

### Création d’un bdc hors page — direction retenue

- Une action depuis le catalogue ouvre un espace de création hors page pour
  les types proposés par l’interface. La zone centrale et les outils de
  l’éditeur sont réutilisés pour un seul bdc, sans le flux d’une page.
- Dans le POC, l’insertion dans le flux passe par dépôt direct. Le parcours
  au curseur suivi d’un clic sur une icône est réservé à une étape suivante,
  avec les mêmes commandes. Le choix d’un nouveau bdc s’oriente vers une
  rangée d’icônes, une par type disponible, plutôt que vers une modale imposée.
  Une icône de type se glisse pour créer un bdc ; une référence du catalogue
  se glisse de la même façon. Déposer un bdc disponible l’affecte à
  l’insertion, tandis que déposer une référence de média crée un nouveau bdc
  qui utilise ce média réemployable. Chacun de ces dépôts crée l’ancre au
  point de dépôt en un seul geste ; la pose et le placement passent par les
  mêmes commandes documentaires, avec des opérations de création adaptées
  à la source.
- La création d’un type plus élaboré, tel qu’un diaporama, peut ensuite
  utiliser l’espace isolé. Une fois le bdc créé, l’éditeur revient à la page.
  Pour un bdc ancré, sa zone d’édition le rouvre dans cet espace isolé pour
  le modifier. La position et la forme exactes de cette zone restent à
  définir avec l’interface.
- Le dépôt d’un fichier image depuis l’ordinateur déclenche, en un seul
  geste utilisateur, une suite d’opérations par le système de commandes :
  créer la référence du média dans le catalogue, créer un bdc image qui
  utilise ce média, créer l’ancre au point de dépôt, puis placer ce bdc à
  cette ancre. Il n’existe pas de circuit de mutation parallèle pour ce
  raccourci. Le regroupement des commandes et le traitement d’un échec
  pendant la suite restent à définir.
- Le dépôt de fichier passe par la façade métier `ElceAnchorDropFacade`, puis
  par l’événement XState `section.change`. `ElceAnchorDropService` prépare la
  cible et le commandement ; la machine XState séquence la sauvegarde du média,
  la création du bdc, l’insertion de l’ancre et l’enregistrement de la source
  de lecture. Les changements de contenu, de déplacement et de suppression
  empruntent la même commande et la file portée par la machine. Cette file est
  nécessaire car deux sauvegardes IndexedDB concurrentes pouvaient sinon
  appliquer deux `markup` issus de sélections différentes dans un ordre inverse.
- Pour le POC, l’interface présente une liste de types créables selon le
  contexte : la section texte est proposée dans une page, mais pas dans
  l’espace de création isolé. Cette restriction relève de la logique de
  l’interface, et non du schéma ou d’une interdiction structurelle dans les
  données. La liste pourra évoluer sans modifier le modèle du document.
- Cette direction conserve l’usage unique des bdc et le réemploi possible
  des médias. Elle est éprouvée avec les bdc simples à la tranche Médias,
  puis avec la Diapo à sa tranche ; les types proposés suivent ceux
  effectivement présents à chaque étape.

Points à préciser ensuite :

- confirmer par l’intégration que l’import d’un fichier vidéo suit le même
  circuit que l’import d’image, puis l’inclure dans la tranche Médias ;
- changement de ligne, proximité de plusieurs ancres et suppression d’une
  sélection de texte qui contient une ancre ;
- valider visuellement l’ajustement des fichiers aux cadres 4:3, 3:4 et
  16:9 ainsi que les marges vidéo, en partant du cadrage `cover` de la
  démo 5 ; ajuster les valeurs CSS pendant la réalisation ;
- régler les seuils et les durées des réactions automatiques à la visibilité
  en partant des exemples de la démo 5, puis vérifier leur comportement
  initial et lors d’une relecture ;

### Rendu alternatif du composant image — demande à cadrer dans CodPlay

Le [contrat d’écriture d’une scène](../../codplay/specs/scene-authoring-spec.md)
fait produire au builder Elcé un `SceneDoc` composé de persos. Dans ce contrat,
un perso `img` reçoit notamment sa source et sa cible `move` ; le composant
CodPlay [crée et conserve lui-même l’image native](../../codplay/specs/image-component-v2-spec.md).
Le builder ne fournit donc pas la balise `<img>`. La
[démo de défilement](../../demos/src/v2/demos/scroll-container/main.ts)
compose un perso `tag` de type `figure` avec un second perso `img`. Elcé ne
reprend pas cette configuration pour ses images simples : un bdc image à
contenu unique produit un seul perso `img`, y compris si son rendu évolue.
Une carte « image avec légende » compose séparément une zone image et une
zone texte dans son markup fixe ; elle ne change pas le contrat du composant
image. Un éventuel `figure` relève de ce preset, pas du perso `img`.
La [démo 5](../../demos/src/sighty/demo5/scenes/content-page-scene.ts)
observe son perso `figure` distinct ; pour Elcé, l’observation de visibilité
devra être exercée sur l’unique perso `img` avant d’en retenir les mêmes
réactions automatiques.

Le besoin exprimé de remplacer le rendu HTML propre à `img` par un markup
choisi doit respecter cette unité de perso ; les
[types actuels](../../codplay/src/runtime/components/image/image-types.ts)
ne déclarent pas de markup alternatif. Il faut en préciser la portée dans le
[plan propriétaire de `img`](../../codplay/plan/components-image-input-polygon-svg-plan.md)
avant toute modification du cœur.

Le rendu alternatif reste à cadrer pour une évolution ultérieure du
composant. La première version du POC utilise son rendu actuel et un seul
perso `img` par bdc image à contenu unique ; la carte à légende compose
plusieurs zones dans son architecture HTML fixe par le builder Elcé. Son
choix de balises est à préciser dans la définition du preset.

Pour cette évolution, le builder Elcé fournira le markup alternatif dans sa
déclaration de scène. Elle suit la règle générale du sujet 3 :
l’utilisateur de l’éditeur n’écrit jamais de HTML. CodPlay restera responsable
de son image native.

Points à décider pour cette extension : comment son markup accueille l’image
native gérée par CodPlay au sein de l’unique perso `img`, quel rendu utiliser sans
markup alternatif et quelles garanties préserver pour la source, le texte
alternatif, les services, les animations et la conservation du nœud image.
La politique de sanitation des templates est encore à relire dans le
[plan de représentation](../../codplay/plan/component-render-representation-plan.md).

Résultat attendu : gestes et règles d’insertion définis, preuve visuelle du
mécanisme CSS et contrat du rendu image alternatif clarifié dans son plan
propriétaire avant toute implémentation qui en dépend.

## Sujet 6 — Cartes, layouts et adaptation à l’écran

**Rôle des cartes fixé ; sélection des presets initiaux et adaptation à
éprouver.**

Le player doit fonctionner sur mobile, tandis que l’éditeur du POC reste
destiné à l’ordinateur. Ce besoin accepté au sujet 3 devra faire l’objet
d’une validation de lecture réelle.

- Une **carte** est un preset de layout réutilisable avec une architecture
  HTML fixe. Ce markup définit des zones de contenu et leurs emplacements ;
  chaque zone porte le preset de catégorie qu’elle admet (texte ou média/bdc).
  Le contenu renseigné dans ces zones appartient à son utilisation dans un
  bdc ; il n’est pas rendu réemployable par la seule réutilisation du preset.
  Les médias demeurent des ressources réemployables.
- Le builder Elcé instancie ce markup, lui donne les `id` explicites requis
  pour ses éléments parents et expose les emplacements nécessaires aux
  persos CodPlay. L’auteur ne rédige jamais ce HTML. La forme exacte de
  chaque preset, y compris les balises sémantiques et ses zones, est fixée
  lors de sa définition puis vérifiée dans le vrai player. La projection
  envisagée est un perso `layout` portant ce markup et des parts `data-part`
  pour accueillir les persos de chaque zone ; son raccord au
  [contrat de layout](../../codplay/specs/layout-component-spec.md) doit être
  vérifié, sans enveloppe supplémentaire inventée par Elcé.
- Une carte à un seul contenu existe techniquement, mais n’a pas besoin
  d’identité visible dans l’éditeur : elle se confond avec son contenu.
  L’image ou la vidéo simple reste ainsi un bdc simple ; le builder n’ajoute
  pas de carte reconnaissable autour d’elle.
- Les cartes ne sont pas propres aux Diapos : une Section et une Question
  peuvent utiliser une carte, comme une carte remplie peut former un élément
  de Diapo. Exemples de structures : titre en haut, corps au milieu, note en
  bas ; ou image à gauche, titre et message à droite. Le modèle distingue
  donc le preset de layout, son instance remplie et le bdc qui l’utilise.
- Le preset **Question** comporte les zones titre, illustration, question,
  réponses et validation. Les trois dernières sont obligatoires ; le titre
  et l’illustration sont facultatifs. Un autre preset associe une image et
  sa légende. La légende provient de la ressource média commune, selon le
  choix du sujet 2, tandis que l’image simple reste un contenu unique.
- Le POC retient quatre presets fixes au total : Section (titre facultatif
  et texte), Question, image avec légende, et Message (zones de texte avec
  note de pied). Le premier preset de Section est amorcé à l’étape 1 ;
  l’étape Presets complète cet ensemble, sans créer une cinquième définition
  concurrente. La photo ou vidéo seule en plein cadre reste le cas de carte
  à contenu unique, confondu avec son contenu dans l’éditeur. La structure
  média à gauche avec titre/message à droite reste un exemple d’extension
  ultérieure. La conception et l’édition des presets par l’auteur viendront
  plus tard ; aucun éditeur de zones ou de décor libre n’est requis pour
  cette tranche.
- Vérifier si la structure `card` et ses zones existantes peuvent servir à
  ces presets sans dupliquer un circuit d’authoring. Un preset Elcé ne devient
  pas pour autant une scène ou un composant CodPlay autonome.
- Vérifier le player sur une largeur de téléphone et une largeur de bureau,
  en portrait et après redimensionnement. Choisir les dimensions exactes
  comme fixtures de validation au moment de la réalisation.
- Lors de la tranche Diapo, définir son adaptation à un écran étroit tout
  en respectant l’absence de scroll interne.

Résultat attendu : premiers layouts et critères d’adaptation à l’écran.

## Sujet 7 — Diapo et automatisation des cartes

**Fixe — comportement de lecture arrêté ; intégration technique à vérifier
à l’étape Diapo.**

Elcé vérifie ici la construction et la lecture de pages Diapo. L’édition
détaillée du déroulement, des transitions et de l’audio relève du projet Éditeur,
distinct d’Elcé : le POC ne construit aucune interface de montage ou de
réglage de ces comportements.

- La première version de la Diapo utilise le type `carousel` de
  `capsule-automation` pour présenter successivement des instances de cartes
  remplies avec des presets de layout, éventuellement différents. Les autres
  types de capsule viendront après. Une seule carte est présentée à la fois.
- Une page de type Diapo est lisible selon deux modes de défilement **des
  cartes** : manuel ou automatique. Une voix associée à la page sélectionne
  par défaut le comportement automatique ; l’auteur n’a pas à régler le
  mode, les durées ou les transitions. L’avance automatique des cartes ne
  déclenche pas à elle seule un passage à la page suivante : le
  bouton « Suivant » reste disponible indépendamment de l’avancement des
  cartes. Pour le bdc Diapo inséré dans un Flux, le mode manuel reste la
  portée retenue pour le POC. Sans voix, une page Diapo reste donc manuelle ;
  la présence de la voix est le seul déclencheur de l’automatique.
- En mode manuel, le lecteur change de carte par un geste de cliquer-glisser
  standard, utilisable aussi au toucher, et par un mini navigateur à points.
  Le parcours s’arrête aux extrémités ; la boucle des cartes est reportée.
  Une nouvelle lecture de la page repart de la première carte. Dans le
  parcours automatique avec voix du POC, ces commandes ne sont pas proposées :
  la progression suit les plages calculées, sans geste de repositionnement.
- Les onglets ne sont pas nécessaires dans cette première version. Lorsqu’ils
  seront ajoutés, chaque onglet correspondra à une seule carte.
- La Diapo ne bloque pas le défilement de la page qui la contient : une
  section placée après elle reste atteignable sans parcourir toutes ses
  cartes. Toute condition éventuelle pour quitter cette page relève de la
  configuration de la page et du scénario, pas d’un verrou de défilement.
- Insérée comme bdc dans une page Flux, elle prend la largeur du fût de texte
  et ne bloque pas le défilement du Flux. Une **page de type Diapo** est
  distincte : elle occupe tout le lecteur, n’a pas de scroll et son bouton
  « Suivant » est disponible sans attendre un repère de bas de page ni la
  dernière carte. Le constructeur de scénario applique cette règle de page ;
  les éventuels gardes de chapitre restent une responsabilité distincte de
  Sighty. Dans les deux présentations, la Diapo n’a pas de défilement interne.
- Le passage manuel est exprimé par les événements et les actions des persos
  CodPlay de la scène. Le player Elcé ne crée pas de composant de Diapo hors
  de ce circuit. Le contrat examiné de
  [`capsule-automation`](../../authoring/capsule-automation/src/types/public.ts)
  résout le placement et les événements à partir de plages temporelles
  fournies par le caller ; la tranche vérifie comment son résultat se
  raccorde aux actions de persos pour la sélection manuelle,
  sans supposer une API de pilotage manuel dans cette bibliothèque.
- Garder les transitions dans des configurations prédéfinies pour le POC.
  Avec une voix, la durée du fichier est répartie également entre les `N`
  cartes de la page : la plage de la carte `i` va de `i × durée / N` à
  `(i + 1) × durée / N`. La fin de la dernière carte coïncide ainsi avec la
  fin de la voix ; ce parcours ne comporte pas de carte vidéo dans le POC.
  L’attente de la fin d’une vidéo avant de passer à la carte suivante est
  une direction acceptée pour plus tard, sans implémentation demandée ici.
  Pour une Diapo manuelle qui contient une vidéo, l’option `auto` appartient
  à l’utilisation de cette vidéo dans la carte, pas à la ressource média
  réemployable du catalogue. La vidéo sur la carte active et visible démarre
  si cette option est active ; sinon, sa lecture est manuelle. Elle se met en
  pause lorsque sa carte cesse d’être active ou visible. Le raccord des deux
  conditions à l’observation et aux actions des persos est à vérifier.
- Une page Diapo peut porter une voix facultative. Pour rester dans le POC,
  elle est une ressource audio du catalogue associée à la page, comme tout
  autre média, et lue par un perso CodPlay `media` de type `audio`, capacité
  déjà présente dans le runtime. La voix démarre au lancement de la page,
  se lit une seule fois et est coupée dès que le lecteur quitte cette page.
  Elle n’accompagne pas les cartes en boucle. Aucun réglage de lecture, de
  mixage ou de synchronisation de la voix n’est créé pour le POC. Ces règles
  sont à vérifier sur ordinateur et mobile avec une page qui contient une voix.

- La carte message conserve la règle déjà exprimée : ses champs sont
  facultatifs, avec au moins un élément de titre ou de texte. Préciser la
  validation de cette règle au moment de concevoir son formulaire.
- La saisie d’une carte message n’est pas limitée en longueur dans le POC.
  L’auteur juge lui-même le résultat dans le cadre visuel ; aucune aide à la
  longueur ou adaptation automatique du texte n’est demandée à ce stade.

La page référence éventuellement un média et une configuration de lecture
issue de presets déclaratifs, comme ses autres propriétés de projection.
Le preset avec voix
décrit la source de durée (`audio`), sa distribution égale entre cartes et
la lecture unique ; le preset manuel décrit les gestes de navigation. Le
builder résout ces objets et produit les plages des cartes et les actions
des persos par le même circuit. La présence d’une voix ne doit pas créer une
branche de lecture ou une suite de conditions spéciales disséminées dans le
builder et le player.

Les instances de cartes utilisent les presets du sujet 6 ; le contenu du
diaporama n’est donc pas un nouveau catalogue de définitions de zones.
`capsule-automation` reste un outil de résolution. Son entrée publique
demande déjà la plage temporelle de chaque enfant ; elle ne calcule pas
`durée / N` à partir d’un média. Le raccord du calcul déclaratif Elcé au
carousel et aux gestes manuels doit être éprouvé avant de fixer le builder,
sans lui prêter une API de navigation qu’il ne garantit pas. Examiner le
circuit de distribution déjà présent dans `scene-factory` avant d’en créer
un autre, sans introduire sa dépendance CodPlay V1 dans Elcé.

La distinction entre bdc Diapo dans un Flux et page de type Diapo est une
donnée Elcé ; elle conduit à deux projections de scène et de navigation,
sans introduire un nouveau type de vue ou de composant dans CodPlay. La
présentation d’une page Diapo et son bouton « Suivant » doivent être vérifiés
par le chemin Sighty/CodPlay.

Résultat attendu : description auteur du diaporama et usage attendu du
circuit capsule existant.

## Sujet 8 — Questions et évaluation de chapitre

**Fixe — décisions de produit retenues, non appliquées ; raccord au circuit
Sighty/CodPlay à vérifier dans la tranche.**

La [démo 5](../../demos/src/sighty/demo5/scenes/quiz-page-scene.ts)
fournit l’interaction de référence : choisir une ou plusieurs réponses,
valider, calculer le résultat, puis réinitialiser la question lors de sa
relecture. Le cas de choix multiples y compare l’ensemble exact des réponses
sélectionnées à l’ensemble juste. Le
[contrat V2 d’`input`](../../codplay/specs/input-component-v2-spec.md)
ne certifie pas à lui seul tout ce parcours ; la tranche devra l’exercer
dans le vrai player.

- Le bdc de contenu est une **Question**, que l’auteur peut placer où il le
  souhaite dans une page. Le POC limite chaque page à une seule Question,
  sans imposer qu’elle suive le texte ou termine la page. Elle porte son
  énoncé, ses réponses et le choix juste. L’interaction et la vérification
  des réponses reprennent la démo 5.
- La validation de base traite la réponse. La **page** détermine quelles
  actions supplémentaires elle déclenche : révéler la bonne réponse, donner
  accès à la page suivante, y passer directement ou débloquer le bouton de
  navigation. Ces effets sont distincts et passent par les événements et
  actions du scénario Sighty et des persos CodPlay ; ils ne sont pas un
  comportement universel du bdc Question. Pour le POC, leur combinaison
  est déduite automatiquement du contexte de la page et du chapitre ;
  l’interface permettant à l’auteur de régler ces effets viendra plus tard.
  Le POC n’exige pas une réponse juste pour quitter chaque page contenant
  une Question. Une telle condition sera un choix de l’auteur lorsque cette
  interface existera. Le score exigé à la sortie d’un chapitre Évaluation
  est une condition distincte.
- Comme dans la démo 5, une réponse validée ne peut plus être modifiée
  pendant cette lecture ; la relecture réinitialise sélection et état
  `submitted` par `showMode: 'reset'`. Le résultat enregistré dans le
  signet de session reste présent jusqu’à une nouvelle réponse.
- **Quiz** ou **évaluation** désigne le système qui cumule et évalue les
  résultats des questions d’un chapitre ; cette responsabilité appartient
  au chapitre. Un chapitre Évaluation peut mêler librement des pages de
  texte et des pages contenant des questions : seules les réponses aux
  questions alimentent son résultat. La
  [démo 5](../../demos/src/sighty/demo5/course-data.ts) montre
  le cas d’une évaluation finale réussie quand ses trois réponses sont
  justes. Pour Elcé, chaque Question vaut un point : le score du chapitre
  est le nombre de réponses justes divisé par le nombre total de Questions
  du chapitre. Une Question sans réponse compte comme incorrecte. Le
  chapitre est réussi si le score atteint ou dépasse 80 %. Ce seuil est
  fixe pour le POC ; son réglage par l’auteur viendra avec une interface
  ultérieure. Si le chapitre ne contient aucune Question, le pourcentage
  est indéfini : la prévisualisation auteur du POC laisse néanmoins lire
  ses pages et poursuivre le parcours, sans lui attribuer un score fictif.
  Un futur mode de diffusion refusera cette évaluation incomplète ; cette
  validation de diffusion reste hors du POC.

La comparaison avec la démo 5 donne un point de départ précis : une page de
contenu active « Suivant » après le repère bas ; la question du premier
chapitre l’active après une réponse juste ; une question de l’évaluation
finale l’active après une réponse enregistrée, même fausse ; la dernière
sortie est gardée par le résultat global. La condition de réponse juste du
premier chapitre est propre à ce cours et n’est pas appliquée par défaut
aux pages Elcé. Comme dans la démo 5, une sortie refusée par le résultat
global suit `onDenied` et ramène au début du parcours ; la relecture permet
une nouvelle réponse.

Dans le POC, une page contenant une Question active « Suivant » seulement
après **les deux événements** : le lecteur a atteint le repère bas de page
et a validé sa réponse. Leur ordre n’importe pas ; la Question peut être
placée librement dans la page. Une réponse fausse débloque aussi le bouton.
Sur une page Flux sans Question, le repère bas suffit. Aucun bdc ne bloque le
défilement intérieur. Le résultat cumulé du chapitre Évaluation reste un
garde distinct au passage à la suite du chapitre.

Le POC ne doit pas déduire de ces points un passage automatique à la page
suivante : la démo 5 emploie le bouton « Suivant » et les gardes Sighty.
Les autres effets possibles du bouton « Valider » restent des possibilités
pour une interface de réglage ultérieure tant que leur correspondance au
contexte du POC n’est pas décidée.

L’enrichissement éventuel de la question et des réponses ainsi que le
formulaire d’illustration image/vidéo seront décidés dans la tranche en
réutilisant les outils d’édition et le catalogue déjà construits.

Résultat attendu : création libre des questions, actions de validation
portées par la page, résultat cumulé au chapitre et règles de relecture.

## Sujet 9 — Lecture, animations et passage à la suite

**Circuit de lecture et conditions du POC fixés ; modes ultérieurs reportés
aux tranches concernées.**

La première démonstration reprend au plus près le système de navigation de
la [démo 5](../../demos/specs/sighty-scroll-course-demo-spec.md) :
le graphe de vues et les actions de navigation sont produits pour Sighty,
les commandes Précédent/Suivant et le menu empruntent son circuit public,
et le repère de bas de page observé dans le `scroll-container` racine autorise
« Suivant » pour une page Flux sans Question. Après le montage, si le contenu
tient déjà dans le scrollport, la composition émet ce même signal de fin afin
que « Suivant » soit disponible immédiatement ; elle ne crée pas un second
circuit de navigation. Cette vérification complète la règle CodPlay qui
synchronise la première observation sans émettre `enter`.
Avec une Question, ce repère et la validation de la réponse sont nécessaires,
indépendamment de la position de la Question et de la justesse de la réponse.
Atteindre le bas ne change pas automatiquement de page. La page produit le
signal de lecture requis ; Sighty exécute la navigation et projette son
état dans les contrôles. Les gardes et actions empruntent les mêmes circuits
Sighty que la démo 5 ; leurs conditions de validation sont dérivées du
contexte de la page, et les résultats cumulés par le chapitre Évaluation.
Le réglage général des conditions d’accès est reporté. Le passage entre
**pages** par délai ou signal de fin de scène et ses combinaisons entre bdc
relèvent d’une tranche ultérieure distincte. L’avance automatique des
**cartes** d’une Diapo ne met pas en œuvre ces modes de navigation entre
pages. Ces comportements restent des intentions d’Elcé, sans implémentation
ni vérification dans l’application.

Une page de type Diapo n’a pas de repère de bas de scroll. Son bouton
« Suivant » est disponible dès la lecture de la page, sans attendre le
parcours de toutes les cartes. Le constructeur de scénario déduit cette
règle du type de page ; les gardes de chapitre, notamment celui d’un
chapitre Évaluation, restent distincts. Le raccord de cette règle aux
contrôles Sighty de la démo 5 est à vérifier à la tranche Diapo.

- Les commandes de parcours et leur présentation reprennent celles de la
  démo 5 ; aucune commande de navigation propre à Elcé n’est ajoutée au POC.
- Les apparitions d’image, la lecture et la pause des vidéos suivent les
  événements et actions de persos CodPlay exercés dans la démo 5, sans
  interface auteur de réglage. Les scènes relues suivent le mode de reprise
  du scénario Sighty, notamment le reset des questions décrit au sujet 8.
- Aucun bdc, Diapo ou Question comprise, ne bloque le défilement intérieur
  d’une page Flux dans le POC. La révélation de la réponse est un effet dans
  cette page ; les conditions de progression agissent sur le passage entre
  pages, par les gardes et actions du scénario Sighty. La combinaison de
  `scroll-end`, délai et fin de scène et le début ou la suspension d’un délai
  seront conçus dans les tranches qui introduisent ces modes, sans
  généraliser un mécanisme
  absent de la démo 5.
- La dernière page de la première démonstration ne provoque pas de passage
  automatique. Le scénario généré définit sa borne et Sighty gère les
  actions disponibles comme dans la démo 5 ; l’acceptation vérifiera ce cas.

Résultat attendu : comportement de lecture de la première démonstration
défini, et questions des modes ultérieurs rattachées à leurs tranches.

## Sujet 10 — Sauvegarde du document et ressources

**Sauvegarde locale retenue ; support durable des fichiers importés à
valider.**

Le catalogue contient aussi les images et médias ajoutés à l’application.
L’import depuis l’ordinateur déjà retenu couvre les fichiers image, en
prenant l’éditeur comme référence. L’import d’un fichier audio pour la voix
est réservé à la tranche Diapo ; l’import depuis une URL est reporté.
Le catalogue conserve avec les ressources les métadonnées utiles à leur
projection, dont la durée des médias temporels lorsqu’elle est nécessaire.
Pour une voix de Diapo, cette durée doit être connue avant de construire la
scène, sans demander de saisie à l’auteur.
L’utilisateur souhaite inclure les fichiers vidéo dès la V1 si
leur import emploie la même méthode que celui des images. La référence ed2
décrit un principe commun de dépôt et de typage des fichiers image/vidéo,
mais aucun import Elcé n’est encore implémenté ou validé. La construction
doit donc vérifier que les deux suivent un même circuit de catalogue et de
commandes, puis inclure la vidéo si cette condition est remplie ; sinon,
le point revient au cadrage avant de figer la tranche.
La [discussion ed2 sur le chutier](../../editor/plan/notes/2026-07-10-app-construction-discussion.md)
décrit un principe d’import par bouton ou dépôt ; l’adaptation d’Elcé et le
stockage effectif des fichiers restent à concevoir. L’import par dépôt dans
le flux crée une référence au catalogue avant le bdc image ; cette image peut
être réemployée par d’autres bdc, selon la distinction du sujet 2.

La première démonstration doit retrouver le document après fermeture et
réouverture de l’application. On essaiera de conserver l’unique document
métier et ses médias dans IndexedDB, derrière une frontière isolée du
contrôleur et des commandes. La base et son accès restent simples, adaptés
au caractère temporaire du POC. Un petit helper peut être employé si l’API
navigateur rend le code inutilement verbeux. Cette frontière permettra ensuite
de passer à SQLite et de gérer plusieurs documents sans changer le document
métier ni le builder. Le format sauvegardé portera une version simple et son
chargement sera vérifié ; aucune mécanique de migration anticipée n’est requise.

Les médias importés doivent eux aussi rester utilisables après réouverture.
Une référence vers un fichier choisi sur l’ordinateur ou une URL temporaire
ne suffit pas à conserver ses octets. La conservation commune du document,
des métadonnées de catalogue et des fichiers image/vidéo dans IndexedDB sera
vérifiée par une fermeture et réouverture réelles. La tranche Diapo étendra
la même preuve à son fichier voix et à la durée utilisée pour répartir les
cartes. Il ne faut pas introduire
SQLite dès le POC.

La persistance de la progression et des réponses du lecteur est hors du POC.
Ce besoin sera traité plus tard dans le cadre de SCORM. Le signet nécessaire
aux gardes et aux résultats pendant une session continue de suivre le
parcours de la démo 5 ; il n’est pas sauvegardé avec le document d’auteur.

Le transport d’un document et de ses médias vers un autre navigateur n’entre
pas dans les tranches proposées ; il pourra être ajouté à une tranche
ultérieure si ce besoin apparaît. Le dépôt direct dans le flux est déjà
requis. Le sélecteur de fichiers et le dépôt dans le
catalogue doivent employer le même circuit d’import s’ils sont présentés
dans l’interface ; leur forme exacte relève de la construction. Un contenu
incomplet ou un média indisponible doit être signalé dans le parcours
d’acceptation, sans être masqué par le builder ou le player ; la présentation
de cette erreur sera définie avec l’interface.

Résultat attendu : périmètre de persistance et gestion des ressources.

## Sujet 11 — Intégration et choix techniques

**Principe accepté ; détails à instruire après les décisions fonctionnelles.**

La génération suit le processus retenu au sujet 1, avec deux projections
distinctes du même document métier :

`Document Elcé → builder de scènes → SceneDoc des pages → CodPlay`

`Document Elcé → construction du scénario → scénario Sighty`

Le principe est commun à l’éditeur existant ; Elcé possède ses propres
schémas. Les types, API et choix de réutilisation ne sont pas encore arrêtés.
Les bdc sont des objets Elcé. Le builder construit les éléments CodPlay
nécessaires à chaque bdc. Par défaut, il construit une story regroupant les
persos et portant l’état propre du bdc, puis assemble ces stories dans la
scène de la page. Par exception, un bdc simple, comme une image, ne produit
qu’un perso et n’a pas besoin de story autonome. Le format `SceneDoc` place
tout perso dans une `StoryDoc` ; pour respecter ce contrat, une story technique
commune de page est la solution de génération proposée pour accueillir les
persos simples, sans créer d’état autonome par bdc. Ce rangement sera vérifié
avec CodPlay et ne change pas le modèle métier Elcé.

Une story regroupe les persos d’un bdc, donne accès à ce groupe et porte son
état. Elle n’est pas un objet DOM et ne place pas ses persos. Le builder
traduit l’ordre des bdc en cibles et en ordre de placement des **persos** :
chacun vise par son `move` le `scroll-container` ou l’ancre qui doit le
recevoir. L’ordre des bdc ne pilote pas l’activation des stories ; Elcé ne
demande aucune activation temporelle des stories entre elles. L’avance
automatique des cartes d’une page Diapo reste une règle interne à la Diapo,
sans planifier l’activation des autres bdc. Les straps de story traitent
les calculs internes au bdc ; les straps de scène traitent les calculs communs
à la page.

Pour une page Flux, le builder crée le perso `scroll-container` racine de
contenu, puis y place les persos du flux et des bdc générés. Il reprend les
observations et actions déjà exercées dans la démo 5, notamment le repère bas
et les réactions aux entrées et sorties de visibilité, sans inventer de
circuit parallèle. Des persos issus de stories distinctes peuvent viser ce
même scrollport ; leur placement et leur observation doivent être exercés dans
le vrai player avant de figer l’assemblage de la page.

Pour une page de type Diapo, le builder crée une scène sans racine
`scroll-container` de page, avec un cadre occupant le lecteur. Le
constructeur de scénario lui associe la règle de navigation sans repère bas.
Un bdc Diapo inséré dans une page Flux emprunte, lui, le builder Flux et son
scrollport ; seul son propre contenu n’a pas de scroll interne. Ces deux
projections réutilisent les mêmes presets de cartes et le même circuit de
persos pour la Diapo.

Chaque action de rendu est déclarée dans `actions` du perso CodPlay qui la
porte. Une propriété `data` ne sert pas à décrire ces actions ni à stocker
leurs presets : les données transmises par les événements et actions
correspondent aux valeurs du déroulement courant. Cette règle concerne la
projection des persos Elcé ; le `scenario.data` statique de Sighty, lorsqu’il
est nécessaire à ses guards et actions, reste une surface distincte.
Pour les résultats cumulés à l’échelle d’un chapitre, l’état vivant appartient
plutôt à Sighty : le POC reprend par défaut le circuit de la démo 5, dont le
signet de session est porté par le contexte du scénario. Ce partage précis
reste à vérifier lors de la construction des questions et de l’évaluation ;
plusieurs découpages restent possibles si le cas réel l’exige.

Un déplacement de page dans un chapitre ne reconstruit aucune scène ; une
édition de page ne reconstruit que sa scène. Les identités nécessaires à cette
construction incrémentale doivent rester stables à travers le réordonnancement.
Le constructeur du scénario reste séparé du builder de scènes. L’éditeur
reconstruit intégralement le scénario lorsqu’il doit l’actualiser, sans utiliser
les mutations live que Sighty sait accepter ; les scènes inchangées sont
réemployées. L’application gère ensuite l’accès direct à la page courante.
La lecture des bdc, y compris le passage manuel ou automatique entre cartes
d’une page Diapo et sa voix facultative, est générée dans les scènes
avec les persos, leurs événements et leurs actions CodPlay.
L’application Elcé ne crée pas de composant de lecture extérieur pour
reproduire ce fonctionnement.

### Projection à établir par type de bdc

| Élément Elcé | Projection de scène prévue pour le POC | Preuve attendue |
| --- | --- | --- |
| Page Flux | La story de page déclare le perso `scroll-container` racine de contenu, le support du flux et le repère bas. Ces éléments sont construits à partir de la page, sans devenir des bdc du catalogue. | Les persos du flux sont placés dans le scrollport par leurs `move`, le repère bas est observé par CodPlay, et l’événement public atteint l’action Sighty de la démo 5. |
| Page Diapo | Une scène de page sans `scroll-container` de page présente le carousel sur tout le lecteur ; le preset de lecture résolu fournit les plages des cartes et, si une voix est présente, un perso `media` audio ; le constructeur de scénario n’attend aucun repère bas pour « Suivant ». | La page ne défile pas ; avec une voix, chaque carte occupe une part égale de sa durée, la voix démarre avec la page, se lit une fois et s’arrête à sa sortie ; « Suivant » reste disponible par le circuit Sighty. |
| Section titre/texte | Le markup de la Section réserve d’abord un hôte de titre, puis porte le HTML statique du texte ; la story du bdc monte le titre dans cet hôte par `move`. | Le rendu conserve l’ordre titre puis texte sous le perso `scroll-container` créé pour la page. |
| Image ancrée | Un seul perso `img` sans story autonome de bdc, accueilli dans la story technique de page ; ses actions de visibilité sont déclarées sur lui. | L’image déjà visible et celle qui entre ensuite dans le scrollport réagissent comme prévu, sans perso `figure`. |
| Carte image avec légende | Le preset fournit un markup fixe à deux zones qui accueille un perso `img` et un texte de légende fourni par le média ; le builder compose ces zones dans la story du bdc. | L’image et la légende occupent leurs emplacements sans modification interne de `img` ; deux utilisations du même média lisent la même légende. La structure HTML choisie pour le preset est inspectée. |
| Vidéo ancrée | Une story de bdc porte le perso `media` et les persos d’observation nécessaires au comportement de la démo 5. Les actions `START` et `PAUSE` appartiennent au perso média. | La lecture et la pause suivent la visibilité dans le scrollport, y compris après relecture. |
| Question | Le preset Question place titre et illustration facultatifs, puis question, réponses et validation obligatoires. Une story autonome porte les persos `input`, son état de réponse, ses `listen` et straps ; les persos déclarent les actions qui les concernent. | La réponse est validée puis communiquée au scénario, tout en laissant libre le défilement d’une page Flux. |

La [capacité scroll-container](../../codplay/specs/scroll-container-spec.md)
exige un parent logique scrollable pour `emit.observe`. Le
[registre de cibles](../../codplay/src/runtime/player/pipeline/mount-targets.ts)
et le [graphe résolu](../../codplay/src/runtime/player/pipeline/presentation-graph.ts)
représentent un parentage de persos à l’échelle de la scène, mais les exemples
de scroll validés placent les descendants dans une seule story. Ce constat
d’inspection ne certifie pas encore le placement sous un même scrollport des
persos issus de stories distinctes. La première preuve navigateur couvre ce cas
avant d’étendre le builder aux autres types de bdc. Si le circuit réel révèle
une limite, la décision revient au plan du propriétaire CodPlay avant tout
contournement local.

### Stack — base retenue avec ed2 comme référence

**Base React, XState, façade de commandes et application distincte acceptée ;
choix des helpers et outils annexes encore à éprouver.** Elcé est prévu comme
application et workspace distincts dans le monorepo. Ed2 sert de référence
pour le processus document métier → contrôleur/commandes → builder, ainsi que
pour les versions de stack ; ses données de scène, sa timeline et ses panneaux
ne définissent pas le modèle ou l’interface Elcé. Une abstraction réellement
commune pourra être extraite dans un package partagé si son contrat et sa
réutilisation sont démontrés, sans coupler les deux applications.

| Besoin Elcé | Base proposée | État du choix |
| --- | --- | --- |
| Application navigateur | TypeScript, Vite et React, comme dans [`editor/package.json`](../../editor/package.json) | Réutiliser les versions du monorepo au démarrage du workspace Elcé. |
| Document et interactions d’édition | XState et `@xstate/react`, avec un contrôleur et une façade de commandes propres à Elcé | XState pilote l’état de l’application. Reprendre la structure et la frontière documentaire [définies pour ed2](../../editor/plan/app/2026-07-12-app-controller-definition.md), puis adapter les commandes aux pages, bdc et médias Elcé. |
| Outils d’interface | Base UI et Tailwind, déjà dépendances d’ed2 ; CSS propre à Elcé pour la page et le player | Les composants et styles d’ed2 ne sont pas présumés réutilisables. Aucun composant shadcn n’est ajouté automatiquement. |
| Lecture | `codplay` et `@codplay/sighty` directement ; `@codplay/capsule-automation` à la tranche Diapo | Même circuit public de scène et scénario que la démo 5. |
| Texte WYSIWYG | Tiptap/ProseMirror comme candidat privilégié, conditionné à la preuve du placement d’un bdc ; autre solution seulement si cet essai échoue | Vérifier le dépôt et le déplacement de l’ancre dans le texte, l’export HTML statique vers `layout.markup`, le montage CodPlay à la part exportée et le raccord aux commandes Elcé avant de fixer la bibliothèque. |
| Persistance locale | Essayer IndexedDB pour l’unique document, ses métadonnées et les octets image/vidéo ; [`idb`](https://github.com/jakearchibald/idb) est le helper candidat | Garder une seule frontière d’accès simple. Utiliser `idb` si ses promesses et transactions rendent le code plus lisible que l’API native ; vérifier la relecture réelle du document et des médias. Aucune abstraction de base de données générale n’est nécessaire pour le POC temporaire. |
| Vérifications | Vitest pour le modèle, les commandes et le builder ; parcours navigateur réel pour l’édition et la lecture | Suivre les preuves d’intégration du sujet 12 ; choisir l’outillage navigateur au moment de les automatiser. |

La [documentation Tiptap](https://tiptap.dev/docs/editor/getting-started/install/react)
prévoit React et un contenu JSON. L’extension nécessaire au placement des bdc
n’existe pas dans Tiptap : **Elcé doit la développer**. Les API suivantes
offrent des points de greffe, sans fournir le comportement demandé :

1. Un [nœud personnalisé](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node)
   inline et atomique représente une ancre dans le JSON, avec un identifiant
   stable relié au bdc métier. Ses attributs, sa lecture éventuelle depuis du
   HTML et son `renderHTML` sont définis au même endroit. Le `renderHTML`
   produit le `span` identifié avec `data-part`, cible du perso CodPlay.
2. Une [NodeView](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views)
   propre à l’éditeur affiche l’icône de sélection et les affordances de
   déplacement ou de réouverture du bdc. Cette vue interactive n’est pas le
   HTML projeté dans le player ; Tiptap sépare explicitement NodeView et
   sérialisation. Une décoration visuelle peut compléter la NodeView si
   l’icône doit déborder du nœud.
3. Un [plugin ProseMirror enregistré par l’extension](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension)
   est la piste pour intercepter les dépôts externes via
   [`handleDrop`](https://prosemirror.net/docs/ref/#view.EditorProps.handleDrop)
   et obtenir leur position documentaire via
   [`posAtCoords`](https://prosemirror.net/docs/ref/#view.EditorView.posAtCoords).
   La commande de placement Elcé reçoit la source déposée et cette position ;
   l’insertion ou le déplacement du nœud utilise ensuite les transactions de
   l’éditeur, dont
   [`insertContentAt`](https://tiptap.dev/docs/editor/api/commands/content/insert-content-at)
   est un candidat. Le dépôt, le déplacement de l’icône et le retrait doivent
   tous emprunter la façade de commandes documentaire ; les détails de
   synchronisation entre transaction Tiptap et état XState sont à prouver dans
   l’essai, sans circuit métier parallèle dans React.
4. Le builder produit le HTML statique depuis le JSON avec
   [`generateHTML`](https://tiptap.dev/docs/editor/api/utilities/html) de
   `@tiptap/core` et le même jeu d’extensions. Il y ajoute ou vérifie les `id`
   exigés par CodPlay sur chaque élément parent du `markup`. Le player ne
   charge ni Tiptap ni la NodeView.

Cette greffe ne résout pas d’elle-même la disposition voulue : il faut
vérifier dans le navigateur que le `span` inline peut réserver la hauteur sous
la ligne et accueillir la racine DOM d’un perso image ou vidéo sans casser le
paragraphe. L’accueil éventuel d’un bdc dont la racine est un élément de type
bloc requiert un essai supplémentaire, car cette structure peut être
incompatible avec le contenu inline du `span`. Si le navigateur réorganise ce
DOM ou casse le flux, ajuster la représentation de l’ancre dans le plan avant
de figer Tiptap ; ne pas masquer ce problème par un second circuit de rendu.
L’éditeur Tiptap peut conserver son état de transaction local, tandis que les
modifications du document Elcé passent par la façade de commandes et XState ;
React ne porte pas une autre copie du texte métier. Les extensions sont limitées
aux enrichissements autorisés ;
le `StarterKit` inclut des fonctions supplémentaires et un Undo que le POC
ne demande pas. Le JSON est la source conservée par Elcé, le HTML une
projection recalculée lors du build de la page, sans saisie HTML par l’auteur.
Les éléments parents de ce `markup` doivent porter un `id` explicite selon
le [contrat CodPlay](../../codplay/specs/layout-component-spec.md) ;
la solution d’export le vérifie, y compris pour les paragraphes contenant
une ancre. IndexedDB permet de
conserver des objets structurés et des `Blob`/`File` dans une même base
([MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)).
Le helper [`idb`](https://github.com/jakearchibald/idb) garde les concepts
IndexedDB et expose `openDB` et des opérations asynchrones lisibles ; son
emploi sera décidé à la réalisation selon le code nécessaire, sans installer
de bibliothèque avant cet essai.
Le glisser-déposer et les ancres ne justifient pas encore une dépendance
supplémentaire : leur circuit sera choisi après l’essai WYSIWYG.

### Commandes et contrôleur — structure retenue pour Elcé

**Décision acceptée le 2026-10-01, non appliquée.**

L’application retient le modèle discuté pour l’éditeur :

- un contrôleur à machine d’état porte le document métier et l’état partagé
  de l’édition ;
- les intentions d’édition passent par une façade de commandes, voie unique
  de modification du document ;
- les commandes documentaires sont des transformations du document ; leur
  composition et leurs commits permettent le raccord ultérieur d’un historique ;
- les états d’interface et de geste restent distincts des données du
  document, et les commandes de lecture restent distinctes des mutations
  documentaires ;
- l’Undo n’est pas implémenté dans le POC. Le modèle doit permettre de
  l’ajouter ensuite sans refaire le circuit de modification du document.

La référence de l’éditeur utilise XState et des transactions de commandes.
Le détail de l’adaptation aux schémas Elcé, le découpage de la machine et
les réutilisations de code restent à instruire ; les états et commandes
propres à ed2 ne sont pas transposés automatiquement.

### Règles de conception retenues pour le POC

**Décisions du 2026-10-02, non appliquées.** XState détient l’état de
l’application et pilote ses transitions. React sert au rendu et à la liaison
avec la machine. Les composants d’affichage ne portent pas la logique métier
ni un second état applicatif ; les hooks React se limitent à la liaison XState
et à d’éventuels besoins strictement locaux, explicités au moment de leur
emploi. Aucun pont d’état ad hoc ne doit dupliquer ou synchroniser des états
concurrents entre React et XState.

Les règles métier, transformations et projections privilégient des classes
métier lisibles et testables, hors des composants de rendu. Les
constantes partagées résident dans une configuration commune. Les presets
sont des objets explicites, manipulables ultérieurement par une interface ;
une propriété n’est pas redéfinie dans plusieurs endroits. L’architecture
reste assez simple pour un POC : pas de validation ou de couche défensive
sans besoin démontré. Réutiliser les circuits ed2 dont la pertinence pour
Elcé est vérifiée, sans mêler les deux projets.

### Preuves à préparer pour le builder

- Une page contenant un bdc image simple et une Question produit une seule
  scène : le premier garde un perso sans story autonome de bdc, la seconde
  porte ses persos et son état dans sa propre story. Les deux s’affichent
  selon leur place dans la page, sans règle d’activation entre stories.
- La validation d’une Question utilise les straps et événements CodPlay de
  la démo 5. Le résultat transmis au scénario contribue au signet de session
  du chapitre, sans état métier parallèle dans React.
- Réordonner une page conserve les scènes inchangées et reconstruit le
  scénario entier ; modifier un bdc ne reconstruit que sa scène. Après cette
  actualisation, l’application peut ouvrir directement la page courante.

### Travaux restants

- Préparer `packages/elce` comme application et workspace autonomes, selon
  l’étape 0 proposée, et fixer son point d’entrée.
- Préciser ce qui sera repris de l’éditeur existant et ce qui constitue
  l’interface spécifique du POC.
- Définir les commandes métier, leurs frontières de commit et le contrôleur
  à machine d’état à partir du circuit existant ; vérifier que les gestes
  WYSIWYG et de réorganisation passent par cette même voie documentaire.
- Rattacher chaque besoin aux spécifications et circuits existants avant de
  proposer du code : construction, rendu, scroll, médias, quiz et navigation.
- Détailler le document métier et ses deux projections vers les entrées
  d’authoring existantes : le builder produit les scènes des pages modifiées,
  le constructeur du scénario produit les routes et les règles du parcours,
  et la navigation reste exécutée par Sighty. Vérifier qu’un déplacement de
  page ne reconstruit aucune scène et qu’une édition de page ne touche pas
  les scènes des autres pages.
- Vérifier sur une page Flux contenant un bdc à story propre que les `move`
  de ses persos les placent comme descendants logiques du perso
  `scroll-container` racine et que leur `emit.observe` utilise bien ce
  scrollport, sans adaptateur de lecture Elcé.
- Garder `embedded` dans les seules données de l’application. Étudier
  l’insertion d’un bdc du catalogue et sa génération par le circuit ordinaire,
  en réutilisant notamment `capsule-automation` pour le carrousel envisagé.
- Faire passer le déplacement de l’ancre et le retour du contenu au catalogue
  par les commandes métier. La création isolée d’un bdc réutilise l’espace
  central et le même circuit d’édition pour les types qui y sont autorisés.
- Examiner le principe d’import de fichiers décrit pour le chutier de
  l’éditeur et définir son adaptation Elcé pour les images et, si le même
  circuit convient, les vidéos ; vérifier le circuit effectivement disponible
  avant de réutiliser du code. Définir la suite de commandes qui ajoute le
  média au catalogue, crée le bdc adapté et le place, ainsi que la gestion
  d’un échec intermédiaire.
- Clarifier le contrat du markup alternatif de `img` dans le plan CodPlay
  propriétaire en conservant un seul perso image. Ne dépendre d’une extension
  du cœur qu’après décision du contrat, plan accepté et autorisation explicite.
- Réaliser l’essai de l’extension d’ancre Elcé sur Tiptap avant de retenir la
  bibliothèque : nœud d’ancre dans le JSON, plugin de dépôt raccordé aux
  commandes, NodeView de l’icône et de son déplacement, export HTML statique
  avec `id` et `data-part`, puis montage du perso CodPlay. Éprouver aussi la
  validité et la disposition du DOM après insertion réelle du perso dans le
  `span`. Si ce parcours échoue, revoir la représentation ou choisir une autre
  solution d’édition sans changer le contrat des bdc ni créer un second
  circuit de placement.
- Évaluer le coût de conservation des enrichissements au collage avec la
  solution retenue ; garder le texte brut comme périmètre de base du POC.
- Consigner toute capacité manquante dans son plan propriétaire et faire
  clarifier son contrat avant une implémentation qui en dépend.

Résultat attendu : frontières, réutilisations et choix techniques motivés.

## Sujet 12 — Acceptation et tranches de construction

**Fixe — ordre et critères acceptés pour coder ; preuve à produire par tranche.**

La première démonstration couvre les étapes 0 à 10 ; la Diapo vient ensuite.
Les étapes 0 à 3 sont des préliminaires avec une preuve de sortie propre :
aucune interface complète n’est construite sur une intégration supposée.
Chaque étape commence par le contrat applicable et un item de plan accepté,
puis se termine par des vérifications reproductibles. Le résultat et les
écarts restent dans ce plan ; seul le comportement implémenté et vérifié entre
dans une spécification Elcé. Dès qu’ils existent, les deux chemins
`document Elcé → builder de scènes → CodPlay` et
`document Elcé → constructeur de scénario → Sighty` sont exercés par le vrai
player. Une preuve manquante laisse l’étape en cours et bloque sa dépendante,
sans faire échouer artificiellement les travaux indépendants.

0. **Mise en place de l’application — préalable obligatoire — En cours ; automatisation vérifiée.**
   faire de `packages/elce/` une application et un workspace npm autonomes dans
   ce monorepo. Ajouter son chemin aux `workspaces` racine, puis créer son
   `package.json`, `src/`, entrée Vite, configuration TypeScript et scripts
   `dev`, `typecheck`, `test`, `build` et `preview`. Reprendre les versions et
   conventions utiles d’ed2, sans importer son code métier ni ses composants
   privés. Déclarer seulement les dépendances employées ; réserver un point
   d’entrée pour les API publiques CodPlay/Sighty et un contrôleur XState
   minimal. **Vérifier** l’installation depuis la racine, la mise à jour du
   lockfile et la résolution des imports du workspace, le démarrage après un
   lancement à froid, l’affichage React piloté par ce contrôleur, le
   rechargement direct dans le navigateur, `typecheck`, un test de fumée réel
   de l’application, `build` et la lecture du build avec `preview`. Un script
   `test` qui réussit faute de tests ne valide pas cette étape. Contrôler la
   console et les diagnostics du navigateur. Relever l’état initial des
   vérifications ed2 et démo 5 et vérifier que leurs points d’entrée restent
   utilisables après l’ajout du workspace. *Sortie :* ces commandes et ce
   parcours navigateur sont consignés avec leur résultat ; aucun code Elcé
   ne dépend d’un import privé d’ed2. Un échec de configuration est résolu
   ici avant d’ajouter le modèle métier.
1. **Document minimal, commandes et stockage — En cours.** Définir les identifiants
   stables et un premier schéma Elcé versionné : un document, une page Flux,
   une Section et sa référence à un premier preset de carte minimal, puis les
   collections de chapitres, pages, bdc et médias.
   Installer la façade de commandes, le contrôleur XState et une seule
   frontière de persistance. Essayer IndexedDB pour le document et un fichier
   média, avec `idb` seulement si cela clarifie l’accès. **Vérifier** par
   tests propres aux commandes les invariants d’affectation exclusive des
   pages et bdc, et par un vrai rechargement du navigateur la restauration du
   document, d’un `Blob` et de leurs identifiants. Vérifier qu’une édition
   visible passe par la façade, sans copie métier dans React. *Sortie :* un
   document minimal se crée, se modifie et se relit ; le stockage temporaire
   du POC est éprouvé avant de multiplier les contenus.
2. **Première verticale de lecture réelle — En cours ; compilation et montage automatisés vérifiés.** À partir de ce document, créer
   séparément le builder d’une scène Flux et le constructeur d’un scénario
   Sighty minimal. Enregistrer la capacité optionnelle `scroll-container`,
   compiler la scène et valider le scénario avant de lire la page dans le
   player réel. Le builder utilise le premier preset Elcé plutôt qu’un layout
   codé directement dans la fixture. Préparer dans le document de preuve
   une page de présentation à la racine du scénario, une page Flux dans un
   chapitre avec deux Sections dans deux stories et un repère bas, ainsi qu’une
   page du catalogue ; l’interface d’organisation viendra à l’étape 4. **Vérifier**
   en navigateur le montage de persos de stories différentes sous le même
   scrollport, l’observation du repère, les actions dans les persos, la
   navigation Sighty de la démo 5 et l’absence de la page du catalogue dans le
   parcours ; inspecter aussi les `SceneDoc` et le scénario produits.
   *Sortie partielle :* ces deux builders et leurs frontières sont exercés de bout en
   bout par le runtime Sighty/CodPlay, sans player ou routeur local de substitution.
   La vérification navigateur du scroll, du repère et de la navigation reste
   requise avant de clore l’étape. L’image simple sera
   éprouvée à l’étape 3 ; la Question suivra son preset et sa tranche dédiée.
   Une capacité manquante est portée dans le plan de son propriétaire avant
   tout travail Elcé qui en dépend.
3. **Essai anticipé de l’ancre Tiptap — En cours ; nœud, export statique,
   service métier et montage CodPlay en DOM vérifiés.** Sur cette verticale, réaliser dans
   Elcé un premier nœud d’ancre, sa NodeView et le plugin de dépôt, raccordés
   aux commandes. Utiliser un bdc image préparé pour tester le geste avant
   d’investir dans toutes les interfaces d’édition. **Vérifier** dans le
   navigateur le dépôt au milieu d’un paragraphe, le déplacement par l’icône,
   l’édition autour de l’ancre, l’export JSON → HTML statique, les `id` des
   parents, la part `data-part`, le montage du vrai perso et l’espace réservé
   après retour à la ligne et redimensionnement. Recharger le document et
   vérifier que l’ancre vise encore le même bdc. *Sortie :* Tiptap est retenu
   seulement si l’extension Elcé et le rendu conviennent ; sinon la
   représentation ou la bibliothèque est réexaminée avant la suite.
4. **Organisation du scénario dans l’éditeur — En cours ; commandes et
   organisation de base visibles, glisser-déposer appliqué.** Construire la
   liste des chapitres et de leurs pages, la page racine du scénario, le catalogue et la
   sélection, puis les commandes de création, nom automatique ou choisi,
   déplacement, retrait, suppression définitive et suppression d’un chapitre
   vide. Permettre aussi de créer une page racine au niveau du scénario
   et de l’y déplacer depuis un chapitre. Ouvrir Lecture à la page courante
   et restaurer ensuite le contexte d’édition ; rendre la lecture possible
   dans une fenêtre distincte.
   **Vérifier** que les pages du catalogue restent éditables mais absentes du
   scénario, que les pages racine y figurent, et que les deux formes
   de suppression ont des résultats distincts après rechargement. Déplacer
   une page doit reconstruire le scénario entier sans reconstruire les
   scènes ; éditer une page ne reconstruit que sa scène. *Sortie :* l’ordre
   affiché et lu vient du même document, sans état d’organisation parallèle.
5. **Presets de cartes.** Compléter le premier preset de Section et définir
   les trois autres presets Elcé fixes du sujet 6 comme objets de
   configuration : identités stables, markup HTML fixe, zones, emplacement et
   catégories de contenu admises. Une carte à un seul contenu se confond
   avec celui-ci dans l’éditeur. Le preset Question comporte un titre et une
   illustration facultatifs, puis les zones obligatoires question, réponses
   et validation ; les deux autres presets sont image avec légende et Message.
   Les instances remplies appartiennent aux bdc et ne deviennent pas des
   presets réutilisables. Examiner la structure `card` existante avant de
   construire le builder ; l’auteur ne crée ni ne modifie encore les presets.
   **Vérifier** qu’un même preset rend deux contenus distincts, que chaque
   zone accepte la catégorie prévue dans l’éditeur, que les trois zones
   obligatoires d’une Question sont renseignées et que les persos générés
   suivent le circuit ordinaire de scène. Inspecter le markup produit, ses
   `id` et ses parts CodPlay, ainsi que son rendu réel. *Sortie :* Section,
   média et future Question peuvent partager le modèle de cartes sans
   dupliquer leurs contenus ni introduire un second circuit de rendu.
6. **Édition des Sections — En cours ; première surface Tiptap vérifiée.** Installer l’édition WYSIWYG retenue dans la page :
   titre facultatif, texte, paragraphes et titres `h1` à `h6`, gras, italique,
   souligné, indice, exposant, ainsi que les alignements gauche, centré,
   droite et justifié ; les commandes d’enrichissement sont représentées par
   des icônes Lucide avec un nom accessible. Le collage reste en texte brut
   par défaut. Le JSON
   éditable reste la source ; le builder
   exporte son HTML statique en `layout.markup`, sans saisie HTML par l’auteur.
   **Vérifier** la saisie, le changement de style, le placement vertical de
   plusieurs Sections, l’export avec `id` explicites et la lecture réelle sur
   ordinateur et mobile. Tester qu’une modification d’une Section conserve
   les autres scènes. *Sortie partielle :* l’auteur peut éditer une Section et
   son HTML statique exporté dans le document. La lecture navigateur
   ordinateur/mobile et le placement de plusieurs Sections restent à vérifier
   avant de clore l’étape.
7. **Catalogue des médias et bdc simples — projection image/vidéo et import
   fichier vérifiés ; catalogue et réemploi à construire.** Importer une image depuis un
   fichier, puis une vidéo si elle suit le même circuit ; conserver leurs
   octets et leurs références réemployables dans IndexedDB. Créer des bdc
   image/vidéo uniques, proposer leur édition dans l’espace isolé et générer
   les persos CodPlay `img` et `media`, avec les comportements de la démo 5.
   Permettre la légende de média utilisée par la carte image avec légende,
   sans changer le rendu de l’image simple ; le markup fixe de cette carte
   déterminera ses propres balises, éventuellement `figure`/`figcaption`.
   **Vérifier** l’import et la relecture après fermeture, deux bdc distincts
   qui réutilisent le même média, un seul perso par bdc image simple, les formats
   4:3/3:4/16:9, les marges vidéo, les contrôles et les actions automatiques
   de visibilité dans le vrai player. *Sortie :* médias et bdc sont reliés
   par le modèle métier et lisibles sans rendu média propre à Elcé.
8. **Insertion complète des bdc dans le texte — dépôt fichier et service métier
   appliqués ; sources catalogue et preuve navigateur du déplacement à compléter.** Achever l’extension éprouvée
   à l’étape 3 pour les sources autorisées : icône de type, bdc ou média du
   catalogue, fichier de l’ordinateur. Tous les gestes créent l’ancre au dépôt
   par le même circuit de commandes ; le dépôt de fichier enchaîne création
   du média, du bdc et placement. Prévoir le retrait vers la réserve et la
   réouverture du bdc depuis sa zone d’édition. **Vérifier** chaque source,
   la position après édition du texte, les ancres proches, le déplacement de
   l’icône, le retour au catalogue et le résultat cohérent d’un échec pendant
   la suite de commandes. Tester le CSS dans le player, y compris après
   resize. *Sortie :* le parcours complet d’insertion ne crée ni mutation
   hors façade, ni seconde source de vérité pour le texte ou les bdc.
9. **Questions et évaluation.** Reprendre les trois types de Question, les
   réponses, la validation et la relecture de la démo 5 ; autoriser une
   Question au plus par page, à la place choisie par l’auteur. Son contenu
   remplit les cinq zones du preset Question, dont les trois obligatoires.
   Le builder de
   scènes produit les effets automatiques de Valider ; le constructeur de
   scénario produit les gardes et le cumul du chapitre Évaluation, à 80 %.
   **Vérifier** dans le vrai player chaque type et sa relecture, le passage
   « Suivant » seulement après bas de page et réponse validée, même fausse,
   puis les résultats 4/5 réussi et 3/5 échoué. Vérifier aussi un chapitre
   mêlant texte et Questions et un chapitre Évaluation vide en mode auteur.
   *Sortie :* lecture, score et navigation suivent Sighty/CodPlay comme dans
   la démo 5, sans calcul de progression parallèle dans React.
10. **Acceptation de la première démonstration.** Réaliser un parcours auteur
   complet : organisation, rédaction, import, dépôt, lecture intégrée et en
   fenêtre distincte, Question et résultat de chapitre. **Vérifier** les
   gestes avec un utilisateur peu formé, l’éditeur sur ordinateur, le player
   sur mobile, le rechargement du document et des médias, la navigation, la
   relecture, le resize et le cycle de vie. Exécuter tests ciblés, typecheck,
   build et vérifications navigateur sur les chemins réels ; confronter les
   résultats aux étapes 0 à 9. *Sortie :* première démonstration recevable,
   avec documentation de ses limites et contrats effectivement vérifiés.
11. **Diapo, après la première démonstration.** Composer ses cartes remplies
    à partir des presets de l’étape 5 et utiliser le type `carousel` de
    `capsule-automation`. Construire le passage manuel par cliquer-glisser
    et navigateur à points au moyen des événements et actions des persos.
    Permettre d’associer à la page une ressource voix importée et conservée
    dans le catalogue des médias par les commandes Elcé ordinaires. Un preset
    de lecture déclaratif résout alors l’avance automatique : la durée
    vérifiée de la voix est répartie également entre les cartes, puis ces
    plages sont fournies à `capsule-automation`. Les événements et actions
    de la scène portent cette lecture ; Elcé ne crée pas de minuteur parallèle
    dans React ou le player. Aucun champ de réglage de
    cadence, de transition ou de son n’est ajouté à l’interface.
    Le perso CodPlay `media` assure la lecture unique de la voix.
    Ajouter au modèle de page le type Diapo, distinct du bdc Diapo insérable
    dans un Flux ; le constructeur de scénario déduit du type de page la
    disponibilité immédiate de « Suivant ».
    **Vérifier** sur ordinateur et mobile : une carte visible, les passages
    manuel et automatique, la répartition exacte de la durée d’une voix
    connue entre les cartes d’une fixture propre à la tranche, arrêt aux
    extrémités sans boucle, commandes cliquer-glisser et points réservées au
    parcours manuel, retour à la
    première carte lors d’une relecture,
    vidéo automatique seulement si l’option `auto` est active et la carte
    visible, pause au changement de carte, absence de scroll interne et
    maintien du défilement de la page vers le bdc suivant. Vérifier les deux
    présentations : largeur du fût de texte comme bdc et lecteur entier, sans
    scroll de page, comme page Diapo. Sur cette page, vérifier que « Suivant »
    reste disponible avant même la dernière carte, sans contourner Sighty,
    que l’avance des cartes n’enclenche pas seule un changement de page,
    et que la voix importée et sa durée sont restaurées après rechargement.
    Vérifier qu’elle démarre au lancement de la page, n’est lue qu’une fois,
    s’arrête dès que le lecteur quitte la page et rejoue lors d’une nouvelle
    lecture. Éprouver l’obtention d’une durée finie et positive à l’import,
    sa conservation dans le catalogue et sa disponibilité avant le build : le
    [contrat de preload](../../codplay/specs/preload-v2-spec.md) ne certifie
    pas encore l’audio et ne doit pas être supposé fournir la durée à cette
    étape d’authoring. Examiner le circuit de distribution existant avant
    de dupliquer un calcul, puis vérifier le résultat dans le vrai player.
    Le passage automatique après une carte vidéo ne fait pas partie de cette
    tranche.
    *Sortie :* une Diapo Elcé lisible par le vrai player, sans composant
    de lecture extérieur ; l’édition des presets reste hors de cette étape.

Les réglages de CSS, les dimensions exactes des fixtures et le choix d’une
bibliothèque d’édition relèvent de la réalisation et de sa preuve visuelle.
Ils ne doivent pas déclencher une série de questions de produit tant qu’ils
respectent les formats et interactions retenus. Si un essai révèle un écart
de contrat, le consigner dans le plan propriétaire et suspendre seulement
le travail qui en dépend.

### Arbitrages de produit clos pour la première démonstration

- Un seul document et ses médias importés doivent survivre à la fermeture
  et à la réouverture. IndexedDB est la piste commune à éprouver pour tout
  stocker dans le POC ; SQLite permettra ensuite de gérer plusieurs documents.
  Le helper `idb` peut simplifier son accès. La restauration du document et
  des octets médias doit être validée. La progression
  et les réponses du lecteur ne sont pas sauvegardées dans le POC ; leur
  persistance sera étudiée plus tard avec SCORM.
- La navigation reprend au plus près la démo 5 : le repère bas autorise
  « Suivant » et les transitions passent par Sighty. Le changement de page
  n’est pas automatique au seul passage du repère.

Après cette démonstration vient la Diapo. Le rendu alternatif du composant
`img` reste une évolution séparée à cadrer dans son plan CodPlay.

Les autres questions des sujets 2 à 11 servent à préparer les tranches
concernées. Elles ne sont pas des prérequis pour relire cette séquence ni
des demandes de réponse une par une avant la première démonstration.

### Parcours d’acceptation à détailler pendant les tranches

- Définir le document exemple et le parcours de démonstration attendus.
- Arrêter les navigateurs, dimensions d’écran et interactions à vérifier,
  en couvrant l’édition sur ordinateur et la lecture sur mobile.
- Vérifier la compréhension des gestes par des personnes peu formées,
  notamment le glisser-déposer s’il est retenu après étude de faisabilité.
- Vérifier séparément que « Retirer du chapitre » rend la même page
  disponible dans la réserve et que « Supprimer définitivement » retire la
  page et ses bdc du document sans les verser au catalogue ; les médias
  réemployables restent disponibles. Les deux résultats doivent survivre
  au rechargement.
- Vérifier qu’une page de présentation à la racine du scénario apparaît dans
  le player, tandis qu’une page du catalogue reste consultable dans
  l’éditeur et absente de ce parcours.
- Vérifier avec deux pages diffusées que déplacer l’une d’elles ne modifie
  que la projection du scénario : leurs scènes et identités restent stables.
  Éditer ensuite un bdc de la première page et vérifier que seule sa scène
  est reconstruite, tandis que la seconde reste identique et lisible.
- Couvrir le démarrage de la lecture sur la page en cours d’édition, la
  lecture intégrée et dans une fenêtre séparée, ainsi que le retour à la
  page, à la sélection et au défilement d’édition conservés.
- Vérifier que le menu et Précédent/Suivant utilisent le même circuit Sighty
  que la démo 5 : le repère bas autorise « Suivant », qui franchit aussi une
  borne de chapitre ; sa présentation suit l’état de navigation, sans
  calcul parallèle dans l’interface Elcé.
- Inspecter le `SceneDoc` d’une page Flux : son `scroll-container` racine de
  contenu accueille les persos du flux et le repère de fin. Le player Elcé
  enregistre la capacité optionnelle et exerce l’observation réelle du repère.
  Avec une Question dans sa propre story, vérifier également le parentage
  logique sous ce scrollport et ses observations éventuelles dans le player.
  Les effets d’image, de vidéo et de validation sont déclarés dans les
  `actions` de leurs persos ; aucune propriété `data` ne sert de catalogue
  parallèle de définitions d’actions.
- Vérifier l’ancrage au point de dépôt. Éprouver la réservation d’espace
  sous la ligne après édition du texte, retour à la ligne, ancres proches
  et resize sur les dimensions de lecture retenues. Le geste au curseur
  reporté ne fait pas partie de cette acceptation du POC.
- Avant d’arrêter Tiptap, réaliser et éprouver l’extension d’ancre Elcé :
  déposer une référence de bdc préparée au milieu d’un paragraphe, la
  déplacer par son icône, puis exporter le JSON éditable en HTML statique.
  Vérifier que le `markup` généré contient la même ancre
  identifiée, sa part CodPlay et les `id` explicites des éléments parents ;
  le perso image ou vidéo doit se monter à cet endroit dans le vrai player, sans
  réorganisation inattendue du paragraphe ni rupture du flux. Après
  édition du texte et rechargement du document, l’ancre et le contenu restent
  liés. Le HTML est recalculé depuis le JSON, sans devenir une seconde source
  éditable. Si cette preuve échoue, Tiptap n’est pas retenu pour le POC.
- Vérifier l’apparition de l’icône à la sélection, son déplacement dans le
  texte et le retour du contenu au catalogue après suppression de l’ancre.
- Vérifier que retirer un bdc placé directement dans la page le remet
  également au catalogue, sans supprimer le média réemployable qu’il utilise.
- Pour la création isolée, vérifier que ses choix de création
  suivent la liste de types proposée par l’interface (sans section texte
  dans le POC), que cela n’impose aucune restriction au modèle des données,
  et que cet espace utilise le même circuit de commandes. Après création,
  vérifier le retour à la page ; pour un bdc ancré, vérifier sa réouverture
  dans l’espace isolé depuis sa zone d’édition.
- Vérifier que le choix d’un type par icône, le dépôt d’un bdc disponible,
  le dépôt d’une référence de média et le dépôt raccourci d’un fichier image
  conduisent chacun à un seul bdc ancré par la même voie de commandes ;
  tester la création de l’ancre au point de dépôt en un seul geste pour
  chaque source.
- Vérifier qu’un dépôt de fichier depuis l’ordinateur crée la référence du
  média au catalogue, un bdc image, son ancre au point de dépôt et son
  placement par la voie de commandes, avec un résultat cohérent si une étape
  échoue. Vérifier qu’un dépôt d’image du catalogue crée lui aussi son ancre
  au point de dépôt, sans nouvelle copie du média.
- Après rechargement de l’application, vérifier la restauration du document
  local unique et versionné, de l’ordre des chapitres/pages et des fichiers image/vidéo
  importés, puis la lecture effective d’une page qui les référence. La
  progression et les réponses d’une session de lecture précédente ne sont
  pas restaurées dans le POC. Pendant la faisabilité, vérifier dans le
  navigateur l’écriture et la relecture communes via IndexedDB.
- Vérifier dans le vrai player les trois types de questions, leur validation
  et leur relecture, avec des contenus créés dans Elcé. Vérifier qu’une
  Question placée librement ne bloque pas le défilement de sa page et que
  l’éditeur n’en place pas une seconde dans cette page. Sur une page qui
  place la Question avant ou après du texte, vérifier que « Suivant » reste
  bloqué tant que le repère bas ou la validation manque, puis se débloque
  une fois les deux acquis, y compris pour une réponse fausse. Vérifier que
  les actions de Valider sont construites par le builder de scènes et les
  gardes de passage entre pages par le constructeur du scénario, tous deux
  à partir du contexte Elcé. Vérifier
  qu’un chapitre Évaluation cumule les résultats des pages avec questions
  tout en admettant aussi des pages de texte. Tester le seuil fixe de 80 %
  avec au moins cinq Questions : quatre réponses justes sur cinq doivent
  réussir et trois sur cinq échouer ; une réponse absente compte comme
  incorrecte. Vérifier séparément qu’un chapitre Évaluation sans Question
  reste lisible dans la prévisualisation auteur et laisse poursuivre le
  parcours sans produire de pourcentage. Le mode de diffusion et le réglage
  du seuil par l’auteur restent hors du POC.
- Vérifier le rendu réel d’une image et d’une vidéo ancrées dans le Flux de
  texte par le builder et le player : les scènes générées utilisent les
  composants CodPlay `img` et `media` dans leur rendu de première version,
  avec un seul perso `img` pour chaque bdc image à contenu unique, sans
  `figure` ajouté par ce bdc simple. Vérifier séparément le preset à deux
  zones « image avec légende » :
  l’image utilise le composant `img`, la légende commune au média est projetée
  comme texte de carte dans son architecture HTML fixe et la composition ne
  modifie pas le rendu interne de `img`.
  Vérifier les formats 4:3 et 3:4 pour les images, 16:9 pour la vidéo, et
  l’occupation de toute la largeur du flux par l’image horizontale.
  Vérifier que l’image verticale garde sensiblement la même surface affichée
  avec une largeur réduite et qu’elle est centrée. Vérifier que la vidéo
  remplit le cadre 16:9 disponible après ses marges et conserve ses contrôles
  natifs visibles.
  Vérifier sur l’unique perso `img` l’observation de visibilité : l’image déjà
  visible au chargement est présentée et l’image hors écran apparaît à son
  entrée dans le scrollport. Vérifier que
  la vidéo démarre et se met en pause selon sa visibilité par le circuit
  d’observation et les actions média existants, y compris lors d’une relecture
  et sur mobile. Pour la vidéo importée, vérifier que le même
  circuit d’import que l’image produit une référence réemployable au catalogue
  et un bdc vidéo placé depuis le fichier.
- Si une mise à jour du POC introduit le rendu alternatif de `img`, ajouter
  sa preuve de bout en bout selon le contrat accepté dans le plan CodPlay
  propriétaire, avec un seul perso image. Ne pas remplacer le composant
  image par un rendu local à la démo. Le markup de la carte image avec
  légende suit sa preuve distincte ci-dessus et ne préjuge pas du contrat de
  rendu alternatif de `img`.
- Vérifier qu’un bdc ne peut pas être utilisé simultanément à plusieurs
  endroits, alors qu’un même média peut être référencé par plusieurs bdc
  distincts et qu’une même structure peut avoir des contenus distincts.
- À la tranche Diapo, vérifier son insertion comme bdc dans une page Flux
  par le chemin réel de génération et de lecture, sans notion `embedded`
  dans le contrat de scène généré.
- Ordonner les tranches selon leurs dépendances et leurs preuves observables.
- Pour chaque tranche, identifier le contrat applicable, l’action acceptée,
  les invariants et les vérifications du chemin réel de lecture.
- Prévoir les tests avec leurs propres fixtures et valeurs ; distinguer ces
  tests de la démonstration utilisateur.
- Prévoir les validations Play, Seek, resize, persistance et cycle de vie
  selon les frontières effectivement touchées, ainsi que les vérifications
  de types, tests, build et navigateur pertinentes.
- Faire relire le plan obtenu avant d’engager l’implémentation ; y conserver
  toute décision acceptée mais non appliquée.

Résultat attendu : plan de construction ordonné, relu et accepté. Les
spécifications Elcé seront rédigées au fil des comportements implémentés et
vérifiés.
