# Elcé — agrandissement interpolé d’un contenu dans le viewport

> Statut : **A relire** — enquête réalisée le 14 octobre 2026 ; architecture
> proposée, aucune implémentation de la fonctionnalité engagée.
> Périmètre : lecteur Elcé exécuté par Sighty/CodPlay.

## Demande et décisions acquises

- La réflexion concerne exclusivement Elcé. CodPlay porte l’exécution ; il
  ne s’agit pas de généraliser d’emblée une nouvelle API du cœur.
- Un clic sur une image l’agrandit pour occuper l’espace disponible du
  viewport de la page. L’interface du navigateur reste présente.
- Un second clic ramène le contenu à son emplacement et à sa présentation
  ordinaires. Les deux passages utilisent une interpolation.
- Dans un Carousel agrandi, les flèches ou le swipe changent le contenu ;
  la fermeture conserve la nouvelle sélection dans le Carousel ordinaire.
- `img` est le premier contenu visé. Le même dispositif devra servir à la
  vidéo, puis à d’autres parties, notamment le Graphe, traité comme un média
  du point de vue de cette interaction Elcé. Cette intention ne change pas
  le modèle documentaire vérifié des BDC et ressources.
- Précision du 14 octobre : Elcé n’est pas conduit par une barre de progression.
  Le replay du parcours et son rembobinage ne font pas partie de l’acceptation
  de ce dispositif. Les vidéos seront **libres par défaut**, sans lien avec
  une timeline de scène. Leur lecture et leurs contrôles suivent le temps
  propre du média. Une vidéo synchronisée pourrait relever ultérieurement
  d’un BDC spécifique ; cette piste n’est pas une décision de construction.
- Précision acceptée ensuite : cette indépendance sera portée par `media`,
  qui conservera ses commandes broadcast. La relation entre horloges est
  nommée `sync`, avec `auto` par défaut CodPlay, `master` lorsque le média
  conduit CodPlay, et `independent` lorsque les horloges sont indépendantes.
  Elcé choisira explicitement `sync: 'independent'` pour ses vidéos ordinaires.
  Cette évolution est implémentée et vérifiée le 14 octobre ; son contrat et
  ses preuves sont dans la spécification média CodPlay.
- L’utilisateur demande maintenant de réaliser l’évolution CodPlay avant
  son application Elcé. Le périmètre confirmé est `media` puis Elcé, avec
  les composants tiers différés. La sortie de page Elcé émettra `STOP`, qui
  arrête et remet la vidéo à zéro ; le retour sur la page n’ajoute donc pas
  de commande de remise à zéro. La tranche média est réalisée et vérifiée, séparément de l’agrandissement.
  La même relation
  sera considérée pour Rive, Three.js et Lottie : `auto` par défaut, conservant
  leur pilotage CodPlay actuel, et `independent`, sans mode `master`. Cette
  extension est suivie au plan des composants tiers ; elle n’ajoute pas une
  intégration de ces bibliothèques à la tranche d’agrandissement Elcé actuelle.
- Étudier une capacité, y compris externe, et la possibilité de porter le
  dispositif par un perso régulier. Étudier `move` vers un élément occupant
  le viewport. Aucun de ces choix techniques n’est encore accepté.

## Contrats relus et circuits à conserver

| Sujet | Référence et propriétaire existant | Conséquence pour l’étude |
| --- | --- | --- |
| Image | [Composant `img`](../../codplay/specs/image-component-v2-spec.md) | Conserver le nœud par source, `alt` et les services de racine et d’image interne. |
| Vidéo indépendante | [Contrat `media.sync`](../../codplay/specs/media-sync-v2-spec.md), [preload](../../codplay/specs/preload-v2-spec.md) | Contrat appliqué : `media` en mode `sync: 'independent'`, avec broadcasts conservés. Préserver source, nœud natif et ressources. La continuité pendant l’agrandissement reste à prouver. |
| Graphe | [BDC Graphe](../specs/statistical-graph-spec.md) | Préserver SVG ou tableau, noms accessibles, données et placements existants. |
| Placement interpolé | [Move](../../codplay/specs/move-v2-spec.md), [motion](../../codplay/specs/motion-frame-v2-spec.md) | Réutiliser placement, capture de bornes et présentation motion. |
| Cible de montage | [Layout](../../codplay/specs/layout-component-spec.md), [matérialisation](../../codplay/specs/component-materialization-v2-spec.md) | Un perso `layout` peut publier une part cible dans le même runtime. |
| Interactions | [Perso.emit](../../codplay/specs/perso-emit-v2-spec.md), [capture](../../codplay/specs/capture-v2-spec.md), [événements](../../codplay/specs/event-pipeline-v2-spec.md), [straps](../../codplay/specs/strap-execution-v2-spec.md) | Les interactions rejoignent le dispatcher et le journal existants. |
| Sélection Carousel | [Carousel Elcé](../specs/carousel-bdc-spec.md) | Étendre le circuit événement → strap → actions déjà utilisé par les points. |
| Pages et instances | [Flux](../specs/flux-scene-builder-spec.md), [Diapo](../specs/diapo-scene-builder-spec.md), [preview](../specs/player-preview-spec.md) | Respecter montage, conservation des scènes et navigation Sighty. |
| Composition externe | [Façade CodPlay](../../codplay/specs/facade-v2-spec.md) | `register` et `override` utilisent le catalogue unique, verrouillé au premier build ou à la création d’instance. |

Le [guide de reprise V2](../../codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md)
a été relu après identification des plans détaillés.

## Capacité et perso : deux niveaux à distinguer

Un perso est une occurrence dans la scène, avec son état, ses actions et sa
représentation éventuelle. Une capacité fournit une définition de composant,
des services ou un module au catalogue. Une capacité externe peut donc fournir
un composant instancié comme perso régulier ; ces options ne sont pas exclusives.

La question préalable est de savoir si le dispositif exige une nouvelle
responsabilité runtime, ou seulement une composition auteur des contrats
existants. Le fait qu’il serve à plusieurs contenus ne prouve pas à lui seul
qu’un nouveau module runtime soit nécessaire.

| Option | Répartition proposée | Évaluation |
| --- | --- | --- |
| Perso régulier avec composants existants | Un perso hôte `layout` expose la cible viewport ; les persos concernés portent les actions d’aller/retour ; les straps utilisent l’état logique. Les builders Elcé partagent la construction du dispositif. | Première piste à éprouver : commune aux images, vidéos et contenus HTML/SVG, sans modification de leurs composants. |
| Capacité externe fournissant un perso dédié | Un composant hôte porte la représentation et un éventuel cycle propre ; ses déclarations rejoignent le catalogue avant compilation. Les actions des contenus passent toujours par `move`. | À retenir seulement si une responsabilité précise manque au `layout` et à la composition auteur. Définir son contrat et ses preuves avant toute classe ou API. |
| Capacité ajoutée aux composants de contenu par override | Remplacer la définition de `img`, puis éventuellement celle de `media` ; le Graphe utilise actuellement un layout. | Mécanisme disponible, mais plusieurs intégrations à maintenir pour un comportement commun. Ne pas retenir comme point d’entrée sans besoin propre au composant. |
| Nouvelle primitive d’action du cœur | Ajouter une sémantique générique d’agrandissement. | Aucun besoin établi à ce stade. Identifier d’abord une limite du circuit existant ; plan accepté et autorisation explicite requis. |

**Orientation proposée, A relire :** commencer par le perso hôte régulier et
la composition d’actions existantes. Si l’étude établit un besoin de capacité,
préférer un dispositif externe commun aux contenus à des implémentations
indépendantes dans `img`, `media` et le Graphe.

## Hypothèse `move` vers une cible viewport

Le perso hôte fournit une vraie boîte mesurable à la taille disponible ;
son fond peut être transparent. Le contenu original rejoint sa cible avec une
transition `move`, puis rejoint sa cible d’origine avec la transition inverse.
La destination de retour et la présentation ordinaire viennent de la scène
auteur ; elles ne sont pas reconstruites en lisant un ancien état DOM.

L’élément « invisible » ne doit pas rendre son contenu invisible ni supprimer
sa géométrie. Il faut distinguer l’absence de décor d’un état `display: none`,
d’un détachement `@off`, ou d’une invisibilité/opacité transmise aux enfants.
La cible doit rester résoluble aux bornes pertinentes du mouvement.

L’hôte doit être dans le périmètre de placement de l’instance concernée.
`@root` désigne sa racine de montage, pas le viewport du navigateur. Elcé monte
des instances de page dans des slots Sighty : une cible placée dans le layout
persistant d’une autre instance ne devient pas automatiquement une destination
de `move` pour le contenu de la page. Ne pas créer de portail DOM ou de transfert
interinstances implicite pour contourner cette frontière.

L’hôte n’impose pas de nouvelle enveloppe à chaque BDC. Réutiliser les racines
et réserves présentes avant d’envisager une structure supplémentaire.

## Vidéo libre et temps de présentation

La durée d’un `move` règle l’interpolation visuelle. Elle ne doit pas devenir
le temps de lecture de la vidéo, ni lui imposer un positionnement, une vitesse
ou une pause. Ouvrir ou fermer l’agrandissement préserve la lecture ou la pause
native, le temps courant et le son ; cela ne relance pas la ressource.

Le [choix G5 de Quiz Hunt](../../demos/plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md#g5--vidéo-native-de-la-question)
utilise un perso `tag` vidéo et ses contrôles natifs, sans broadcasts média
`START`/`STOP`. Il fournit une référence pour la lecture indépendante, pas un
contrat Elcé déjà appliqué. Le correctif CodPlay explicitement reporté dans ce
plan concerne la découverte de `initial.attr.src` par le manifeste compilé,
pour permettre au préchargement Sighty existant de traiter la source avant
matérialisation. Disponibilité et absence de chargement redondant restent à
prouver ; ne pas présenter le préchargement comme acquis.

La cible choisie est maintenant le composant `media` avec la relation
`sync: 'independent'`, en conservant ses commandes broadcast. La vidéo suit
son propre temps ; CodPlay ne la synchronise pas à son temps de scène et elle
ne fournit pas l’horloge CodPlay. Les commandes explicites restent possibles.
Les commandes retenues sont `START`, `PAUSE` et `STOP`. La mention de `PLAY`
a été corrigée par l’utilisateur en `START` ; un éventuel alias reste
facultatif et non décidé. Leur application est vérifiée dans la [spécification média](../../codplay/specs/media-sync-v2-spec.md).

Ce mode est implémenté et appliqué aux vidéos Elcé. Le STOP de sortie et le
retour à zéro sont vérifiés dans la [spécification preview](../specs/player-preview-spec.md#lecture-des-vidéos-et-sortie-de-page). Le choix `tag` de Quiz Hunt éclaire
l’origine du besoin et son report de préchargement ; il n’est pas le raccord
retenu pour Elcé. Une vidéo enregistrée peut être indépendante ; le type de
source et la relation d’horloges sont des préoccupations distinctes.

Les captures géométriques internes éventuelles de motion restent à analyser :
elles ne doivent pas réassigner une source identique ou modifier la lecture
native. Ce contrôle de continuité n’ajoute pas un parcours utilisateur de
Seek/replay à Elcé. Si le cœur est modifié, ses obligations de non-régression
propres restent suivies dans son plan propriétaire.

## Points à décider ou à prouver avant implémentation

### Géométrie et retour

- Définir l’espace disponible : viewport complet de la fenêtre de lecture ou
  région de contenu après réservation de commandes. Proposer une image entière
  en `contain`, centrée et sans déformation ; valider ce cadrage et les marges.
- Préserver la place du contenu dans le Flux pendant l’agrandissement et
  retrouver une page sans saut de défilement. Les réserves d’ancre existantes
  ne couvrent pas nécessairement les Cartes directes et tous les layouts.
- Ne pas interpréter `move.resize: preserve` comme une réservation générique
  de l’emplacement source : sa preuve actuelle porte sur une dimension de
  destination pendant la transition.
- Le [plan dimensions](../../codplay/plan/list-dimension-interpolation-plan.md)
  laisse ouverts largeur, `container` et combinaisons. Une transition de boîte
  ne prouve pas à elle seule la continuité du cadrage `cover` → `contain`.
- Le [plan motion](../../codplay/plan/motion-live-discovery-invalidation-plan.md)
  prévoit des overlays locaux aux stories, avec un repère commun pour les
  cas concernés. Vérifier le trajet réel dans les ancêtres avec clipping,
  transformations et contexte d’empilement ; `reparent: true` ne certifie pas
  une présentation au-dessus de toute la page.
- Tester le resize et l’orientation pendant l’ouverture, à l’état agrandi et
  pendant le retour. La cible de retour suit la disposition courante.

### Interactions et temporalité

- Décider la conduite d’un second clic pendant l’interpolation : interruption
  continue ou attente de fin. Le présentateur actuel utilise un clone de
  présentation et lui applique `pointerEvents: none` ; le clone n’est pas une
  nouvelle source interactive. Ne pas lui greffer un circuit d’événements local.
- Vérifier que le lecteur Elcé courant peut recevoir les interactions requises.
  `Perso.emit` ordinaire ne produit pas d’entrée pendant la pause du player dans
  le sous-ensemble certifié ; une pause native de vidéo libre est une autre
  opération et ne doit pas désactiver l’agrandissement. Ne pas ajouter une barre
  de transport ni une commande de reprise de scène pour compenser un écart.
- Un swipe est une reconnaissance de geste, distincte des effets AutoCapsule
  nommés `swipe-left` et similaires. Évaluer l’adaptateur pointeur et la capture
  existants : seuil, direction, annulation, conflit avec le scroll vertical,
  puis émission discrète dans le circuit de sélection. Le swipe ne doit pas
  provoquer également le clic qui ferme le mode agrandi.
- Fixer boutons fléchés, éventuelles touches clavier, Échap, focus d’entrée
  et de retour, arrière-plan interactif et défilement. Pour les méthodes HTML,
  conserver le [contrat existant](../../codplay/specs/html-element-method-spec.md)
  et ne pas introduire des appels DOM impératifs dans la composition Elcé.
- Définir durée/easing, répétitions rapides, unicité du contenu agrandi et
  fermeture lors d’un changement de page, d’une synchronisation ou d’un reset.

### Carousel, vidéo et Graphe

- Le mode agrandi conserve la sélection et l’ordre du Carousel existant ;
  les flèches et le swipe rejoignent sa sélection, sans seconde liste de médias.
- Décider le comportement aux extrémités et sur les vues sans image, vidéo ou
  Graphe. Le Carousel peut contenir des Cartes Texte ; ne pas inventer un
  filtrage ni une boucle implicite.
- Décider l’effet de l’ouverture sur l’automatique. Une sélection manuelle
  interrompt déjà la track automatique selon la spécification Carousel ;
  ne pas ajouter de minuteur ou de contrôle de lecture parallèle.
- Observation du builder actuel : le strap manuel met à jour
  `activeCardBdcId`, tandis que les eventimes automatiques activent directement
  les actions d’entrée/sortie. Ne pas utiliser cet état seul comme preuve de
  la vue actuellement affichée en automatique ; décider le raccord canonique.
- Déplacer seulement le média actif ou un cadre commun du Carousel produit
  des effets différents pour Texte/Image, légende et Graphe. Arrêter le choix
  selon le contenu à agrandir, sans emporter automatiquement tout le BDC.
- Pour la vidéo libre, conserver les commandes natives, le temps propre du
  média, l’état de lecture et le son pendant l’agrandissement et le retour.
  Le clone motion d’un élément vidéo ne prouve pas la présentation
  de son image animée : l’extension vidéo a son propre gate avant acceptation.
  Définir aussi le geste d’ouverture qui ne détourne pas les commandes natives.
- Le Graphe produit aujourd’hui du markup SVG ou Tableau porté par les
  layouts existants, pas un perso `img`. Décider si l’on agrandit sa partie
  visuelle ou sa figure avec titre/commentaire. Isoler une partie non adressable
  exige un choix de scène explicite, pas une extraction DOM après montage.
- L’aperçu modal du Graphe dans l’éditeur ne valide pas ce parcours lecteur
  Sighty/CodPlay et ne doit pas devenir son second circuit d’agrandissement.

## Plan ordonné et gates

1. **Valider l’architecture et les décisions ci-dessus — A relire.** Choisir
   perso existant ou capacité fournissant un perso ; identifier le propriétaire
   de l’hôte dans les instances de page et les cibles de contenu. Formaliser
   les choix ouverts ici ; aucune modification de code avant acceptation.
2. **Après acceptation, éprouver la tranche image.** Construire une fixture
   propre aux tests avec une image seule, une image ancrée et un Carousel.
   Utiliser les composants, sources, journal et runner réels ; inclure une
   destination viewport mesurée dans une page contenant du clipping. Prouver
   l’aller/retour interpolé avant d’intégrer les builders Elcé.
3. **Traiter une limite à son propriétaire.** Si `move`, sa présentation ou
   une source ne permet pas le contrat accepté, consigner la preuve dans son
   plan CodPlay propriétaire et arrêter le travail dépendant. Faire accepter
   l’évolution et obtenir l’autorisation de modifier le cœur avant correction.
   Un composant externe ne remplace pas une capacité runtime manquante.
4. **Intégrer les circuits Elcé.** Partager la construction du dispositif,
   raccorder Cartes, ancres, illustration Question et Carousel selon les
   placements acceptés. Raccorder flèches/swipe à la sélection existante.
   Une éventuelle capacité externe doit garder les profils et modules requis ;
   un override remplace la définition du type, il ne fusionne pas ses champs.
5. **Accepter la tranche image dans le lecteur réel.** Fermer la matrice
   ci-dessous et documenter uniquement les comportements implémentés et vérifiés.
6. **Étendre à la vidéo libre, puis au Graphe.** Garder le dispositif commun ;
   arrêter le raccord vidéo dans le plan média CodPlay et traiter le correctif
   de manifeste séparément si nécessaire. Décider et tester les particularités
   de chaque contenu avant d’annoncer sa prise en charge.

## Matrice d’acceptation requise

- Clic réel → source → dispatcher → journal → actions → placement/motion →
  materializer, puis fermeture ; un seul contenu logique et aucune ressource
  transitoire résiduelle. Vérifier les instants intermédiaires.
- Carousel : navigation dans les deux directions, nouvelle sélection conservée
  à la fermeture, réouverture, sélection en automatique et extrémités décidées.
- Parent/enfant et reparent : source et destination contraintes, ancêtres
  animés, clipping, cible tardive, conservation du Flux et de ses réserves.
- Interactions avant, pendant et après aller/retour et sélection, répétitions
  rapides, resize et orientation. Le replay et le Seek utilisateur du parcours
  Elcé sont hors périmètre : ils ne constituent pas des critères de sortie.
- Vidéo libre en lecture puis en pause native : continuité du temps, de
  l’image animée et du son selon cet état, commandes natives utilisables,
  absence de redémarrage, de resynchronisation et de rechargement à l’aller
  comme au retour. Les captures internes de présentation doivent rester sans
  effet sur cette lecture. Les non-régressions de reconstruction du cœur, si
  une modification les affecte, restent dans le plan CodPlay propriétaire.
- Cycle Sighty A → B → A, synchronisation de preview, deux lecteurs isolés,
  destruction ; identité des nœuds/sources et état du document conservés.
- Persistance : compilation et codec des données auteur ; pas de mutation du
  document ni des métadonnées média pour une interaction de lecture. Décider
  séparément toute restauration du mode agrandi entre sessions.
- Tests ciblés et non-régressions des frontières concernées ; typecheck et
  build des packages affectés. Tests propriétaires de leurs fixtures.
- Navigateur réel sur lecteur Elcé, viewport large et étroit, tactile/swipe,
  focus et clavier ; Safari pour les parcours concernés. Inspecter au préalable
  configuration MCP locale et inventaire complet des outils exposés ; un
  serveur sans outils appelables laisse son acceptation en attente.

## Preuves de l’enquête et limites

La lecture des contrats a été complétée sur leurs lacunes par :
[`ImageComponent`](../../codplay/src/runtime/components/image/image-component.ts),
[`MediaComponent`](../../codplay/src/runtime/components/media/media-component.ts),
[catalogue core](../../codplay/src/runtime/catalog/create-core-runtime-catalog.ts),
[catalogue de capacités](../../codplay/src/runtime/catalog/runtime-capability-catalog.ts),
[conteneur motion](../../codplay/src/runtime/runner-html/motion-container.ts),
[présentateur overlay](../../codplay/src/runtime/runner-html/motion-presentation-host/overlay-presenter.ts),
[builder Carousel](../src/builders/carousel/carousel-scene-builder.ts),
[builder Carte](../src/builders/card/card-bdc-scene-builder.ts),
[builder Graphe](../src/builders/statistical-graph/statistical-graph-scene-builder.ts)
et [composition du lecteur](../src/player/elce-player-composition.ts).

Vérifications existantes rejouées le 14 octobre 2026 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run tests/facade/facade.spec.ts \
  -t 'registers and overrides components, services, and modules through one public catalog'
1 test réussi ; 24 tests non sélectionnés.

node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/components/image-input-polygon.spec.ts \
  tests/runtime/runner-html/motion-container.spec.ts \
  tests/runtime/runner-html/motion-presentation-host.spec.ts
3 fichiers, 29 tests réussis.
```

Ces 30 tests vérifient des mécanismes déjà présents. Ils ne prouvent pas la
fonctionnalité d’agrandissement, son intégration Elcé ou ses extensions vidéo
et Graphe. Aucun parcours navigateur de cette fonctionnalité n’a été réalisé.
Les spécifications vérifiées restent inchangées. Après chaque tranche acceptée,
transférer son comportement et ses preuves dans la spécification Elcé
propriétaire, avec le contrat CodPlay concerné si celui-ci a évolué. Conserver
les décisions non appliquées et acceptations manquantes dans ce plan.
