# Sighty — reconstruction de la navigation, de la machine d’état et des données

## Statut

**En cours — cohérence relue et réécriture engagée le 2026-09-15.**

La priorité de validation a été l’API auteur de déclaration : sa forme, ses
identifiants, ses routes, ses actions, ses conditions de parcours, ses données
et ses politiques, ainsi que sa transformation éventuelle vers une vue
compilée/exportable, sont maintenant arrêtés avant les modèles d’exécution
internes.

Ce plan est rédigé le 2026-09-15 à partir de :

- la note [modèle de fichier déclaratif](../notes/2026-08-17-modele-fichier-declaratif.md) ;
- la structure et les comportements observés dans Demo 4 ;
- la spécification exécutable actuelle
  [Sighty — scénario, graphe de vues et runtime](../specs/authoring-library-spec.md) ;
- les règles de navigation héritées fournies avec la demande du 2026-09-15.

Il remplace les anciens plans de première implémentation, de navigation et de
fiabilisation, retirés de la surface active des plans. Le plan
[d’évaluation de la progression](./2026-09-13-sighty-progress-evaluation-plan.md)
porte désormais l’implémentation dédiée de la projection vivante ; cette
reconstruction ne réintroduit pas de transport `progress:update`.

### État d’implémentation de la verticale actuelle

La verticale déjà exécutée comprend l’index récursif, les routes, les
conditions `accessBy` et `exitBy` héritées par portée avec leur repli
`onDenied`, les données `entry`/`live`, la mise à jour du contexte, le reset,
les sources différées (lazy) résolues et mises en cache, et les mutations
versionnées. Les quatre
politiques de mutation (`preserve`, `rewind`, `reset`, `reload`) empruntent le
même coordinateur et leurs échecs restaurent la version auteur, les occurrences,
les montages et les ressources détenues.

Cette liste décrit le comportement actuellement vérifiable ; elle ne ferme pas
encore la matrice complète de validation navigateur/Safari ni la vérification
complète du cycle de vie. La disponibilité de l’instance Safari MCP n’est pas
un blocage : un smoke test frais de Demo 4 a été exécuté le 2026-09-16. Les occurrences multiples, le couplage télécommande et la
distinction `scene:end`/`sequence:end` sont maintenant arrêtés dans la
spécification et couverts par l’implémentation et les tests ciblés. La
persistance sérialisée n’appartient pas à cette reprise : elle relève d’une
intégration hôte ultérieure.

La validation automatisée de cette reprise est verte : 31 tests Sighty, 650
tests CodPlay, les trois typechecks concernés et le build Vite des démos. Le
parcours Safari MCP frais a validé Demo 4 sur menu → scène A, pause/reprise,
progression vivante, le verrou d’une navigation rapide et la terminalisation
de la scène C. Le routage automatique de l’eventime auteur `sequence:end` reste
ouvert à la frontière CodPlay, car il n’est pas publié par le player actuel ;
les autres gates de reconstruction restent suivies dans les tranches
correspondantes.

La première implantation de Sighty est une preuve d’usage et une source de
constats. Demo 4 reste une fixture d’acceptation ; elle ne définit pas le
modèle générique.

Le runtime est désormais découpé dans `packages/sighty/src/runtime/`. Le
fichier `src/runtime.ts` conserve uniquement la compatibilité de l’entrée
publique ; `controller.ts` orchestre les services `state`, `scene-manager`,
`binding-manager`, `presentation-manager`, `composition-manager`,
`navigation-manager` et `mutation-manager`. Les helpers de validation et les
fonctions transverses sont isolés dans leurs modules dédiés ; la validation des
catalogues runtime est nommée `catalog-validation.ts` pour la distinguer de la
validation du fichier auteur. Dans `src/navigation/`, les opérations pures d’indexation, de
résolution et de transition restent séparées de l’orchestration runtime. Les
wrappers one-shot sans valeur sémantique sont désormais intégrés directement,
et les utilitaires de
`view-graph.ts` sans consommateur ont été supprimés. Ce découpage est interne :
il ne modifie aucune signature de l’API auteur ou de l’API d’intégration.

Le nettoyage déjà réalisé a supprimé les façades réexportées sans
consommateur, les alias de types inutilisés et le transport d’occurrence
abandonné. Demo 4 est la seule fixture actuellement prioritaire pour la
validation du runtime ; elle conserve le seek discret et projette désormais la
progression vivante par la surface CodPlay dédiée, sans réintroduire de
transport `progress:update`. Les démos 1 à 3 restent des références
secondaires : leur réécriture et leur validation navigateur sont différées et
ne constituent pas une preuve ou une gate de cette reconstruction.

## 1. Objet et résultat attendu

Reconstruire depuis zéro le noyau de navigation Sighty afin qu’il conduise un
parcours déclaratif récursif composé de scènes, de vues et de slots, en
respectant les garanties suivantes :

1. la structure du parcours est décrite une seule fois dans le fichier
   déclaratif ;
2. la résolution d’une route est pure, déterministe et indépendante de
   CodPlay, du DOM et des effets de présentation ;
3. une seule composition active est publiée à chaque instant ;
4. les changements de composition sont représentés par des opérations
   versionnées et atomiques ;
5. les événements provenant d’une vue sortie ne peuvent plus piloter le
   scénario ;
6. les politiques Maintain, Rewind et Reset sont distinctes et appliquées
   uniquement lors d’un changement de vue ;
7. les données du parcours, l’état d’exécution et les ressources ont des
   responsabilités séparées ;
8. les événements discrets restent le moyen d’orchestration ;
9. aucune progression continue ne passe par le journal normal d’événements ;
10. Demo 4 exerce le vrai chemin Sighty/CodPlay sans routeur local ni circuit
    concurrent.
11. l’API d’intégration couvre les deux directions entre Sighty et
    l’application hôte : injection vers Sighty et publication d’événements
    publics vers l’application hôte.

Le résultat attendu n’est pas un correctif local de Demo 4. C’est une
séparation stable entre modèle auteur, résolution, machine d’état, cycle de
vie et raccordement CodPlay.

## 2. Autorité, limites et règles de travail

### 2.1. Documents faisant autorité

La note du 2026-08-17 fournit le modèle de conception. La spécification Sighty
décrit la première surface exécutable existante, mais ses limites ne doivent
pas être prises pour le modèle final.

Toute évolution de la structure auteur, de la façade publique ou de la
sémantique de navigation doit produire, dans le même changement :

- une décision explicitement validée ;
- la mise à jour de la spécification concernée ;
- les tests de contrat ;
- la mise à jour du suivi de ce plan.

Une proposition inscrite dans ce plan ne devient une décision exécutable
qu’après validation de la tranche M0.

### 2.2. Frontière Sighty/CodPlay

Sighty possède :

- le fichier de scénario ;
- l’index de parcours ;
- la résolution des actions, routes et conditions de parcours ;
- la composition logique active ;
- les liaisons actives entre vues, slots et occurrences ;
- l’ordonnancement des opérations ;
- le contexte et l’état de reprise ;
- la politique de mutation du scénario ;
- l’adaptation, l’admission et la publication des événements publics vers
  l’application hôte.

CodPlay possède :

- la compilation des scènes ;
- la materialization ;
- les instances et leurs telcos ;
- les événements publics des scènes ;
- les montages vers les surfaces CodPlay ;
- les ressources, leurs handles et leur libération ;
- le rendu et les effets visuels.

Sighty ne crée pas de markup, ne sélectionne pas d’élément HTML et ne
reconstruit pas les services internes de CodPlay.

Une évolution de packages/codplay est interdite dans ce plan sans
autorisation explicite et sans plan CodPlay séparé lorsque la garantie
manquante concerne son cœur.

### 2.3. KISS et DRY

Le noyau doit conserver :

- un seul index de l’arbre ;
- un seul résolveur de routes ;
- un seul point d’admission des événements et commandes ;
- un seul coordinateur des transitions ;
- un seul registre des liaisons actives ;
- un seul chemin d’exécution vers CodPlay ;
- un seul point de publication des événements publics vers l’application hôte.

Les démos ne doivent pas posséder de table de routes, de registre de scènes,
de compteur de révision de navigation ou de nettoyage parallèle.

Une abstraction n’est ajoutée que si elle est utilisée par au moins deux
parcours ou si elle porte une garantie impossible à exprimer autrement.

### 2.4. Séparation obligatoire des surfaces publiques et internes

Le plan emploie désormais trois niveaux explicitement distincts. Toute forme
de donnée proposée doit être rattachée à l’un d’eux avant son implémentation.

| Niveau | Destinataire | Contenu autorisé | Statut |
| --- | --- | --- | --- |
| **API auteur publique** | auteur du fichier, éditeur, outil de génération | structure de déclaration du scénario, mécanismes auteur exposés, références stables, routes, actions, conditions de parcours, data et politiques déclaratives | priorité M0 |
| **API d’intégration publique** | application qui instancie et pilote Sighty | construction de `Sighty`, catalogues, sources, `dispatch`, commandes, abonnement aux événements publics et observations | à stabiliser séparément de l’API auteur |
| **Types internes** | modules Sighty uniquement | index, adresses dérivées, composition active, bindings, générations, révisions, opérations et registres | non exportés comme contrats utilisateur |

La frontière CodPlay est une frontière d’intégration existante : Sighty y
utilise les surfaces publiques de CodPlay, mais les instances, players,
montages et handles ne deviennent pas des types de l’API auteur.

Les blocs de types de ce plan sont identifiés par un marqueur :

- **[API AUTEUR]** : contrat public du fichier de déclaration ;
- **[API INTÉGRATION]** : contrat public du code qui utilise Sighty, mais qui
  n’est pas écrit dans le fichier auteur ;
- **[INTERNE]** : représentation dérivée ou opérationnelle, non exportée comme
  contrat utilisateur.

Règles impératives de la frontière :

1. aucun type interne ne peut être requis pour écrire, charger ou valider un
   fichier auteur ;
2. les types `ViewAddress`, `SlotAddress`, `OccurrenceId`, `BindingId`,
   `Generation` et `Revision` sont dérivés ou gérés par Sighty et ne sont pas
   des champs de l’API auteur ;
3. si une même information existe aux deux niveaux, un normaliseur explicite
   traduit l’API auteur vers le modèle interne ;
4. l’API auteur ne retourne pas d’instance CodPlay, de player, d’abonnement,
   de montage ou de handle de ressource ; l’API d’intégration peut exposer les
   capacités publiques CodPlay nécessaires aux contrôles de scènes existants,
   sans faire de ces capacités des types de l’API auteur ;
5. toute signature publique qui ferait apparaître un type interne est un échec
   de conception à traiter en M0, pas une commodité d’implémentation.

L’API auteur est prioritaire sur les autres surfaces : M0 doit la décrire et
la faire valider indépendamment du choix des types internes. Les noms internes
pourront changer sans migration du fichier auteur tant que cette frontière est
respectée.

### 2.5. Fichier de déclaration et vue compilée/exportable

Le fichier de déclaration est la source écrite par l’auteur. Il n’est pas réduit
par principe à un objet JSON : il peut contenir les fonctions et les mécanismes
que l’API auteur expose effectivement.

La vue compilée/exportable est une autre représentation. C’est à cette frontière
que les fonctions peuvent être extraites ou remplacées par des références et
que la structure exportable doit respecter le contrat de sérialisation. Cette
restriction ne doit pas être reportée artificiellement sur le fichier de
déclaration.

CodPlay fournit déjà ce découpage : `SceneDoc` accepte des fonctions et des
transformations d’écoute dans sa surface d’auteur ; la compilation extrait les
fonctions du payload `CompiledScene`, dont le codec exporte une forme JSON
portable. Sighty doit conserver la même distinction pour les mécanismes qu’il
expose et raccorder les scènes aux surfaces CodPlay existantes, sans les
reproduire ni les interdire par une règle de sérialisation.

## 3. Décisions structurantes de la verticale actuelle

Les décisions suivantes constituent le cadre retenu pour l’implémentation
actuelle. Toute extension qui modifierait ces frontières doit être documentée,
testée et validée avant de rejoindre le runtime.

### 3.1. Arbre auteur, graphe de parcours

Le fichier contient une structure arborescente récursive :

~~~text
Views
├── view
├── view.views
└── view.slots.<slot>
~~~

Les routes peuvent relier deux nœuds éloignés. Le fichier est donc un arbre
structurel parcouru comme un graphe logique, mais il ne contient pas de
second catalogue de routes.

### 3.2. Identités auteur et identités internes distinctes

Les identités suivantes ne doivent jamais être confondues. Certaines sont
écrites par l’auteur ; les autres sont produites par Sighty ou CodPlay.

| Identité | Surface | Rôle |
| --- | --- | --- |
| `ViewId` | **API auteur** | identifie un nœud auteur dans une map ou une liste |
| `SlotName` | **API auteur** | nom déclaré d’un slot dans une vue |
| `SceneKey` | **API auteur / intégration** | clé stable d’une source de scène fournie à Sighty |
| `ViewAddress` | **interne** | adresse complète dérivée d’un nœud dans l’arbre |
| `SlotAddress` | **interne** | adresse complète dérivée d’un slot, incluant son propriétaire |
| `OccurrenceId` | **interne CodPlay** | identité d’une instance physique CodPlay |
| `BindingId` | **interne** | identité d’un couplage logique actif |
| `Generation` | **interne** | génération d’un binding, invalidée à sa sortie |
| `Revision` | **interne** | version de la composition publiée |

Un nom de slot ou une `SceneKey` seuls ne suffisent pas à identifier une source
active au runtime. L’auteur déclare des noms et des références stables ; Sighty
leur associe des adresses, bindings et générations internes. Les diagnostics
publics peuvent afficher une adresse textuelle stable, mais ne doivent pas
exposer le type d’adresse interne.

### 3.3. Le parcours n’est pas l’historique des événements

Les événements expriment des faits ou des intentions. Ils ne portent pas une
destination cachée calculée par l’émetteur.

Le scénario résout la destination à partir :

- de la source active ;
- de l’événement ;
- des portées héritées ;
- de l’ordre de la liste ;
- des conditions de parcours ;
- de l’état, du contexte et des conditions de parcours.

Les commandes explicites, notamment Goto fourni par un scheduler, sont une
entrée distincte mais empruntent le même coordinateur de transition.

### 3.4. Aucun événement continu dans le journal normal

La progression, la position et les autres valeurs vivantes ne sont pas
converties en émissions périodiques. Elles sont traitées par une capacité
d’observation et de projection qui fera l’objet d’un plan séparé.

Les événements répétés doivent rester des faits discrets et rares. Aucun timer
de progression ne doit être créé par le routeur Sighty.

## 4. API auteur publique cible

Cette section décrit uniquement le contrat du fichier de déclaration que
l’auteur peut écrire. Les types ci-dessous ne représentent ni l’index, ni la
composition active, ni les instances CodPlay. Une vue compilée/exportable peut
en être produite séparément ; elle aura son propre contrat de sérialisation.
Les deux formes constituent la priorité de M0 et doivent être distinguées
avant la construction du runtime.

### 4.1. Inventaire de la surface auteur

**[API AUTEUR] — surface exécutable de la verticale actuelle.**

| Élément | Responsabilité publique | Résultat interne dérivé |
| --- | --- | --- |
| `SightyFile` | racine de déclaration : version, ressources, données et `views` | version de scénario validée ou compilée |
| `Views`, `ViewList`, `ViewMap` | structure récursive et ordre local | graphes et index immuables |
| `ViewDefinition` | scène, vues enfants, slots, data et règles locales | descripteur de vue et portées |
| `ViewAction`, `RouteTarget` | références d’action et routes déclarées | action et destination résolues |
| conditions de parcours | conditions d’entrée d’une page ou de fin d’une vue | conditions évaluées au moment prévu par le scénario |
| `DataBinding` | origine et mode de fourniture d’une donnée | valeur résolue pour une occurrence |
| `showMode` | politique déclarative d’affichage d’une scène | effet de cycle de vie appliqué en interne |

La colonne de droite n’est pas une seconde forme du fichier. Elle indique
seulement le résultat de la normalisation et de la résolution ; ses types sont
internes et peuvent évoluer sans modifier le contrat auteur.

### 4.2. Structure récursive

**[API AUTEUR] — structure actuelle de la déclaration.**

La structure de déclaration cible reste une structure `Views` récursive :

~~~ts
type Views<SceneKey, SlotName> = ViewList<SceneKey, SlotName>
  | ViewMap<SceneKey, SlotName>

type ViewList<SceneKey, SlotName> = readonly ViewListEntry<SceneKey, SlotName>[]

type ViewListEntry<SceneKey, SlotName> = ViewDefinition<SceneKey, SlotName> & {
  id: string
}

type ViewMap<SceneKey, SlotName> = {
  start: string
  views: Record<string, ViewDefinition<SceneKey, SlotName>>
  actions?: Record<string, ViewAction>
  showMode?: 'reset' | 'maintain' | 'rewind'
}

type ViewDefinition<SceneKey, SlotName> = {
  view: {
    scene?: SceneKey
    views?: Views<SceneKey, SlotName>
    slots?: Partial<Record<SlotName, Views<SceneKey, SlotName>>>
  }
  actions?: Record<string, ViewAction>
  accessBy?: Condition<SceneKey>
  exitBy?: Condition<SceneKey>
  onDenied?: RouteTarget
  data?: Record<string, unknown | DataBinding>
  showMode?: 'reset' | 'maintain' | 'rewind'
}

type Condition<SceneKey> = string | ((context: ConditionContext<SceneKey>) => boolean | Promise<boolean>)
~~~

La propriété auteur graph n’est pas retenue dans la forme cible. Une lecture
historique peut rester isolée à la frontière de normalisation tant qu’elle ne
crée pas un second exécuteur.

Les listes utilisent leur ordre uniquement pour les directions locales
next/previous. Chaque entrée possède un identifiant stable. Une route ne
dépend jamais d’un index numérique.

### 4.3. Conditions de parcours : deux usages principaux

**[API AUTEUR — VERTICALE ACTUELLE]** — les champs exécutés sont `accessBy`,
`exitBy` et `onDenied`. Une condition peut être une fonction d’auteur ou une
référence de catalogue d’intégration.

1. **Condition d’accès à une page ou à une section.** La condition la plus
   spécifique parmi la vue, les graphes contenants et les vues parentes est
   évaluée avant l’entrée. En cas de refus, `onDenied` est résolu ; à défaut,
   la route `next` est essayée. Une cible absente ou une boucle de repli refuse
   l’opération sans publier de composition partielle.
2. **Condition de sortie d’une vue active.** La condition `exitBy` la plus
   spécifique est évaluée avant le détachement. Un résultat faux bloque la
   transition.

La condition lit l’événement reçu, la `SceneKey`, les `data` résolues, le
contexte et l’état de l’occurrence. Elle ne modifie pas ces valeurs et ne
fabrique pas de destination. La fin d’une scène ne déclenche pas
automatiquement une navigation dans cette verticale.

Lorsqu’une vue contient plusieurs scènes, son `exitBy` est le garde de sortie
de la vue : un refus sur une sélection sortante bloque la transition entière.
La distinction des signaux est arrêtée : `scene:end` indique à Sighty que la
scène a terminé sans la détacher, tandis que `sequence:end` conserve le
comportement CodPlay existant : la séquence du player est terminée, la lecture
est arrêtée, les captures actives sont annulées, le hook de fin est appelé et
l’état de transport est publié. Ce signal ne détruit ni l’instance, ni le
montage, ni les ressources. Si une transition de vue est engagée ensuite,
Sighty modifie la composition logique ; la présentation physique conserve le
montage tant qu’aucun host ne doit accueillir une autre relation. Le
détachement ou la destruction interviennent lors d’un conflit de host, d’une
reconstruction ou de la destruction du runtime.
Toute transformation d’un fait CodPlay en intention de navigation réutilise le
point d’admission normal de Sighty et ne crée pas un second circuit.

### 4.4. Exemple minimal issu de Demo 4

**[API AUTEUR] — extrait minimal.** Il reprend le layout et le slot de contenu
de Demo 4, avec une `ViewList` A/B :

~~~ts
import type { SightyFile } from '@codplay/sighty'

type DemoSceneKey = 'scene-layout' | 'scene-a' | 'scene-b'
type DemoSlotName = 'slot-scene'

const file: SightyFile<DemoSceneKey, DemoSlotName> = {
  views: {
    start: 'view-main',
    views: {
      'view-main': {
        view: {
          scene: 'scene-layout',
          views: {
            start: 'view-chapter',
            views: {
              'view-chapter': {
                view: {
                  slots: {
                    'slot-scene': [
                      {
                        id: 'view-page-a',
                        actions: {
                          'sighty-demo4:navigation:next': {
                            go: { direction: 'next' },
                          },
                        },
                        view: { scene: 'scene-a' },
                      },
                      {
                        id: 'view-page-b',
                        actions: {
                          'sighty-demo4:navigation:previous': {
                            go: { direction: 'previous' },
                          },
                        },
                        view: { scene: 'scene-b' },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}
~~~

Cet extrait montre uniquement l’API auteur : `scene-a` et `scene-b` sont des
`SceneKey` déclarées dans le fichier, tandis que leurs `SceneDoc` sont fournis
à part par le catalogue `sceneDocuments` de Demo 4. Il ne contient ni instance,
ni binding, ni révision, ni opération de navigation. La version complète de la
démonstration ajoute le menu, la scène C, la telco et leurs règles dédiées.

### 4.5. Routes déclarées

**[API AUTEUR] — références déclaratives, sans destination calculée par une
fonction.**

Une route est l’une des formes suivantes :

~~~ts
type RouteTarget =
  | { path: string }
  | { label: string }
  | { direction: 'next' | 'previous' | 'up' | 'down' }
~~~

Une route path désigne un nœud déclaré. Une route label désigne un identifiant
résolu par l’index. Une route direction est résolue dans le graphe local puis,
à une borne, par recherche de la même intention dans les portées parentes.

La résolution ne synthétise pas une direction up lorsque next ou previous
atteint une borne. Une sortie de niveau doit être déclarée.

### 4.6. Actions et conditions

**[API AUTEUR DE DÉCLARATION] — mécanismes exposés à l’auteur ; la forme
compilée/exportable est traitée séparément.**

Une `ViewAction` de la déclaration peut porter une route, une référence d’action
ou une fonction d’auteur exposée par l’API, selon le contrat retenu. Le fichier
de déclaration n’est donc pas limité à des références sérialisables et peut
contenir le corps d’une fonction lorsque la surface d’auteur le prévoit. Cette
forme ne doit pas être confondue avec la vue compilée/exportable, qui ne conserve
pas les corps de fonctions dans son payload.

Le mécanisme d’action déclaré peut :

- produire une modification du contexte dans la transaction courante ;
- produire un nouvel événement discret ;
- envoyer un événement à une liaison active ;
- demander une opération autorisée du scénario.

Elle ne peut pas :

- inventer une destination ;
- écrire directement dans une instance CodPlay ;
- toucher au DOM ;
- modifier directement les conditions ou l’index publié.

Une condition de parcours est une fonction de lecture. Elle reçoit une vue
cohérente du contexte, de l’état et de l’événement. Elle ne modifie aucune
donnée.

### 4.7. Données (`data`)

**[API AUTEUR] — catégorie unique de données déclarées, sans confusion avec
`ScenarioContext` ou `RuntimeState`.**

Le plan ne distingue pas `data` et `meta` : cette différence n’est pas
suffisante pour justifier deux champs ou deux mécanismes. Le terme `data` est
conservé parce qu’il appartient déjà au vocabulaire et aux surfaces CodPlay.
Une même donnée peut servir au fonctionnement d’une scène, à son
initialisation ou à l’information descriptive d’une vue, sans changer de
catégorie pour cela.

Dans la déclaration, `data` peut contenir une valeur ou un `DataBinding` :

~~~ts
type DataBinding = {
  from: string
  update: 'entry' | 'live'
  event?: string
}
~~~

La verticale actuelle résout `data` du moins spécifique au plus spécifique :
données du scénario, portées de graphe, vues parentes puis vue active. Une
valeur locale remplace la valeur précédente. Un binding `from` lit un chemin
pointé dans `context` ou `data` ; un chemin non préfixé essaie d’abord le
contexte puis les données du scénario.

À l’entrée d’une sélection, les valeurs déclarées sont livrées par le chemin
d’événement public de la scène. `update: 'entry'` est livré une fois à
l’admission ; `update: 'live'` est réévalué après une mise à jour explicite du
contexte. L’événement indiqué par le binding est utilisé, avec `data:update`
par défaut. Une donnée ne devient pas automatiquement une route, une condition
ou une modification durable du contexte.

La persistance sérialisée d’un `RuntimeState` reste hors de cette reprise. Si
une application hôte en a besoin, elle en porte la responsabilité lors de son
intégration. Demo 4 ne déclare actuellement pas de `data` ; les tests de la
verticale dédiée portent donc sur une fixture Sighty indépendante.

### 4.8. Ce que l’auteur écrit dans le fichier

**[API AUTEUR] — repères de rédaction.**

L’auteur décrit le parcours et les mécanismes qu’il souhaite utiliser :

- les scènes par leurs `SceneKey` ;
- les vues, les slots et les identifiants de vue ;
- les routes, actions et conditions de parcours ;
- les `data` transmises aux scènes et aux mécanismes du parcours ;
- les fonctions ou autres mécanismes que la surface d’auteur expose.

L’auteur n’a pas à décrire la manière dont Sighty exécute ce parcours. Sighty
calcule les adresses complètes des vues et des slots, suit la composition active,
ouvre et ferme les liaisons avec les scènes, puis demande à CodPlay de créer ou
de piloter les occurrences nécessaires. Les players, abonnements, montages,
générations, révisions, handles de ressources et état de lecture ne sont donc
pas des éléments que l’auteur doit construire dans le fichier.

Le catalogue de scènes et le raccordement aux ressources sont fournis par
l’application autour du fichier ; le fichier désigne une scène, il ne décrit
pas son instance physique. De même, le fichier peut contenir une fonction
d’auteur, tandis que son extraction éventuelle appartient à la vue
compilée/exportable, comme indiqué en §2.5.

## 5. Types internes — index et parcours de l’arbre

Cette section décrit le modèle dérivé utilisé par Sighty après validation du
fichier auteur. **[INTERNE]** Aucun des types présentés ici ne constitue un
champ ou une exigence du fichier auteur.

### 5.1. Index immuable

**[INTERNE] — représentation dérivée, non exportée par la façade publique.**

Après validation, Sighty construit un index pour chaque version du scénario.
L’index contient :

~~~ts
type ViewIndex = {
  revision: number
  root: GraphDescriptor
  viewsByAddress: ReadonlyMap<string, ViewDescriptor>
  slotsByAddress: ReadonlyMap<string, SlotDescriptor>
  actionsByScope: ReadonlyMap<string, ReadonlyMap<string, ViewAction>>
  conditionsByScope: ReadonlyMap<string, ReadonlyMap<string, string>>
}

type ViewDescriptor = {
  address: ViewAddress
  viewId: string
  parent: ViewAddress | undefined
  container: 'root' | 'views' | 'slot'
  ownerSlot: SlotAddress | undefined
  listIndex: number | undefined
  sceneKey: string | undefined
  childGraphs: readonly GraphAddress[]
  scopes: readonly ScopeAddress[]
}

type SlotDescriptor = {
  address: SlotAddress
  owner: ViewAddress
  name: string
  graph: GraphAddress
}
~~~

L’index ne contient ni instance, ni montage, ni DOM, ni journal d’événements,
ni ressource acquise.

### 5.2. Composition active

**[INTERNE] — état logique publié par le coordinateur, différent de l’API
auteur.**

La composition active est un arbre de sélections logiques. Pour calculer les
différences, elle expose aussi une vue aplatie indexée par SlotAddress :

~~~ts
type ActiveComposition = {
  revision: number
  scenarioRevision: number
  rootView: ViewAddress
  selections: ReadonlyMap<string, ActiveSelection>
}

type ActiveSelection = {
  slot: SlotAddress
  view: ViewAddress
  sceneKey: string
  bindingId: string
  generation: number
}
~~~

Deux slots homonymes de branches différentes restent ainsi indépendants.

### 5.3. Algorithme de résolution

Pour chaque événement ou commande :

1. normaliser l’entrée ;
2. vérifier que la source est externe ou appartient à la composition publiée ;
3. retrouver la sélection source par BindingId et Generation ;
4. construire la chaîne de portées, de la vue active vers la racine ;
5. chercher l’action locale avant les actions héritées ;
6. résoudre la route déclarée ;
7. appliquer la règle de borne pour next/previous ;
8. vérifier l’existence et l’adressabilité de la cible ;
9. produire un résultat pur ou un diagnostic ;
10. ne modifier l’état publié qu’après validation complète.

La recherche par parcours des sélections actives ne doit pas être utilisée
comme mécanisme de priorité implicite. Une source de scène identifie sa
liaison ; un événement externe doit avoir une portée explicite ou rencontrer
une règle d’ambiguïté déclarée.

## 6. API de pilotage et types internes d’événements

Cette section sépare les deux directions de l’intégration de l’application
hôte avec Sighty, puis l’enveloppe normalisée utilisée par Sighty. L’auteur du
fichier ne renseigne jamais les identités de liaison ou de génération.

L’application hôte porte la partie métier et utilise Sighty pour la projeter.
Sighty n’est donc pas seulement un point d’injection : il reçoit des données
ou des commandes de l’application et lui restitue les événements que son
contrat rend accessibles.

~~~text
application hôte ── dispatch / commandes ──▶ Sighty ── exécution ──▶ CodPlay
application hôte ◀─ événements publics ───── Sighty ◀─ événements de scène ─ CodPlay
~~~

### 6.1. Entrée publique de l’application

**[API INTÉGRATION] — surface appelée par l’application, l’éditeur ou le
scheduler ; ce n’est pas une forme du fichier auteur.**

`runtime.dispatch` accepte une entrée publique composée d’un nom d’événement,
de données sérialisables facultatives et, si le contrat le permet, d’une
`SceneKey` source. Une application ne fournit ni `BindingId`, ni `Generation`,
ni `OccurrenceId`. Les commandes explicites du scheduler suivent la même
frontière publique et sont converties par Sighty avant la résolution.

Lorsqu’une `SceneKey` source est fournie par l’application, elle doit
correspondre à une liaison active unique. Une source inactive ou ambiguë est
abandonnée avant la résolution ; le nom public ne remplace pas l’identité
interne de la liaison.

La signature actuelle est `runtime.dispatch(event)`, avec `name`, `data` et
une `sourceSceneKey` facultative. Elle reste exprimable avec les types de
l’API d’intégration et ne reprend aucun type interne ci-dessous.

### 6.2. Sortie publique vers l’application hôte

**[API INTÉGRATION] — surface retenue et exécutée dans cette reprise.**

L’application hôte doit pouvoir souscrire aux événements que Sighty expose à
l’extérieur. Cette surface est le pendant de `runtime.dispatch` :
`dispatch` fait entrer une information dans Sighty ; l’abonnement permet à
l’application de recevoir une information produite ou relayée par Sighty.

Elle doit permettre de traiter, au minimum, les catégories déjà utiles au
projet :

- les événements du système de télécommande déjà en place ;
- les événements ou intentions de navigation, notamment lorsqu’ils résultent
  d’une interaction utilisateur ou d’un fait produit par une scène ;
- les informations produites par une interaction dans une scène CodPlay, y
  compris le remplissage d’un formulaire ;
- les autres événements publics de scène que le contrat Sighty décidera de
  relayer à l’application hôte.

Le chemin attendu pour une interaction de scène est donc : événement public
CodPlay, écoute interne par Sighty, adaptation et admission éventuelle dans le
parcours, puis publication de l’événement retenu vers l’application hôte. Le
fait qu’un événement puisse aussi provoquer une navigation ne crée pas un
second routeur : la navigation passe par le point d’admission Sighty avant sa
publication éventuelle.

La surface reprend la convention de CodPlay : l’abonnement retourne une
fonction de désabonnement :

~~~ts
runtime.events.onEvent(listener): () => void
~~~

Cette surface est portée par `runtime.events`. Elle publie les événements
publics reçus d’une scène active, avec leur `name`, leur `data` et leur
`sourceSceneKey`, avant que la demande correspondante ne soit admise par le
coordinateur. Le parallèle avec CodPlay porte sur le modèle
`onEvent`/désabonnement ; il ne justifie pas l’ajout d’un second `emit` public
si `dispatch` couvre déjà l’entrée vers Sighty.

L’enveloppe sortante doit rester une enveloppe d’intégration. Elle peut
conserver un nom, des `data` et, si cela est nécessaire au contrat, une source
ou une portée exprimée par des identifiants publics stables. Elle ne doit pas
exposer `BindingId`, `Generation`, `OccurrenceId`, une adresse interne, un
player, un montage ou un handle de ressource. L’absence de fuite interne est
vérifiée par le type de l’enveloppe. La publication est synchrone pour les
observateurs, isole leurs erreurs, respecte l’ordre d’émission, et le
désabonnement ou la destruction supprime les livraisons ultérieures. La
navigation éventuelle reste asynchrone dans la chaîne unique du runtime.

Le système de télécommande et les événements de navigation ne doivent donc pas
être rendus accessibles à l’hôte par des abonnements directs et spécifiques à
chaque instance CodPlay. Les instances peuvent fournir à Sighty les
événements publics qu’il adapte ; Sighty fournit le point d’abonnement public
de l’application hôte.

### 6.3. Événement discret normalisé

**[INTERNE] — enveloppe créée par l’adaptateur d’entrée.**

~~~ts
type SightyEvent = {
  name: string
  data?: Readonly<Record<string, unknown>>
  source:
    | { kind: 'external'; id?: string }
    | {
        kind: 'scene'
        bindingId: string
        generation: number
        sceneKey: string
      }
}
~~~

Un événement CodPlay public est adapté à cette forme à son entrée dans Sighty.
La source de l’adaptation est conservée. Le nom de scène ne suffit pas à
admettre l’événement.

### 6.4. Commande normalisée

**[INTERNE] — commande après admission de l’API d’intégration.**

~~~ts
type SightyCommand =
  | { kind: 'next' | 'previous' | 'up' | 'down'; source?: CommandSource }
  | { kind: 'goto'; target: RouteTarget; data?: DataPatch }
  | { kind: 'play' | 'pause' | 'stop'; target?: BindingTarget }
~~~

La commande goto du scheduler est validée contre l’index avant toute
acquisition. Sa `data` est une entrée de transition ; elle ne modifie pas
implicitement le contexte durable.

La commande publique correspondante doit référencer une route ou une cible de
l’API auteur. `BindingTarget`, `CommandSource` et `DataPatch` dans la forme
interne ne peuvent pas devenir des types imposés à l’auteur du fichier ; leur
adaptation publique sera documentée avec l’API d’intégration.

### 6.5. Admission et invalidation

**[INTERNE] — registre des liaisons et contrôle des générations.**

Le registre des liaisons actives conserve :

~~~ts
type ActiveBindingPort = {
  bindingId: string
  generation: number
  sceneKey: string
  acceptEvents: boolean
  unsubscribe: () => void
}
~~~

À la sortie d’une sélection :

1. acceptEvents passe à false ;
2. la génération est invalidée ;
3. les désabonnements sont exécutés ;
4. les demandes différées portant cette génération sont abandonnées ;
5. la relation physique est conservée si aucun host ne doit être repris ;
   sinon elle est remplacée ou détachée selon le plan ;
6. les ressources sont libérées seulement si leur propriété le permet.

Un événement déjà en cours d’exécution est contrôlé à nouveau avant chaque
effet différé. Il ne peut pas réactiver une sélection sortie.

## 7. Types internes — machine d’état et opérations

Les phases, états de liaison et opérations de cette section sont **[INTERNE]**.
Ils servent à exécuter le contrat public ; ils ne sont ni des champs du fichier
auteur ni des objets que l’application doit construire.

### 7.1. États globaux

La machine ne doit pas créer un produit illisible de tous les états de toutes
les scènes. Elle porte une phase globale et un état de lecture indépendant par
liaison :

~~~ts
type SightyPhase =
  | 'created'
  | 'initializing'
  | 'ready'
  | 'changing'
  | 'stopped'
  | 'finished'
  | 'error'
  | 'destroyed'

type BindingPlaybackState =
  | 'idle'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'stopped'
~~~

La fin de lecture d’une scène ne met pas nécessairement Sighty dans
finished. Une route peut retourner au menu ou poursuivre le parcours. L’état
finished désigne la fin du scénario ou de la session selon la politique
déclarée.

Proposition de transitions :

~~~text
created → initializing → ready
ready → changing → ready
ready → stopped
stopped → ready
ready → finished
ready → error
error → changing | stopped | destroyed
tous les états non détruits → destroyed
~~~

Pause conserve la composition et les données. Stop arrête la conduite de la
session sans être un reset ; sa capacité à recevoir des événements doit être
explicitement définie par l’état d’admission. Play reprend ou relance selon la
politique de la session. Une session finished ne redémarre que par une action
de reprise déclarée.

### 7.2. Opération de transition

~~~ts
type TransitionOperation = {
  operationId: string
  sourceRevision: number
  targetRevision: number
  input: SightyEvent | SightyCommand
  from: ActiveComposition
  to: ActiveComposition
  retained: readonly ActiveSelection[]
  entered: readonly ActiveSelection[]
  exited: readonly ActiveSelection[]
  policies: readonly TransitionEffect[]
  actions: readonly ResolvedAction[]
}
~~~

Une opération est préparée avant la moindre modification de la composition
publiée. Elle ne devient jamais un journal à rejouer.

### 7.3. Ordre obligatoire d’une transition

1. admettre l’entrée ;
2. résoudre l’action et la destination ;
3. vérifier les conditions de parcours ;
4. résoudre les `data` nécessaires ;
5. préparer la composition cible et son acquisition ;
6. calculer retained, entered, exited ;
7. invalider les liaisons sortantes ;
8. neutraliser les livraisons différées devenues obsolètes ;
9. résoudre la politique de scène et préparer les éventuels resets ;
10. réconcilier les relations de présentation : remplacer ou détacher une
    relation seulement en cas de conflit de host, puis monter les scènes
    entrantes par les surfaces publiques autorisées ; une sortie sans conflit
    peut rester physiquement conservée hors composition active ;
11. publier la nouvelle composition en une seule fois ;
12. ouvrir les liaisons entrantes ;
13. demander le reset CodPlay des occurrences conservées dont le
    `showMode` vaut `reset` ;
14. livrer les `data` d’entrée ;
15. finaliser le transport (`maintain`, `rewind` ou démarrage après `reset`) ;
16. exécuter les actions déclarées qui concernent les scènes actives ;
17. terminer l’opération ou publier une erreur cohérente.

Une erreur de préparation ne doit jamais publier une composition mixte. Si les
surfaces CodPlay ne permettent pas cette garantie, un plan CodPlay séparé est
requis.

La première verticale vérifie aussi le cas où deux adresses logiques
successives désignent le même slot physique : avec `replace`, le nouveau
montage est demandé avant le détachement géré par CodPlay ; sans `replace`, la
relation sortante est détachée avant la nouvelle demande. Une sortie sans
entrante dans son host n’est pas démontée par le seul changement de branche :
la présentation physique la conserve afin que les layouts, carousels et
compositions imbriquées restent propriétaires de leur visibilité. Le suivi de
cette cible physique reste interne à Sighty.

### 7.4. Concurrence

Les demandes discrètes admises sont sérialisées par le coordinateur. Une
intention qui peut changer la composition réserve atomiquement la phase
`changing` avant l’entrée dans la file ; une seconde intention de transition
arrivée pendant cette phase est rejetée avec `false`, et non accumulée. Les
commandes discrètes sans changement de vue peuvent attendre leur tour dans la
même file. Une demande issue d’un binding devenu obsolète est abandonnée,
jamais rejouée.

Cette protection est portée par la machine d’état Sighty et non par une
démo ou un contrôle HTML. Elle s’applique donc aussi aux graphes imbriqués,
aux carousels et aux compositions parallèles d’un même runtime.

## 8. API auteur des politiques de changement de vue

Les valeurs déclarées par l’auteur sont publiques ; leur résolution effective
et leur application aux occurrences restent internes à Sighty.

### 8.1. Héritage

Les réglages sont résolus du moins spécifique au plus spécifique :

~~~text
défaut intégré (`rewind`)
→ option `runtime.showMode` de l’instance
→ `file.showMode` du scénario
→ portée parente
→ graphe contenant (dont le graphe d’un slot)
→ vue active
~~~

La configuration par défaut et les options de l’instance relèvent de l’API
d’intégration. Le scénario, le graphe, la vue et le slot relèvent de l’API
auteur lorsqu’ils sont déclarés dans le fichier. Le mécanisme qui fusionne ces
valeurs et produit une politique effective reste interne.

Chaque propriété est résolue séparément. Une valeur absente hérite ; une
valeur explicite locale remplace l’héritage. `showMode` n’a pas de valeur
`off` : l’absence de déclaration utilise le défaut `rewind`.

### 8.2. Modes

**[API AUTEUR] — valeur déclarative.**

~~~ts
type SightyShowMode = 'reset' | 'maintain' | 'rewind'
~~~

Cette valeur est publique lorsqu’elle est déclarée dans le fichier auteur ou
dans une option d’intégration prévue par le contrat. La politique effectivement
résolue pour une liaison reste interne.

- `reset` réinitialise l’état logique de l’occurrence réadmise via
  `instance.telco.reset()`, en conservant la même instance physique ; il ne
  détruit ni ne recrée l’occurrence pour obtenir l’état initial. Le reset
  efface les faits runtime de la session, tandis que les eventimes auteur
  compilés restent attachés à l’instance. Cette remise à zéro suit le contrat
  CodPlay, et non une implémentation locale Sighty.
- `maintain` conserve l’occurrence, son état de lecture, sa position, son
  débit et son journal ; une occurrence qui était en pause reste en pause.
- `rewind` conserve l’occurrence, appelle la capacité publique
  `telco.rewind` et démarre la scène admise ; ce n’est pas une nouvelle
  session.

Ces modes sont exécutés uniquement lorsqu’une vue ou une liaison logique
change. Ils ne sont pas exécutés pour un simple play, pause, seek, événement
de progression ou changement d’état de lecture.

Si une même SceneKey est réutilisée dans deux rôles différents, la politique
est portée par la liaison vue/slot ou par une règle de rôle, jamais
automatiquement par la seule clé technique.

### 8.3. Cycle de vie distinct

**[INTERNE] — opérations produites à partir de la politique auteur.**

Le runtime distingue :

| Opération | Effet |
| --- | --- |
| entrée | crée ou active une sélection et son binding |
| conservation | garde la sélection et son état |
| sortie | invalide et désabonne ; conserve le montage tant qu’aucun host n’est repris |
| rewind | repositionne à zéro sans session neuve |
| reset | réinitialise l’état logique via CodPlay sur l’occurrence conservée |
| destruction | supprime l’occurrence et libère ses ressources |

Demo 4 déclare `showMode: 'reset'` pour ses scènes qui ne doivent pas
conserver les entrées utilisateur. Son test de réadmission vérifie désormais
la même identité d’instance, le retour à zéro et l’absence de rejouage des
faits runtime de la session précédente. Une destruction/recréation appartient
uniquement à une opération de destruction ou de rechargement explicitement
déclarée.

## 9. Fin de vue et fins de parcours

### 9.1. Sortie technique d’une scène

**[INTERNE] — séquence d’invalidation produite par une règle auteur.**

Lorsqu’une scène sort de la composition :

1. ses émissions sont désactivées pour Sighty ;
2. sa génération est invalidée ;
3. les envois différés sont abandonnés ;
4. son observation est désabonnée ;
5. tout fait qui doit encore être traité par le scénario est admis par le
   coordinateur et non par une source déjà fermée.

La fin d’une scène et son retrait technique sont deux faits distincts, décision
arrêtée le 2026-09-15 :

- `scene:end` est un signal fonctionnel adressé à Sighty. La scène indique
  « j’ai fini, à toi » ; elle reste montée et liée, et peut poursuivre un état
  `idle` d’une animation perpétuelle. Sighty décide ensuite de la suite selon
  le scénario.
- `sequence:end` conserve le comportement CodPlay du player : il termine la
  séquence et arrête la lecture, sans détruire l’instance, le montage ou les
  ressources. Une transition peut modifier la composition logique, mais le
  montage physique est conservé tant qu’il n’entre pas en conflit avec un
  autre child ; le détachement et la destruction relèvent d’une reconstruction,
  d’un conflit de host ou de la destruction du runtime.

Ces deux signaux peuvent entraîner un changement de vue si le scénario le
paramètre ou si une écoute les transforme en intention adressée au point
d’admission normal de Sighty. Ils ne doivent pas créer deux coordinateurs ni
confondre signal fonctionnel et retrait technique.

### 9.2. Condition de fin de vue

**[API AUTEUR] — comportement à déclarer ; aucune structure de configuration
n’est inventée ici.**

Une vue peut contenir plusieurs scènes. Sa sortie est gardée par `exitBy`,
distincte de la fin de chacune de ces scènes : la condition la plus spécifique
est évaluée pour les sélections sortantes et un seul refus bloque la transition
entière. Une scène passive qui ne sort pas de la composition n’est pas évaluée.
Les conditions peuvent être explicites et héritées depuis une portée parente ;
elles n’ont donc pas à être répétées dans toutes les vues.

Les signaux `scene:end` et `sequence:end` ne déclenchent pas implicitement une
navigation. Une action `go` peut toutefois être déclarée avec l’un ou l’autre
comme clé d’événement, ou l’application hôte peut observer l’événement public
et réinjecter une intention avec `runtime.dispatch`.

Une interaction utilisateur, une convention de fin de scène/séquence ou une
écoute d’intégration peut donc produire une intention de navigation adressée à
Sighty. Dans tous les cas, cette intention emprunte le même point d’admission
et le même coordinateur ; elle ne crée pas une sélection directe.

Le choix entre une action auteur et une écoute d’intégration est explicite dans
le contrat d’utilisation : l’action est locale au fichier auteur, tandis que
l’écoute reste sous la responsabilité de l’application hôte. Les deux voies
réutilisent `dispatch` pour naviguer.

Les destinations possibles sont :

- retour au niveau supérieur ;
- retour au sommet du scénario ;
- route goto déclarée vers une page ou une vue.

### 9.3. Fin de la machine

Le scénario peut boucler vers un menu sans atteindre finished. Lorsque aucune
sortie déclarée n’est résolue, la sélection reste inchangée sauf si une
politique d’erreur l’impose. La transition vers finished doit être explicite
et testée séparément de la fin d’une scène.

## 10. API auteur à part — couplage télécommande/scène

Le couplage de la télécommande avec la scène contrôlée est une tranche
spécifique. Cette tranche de navigation doit toutefois fournir le point
d’ancrage générique :

**[API AUTEUR] — descripteur déclaratif arrêté pour cette reprise.** Les
références restent des noms de slots de la vue ; elles ne contiennent pas un
`BindingId`, une adresse de slot interne ou une occurrence CodPlay.

~~~ts
type CouplingDescriptor<SlotName> = {
  couplingId: string
  controllerSlot?: SlotName
  controlledSlot: SlotName
  commands: Readonly<Record<string, TelcoCommand | readonly TelcoCommand[]>>
}

type TelcoCommand =
  | 'play'
  | 'pause'
  | 'togglePlay'
  | 'setRate'
  | 'seek'
  | 'rewind'
  | 'reset'
~~~

Le descripteur indique :

- quel slot reçoit les commandes, ou laisse Sighty utiliser la liaison source
  de l’événement dans la vue ;
- quel slot est contrôlé ;
- quels noms d’événements sont acceptés ;
- comment le couplage est fermé à la sortie.

La télécommande utilise l’interface telco CodPlay canonique. Sighty médiatise
le couplage, vérifie la validité du binding et soumet l’intention à ce port
avant chaque commande ; il ne crée pas une seconde interface d’exécution.

Lorsque les événements produits par la télécommande doivent être accessibles
à l’application hôte, ils empruntent la surface publique de souscription
décrite en §6.2. L’application hôte n’a pas à connaître l’instance CodPlay qui
porte la telco et ne crée pas un abonnement parallèle pour recevoir ces
événements. La liste des événements de télécommande reste fournie par les
scènes CodPlay. Les commandes `setRate` et `seek` attendent respectivement les
données `{ rate }` et `{ timeMs }`; `seek` accepte aussi la valeur native
`{ value }` d’un composant d’entrée. Sighty ne crée pas une seconde
implémentation de la télécommande.

L’intégration hôte conserve l’accès à toute la telco CodPlay via l’instance
retournée par `runtime.getInstanceAt(slotAddress)` ; cette surface est le même
port canonique, et non une voie concurrente à l’orchestration Sighty. Ses
getters, commandes et observations vivantes ne sont pas recopiés par Sighty.
Aucun événement `progress:update` ne sera introduit pour les traiter.

La possibilité d’importer une méthode de telco d’une scène vers une autre sera
traitée comme un port de commande réutilisable, pas comme une copie de
méthodes ni comme une dépendance directe entre scènes.

## 11. API auteur des données et types internes d’exécution

### 11.1. Séparation des responsabilités

Pour éviter de surcharger le mot state, le plan distingue les `data` du
parcours de son contexte durable et de son état d’exécution. Il ne crée pas une
seconde catégorie de données.

| Élément | Surface | Rôle |
| --- | --- | --- |
| `DataBinding` | **API auteur** | décrit une donnée à résoudre et son mode de mise à jour |
| `AppState` | **API intégration** | valeur fournie par l’application hôte |
| `ScenarioContext` | **modèle public du parcours, stockage interne** | données durables lues par les déclarations et modifiées par transaction |
| `RuntimeState` | **interne** | position, phase, composition et informations d’exécution |

Le fichier auteur ne contient donc pas un `RuntimeState`. Il déclare les
bindings et valeurs de `data` qui permettront de fournir les données aux scènes
et aux mécanismes du parcours.

**[INTERNE sauf indication contraire dans le tableau ci-dessus]**

~~~ts
type AppState = Readonly<Record<string, unknown>>

type ScenarioContext = Readonly<Record<string, unknown>>

type RuntimeState = {
  phase: SightyPhase
  revision: number
  activeComposition: ActiveComposition
  contextRevision: number
  error: RuntimeError | undefined
}
~~~

- AppState appartient à l’application hôte et peut fournir des valeurs
  dynamiques ;
- ScenarioContext contient les données durables du parcours ;
- RuntimeState décrit la position et l’exécution Sighty ;
- `data` désigne l’unique catégorie de données déclarées et transmises à la
  composition active.

La nomenclature finale doit être alignée avec la spécification avant M1.

### 11.2. Context

Le contexte initial est fourni à la création ou au démarrage. Une action peut
proposer une mise à jour du contexte dans la transaction en cours. La mise à
jour est validée et publiée uniquement si la transition est committée.

Une scène ne modifie jamais directement le contexte. Une condition de parcours
ne peut pas écrire.

### 11.3. State et valeurs dynamiques

La référence de la vue active, les bindings d’occurrence et les informations
de reprise sont produites par Sighty. Les helpers dynamiques sont des
résolveurs de lecture ; ils ne créent pas une horloge ni un flux parallèle.

Une scène reçoit les données déclarées à l’entrée par le chemin d’événement
CodPlay. Une liaison `live` est réévaluée après `runtime.updateContext`, qui est
le déclencheur discret de cette verticale ; elle ne crée ni horloge ni flux de
progression.

### 11.4. Données transmises

Les `data` déclarées par les vues et fournies par une commande externe relèvent
d’une seule catégorie. La verticale résout les portées du moins spécifique au
plus spécifique, puis transmet les clés déclarées à la scène active. Les
valeurs littérales et les bindings suivent la même règle de remplacement ; un
binding lit `context` ou `data` par chemin pointé. Sighty ne modifie pas l’état
interne de la scène pour injecter ces données.

`entry` est livré à l’admission de la sélection et `live` après une mise à jour
du contexte. L’événement personnalisé du binding est conservé, avec
`data:update` comme valeur par défaut.

### 11.5. Persistance hors périmètre

Aucune API de sauvegarde ou de restauration sérialisée n’est définie par cette
reprise. Le `RuntimeState` désigne ici l’état vivant d’exécution de Sighty ; il
ne doit pas être confondu avec une sauvegarde durable. Une éventuelle
persistance relève de l’application hôte et de son intégration.

## 12. API d’intégration — mutation du scénario

Le scénario est mutable uniquement par des méthodes dédiées de Sighty. La
mutation n’écrit pas directement dans l’objet publié ; elle construit une
nouvelle version validée.

Cette API de mutation est appelée par le code de l’application et ne constitue
pas une extension implicite du fichier auteur. Ses cibles doivent utiliser une
référence auteur stable ; elles ne doivent pas exposer `ViewAddress`.

~~~ts
type AuthorViewReference =
  | { path: string }
  | { label: string }

type ScenarioMutation =
  | { kind: 'add-view'; parent: AuthorViewReference; view: ViewDefinition }
  | { kind: 'update-view'; target: AuthorViewReference; patch: ViewPatch }
  | { kind: 'remove-view'; target: AuthorViewReference }
  | { kind: 'hide-view' | 'show-view'; target: AuthorViewReference }
~~~

**[API INTÉGRATION — VERTICALE ACTUELLE]** Le scénario traduit
`AuthorViewReference` en adresse interne ; l’adresse interne ne franchit pas la
frontière publique. La nouvelle version est validée avant d’être publiée.

Chaque mutation indique ou résout une politique :

**[API INTÉGRATION] — politique de rechargement fournie par le code appelant ou
par la mutation ; elle ne rend pas publics les états internes.**

~~~ts
type MutationReloadPolicy = 'preserve' | 'rewind' | 'reset' | 'reload'
~~~

Règles :

1. la nouvelle version est validée avant publication ;
2. l’index est reconstruit sans modifier l’index actif ;
3. la composition active est vérifiée contre la nouvelle version ;
4. une vue supprimée ou interdite est traitée par une route de repli déclarée ;
5. aucune composition partielle n’est publiée ;
6. le rechargement de scène ou de vue est explicite, général ou attaché à
   l’action de mutation ;
7. l’ajout d’une vue inactive n’acquiert aucune ressource avant sa sélection.

La verticale actuelle exécute ces opérations par `runtime.mutate`. En mode
`preserve`, elle conserve la sélection encore déclarée et les occurrences
compatibles ; `rewind` rembobine la composition résultante ; `reset`
réinitialise les occurrences compatibles via le reset CodPlay en conservant
leur identité ; `reload` réacquiert explicitement les ressources et ne doit
pas être déduit d’un reset. Une mutation ajoutant une vue inactive ne crée
toujours aucune occurrence avant sa sélection.

Si la préparation, le preload, le montage ou la livraison échoue, Sighty
restaure la version auteur précédente, l’index, la composition et les
occurrences physiques. Les ressources introduites par la tentative sont
libérées par la surface de preload de l’owner CodPlay. La persistance
sérialisée reste hors de cette reprise.

## 13. API auteur des sources et types internes de ressources

Le fichier de scénario ne contient pas de chemin de chargement, de factory ou
de fonction d’acquisition. Il référence une SceneKey.

`SceneKey` est une référence de l’API auteur et de l’API d’intégration. Les
étapes d’acquisition et le registre ci-dessous sont **[INTERNE]**.

Le catalogue d’acquisition conserve la séparation suivante :

~~~text
SceneKey
→ source déclarée
→ document résolu
→ build CodPlay
→ ressource acquise
→ occurrence montée
~~~

La même source doit être utilisée pour le preload et l’acquisition à la
sélection. Le preload ne doit pas créer un second loader. Les scènes directes
sont compilées à l’initialisation ; leur préparation de ressources passe par
le service preload séparé. Une source différée (lazy) est résolue et compilée
lorsqu’une vue référente entre, puis les ressources nécessaires sont préparées
par ce même service et réutilisées depuis le cache du scénario. Cette section
ne décrit donc pas une fonctionnalité à inventer, mais le contrat à vérifier et
à maintenir.

Sighty conserve les URLs préparées par `SceneKey` et libère les URLs devenues
inutiles via `owner.preload.release`. Le cache CodPlay porte la propriété par
owner et ne supprime une entrée partagée qu’après le relâchement de tous ses
propriétaires. Le rollback d’une mutation relâche les URLs introduites par la
tentative ou reconstruit les claims de la version précédente après un reload
destructif.

Un registre interne peut suivre :

~~~ts
type ResourceRecord = {
  sceneKey: string
  status: 'declared' | 'resolving' | 'ready' | 'failed' | 'released'
  ownerCount: number
  preparationCount: number
}
~~~

Une ressource partagée n’est libérée que lorsque ses propriétaires et ses
préparations sont nuls. La fin temporelle d’une scène ne provoque pas seule sa
libération.

En mode auteur, une source manquante produit un warning exploitable. En mode
diffusion, la politique est déclarée : vue d’erreur, vue de repli ou loader.
Une erreur d’acquisition ne publie pas une composition incohérente.

## 14. Tranches et gates obligatoires

### M0 — audit du modèle et décisions résiduelles

Comparer les points suivants avec les plans et spécifications déjà acceptés,
ainsi qu’avec les décisions explicitement arrêtées pour Sighty. Une décision
déjà acceptée est contrôlée pour conformité et n’est pas revalidée. Chaque
écart doit être classé comme divergence d’implémentation ou comme décision
nouvelle ; seule cette dernière catégorie nécessite une validation avant le
code qui en dépend.

- la séparation entre API auteur, API d’intégration et types internes ;
- la distinction entre le fichier de déclaration et la vue
  compilée/exportable, notamment le traitement des fonctions et mécanismes
  exposés à l’auteur ;
- la forme complète du fichier de déclaration, avec champs obligatoires,
  champs optionnels et règles de validation, puis la forme exportable résultante ;
- les deux usages des conditions (accès à une page et fin de vue), leur
  attachement aux éléments du fichier et la forme de leurs références ;
- le comportement en cas de refus d’accès : page suivante ou échappatoire ;
- le mécanisme d’héritage des conditions et des conventions de fin, y compris
  la règle de combinaison et de priorité des déclarations ;
- l’absence de navigation automatique implicite en fin de scène ou de
  séquence ;
- la distinction entre `scene:end`, signal fonctionnel qui laisse l’occurrence
  active, et `sequence:end`, signal terminal traité selon le comportement
  CodPlay sans destruction automatique de l’occurrence ;
- le mécanisme de réévaluation de la fin de vue après les événements produits
  par les scènes ou une interaction utilisateur, ainsi que sa justification ;
- la pertinence d’un écouteur CodPlay transformant un fait de scène en
  événement de navigation adressé à Sighty, sans second circuit ;
- l’API de sortie qui permet à l’application hôte de souscrire aux événements
  publics de Sighty, en particulier ceux de la télécommande, de la navigation
  et des interactions de scène ;
- les catégories d’événements rendues publiques, leur ordre, leur source, leur
  payload `data`, leur cycle de vie et le comportement du désabonnement ;
- la frontière entre l’écoute interne des événements CodPlay par Sighty et la
  publication destinée à l’application hôte ;
- le contrat unique de `data`, notamment la portée de `entry` et `live` et son
  éventuel héritage entre vues ;
- la frontière entre `ViewId`, `SlotName` et `SceneKey` côté auteur, puis
  `ViewAddress`, `SlotAddress`, `BindingId`, `Generation` et `Revision` côté
  interne ;
- la correspondance explicite entre chaque type auteur et sa représentation
  interne ;
- la syntaxe des routes et des références auteur ;
- la priorité des portées ;
- le nom public `showMode`, ses valeurs `reset`, `maintain` et `rewind`, son
  héritage et son défaut `rewind` ;
- le reset logique CodPlay utilisé par `showMode: 'reset'` et `runtime.reset` :
  même instance physique, état logique reconstruit, sans `destroy`/`create` ;
- la correspondance entre remise à zéro des entrées, état de lecture, journal
  et éventuelles données utilisateur, selon le contrat CodPlay ;
- la séparation entre registry d’instances conservées, composition active,
  registre de présentation physique, bindings et destruction effective ;
- la surface CodPlay exacte qui porte le reset ; Sighty ne doit pas créer une
  API de remplacement ni une instance à la volée pour compenser une absence
  d’adaptateur ;
- la distinction événements/commandes ;
- les noms et sémantiques canoniques des faits de fin de scène, de fin de
  séquence et de retrait ;
- la différence entre changement de vue, couplage initial et reset ;
- les surfaces publiques de `Sighty`, de `scenario` et de `runtime`, sans
  fuite de type interne ;
- les noms `AppState`, `ScenarioContext` et `RuntimeState` ;
- la politique de saturation et d’annulation ;
- la politique de Reset.

**Gate :** la matrice de conformité rattache l’API auteur, sa frontière avec
les types internes, le reset et l’identité d’instance aux contrats sources ;
les signatures publiques ne contiennent aucun type interne ; seules les
décisions nouvelles identifiées doivent être acceptées avant leur
implémentation ; aucune décision ne reste implicite dans Demo 4.

### M1 — index et résolveur pur

Construire les modèles **internes** sans CodPlay ni DOM, à partir de l’API
auteur validée :

- index immuable ;
- adresses complètes ;
- parcours de map et de liste ;
- résolution next/previous/up/down ;
- cascade à la borne ;
- routes path et label ;
- héritage et remplacement d’action ;
- héritage des conditions et des conventions de fin ;
- détection des ambiguïtés.

**Tests :** arbre minimal, slots homonymes, listes identifiées, niveaux
imbriqués, routes inconnues et absence de voisin parent.

**Gate :** résolution déterministe et aucun effet externe dans le résolveur.

### M2 — machine d’état et plans d’opération

Ajouter les modèles **internes** :

- RuntimeState ;
- ActiveComposition ;
- TransitionOperation ;
- révisions monotones ;
- sérialisation des commandes ;
- verrou d’admission des transitions concurrentes ;
- rejet des demandes obsolètes ;
- publication atomique de la composition logique.

**Tests :** transitions concurrentes, erreur de préparation, annulation,
play/pause, fin locale et fin globale.

**Gate :** aucune carte active ne change avant le commit d’une opération
complète.

### M3 — admission des événements et cycle de liaison

Raccorder les événements publics CodPlay et externes au même point d’entrée :

- BindingId et Generation ;
- ouverture et fermeture des abonnements ;
- invalidation avant détachement ;
- contrôle avant effet différé ;
- écoute CodPlay et transformation éventuelle d’un fait en événement de
  navigation, par le même point d’admission ;
- publication, par le point de sortie Sighty validé en M0, des événements
  retenus pour l’application hôte ;
- envoi des actions via le même point d’admission ;
- séparation diagnostic/routage.

**Tests :** événement d’une scène sortie, réentrée répétée, émission pendant
transition, fin de scène, transformation éventuelle vers une navigation, envoi
vers scène inactive et destruction.

**Gate :** aucune réaction tardive d’une composition précédente.

### M4 — cycle de vie des scènes

Raccorder le plan logique aux opérations CodPlay autorisées, sans
réimplémenter le cycle interne de CodPlay :

- entrée ;
- conservation ;
- sortie ;
- rewind ;
- reset ;
- destruction ;
- montage et détachement ;
- maintien des scènes requises ;
- fin de scène et retrait de séquence, sans les confondre.

L’entrée délègue l’initialisation à `owner.instances.create`. Le reset délègue
le reset logique chaud à l’instance existante. Le preload et la libération des
ressources restent dans la tranche d’acquisition dédiée ; `reset` ne les
réexécute pas.

**Tests :** scène conservée, scène réinitialisée sur la même instance, journal
et entrées selon le contrat CodPlay, absence de destruction/recréation pendant
reset, sorties répétées et erreurs partielles.

**Gate :** Reset n’est pas simulé par Rewind, ne détruit/recrée pas une
instance, et aucune opération globale ne masque une garantie absente.

### M5 — acquisition et propriété des ressources

Consolider et valider la résolution de source, le preload partagé, l’acquisition
à la demande et la libération contrôlée déjà exécutés par la verticale.

La source directe est compilée à l’initialisation ; sa préparation de
ressources relève du service preload séparé. La source différée (lazy) est
résolue une seule fois à sa première sélection, puis son document, son build et
ses ressources sont réutilisés. Sighty suit les URLs par scène et libère celles
devenues inutiles ; le cache CodPlay conserve les entrées tant qu’un owner les
possède encore.

**Preuves actuelles :** source directe, factory, source lazy, source
indisponible, preload réutilisé, ressources partagées, annulation et libération
idempotente sont couvertes par les suites existantes. Les vérifications media,
intégration complète et navigateur restent à compléter.

**Gate restante :** préserver une seule source et un seul chemin de
preload/acquisition, y compris pendant reset, mutation, rollback et destruction.
Un reset logique ne peut pas devenir une recréation d’instance ou une nouvelle
acquisition par défaut.

### M6 — conditions de parcours, fin de vue et erreurs

Ajouter les deux usages de conditions :

- condition d’accès à une page ou une section ;
- page suivante ou échappatoire déclarée en cas de refus ;
- héritage des conditions et conventions de fin selon les portées validées ;
- `exitBy` comme garde de sortie d’une vue, y compris lorsqu’elle contient
  plusieurs scènes ;
- conventions `scene:end` et `sequence:end`, avec vérification du signal
  fonctionnel, du traitement terminal CodPlay et de leur raccord éventuel à la
  navigation ;
- distinction entre le signal de fin d’une scène et la sortie gardée de la vue ;
- interaction utilisateur comme déclencheur de navigation, selon le cas de
  Demo 4 ;
- événement de navigation adressé à Sighty dans chacun de ces cas ;
- écoute CodPlay et transformation éventuelle vers une intention de
  navigation, si cette solution est jugée pertinente ;
- réévaluation du garde `exitBy` lorsque le contexte change ;
- scènes passives ignorées lorsqu’elles ne sortent pas de la composition ;
- voie d’erreur déclarée ;
- diagnostic observable ;
- relance depuis le départ déclaré.

**Gate :** les conditions ne modifient pas directement les données, une fin de
vue ne survient pas avant l’établissement de ses conditions, et la voie
d’erreur ne produit pas de sélection mixte.

### M7 — données, context et état vivant

Fixer puis implémenter :

- API auteur des bindings, valeurs et références ;
- contexte initial de l’API d’intégration ;
- actions de mise à jour ;
- résolution et transmission des `data` ;
- valeurs dynamiques ;
- état vivant lisible par les conditions et les couplages.

**Gate :** aucune scène ne modifie directement le contexte ou l’état Sighty.

### M8 — mutation du scénario

Implémenter les mutations versionnées après validation :

- ajout ;
- modification ;
- retrait ;
- masquage ;
- affichage ;
- politique preserve/rewind/reset/reload.

**Gate :** aucune mutation ne publie une structure partiellement validée.

### M9 — couplage télécommande/scène

Consolider et valider le descripteur de coupling arrêté en §10 :

- slot source et slot contrôlé déclarés dans la vue ;
- événements de commande configurables ;
- commandes telco complètes et séquences ordonnées ;
- interface telco CodPlay unique, avec Sighty limité au ciblage, à l’admission
  et à la sérialisation ;
- fermeture à la sortie et validation du binding ;
- accès hôte à l’instance telco complète par slot.

Cette tranche ne doit pas réintroduire de progression périodique dans les
événements normaux et ne doit pas ajouter de persistance à Sighty.

### M10 — réécriture et acceptation de Demo 4

Réécrire la composition Demo 4 pour qu’elle ne conserve que :

- le fichier déclaratif ;
- le catalogue de sources fourni à Sighty ;
- les SceneDoc ;
- les actions de présentation appartenant aux scènes ;
- les contrôles de page strictement nécessaires à l’observation.

Elle ne doit plus conserver :

- un routeur local ;
- un index de navigation ;
- un registre de couplage concurrent ;
- une révision parallèle de source ;
- un transport progress:update ;
- un abonnement direct aux instances CodPlay pour les événements que Sighty
  rend publics à l’application hôte ;
- une politique de nettoyage concurrente.

**Gate :** le parcours réel menu → A/B/C → menu → A de Demo 4 est conduit par
Sighty et les scènes réelles ; les événements de navigation, de télécommande
et d’interaction destinés à l’application hôte passent par la surface publique
Sighty validée en M0. Demo 1 à 3 ne sont pas des prérequis de cette gate.

### M11 — validation complète

Exécuter, selon les catégories affectées :

- tests unitaires du résolveur ;
- tests de machine et d’invalidation ;
- tests de cycle de vie ;
- tests d’acquisition et de ressources ;
- tests conditions/data/state ;
- intégration CodPlay/Sighty ;
- souscription de l’application hôte aux événements publics Sighty, propagation
  des événements de télécommande, de navigation et d’interaction, puis
  désabonnement et destruction ;
- surface telco CodPlay complète (`play`, `pause`, `togglePlay`, `setRate`,
  `seek`, `rewind`, `reset`, `commandInFlight`, `rate`, `getState`, `getProgress`,
  `onChange` et `onProgress`) et répétitions ;
- absence de toute voie de commande concurrente dans Sighty ou les démos ;
- redimensionnement si affecté ;
- typecheck ;
- suite de tests ;
- build ;
- validation navigateur ;
- validation Safari.

Une catégorie ne peut être omise que si l’analyse causale documente pourquoi
elle n’est pas affectée.

## 15. Critères d’acceptation

### 15.1. API auteur

- le fichier de déclaration peut utiliser les fonctions et mécanismes exposés
  par l’API auteur ;
- la vue compilée/exportable ne conserve que la représentation portable prévue
  par la compilation, sans corps de fonctions dans son payload ;
- sa structure récursive, ses routes, ses actions, ses conditions, ses `data` et
  ses politiques sont documentées sans dépendre des types internes ;
- `ViewId`, `SlotName` et `SceneKey` sont les seules identités de parcours
  écrites par l’auteur ;
- aucun fichier auteur ne contient `ViewAddress`, `SlotAddress`, `BindingId`,
  `Generation`, `Revision` ou `OccurrenceId` ;
- un fichier auteur peut être validé et inspecté sans créer d’instance CodPlay,
  de player, de montage ou de ressource acquise ;
- une erreur de structure ou de référence auteur est signalée avant toute
  transition ;
- la normalisation vers l’index interne est unique et ne crée pas de second
  modèle de navigation.

### 15.2. Parcours

- le fichier est la seule source de structure ;
- les listes suivent leur ordre ;
- les identifiants de liste restent stables ;
- next/previous essaient le voisin local puis la portée parente à la borne ;
- up et down sont explicites ;
- les conditions et conventions de fin suivent l’héritage de portée validé ;
- `showMode` suit cette même résolution de portée, avec `reset`, `maintain` et
  `rewind` comme seules valeurs ;
- deux slots homonymes ne se mélangent pas ;
- path et label n’utilisent pas d’index caché ;
- une destination inconnue produit un diagnostic avant tout commit.

### 15.3. Machine et événements

- toutes les entrées passent par le même coordinateur ;
- une composition possède une révision unique ;
- une opération obsolète est abandonnée ;
- un événement d’une scène sortie ne produit aucun effet ;
- aucun événement n’est rejoué après invalidation ;
- un fait de scène éventuellement transformé en navigation rejoint le même
  point d’admission Sighty ;
- l’application hôte dispose d’un point de souscription unique aux événements
  publics Sighty ;
- les événements de télécommande, de navigation et d’interaction retenus par
  le contrat atteignent l’application hôte par cette surface ;
- le désabonnement empêche les livraisons ultérieures et la destruction
  nettoie les abonnements ;
- l’enveloppe publique ne contient aucun type interne, aucune instance CodPlay
  et aucun handle de ressource ;
- la publication vers l’hôte ne crée pas un second circuit de navigation ou
  d’exécution ;
- send ne contourne pas l’admission ;
- les diagnostics ne réactivent aucune scène ;
- les événements continus ne sont pas ajoutés au journal normal.

### 15.4. Cycle de vie

- Maintain conserve réellement la scène ;
- Rewind revient à zéro sans être présenté comme un reset ;
- Reset reconstruit l’état logique par le reset CodPlay sur la même instance ;
- une occurrence conservée garde son identité physique pendant le reset ;
- aucune création à la volée ne sert de mécanisme de remise à zéro ;
- une entrée issue d’une navigation passe par le coordinateur unique, qui
  livre ses données avant de finaliser le comportement `showMode` ;
- la sortie invalide avant tout remplacement ou détachement physique nécessaire ;
- la fin de chaque scène est distincte de la fin de la vue ;
- aucune navigation automatique n’est déduite d’une fin de scène ou de
  séquence ;
- `scene:end` reste un signal fonctionnel ; `sequence:end` termine la séquence
  selon le comportement CodPlay sans détruire l’occurrence ;
- `exitBy` garde la sortie d’une vue multi-scènes ;
- une interaction utilisateur peut produire l’événement de navigation attendu ;
- les signaux de fin déclarés ou transformés par l’hôte adressent Sighty par
  un événement de navigation ;
- une vue ne se termine pas tant que sa condition n’est pas satisfaite ;
- une scène passive est ignorée dans l’ensemble attendu ;
- finished est un état explicite de la machine.

### 15.5. Données et mutations

- les conditions de parcours ne modifient rien ;
- les actions modifient le contexte par transaction ;
- les `data` suivent une règle unique de résolution documentée ;
- l’état vivant ne fuit aucune référence physique dans l’API auteur ;
- une mutation est validée avant publication ;
- une mutation active applique la politique de rechargement déclarée.

### 15.6. Demo 4

Le parcours suivant doit rester stable après plusieurs répétitions :

~~~text
menu → A → B → C → menu → A → B → menu → C
~~~

Il doit vérifier :

- une seule occurrence layout ;
- une seule composition active ;
- une telco présente uniquement dans la branche prévue ;
- la conservation de la scène conformément à Maintain ;
- le reset de la télécommande conformément à sa politique, avec état logique
  remis à zéro et identité de l’instance CodPlay conservée ;
- l’observation par l’application hôte des événements publics de télécommande,
  de navigation et d’interaction via Sighty, sans abonnement direct aux
  instances CodPlay ;
- la fin de C traitée par le même routeur ;
- aucune ancienne scène ne pilote la telco ou la navigation ;
- aucun event progress:update ;
- aucun accès DOM depuis Sighty.

## 16. Hors périmètre explicite

Ne pas inclure dans la reconstruction de navigation :

- l’exposition des types internes comme API utilisateur ;
- une API de progression globale Sighty ; la projection locale CodPlay relève
  du plan dédié d’évaluation de la progression ;
- un flux continu d’événements ;
- un accès au DOM ou aux racines matérialisées ;
- un nouveau mécanisme interne CodPlay exposé sans contrat ;
- une seconde façade publique Sighty parallèle à l’API d’intégration définie en
  §6 ;
- un abonnement direct de l’application hôte aux instances CodPlay pour
  contourner la publication Sighty ;
- une logique de navigation propre à Demo 4 ;
- une copie de telco entre scènes ;
- une simulation de Reset par un simple Rewind.

## 17. Suivi de l’implémentation

| Tranche | Statut actuel | Condition de passage |
| --- | --- | --- |
| M0 — modèle et décisions | En cours | décisions auteur, intégration et fin de scène relues ; smoke Safari Demo 4 exécuté le 2026-09-16, autres parcours à valider |
| M1 — index et résolveur | En cours | tests du graphe et des routes complétés, validation des cas restants |
| M2 — machine et opérations | En cours | opérations versionnées et composition active éprouvées, erreurs partielles restantes |
| M3 — événements et invalidation | En cours | événements publics, abonnements actifs, sources inactives et invalidation testés |
| M4 — cycle de vie | En cours | reset et showMode couverts ; Demo 4 vérifié dans Safari, erreurs partielles et autres parcours à terminer |
| M5 — ressources | En cours | résolution directe/lazy et propriété du cache CodPlay vérifiées ; couverture media, intégration complète et navigateur à terminer |
| M6 — conditions et erreurs | En cours | accès/sortie par portée, garde `exitBy` et signaux de fin exécutés, avec régression d’intégration ; navigateur restant |
| M7 — données et état vivant | En cours | data/context `entry`/`live` et lecture d’état exécutés ; navigateur restant |
| M8 — mutations | En cours | mutations versionnées, politiques et rollback exécutés ; versionnement durable à valider |
| M9 — coupling/telco | En cours | couplage déclaré, occurrences indépendantes et surface telco vérifiés ; autres parcours navigateur à compléter |
| M10 — Demo 4 | En cours | parcours et relais Sighty de Demo 4 validés (Demo 4 : 11/11 ; Sighty : 31/31 ; CodPlay : 650/650), progression live, verrou de navigation rapide et terminalisation Safari validés ; le routage automatique de `sequence:end` reste ouvert côté CodPlay ; les démos 1 à 3 sont différées et non bloquantes |
| M11 — validation complète | En cours | suites (Sighty 30/30, CodPlay 650/650), typechecks, build et smoke Safari Demo 4 validés le 2026-09-16 ; les preuves restantes sont encore à exécuter |
| progression | Plan dédié en cours | projection locale CodPlay par `onProgress` et surface `input`, sans `progress:update` |

Ce plan reste En cours tant que les gates et validations correspondantes ne
sont pas exécutées. Aucun changement de code ne doit être présenté comme
stabilisé avant cette validation.
