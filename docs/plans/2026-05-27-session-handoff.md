# Session Handoff - 2026-05-27

## But du document

Ce document resume l'etat reel de la conversation et des decisions prises, pour pouvoir reprendre dans une nouvelle session sans dependre du contexte implicite de la session precedente.

Il contient:

- les decisions validees
- les specs ecrites ou modifiees
- les points explicitement non valides
- les points ouverts
- les notes/documents a nettoyer car ils contiennent encore des formulations desynchronisees

---

## Etat general

Le chantier principal a porte sur:

1. l'API de registry runtime (`component`, `service`, `module`)
2. l'API de classe composant (`constructor`, `render`, `init`, `createRootNode`, `update`)
3. l'architecture modulaire cible (`module` avec accroche runtime et/ou composant)
4. les notions specifiques `part` et `outlet`

L'intention V1 retenue n'est pas d'imposer une reecriture immediate du runtime si le cout est trop grand.

La structure modulaire est une **cible de spec V1**.
L'implementation concrete peut etre reportee post-V1 si elle demande trop de reecriture.

References de plan:

- `formalisation/2026-05-27-modular-runtime-v1-plan.md`
- `formalisation/2026-05-27-runtime-module-implementation-plan.md`

---

## Decisions validees

### 1. Registry unifie

Decision validee:

- `register`
- `override`

avec les regles suivantes:

- `register` cree une declaration unique
- collision sur `register` => erreur
- `override` remplace explicitement
- `override` sur absent => erreur

Le vocabulaire retenu est:

- `component`
- `service`
- `module`

et non `componentClass` dans l'API publique de registry.

Spec ecrite:

- `formalisation/v1-registry-api.md`

---

### 2. Bootstrap interne Codplay

Decision validee:

- Codplay declare ses composants, services et modules internes **en premier** dans son bootstrap
- il utilise **la meme API** que l'hote
- donc quelque chose de type:
  - `this.component.register(...)`
  - `this.service.register(...)`
  - `this.module.register(...)`

Le bootstrap interne n'a pas de chemin privilegie a part.

Ce point a ete documente dans:

- `formalisation/v1-module-api.md`

---

### 3. Composant - constructeur

Decision validee:

- le constructeur recoit le `perso` complet en lecture seule
- on ne fragmente pas le `perso`
- le constructeur ne construit pas le root node
- `report` remplace `warn`

Le `perso` complet readonly est prefere pour eviter de demander a l'auteur quoi garder ou non.

Spec ecrite:

- `formalisation/v1-component-api.md`

---

### 4. Composant - `render()`

Decision validee:

- `render()` est obligatoire
- `render()` est one-shot en V1
- le runtime ne lit jamais implicitement un template dans `perso`
- si l'auteur veut utiliser un template stocke dans `perso`, il doit le faire explicitement dans `render()`

Exemple valide:

```ts
render() {
  return this.perso.initial.template
}
```

Formes autorisees en V1 pour le retour de `render()`:

1. `string`
2. `node`

Interpretation:

- `string` = template string auteur
- `node` = node deja construit (par ex `document.createElement("div")` ou retour effectif d'un helper auteur)

La V1 ne fige pas de forme VDOM/objet intermediaire.

Spec ecrite:

- `formalisation/v1-component-api.md`

---

### 5. Composant - `init()` et `createRootNode()`

Decisions validees:

- `init()` est interne
- `init()` ne remplace pas le constructeur
- `init()` ne retourne rien
- `init()` appelle `createRootNode()`
- `createRootNode()` est interne
- `createRootNode()`:
  1. appelle `render()`
  2. resout la forme retournee
  3. cree ou recupere le node root runtime
  4. assigne ce node a `rootNode`

Decision de nom retenue:

- `createRootNode`

Point important:

- `setRoot()` est considere comme un detail interne mineur, sans valeur d'API auteur

Spec ecrite:

- `formalisation/v1-component-api.md`

Note de mise a jour ulterieure:

- la spec a ensuite evolue pour distinguer `init()` auteur et `_init()` interne
- la logique precedemment attribuee a `init()` interne est portee par `_init()`
- `createRootNode()` reste interne

---

### 6. `ComponentServices`

Decisions validees:

- `services` est une **map ouverte**
- ce n'est **pas** une liste fermee V1
- ce n'est **pas** une liste auteur a declarer dans le composant
- ce n'est **pas** une map `slot -> service key` a maintenir par l'auteur

Les cles de `services` doivent correspondre a des familles de proprietes auteur exposees par les persos.

Exemples valides:

- `className`
- `style`
- `attr`
- `content`

Exemples explicitement retires des exemples V1:

- `fitMode`
- `src`
- `alt`

Motif:

- `fitMode` est considere comme un reliquat a corriger plus tard
- `src` et `alt` sont traites comme des `attr` pour les exemples V1

Autres decisions:

- un auteur de composant consomme directement les services injectes
- il n'en cree pas
- il ne declare pas une mini-DSL de services
- le typecheck vient du type du composant lui-meme
- l'absence d'un service attendu est une erreur runtime explicite
- la creation du composant etant controlee pendant la lecture/instanciation de scene, la validation de l'injection peut se faire a ce moment-la

Spec ecrite:

- `formalisation/v1-component-api.md`

---

### 7. `_update()` et `update()`

Decisions validees:

- `update()` auteur recoit le **patch brut resolu**
- pas de contexte auteur enrichi pour l'instant
- `_update()` est interne
- `_update()` recoit le meme patch brut
- `_update()` peut appliquer une logique commune puis appeler `update()` auteur

Point critique valide par l'utilisateur:

- **il n'existe pas de pipeline commune canonique** pour `_update()`
- le traitement est **au cas par cas**
- si plusieurs composants partagent un pack de traitement, on peut ecrire un helper ou un pack local (par exemple pour `className/style/attr/content`), mais ce n'est **pas normatif**
- `beforeUpdate` / `afterUpdate` sont reportes a plus tard si besoin

Important:

- certaines notes de travail produites pendant la session contiennent encore des formulations trop fortes sur une pipeline commune; elles doivent etre considerees comme obsoletes tant qu'elles n'ont pas ete nettoyees

Spec principale concernee:

- `formalisation/v1-component-api.md`

Note de travail a nettoyer plus tard:

- `formalisation/runtime-component-class-design-notes.md`

---

### 8. Module - principe general

Decision validee:

- un module est enregistre dans `codplay.module`
- un composant ne declare jamais lui-meme un module
- un module peut avoir:
  - une face `runtime`
  - une face `component`
  - ou les deux

Autre decision validee:

- un `service` ne patch pas le runtime global
- un `module` peut s'accrocher au runtime global et eventuellement exposer une capability composant

Spec ecrite:

- `formalisation/v1-module-api.md`

---

### 9. Module - mecanisme declaratif runtime

Decision validee:

Le runtime ne doit pas appeler un module par son nom metier dans le code d'execution normal.

Le mecanisme cible documente est:

1. un module est enregistre par nom
2. le module est installe
3. sa face `runtime` declare des hooks
4. un dispatcher runtime generique execute les hooks matchants selon la phase courante

Hooks de phase documentes dans la spec:

- `onComponentMounted`
- `onComponentUnmounted`
- `onInitialPerso`
- `beforeUpdate`
- `afterUpdate`
- `onDestroy`

Un module peut aussi declarer un `match`, par exemple:

- `actionKeys`
- `componentCapabilities`

Point important:

- le runtime reste un routeur
- il ne connait pas la logique interne du module

Spec ecrite:

- `formalisation/v1-module-api.md`

---

### 10. Cas `move`

Decisions validees:

- `move` est le cas de reference principal pour les modules
- `move` est bien un module
- `move` a besoin d'un ancrage runtime global
- `move` a besoin d'un support local cote composant, notamment pour `list`

Dependances runtime reperees et documentees:

- `RuntimeComponentOrchestrator`
  - normalisation de `move`
  - application des moves initiaux
  - application des moves resolus
  - orchestration avant/apres autour des updates
- `create-player-utils`
  - transport de `story.initial.move`
- `runtime/types`
  - `MoveValue`, `MoveCommand`, `MoveFlipMode`
- `runtime/config`
  - `move.rootToken`
- `animation/types`
  - transport de payloads contenant `move`

Autre decision importante:

- `flip` doit etre retire comme candidat explicite du contrat composant
- `flip` reste un detail d'orchestration interne autour de `move`

Specs/plan ecrits:

- `formalisation/v1-module-api.md`
- `formalisation/2026-05-27-runtime-module-implementation-plan.md`

---

### 11. `list` et `layout`

Clarification validee:

- `part` et `outlet` ne sont **pas** des notions de norme generale de `v1-component-api`
- ce sont des termes specifiques a leurs composants respectifs

#### `list`

Dans `list`, `part` designe:

- un element heberge par le conteneur
- inconnu au moment de la creation initiale
- rattache ensuite a un `persoId`
- gere dans l'ordre local du list

Spec ecrite:

- `formalisation/v1-list-spec.md`

#### `layout`

Dans `layout`, `outlet` designe:

- un point d'insertion declare par `layout.initial.outlets`
- cible ensuite par d'autres persos via `initial.move.parentId`

Spec ecrite / completee:

- `formalisation/v1-layout-spec.md`

Important:

- ne pas re-generaliser `part` ou `outlet` dans `v1-component-api.md`

---

## Fichiers crees ou modifies pendant cette session

### Specs / notes creees

- `formalisation/v1-registry-api.md`
- `formalisation/v1-module-api.md`
- `formalisation/v1-component-api.md`
- `formalisation/v1-list-spec.md`
- `formalisation/2026-05-27-modular-runtime-v1-plan.md`
- `formalisation/2026-05-27-runtime-module-implementation-plan.md`
- `formalisation/runtime-component-class-design-notes.md`

### Specs modifiees

- `formalisation/v1-index.md`
- `formalisation/v1-player-api.md`
- `formalisation/v1-registry-api.md`
- `formalisation/v1-layout-spec.md`

---

## Points explicitement non valides / abandonnés

Les pistes suivantes ont ete explicitement abandonnees:

1. `services = ["className", "style", "attr", "content"]`
   - trop error-prone
   - trop formaliste pour l'auteur

2. map `slot -> service key` du type:

```ts
static readonly services = {
  content: "text-content"
}
```

   - jugee comme une complication inutile du point de vue auteur

3. une pipeline commune **canonique** pour `_update()`
   - explicitement refusee

4. `node.mount` comme abstraction de service auteur
   - piste abandonnee
   - ne refleterait pas correctement les usages actuels

5. exposer `createRootNode()` a l'auteur
   - refuse
   - `createRootNode()` reste interne

6. traiter `media/image` comme support normatif de `part`
   - incorrect / a ne pas retenir comme norme commune

---

## Points ouverts pour la prochaine session

1. nettoyer les notes desynchronisees
   - notamment `formalisation/runtime-component-class-design-notes.md`
   - retirer ou nuancer les formulations sur une pipeline commune `_update()`

2. verifier la coherence entre:
   - `v1-component-api.md`
   - `v1-module-api.md`
   - `v1-list-spec.md`
   - `v1-layout-spec.md`

3. poursuivre les specs si necessaire sur:
   - l'injection `runtime` cote composant
   - les details du contrat type de `services`
   - le contrat plus fin des hooks modules si l'implementation V1 avance

4. avant implementation, verifier le cout reel de reecriture de:
   - l'orchestrateur runtime
   - `move`
   - `list`

---

## Resume ultra-court

- registry unifie `register/override` valide
- composants: `constructor` + `render()` obligatoire + `init()`/`createRootNode()` internes
- `render()` retourne en V1 `string | node`
- `services` = map ouverte, pas de declaration auteur supplementaire
- pas de pipeline commune canonique pour `_update()`
- `move` = module de reference
- `part` = specifique `list`
- `outlet` = specifique `layout`
- implementation modulaire reportable si cout trop eleve
