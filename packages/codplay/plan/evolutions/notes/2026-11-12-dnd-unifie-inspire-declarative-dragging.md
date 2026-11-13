# Exploration — DnD unifié, graphe de positions et composants d'interaction

> Statut : exploration préparatoire. Aucune API, migration ou évolution du core
> n'est décidée. Le périmètre envisagé doit être cadré dans un plan accepté
> avant toute implémentation.

L'exploration immédiate cherche à comprendre, à partir de plusieurs cas,
quelles responsabilités d'interaction méritent un modèle commun et si un
système composite est justifié. Rendre la capacité motion facultative dans le
package est un objectif V3, distinct du refactor DnD actuel.

## Préoccupation et direction

CodPlay possède un circuit identifiable mais incomplet pour les gestes :
capture, commit/replay et présentation FLIP. L'objectif envisagé est d'étendre
les interactions à partir de ce circuit, avec une seule architecture de DnD
pour les opérations existantes et futures. Il ne s'agit pas d'ajouter un moteur
en concurrence avec le DnD de liste.

Dragology sert de référence pour les comportements déclaratifs et composables :
choix de cibles, contraintes, suivi continu, interpolation entre états possibles
et enchaînement de comportements. Les exemples cités sont illustratifs, pas une
liste exhaustive. Les contrôles UI simples ne sont pas le centre de l'exploration.
La bibliothèque source est React/SVG ; CodPlay conserverait son modèle
HTML/SVG et s'inspirerait des principes pertinents plutôt que de présumer une
intégration directe.

Références : [Dragology](https://github.com/declarative-dragging/dragology),
[Declarative Dragging](https://declarative-dragging.github.io/),
[article](https://declarative-dragging.github.io/D2.pdf).

## Précédent CodPlay : le graphe de positions

La démo `flip-stress` fournit un précédent utile : le scénario déclare des
transferts imbriqués et temporisés par `move`; entre les frames, CodPlay calcule
les positions futures demandées par ces occurrences, les compose avec les
parents et les fournit au composant concerné. Un resize invalide les poses
capturées ; elles sont recapturées paresseusement lorsqu'elles sont requises.
Le même graphe participe à Play et Seek.

Ce précédent réduit le problème : l'exploration ne part pas de zéro pour
projeter des positions HTML/SVG, gérer leur composition ou leur invalidation.
La question restante est comment représenter et interroger, pendant une
interaction, un ensemble de mouvements candidats dépendant du pointeur. Le
graphe existant traite des occurrences `move` résolues dans un scénario ; il
reste à établir comment il peut porter les états hypothétiques et leurs
dispositions, notamment quand plusieurs enfants reflowent.

- [Démo `flip-stress`](../../../../demos/src/v2/demos/flip-stress/main.ts)
- [Spécification motion](../../../specs/motion-frame-v2-spec.md)
- [Plan de préparation motion](../../motion-live-discovery-invalidation-plan.md)
- [Plan d'acceptation du runner FLIP](../../runner-flip-integration-study.md)

## Couplage actuel avec `move`

Le couplage est distribué en couches, et le graphe de poses n'est pas à lui
seul un parseur de `move` :

- `buildMotionGraph()` reçoit des `MotionBoundary` et des `MotionIntent`
  normalisés. Le builder du graphe n'inspecte ni `SceneDoc`, ni action auteur,
  ni journal, ni DOM. Il construit les trajectoires à partir de snapshots et
  d'intentions déjà préparés.
- Le modèle de ces intentions reste lié au placement CodPlay. Il transporte
  `targetReflow`, `targetId`, `targetOrder`, les relations parent/enfant et des
  poses affines HTML. Le calcul sait donc distinguer une pose locale d'un
  changement d'ordre/reflow de cible.
- En amont, `createScheduledMotionIntent()` lit directement `action.move`,
  traduit ses transitions en `ScheduledMotionIntent` et marque un move comme
  pouvant provoquer un reflow. Le `MotionController` du runner HTML produit ces
  intentions à partir des occurrences `move` résolues et déclenche la capture
  géométrique correspondante.
- Il existe déjà un point d'extension : le scheduler peut fusionner une
  transition de pose fournie par un résolveur de materializer. Le runner HTML
  l'utilise pour certains tweens de style qui changent la géométrie, avec
  `targetReflow: false`. Le graphe peut donc traiter certaines poses provenant
  d'actions hors `move`, sans que l'ordonnanceur et la capture cessent d'être
  centrés sur les occurrences et les frontières de scène CodPlay.
- `MotionBoundary`, `LayoutSnapshot` et `HtmlMotionSystem` gardent une
  responsabilité de présentation HTML : capture d'ancres HTML, poses affines,
  snapshots FIRST/LAST, invalidation et commit par le host HTML.

Conclusion provisoire : **le moteur mathématique du graphe est déjà séparé du
champ auteur `move`, tandis que son alimentation, ses règles de reflow et son
cycle de capture restent fortement orientés par `move` et le placement HTML**.
Une extraction d'une classe métier indépendante paraît donc envisageable au
niveau des intentions, snapshots, trajectoires et résolution de poses ; elle
ne demanderait pas d'abandonner l'adaptateur `move`. Il reste à définir le
contrat de données minimal de cette classe et à vérifier si une interaction
peut lui fournir plusieurs dispositions candidates sans simuler une occurrence
temporelle déjà journalisée.

Références de code pour cette lecture :
[`motion-graph/graph-builder.ts`](../../../src/runtime/motion/motion-graph/graph-builder.ts),
[`motion-schedule.ts`](../../../src/runtime/motion/motion-schedule.ts),
[`motion-controller.ts`](../../../src/runtime/runner-html/player-runner/motion-controller.ts),
[`capture-intents.ts`](../../../src/runtime/runner-html/motion-capture/capture-intents.ts),
et [`motion/types.ts`](../../../src/runtime/motion/types.ts).

## Architecture candidate à étudier

La colonne vertébrale à préserver est :

```text
samples de capture
  → comportement d'interaction et poses candidates
  → preview HTML/SVG
  → décision métier au dépôt
  → événement et état CodPlay canoniques
  → replay / Seek et présentation motion
```

Une solution unifiée pourrait remplacer les responsabilités DnD spécialisées
du circuit actuel — politique de cible, comportements et preview — tout en
conservant le journal, la capture et le replay CodPlay. Les opérations de liste
deviendraient un comportement du système commun. FLIP resterait le présentateur
du changement structurel validé ; la propriété de la preview pendant le geste
et sa coordination avec FLIP doivent être décidées explicitement.

Le précédent de `flip-stress` invite à étudier une extension du graphe de
positions pour les candidats d'interaction, plutôt qu'un deuxième graphe de
présentation ou une compilation/lecture complète de chaque scène candidate.
Cette réutilisation reste une hypothèse jusqu'à ce que l'on vérifie la
représentation des candidats, leur résolution géométrique et leur invalidation.

### Si le circuit DnD actuel est refait

La cible reste un seul circuit DnD pour les opérations existantes et nouvelles.
Si le refactor remplace le circuit actuel, il n'y a pas à faire cohabiter un
module DnD historique et un second module inspiré de Dragology. Dans ce cas,
« adapter une partie » signifie retenir les comportements et principes utiles
dans le circuit refait ; cela ne signifie pas installer une deuxième
implémentation en parallèle. Le travail préparatoire doit identifier ce qui
sera conservé des contrats CodPlay — notamment capture, état canonique, move,
Seek et FLIP — et ce qui sera remplacé dans les politiques de cible et la
preview.

Ce choix supprime le conflit de modules comme contrainte de conception. Le
poids du package et l'optionnalité de la capacité relèvent d'un objectif V3
distinct.

Pour garder les deux objectifs distincts, il faut distinguer l'activation
runtime — ne pas créer le système motion pour une scène qui ne l'utilise pas —
de l'inclusion dans le bundle. Le premier est déjà partiellement vrai ; le
second ne découle pas du seul enregistrement d'une capacité. La séparation du
bundle n'est pas un critère d'acceptation du refactor DnD actuel ; elle sera
reprise en V3.

### V3 : optionnalité du chemin motion dans le package

Le catalogue CodPlay possède déjà un mécanisme de composition pertinent : les
modules peuvent être fournis à la construction de l'engine ou enregistrés sur
`codplay.modules` avant le premier build/load, puis leurs IDs requis sont
dérivés dans `CompiledScene.requirements.modules`. Le catalogue crée une
instance de module par player et signale une capacité absente. Une définition
de composant peut déclarer les modules dont elle dépend. Cette frontière peut
servir à rendre une future capacité d'interaction composable ; cette piste est
réservée à l'étude V3.

Le graphe de positions actuel ne passe toutefois pas par ce catalogue. Le
chemin `CodPlay` → `createInstanceHost` → `HtmlPlayerRunner` importe directement
`HtmlPlayerMotionController`, qui importe capture HTML, scheduling, graphe et
présentation. Le contrôleur n'instancie `HtmlMotionSystem` qu'après avoir
capturé des frontières motion ; c'est une activation paresseuse à l'exécution,
pas une exclusion de ces dépendances du bundle. En outre, les hooks actuels
`RuntimeModuleServiceInstance` participent au cycle player/composants, tandis
que le runner possède directement capture géométrique et présentation :
enregistrer un module seul ne le branche donc pas à ce parcours. Le runner
construit le contrôleur et l'appelle aussi lors de la présentation, du seek, du
reset, du resize, du changement de racine et de la destruction. L'ampleur de
cette couture justifie de traiter l'optionnalité séparément, en V3.

Une lecture statique des imports suffit à établir ce couplage, mais aucune
mesure de bundle produit n'a été faite. Les fichiers de graphe, capture,
présentation et contrôleur examinés représentent environ 5 500 lignes source ;
c'est un indicateur de surface de maintenance, pas une mesure de poids livré.

En V3, il faudra décider si un port léger de capture/présentation suffit à
placer le graphe métier et son adaptateur HTML dans une capacité ou entrée de
package séparée, ou si cela requiert une reprise plus large du runner et des
frontières player. Le catalogue actuel est un point d'assemblage possible,
mais son contrat de module n'expose pas encore ce port runner. Resteraient à
décider la déclaration de dépendance par une scène, un composant ou
l'application, le périmètre concerné (graphe seul ou aussi présentation FLIP),
le comportement des `move` sans cette capacité, et la mesure comparée des
bundles.

La note garde ce constat de couplage comme matériau pour V3, sans faire de la
séparation du package un critère de choix du modèle composite ni du refactor
DnD actuel.

## Hypothèse de composant pouvant remplacer `list`

Le `list` actuel est déjà distribué en responsabilités, malgré son type auteur
unique :

- [`ListComponent`](../../../src/runtime/components/list/list-component.ts)
  ne rend qu'une racine HTML et applique ses services visuels. Il ne crée ni ne
  réordonne ses enfants.
- [`ListCapabilityState`](../../../src/runtime/capabilities/list/list-capability.ts)
  applique la politique d'ordre aux deltas `move` dans la même
  `StructuralTimeline` que la reconstruction et le Seek.
- [`HtmlListDndPreview`](../../../src/runtime/runner-html/list-dnd-preview.ts)
  possède la preview HTML du geste. La fermeture de capture produit ensuite le
  placement logique via `move` et la capacité `list`.

Le remplacement visuel est donc assez direct : une surface d'activité en
HTML/SVG peut prendre la place de la racine `list`. Le vrai travail est de
transférer la politique d'ordre et la preview vers le circuit DnD commun. Le
parcours actuel de résolution géométrique de cible jusqu'au commit capture
n'est d'ailleurs pas encore certifié de bout en bout par la
[spécification DnD/list](../../../specs/list-dnd-v2-spec.md).

### Composition proposée à évaluer

Une liste fournit une emprise et une cible de collection communes. Cette cible
est sa racine ou, si le markup l'exige, un unique `data-part="items"` pour la
zone des items. Tous les items ordinaires rejoignent cette même cible par
`move` ; la liste n'expose pas un outlet par item et ne dépend pas des instances
ou du markup de ses enfants.

```text
surface de liste (layout HTML/SVG ou composant hôte spécialisé)
  ├─ racine ou data-part="items" (une cible et une emprise communes)
  ├─ politique d'ordre (deltas d'ajout, déplacement et retrait)
  ├─ comportement de glissement (relié à la surface par rel)
  └─ items (persos ordinaires, tous move vers la même cible)
```

La politique d'ordre doit connaître les identités structurelles des items pour
calculer la séquence, mais pas leurs instances, leur type visuel ou leurs nœuds.
Elle consomme les deltas de placement (`mount`, `move`, `unmount`, traduits en
ajout, déplacement et retrait de la collection) et laisse la
`StructuralTimeline` reconstruire l'ordre logique.

Le `layout` core sait déjà découvrir les `data-part` et les exposer au
placement ; il ne publie toutefois pas à lui seul une API d'interaction. Si les
composants actifs doivent appeler des opérations de la surface, le fournisseur
doit exposer un contrat typé via `targetProvider`, puis les consommateurs
peuvent s'y relier par `rel`. `rel` donne une identité et une capacité opaque,
pas un canal générique de communication. Le composant hôte peut être un
composant d'intégration spécialisé si le `layout` seul ne suffit pas.

Les comportements ne doivent pas chacun réimplémenter leur propre capture et
leur propre DnD. Un seul circuit commun reçoit les samples de Capture, résout
les candidats et la preview, puis remet au dépôt un résultat métier qui passe
par les événements et les actions `move` canoniques. Les composants spécialisés
fournissent des règles — zone, contraintes, sélection de cible, IK — au même
circuit. Ils ne changent pas directement le parentage DOM. Les outlets qu'ils
produisent peuvent eux-mêmes recevoir des persos ordinaires par `move`, sans
fabriquer implicitement des sous-persos.

### Frontière à résoudre avant de retirer `list`

La politique `list` vérifiée s'initialise depuis les persos de type `list` et
leurs options `initial.config`. Un `layout` core ne déclare que le module
`markup`, donc un simple remplacement de `type: 'list'` par `type: 'layout'`
ne conserve pas automatiquement `reorderOnMove`, `reorderOnAdd`,
`reorderOnRemove`, ni les règles explicites `first`/`last`. La composition devra
soit généraliser cette politique à la cible commune de la collection, soit
introduire une règle d'ordre explicite connectée à cette cible ; elle devra
dans les deux cas consommer les deltas d'ajout/déplacement/retrait et continuer
à alimenter la `StructuralTimeline` existante. La résolution de géométrie et
la preview peuvent examiner les items montés pour proposer un slot ; cette
lecture appartient au circuit DnD HTML, pas au composant ou à la politique de
liste.

L'implémentation de `ListCapabilityState` détecte aussi `perso.list` sur un
perso qui n'est pas de type `list`, mais les spécifications ne définissent pas
ce chemin. Il ne faut pas s'appuyer dessus avant d'avoir clarifié et validé ce
contrat.

Piste de remplacement : partir du réordonnancement actuel comme scénario de
référence ; refaire son emprise avec une racine ou un unique outlet `items`, et
faire `move` de chaque item vers cette cible commune ; brancher les
comportements à la surface par `rel` ; enfin remplacer la preview spécialisée
par l'unique DnD commun tout en conservant l'ordre structurel, Capture, journal
et Seek. On pourra ensuite décider si le composant auteur
`list` est supprimé, conservé comme raccourci de composition, ou gardé pour la
compatibilité. Cette décision dépendra aussi des exemples cible/contraintes et
IK ; aucun de ces scénarios ne justifie à lui seul un composant composite
générique.

Références : [parts et outlets de layout](../../../specs/layout-component-spec.md),
[`rel`](../../../specs/third-party-rel-spec.md),
[capacité `list`](../../../specs/list-capability-v2-spec.md),
[DnD/list](../../../specs/list-dnd-v2-spec.md),
[`move`](../../../specs/move-v2-spec.md),
[Capture](../../../specs/capture-v2-spec.md).

## Hypothèse de démonstrateur : bras articulé IK en SVG

Étudier une scène démonstratrice en HTML/SVG où un bras à segments et pivots
ordinaires suit une cible manipulable. Le geste déplacerait la cible ; un solveur
IK calculerait la pose des segments sous contraintes ; les composants visuels
CodPlay rendraient ces poses. Ce démonstrateur servirait à éprouver une
manipulation continue contrainte, la gestion d'une cible, la preview et le
commit/replay dans la même infrastructure DnD.

Le nom et les capacités exactes de la démo Dragology visée restent à identifier.
L'article de référence expose des glissements continus et contraints, mais ne
décrit pas explicitement un solveur d'inverse kinematics. Le démonstrateur IK
serait donc une application CodPlay à concevoir, inspirée des manipulations de
cibles, pas un portage revendiqué d'une fonctionnalité certifiée de Dragology.

Avant de retenir cet exemple, préciser : le modèle cinématique, les degrés de
liberté, les limites articulaires, la gestion des cibles inatteignables, la
reproductibilité du solveur, et ce qui est persisté au dépôt (cible, pose finale
ou trajectoire). Les samples de capture ne sont pas journalisés par défaut ; un
replay de la pose finale et un replay du chemin complet sont deux besoins
distincts.

Référence CodPlay : [spécification capture](../../../specs/capture-v2-spec.md).

## Travaux préparatoires

1. **Cartographier les responsabilités actuelles.** Séparer capture du pointeur,
   preview DnD, cible géométrique, commit, ordre `list`, `move` et FLIP. Identifier
   ce qui appartient au runner HTML, au composant et aux capacités métier.
2. **Distinguer l'algorithme du graphe de son adaptateur `move`.** Confirmer les
   responsabilités déjà isolées dans `MotionIntent`, `MotionBoundary`, le
   scheduler et le runner HTML ; proposer le contrat minimal d'une classe
   métier de trajectoires/poses réutilisable. Préserver l'adaptateur `move` pour
   son placement structurel et son reflow.
3. **Évaluer le graphe de positions pour les candidats.** Vérifier comment créer,
   demander et invalider des poses candidates dépendant du pointeur, y compris
   les mouvements imbriqués, reparent, reflow et resize. Déterminer si les
   dispositions candidates peuvent utiliser les snapshots et la composition
   existants, ou nécessitent une projection géométrique distincte.
4. **Évaluer le remplacement de `list`.** Comparer la surface d'activité et ses
   outlets au rôle actuel du composant et de la capacité `list`. Préserver les
   invariants de placement, d'ordre, de persistance et de Seek ou documenter ce
   qui devrait changer.
5. **Spécifier le démonstrateur IK.** Identifier la démo Dragology pertinente,
   fixer le scénario pédagogique et les contraintes du bras, puis décider si le
   solveur est un composant d'interaction, un service spécialisé ou une logique
   métier qui alimente des persos SVG ordinaires. Évaluer séparément si une
   classe de poses commune sert le solveur ou si l'IK reste un producteur de
   poses distinct.
6. **Comparer plusieurs cas avant de retenir un système composite.** Prendre le
   circuit DnD et le réordonnancement actuels comme référence, puis comparer la
   surface remplaçant éventuellement `list`, la manipulation de cible et de
   contraintes, et le bras IK. Distinguer les responsabilités communes des
   besoins propres à chaque cas ; ne retenir un système composite que si un
   même contrat les exprime sans abstraction forcée. Si le DnD actuel est
   refait, vérifier que le nouveau circuit remplace l'ancien pour toutes les
   opérations concernées au lieu de laisser deux modules DnD concurrents. La
   pertinence et la forme du système composite restent ouvertes jusque-là.
7. **Définir une proposition de DnD commun à partir des exemples.** Si les cas
   convergent, décrire les entrées continues, les comportements, les candidats
   discrets et continus, la preview, la résolution des cibles et la sortie
   métier au dépôt. Fixer un propriétaire unique de la capture et de la preview.
8. **Écrire les critères d'acceptation avant le code.** Exiger au minimum le
   parcours pointeur → preview → commit → Seek sur le réordonnancement existant,
   puis sur le bras IK ; couvrir resize, pose imbriquée, cible indisponible,
   teardown et absence de circuit DnD concurrent. Les critères d'exclusion du
   bundle de base relèvent de la validation V3 de l'optionnalité.

## Contrats et plans actuels

- [Capture V2](../../../specs/capture-v2-spec.md) décrit les samples live,
  l'état de capture et les sorties persistantes.
- [DnD/list](../../../specs/list-dnd-v2-spec.md) couvre la preview de liste et
  le commit ; le parcours géométrie → fermeture de capture → Seek navigateur
  reste dans le [plan S6](../../drag-capture-list-s6-validation-plan.md).
- [V2.5](../v2.5-plan.md) diffère la décision sur des modules DnD/FLIP séparés,
  leurs frontières avec le runner HTML et leur composition. Cette note
  approfondit cette piste sans en faire un contrat ni ouvrir à elle seule une
  migration.

Toute évolution du core reste soumise à un plan accepté et à l'autorisation
explicite requise par les règles du dépôt.
