# Portage de `Perso.emit` vers V2

**Statut : Fini**  
**Version cible : CodPlay V2**  
**Portage autorisé le 2026-08-28 ; implémentation et validations terminées le 2026-08-29.**

## 1. Motif et diagnostic

La démo `quiz-series` a révélé un manque du runtime V2 : les déclarations `perso.emit` sont compilées et conservées dans le `CompiledScene`, mais aucun pont générique ne transforme les événements natifs du DOM (`click`, `change`, etc.) en événements du `RuntimePlayer`.

Le clic Safari modifie donc le contrôle natif sans atteindre le journal, le dispatcher, les straps ou la reconstruction de scène. Ce diagnostic est cohérent avec l’architecture actuelle : `HtmlPlayerRunner` installe l’adaptateur de capture, mais pas d’adaptateur générique pour `Perso.emit`.

L’API publique `instance.events.emit(...)` existe déjà, mais elle constitue une injection externe ; elle ne remplace pas le branchement automatique des événements DOM déclarés par un perso.

## 2. Références vérifiées

- Plan général V2 : `packages/codplay/plan/codplay-v2-plan.md`.
- Façade V2 : `packages/codplay/plan/facade-engine-instance-plan.md`.
- Capture, à préserver : `packages/codplay/plan/capture-authoring-plan.md`.
- Contrat de représentation HTML : `packages/codplay/plan/component-render-representation-plan.md`.
- Implémentation V1 générique : `packages/codplay-v1/src/runtime/components/lib/dom-component-adapter.ts`.
- Implémentation V1 des composants avec références : `packages/codplay-v1/src/runtime/components/lib/dom.ts`.
- Acheminement V1 vers le player : `packages/codplay-v1/src/player/create-player.ts` et `packages/codplay-v1/src/renderer/create-renderer.ts`.
- Dispatcher V2 à réutiliser : `packages/codplay/src/runtime/player/pipeline/runtime-event-dispatcher.ts`.

Les plans V2 définissent le dispatcher, le journal, la matérialisation et la façade, mais ne définissent ni source DOM générique ni liaison de `Perso.emit` aux racines matérialisées. La ligne « dispatcher unique » ne suffit donc pas à couvrir cette capacité.

## 2.1. Inventaire des usages V1 hors capture

L’inventaire des scènes V1 montre que `Perso.emit` n’est pas spécifique au quiz :

| Scène ou famille | Déclarations utilisées | Point à préserver |
| --- | --- | --- |
| `avatar-poc` | `click` sur deux boutons | émission DOM de racine vers actions de story |
| `chrono` | `click` sur quatre boutons, dont deux avec données | données auteur et transitions de contrôle |
| `polygon` | `click` et `input` sur boutons et sliders | lecture du payload natif des inputs |
| `quiz-question`, `quiz-series`, `quiz-series-fame` | `change` sur réponses, `click` sur valider/suivant | `answerId`, payload input et enchaînement complet du quiz |
| `quiz-hunt` | `click` sur grille, bouton final et réponses ; `change` sur réponses | données (`trialId`, `answerId`) et portée V2 |
| `space-bubbles` | `click` sur commandes ; `keydown` avec deux `keyCode` et `preventDefault` | actions multiples, filtrage clavier et défaut navigateur |
| `stroke-path` | `pointerdown` avec données sur le bouton Effacer | événement ordinaire non lié à la capture |
| `s4-quiz-reference` | `click` sur réponses | émission DOM ; ses `listen.emit` sont des sorties du dispatcher, pas des sources DOM |

`s5-drag`, `s6-dnd-list`, le drag du token de `quiz-hunt`, le drag de
`space-bubbles` et le tracé de `stroke-path` comportent des déclarations avec
`capture`. Elles restent couvertes par l’adaptateur de capture existant et ne
font pas partie de ce portage. Quand une même scène contient des règles
ordinaires et des règles de capture, le bridge générique traite les
règles sans `capture` ; l’adaptateur de capture reste seul responsable de la
règle capturée, y compris son événement de démarrage, afin d’éviter un double
événement.

Les propriétés `emit` des télécommandes V1 dans les fichiers `run-*-demo.ts`
sont une injection externe de player, pas une déclaration `Perso.emit`. Elles
ne doivent pas être confondues avec ce portage et restent couvertes par la
façade d’événements V2.

## 2.3. Événements internes : le sujet n’a pas été écarté

Les références retrouvées montrent une continuité V1/V2, avec trois cas à ne
pas mélanger :

1. `Perso.emit` est une source d’événement attachée au perso. En V1,
   `createElementOptions.emitRuntimeEvent` branche automatiquement les
   déclarations sur la racine et les parts internes pendant `_init()` ; le
   contrat est décrit dans `docs/formalisation/v1-component-api.md` et exécuté
   par `packages/codplay-v1/src/runtime/components/lib/dom.ts` et
   `dom-component-adapter.ts`. L’événement entre ensuite dans le circuit du
   player. Il reste interne à l’instance tant qu’il n’a pas une portée publique.
2. `listen.emit[]` est une sortie déclarée par une règle `listen`. Le dispatcher
   V2 la réinjecte déjà dans le même journal et le même pipeline ; ce n’est pas
   le bridge DOM manquant.
3. Un composant ne doit pas produire spontanément un événement pendant
   `update()`. Les spécifications V1 du composant l’interdisent pour préserver
   la déterminisme de la projection ; cela ne remet pas en cause les sources
   `Perso.emit` attachées aux événements utilisateur ou aux parts internes.

La distinction de portée est fixée par
`packages/codplay/plan/notes/2026-08-01-event-visibility-sighty.md` :
`story`, `scene` et `public`. Les événements internes ne deviennent pas
publics par défaut. Le plan de façade V2 confirme également que les événements
internes du journal restent privés à l’instance et que les erreurs passent par
les diagnostics.

Conclusion : le concept d’événement interne est conservé ; la source native
`Perso.emit` est maintenant raccordée au runtime V2. Le portage complète le
manque d’implémentation sans créer une nouvelle catégorie d’event.

## 2.4. Compatibilité de `Perso.emit.ref`

Après vérification des documents V2 existants, aucune spécification ne définit
`ref` comme propriété d’une déclaration `Perso.emit`. Les occurrences V2 de
`resolveRef`, `getPart` ou de références de nœuds concernent la projection et les
parts internes du composant : elles ne définissent pas une cible d’écouteur
`emit`.

Le document formel V1 `docs/formalisation/v1-component-api.md` décrit seulement
le branchement de `emitRuntimeEvent` sur les nœuds et parts ; il ne définit pas
le mot `ref`. La propriété est réellement définie dans le type V1
`packages/codplay-v1/src/runtime/types.ts` (`EmitRuleAction.ref`), puis
consommée par `bindComponentEmitDeclarations` via `resolveRef(action.ref)`.
Un usage effectif est testé avec `ref: 'media'` dans
`packages/codplay-v1/tests/lot19/media-player-sync.spec.ts`.

La présence de `ref` dans le portage est une compatibilité explicitement
retenue avec le type, le runtime et le test V1. Elle cible les parts déjà
publiées par le materializer ; l’adaptateur ne recherche pas de nœud par
sélecteur et ne publie pas les parts privées comme des cibles de layout.

## 2.2. Écarts constatés entre l’interface V1 et V2

Les écarts constatés et leur traitement sont documentés ici ; aucune scène V1
ne doit être réécrite pour contourner le runtime.

1. Le socle V2 initial ne possédait pas le bridge DOM générique, alors que V1
   attachait automatiquement les listeners au montage des persos ; ce pont est
   maintenant porté dans `runner-html`.
2. En V1, `data` est une propriété de l’action `EmitRuleAction`, au même niveau
   que `event` et `capture`. Le V2 actuel le modélise indirectement via
   `AuthorCaptureEvent.data`. La démo V2 `quiz-series` place actuellement
   `answerId` sous `emit.change.event.data`, alors que les scènes V1 le placent
   sous `emit.change.data`. Le compilateur accepte et préserve la forme V1 ; le
   `data`
   des événements produits à la fin d’une capture reste une donnée du contrat
   de capture ; il ne remplace pas le `data` de l’action `Perso.emit`.
3. Le portage V2 transporte désormais `ref`, `keyCode` et `preventDefault` dans
   la règle compilée, alors que ces champs manquaient au socle initial ; ils
   restent employés notamment par `space-bubbles`.
4. V2 possède déjà un adaptateur de capture qui réémet l’événement de démarrage
   d’une règle capturée. Le bridge générique ne doit donc pas traiter une règle
   qui possède `capture`, sinon une même interaction produirait deux émissions.
5. Le plan général V2 impose une visibilité nommée et exclut `cascade` pour
   l’emit ordinaire. Le codec refuse cette clé sur cette forme. Le type
   historique de l’événement de capture et son adaptateur restent inchangés ;
   les scènes V1 qui utilisaient `cascade` sur un emit ordinaire devront être
   transposées vers la portée V2 sans toucher au circuit de capture.

## 3. Comportement V1 à préserver

Le portage doit conserver les comportements effectivement présents dans le circuit V1, sans recréer un circuit parallèle :

1. Chaque clé d’`emit` (`click`, `change`, `input`, etc.) correspond au type d’événement utilisateur écouté.
2. Une déclaration peut produire une ou plusieurs actions, dans l’ordre déclaré.
3. L’événement produit porte le nom et les données auteur, ainsi que `self` (`id`, `name` si disponible, `storyId`) et la portée V2 du perso.
4. Pour un `HTMLInputElement`, le payload runtime ajoute `value` et `valueAsNumber`, afin que `change` puisse alimenter le circuit de quiz.
5. `ref` conserve la sémantique V1 pour la racine (`undefined` ou `root`) et
   les parts internes publiées par le materializer.
6. `keyCode`, `preventDefault` et le filtrage des répétitions clavier conservent la sémantique V1.
7. Le branchement est installé au montage et supprimé à la destruction, sans doublons lors d’un seek, d’une reconstruction ou d’un reparent.
8. L’erreur d’émission doit être publiée par le canal de diagnostics V2 (`DiagnosticChannel` / `instance.diagnostic`), avec les références du perso et de l’événement concernés. La sortie console éventuelle relève uniquement de la configuration de ce canal.

La capture attachée à une déclaration reste une capacité distincte. Son adaptateur et son circuit ne sont pas modifiés par ce portage.

## 4. Architecture implémentée

### 4.1 Source HTML générique

`HtmlPlayerRunner` possède un adaptateur de source DOM dédié à `Perso.emit`,
séparé de `HtmlPointerCaptureSourceAdapter`. Il est attaché après
l’initialisation du player, puis détruit avec lui.

L’adaptateur :

- indexer les triggers `emit` compilés ;
- recevoir les événements natifs par délégation sur le host HTML du runner ;
- retrouver le perso matérialisé depuis `event.target` et `nodes.persoNodes`, y compris lorsqu’un contrôle privé (par exemple l’`input` de `InputComponent`) est la cible réelle ;
- construire l’entrée runtime à partir de la déclaration compilée, puis appeler exclusivement `RuntimePlayer.emit(...)` ;
- laisser `RuntimeEventDispatcher` effectuer l’ajout au journal, la résolution, les straps, la réinjection de leurs événements immédiats, les emits déclarés et la matérialisation ;
- ne créer ni journal, ni player, ni catalogue, ni écouteur dans une démo ;
- supprimer exactement ses écouteurs à la destruction.

Le choix de la délégation évite de rebinder les listeners à chaque mise à jour de scène. La résolution par les racines persistantes doit aussi empêcher qu’un nœud transitoire de FLIP devienne une seconde source d’événements.

### 4.1.1 Conformité avec la projection HTML/DOM V2

Cet adaptateur respecte la frontière V2 parce qu’il est un lecteur d’entrées du
runner, pas un materializer supplémentaire :

- le `HtmlComponentMaterializer` reste l’unique propriétaire de la création, du
  rendu, du parentage, de la mise à jour et de la destruction des nœuds ;
- l’adaptateur ne crée aucun nœud, ne modifie ni markup ni style, ne déplace pas
  de nœud et n’appelle ni `render()` ni `update()` ;
- il lit uniquement l’événement natif et les références stables publiées par le
  materializer pour identifier le perso source ;
- il ne déduit pas l’état logique en relisant le DOM : l’état reste produit par
  le dispatcher, le journal et le materializer après `RuntimePlayer.emit()` ;
- il installe et retire seulement des écouteurs navigateur, au même niveau
  runner HTML que l’adaptateur de capture déjà existant.

La cible d’un `ref` interne est la correspondance `partId -> nodeRef` déjà
produite par le materializer. Les parts sont conservées dans une table privée
du runner pour l’adaptateur ; elles ne sont pas ajoutées aux cibles publiques
de layout.

### 4.1.2 Patch Safari — stabilité du texte interactif

Le correctif V1 retrouvé dans `packages/authoring/remote/src/demo-remote-v1.ts`
sépare le libellé visible du bouton et évite les écritures DOM identiques
pendant une synchronisation live. Pour le portage V2, le même invariant est
appliqué au service HTML générique de contenu : une valeur texte inchangée ne
remplace pas le nœud texte direct déjà présent. Si le nœud contient autre chose
qu’un unique nœud texte, l’écriture reste effectuée afin de préserver la
sémantique de remplacement du contenu.

Ce patch conserve la propagation native bubble de l’emit ordinaire, comme en V1.
Il ne modifie pas le circuit `capture` ni le dispatcher d’events. Il évite la
perte de hit-testing Safari provoquée par la réinsertion inutile du texte du
contrôle pendant le traitement d’un clic. Le
test d’intégration de `quiz-series` vérifie aussi que `Suivant` conserve son
nœud texte et ne reçoit aucune mutation de ses enfants lors des synchronisations
inchangées.

Le blocage de `Suivant` observé dans Firefox avait deux causes indépendantes du
hit-testing : l’emit était bien reçu, puis l’action de scène échouait dans ACE
car le portage conservait `from: 0` face à `to: '-100%'` (et `to: 0` face à
`from: '100%'`), puis la position initiale V1 restait un `transform` brut ajouté
au canal `x` V2. La scène V2 emploie désormais des bornes `%` homogènes et
déclare la position initiale dans le canal `x`, conformément au contrat V2 des
unités et de composition, sans assouplir ACE ni ajouter de chemin de secours.
L’intégration vérifie l’absence de diagnostic runtime et le déplacement effectif
des panneaux lors du passage à la question suivante.

### 4.2 Données et compatibilité du contrat compilé

**Contrainte de portage : la forme auteur de `Perso.emit` reste celle de V1,
hors traitement de `capture`, déjà porté.** La conservation de `ref`,
`keyCode`, `preventDefault`, `event` et `data` au niveau V1 est retenue pour ce
portage.
Exception V2 explicitement décidée : `event.cascade` n’existe plus ; il est
remplacé par la portée nommée `event.visibility` (`story`, `scene` ou `public`).
Les scènes V1 qui utilisaient ce champ devront être transposées vers cette
portée à la frontière de compilation. Aucune occurrence de `cascade` ne doit
rester dans le contrat V2 de `Perso.emit`, et le circuit de capture n’est pas
modifié par ce chantier.

Écart résolu : le contrat auteur et le contrat compilé portent désormais
l’action-level `data`, `ref`, `keyCode` et `preventDefault`. La compilation les
préserve sans changer la forme auteur V1 ; le codec valide séparément l’emit
ordinaire et l’event de capture.

Le contrat V2 de portée ne contient aucun `cascade`. La conversion depuis ce
champ rencontré dans une scène V1 doit être faite à la frontière de portage vers
`visibility`, puis testée. Le contrat de capture déjà porté est hors modification
de ce plan ; toute présence résiduelle de l’ancien champ dans sa représentation
constitue un écart séparé à documenter, pas à corriger ici.

### 4.3 Origine utilisateur et état du player

V1 distingue les émissions utilisateur des injections système/module, notamment lorsque le player est en pause ou en seek. La règle retenue pour le
portage est la suivante : les événements DOM utilisateur sont inactifs en pause
et pendant un seek. Cette règle ne modifie pas la politique de
`instance.events.emit(...)` ; elle s’applique à la source DOM utilisateur.

V2 ne possède pas de champ structurel distinct `source` dans
`RuntimeEventInput`/`RuntimeTrackEvent`. Le bridge conserve donc cette
provenance dans le `context` V2 (`source: 'dom'`, `persoId`, `userEvent`) sans
ajouter de propriété auteur à `Perso.emit`.

La forme V2 de l’événement porte la portée nommée (`visibility`) et ne contient
aucun `cascade`. `storyId` reste l’identifiant de la story
productrice lorsque la portée est `story`; il ne constitue pas une portée à
lui seul. `mode` reste indépendant de la portée.

### 4.4 Lecture automatique externe de `quiz-series`

Le pattern demandé pour la démo ne précharge pas une piste automatique dans la
scène et ne simule pas des clics DOM. La scène déclare deux pistes officielles :
une piste `interactive` active par défaut pour les sources `Perso.emit`, et une
piste `automatic` inactive par défaut. L’hôte fournit ensuite une séquence
d’eventimes adressés à cette piste et la rend disponible dans la telco commune.

La commande externe suit le circuit public `instance.events.emit` : elle
désactive la piste interactive, active la piste automatique, injecte les
eventimes adressés à leurs stories, puis lance `instance.telco.play()`. Les
commandes de contrôle de piste sans `startAt` passent par le dispatcher live
existant afin d’appliquer immédiatement l’activité des pistes et de conserver
leur événement dans le journal. Les eventimes datés restent des faits de
timeline : ils sont seulement ajoutés au track et sont lus à leur échéance.

La matérialisation sépare ces deux responsabilités : les eventimes déclarés
dans une story restent gouvernés par l’activité de son track par défaut, tandis
qu’un eventime live est sélectionné selon l’activité de son propre track. Une
piste externe active peut donc remplacer la piste interactive sans rendre ses
eventimes invisibles. Cette règle s’applique au runtime général et n’est pas un
contournement propre à la démo.

## 5. Fichiers et étapes d’implémentation

### Étape A — Contrat retenu

- enregistrer l’interface V1 complète comme cible de compatibilité pour les
  options clavier, `preventDefault` et `data` au niveau de l’action ; `cascade`
  est explicitement remplacé par `visibility` dans le contrat V2 ;
- retenir `ref` comme compatibilité V1 et fixer sa résolution sur les parts
  publiées par le materializer ;
- maintenir ce plan comme suivi de l’implémentation et de ses invariants ;
- ne modifier aucun README utilisateur pour documenter le debug.

### Étape B — Compilation et codec — réalisée

- étendre les types auteur et compilés avec les champs V1 manquants, en
  conservant `data` au niveau de l’action auteur ;
- préserver ces champs dans `compileEmitDeclaration` et le codec ;
- couvrir la compilation des champs V1 et la distinction codec entre emit
  ordinaire et capture.

### Étape C — Runtime HTML — réalisée

- créer l’adaptateur générique `Perso.emit` dans le domaine `runner-html` ;
- brancher son cycle de vie dans `HtmlPlayerRunner` ;
- réutiliser `RuntimePlayer.emit` et le dispatcher existant ;
- connecter les erreurs du bridge au canal de diagnostics V2, avec un code et des références stables (`instanceId`, `storyId`, `persoId`, `eventId` si disponible) ;
- ne pas modifier `runtime/capture` ni son adaptateur.

### Étape D — Régressions et intégration — réalisée

- tester une émission `click` sur une racine HTML ;
- tester une émission `change` dont la déclaration conserve `data.answerId` au
  niveau V1 et dont la cible est le contrôle interne d’un input, avec `answerId`,
  `value` et `valueAsNumber` ;
- vérifier qu’un clic sur le label d’un `InputComponent` et sur le contenu textuel
  d’un bouton atteint la racine du perso et produit le même emit ;
- tester plusieurs actions et leur ordre ;
- tester `self`, `visibility`, l’inactivité en pause/seek, `preventDefault`, les options clavier et les `ref` ;
- tester seek, reparent, reconstruction et destruction sans écouteurs dupliqués ;
- vérifier que les tests capture existants restent inchangés et passent ;
- vérifier qu’un événement immédiat produit par un strap est réinjecté dans le
  pipeline `listen` sans être appendé deux fois ;
- rejouer la vraie URL `v2.html?demo=quiz-series` dans Safari : sélection d’une réponse, activation de Valider, validation, puis passage à la question suivante, avec événements visibles dans le journal et telco toujours fourni par le layout.

### Étape E — Lecture automatique externe — réalisée

- [x] déclarer les pistes interactive/automatic dans la scène quiz sans faire
  connaître le layout à la scène ;
- [x] exposer la séquence d’eventimes adressés comme capacité du module de démo ;
- [x] afficher le contrôle externe dans la telco commune et exécuter la
  séquence via `instance.events.emit` puis `instance.telco.play()` ;
- [x] appliquer les commandes immédiates `track:activate` et
  `track:deactivate` via le dispatcher public sans créer de circuit parallèle ;
- [x] permettre à la matérialisation de lire un eventime live depuis son track
  actif même si le track par défaut de la story est inactif ;
- [x] tester le parcours automatique via la façade V2, y compris progression,
  résultat et changement effectif de piste ;
- [x] vérifier le bouton Auto du layout sur l’URL réelle Safari ; le parcours
  atteint `3 / 3`, `100 %` et `Réussi !`, sans erreur ni avertissement console.

## 6. Critère de sortie

Le portage ne sera pas déclaré fini tant que le chemin réel `DOM -> source HTML -> RuntimePlayer.emit -> dispatcher -> journal/straps -> materializer -> DOM` n’est pas couvert par des tests d’intégration et par la vérification Safari de la démo. La démo ne recevra aucun listener ou contournement local.

## 7. Suivi d’implémentation

- [x] conserver la forme V1 de l’action (`ref`, `keyCode`, `preventDefault`,
  `event`, `data`) pour l’emit ordinaire ;
- [x] remplacer `cascade` par `visibility` sur cette forme, sans modifier le
  contrat ni le comportement de capture ;
- [x] compiler et décoder les champs sans perte, avec refus des formes
  ordinaires qui contiennent `cascade` ;
- [x] brancher l’adaptateur DOM délégué au cycle de vie du runner ;
- [x] résoudre la racine et les parts materialisées, y compris le contrôle
  interne de `InputComponent` ;
- [x] réutiliser `RuntimePlayer.emit()` et le dispatcher unique ;
- [x] réinjecter les événements immédiats produits par un strap dans le même
  circuit `listen`, avec un append unique et respect de la portée ;
- [x] inactiver les événements DOM hors état `playing` ;
- [x] publier les erreurs par le canal de diagnostics V2 ;
- [x] tests runner ciblés et test d’intégration réel de `quiz-series` ;
- [x] vérifier les clics sur le label d’une réponse et sur le contenu textuel de
  `Valider` ;
- [x] appliquer le patch Safari V1 aux écritures de contenu inchangées et
  vérifier la stabilité du nœud texte de `Suivant` pendant l’intégration quiz ;
- [x] adapter les bornes de translation du portage V1 aux unités `%` V2 et
  supprimer le double emploi du `transform` initial, et vérifier que l’emit
  `Suivant` ne produit plus d’échec ACE ;
- [x] suite CodPlay V2 : `74` fichiers, `489` tests passants au 2026-08-29 ;
- [x] validation navigateur Safari de la séquence sélection → Valider →
  question suivante sur `v2.html?demo=quiz-series`, avec le panneau suivant
  effectivement présenté et sans diagnostic applicatif ;
- [x] validation navigateur Safari du bouton `Auto`, de l’activation du track
  automatique, de la progression complète et de l’affichage du résultat.
