# Quiz question spec V1 - generateur, composants et orchestration

## Statut

Spec de travail pre-implementation.

Ce document fige la tranche de travail courante avant developpement.
Il pourra etre enrichi par remarques complementaires avant codage.

## Objectif

Definir une premiere implementation de questionnaire dans Codplay autour de trois axes:

- un generateur de question unitaire
- une scene qui enchaine ensuite les questions une par une
- une base de composants runtime adaptee au rendu de formulaire et au feedback de correction

## Perimetre V1

Cette spec couvre:

- un generateur qui produit la structure runtime d'une seule question
- l'entree d'une question par event `quiz:question:show`
- la validation utilisateur via un bouton `Valider`
- l'affichage du resultat `Correct` ou `Incorrect`
- l'affichage conditionnel d'un bouton `Suivant`
- l'emission de l'event metier de reponse
- l'emission de l'event de passage a la question suivante
- l'agregation scene-level des resultats avec `console.log`
- l'animation d'entree/sortie horizontale de la question

Cette spec ne couvre pas encore:

- la scene finale de score
- le detail du rendu de progression visible a l'ecran
- le message distinct `faux` vs `incomplet`
- le verrouillage normatif post-validation des inputs

## Principes retenus

1. Le questionnaire n'est pas un module moteur generique bas niveau.
2. Le questionnaire est produit comme une composition `scene/story/persos/straps`.
3. La logique metier reste dans les `straps` et dans l'etat story/scene.
4. Le rendu interactif doit s'appuyer sur de vrais elements HTML de formulaire quand cela est utile.
5. Les conventions de nommage d'events restent alignees sur le projet, avec `:`.
6. Les composants n'imposent pas de style par defaut; le style provient des persos et du code generateur.
7. Les styles statiques doivent preferer des classes CSS; les styles inline restent reserves aux parties dynamiques.
8. Les interactions locales entre persos d'une meme story restent locales et n'utilisent pas `cascade`.
9. La logique metier questionnaire reste dans les `straps` et dans le code qui genere les stories.

## Tranche de depart

La tranche a developper en premier est la suivante:

- une question affichee seule
- type `single`
- selection utilisateur
- bouton `Valider` desactive tant qu'aucune reponse n'est selectionnee
- evaluation exacte de la reponse
- affichage du resultat
- apparition du bouton `Suivant`
- emission des events de reponse et de passage

Le generateur prendra deja une question resolue, afin de preparer l'enchainement futur par tableau de questions.

La V1 retient des la tranche initiale deux composants runtime dedies:

- `input`
- `form`

Le composant `input` peut etre realise avant `form` dans l'ordre de construction technique, mais `form` fait partie du perimetre obligatoire de la V1.

## Types de question cibles

Le modele cible du questionnaire admet trois types:

- `boolean`
- `single`
- `multiple`

Regles:

- `boolean`: deux options generees par le generateur a partir de labels configurables ou par defaut
- `single`: une seule reponse correcte, une seule selection utilisateur autorisee
- `multiple`: une ou plusieurs reponses correctes, plusieurs selections utilisateur autorisees

Pour `multiple`, un texte de rappel doit etre affiche:

- `Plusieurs reponses possibles`

## Resolution des questions

L'event d'entree de la question transporte une question deja resolue.

Cela signifie que:

- l'index de la question est deja connu
- les labels finaux sont deja connus
- les reponses affichees sont deja materialisees
- dans le cas `boolean`, les deux reponses ont deja ete derivees par le generateur

## Contrat de donnees canonique

```ts
type QuizQuestionType = 'boolean' | 'single' | 'multiple'

type QuizAnswer = {
  id: string
  label: string
  isCorrect: boolean
}

type QuizQuestionLabels = {
  validate: string
  next: string
  correct: string
  incorrect: string
  multipleHint: string
}

type ResolvedQuizQuestion = {
  index: number
  type: QuizQuestionType
  prompt: string
  answers: QuizAnswer[]
  labels: QuizQuestionLabels
}
```

Contraintes normatives:

- `index` est l'identifiant V1 de la question
- `answers` contient au moins deux reponses
- au moins une reponse de `answers` doit avoir `isCorrect = true`
- `boolean` doit produire exactement deux reponses
- `single` doit produire exactement une seule reponse correcte
- `multiple` peut produire une ou plusieurs reponses correctes

## Contrat auteur en entree du generateur

Le generateur unitaire pourra accepter un contrat auteur plus souple, puis le resoudre en `ResolvedQuizQuestion`.

Forme cible recommandee:

```ts
type QuizQuestionInput = {
  type: QuizQuestionType
  prompt: string
  answers?: Array<{
    id?: string
    label: string
    isCorrect: boolean
  }>
  booleanLabels?: {
    trueLabel?: string
    falseLabel?: string
  }
  labels?: Partial<QuizQuestionLabels>
}
```

Regles de resolution recommandees:

- `index` est fourni par la scene ou le generateur d'ensemble
- les labels manquants sont completes par defaut
- pour `boolean`, si `answers` est absent, le generateur cree deux reponses a partir de `booleanLabels`

## Valeurs par defaut configurees

Valeurs par defaut recommandees:

```ts
const DEFAULT_QUIZ_LABELS = {
  validate: 'Valider',
  next: 'Suivant',
  correct: 'Correct',
  incorrect: 'Incorrect',
  multipleHint: 'Plusieurs reponses possibles'
}

const DEFAULT_BOOLEAN_LABELS = {
  trueLabel: 'Vrai',
  falseLabel: 'Faux'
}
```

## Events runtime

## Familles d'events

La spec distingue trois familles d'events:

- events natifs normalises: `native:*`
- events de logique questionnaire: `quiz:*`
- events scene ou orchestration plus globaux, selon les conventions deja en place

Principe:

- un composant capte des events DOM natifs et emet un event Codplay local dans la famille `native:*`
- dans le cadre de cette spec questionnaire, ces events `native:*` sont reellement employes par les `straps` locaux du questionnaire
- ces events peuvent transporter, en plus de `data`, un acces live `native` a l'event DOM pour les besoins de bubbling et de controle de propagation
- les `straps` consomment ces events locaux puis emettent les events metier `quiz:*`
- seules les donnees standard utiles au replay et aux tracks ont vocation a etre reemises en `data`

Exemples recommandes:

- `native:form:change`
- `native:form:submit`
- `quiz:question:answered`
- `quiz:question:next`

## Event d'entree

Une question s'initialise via:

- `quiz:question:show`

Payload canonique:

```ts
type QuizQuestionShowPayload = {
  question: ResolvedQuizQuestion
}
```

## Events internes de question

Events natifs internes recommandes:

- `native:form:change`
- `native:form:submit`

Events de questionnaire recommandes:

- `quiz:question:validate`
- `quiz:question:resolved`

Payload canonique de changement d'etat du formulaire:

```ts
type NativeFormChangePayload = {
  questionIndex: number
  values: Record<string, string | number | boolean | string[] | null>
  selectedAnswerIds: string[]
}
```

Payload canonique de soumission native du formulaire:

```ts
type NativeFormSubmitPayload = {
  questionIndex: number
  values: Record<string, string | number | boolean | string[] | null>
  selectedAnswerIds: string[]
}
```

Hypothese locale d'emploi pour cette spec:

- un event `native:*` peut etre accompagne d'un acces live `native` a l'event DOM source
- cet acces `native` sert au traitement local par strap
- il sert notamment a lire les donnees natives utiles et a gerer la propagation navigateur
- les donnees durables doivent ensuite etre reemises dans un event standard a travers `data`

Regles:

- ces events sont emis par le composant `form`
- il centralise la collecte d'etat DOM utile au questionnaire
- il ne transporte pas le type d'input en sortie
- `selectedAnswerIds` est la projection metier V1 utilisee pour la correction
- les `straps` de questionnaire doivent consommer preferentiellement ces events `native:*`
- les composants ne publient pas en `cascade` vers la scene pour ces interactions locales
- l'emploi de `native` est retenu dans cette spec locale; le point encore ouvert est son comportement exact selon les modes `seek / horizon / materialisation`

## Events metier publics

Events metier publics retenus:

- `quiz:question:answered`
- `quiz:question:resolved`
- `quiz:question:next`

Payload de reponse:

```ts
type QuizQuestionAnsweredPayload = {
  questionIndex: number
  selectedAnswerIds: string[]
  isCorrect: boolean
}
```

Payload de resolution trackee:

```ts
type QuizQuestionResolvedPayload = {
  questionIndex: number
  selectedAnswerIds: string[]
  correctAnswerIds: string[]
  isCorrect: boolean
}
```

Payload de passage:

```ts
type QuizQuestionNextPayload = {
  nextIndex: number
}
```

Regles:

- `quiz:question:answered` est emis apres validation
- `quiz:question:resolved` est l'evenement canonique rejouable qui porte l'etat post-validation utile au `seek`
- `quiz:question:next` est emis uniquement au clic sur le bouton `Suivant`
- `nextIndex = question.index + 1`

## Regles de selection

1. `boolean`

- selection unique
- rendu natif de type `radio`

2. `single`

- selection unique
- rendu natif de type `radio`

3. `multiple`

- selection multiple
- rendu natif de type `checkbox`

## Regle de correction

La correction repose sur une correspondance exacte entre:

- l'ensemble des `selectedAnswerIds`
- l'ensemble des `answers[].id` marques `isCorrect`

Il n'y a pas de score partiel en V1.

## Regles d'interface

1. Avant selection

- le bouton `Valider` est desactive
- aucun resultat n'est visible
- le bouton `Suivant` n'est pas visible

2. Apres au moins une selection

- le bouton `Valider` devient actif

3. Apres validation

- un cartouche apparait avec `Correct` ou `Incorrect`
- le bouton `Suivant` apparait
- le bouton `Valider` devient desactive et reste consomme
- les reponses peuvent afficher une correction visuelle projetee par le `form`
- le strap metier emet `quiz:question:answered`

4. Post-validation

- le `form` reste dans un etat consomme: `Valider` n'est plus actif
- l'etat post-validation rejouable au `seek` est porte par `quiz:question:resolved`
- le texte de resultat et le bouton `Suivant` restent des projections story-owned

## Animation de question

Chaque question apparait et disparait avec un balayage horizontal.

Direction retenue:

- entree depuis la droite
- sortie vers la gauche

Le detail exact des transitions peut etre porte par actions story.

## Base de composants retenue

## Composant `input`

`input` est considere comme necessaire des la premiere tranche.

### Nature du composant

`input` est un composant runtime generique de champ HTML.

Il n'embarque pas de logique metier specifique au quiz.
Il porte uniquement:

- le rendu du champ DOM
- son habillage visuel
- ses etats d'affichage
- la projection de proprietes runtime sur le noeud et ses `parts`

Le composant n'impose aucun style visuel par defaut autre qu'une structure minimale necessaire au fonctionnement DOM.
Les classes, attributs, styles statiques et conventions de presentation proviennent du `perso` genere.

### Ce que `input` doit savoir faire

- rendre un vrai `input` HTML
- supporter plusieurs types DOM standards
- appliquer les proprietes natives du champ
- rendre un label et des zones de feedback autour du champ
- recevoir des updates d'etat visuel avant et apres correction

### Ce que `input` ne doit pas savoir faire

- calculer `selectedAnswerIds`
- determiner si une question est correcte
- comparer la saisie a la reponse attendue
- decider quand afficher `Suivant`
- decider quand passer a la question suivante

Ces responsabilites relevent de `form`, des `straps` et de l'etat story.

### Portee fonctionnelle

- le composant `input` n'est pas limite au quiz
- il doit viser a terme les types standards du DOM
- les premiers types explicitement vises sont `radio`, `checkbox`, `text` et `number`
- la premiere tranche quiz utilisera principalement `radio` et `checkbox`
- pour les questions a choix, la valeur DOM du champ pourra correspondre a l'identifiant de reponse

Le composant peut s'appuyer sur une structure a `parts` pour reserver au minimum:

- une zone controle natif
- une zone label
- une zone icone de selection
- une zone icone de correction
- une zone message ou hint secondaire

Le composant peut reutiliser le meme principe technique que `layout` pour les `parts`, sans pour autant heriter de `LayoutComponent`.

Decision de conception:

- `input` et `form` etendent par defaut `BaseComponent`
- ils reutilisent un markup interne et un systeme de `parts`
- ils ne doivent pas heriter de `LayoutComponent` tant qu'ils n'ont pas besoin d'exposer des `outlets` runtime de type layout

### Etats visuels requis

Le composant `input` doit pouvoir recevoir et traiter des etats post-correction.

Etats cibles recommandes:

```ts
type InputVisualState =
  | 'idle'
  | 'selected'
  | 'disabled'
  | 'revealed-correct'
  | 'revealed-incorrect'
  | 'revealed-missed-correct'
```

Interpretation quiz attendue:

- `revealed-correct`: la reponse affichee est correcte
- `revealed-incorrect`: la reponse affichee a ete selectionnee mais est fausse
- `revealed-missed-correct`: la reponse affichee etait correcte mais non selectionnee

### Contrat initial recommande

```ts
type InputInitial = {
  id?: string
  inputType: string
  name?: string
  value?: string | number
  label?: string
  checked?: boolean
  disabled?: boolean
  placeholder?: string
  min?: number
  max?: number
  step?: number
  visualState?: InputVisualState
}
```

Notes:

- `inputType` reste libre au niveau composant
- le quiz V1 n'utilise pas tous les types des le depart
- les informations strictement metier du quiz ne doivent pas faire partie du coeur du contrat `input`
- les etats post-correction sont recues en update, pas calcules localement par le composant
- les classes CSS et attributs statiques du champ sont definis par le `perso` genere, pas par le composant lui-meme

## Composant `form`

`form` est obligatoire des la premiere tranche.

Decision de cadrage:

- `form` centralise la collecte d'etat DOM
- `form` gere le bouton `Valider`
- `form` emet les events runtime utiles a la story et aux straps
- `form` s'appuie sur `layout` pour son cadre interne et ses zones d'insertion

Responsabilites:

- s'appuyer sur `layout` pour son cadre et ses zones
- accueillir la liste des reponses avec une organisation CSS type `grid`
- centraliser les events `change` et `submit`
- construire le snapshot `values`
- deriver `selectedAnswerIds` quand le formulaire porte une question a choix
- activer ou desactiver `Valider` selon l'etat courant du formulaire

Le composant `form` ne porte pas la logique de verite metier `correct/incorrect`.
Cette logique reste dans les `straps`.

Le composant `form` n'impose pas non plus de style visuel par defaut.
Sa presentation est apportee par les classes, attributs et styles du `perso` genere.

### Contrat initial recommande

```ts
type FormInitial = {
  questionIndex: number
  validateLabel: string
  nextLabel: string
  canValidate?: boolean
  showResult?: boolean
  resultMessage?: string
  showNext?: boolean
}
```

### Props d'action recommandees pour `form`

```ts
type FormActionDoc = {
  canValidate?: boolean
  disableAnswers?: boolean
  showCorrection?: boolean
  selectedAnswerIds?: string[]
  correctAnswerIds?: string[]
}
```

Notes:

- `form` centralise l'etat des champs enfants sans embarquer leur logique metier
- `resultMessage` et `showNext` peuvent exister dans un contrat generique, mais dans le questionnaire V1 ils ne sont pas la voie retenue
- pour le quiz V1, le `form` ne porte pas le texte `Correct/Incorrect` ni le bouton `Suivant`
- la story reste proprietaire du cartouche resultat et du bouton `Suivant`
- `form` porte l'etat de `Valider`, le verrouillage des reponses et la projection de correction sur ses champs enfants
- le formulaire doit pouvoir reposer sur un identifiant HTML stable exploitable par l'attribut DOM `form`
- cette regle permet de lier des `input` et des boutons submit a un formulaire sans imposer leur imbrication DOM
- un bouton `Valider` ou un champ peut donc etre place visuellement hors de la hierarchie DOM immediate du `<form>`

## Structure runtime recommandee

Structure recommandee pour une question:

- un `layout` pour le cadre statique de la carte
- un `text` ou equivalent pour l'enonce
- un `text` pour le hint multiple
- un panneau story-owned pour demarquer visuellement la zone quiz
- un `form` pour accueillir et piloter le formulaire
- un `input` par reponse ou par champ, place visuellement dans la zone `answers` du `form`
- un cartouche resultat story-owned, rendu apres la zone des reponses
- un bouton `Suivant` story-owned, rendu apres le cartouche resultat

La scene de test pourra conserver une story toujours montee pour les informations agregees, meme si la V1 ne fait qu'un `console.log` visible cote code.

Regles de style recommandees pour cette structure:

- preferer `grid` et les mecanismes responsives modernes
- preferer des classes CSS pour les definitions statiques
- reserver les styles inline aux variations dynamiques
- eviter les positionnements absolus sauf contrainte de transition ou besoin visuel justifie

## Etat story

Etat story recommande pour la question active:

```ts
type QuizQuestionStoryState = {
  question?: ResolvedQuizQuestion
  resolved?: QuizQuestionResolvedPayload
}
```

## Etat scene

Etat scene recommande pour l'agregation:

```ts
type QuizSceneState = {
  answers: QuizQuestionAnsweredPayload[]
  answeredCount: number
  correctCount: number
  lastQuestionIndex?: number
  lastResult?: boolean
}
```

## Repartition des responsabilites

## Story de question

La story de question porte:

- l'affichage de la question courante
- les animations d'entree et de sortie
- l'expression du resultat et de `Suivant`
- la projection du payload `quiz:question:resolved` vers les composants story-owned

Les interactions entre `form` et `input` restent locales a la story.
Elles ne doivent pas utiliser `cascade`.

## Straps de question

Les straps de question portent:

- la validation exacte de la reponse
- l'emission de `quiz:question:resolved`
- l'emission de `quiz:question:answered`

## Composant `form`

Le composant `form` porte:

- la collecte centralisee des valeurs DOM
- la projection de ces valeurs en `selectedAnswerIds`
- la gestion du bouton `Valider`
- l'emission de `native:form:change`
- l'emission de `native:form:submit`
- la projection de correction sur les reponses qu'il contient quand un payload de resolution lui est applique

## Strap de scene

Le strap de scene porte:

- l'agregation des reponses
- la mise a jour du `scene.state`
- un `console.log` de suivi en V1
- la preparation future d'un event ou d'une story de progression

## Flux nominal

1. la scene decide quelle question afficher
2. la story recoit `quiz:question:show` avec la question resolue
3. la question entre depuis la droite
4. l'utilisateur selectionne une ou plusieurs reponses
5. `form` collecte l'etat DOM et emet `native:form:change`
6. `form` active `Valider` si le formulaire est validable
8. l'utilisateur clique `Valider`
9. `form` emet `native:form:submit`
10. un strap compare la selection aux bonnes reponses
11. ce strap emet `quiz:question:resolved`
12. `form` recoit ses props d'action post-validation et projette la correction sur les reponses
13. le cartouche `Correct` ou `Incorrect` apparait
14. le bouton `Suivant` apparait
15. l'event `quiz:question:answered` est emis
16. le strap scene agrege et trace le resultat
17. l'utilisateur clique `Suivant`
18. l'event `quiz:question:next` est emis avec `nextIndex`
19. la scene orchestre la sortie vers la gauche puis l'affichage de la question suivante

## Validation de la tranche

La tranche sera consideree valide si:

- une question `single` peut etre affichee via `quiz:question:show`
- les reponses sont pilotables via un composant `form`
- les reponses sont cliquables via vrais `inputs`
- le `form` centralise l'etat DOM dans un payload `native:form:change`
- `Valider` est desactive tant qu'aucune selection n'existe
- la correction exacte fonctionne
- le resultat `Correct` ou `Incorrect` apparait
- `Suivant` apparait apres validation
- `quiz:question:answered` est emis avec le bon payload
- `quiz:question:next` est emis avec `nextIndex = index + 1`
- l'agregation scene-level met a jour son state et produit un `console.log`
- l'entree se fait depuis la droite et la sortie vers la gauche

## Plan de mise en oeuvre recommande

## Plan detaille d'implementation

Le plan d'implementation est decoupe en phases principales et sous-phases de livraison.

## Phase 0 - verrouillage spec et contrats

Objectif:

- stabiliser les contrats avant tout dev pour eviter les reworks d'integration

Travaux:

1. figer les types `ResolvedQuizQuestion`, `InputInitial` et `FormInitial`
2. figer les payloads `native:form:change`, `native:form:submit`, `quiz:question:answered` et `quiz:question:next`
3. confirmer la liste des types `input` supportes en premiere tranche
4. confirmer la liste des etats visuels supportes par `input`
5. confirmer que `form` centralise l'etat DOM et gere `Valider`
6. confirmer que la logique `correct/incorrect` reste uniquement dans les `straps`
7. verifier que la spec n'introduit pas de donnees quiz-specifiques dans le coeur de `input`

Livrables:

- spec coherente
- liste des types a creer
- liste des events publics et internes

Critere de sortie:

- plus aucune ambiguite entre logique DOM, logique metier et orchestration story

## Phase 1 - creation du composant `input`

Objectif:

- disposer d'un composant runtime de champ HTML reutilisable, pret a recevoir les etats post-correction

### Sous-phase 1.1 - contrat et structure DOM

Travaux:

1. creer le type `InputVisualState`
2. creer le type `InputInitial`
3. definir la structure DOM interne du composant
4. definir les `parts` minimales
5. choisir la convention de classes ou d'attributs d'etat

Livrables:

- contrat TypeScript du composant
- structure DOM cible documentee

### Sous-phase 1.2 - rendu des types DOM de base

Travaux:

1. rendre un vrai `<input>`
2. supporter `radio`
3. supporter `checkbox`
4. supporter `text`
5. supporter `number`
6. appliquer `name`, `value`, `checked`, `disabled`
7. appliquer `placeholder`, `min`, `max`, `step` quand pertinents
8. rendre le label et les zones de feedback

Livrables:

- composant `input` fonctionnel sur les types prioritaires V1

### Sous-phase 1.3 - updates et etats visuels

Travaux:

1. implementer la mise a jour de `checked`
2. implementer la mise a jour de `disabled`
3. implementer la mise a jour de `value`
4. implementer la mise a jour de `visualState`
5. gerer les etats `revealed-correct`, `revealed-incorrect` et `revealed-missed-correct`
6. verifier que les updates ne recreent pas inutilement le DOM

Livrables:

- composant `input` capable de refleter l'etat de correction question par question

### Sous-phase 1.4 - integration runtime minimale

Travaux:

1. enregistrer `input` dans le registry de composants
2. monter une scene minimale avec un `input`
3. verifier son comportement en rendu simple

Critere de sortie de phase:

- `input` fonctionne seul, hors quiz, avec support des etats post-correction

## Phase 2 - creation du composant `form`

Objectif:

- disposer d'un composant centralisateur d'etat DOM et pilote de `Valider`

### Sous-phase 2.1 - contrat et structure du formulaire

Travaux:

1. creer le type `FormInitial`
2. definir la structure DOM du composant autour d'un vrai `<form>`
3. definir ses zones internes: enonce, hint, liste des reponses, validation, resultat, suivant
4. brancher son cadre sur `layout`

Livrables:

- composant `form` rendu en DOM

### Sous-phase 2.2 - collecte centralisee d'etat DOM

Travaux:

1. capter les events `change`
2. capter les events `input` si necessaire pour `text` et `number`
3. lire l'etat courant des champs du formulaire
4. construire un snapshot `values`
5. deriver `selectedAnswerIds` pour les questions a choix
6. definir la regle `canValidate`
7. exploiter l'attribut HTML `form` pour les champs ou boutons potentiellement hors hierarchie DOM

Livrables:

- logique de collecte centralisee stable

### Sous-phase 2.3 - gestion de `Valider` et emission d'events

Travaux:

1. activer ou desactiver le bouton `Valider`
2. intercepter `submit`
3. empecher le comportement HTML natif non souhaite
4. emettre `native:form:change`
5. emettre `native:form:submit`

Livrables:

- composant `form` emissif et integrable

### Sous-phase 2.4 - updates visuels du formulaire

Travaux:

1. afficher ou masquer le cartouche resultat
2. afficher ou masquer le bouton `Suivant`
3. projeter `resultMessage`
4. verifier que `form` n'embarque pas le calcul `correct/incorrect`

Critere de sortie de phase:

- `form` centralise l'etat des champs et pilote `Valider` sans logique metier quiz

## Phase 3 - creation de la fonction de creation de questionnaire

Objectif:

- produire une question integrable automatiquement a partir d'une definition resolue

### Sous-phase 3.1 - resolution des donnees quiz

Travaux:

1. creer le type `QuizQuestionInput`
2. creer le type `ResolvedQuizQuestion`
3. definir les labels par defaut
4. definir la resolution du type `boolean`
5. definir la generation des ids de reponse
6. definir la validation minimale des donnees d'entree

Livrables:

- normalisation d'une question prete au rendu

### Sous-phase 3.2 - composition runtime de la question

Travaux:

1. creer le layout de carte
2. creer le `form` de question
3. instancier un `input` par reponse ou champ necessaire
4. creer le cartouche resultat
5. creer le bouton `Suivant`
6. relier les identifiants runtime stables
7. definir les classes CSS statiques de la carte et de ses zones

Livrables:

- fonction de construction des persos et de la story de question

### Sous-phase 3.3 - story, straps et events

Travaux:

1. creer l'etat initial de story
2. ecouter `quiz:question:show`
3. ecouter `native:form:change`
4. mettre a jour `values`, `selectedAnswerIds` et `canValidate`
5. ecouter `native:form:submit`
6. calculer `isCorrect` par correspondance exacte
7. mettre a jour les etats visuels des `input`
8. afficher `Correct` ou `Incorrect`
9. afficher `Suivant`
10. emettre `quiz:question:answered`
11. emettre `quiz:question:next` avec `nextIndex = index + 1`

Livrables:

- fonction de creation de question complete et pilotable par events

### Sous-phase 3.4 - animation d'entree et de sortie

Travaux:

1. definir l'action d'entree depuis la droite
2. definir l'action de sortie vers la gauche
3. lier ces actions a l'apparition et au passage a la question suivante

Critere de sortie de phase:

- une question `single` complete peut etre generee et jouee sans montage manuel repetitif

## Phase 4 - integration scene et aggregation

Objectif:

- brancher la question generee dans une scene de test multi-questions

Travaux:

1. creer une scene de test avec plusieurs questions resolues en memoire
2. creer le strap de scene d'agregation
3. ecouter `quiz:question:answered`
4. mettre a jour `scene.state.answers`
5. maintenir `answeredCount`, `correctCount`, `lastQuestionIndex` et `lastResult`
6. produire un `console.log` a chaque reponse
7. ecouter `quiz:question:next`
8. resoudre la question suivante par index
9. orchestrer la sortie de la question courante et l'entree de la suivante

Critere de sortie de phase:

- plusieurs questions peuvent s'enchainer dans une meme scene

## Phase 5 - validation et readiness d'integration

Objectif:

- verifier que la tranche est propre, stable et integrable dans le depot

Travaux:

1. relire tous les contrats TypeScript
2. verifier le nommage en kebab-case des nouveaux fichiers
3. verifier les commentaires de fonction necessaires
4. verifier qu'aucune logique metier quiz n'est entree dans `input`
5. verifier qu'aucun calcul de correction n'est entre dans `form`
6. verifier que les ids runtime restent stables
7. verifier les cas invalides detectables tot
8. verifier que la demo expose bien les limites restantes
9. documenter les events publics V1
10. documenter les limites connues de la tranche

Critere de sortie de phase:

- la fonctionnalite est prete a etre integree sans rework architectural immediat

## Ordre recommande de realisation

1. finaliser la spec
2. creer les types partages
3. creer `input`
4. verifier `input` sur scene minimale
5. creer `form`
6. verifier `form + input` sur scene minimale
7. creer la fonction de creation de question
8. brancher les straps story
9. brancher les straps scene
10. monter la demo multi-questions
11. effectuer la passe finale de validation

## Points de vigilance d'integration

1. ne pas specialiser `input` trop tot au quiz
2. ne pas transformer `form` en couche metier
3. eviter une duplication d'etat incoherente entre DOM, `form` et story
4. garder `selectedAnswerIds` comme projection metier et non comme source DOM primitive unique
5. garder le calcul `isCorrect` exclusivement dans les `straps`
6. prevoir des ids stables pour cibler les updates visuels post-correction
7. prevoir des updates suffisamment fines pour marquer chaque reponse apres validation
8. reserver `cascade` aux echanges inter-stories ou story-scene
9. faire venir les styles statiques du generateur et non des composants

## Clarification a mener a part

Le present document retient `native` comme terme de reference et comme mecanisme local employe pour designer l'acces a un event DOM live dans le flux questionnaire.

En revanche, il n'etend pas ici de maniere normative le contrat runtime transverse des `straps` pour fixer completement la forme et le comportement de cet acces dans tous les modes d'execution.

Ce point est considere comme une clarification separee, hors perimetre de la mission courante.

Sujet a clarifier dans une formalisation dediee:

- distinction explicite entre event standard Codplay et acces `native` a l'entree d'un strap
- capacite pour un traitement live a lire les donnees natives utiles
- capacite pour un traitement live a gerer le bubbling et a interrompre la propagation (`preventDefault`, `stopPropagation`, `stopImmediatePropagation`)
- comportement exact des `straps` au seek, en particulier quand leurs resultats sont deja materialises dans les tracks ou quand une projection au-dela de l'horizon doit etre resolue
- regle selon laquelle un traitement dependant d'un event natif reel ou d'un mecanisme de capture ne peut pas compter sur cet acces hors contexte live
- alignement attendu avec le precedent `capture-session`

Decision courante pour cette mission:

- employer `native` comme acces local effectivement utilise dans les events `native:*` du questionnaire
- ne pas modifier maintenant les contrats runtime generaux au-dela de ce cadrage local
- traiter le comportement des `straps` au seek dans une clarification transversale `event / story / strap / seek`
- poursuivre le questionnaire V1 sans etendre tout de suite les types coeur tant que cette clarification n'est pas ecrite et validee

## Integration auteur finale

Pour l'auteur final, l'integration cible doit prendre la forme d'un tableau editable d'objets questions.

Exemple de forme attendue:

```ts
const questions: QuizQuestionInput[] = [
  {
    type: 'single',
    prompt: 'Question 1',
    answers: [
      { label: 'A', isCorrect: false },
      { label: 'B', isCorrect: true }
    ]
  }
]
```

Le code generateur doit transformer ce tableau en stories, persos, classes CSS et straps integrables dans la scene.

## Exemples et demos

Les exemples produits pour cette fonctionnalite doivent etre ajoutes au corpus d'exemples et de demos du projet.

Objectifs:

- enrichir les modeles d'exemples existants
- fournir une demonstration de reference du questionnaire
- conserver une base de validation visible pour les evolutions futures

## Point de suite deja identifie

Apres cette premiere tranche, les evolutions attendues sont:

- support complet des types `boolean` puis `multiple`
- story de progression toujours visible
- feedback visuel par reponse correcte / incorrecte
- regle normative de verrouillage post-validation
- enrichissement du composant `input` pour d'autres familles de champs DOM
