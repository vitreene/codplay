# Quiz Hunt — étude d’un mod éditable sur Sighty

## Intention et références

Reprendre la version Sighty de Quiz Hunt comme mod éditable dans Elcé.
L’auteur construit le sommaire du jeu, ses contenus et ses présentations ;
le mod génère leur composition et les raccords de jeu. Cette note consigne les
choix de conception, leurs motifs et le point qui reste à réconcilier.

L’[étude des mods](2026-10-15-elce-mods-study.md) fournit le cadre général ;
les [décisions Mods](../plan/2026-10-20-elce-mods-reconfiguration-plan.md)
retiennent la composition TypeScript directe, les ressources indépendantes et
un seul circuit documentaire. La
[spécification Quiz Hunt Sighty](../../../demos/specs/sighty-quiz-hunt-spec.md)
décrit le jeu vérifié ; son
[plan de reconstruction](../../../demos/plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md)
porte les décisions acceptées et les comportements encore à valider.
Le [contrat Sighty](../../../sighty/specs/authoring-library-spec.md)
reste la référence pour les scènes, slots, événements, actions et gardes.

## Frontière du mod

Quiz Hunt possède son document, sa définition, ses règles, ses vues auteur et
ses compositions de lecture sous `packages/elce/src/mods/quiz-hunt/`.
Il utilise les ressources communes et les points de composition existants.
Learning reste l’entrée par défaut ; Quiz Hunt reçoit une entrée explicite et
un catalogue séparés. Ce choix d’entrée et de liste ne crée pas deux applications
ni deux bases : les deux mods appartiennent au même produit et utilisent la même
base SQLite.

La colonne `projects.mod_key` distingue ces catalogues dans la base (`learning`
par défaut, `quiz-hunt` pour les projets du mod). C’est une métadonnée de
persistance ; elle ne modifie pas le document Learning ni ses BDC.

Les BDC communs de Quiz Hunt utilisent les mêmes tables relationnelles et les
mêmes données que Learning : `content_blocks`, `content_block_placements`,
`sections`, `questions`, `question_answers`, `cards` et `media_resources`. Il
n’y a pas de colonne de document complet JSON propre à Quiz Hunt ni de seconde
représentation des BDC. Les réglages du jeu et les propriétés de page propres
au mod (couleur, obligatoire) appartiennent à ses propres données, référencées
par les mêmes identifiants de projet, page et BDC.

Chaque ressource BDC regroupe son modèle, ses règles métier et la préparation
de ses requêtes SQLite ainsi que la conversion entre lignes et contenu métier.
La classe de persistance du mod ouvre les transactions, exécute ces requêtes
et conserve la responsabilité du projet, de son organisation et des extensions
propres au mod. Learning et Quiz Hunt appellent donc le même mécanisme SQL pour
une Question, une Section ou une Carte, sans déplacer toute la gestion SQLite
vers `src/core/`.

Pour établir cette source commune sans divergence, l’adaptateur SQLite de
Learning doit déléguer ses opérations BDC aux ressources ; son document,
son auteur et ses règles de parcours restent dans Learning. Les changements
de capacité qui servent tous les mods rejoignent la ressource commune, avec la
migration SQL nécessaire. Les réglages et politiques propres à un mod restent
dans ce mod et n’altèrent pas le contrat partagé du BDC. Cette distinction se
décide au cas par cas.

Si un raccord manque, la note doit identifier ce manque : le mod ne le
compense pas par un second stockage, un autre historique, une navigation
parallèle ou une représentation différente des BDC. Quiz Hunt sert de test aux
frontières partagées : une limite révélée appelle un ajustement de la ressource
ou de l’adaptateur du mod propriétaire, selon la portée du besoin.

À terme, des contenus BDC compatibles pourront être copiés entre projets de
mods, par exemple des Questions Learning vers Quiz Hunt. Cette possibilité
repose sur le contrat commun du BDC ; elle ne décide pas encore du transfert
des médias ni des réglages propres au mod.

## Deux volets d’édition

### Création du sommaire et composition du jeu

Le sommaire organise les épreuves et leur accès. L’auteur définit les entrées,
leurs libellés, leurs groupes et leur présentation en grille. La réserve de
questions constitue un chapitre ; les finales constituent un autre chapitre.
Le projet initial crée le sommaire et ces deux chapitres automatiquement.
Leurs noms sont modifiables ; leur rôle Questions ou Finales est conservé.
Chaque page de question ou de finale propose un select d’identifiant couleur,
dont les choix sont définis dans le sommaire. Le moteur du mod utilise cet
identifiant pour établir les relations au début de la partie. L’auteur
n’assemble pas une fiche imposée qui jumellerait manuellement une épreuve et
sa finale.
Supprimer une couleur conserve les questions et finales concernées dans leur
chapitre, avec une couleur à réaffecter ; aucun contenu n’est supprimé.

Des pages d’accueil ou de consignes peuvent précéder le sommaire. Dans Elcé en
général, le Sommaire doit être une page racine déplaçable parmi les autres
entrées de ce niveau, sans être obligatoirement la page de lancement. Son
placement dans un chapitre n’est pas envisagé pour le moment. Ce correctif
général reste à appliquer dans le
[plan Sommaire](../../plan/2026-10-14-elce-sommaire-profils-plan.md#position-du-sommaire-dans-la-racine).
Il est distinct de l’implémentation du mod Quiz Hunt et n’autorise pas celle-ci
à modifier Learning ou le core.

L’éditeur du sommaire accueille l’interface de configuration du jeu : les
réglages du jeu sont réunis dans cette surface auteur. Les paramètres retenus
sont les groupes et leurs couleurs, le budget de temps, les délais d’indice et
de feedback, les conditions d’apparition de l’extra et le tirage des questions
dans la banque. Tous les groupes gardent le même nombre de cases. Le réglage
du nombre de cases est réservé à une évolution ultérieure.

La grille et les diapos participent à cette composition. Deux animations
préconçues présentent le succès et l’échec ; chacune expose à l’auteur une
Carte qu’il peut compléter. L’auteur n’édite pas leur animation ni leur
structure de stories. D’autres animations pourront être développées et mises
à sa disposition ultérieurement. Ces présentations restent distinctes de la
décision métier qui les déclenche.

Le mot « sommaire » désigne ici l’organisation et la présentation du jeu ; il
n’impose pas le Sommaire Learning ni ses modes de navigation. La
[note Sighty sur les composants standard](../../../sighty/notes/2026-10-07-composants-standard-scenario.md)
envisage un sommaire de navigation autonome en contenu foreign. Cette
orientation ne rend pas ce composant disponible aujourd’hui et ne décide pas
du support de la grille animée propre à Quiz Hunt.

### Contenus, stories ressources et actions de layout

Les contenus d’épreuve, les indices, les questions, les médias et les
présentations de résultat sont édités dans leurs composants dédiés. Le mod
assemble les contributions nécessaires au sommaire et aux scènes de lecture.

L’édition d’une épreuve réutilise les outils standard des BDC. Elle n’impose
aucune structure : la présence d’un BDC Question est requise et une Question
est placée par défaut à la création. L’auteur organise librement les autres
blocs ; Section + Question est une composition habituelle, sans être un gabarit
obligatoire.

La lecture ne propose pas de navigation Précédent/Suivant entre épreuves.
Le seul retour est celui du jeu existant vers le sommaire : une réponse est
imposée, sans sortie volontaire permettant d’abandonner une question en cours.
Le retour suit le traitement de la réponse et du feedback existants. Une
évolution de cette règle pourra être étudiée ultérieurement.

| Élément | Rôle envisagé dans la composition |
| --- | --- |
| Grille du sommaire | Présenter les entrées et leur état ; émettre une intention de sélection. |
| Pages d’accueil et de consignes | Précéder éventuellement le sommaire dans l’ordre racine du projet. |
| Diapo d’épreuve ou de finale | Présenter les contenus et interactions de l’épreuve, avec les ressources adaptées au format Diapo partagé. |
| Succès et échec | Deux animations préconçues associées au sommaire ; chacune expose une Carte éditable et reçoit le verdict décidé par le scénario. |
| Panier | Story ressource qui présente les mots acquis par groupe. |
| Minuteur | Story ressource qui porte le mécanisme de décompte et son affichage. |
| Extra | Élément du layout, avec ses actions de collecte, déplacement, retour ou consommation ; la disponibilité et les conséquences sont décidées par Sighty. |

Un BDC est un objet éditorial ; une story contribue à une scène CodPlay ;
Sighty référence et orchestre des scènes. Ces niveaux ne sont pas équivalents.
Les stories de succès/échec sont configurées depuis le sommaire ; le verdict
reste présenté par une scène résultat persistante au-dessus du menu. Cette
composition ne suppose aucune API de routage Sighty vers une story isolée.

## Décisions Sighty à préserver

- Le scénario possède l’état d’ensemble et la progression. Les scènes gardent
  leurs interactions locales et publient des intentions ou des résultats.
  Les actions et gardes Sighty appliquent les règles et projettent leurs effets.
- Menu et question alternent dans le même slot de contenu. Une épreuve reste
  une scène autonome ; la création d’un sommaire éditable ne fusionne pas toutes
  les épreuves dans une seule scène.
- Panier et minuteur restent réunis dans une même scène persistante. Les
  concevoir comme deux stories ressources ne les sépare pas en deux scènes.
  Les questions commandent pause/reprise du seul mécanisme du minuteur via
  Sighty, sans suspendre toute la scène ni ajouter une autre horloge métier.
- La présentation du verdict conserve le menu sélectionné en dessous et une
  scène résultat persistante dans un slot dédié, au-dessus du layout. Les
  stories de succès/échec configurées depuis le sommaire alimentent cette scène
  sans remplacer ce slot persistant.
- La finale devient accessible depuis le menu après fermeture de la question.
  Une expiration pendant le feedback attend la fin de ce feedback avant le
  verdict, conformément aux décisions du jeu.
- L’extra et sa capture/glissement appartiennent à `scene-layout`, sur une
  couche au-dessus des scènes de contenu. Sighty possède sa disponibilité,
  sa consommation et la réadmission de l’épreuve.
- Le dépôt identifie uniquement l’épreuve visée dans le DOM partagé et transmet
  cette identité à Sighty. Il ne modifie pas une autre scène directement et
  n’ajoute pas de protocole général de dépôt inter-scènes. La reprise valide
  suit le reset et la révélation immédiate décidés pour la version Sighty.

## BDC spécifiques préparés pour le réemploi

Chaque nouveau BDC commence dans un dossier dédié du mod. Son modèle de contenu,
sa configuration, ses opérations métier, son éditeur et son builder restent
regroupés. Son métier est séparé des règles d’assemblage du jeu.

Une amélioration d’un BDC existant se décide au cas par cas. Une capacité utile
à tous les mods appartient à la ressource partagée ; une option nécessaire à
un seul mod reste dans ce mod, avec une extension liée au BDC sans modifier le
contenu commun. Un mod peut ainsi choisir et composer une ressource sans en
devenir propriétaire exclusif. Le partage futur d’une Question entre Learning
et Quiz Hunt éprouvera cette compatibilité.

Le composant reçoit les données et services nécessaires à son rôle. Il
n’importe pas le document complet Quiz Hunt, le scénario de partie, une façade
Learning ou des singletons de composition. Ses événements expriment ses
interactions ; le mod les raccorde aux conséquences de jeu. Les mêmes règles
valent pour une story ressource qui ne constitue pas un BDC plaçable.

Par exemple, le panier reçoit les entrées à afficher ; il ne décide pas de la
victoire et ne recherche pas les réponses dans le document du mod. Le minuteur
porte son décompte et ses commandes ; le scénario décide du traitement de
l’expiration. Le sommaire présente les états et émet les sélections ; les
gardes Sighty décident de l’accès.

Cette séparation doit permettre de déplacer ultérieurement un composant vers
un dossier commun en adaptant ses imports et sa composition, sans réécrire son
métier. Le besoin réel décidera de l’extraction. Un BDC ou une story métier a
vocation à rejoindre les ressources partagées lorsque son besoin dépasse un
seul mod. Une capacité d’infrastructure commune rejoint `src/core/` si sa
responsabilité est technique. Le terme « core » pour les capacités éditoriales
communes désigne ici les ressources partagées : par exemple, un nouveau type de
réponse rejoint la ressource Question. Le placement se décide selon la
responsabilité réelle, au cas par cas.

Les ressources existantes, notamment Question, Carte, Section et Diapo, sont
à examiner avant de créer des composants concurrents. Leur réemploi porte sur
leurs contrats autonomes ; il n’importe pas les politiques Learning. Le quiz
de la démo sert de référence fonctionnelle, sans devenir un second moteur de
questions intégré à l’éditeur.

## Document auteur et état de partie

Le document conserve les contenus, les deux chapitres de questions et de
finales, les identifiants couleur, l’option « obligatoire » des questions,
les groupes, l’ordre racine, la composition du sommaire et les réglages auteur.
Le moteur du mod construit les relations
du jeu au début de chaque partie à partir de ces données. Le tirage,
les statuts, les réponses, le panier, le temps restant, l’extra et le verdict
appartiennent à l’état de lecture. Une édition ne réécrit pas cet état comme
s’il était du contenu.

La démo Sighty de référence présente quatre groupes, seize épreuves et seize
questions finales. Ces comptes ne définissent pas la taille de la banque du
mod : le jeu original dispose de davantage de questions que de slots affichés.
Le document doit distinguer la banque éditée des emplacements de la partie.
Un tirage initial est effectué par défaut dans la banque. Le seed est une
valeur modifiable qui reste stable tant qu’elle n’est pas changée ; conserver
ce seed permet de rejouer la même sélection et le même ordre, sans imposer
une affectation manuelle des questions aux slots.

Le chapitre des finales conserve lui aussi une réserve de questions finales,
tirées au sort par couleur. Leur sélection participe au tirage initial
reproductible de la partie.

Si la réserve contient moins de questions que les places prévues, les slots
sans question restent affichés et sont désactivés. La grille ne se compacte
pas pour masquer ces places. Le document auteur peut rester incomplet : les
questions et finales sont normalement créées au fur et à mesure. Cette
incomplétude ne doit pas empêcher de construire et sauvegarder le projet.

L’option « obligatoire » privilégie la question dans le tirage du jeu ; elle
n’ajoute aucune obligation de réponse pour accéder à la finale. Chaque couleur
dispose de quatre slots. La sélection prend les quatre premières questions
obligatoires dans l’ordre de la banque, puis complète les slots restants. Un
dépassement de quatre questions obligatoires relève du choix de l’auteur et ne
bloque pas le lancement ni ne fait échouer le tirage.

Dans tout le projet, « aléatoire » désigne du pseudo-aléatoire déterminé par un
seed initial. Un même seed et une même banque permettent de reproduire la
même suite. En édition, le seed reste modifiable et son renouvellement
automatique est inactif, afin de tester les suites de questions. En diffusion,
l’option « Random » est cochée par défaut : elle renouvelle le seed au début
de chaque nouvelle partie, y compris après « Recommencer ». Lorsqu’elle est
désactivée, le seed fixé est conservé et le tirage reste reproductible. Aucune
autre source de hasard indépendante ne doit modifier la suite pendant son
exécution.

Une épreuve résolue n’est pas créditée deux fois ; une réussite remplace le
mot courant de son groupe sans effacer les réussites précédentes.

Une couleur est active uniquement si le tirage lui fournit au moins une
épreuve et une finale. Les épreuves des couleurs inactives ne sont pas jouées ;
une finale sans épreuve tirée ne suffit donc pas à activer sa couleur. Le
tirage initial choisit une finale parmi les couleurs actives ; le jeu la
présente après le remplissage du panier. Une réponse fausse produit l’échec
prévu par le jeu. Sans couleur active, le jeu reste en construction et ne
démarre pas.

L’édition, l’historique, les médias, la sauvegarde et la synchronisation passent
par les circuits communs déjà disponibles, avec les adaptations documentaires
propres au mod. Preview et diffusion emploient la même génération Sighty/CodPlay.
En diffusion, rouvrir le jeu reprend la partie interrompue avec son seed, ses
réponses, son panier et son temps restant. « Recommencer » crée explicitement
une nouvelle partie. La restauration doit être portée par l’intégration du
mod ; elle n’est pas acquise par la seule présence d’un contexte Sighty, selon
l’[étude de l’état de lecture](2026-10-16-reading-state-ownership-study.md).

## Évolution envisagée : sélection à l’activation du bouton

Un dispositif ultérieur pourrait faire porter au bouton une couleur plutôt
qu’un lien préétabli vers une question. Son activation demanderait au moteur
du mod de sélectionner à la volée une question de cette couleur. L’association
serait alors construite au moment du choix, au lieu d’être fixée avant le jeu.

Cette piste est à conserver pour une étude ultérieure ; elle ne remplace pas
le tirage initial retenu actuellement. Son articulation avec le seed et la
priorité des questions obligatoires dans les quatre slots sera à préciser lors
de cette étude.

## Limites techniques CodPlay suivies

La découverte de `initial.attr.src` d’un `tag` est suivie dans
[CompiledScene](../../../codplay/specs/scene-package-export-v1-spec.md#fermeture-média-par-compilation).
Le reset du glyph est suivi dans le
[plan Input](../../../codplay/plan/components-image-input-polygon-svg-plan.md).
Ces limites n’autorisent aucun correctif opportuniste du cœur.

