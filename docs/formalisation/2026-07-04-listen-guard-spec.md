# Spec (proposition) — filtre `match` déclaratif sur `ListenRule`

Statut : **abandonné**. Le routage réel (`player.ts: routeSceneEvent`) résout
`scopeStoryId` par lookup direct *avant* de consulter `listen` — `Story.listen`
n'est jamais évalué pour choisir parmi plusieurs stories candidates, seulement
une fois la scope déjà connue. `match`/`$self.id` ne peut donc pas remplacer
l'adressage par nom templaté (seul mécanisme existant pour qu'un strap
scene-level cible une story précise — `StoryEvent`/`ListenEmit` n'ont aucun
champ de ciblage explicite). L'invariant "`listen.on` unique" identifié en §1
n'est de plus jamais réellement heurté par `quiz-hunt` (aucune règle dupliquée
en pratique). Conservé pour mémoire, ne pas ré-implémenter sans revoir cette
limite de routage. Discussion complète conservée ci-dessous.

Mécanisme unique, portée générale (pas spécifique à un demo) : `match` (§2),
côté admission/écoute.

## 1. Constat

`v1-event-spec.md` règle 2 et règle 9 établissent déjà une convention
d'adressage explicite d'un perso : `event.name === perso.id` ("la convention
la plus directe pour designer sans ambiguite un perso cible"). C'est le
mécanisme auto-référent.

En pratique, deux endroits du modèle contournent cette convention en
fabriquant des noms templatés qui encodent à la fois **qui** est visé et
**quoi** se produit :

- `Scene.listen` / `Story.listen` : `v1-scene-spec.md` §69 et
  `v1-story-spec.md` §134 imposent `listen.on` unique par nom d'event dans
  une même Scene/Story — une seule règle peut réagir à un nom donné. Pour
  faire réagir différemment 16 stories similaires à "une réussite", le seul
  moyen actuel est de fabriquer 16 noms distincts
  (`game:grid:tile:${wordId}:success`), un par instance.
- `Perso.actions` : la clé de dispatch est `event.name` exact. Quand 16
  persos frères vivent dans une même Story (`grid-story.ts`), ils ne peuvent
  pas partager une clé d'action générique (`success`) sans se répondre les
  uns aux autres — d'où, là aussi, la clé templatée par `wordId`.

Dans les deux cas, le nom de l'event cesse d'être un vocabulaire fermé : il
devient combinatoire (un nom par instance × par issue), ce qui casse la
lisibilité en graphe et contourne le modèle d'interception ouverte (un event
générique intercepté librement par plusieurs listeners indépendants).

## 2. Proposition

Ajouter un champ optionnel `match` à `ListenRule`. Ce n'est **pas** un guard
au sens XState (qui peut porter une condition métier arbitraire, ex.
`context.count > 5`). C'est un **filtre de portée/identité** : il répond
uniquement à "cet event me concerne-t-il, moi, structurellement", jamais à
"la logique métier autorise-t-elle cette transition". La distinction est
volontaire — tout ce qui est ordinal ou calculé (seuils, comparaisons
numériques, décisions) reste dans un strap, jamais dans `match`.

```ts
type MatchExpr = {
  field: string       // clé (ou chemin) lue dans event.data — pas de préfixe "data.", event.data est le seul contexte lisible, donc implicite
  values: unknown[]   // ensemble de valeurs admises ; littéral(aux) et/ou "$self.id" (id de la Story porteuse de la règle, unique par construction)
  exclude?: boolean    // false/absent: le champ doit valoir l'une des values ; true: ne doit valoir aucune (couvre le cas "neq")
}

type ListenRule = {
  on: string
  match?: MatchExpr
  transform?: TransformFn[]
  straps?: string[]
  emit?: ListenEmit[]
}
```

- Une seule opération : appartenance à un ensemble, avec `exclude` pour son
  inverse. Une égalité simple s'exprime `values: [valeur]` ; une exclusion
  simple ("neq") s'exprime `values: [valeur], exclude: true`. Pas de branche
  `eq` distincte (pas d'ambiguïté sur la forme de la valeur, toujours un
  tableau), et pas de wrapper `not(matchExpr)` récursif : `exclude` est un
  booléen plat sur la même forme, pas un combinateur composable — ça
  réintroduirait la logique `and`/`or` explicitement exclue en §5.
- `field` n'adresse jamais `event.name`, `context` ou `meta` — uniquement
  `event.data`. C'est le seul contexte que `match` peut lire.
- Pas de `lt`/`gt`/`gte`/`lte` : une comparaison ordinale encode une
  décision, donc appartient à un strap qui peut réagir en émettant — un
  besoin comme "moins de 10s restantes" se résout dans le strap
  (`game-timer`), pas via `match`.
- `match` est une donnée, jamais une fonction : condition nécessaire pour
  qu'un outil (éditeur de graphe) puisse la lire/écrire sans exécuter de
  code.
- Ordre inchangé sinon : `match` (si présent) → `transform` → `straps` →
  `emit`. Si `match` est absent, comportement identique à aujourd'hui
  (admission inconditionnelle).
- `$self.id` se résout à l'id de la Story porteuse de la règle — c'est la
  généralisation déclarative du cas auto-référent (`event.name === perso.id`) :
  cibler "moi" sans encoder mon id dans le nom de l'event. Un id est unique
  par construction ; `match` ne prévoit pas d'alternative via `state` pour
  contourner un id mal formé. Si l'id d'une Story ne correspond pas
  directement à la valeur de corrélation portée par les events, c'est un
  problème de nommage à corriger côté auteur de la scène — pas un cas que la
  spec doit absorber.
- Invariant structurel : **`match` ne produit jamais d'event ni de
  mutation.** Seul un `strap` peut émettre (`events`) ou muter (`update`).
  `match` admet ou rejette ; il n'agit jamais. C'est la ligne de partage
  entre les deux : dès qu'un effet est nécessaire (même conditionnel),
  c'est un strap.

## 3. Invariant à amender

`v1-story-spec.md` §134 et `v1-scene-spec.md` §69 ("`listen.on` doit être
unique par nom d'event... doublon: erreur auteur") doivent être révisés :

- Plusieurs règles peuvent partager le même `on` **si et seulement si**
  chacune porte un `match`.
- Deux règles de même `on` sans aucun `match`, ou avec des `match`
  strictement identiques, restent une erreur auteur (ambiguïté non levée).
- La spec ne garantit pas la mutuelle exclusivité des `match` ; plusieurs
  règles au `match` chevauchant peuvent s'exécuter pour un même event
  (cohérent avec le modèle broadcast : plusieurs listeners indépendants
  peuvent légitimement réagir au même event).

## 4. Ce que `match` ne couvre pas

- **`Perso.actions`, cas des personas frères dans une même Story** : `match`
  résout à la granularité Story/Scene — un seul `$self` par règle, celui de
  la Story porteuse. Il désambiguïse correctement entre **plusieurs
  instances de Story** qui partagent un même `on` (ex. les 32 trial/final-
  stories, une par mot, chacune avec son propre `$self`). Il ne peut en
  revanche **rien** pour désambiguïser entre plusieurs personas frères vivant
  dans une **même** instance de Story — cas de `grid-story.ts` (une seule
  Story contenant les 16 tuiles comme personas, `stories/grid-story.ts:57-77`) :
  `$self.id` y résoudrait toujours à `"game-grid-story"`, jamais à un
  `wordId`, donc un `match` sur `wordId === $self.id` ne filtrerait jamais
  rien d'utile. Pour ce cas, `match` n'aide pas du tout ; seuls restent
  disponibles le dispatch par clé d'action templatée (approche actuelle) ou
  l'adressage auto-référent perso par perso (`event.name === perso.id`,
  `v1-event-spec.md` règle 9, orthogonal à cette proposition).
- **Logique métier** (ex: "isCorrect", choix de la couleur) : reste dans le
  strap. `match` ne fait qu'admettre ou rejeter l'exécution d'une règle, il
  ne remplace pas la décision métier qui reste imperative/JS dans le strap
  déclenché.
- **Adressage explicite** (`event.name === perso.id`) : reste la convention
  privilégiée quand la cible est unique et connue à l'émission. `match` est
  pour le cas où plusieurs cibles indépendantes doivent chacune s'auto-
  sélectionner sur un event partagé.

## 5. Non-objectifs

- `match` n'est pas un langage de prédicats général : un seul `field`/
  `values` par règle en V1. Pas de `and`/`or` combinés — si besoin, plusieurs
  `ListenRule` distinctes avec le même `on` et des `match` différents.
- `match` n'est pas un guard métier : aucune comparaison ordinale/calculée
  (`lt`/`gt`/seuils) n'est prévue, même en itération future — ce besoin est
  et reste couvert par un strap.
- `match` ne cible pas un perso directement ; il gate l'exécution de
  `straps`/`transform`/`emit` d'une règle portée par une Story ou la Scene.
- `match` ne rejoue jamais l'action elle-même : il ne produit ni `events` ni
  `update` — seul un strap peut le faire (voir §2, invariant structurel).
- Certains straps résolvent leur cible par interaction runtime (position,
  hit-test, drag — ex. `game-extra-drop.ts`) plutôt que par une donnée
  traçable depuis `event.data`. Pas de mécanisme déclaratif dédié pour ce cas
  en V1 : le graphe les représente comme un nœud non résolu, et c'est le
  rejeu (couche temporelle, `seek`) qui montre après coup ce qui s'est
  réellement passé. À préciser plus tard seulement si l'usage l'impose.
