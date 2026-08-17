# Sighty — synthèse et modèle de fichier déclaratif

**Statut : réflexion non normative.** Cette note reformule les notes du
2026-07-28 et du 2026-08-01 à partir des réflexions sur la structure du fichier
Sighty. Elle ne fixe pas encore une API ni un format définitif.

## 1. Objet de la note

Sighty doit décrire et conduire un parcours composé de scènes. Il doit pouvoir :

- monter une vue composée d'une ou plusieurs scènes ;
- faire évoluer cette vue à la suite d'un événement ;
- choisir une variante selon des données et des conditions ;
- conserver un état de parcours ;
- injecter des données dans les scènes présentes ;
- recevoir des événements provenant des scènes, de l'utilisateur ou d'une
  application extérieure ;
- rester à l'écoute sans nécessairement faire avancer automatiquement un
  scénario.

La difficulté vient du fait que ces usages doivent avoir un même modèle. Un
scénario fermé, un parcours avec configuration et un scénario entièrement
événementiel ne doivent pas devenir trois formats différents.

## 2. Synthèse des réflexions

### Les ressources

Le fichier Sighty manipule trois familles de données :

- les scènes disponibles ;
- les vues, qui forment le graphe récursif des scènes et de leurs relations de
  montage ;
- les données dynamiques nécessaires au parcours.

Dans le fichier, les scènes et les données sont référencées dans `resources`.
Les vues sont décrites séparément par le graphe `views`.

Une scène reste autonome. Une vue indique quelles scènes sont présentes, dans
quels slots elles sont montées et quelles données elles reçoivent. Une vue ne
doit pas être confondue avec la surface visible de l'application : dans Sighty,
elle désigne la composition de scènes.

### Les événements

Les transitions sont toujours déclenchées par des événements. Un événement peut
provenir :

- de la fin d'une scène ou d'une séquence ;
- d'une action de l'utilisateur dans une scène ;
- de l'application extérieure, d'un éditeur ou d'un planificateur.

L'événement ne contient pas la décision de parcours. Il exprime un fait ou une
intention. Le scénario actif décide de l'action à réaliser, de la modification
éventuelle des données et de la destination suivante.

Par conséquent, `navigation:next` ne signifie pas toujours « aller à la vue
suivante ». Dans une vue donnée, il peut conduire à la vue suivante, remonter au
graphe parent ou retourner au menu. Cette signification appartient au scénario
actif.

### Les scénarios

Les formes évoquées dans les notes sont des usages différents d'un même graphe
récursif :

- un scénario fermé suit une chaîne de vues ;
- un scénario hiérarchique descend dans les graphes contenus par les vues ;
- un scénario à variantes choisit un chemin selon une configuration ou une
  auto-évaluation ;
- un scénario dynamique associe les passages à des événements ;
- un scénario en écoute peut recevoir des événements sans changer de vue.

Le parcours suit l'index lorsqu'il est représenté par un tableau `[]`. Lorsqu'il
est représenté par un objet, il est événementiel. À la fin d'un graphe, la
recherche de la suite remonte par la hiérarchie des actions des vues parentes,
jusqu'au niveau supérieur, avec application des valeurs par défaut. Des
instructions explicites permettent aussi d'aller au suivant, au précédent, vers
un parent, vers un enfant ou vers une position identifiée par un label.

Ces instructions restent des éléments déclaratifs du fichier. Elles ne doivent
pas être découvertes par une fonction d'action qui inventerait une destination.

### Les vues et les scènes

Une vue est un noeud d'un graphe de vues. Chaque noeud peut porter :

- une scène ;
- des données d'entrée ;
- des métadonnées ;
- des slots contenant à leur tour un graphe de vues ;
- un graphe enfant lorsque le noeud ouvre un niveau supplémentaire du graphe.

Dans l'exemple retenu, la vue principale est une scène layout qui possède trois
slots : `titre`, `cours` et `telco`. Le slot `cours` contient un graphe de vues.
Ce graphe contient des chapitres, et chaque chapitre contient un graphe de pages.
Chaque page est une scène.

Une vue principale peut donc être représentée ainsi :

```text
menu
└── vue principale : scène layout
    ├── slot titre : scène titre
    ├── slot cours
    │   ├── chapitre 1
    │   │   ├── page 1 : scène
    │   │   └── page 2 : scène
    │   └── chapitre 2
    │       └── page 1 : scène
    └── slot telco : scène telco
```

La page menu appartient au niveau supérieur. Elle peut désigner directement une
page du graphe contenu dans `main/cours`, par sa position ou par un label.

La télécommande ne parle pas directement à la scène de contenu : elle adresse
une intention à Sighty, puis le scénario décide quelle vue du graphe `cours`
devient active et quelle commande envoyer à la scène concernée.

Les métadonnées des vues actives peuvent être fusionnées en une meta effective
et injectées dans les scènes concernées. Dans l'exemple du quiz, la scène titre
peut ainsi recevoir le titre et le numéro de la page actuellement montée dans le
graphe `cours`.

### Les actions et les guards

Le graphe de vues peut associer un événement reçu à une action. L'action de
transition peut avoir accès aux données du parcours et à l'événement reçu. Elle
peut :

- modifier les données du parcours selon les règles du scénario ;
- produire un nouvel événement traité dans le même cycle ;
- demander l'envoi d'un événement à une scène active ;
- choisir une sortie déclarée lorsque les conditions l'autorisent.

Les guards vérifient les conditions du choix. Ils lisent les données et ne les
modifient pas.

Le fichier ne contient pas le corps des fonctions si le fichier doit rester
sérialisable. Il contient des références d'actions et de guards. Le catalogue
d'actions associé fournit les fonctions d'action ; l'application fournit les
fonctions de guard référencées par les vues.

La façade de Sighty propose des helpers pour les modifications courantes, en
particulier la navigation. Ces helpers restent une commodité au-dessus du
modèle événementiel ; le prototype permettra de préciser ceux qui sont
réellement utiles.

## 3. Vocabulaire proposé

Le vocabulaire suivant évite de donner plusieurs sens au même mot :

| Terme | Sens dans Sighty |
|---|---|
| `scene` | Scène disponible que Sighty peut monter et piloter |
| `view` | Graphe de scènes montées, avec données et métadonnées associées |
| `slot` | Emplacement déclaré par une scène pour accueillir une autre scène ou une vue |
| `scenario` | Parcours du graphe de vues, avec ses actions, guards et transitions |
| `meta` | Donnée descriptive associée à une vue et transmissible à ses scènes |
| `context` | Données du parcours conservées pendant son exécution |
| `state` | Position courante, données du parcours et informations nécessaires à la reprise |

Le mot `view` ne désigne donc ni le viewport de l'application ni une scène
isolée. Une vue est la composition déclarée de scènes.

## 4. Forme déclarative proposée

Le fichier doit être compréhensible sans exécuter le scénario. Une première forme
de travail peut rester proche des termes des notes :

```ts
type SceneId = string
type ViewId = string
type DataId = string
type ActionReference = string
type GuardId = string
type GuardReference = string
type EventName = string
type SlotName = string
type SceneReference = string
type DataReference = string

type SightyFile = {
  format: "sighty"
  version: number
  id: string

  resources: {
    scenes: Record<SceneId, SceneReference>
    data: Record<DataId, DataReference>
  }

  views: ViewGraph
}

type ViewScope = {
  actions?: Record<EventName, ViewAction>
  guards?: Record<GuardId, GuardReference>
}

type ViewGraph = ViewList | ViewMap

type ViewList = ViewDefinition[]

type ViewMap = ViewScope & {
  start: ViewId
  views: Record<ViewId, ViewDefinition>
}

type ViewDefinition = ViewScope & {
  data?: Record<string, DataBinding>
  meta?: Record<string, DataValue | DataBinding>
  access?: ViewAccess
  view: ViewContent
}

type ViewContent = {
  scene?: SceneId
  slots?: Record<SlotName, ViewGraph>
  graph?: ViewGraph
}

type ViewAction = {
  action?: ActionReference
  go?: RouteTarget
}

type ViewAccess = {
  guard: GuardId
  onDenied?: RouteTarget
}

type RouteTarget =
  | { path: string }
  | { label: string }
  | { direction: ViewDirection }

type ViewDirection = "next" | "previous" | "up" | "down"
```

`ViewList` est parcouru par index. `ViewMap` est parcouru par les événements et
les actions déclarés dans ses vues.

Cette forme est une proposition de fichier d'auteur. Elle ne cherche pas à
reproduire les objets ou les étapes de fonctionnement de la machine. Elle donne
à l'auteur un graphe récursif de vues, des actions et des guards.

Dans cette forme, une vue possède toujours un champ `view`. Ce champ peut
combiner une scène et un graphe enfant :

- `view.scene` signifie que la vue est portée par une scène ; cette scène peut
  déclarer des slots contenant des graphes enfants ;
- `view.graph` signifie que la vue contient un autre niveau du graphe ; ce niveau
  peut être parcouru sans scène propre ou être associé à la scène portée par la
  vue ;
- les `meta` des vues actives peuvent être fusionnées et injectées dans les
  scènes ;
- `access.guard` conditionne l'entrée dans la vue ;
- une page est une vue dont `view.scene` désigne la scène de la page ;
- un chapitre peut être une vue dont `view.graph` contient les pages ;
- la vue principale est une vue dont `view.scene` désigne la scène layout et
  dont les slots contiennent les graphes `titre`, `cours` et `telco`.

Les vues ne sont donc pas un catalogue plat de compositions. `views` est le
graphe récursif du fichier. La partie `resources` contient les références vers
les scènes et les données employées par ce graphe.

Les actions et les guards peuvent être déclarés dans une vue ou dans un
`ViewGraph`. Ils sont alors applicables à cette vue et à ses descendants :

```json
{
  "guards": {
    "passed": "quizHunt.passed"
  },
  "actions": {
    "quiz:selected": {
      "action": "quizHunt.selectQuestion",
      "go": { "path": "main/cours" }
    }
  }
}
```

Le nom de gauche est local à la portée de la vue ou du graphe. La valeur de
droite permet à l'application de fournir la fonction. Le fichier reste ainsi
stockable, inspectable et transmissible.

Une vue enfant cherche d'abord une action ou un guard dans sa propre définition,
puis dans le `ViewGraph` qui la contient, puis dans la vue et le graphe parents,
en remontant jusqu'à la racine. Une définition locale portant le même nom
remplace celle du niveau supérieur ; elle ne s'ajoute pas à celle-ci.

`GuardId` est le nom local utilisé par `access.guard`. `GuardReference` est la
référence vers la fonction fournie par l'application.

Le guard est atteint lorsqu'une route tente d'entrer dans une vue qui le
référence dans `access` :

```json
{
  "views": {
    "success": {
      "access": {
        "guard": "passed",
        "onDenied": { "path": "main/cours/chapter-1/retry" }
      },
      "view": { "scene": "scene-success" }
    }
  }
}
```

Le parcours est alors explicite :

```text
quiz:completed
    -> le scénario désigne la vue success
    -> Sighty lit success.access.guard
    -> Sighty cherche passed dans les portées actives
    -> quizHunt.passed est exécuté avec le contexte et l'événement
    -> true  : la vue success est accessible
    -> false : la route onDenied est suivie
```

Le guard conditionne donc l'accès à une vue. Il ne constitue pas une action
atteinte directement par un événement et il ne choisit pas une destination que
le graphe ne déclare pas.

Extrait correspondant à l'exemple :

```json
{
  "views": {
    "start": "menu",
    "views": {
      "menu": {
        "view": { "scene": "scene-menu" },
        "actions": {
          "open-page": {
            "action": "quizHunt.openPage",
            "go": { "path": "main/cours/chapter-1/page-2" }
          }
        }
      },
      "main": {
        "guards": {
          "passed": "quizHunt.passed"
        },
        "view": {
          "scene": "scene-layout-main",
          "slots": {
            "titre": {
              "start": "titre",
              "views": {
                "titre": { "view": { "scene": "scene-titre" } }
              }
            },
            "cours": {
              "start": "chapter-1",
              "views": {
                "chapter-1": {
                  "view": {
                    "graph": {
                      "start": "page-1",
      "views": {
        "page-1": { "view": { "scene": "scene-page-1" } },
        "page-2": {
          "access": { "guard": "passed" },
          "view": { "scene": "scene-page-2" }
        }
      }
                    }
                  }
                }
              }
            },
            "telco": {
              "start": "telco",
              "views": {
                "telco": { "view": { "scene": "scene-telco" } }
              }
            }
          }
        }
      }
    }
  }
}
```

Le champ `path` sert ici uniquement à exprimer l'accès direct demandé par le
menu. La syntaxe exacte de la position reste à décider ; elle devra pouvoir
être remplacée par un label lorsque les identifiants de position ne suffisent
pas.

## 5. Vues statiques et vues vivantes

Une vue statique reçoit ses données lorsqu'elle est montée. Une vue vivante
reçoit aussi des mises à jour pendant qu'elle est active.

Il est préférable de qualifier chaque donnée plutôt que toute la vue :

```ts
type DataBinding = {
  from: string
  update: "entry" | "live"
  event?: EventName
}
```

Dans cet exemple :

```json
{
  "data": {
    "question": {
      "from": "context.questionCourante",
      "update": "entry"
    },
    "title": {
      "from": "meta.title",
      "update": "live",
      "event": "title:update"
    }
  }
}
```

`entry` signifie que la valeur est résolue lorsque la vue est montée. Il n'y a
alors aucun lien permanent entre la scène et le contexte Sighty.

`live` signifie que Sighty réévalue la valeur lorsque sa source change et envoie
la nouvelle valeur à la scène au moyen de l'événement indiqué. La scène doit
connaître cet événement et décider comment l'interpréter.

Cette forme de binding est conservée pour le moment.

## 6. Injection dans une scène

L'injection d'une donnée suit ce cycle :

1. Le scénario choisit une vue ou reçoit une demande de mise à jour.
2. Sighty résout les bindings de la vue à partir du contexte, de la meta
   effective et, si nécessaire, des données de l'événement reçu.
3. Sighty construit les données destinées à chaque scène.
4. À la création, la scène reçoit ses données initiales dans son interface
   d'entrée.
5. Pour une donnée `live`, Sighty envoie ensuite un événement de mise à jour à
   la scène concernée lorsque la valeur change.

Exemple de montage initial :

```text
context.questionCourante
        ↓ résolution du binding
question.data = { question: ... }
        ↓ entrée de la vue
scene quiz reçoit ses données initiales
```

Exemple de mise à jour :

```text
une vue enfant entre dans le graphe course
        ↓
les meta actives sont fusionnées
        ↓
la meta.title effective change
        ↓ mise à jour de la scène déjà montée
Sighty envoie title:update à la scène titre
        ↓
la scène titre choisit son affichage ou son animation
```

Sighty ne modifie pas directement l'état interne de la scène. Il fournit une
donnée initiale ou envoie un événement que la scène a déclaré accepter.

Le même mécanisme permet de traiter une donnée provenant de l'extérieur :

```text
application -> événement reçu par le scénario
           -> action et guard éventuels
           -> transition de vue
           -> mise à jour du contexte
           -> bindings live concernés
           -> événements de mise à jour aux scènes actives
```

## 7. State et context

La distinction reste à préciser, mais la séparation suivante paraît cohérente
avec les notes :

- le `context` contient les données durables du parcours : profil, score,
  tentatives, pages lues, choix et signaux partiels ;
- le `state` contient la vue ou la position courante, ainsi que les informations
  nécessaires pour reprendre le parcours.

Le contexte ne doit pas être modifié directement par une scène. Il n'est
modifiable que lors d'une transition de vue. L'action de transition reçoit le
state et peut proposer la mise à jour du context. Les guards ne peuvent pas
écrire.

Une action sans destination peut éventuellement envoyer une commande à une
scène, mais elle ne peut pas modifier le contexte.

Le chargement et l'enregistrement d'un état sont des opérations de Sighty et de
l'application qui l'entoure. Ils ne doivent pas être confondus avec une donnée
injectée dans une scène.

## 8. Contrat minimal du premier prototype

La note fixe l'intention du modèle, mais les contrats exécutables suivants sont
encore nécessaires pour lancer un premier prototype.

### Manques à définir

1. **Données initiales**
   - contexte initial ;
   - vue de départ ;
   - forme exacte d'une scène référencée ;
   - données dynamiques disponibles.

2. **Contrat des événements**
   - nom ;
   - données associées ;
   - origine éventuelle ;
   - règle de prise en compte par les vues actives.

3. **Contrat des actions et des guards**
   - données reçues par une action ;
   - forme de sa modification du contexte ;
   - forme d'un événement produit ;
   - forme d'un envoi à une scène ;
   - résultat d'un guard ;
   - résolution des actions et guards hérités.

4. **Entrée et sortie d'une vue**
   - montage d'une nouvelle scène ;
   - maintien ou remplacement d'une scène parente ;
   - démontage d'une vue ;
   - comportement synchrone pour le prototype.

5. **Fusion des meta**
   - ordre de fusion ;
   - valeur prioritaire en cas de clé identique ;
   - objet effectivement injecté à l'entrée ;
   - événement envoyé à une scène déjà montée lorsque la meta change.

6. **Fin d'un graphe**
   - action parent recherchée ;
   - comportement lorsqu'aucune action parent ne répond ;
   - définition précise des valeurs par défaut.

7. **State et sauvegarde**
   - forme minimale du state courant ;
   - contenu du contexte initial ;
   - forme d'un état sauvegardé ;
   - restauration d'une vue imbriquée.

8. **Façade minimale**
   - charger ;
   - démarrer ;
   - recevoir un événement ;
   - lire l'état ;
   - sauvegarder et restaurer ;
   - naviguer vers une vue.

### Parcours de validation

Le premier cas de validation devrait contenir :

```text
menu
└── main : scène layout
    ├── titre
    ├── cours
    │   └── chapitre
    │       ├── page 1
    │       └── page 2
    └── telco
```

Il devrait vérifier :

- l'accès direct du menu à `page 2` ;
- le parcours par index d'une liste de pages ;
- le passage événementiel entre menu et vue principale ;
- un guard autorisant ou refusant une page ;
- la fusion des meta de la page dans la scène titre ;
- l'héritage puis le remplacement d'une action par une vue enfant ;
- la modification du contexte uniquement lors d'une transition ;
- la sauvegarde et la restauration du parcours.
