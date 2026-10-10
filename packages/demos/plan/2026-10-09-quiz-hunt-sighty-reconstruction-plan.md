# Quiz Hunt — reconstruction en scènes Sighty

## Statut et portée

**En cours — P1, P2 et P3.** Les décisions de structure et le périmètre de la
première verticale sont acceptés. L'utilisateur a confirmé le 2026-10-09 la
grille complète de 16 épreuves et, pour P3, le retour au menu avant l'activation
de la finale ainsi que la fin du feedback avant le verdict d'expiration. La
validation du gate G2/P3 reste à exercer avec le runtime réel. G3–G4 et
P4–P7 restent à relire avant leur exécution. Le choix G5 d’une vidéo native
`tag` avec contrôles et autoplay est accepté le 2026-10-10 ; sa validation
navigateur reste ouverte. Les constats V1 ci-dessous viennent de
la lecture du code. Les preuves des capacités existantes restent celles des
spécifications citées.

Objectif : reconstruire le jeu actuel avec des scènes CodPlay autonomes
orchestrées par Sighty : menu, question, panier avec minuteur, résultat et
layout. L'état d'ensemble et la progression appartiennent au scénario Sighty.
La première reconstruction conserve le thème SF spatiale et les règles
existantes sauf décision explicite.

Les décisions ci-dessous sont `Fixe` pour la conception ; les parties non
appliquées restent dans le plan. Les arbitrages et étapes d'implémentation
encore marqués `A relire` doivent être précisés avant leur exécution. Ce plan
n'autorise aucune modification de `packages/codplay`. Un besoin runtime non
couvert doit être traité dans le plan de son propriétaire avant le code qui en
dépend.

## 0. Décisions arrêtées avec l'utilisateur

| Décision | Conséquence pour la reconstruction | Statut |
| --- | --- | --- |
| Panier et minuteur dans la même scène | Une seule scène persistante `scene-basket` porte ces deux responsabilités | Fixe — à appliquer |
| Instructions pause/play du seul mécanisme du minuteur, émises par les questions et transmises via Sighty | Pause fige le décompte ; play le reprend. Le transport et la lecture de la scène panier restent inchangés | Fixe — à appliquer |
| Menu caché pendant la scène question | L'alternance menu / question est retenue ; le menu ne reste pas visible à côté | Fixe — à appliquer |
| Présentation du résultat au-dessus du menu | Garder le menu sélectionné sous une scène résultat persistante, montée dans un slot dédié ; le root résultat couvre toute la scène layout avec le fond translucide V1 | Fixe — appliquée et validée sur la branche de victoire |
| État d'ensemble et progression dans Sighty | Contexte, actions et guards du scénario possèdent les règles de partie ; les scènes portent leurs interactions locales | Fixe — à appliquer |
| Questions générées au lancement | Construire le catalogue complet d'épreuves et de finales au démarrage ; leur génération n'est pas différée à la visite | Fixe — à appliquer |
| Chargement natif de la vidéo Nostromo | Utiliser un perso `tag` vidéo avec `src` dans `initial.attr`, `preload: auto` et `autoplay: true` ; le navigateur charge la vidéo quand le tag est matérialisé, sans handoff au composant `media` | Fixe — à appliquer ; disponibilité avant l’entrée à vérifier en G5 |
| Lecture et contrôles de la vidéo Nostromo | Conserver les contrôles natifs (`controls: true`) ; le navigateur possède lecture, pause, seek et relecture. Ne pas émettre `START`/`STOP` média et ne pas modifier le transport de la timeline générale | Fixe — à appliquer ; parcours navigateur à valider en G5 |
| Activation de la finale | Fermer toute question en cours, revenir au menu, puis permettre au joueur d'activer la finale depuis ce menu ; aucune finale ne remplace directement une question visible | Fixe — à appliquer |
| Expiration pendant le feedback d'épreuve | Le décompte continue pendant les 2 s de feedback ; si le budget atteint zéro pendant ce délai, laisser le feedback se terminer puis afficher la défaite | Fixe — à appliquer |
| Présentation des scènes P1 | Transposer les éléments et classes CSS déjà présents dans la V1, sans ajout visuel ; supprimer le titre global « Choisis une épreuve » et le libellé « Panier » ; en paysage, question/quiz à gauche et scène panier/minuteur à droite, avec le cadran sous les cases pour leur laisser toute la largeur ; en portrait, question/quiz prioritaires, scène panier/minuteur sous la question et accessibles par défilement, cadran à côté des cases ; réduire légèrement la taille du texte des cases ; le panneau question défile jusqu'au formulaire ; le badge numéroté garde sa forme et sa couleur V1 en format puce de 2,5 rem ; cadran de 8 rem en paysage et étiré à la hauteur des deux rangées de cases en portrait | Fixe — appliquée et mesurée en Safari (voir P1) |
| Compacter le panier sur mobile avec des valeurs fluides | Donner une taille fluide commune au bouton de validation et aux cases ; faire varier la réserve d'extra avec la largeur du viewport, dans les bornes prévues par la V1 ; étirer le cadran à la hauteur de la rangée qui contient les cases et le cadran | Fixe — étirement CSS appliqué et mesuré dans Safari à 390 px et 336 px |
| Occuper la hauteur disponible pour Quiz Hunt | Une règle portée par le CSS Quiz Hunt et active seulement quand son layout est monté borne le cadre mobile au viewport, donne au stage tout l'espace restant sous l'en-tête et garde la télécommande en bas ; en portrait, le menu réduit sa grille au-dessus du panier, qui reste visible quand l'espace le permet ; les écrans trop courts défilent ; les autres démos et la feuille CSS commune restent inchangées | Fixe — hauteur appliquée, menu runtime à valider |
| Propriétaire du jeton déplaçable | Le jeton et sa mécanique de saisie/glissement résident dans `scene-layout`, sur une couche visuelle au-dessus des scènes de contenu. La disponibilité, la consommation et les conséquences de jeu restent dans l'état Sighty | Fixe — à appliquer |
| Dépôt du jeton sur le menu | La cible appartient à une autre scène. La résolution de cible inter-scènes reste à étudier après l'implémentation générale, à partir des possibilités déjà offertes par Sighty/CodPlay ; aucune évolution de `packages/codplay` n'est demandée | À étudier après P3 |
| Space Bubbles après mise en place et validation de Quiz Hunt | Porter le mini-jeu en V2 et l'ajouter comme épreuve dans un chantier ultérieur avec un plan distinct | Fixe — séquencement accepté |

## 1. Sources et circuits existants

Les références canoniques relues sont :

- [Contrat Sighty](../../sighty/specs/authoring-library-spec.md) : scénario
  unique, graphe, slots, actions, guards, contexte, événements, occurrences,
  `showMode`, catalogue de scènes et reset.
- [Layout des démos Sighty](../specs/sighty-demo-layout-spec.md) et
  [cours scrollable Demo 5](../specs/sighty-scroll-course-demo-spec.md) : page
  commune, progression métier, projections explicites et quiz indépendants.
- [Clôture Sighty](../../sighty/plan/2026-09-15-sighty-navigation-reconstruction-plan.md),
  [convergence des circuits](../../sighty/plan/2026-09-16-sighty-circuit-unification-plan.md)
  et [reset de relecture](../../sighty/plan/2026-09-30-sighty-replay-reset-plan.md) :
  validations restantes, notamment le navigateur après le nouveau reset Demo 5.
- [Guide de reprise V2](../../codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md),
  [façade](../../codplay/specs/facade-v2-spec.md),
  [événements](../../codplay/specs/event-pipeline-v2-spec.md),
  [straps](../../codplay/specs/strap-execution-v2-spec.md),
  [TweenAction](../../codplay/specs/action-sequence-tween-v2-spec.md),
  [input](../../codplay/specs/input-component-v2-spec.md) et
  [médias](../../codplay/specs/media-sync-v2-spec.md).
- [Authoring de scène CodPlay](../../codplay/specs/scene-authoring-spec.md) :
  le perso `tag` porte le nœud `<video>` et ses attributs natifs. La nouvelle
  voie Nostromo n’utilise plus le composant `media` ni son transfert preload.
- [Capture V2](../../codplay/specs/capture-v2-spec.md),
  [DnD liste](../../codplay/specs/list-dnd-v2-spec.md),
  [isolation des stories](../../codplay/specs/story-isolation-spec.md) et
  [plan de validation S6](../../codplay/plan/drag-capture-list-s6-validation-plan.md) :
  suivi du pointeur, preview, commit et résolution géométrique restent des
  frontières distinctes ; aucune de ces preuves ne certifie le dépôt du jeton
  du layout vers le menu.
- [Contrat vérifié de la démo](../specs/sighty-quiz-hunt-spec.md) : catalogue,
  tirage, progression, accès, scènes et présentation déjà exercés dans P1/P2.

L'origine du besoin est explicitée dans le
[préambule de l'orchestration multi-scènes](../../sighty/notes/2026-07-26-meta-orchestrateur-preambule.md) :
une épreuve doit conserver son autonomie de scène. Cette note explique
l'intention ; elle ne remplace pas le contrat Sighty actuel.

| Référence examinée | Réemploi proposé | Limite |
| --- | --- | --- |
| [Demo 1](../src/sighty/demo1/scenario.ts) | Composition de scènes dans les slots d'un layout CodPlay | Pas de logique de jeu ; réévaluation générale différée |
| [Demo 2](../src/sighty/demo2/scenario.ts) | Référence pour le pilotage telco entre scènes | Le couplage agit sur la telco de toute la scène ; le minuteur intégré au panier demande un envoi ciblé par action Sighty |
| [Demo 3](../src/sighty/demo3/scenario.ts) | Action Sighty puis `send` vers une scène active | Les données ne se propagent pas automatiquement avec `updateContext` |
| [Demo 4](../src/sighty/demo4/scenario.ts) | Menu, transitions, remplacement et fin de scène | Ne pas recopier son carousel ni son reset global par défaut sans besoin |
| [Demo 5](../src/sighty/demo5/scenario.ts) | Catalogue unique, guards, contexte métier, projection des contrôles | Le parcours après la dernière évolution de reset reste à valider |
| [Quiz Demo 5](../src/sighty/demo5/scenes/quiz-page-scene.ts) | Sélection, validation, correction et événement public | Extraire le minimum réutilisable ; ne pas créer un troisième moteur de quiz |
| [Chrono V2](../src/v2/demos/chrono/main.ts) | Affichage calculé par TweenAction, commandes discrètes | Ne prouve pas encore un minuteur persistant à travers un parcours Sighty |
| [Layout commun](../src/sighty/layout/transport.ts) | Page, cycle de vie et télécommande existants | Play joue les scènes sélectionnées ; relaunch les rewind sans reset métier |

## 2. Jeu V1 à préserver et écarts documentaires

L'[entrée demandée](../src/v1/codplay/quiz-hunt-demo.ts) configure le jeu, mais
l'assemblage se trouve dans [quiz-hunt/index.ts](../src/v1/scenes/quiz-hunt/index.ts).
Il construit six stories communes, seize épreuves et seize finales dans une
seule scène. Les questions possèdent déjà leur état local ; les straps de
scène concentrent navigation, panier, minuteur, rattrapage et verdict.

Le [plan V1 initial](../../../docs/plans/2026-06-19-quiz-hunt-plan.md) est resté
`Implémentation en cours`. Ses descriptions ne suffisent pas à fixer le jeu
actuel : le code et le [journal de bugs](../src/v1/scenes/quiz-hunt/BUGS.md)
contiennent des évolutions ultérieures. Cette reconstruction doit faire
valider les écarts, sans transformer les observations en nouvelle spécification.

| Sujet | Comportement observé dans la V1 actuelle |
| --- | --- |
| Contenu | SF spatiale : 16 mots, 4 par couleur, une question d'épreuve et une finale par mot. Le jeu vidéo historique reste un autre jeu de données. |
| Tirage | `seed: 1` dans l'entrée. L'ordre des tuiles, l'épreuve contenant l'extra, son décalage et la couleur finale viennent du même tirage déterministe. |
| Épreuve | Indice puis révélation après 3 s par défaut. Nostromo utilise une vraie vidéo importée et un délai de 5 s ; la révélation ne dépend pas de la fin native de la vidéo. |
| Réponse | Correction configurable, blocage des réponses après validation, feedback visible 2 s avant retour à la grille et mise à jour du panier. |
| Panier | Un mot par couleur. Une nouvelle réussite de la même couleur remplace le mot affiché ; les autres réussites restent connues dans les statuts d'épreuve. |
| Minuteur | Budget de 180 s. Pas de décompte avant la première épreuve. Pause pendant l'indice, reprise à la révélation ; le temps continue pendant la réponse, le feedback et la grille. Arrêt à l'entrée en finale. |
| Extra | Une fenêtre temporisée dans une épreuve tirée au sort ; le jeton collecté rejoint l'inventaire. Son dépôt sur une tuile échouée consomme le jeton et rouvre l'épreuve. Un dépôt invalide le conserve. |
| Finale | Le mot du panier pour la couleur tirée détermine la question. Le panier complet autorise le départ ; la finale elle-même est hors décompte. |
| Finale fausse | Le mot échoué devient indisponible. Un autre mot déjà réussi de cette couleur peut le remplacer, avec retour grille et minuteur encore arrêté. Sinon la couleur est vidée : reprise de la chasse s'il reste un mot disponible, défaite sinon. |
| Finale juste | Feedback 2 s, résultat gagné, puis fin de séquence 1,2 s plus tard. |
| Résultat | Verdict, nombre de couleurs et temps utilisé ; le bilan est actuellement journalisé en console. Aucun service distant à ajouter. |

Les preuves de lecture principales sont les straps
[router](../src/v1/scenes/quiz-hunt/straps/game-router.ts),
[résolution d'épreuve](../src/v1/scenes/quiz-hunt/straps/game-trial-resolve.ts),
[résolution finale](../src/v1/scenes/quiz-hunt/straps/game-final-resolve.ts),
[minuteur](../src/v1/scenes/quiz-hunt/straps/game-timer.ts) et
[dépôt du jeton](../src/v1/scenes/quiz-hunt/straps/game-extra-drop.ts).

Écarts et décisions à relire avant portage :

- Le plan ancien parle de contenus textuels uniquement et d'une finale simple.
  Le code comporte maintenant la vidéo et les branches de rattrapage final.
- Les anciens documents décrivent plusieurs politiques du minuteur. La règle
  V1 observée dans le code — 180 s démarrent à la révélation, pause pendant
  l'indice, reprise à la révélation, puis décompte continu pendant réponse,
  feedback et grille — a été confirmée par l'utilisateur le 2026-10-09.
- Le commentaire du router annonce un retry immédiat, mais son exécution
  programme encore le délai d'indice et ne lit pas `retry` pour le supprimer.
  Décider si une seconde tentative rejoue l'indice.
- La finale ne remplace pas une question active : la question se ferme, le
  parcours revient au menu, puis le joueur active la finale. Si l'expiration
  arrive pendant le feedback d'une épreuve, le feedback de 2 s se termine avant
  l'affichage de la défaite ; le budget continue de s'écouler pendant ce délai.

## 3. Composition retenue et déclinaison proposée

Le layout de la page Sighty reste propriétaire du sélecteur, de la
télécommande, du journal et du cycle de vie. À l'intérieur de son stage, une
scène layout du jeu définit les emplacements CodPlay.

Le menu est caché pendant la scène question, conformément à la décision de
l'utilisateur. L'alternance utilise le slot de contenu. La scène panier avec
son minuteur reste présente pendant les changements de contenu.

```text
view-game — scene-layout
├── slot-content
│   ├── view-menu              → scene-menu
│   ├── view-trial-<word-id>   → scene-trial-<word-id>
│   └── view-final-<word-id>   → scene-final-<word-id>
├── slot-result              → scene-result (root masqué puis affiché)
├── slot-basket               → scene-basket
│   ├── panier et inventaire
│   └── décompte du minuteur recevant pause/play via Sighty
└── surimpression du jeton, portée par scene-layout au-dessus du contenu
```

Le contenu est une map de vues adressables, car le joueur choisit une tuile ;
une liste linéaire de questions ne représente pas ce jeu. Un seul contenu est
actif à la fois. Panier et minuteur partagent une occurrence conservée pendant
les changements de contenu. Cacher le menu ne demande pas de détruire son
occurrence. L'absence de destruction à la sortie d'une vue reste
conforme à la conservation physique décrite par Sighty ; aucun gain de mémoire
ou démontage systématique n'est présumé.

Le résultat est un slot de superposition distinct : sa scène reste sélectionnée
avec une racine masquée jusqu'au verdict. À la fin d'une partie, la navigation
du contenu revient au menu et l'action Sighty projette le verdict dans cette
scène déjà montée. Le root résultat couvre la surface entière de `scene-layout`;
son fond V1 translucide laisse voir le menu derrière lui. Le panier reste sous
la même surimpression. Cette composition utilise uniquement les slots existants
du contrat Sighty. La victoire a été vérifiée dans Safari après quatre réponses
correctes, activation de la finale depuis le menu et fin de son feedback : le
menu est resté monté derrière le résultat et les rectangles du root, de son host
et du layout étaient tous de `370,4 × 517,5 px` CSS.

La scène de jeu `scene-layout` porte le jeton déplaçable et sa mécanique
locale de saisie/glissement dans une surimpression qui reste visible pendant
les changements de contenu. Sighty conserve l'état durable du jeton et ses
conséquences de progression. Le menu demeure une instance distincte sous cette
couche ; la reconnaissance du dépôt sur ses cibles n'est pas résolue par ce
choix de composition et reste à l'étude en G3.

| Responsabilité | État et comportement possédés | Relation avec Sighty |
| --- | --- | --- |
| Layout | Composition visuelle, slots, responsive et couche de déplacement du jeton | Rend le jeton au-dessus du contenu ; n'établit pas encore comment résoudre une cible du menu |
| Menu | Affichage des tuiles et intentions de choix | Projette les statuts et les réponses des guards ; ne recalcule pas l'accès |
| Question | Indice, média, révélation, saisie, validation, correction, feedback | Publie les résultats et les instructions pause/play du minuteur à destination de Sighty |
| Panier avec minuteur | Affichage des quatre mots, inventaire du jeton, bouton finale et décompte | Reçoit les projections et les instructions relayées par Sighty ; publie les intentions de jeu et l'expiration |
| Résultat | Bilan affiché et éventuelle intention de nouvelle partie | Reçoit un verdict déjà décidé par la logique du jeu |

La finale utilise la même fabrique de questions, en mode sans indice. Cela
donne une responsabilité de question réutilisable, pas une seule occurrence
mutable pour toutes les questions. Chaque épreuve et chaque finale a une
`SceneKey` stable, dérivée du catalogue. La fabrique est commune ; les états
des occurrences sont indépendants. Toutes les scènes question sont générées
au lancement depuis le contenu et le tirage, finales comprises, puis fournies
au catalogue `scenario.scenes`. Sighty compile les sources directes lors de
l'initialisation. La question Nostromo porte un `tag` vidéo avec `src` dans ses
attributs initiaux ; le navigateur en gère le chargement quand le tag est
matérialisé, selon G5. Cette génération complète n'impose pas de monter toutes les
questions simultanément : Sighty acquiert les occurrences nécessaires au
parcours et conserve celles déjà visitées selon son contrat.

Les questions utilisent a priori `showMode: 'reset'` pour une tentative
admise ; les guards déterminent si cette tentative est permise. La scène
panier/minuteur reste sélectionnée et ne doit pas être resetée par une
navigation ordinaire. Le menu reçoit une projection complète à sa réadmission.
La proposition n'applique pas le `showMode: 'reset'` global de Demo 4.

## 4. État de partie et circulation des informations

L'état d'ensemble et la progression appartiennent à Sighty, conformément à la
décision de l'utilisateur : contexte de partie et fonctions auteur enregistrées
dans `scenario.actions` et `scenario.guards`. Le runtime Sighty conserve et
expose ce contexte ; les règles Quiz Hunt restent dans son scénario auteur.

Le contexte de partie proposé conserve les statuts des épreuves, le panier,
les mots déjà tentés en finale, l'extra offert/collecté/consommé et le verdict.
Le catalogue et le tirage sont des données de configuration immuables. La vue
courante est lue via `scenarioState.active` ; un second routeur et une seconde
table de navigation ne sont pas nécessaires.

Les réponses sélectionnées et la correction restent dans la scène question.
Dans la scène panier, le minuteur possède son exécution temporelle locale.
Le contexte Sighty conserve les conséquences utiles à la partie et le bilan
discret de temps utilisé, sans calculer une seconde horloge. Ni la scène panier
ni les questions ne dupliquent l'état d'ensemble ou les règles de progression.
Les événements répétés d'une même tentative doivent être sans effet
supplémentaire.

Circuit proposé pour une épreuve :

1. Le menu émet une intention publique liée à une route déclarée.
2. `accessBy` vérifie la disponibilité ; Sighty admet et démarre la question.
3. La question conduit son indice, sa saisie et ses 2 s de feedback avec le
   temps CodPlay. Elle émet ses instructions publiques pause/play du décompte ;
   les actions du scénario Sighty les transmettent au mécanisme du minuteur
   par `send`, sans modifier le transport de la scène panier.
4. L'événement public de fin porte le résultat et l'identité de la tentative.
5. Une action déclarée revient au menu, enregistre le résultat puis projette
   menu et panier. Cet ordre convient à une destination menu sans précondition.
6. Le panier demande une finale lorsque l'accès est accordé ; sa question
   publie un résultat que les actions du jeu transforment en poursuite ou verdict.

Les noms et payloads métier seront arrêtés en P0 ; ce schéma n'ajoute aucune
API Sighty. Les routes menu, épreuves et finales sont générées depuis le même
catalogue. `go` reste une route statique déclarée : il ne devient pas une
fonction retournant une destination. Pour sélectionner une finale, la
projection peut fournir au panier l'identité du mot concerné ; l'intention
émise doit correspondre à une route déjà déclarée et son guard revérifier le
panier. La scène panier ne possède pas l'algorithme de sélection finale.

Deux contraintes du contrat règlent l'écriture des actions :

- `go` est admis et exécuté **avant** le handler `action`. Un handler ne peut
  donc pas mettre à jour le contexte pour débloquer le guard de son propre
  `go`. Lorsqu'une décision métier doit précéder le choix de route, séparer
  son événement de l'intention de navigation ; arrêter cet ordre en P0.
- `send` cible une scène active. Après retour menu, ne pas envoyer un patch
  à l'ancienne question ; pendant une question, ne pas envoyer un patch à un
  menu sorti. Le contexte conserve les changements, puis la projection de
  réadmission remet la scène visible à jour.

Les valeurs `data` et `entry` restent statiques. `updateContext` n'injecte
aucun rendu automatiquement. Les projections empruntent uniquement `send` et
les actions déclarées des persos, comme Demo 5.

## 5. Frontières à résoudre avant les étapes dépendantes

### G1 — Minuteur intégré au panier et transport de démonstration

Le minuteur appartient à la scène panier. La décision d'acheminement est
arrêtée : les instructions pause/play viennent des questions, passent par
Sighty et commandent uniquement le mécanisme du minuteur. La précision de
l'utilisateur est une décision acceptée : pause fige le temps restant du
décompte ; play reprend ce décompte à partir du temps restant. Ces instructions
ne sont pas les commandes de transport `telco.pause()` / `telco.play()` de la
scène. Sighty les relaie comme événements métier du minuteur ; la scène panier
conserve son état de lecture et continue à traiter ses autres événements.

Le circuit d'auteur proposé pour appliquer cette décision est :

```text
question : événement public de pause/reprise du décompte
  → action déclarée dans le scénario Sighty
  → send vers scene-basket, avec une cible story pour le minuteur
  → listen / strap du minuteur et actions de ses persos

scène panier : expiration publique du minuteur
  → action Sighty qui décide la conséquence pour la partie
```

La cible story et les noms des événements restent à préciser en P0. L'envoi
entrant au minuteur utilise la portée locale ; il ne republie pas l'instruction
publique reçue de la question en boucle. La scène panier reste active et reçoit
ses projections pendant une pause du décompte. Les questions ne possèdent ni
référence à son instance ni accès direct à sa telco.

Le circuit Chrono V2 est la référence à réutiliser pour cette pause métier :
le player continue pendant que le décompte est figé par des actions
discrètes. Le couplage telco, qui commande toute une occurrence, ne définit pas
une pause ciblée du minuteur à l'intérieur de cette scène commune. Les
TweenAction portent l'affichage, sans intervalle navigateur ni événements
continus de mise à jour.

Les preuves d'intégration restent à obtenir :

- l'initialisation et la génération des questions ne démarrent pas le budget
  avant la première épreuve ;
- une question demande la pause pendant l'indice et le play à la révélation,
  selon la règle temporelle retenue ;
- pendant la pause du décompte, la scène panier en lecture garde son état de
  transport, son temps logique continue d'avancer et ses autres événements
  restent traités ; le temps restant du minuteur est constant ;
- le play du minuteur reprend ce temps restant, sans redémarrer ni rembobiner
  la scène panier ;
- la pause métier du minuteur survit à une commande distincte Pause / Play de
  la télécommande de page ;
- le budget reste conservé dans la même scène panier au changement de question ;
- le résultat reçoit un bilan de temps cohérent via les événements et le
  contexte Sighty ;
- une ancienne question sortie ne peut plus commander le minuteur.

Le timer V1 ne se copie pas littéralement : son `planned.delay` programme un
`expiry-check` traité par un strap. En V2, les occurrences planifiées sont des
faits temporels et ne sont pas réinjectées comme un dispatch immédiat ; Seek
ne réexécute pas les straps. La spécification des helpers certifie `wait`,
mais laisse `delay` au plan. Définir et tester l'échéance publique et
l'invalidation des échéances périmées dans le circuit retenu.

### G2 — Expiration et concurrence de navigation

Le contrat Sighty rejette une seconde transition pendant `changing` et
invalide les événements d'une liaison sortie. L'expiration provient d'une
scène persistante : elle ne doit pas disparaître pendant le retour au menu ou
l'admission d'une finale, ni permettre deux verdicts.

La priorité est acceptée : le décompte reste actif pendant le feedback ; une
expiration survenant pendant les 2 s attend l'événement de fin du feedback avant
de rejoindre la défaite. Le passage à la finale n'est possible qu'après le
retour au menu ; il n'interrompt pas une question active. Exercer ces collisions
avec le runtime réel et vérifier qu'un seul verdict est produit. Si l'admission
actuelle ne permet pas la règle retenue, enregistrer la preuve dans le plan
Sighty propriétaire et arrêter cette intégration. Une file de navigation ou
des tentatives périodiques locales au jeu ne constituent pas une correction.

### G3 — Jeton et cible dans une autre scène

La frontière de responsabilité est décidée : le jeton et sa mécanique de
saisie/glissement appartiennent à la scène de jeu `scene-layout`, en
surimpression persistante ; la disponibilité et la consommation du jeton, le
résultat du dépôt et la nouvelle admission de l'épreuve appartiennent à la
progression Sighty. Le menu reste une scène distincte.

Le point délicat est la détection du dépôt sur une tuile du menu depuis cette
surimpression. Le DOM partagé rend une mesure directe envisageable, mais elle
franchit la frontière d'isolation entre instances. Cette possibilité est un
constat à examiner, pas un mécanisme adopté ni une dispense du contrat.

**Étudier après l'implémentation générale P1–P3**, avant de coder le dépôt.
Reprendre alors les contrats et adaptateurs existants Sighty/CodPlay pour
identifier si la capture, la preview, les slots ou la composition exposent
déjà un chemin qui donne la cible au layout sans accéder arbitrairement à
l'instance menu. Le test S6 injecte sa destination ; il ne prouve pas la
résolution géométrique dans le parcours pointeur/capture. Le contrat de capture
`public` ne relaie pas non plus un événement vers une autre instance. Vérifier
les comportements certifiés et les preuves restantes citées au §1 avant de
conclure.

Ne pas ajouter de capacité à `packages/codplay`, appeler directement l'instance
menu depuis le drag, ni introduire de secours par rectangles DOM avant cette
étude. Si les circuits existants ne permettent pas le dépôt avec les frontières
retenues, consigner les preuves et rapporter les options au lieu d'étendre le
cœur ou de masquer l'écart dans la démo.

Après décision sur le chemin de cible, exercer un vrai glissement depuis le
layout vers le menu, un dépôt invalide, un resize et un changement de vue
pendant la capture. Le retry passe par l'admission Sighty et un reset logique
de question, sans écriture directe dans `SceneDoc`. Consommer le jeton après
l'admission réussie évite sa perte sur une navigation refusée.

### G4 — Rejouer, rewind et Seek

Le transport commun fait actuellement un rewind des scènes sélectionnées puis
les joue. Ce n'est pas une nouvelle partie : le contexte métier reste présent.
Ne pas modifier silencieusement cette sémantique pour les autres démos.

Décider séparément la nouvelle partie, la relecture locale et le contrôle
temporel de démonstration. `runtime.reset()` remet à zéro le runtime complet ;
`reset: ['all']` restaure le contexte et demande les effets `onReset` pris en
charge par les scènes. Ces deux circuits existent mais n'ont pas les mêmes
effets sur les horloges et les occurrences. La politique du minuteur détermine
celui que le jeu doit utiliser et comment reprendre la composition initiale.

Sighty ne possède pas un historique temporel global du parcours. Un Seek dans
une question ne reconstitue pas le panier et les routes passées. La première
reconstruction doit annoncer ce périmètre dans son acceptation : Seek local
CodPlay, pas promesse de rembobinage complet de la partie. La persistance
sérialisée entre chargements n'est pas ajoutée ; elle appartiendrait à l'hôte.

### G5 — Vidéo native de la question

**Choix accepté le 2026-10-10.** Nostromo est rendu par un perso CodPlay
`tag`, dont `initial` porte `tag: 'video'`, `attr.src`, les contrôles natifs,
`autoplay`, `muted`, `playsinline` et `preload: 'auto'`. Le navigateur pilote la
lecture, la pause, le seek et la relecture. La question n'utilise pas le perso
`media`, les broadcasts `START`/`STOP` ni le service de handoff du nœud vidéo.
La scène panier et sa timeline générale restent indépendantes de cette vidéo.

La compilation Sighty prépare les définitions des scènes, mais ne matérialise
pas les occurrences des questions inactives. Le manifeste de ressources
CodPlay dérive `src` des champs auteur de premier niveau ; `attr.src` du `tag`
vidéo n'y est pas inclus. Le navigateur commencera donc son chargement lorsque
la question sera matérialisée. `preload: 'auto'` demande le chargement natif et
`autoplay` lance la lecture dès que le navigateur le permet, avec `muted: true`
pour respecter les politiques d'autoplay. Cette voie ne garantit pas que la
vidéo soit entièrement prête avant l'ouverture de la question ; la latence et
la première image restent à mesurer dans le navigateur réel. Le correctif futur
pour inclure `initial.attr.src` du perso `tag` dans le manifeste compilé est
suivi au [plan CompiledScene](../../codplay/plan/compiled-scene-plan.md) ; il
n'est pas appliqué par cette tranche et devra y être validé avant de promettre
un préchargement avant l'entrée.

**Acceptation G5 :** dans Safari, vérifier sur la vraie question que le tag a
une seule source correcte, que les contrôles natifs sont visibles et utilisables,
que l'autoplay muet démarre à l'ouverture, que pause/seek/relecture ne déplacent
pas la timeline de la scène, et que le panier/minuteur continue de suivre ses
règles. Relever `readyState`, `paused`, `currentTime`, les événements `play`,
`playing`, `pause` et `error` à l'entrée et à la fin du feedback. Vérifier aussi
le comportement du lecteur lorsque la question est masquée, puisque le cycle
n'est plus arrêté par `media-sync`. Le test couvre cache froid et réseau ralenti
si l'environnement navigateur le permet ; à défaut, garder cette limite dans le
statut plutôt que présenter `preload: auto` comme une garantie de disponibilité.

**Observation Safari — 2026-10-10 :** la question Nostromo réelle rend un élément
`VIDEO` avec la source attendue, `controls`, `autoplay`, `muted` et
`preload="auto"`, et ses contrôles natifs sont visibles. À l'inspection, le
média était en lecture (`paused=false`, `readyState=4`, `currentTime≈8,9 s`),
puis il a atteint naturellement sa fin (`duration=15,371 s`, `ended=true`).
Cela confirme que l'autoplay fonctionne une fois le chargement natif effectif
sur cette instance ; cela ne confirme pas un preload avant ouverture. Le cache
froid, l'action directe sur les contrôles, le replay et le cycle de masquage
restent à valider ; cette observation ne ferme pas G5.

**Cause identifiée dans le circuit de révélation — 2026-10-10 :** l'événement
`questionRevealDue` déclenche l'action Sighty `createRevealQuestionAction`, qui
envoie l'événement `:reveal` à la scène question active. La passerelle Sighty
émet cet événement CodPlay puis appelle `telco.seek()` à la position qu'elle
vient de capturer, même si l'émission immédiate a déjà présenté le changement à
cette même position. Le seek parcourt `replayForSeek()` ; sa synchronisation
`geometry-capture` force la mise à jour des composants, et la mise à jour du
perso vidéo réécrit son `src` identique. Dans Safari, la réécriture de `src` sur
le même nœud vidéo émet `emptied` puis `loadstart` et remet `currentTime` à zéro.
Le déclencheur se trouve donc dans le circuit d'événement d'affichage en cours
de lecture, pas dans `showMode`. Le parcours navigateur ciblé reste à capturer
pour vérifier cette chaîne exacte sur l'événement `questionRevealDue`. La
frontière de correction reste ouverte au
[plan de représentation des composants CodPlay](../../codplay/plan/component-render-representation-plan.md),
qui est encore `A relire` ; aucune modification de code n'est faite ici.

Les observations Safari du 2026-10-09 et le timeout du service CodPlay `preload`
portaient sur l'ancien perso `media`. Elles ne valident ni ne réfutent la voie
native `tag` et ne sont plus un prérequis à son initialisation. Aucun fallback
ou contrôle DOM local n'est ajouté. Si l'autoplay natif échoue ou si le média
continue au-delà de la question, documenter le comportement observé puis faire
trancher la suite avant d'introduire une autre commande.

## 6. Organisation proposée

Ajouter une entrée au registre Sighty existant, avec un identifiant lisible
`quiz-hunt`, sans nouvelle page HTML ni nouvelle télécommande.

```text
packages/demos/src/sighty/quiz-hunt/
├── main.ts                     # entrée de la page commune
├── game-composition.ts         # configuration, initialisation, destruction
├── scenario.ts                 # graphe, catalogue, actions et guards
├── game-data.ts                # configuration et adaptation du contenu commun
├── game-rules.ts               # règles métier pures
├── game-presentation.ts        # projections vers les scènes actives
├── messages.ts                 # vocabulaire métier déclaré
├── style.css
└── scenes/
    ├── layout-scene.ts
    ├── menu-scene.ts
    ├── question-scene.ts       # habillage épreuve/finale d'un quiz réutilisé
    ├── basket-scene.ts         # une scène pour panier, inventaire et minuteur
    └── result-scene.ts
```

Conserver un seul catalogue de contenu et un seul tirage. Extraire les données
et la fonction pure de seed vers un dossier commun aux démonstrations si
nécessaire, en gardant les imports V1 fonctionnels ; ne pas dupliquer les JSON
ou importer un runtime `codplay-v1` dans le jeu Sighty.

Pour P1, extraire le minimum du circuit de réponse de Demo 5 dans un module
commun dédié aux quiz : sélection, validation, correction et état local de la
question. L'habillage et l'adaptateur de page scrollable restent propres à
Demo 5 ; Quiz Hunt réutilise le circuit dans ses scènes autonomes. Cette
extraction ne crée pas un package ni une abstraction générale d'épreuve. Tous
les parents des nouveaux `markup` auront un `id`.

## 7. Étapes et critères de passage

| Étape | Travail proposé | Preuve de passage | Statut |
| --- | --- | --- | --- |
| P0 — décisions | Structure, propriétaire de l'état, génération au lancement, preload vidéo, emplacement du jeton et suite Space Bubbles acceptés ; consigner les règles observées à préserver et garder les décisions propres aux étapes ultérieures dans G2–G5 | Décisions de P1 conservées ; G3 reporté après P3 ; aucun choix ouvert de P2/P3/P5 anticipé | En cours |
| P1 — première verticale | Extraire le circuit de réponse réutilisable de Demo 5, puis créer le layout responsive sans titre global ni libellé « Panier », le menu caché pendant la question, deux questions générées au lancement dont Nostromo avec sa vidéo native, et la scène panier/minuteur conservée ; intégrer au registre Sighty commun | Vérifier l'absence des titres « Choisis une épreuve » et « Panier » ; ouvrir Nostromo et valider le tag vidéo `src`/`preload`/`autoplay`/`controls`, pause/seek/relecture natives et indépendance envers la timeline générale ; transmettre pause/play du décompte via Sighty sans modifier la lecture de la scène panier, répondre, voir le feedback, revenir et ouvrir l'autre question ; même occurrence panier et temps cohérent ; en portrait, la page n'a pas de bande vide sous la télécommande, la scène question garde la priorité avec défilement si nécessaire, et le menu réduit sa grille pour montrer le panier quand l'espace le permet ; sur mobile, mesurer des cases à la hauteur responsive du bouton de validation, une réserve d'extra fluide, un cadran à côté des cases et une taille de texte légèrement réduite ; en paysage, les cases occupent les deux colonnes du panier et le cadran de 8 rem se place dessous ; question à gauche et scène panier/minuteur à droite | En cours — Safari confirme les proportions et le layout à 390 px, 336 px, 817 px et 1440 px ; le parcours timer/question avait été exercé avec l'ancien perso `media`, mais le nouveau parcours tag/autoplay, sa disponibilité à froid et son cycle de masquage restent à valider en G5 |
| P2 — jeu complet | Génération au lancement des 16 épreuves et 16 finales, seed, statuts et refus d'accès ; conserver la vidéo native de Nostromo validée en P1 | Catalogue complet avant le parcours, même tirage pour même seed, 4 couleurs, remplacement d'un mot de même couleur, aucune route vers une épreuve interdite | En cours — catalogue et progression testés dans Safari ; reste à revalider avec le parcours vidéo natif de P1/G5 |
| P3 — finale et verdict | Sélection finale depuis le menu après fermeture de l'épreuve courante ; réussite et trois branches d'échec ; expiration concurrente selon G2 ; résultat en slot superposé plein cadre au-dessus du menu | Verdict unique ; feedback de 2 s terminé avant une défaite par expiration ; retour au menu avant l'activation finale ; panier, minuteur et branches exercés ; vérifier que le menu reste visible sous le fond translucide, que le root résultat couvre toute la scène, et que l'état caché/visible suit les issues ; parcours général validé avant étude G3 | En cours — Safari a validé la branche de victoire et la superposition plein cadre sur le runtime réel ; branches d'échec et expiration concurrente restent à exercer ; la voie tag/autoplay de P1/G5 reste à valider en navigation froide |
| P4 — étude du dépôt inter-scènes | Après P3, cartographier la détection de cible déjà possible depuis le jeton de `scene-layout` vers le menu, avec les contrats et chemins existants | Note d'étude : frontières respectées, preuve ou limite des possibilités actuelles, chemin recommandé sans capacité CodPlay nouvelle ; sinon options rapportées à l'utilisateur | A relire — après P3 |
| P5 — jeton et rattrapage | Achever l'offre, la collecte, l'overlay, le dépôt selon l'issue de P4, la consommation et la nouvelle tentative | Vrai pointeur et cible menu prouvés sur le runtime réel ; dépôt invalide, resize, navigation pendant capture, admission Sighty et reset de question exercés ; aucune modification CodPlay | A relire — dépend de P4 |
| P6 — reprise et cycle | Nouvelle partie, commandes communes, occurrences conservées, sortie de démo | Deux parties successives, anciens événements sans effet, médias/captures/ressources nettoyés | A relire |
| P7 — stabilisation | Matrice complète, spécification de la démo et documentation d'usage | Implémentation, preuves, spécification et suivi alignés | A relire |

P1 doit éprouver tôt la politique temporelle et le preload de la vraie vidéo.
P4 est explicitement postérieur à l'implémentation générale P1–P3 ; P5 dépend
de ses conclusions et ne commence pas avant elles. P3 et P5 ne sont pas
remplacés par des boutons qui simulent une réussite, une expiration ou une
cible de dépôt. Une livraison intermédiaire peut être examinée, mais ne vaut
pas reconstruction complète du jeu.

### État des validations P1 — 2026-10-09

Dans Safari, le parcours Nostromo → réponse correcte → feedback → menu →
Arrakis a été exercé avec l'ancien perso `media`. Cette trace ne valide pas le
nouveau tag vidéo natif ; sa lecture et son préchargement browser restent ouverts
en G5. Le formulaire s'est révélé après le délai prévu. Les événements
publics `timerPause`, `timerPlay` et `questionRevealDue` sont arrivés de la
scène question ; l'action Sighty a relayé pause/play à la scène panier, puis la
question a été révélée. La pause a capturé `129229 ms` avant la reprise sur
Arrakis. Le chrono a continué pendant la réponse, le feedback et le retour au
menu. La scène panier est restée sélectionnée pendant les deux questions.

Le chemin utilisé place les commandes temporisées comme événements publics
enfants de l'événement `entry` de la question. Sighty transmet `entry` à la
scène CodPlay ; le strap `listen` essayé dans la story ne s'exécutait pas sur
ce chemin et le formulaire restait masqué. La trace Safari ne montrait aucun
événement timer. L'événement imbriqué conserve l'émission depuis la scène
question, puis réutilise les actions Sighty et le `send` déclaré vers le
minuteur. Aucun changement Sighty ou CodPlay core n'a été nécessaire.

Les mesures Safari en paysage (largeur `1440 px`) placent le panneau question à
gauche (`766 px`) et le slot panier/minuteur à droite (`352 px`). En portrait
(largeur `900 px`), le slot panier commence sous la zone question avec un
intervalle de `16 px`. Le panneau de question défile verticalement et ne
débordait pas horizontalement.

Une vérification complémentaire dans Safari a corrigé la hiérarchie portrait :
la question et son formulaire occupent la zone principale ; le panier et le
minuteur viennent après dans le défilement du layout. À `390 × 780 px`, la
zone principale mesure `428 px`. Le panneau Arrakis a `426 px` utiles pour
`688 px` de contenu ; un défilement de `262 px` révèle les quatre réponses et
le bouton de validation. Le défilement du layout atteint ensuite le panier et
le cadran. En paysage (`1440 × 758 px` de zone Safari), les colonnes mesurent
`766 px` pour la question et `352 px` pour le panier/minuteur. Les dimensions
responsive actuelles du panier et du cadran sont consignées ci-dessous ; aucun
débordement horizontal n'a été observé.

Le badge de question conserve la forme polygonale et la couleur de la V1, avec
un slot de `2,5 rem` pour rester une puce. Ces vérifications de présentation ne
clôturent pas les gates Play/Seek/replay ni le préchargement complet à cache
froid et sous réseau ralenti de P1/G5.

À la demande d'occuper toute la hauteur mobile, la mesure Safari initiale à
`390 × 841 px` montrait un stage de `463 px`, une ligne de footer de `261 px`
et une télécommande de `62 px` : près de `199 px` de la ligne restaient vides
sous les boutons. La règle spécifique à Quiz Hunt donne maintenant `661 px` au
stage et `62 px` au footer ; la télécommande termine à `832 px` dans le
viewport, et le document reste à `841 px`. La vue question réelle conserve son
défilement interne (`705 px` de contenu pour `659 px` visibles).

Pour vérifier le calcul du menu sans modifier la partie en cours, une fixture
DOM temporaire hors écran a repris le conteneur de jeu et la scène panier
montés, puis simulé les classes du menu V1. Dans un stage de `659 px`, elle
mesure une ligne menu de `443 px`, une grille de `338 × 338 px` et un panier de
`168 px`, entièrement contenu avec `16 px` de marge basse. Cette fixture valide
les règles CSS du menu. Dans la session Sighty déjà initialisée, un clic sur
Arrakis a ensuite ouvert la vraie question. Une nouvelle navigation Safari
échouait au preload CodPlay de l'ancien perso `media`. La voie `tag` choisie
maintenant n'utilise plus ce service ; son chargement natif à froid reste à
valider sous G5. Le panneau Info est resté fermé.

Sur la question Arrakis active dans Safari, le bouton et les cases font `38 px`
à `390 px` de large et `36 px` à `336 px`. Le texte des cases est maintenant à
`14,4 px` (`0,9 em`). En portrait, le cadran s'étire toujours sur les deux
rangées : la zone mesure `84 px` à `390 px` et `80 px` à `336 px`, avec le bloc
panier/minuteur à `108 px` puis `104 px`. La réserve d'extra varie de `56 px` à
`48 px`, sans débordement horizontal.

En paysage, la question reste à gauche et le panier à droite. Après le
déplacement du cadran sous les cases, Safari mesure un host panier de `352 px` ;
les cases font `172 × 68 px` chacune et le cadran centré `128 × 128 px`. Le bloc
panier mesure `304 px` de haut, dans un host de `367 px` à `817 px` de large et
`530 px` à `1440 px`. Aucun débordement horizontal n'apparaît. Le cadran V1 et
le jeton restent à exercer selon les gates P1/G3/P5.

Le markup panier conserve les quatre cases comme enfants directs de sa racine,
montées au repère commentaire ; cette racine porte leur grille responsive. Le
typecheck V2 et le build des démos passent.

Après suppression du titre global « Choisis une épreuve », Safari confirme
l'absence de rangée vide : en portrait (`390 × 780 px`), le contenu commence à
`119 px` dans le layout et le panier suit la question ; en paysage (`1440 ×
758 px`), les deux zones commencent sur la même rangée à `111 px`. Le parcours
menu → question reste utilisable et le panneau Info est fermé.

La grille conserve ses quatre lignes et colonnes V1. P1 ne générait que les
deux tuiles Nostromo et Arrakis ; P2 reprend maintenant le catalogue complet de
16 épreuves et leur ordre numéroté issu du tirage V1. Les quatorze tuiles ne
sont pas des placeholders.

### État des validations P2 — 2026-10-09

Le catalogue réutilise le JSON SF spatiale V1 et sa fonction pure
[`deriveGameDraw`](../src/v1/scenes/quiz-hunt/seed.ts), avec la seed `1` de
l'entrée V1. Safari a confirmé 16 épreuves, 16 finales et 16 définitions de
scène finale présentes dans `scenario.scenes` avant le parcours ; les quatre
couleurs portent chacune quatre épreuves. Deux créations depuis la même seed
produisent le même tirage. L'ordre observé est :

```text
arrakis, dave-bowman, discovery-one, cooper, lv-426, icarus-ii, xenomorphe,
leeloo, hal-9000, solaris, endurance, monolithe, ripley, pandora, nostromo,
ver-des-sables
```

Le navigateur affiche bien les 16 tuiles avec leurs noms accessibles et leurs
couleurs V1. Un clic sur Arrakis ouvre sa question, une bonne réponse remplit
le rouge, puis la réussite de LV-426 remplace Arrakis dans ce même panier. Une
réponse fausse sur Dave Bowman projette le statut échoué ; les deux statuts
sont désactivés. La projection conserve le libellé accessible, ajoute la
classe V1 de réussite/échec, et les tentatives de clic sur une tuile résolue
ne rouvrent pas de question. Le circuit Sighty réel a été exercé ; aucune
modification de `packages/codplay` n'a été nécessaire. Aucun nouvel avertissement
ou erreur Safari n'a été relevé, et le panneau de logs est resté fermé.

La génération des scènes finales est vérifiée ; leur choix, leurs guards et
leurs conséquences restent en P3. Le chargement natif de Nostromo avec le nouveau perso `tag` reste à valider
en P1/G5, notamment à cache froid et sous réseau ralenti.

### État d'implémentation P3 — 2026-10-09

Le scénario auteur contient maintenant les routes statiques des finales, le
bouton de finale réservé au menu avec panier complet, les branches de
remplacement/retour à la chasse/défaite, et le report de la défaite par
expiration jusqu'à la fin des 2 s de feedback. Le résultat occupe maintenant un
slot superposé plein cadre ; la branche de victoire a été exercée dans Safari,
avec le menu visible derrière son fond translucide après la fin du feedback.
Le typecheck V2 et le build Vite passent. P3 reste `En cours` : les branches
d'échec et d'expiration n'ont pas été validées dans le navigateur, et une
parcours vidéo natif de P1/G5 reste à éprouver. G2 reste à valider
avec le runtime réel.

Après P7, ouvrir le plan distinct du portage V2 de Space Bubbles et de son
intégration comme épreuve. Ce travail est une suite acceptée ; il ne fait pas
partie de la première mise en place et validation de Quiz Hunt.

## 8. Acceptation et tenue documentaire

Les tests de contrats Sighty utilisent leurs propres scènes, valeurs et temps
dans `packages/sighty/tests`. Toute preuve CodPlay nécessaire appartient aux
tests de son domaine et exige la validation de son plan avant modification.
Aucun test comportemental n'est ajouté aux dossiers de démonstration ; aucun
test runtime ne dépend du contenu, des assets ou des temporisations Quiz Hunt.
La recette du jeu utilise ensuite la vraie démo dans le navigateur.

La matrice de validation doit couvrir :

- **Play et événements :** parcours complet avec vraie saisie, gardes,
  projection immédiate du panier, temps d'indice et de feedback, expiration,
  refus des doubles réponses et collisions de transition. Vérifier le trajet
  question → Sighty → mécanisme du minuteur : le décompte se fige puis reprend
  tandis que le transport de la scène panier reste inchangé. Vérifier que son
  temps logique avance et que ses projections sont traitées pendant la pause
  du décompte.
- **Génération :** toutes les épreuves et finales sont construites au lancement
  depuis le catalogue et le tirage uniques ; le premier clic sur une tuile ne
  déclenche pas la génération de sa question.
- **Vidéo Nostromo native :** le perso est `tag` avec `src` dans `attr`,
  `controls`, `autoplay`, `muted`, `playsinline` et `preload: 'auto'`; aucun
  broadcast média ni transport de la timeline générale ne pilote le lecteur.
  Dans Safari, vérifier autoplay, contrôles, pause/seek/relecture, première
  image, chargement à froid et comportement après masquage de la question. Le
  manifeste CodPlay n'inclut pas ce `attr.src`; ne pas présenter le hint natif
  `preload: auto` comme une garantie de ressource prête avant l'entrée. Préserver
  le délai d'indice de 5 s, le budget du minuteur, la réponse et le feedback.
  Le correctif futur de découverte de `initial.attr.src` est suivi au [plan
  CompiledScene](../../codplay/plan/compiled-scene-plan.md), avec son propre
  parcours de validation du preload avant matérialisation.
- **Finale :** panier incomplet refusé, couleur déterministe, succès, mot de
  remplacement déjà gagné, retour à la chasse et épuisement des possibilités.
- **Seek local et replay :** question, média et minuteur sur leurs frontières
  propres ; pas de crédit double après relecture ; nouvelle partie complète
  après succès, échec et expiration. Définir les résultats attendus en G4.
- **Parent/enfant et cycle :** identité conservée de l'unique scène
  panier/minuteur, menu caché pendant la question, pause et invalidation de la
  question sortie, remplacement dans le même slot,
  réadmission, couche de jeton portée par `scene-layout` pendant les
  changements de contenu, changement de démo et destruction. Si un reparent
  devient nécessaire, consigner sa raison et l'exercer après l'étude P4.
- **Resize et capture :** grille, réponses, panier, vidéo et minuteur ; dépôt
  valide/invalide entre l'overlay de `scene-layout` et le menu, nouvelle mesure
  de la cible et annulation pendant navigation, selon le mécanisme retenu après
  P4.
- **Persistance :** vérifier la conservation entre vues ; documenter que la
  sauvegarde de partie entre chargements reste hors périmètre, sans l'assimiler
  à une preuve de persistance sérialisée.
- **Non-régression :** Demo 5 après extraction du quiz, démos utilisant le
  transport commun si celui-ci change, V1 si ses données ou imports sont déplacés.
- **Vérifications techniques :** suites des packages réellement touchés,
  typechecks Sighty et démos, build des démos, vérification du diff puis parcours
  navigateur complet avec journal et diagnostics observés.

Après chaque comportement implémenté et prouvé, mettre à jour la spécification
existante [Sighty Quiz Hunt](../specs/sighty-quiz-hunt-spec.md) avec les preuves
correspondantes.
Si une capacité runtime évolue, mettre à jour sa spécification propriétaire
dans la même tâche. Les décisions et preuves restantes restent dans ce plan ;
les spécifications existantes ne sont pas modifiées pour enregistrer une
intention de reconstruction. Retirer ce plan seulement quand sa couverture est
complète et ses liens repris.

## 9. Suite acceptée — Space Bubbles, plan distinct

Le portage V2 du mini-jeu `space-bubbles`, puis son ajout comme épreuve de
Quiz Hunt, interviendront après la mise en place et la validation de ce plan.
Le plan distinct devra relire les contrats et les règles V1 du mini-jeu,
définir son résultat public et son raccord à la progression Sighty, puis
prouver le parcours réel d'une épreuve jouée et résolue.

Le mini-jeu conservera son autonomie de scène. L'état d'ensemble restera dans
Sighty. Ce séquencement ne demande aucune fabrique générale de mini-jeux ni
aucun portage anticipé dans la présente tranche. Avant le retrait de ce plan,
transférer cette suite acceptée dans son plan distinct et relier les deux
périmètres pour qu'elle ne soit pas perdue.
