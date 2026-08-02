# Sighty : vues, états et avancement

Note de réflexion (2026-08-01). Elle met des mots simples sur une idée : CodPlay
fait vivre une scène dans son espace et son temps; Sighty décide quelles scènes
forment la vue présente et quand cette vue devient une autre.

> **Statut : non normatif.** Cette note aide à choisir les concepts de Sighty.
> Elle ne fixe ni API ni format définitif de scénario; elle emploie un modèle
> informatique simple lorsqu'il éclaire le propos.

## L'idée en une phrase

Sighty décrit des **états de parcours**. Chaque état dit quelles scènes sont
présentes, où elles sont accueillies et ce qu'elles reçoivent à leur entrée.
Lorsque Sighty reçoit un événement, il choisit l'état suivant parmi ceux prévus
par le scénario.

```text
événement reçu -> état de parcours suivant -> nouvelle vue
```

Un état de parcours n'est pas une scène. C'est une **vue composée d'une ou
plusieurs scènes autonomes**.

## Les deux dimensions de Sighty

Une scène CodPlay connaît déjà deux dimensions :

- son espace, par ses persos, son layout et son rendu ;
- son temps, car elle produit son état à un instant `t`.

Sighty travaille à une autre échelle :

| Dimension | Question à laquelle Sighty répond | Exemple |
| --- | --- | --- |
| **Composition** | Quelles scènes sont présentes ensemble et laquelle accueille laquelle ? | Une scène `quiz` est montée dans le perso `content` d'une scène `page-layout`. |
| **Avancement** | Quel événement fait passer d'une vue à une autre ? | `quiz:completed` mène vers `cours-2` ou `rattrapage`. |

La composition n'est pas un placement au pixel. Sighty sait que `quiz` est dans
`page-layout/content`; il ne décide pas de sa position ou de son apparence. Ces
décisions restent dans `page-layout` et `quiz`.

L'avancement n'est pas une nouvelle timeline. Sighty sait qu'une vue vient après
une autre parce qu'un événement est arrivé. Il ne tient pas une horloge commune
aux scènes et ne cherche pas à faire un seek à travers les vues.

## Les données de parcours

Il faut distinguer ces deux dimensions des **données de parcours** : profil,
langue, score, tentatives, activité choisie, réponse d'un utilisateur, etc.

Sighty les conserve pendant le parcours. Une scène peut recevoir certaines de ces
valeurs quand elle est créée :

```text
quiz-1 reçoit à son entrée
  questionSet = données de parcours.questionsChoisies
  attempts    = données de parcours.tentatives
  locale      = données de parcours.langue
```

La scène reçoit alors ses valeurs de départ. Elle ne consulte pas directement les
données vivantes de Sighty pendant qu'elle joue. Cette règle garde les scènes
autonomes et rejouables seules.

## L'état initial d'une vue

Un état de parcours est la description de ce qui doit exister au moment où une
vue devient active. Il répond à trois questions :

1. Quelles instances de scènes faut-il créer ou conserver ?
2. Où chacune est-elle montée : dans une racine fournie par l'application ou dans
   le perso hôte d'une autre scène ?
3. Quelles valeurs reçoit-elle à sa création ?

Pour raisonner, on peut le représenter simplement ainsi :

```text
état de parcours = {
  scènes présentes,
  relations de montage,
  valeurs de départ,
  sorties possibles,
}
```

Cette représentation sert uniquement à séparer les responsabilités. Elle ne dit
pas encore comment ces informations seront écrites dans un fichier ou en code.

Exemple de forme, uniquement pour lire l'intention :

```text
état de parcours "premier-quiz"

  scènes présentes
    page-layout, à la racine "main"
    quiz-1, dans page-layout/content

  valeurs données à quiz-1 à sa création
    questions <- questionsChoisies
    tentatives <- tentatives
    langue <- langue

  sorties possibles
    réussite -> "cours-suivant"
    reprise  -> "rattrapage"
```

Quand cet état devient actif, Sighty crée ou remet en place cette composition.
Ensuite, chaque scène joue son propre déroulement. Sighty n'en réécrit pas les
persos et ne calcule pas son temps.

**Décision à retenir :** les valeurs reçues à la création sont des valeurs de
départ. Elles ne constituent pas un lien permanent entre la scène et Sighty.

## Document minimal : une vue et son avancement

Voici un document minimal pour illustrer la forme d'un scénario. Il ne définit
aucune scène : `page-layout`, `quiz` et `conclusion` sont seulement des
références à des scènes disponibles dans un catalogue extérieur.

La forme est volontairement simple et non normative. Elle montre ce que le
document doit pouvoir exprimer, non les noms définitifs de ses champs.

```ts
const parcours = {
  initial: 'premier-quiz',

  etats: {
    'premier-quiz': {
      vue: {
        scenes: [
          {
            id: 'page',
            scene: 'page-layout',
            mount: { root: 'main' },
          },
          {
            id: 'quiz-1',
            scene: 'quiz',
            mount: { host: 'page/content' },
            input: {
              questions: { from: 'questionsChoisies' },
              tentatives: { from: 'tentatives' },
            },
          },
        ],
      },

      avance: {
        'quiz-1:quiz:completed': {
          decide: 'apresQuiz',
          sorties: {
            reussite: 'conclusion',
            reprise: 'premier-quiz',
          },
        },
      },
    },

    conclusion: {
      vue: {
        scenes: [
          {
            id: 'page',
            scene: 'page-layout',
            mount: { root: 'main' },
          },
          {
            id: 'fin',
            scene: 'conclusion',
            mount: { host: 'page/content' },
            input: {
              score: { from: 'dernierScore' },
            },
          },
        ],
      },
      avance: {},
    },
  },
}
```

À l'entrée dans `premier-quiz`, Sighty monte `page-layout`, puis monte `quiz-1`
dans le perso `content` de cette page. Il fournit les questions et les tentatives
au quiz, puis le laisse jouer seul.

Lorsque le quiz publie `quiz:completed`, la règle `apresQuiz` lit le résultat de
l'événement et choisit l'une des deux sorties déjà écrites : `reussite` ou
`reprise`. Elle peut enregistrer le score et les tentatives dans les données de
parcours, mais elle ne peut pas inventer une troisième destination.

Si elle choisit `reussite`, Sighty construit la vue `conclusion`. Si elle choisit
`reprise`, il reconstruit la vue `premier-quiz` avec les nouvelles valeurs de
départ. La politique exacte de conservation ou de reconstruction de `page` reste
à décider; l'exemple montre seulement le résultat attendu.

## Quatre gestes différents

Les expressions « modifier une vue » ou « réagir à un utilisateur » cachent des
gestes de nature très différente. Les séparer évite de transformer tout
changement en transition ou, au contraire, de laisser Sighty entrer dans le
détail d'une scène.

| Geste | Ce qui change | Qui agit | La vue change-t-elle ? |
| --- | --- | --- | --- |
| **Entrer dans une vue** | La composition initiale est montée et les valeurs de départ sont fournies. | Sighty. | Oui, elle devient active. |
| **Passer à une autre vue** | Une nouvelle composition remplace ou complète la précédente. | Sighty, à partir d'une sortie prévue. | Oui. |
| **Mettre à jour une scène présente** | Une donnée précise d'une scène change. | Sighty envoie un message que la scène a déclaré accepter. | Non. |
| **Interaction utilisateur dans une scène** | La scène traite son propre geste, son état et son temps. | La scène. | Pas forcément. |

### 1. Entrer dans une vue

Sighty résout les valeurs de départ, crée les scènes nécessaires et les monte
dans leurs hôtes. Une scène nouvellement créée commence avec le contrat d'entrée
qui lui a été fourni.

Exemple : entrer dans `premier-quiz` crée `page-layout` et `quiz-1`. Le quiz
reçoit cinq questions et le nombre de tentatives déjà effectuées.

### 2. Passer à une autre vue

Une scène ou l'application produit un événement. L'état de parcours courant dit
quels résultats cet événement peut entraîner. Sighty choisit alors l'une des
sorties prévues et prépare la composition suivante.

Exemple : `quiz-1` publie `quiz:completed` avec un score. Une règle de parcours
choisit `réussite` si le score est suffisant, sinon `reprise`. Elle ne peut pas
envoyer l'utilisateur vers une destination absente du scénario.

Le passage visible entre deux vues reste joué par une scène, par exemple
`page-layout`. Sighty demande la sortie, attend l'événement qui signale sa fin,
puis effectue le changement. Il ne dessine jamais lui-même un fondu ou un
glissement.

### 3. Mettre à jour les données d'une scène déjà présente

Ce geste ne change pas d'état de parcours. Sighty garde la même vue et transmet
une information à une scène active.

Exemple : dans une vue de signalétique, l'application demande de remplacer le
texte et l'image de la promotion. Sighty envoie à la scène `promotion` un message
tel que `promotion:update`. La scène décide comment afficher les nouvelles
données, si elle doit les animer et si son temps courant continue ou non.

Pour que cela reste lisible, une scène doit déclarer ce qu'elle accepte de
recevoir après sa création. Une valeur d'entrée peut donc être dans une de ces
deux catégories :

- **valeur de départ** : elle n'est fournie qu'à la création de la scène ;
- **valeur modifiable** : la scène accepte un message précis pour la modifier
  pendant qu'elle est présente.

La frontière est importante. Une image de fond choisie au montage peut être une
valeur de départ; un prix de promotion peut être une valeur modifiable. Sighty
ne suppose pas que toutes les données soient modifiables.

### 4. Recevoir une interaction utilisateur

Un geste qui a lieu dans une scène est d'abord traité par cette scène. Un clic
sur une réponse de quiz, un glisser-déposer ou le réglage d'un curseur n'a pas à
sortir vers Sighty si son effet reste local.

La scène avertit Sighty seulement si le résultat concerne le parcours : réponse
terminée, score calculé, demande de quitter, choix d'une branche, etc. Elle émet
alors un événement public. Sighty peut l'écouter et décider de conserver une
donnée de parcours, de mettre à jour une autre scène ou de passer à une autre
vue.

```text
utilisateur
  -> scène de quiz traite la réponse
  -> la scène publie éventuellement "quiz:completed"
  -> Sighty choisit éventuellement la suite du parcours
```

Une action utilisateur qui vient de l'application plutôt que d'une scène suit le
chemin inverse : l'application demande à Sighty de changer de vue ou d'envoyer
un message à une scène. La scène n'a pas besoin de connaître l'application ou
les autres scènes.

## Le moteur d'avancement, simplement

Le moteur d'avancement fait toujours la même chose :

1. Il reçoit un événement de l'application ou d'une scène encore présente.
2. Il regarde les sorties prévues par l'état de parcours actuel.
3. Il applique, si besoin, une règle simple sur les données reçues.
4. Il passe vers l'état choisi et met en place la nouvelle vue.

Il y a deux précautions pratiques à garder en tête :

- les montages, chargements et sorties visuelles peuvent prendre du temps ;
- un événement envoyé par une scène qui vient d'être retirée ne doit plus avoir
  d'effet sur la vue actuelle.

Ce sont des détails de fonctionnement à résoudre plus tard. Ils n'ajoutent pas
un nouveau concept au scénario : ils garantissent seulement que le passage d'une
vue à la suivante reste fiable.

## Ce qui est déjà posé, ce qui est précisé

La note Sighty existante pose déjà les points essentiels : Sighty est une machine
à états, pas une fonction du temps; les scènes ne se parlent pas directement; le
scénario est un graphe de situations possibles; les calculs restent hors du
graphe; et les données de parcours sont injectées en lecture seule dans les
scènes.

La présente note précise seulement :

- appeler **état de parcours** une situation du scénario, plutôt que `node` ;
- faire apparaître, dans chaque état, la composition des scènes, leurs hôtes et
  leurs valeurs de départ ;
- distinguer nettement l'entrée dans une vue, le passage vers une autre, la mise
  à jour d'une scène en place et l'interaction locale de l'utilisateur.

## Le modèle de machine à états

Le précédent exécutable le plus proche est une **machine XState qui invoque des
acteurs selon son état actif**. Une scène CodPlay se rapproche alors d'un acteur
indépendant : elle reçoit des messages, garde son état interne et émet des
événements sans que l'orchestrateur entre dans son détail.

Dans XState, un acteur invoqué est créé quand son état parent devient actif et
arrêté quand cet état est quitté. Il reçoit des valeurs à son entrée et peut
renvoyer des événements. C'est la forme concrète de la vue Sighty :

| XState avec acteurs invoqués | Sighty |
| --- | --- |
| Un état de la machine devient actif. | Un état de parcours devient la vue présente. |
| Cet état invoque une liste connue d'acteurs. | Cet état monte une liste connue d'instances de scènes. |
| Chaque acteur reçoit un `input` à sa création. | Chaque scène reçoit ses valeurs de départ. |
| Un acteur renvoie un événement au parent. | Une scène publie un événement public à Sighty. |
| La sortie de l'état arrête ses acteurs invoqués. | Le passage de vue arrête, conserve ou remplace les scènes selon la politique retenue. |

La documentation [XState `invoke`](https://stately.ai/docs/invoke) est donc la
référence pratique à lire. Elle montre un état qui invoque un ou plusieurs
acteurs, leur passe des entrées, attend leur résultat ou leur erreur, et les
arrête à la sortie de l'état. Le
[workflow « car vitals »](https://github.com/statelyai/xstate/tree/main/examples/workflow-car-vitals)
est un exemple exécutable où un état coordonne plusieurs acteurs connus.

Sighty n'est toutefois pas la transposition directe de `invoke` :

- XState tient directement des références vers ses acteurs enfants; Sighty doit
  tenir des adresses d'instances et déléguer leur création au moteur CodPlay ;
- XState ne connaît pas le montage visuel; Sighty ajoute la relation « cette
  scène est hébergée par ce perso d'une autre scène » ;
- XState arrête normalement un acteur en quittant son état; Sighty doit encore
  décider, cas par cas, quelles scènes sont conservées ou suspendues.

Le graphe de montage est donc l'apport propre à Sighty. Il s'ajoute à ce modèle
d'invocation, sans changer l'autonomie des scènes.

Les données de parcours et le choix d'une sortie correspondent au second aspect,
plus simple, d'une machine à états avec contexte : un événement reçu et les
données disponibles déterminent l'une des sorties déjà prévues. Cette partie ne
permet jamais à une règle de créer une destination nouvelle; le parcours reste
visible dans le scénario.

Référence interne :
[`2026-07-28-sighty-premiere-intention.md`](./2026-07-28-sighty-premiere-intention.md).

## Questions à décider plus tard

1. Quand une vue change, quelles scènes sont arrêtées, mises en pause ou
   conservées ?
2. Comment une scène décrit-elle ses valeurs de départ et les messages qu'elle
   accepte pendant sa présence ?
3. Si la nouvelle vue tarde à être prête, que laisse-t-on visible : la vue
   précédente, un interlude, ou autre chose ?
4. Une modification faite par un auteur dans l'éditeur est-elle une mise à jour
   simple ou une reconstruction de vue ? Ce cas est distinct du parcours normal
   d'un utilisateur.

## Statut

Note de travail, non normative. Sighty reste un client de CodPlay : il ne rend
rien lui-même, ne possède pas de timeline globale et n'entre pas dans l'état
interne des scènes.
