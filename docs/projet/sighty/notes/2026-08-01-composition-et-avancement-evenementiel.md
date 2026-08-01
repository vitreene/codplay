# Sighty : composition de scènes et avancement événementiel

Note d'annotation (2026-08-01). Elle formalise une intuition de travail : une
scène CodPlay connaît un espace et un temps, tandis que Sighty tient des
configurations de scènes et avance entre elles en réponse à des événements.

> **Statut : non normatif.** Cette note ne modifie pas l'esquisse de Sighty. Elle
> rend explicites des distinctions nécessaires pour continuer le raisonnement et
> identifie ce qui reste à spécifier.

## 1. Thèse

Sighty ne doit pas être une timeline qui surplomberait les timelines CodPlay. Il
est une **machine à états étendue et événementielle** :

- un état déclaré décrit une **composition** de scènes montées simultanément ;
- les événements reçus sélectionnent une sortie déclarée de cet état ;
- l'avancement réalise la composition suivante ;
- un contexte vivant fournit des valeurs à l'entrée des scènes et conserve les
  résultats dont la suite a besoin.

La formule compacte est :

```text
événement + node actif + contexte -> décision -> composition suivante
```

Le mot « temporel » doit être manié avec précision. Sighty ordonne un avant et
un après **causaux**, mais ne tient pas un temps métrique. Le temps `t` demeure
local à chaque instance CodPlay. Une scène continue à être `f(t)`; Sighty décide
quand elle est montée, arrêtée, commandée ou remplacée.

## 2. Trois plans, pas seulement deux axes

L'intuition initiale distingue deux axes. Elle tient, à condition d'ajouter le
plan de données qui les relie.

| Plan | Ce que Sighty décrit ou possède | Ce qu'il ne possède pas |
| --- | --- | --- |
| **Composition** | Les instances présentes, leur relation de montage, leur racine ou perso hôte, et leurs entrées à l'instanciation. | Le rendu, les coordonnées pixel et le graphe de persos interne à une scène. |
| **Contrôle causal** | Les nodes, sorties et transitions déclenchées par des événements. | Une horloge, un eventime global ou un seek entre nodes. |
| **Contexte** | Les données vivantes de l'œuvre : profil, score, tentatives, sélection, résultat d'interaction. | La vérité interne d'une scène ou son état visuel à `t`. |

La « spatialité » de Sighty est donc **topologique**, non géométrique :
`quiz` est monté dans `page-layout/content`, pas à la coordonnée `(x, y)`. Le
layout et les coordonnées restent dans la scène qui héberge.

Le contexte n'est pas un troisième axe narratif. C'est un **plan de données** :
il alimente une composition au montage et est amendé par les décisions de la
machine.

## 3. Quatre états à distinguer

Le mot « état » recouvre quatre choses qu'il faut nommer séparément.

| Nom | Nature | Exemple |
| --- | --- | --- |
| **Node de scénario** | Déclaration stable, sérialisable. | `c1-quiz` décrit les instances qui doivent être présentes. |
| **Composition active** | Réalisation runtime de ce node. | Le layout est prêt, le quiz est monté dans son hôte. |
| **État de scène** | État CodPlay, local à une instance et évalué à son `t`. | Le quiz affiche sa question à 4 200 ms. |
| **Contexte Sighty** | Données durables de parcours. | `{ attempts: [45, 80], profile: 'beginner' }`. |

Cette distinction interdit deux raccourcis : Sighty ne lit pas l'état visuel
d'une scène pour prendre une décision, et une scène ne lit pas directement le
contexte vivant de Sighty pour se mettre à jour.

## 4. Le node comme composition déclarée

L'esquisse existante décrit déjà un node comme un état de machine et porte une
liste `instances`. La précision à ajouter est que le node doit aussi contenir la
**configuration de montage** et les **entrées d'instanciation** de ces instances.

La déclaration globale d'une instance conserve son identité et sa référence au
catalogue de scènes. Le node en décrit l'emploi dans une composition donnée.

```ts
type NodeComposition = {
  members: string[]
  mounts: Record<string, MountTarget>
  inputs: Record<string, Record<string, InputBinding>>
}

type MountTarget =
  | { root: string }
  | { instance: string; host: string }

type InputBinding =
  | { value: unknown }
  | { context: string }
  | { event: string }
  | { resolver: string }
```

Cette forme est illustrative, non une API. Les deux principes sont en revanche
structurants :

1. La relation de montage doit former une forêt valide : une instance a une
   racine ou un hôte, aucun cycle n'est permis, et l'hôte doit appartenir à une
   instance présente dans la même composition.
2. Une entrée est résolue **au montage**. La scène reçoit un snapshot de ses
   valeurs initiales; elle ne tient pas de référence vivante vers le contexte de
   Sighty.

Un changement de valeur après le montage reste possible, mais doit emprunter une
commande ou un événement de la surface publique de la scène. Il ne devient pas
une synchronisation implicite de state à state.

### Exemple

```text
node "c1-quiz"

composition
  page-layout  -> racine "main"
  quiz-1       -> page-layout/content

inputs de quiz-1 au montage
  questionSet  <- context.selectedQuestions
  attempts     <- context.attempts
  locale       <- context.locale
```

La composition ne dit pas comment `page-layout` positionne `content`, ni comment
`quiz-1` anime la question. Ces décisions restent intégralement dans les scènes.

## 5. Le moteur d'avancement

Le moteur comporte deux responsabilités à séparer : décider, puis réaliser. La
première est un réducteur déterministe; la seconde interprète un plan de cycle de
vie nécessairement asynchrone.

```text
event public
  -> routage vers le node actif
  -> décision : sortie déclarée, patch de contexte, commandes éventuelles
  -> plan de transition entre compositions
  -> arrêt, montage, injection, attente de disponibilité
  -> nouvelle composition stable
```

La décision peut se décrire ainsi :

```ts
type TransitionDecision = {
  take?: string
  contextPatch?: Record<string, unknown>
  commands?: SceneCommand[]
}

function decide(
  node: Node,
  context: Readonly<Context>,
  event: PublicEvent,
): TransitionDecision
```

Un handler nommé peut calculer une note, accumuler une tentative ou faire une
conjonction de fins. Il ne peut choisir que l'un des noms de `node.out`. Le
graphe demeure ainsi entièrement inspectable dans la donnée : aucun code ne peut
inventer sa destination.

L'interpréteur transforme ensuite cette décision en opérations concrètes :

- conserver, suspendre, arrêter ou détruire les instances de la composition
  sortante, selon la politique de survie retenue ;
- évaluer les entrées des nouvelles instances ;
- construire et monter les nouvelles instances ;
- attendre leurs événements de disponibilité ou la fin d'une transition jouée
  par une scène hôte ;
- marquer le node cible comme stable.

Il ne faut pas confondre ce protocole avec les nodes auteur. `leaving` et
`entering` sont des **phases runtime internes** d'une transition, alors qu'un node
du scénario est une configuration stable que l'auteur peut voir et viser.

## 6. Événements et exécutions vivantes

Sighty reçoit deux familles d'événements dans le même format :

- les événements publics émis par une instance de scène ;
- les commandes et intentions reçues de l'application qui pilote Sighty.

Le moteur doit conserver une identité d'exécution par instance montée. Un event
provenant d'une ancienne exécution de `quiz-1`, arrêtée pendant une transition,
ne doit jamais faire avancer le node courant. Cette identité est une déduction du
cycle de vie asynchrone; elle ne demande pas de changer le contrat public de
l'event, seulement son routage interne.

## 7. Position parmi les modèles connus

Le nom le plus précis est **machine à états finis étendue, événementielle**
(*extended event-driven finite-state machine*) :

- le graphe fini des nodes est le contrôle ;
- le contexte rend l'état extensible par des données de parcours ;
- les events déclenchent les transitions ;
- les handlers nommés sont les calculs admis à la frontière déclaratif /
  impératif.

Le modèle est voisin d'un *statechart*, mais il ne faut pas en adopter d'emblée
toute la sémantique. La présence de plusieurs scènes dans une composition ne
signifie pas nécessairement qu'il existe plusieurs régions concurrentes : elles
peuvent former un seul état de composition. Hiérarchie, historique et concurrence
de statechart ne devront être introduits que si un cas les exige.

Le couple `décision pure + interprète d'effets` est le bon découpage
d'implémentation : il rend la logique de parcours testable sans player tout en
laissant à l'interpréteur les montages, préchargements et arrêts réels.

## 8. Rapport avec le corpus actuel

Cette annotation ne contredit pas les conclusions existantes :

- Sighty est déjà posé comme une machine à états, non une fonction du temps.
- Un node est déjà l'état qui dit ce qui est monté, et ses sorties sont les
  arêtes du graphe.
- Le scénario reste sérialisable; les calculs sont nommés à côté sous forme de
  handlers, qui ne peuvent sélectionner qu'une sortie déclarée.
- Le contexte central est déjà vivant et injecté en lecture seule dans les
  scènes.
- Les scènes ne communiquent pas directement : elles émettent, le scénario
  traduit et Sighty commande.

La contribution de cette note est de rendre visible le sous-graphe de composition
dans chaque node, de donner une sémantique de snapshot aux entrées de scène, et
de séparer explicitement le choix d'une transition de son exécution asynchrone.

Référence :
[`2026-07-28-sighty-premiere-intention.md`](./2026-07-28-sighty-premiere-intention.md),
en particulier §0-§1 (nature), §4 (responsabilités) et §7 (esquisse de scenario).

## 9. Questions ouvertes

1. **Politique de survie.** Au passage vers un node voisin, quelles instances
   sont détruites, suspendues ou réemployées ? Cette politique conditionne le
   calcul du plan de transition.
2. **Surface d'entrée.** Quelles entrées une scène déclare-t-elle recevables au
   montage et, séparément, modifiables après montage ?
3. **Moment d'évaluation.** Une entrée peut-elle dépendre uniquement du contexte,
   ou aussi de l'événement qui a déclenché la transition et d'un résolveur nommé ?
4. **Atomicité.** À quel moment le patch de contexte est-il visible : avant le
   montage, après toutes les disponibilités, ou selon une transaction à définir ?
5. **Échec.** Que devient la composition si une scène exigée est indisponible ou
   échoue à monter : maintien de l'état précédent, interlude, sortie d'erreur ?
6. **Hiérarchie.** Les chapitres et séquences sont-ils de simples structures de
   scénario, ou devront-ils devenir des états composites ?

## Statut

Note de travail, non normative. Elle complète l'intention Sighty sans en modifier
le périmètre : Sighty demeure un client de CodPlay, sans rendu propre, sans
timeline globale et sans accès à l'état interne des scènes.
