# Inventaire V1 des capacites candidates a un Behavior V2

## Statut

Note de cadrage pour CodPlay V2. A relire avant toute extension du contrat
Behavior ou toute reprise de `context.live`.

Cette note consigne un audit du corpus V1 present dans `packages/demos`. Les
references V1 servent uniquement a retrouver l'intention et les cas d'usage.
Elles ne constituent pas des dependances a conserver dans V2 et ne justifient
pas la creation d'un circuit parallele.

## Objet

Dans cette note, un **Behavior** designe une valeur continue calculable a partir
du temps courant et de parametres connus :

```text
value = behavior(time, parameters)
```

Le calcul doit etre pur, re-evaluable au seek et independant du DOM, du nombre
de frames affichees et des effets de bord du materializer. Une evaluation
continue n'implique donc pas l'emission d'un event a chaque frame.

Cette notion doit rester distincte de :

- un event discret, qui constitue un fait date dans le journal ;
- une capture continue, qui depend d'echantillons d'une source externe ;
- une methode de composant ou de service, qui applique une valeur au
  materializer ;
- une simulation propre a un substrat, par exemple Three.js.

## Resultat de la recherche V1

### `context.live`

Le corpus des demos ne contient que deux appels executables a
`context.live.loop` :

- [s4-quiz-reference-scene.ts:626](../../../demos/src/scenes/s4-quiz-reference-scene.ts:626)
- [mashup-rive-three-quiz-scene.ts:246](../../../demos/src/scenes/mashup-rive-three-quiz-scene.ts:246)

Dans les deux cas, le loop produit un compte a rebours toutes les secondes et
s'arrete sur `counter:stop` ou apres onze occurrences.

Le loop melange deux intentions qui doivent etre separees en V2 :

| Intention dans la demo | Classification V2 |
|---|---|
| Afficher une valeur de compte a rebours | Behavior/tween calculable a partir du temps |
| `counter:stop` | Event discret d'interruption |
| `perdu` ou `mashup:quiz-timeout` | Event discret de domaine |
| Fin de sequence | Event discret de cycle de vie |

`context.live` ne doit donc pas etre porte tel quel. Le contrat V2 deja retenu
remplace les valeurs temporelles par un Behavior/tween, les compteurs
d'occurrences par de l'etat mis a jour par events, et les suites finies par le
Plan Temporel Declaratif. Voir
[2026-08-01-context-live-evolution.md](2026-08-01-context-live-evolution.md) et
[strap-execution-plan.md](../strap-execution-plan.md).

Le fichier `quiz-hunt/BUGS.md` contient des mentions historiques de
`context.live`, mais le code actuel de `game-timer.ts` n'utilise plus ce helper :
il emploie un controle d'expiration ponctuel et des `TweenAction` pour les
valeurs visuelles. Voir
[game-timer.ts:53](../../../demos/src/scenes/quiz-hunt/straps/game-timer.ts:53).

### `TweenAction` et interpolations finies

Les cas les plus nets de Behavior sont deja exprimes dans les demos par une
fonction pure du progres :

- [game-timer.ts:18](../../../demos/src/scenes/quiz-hunt/straps/game-timer.ts:18)
  construit les fonctions de l'aiguille, de la jauge et de l'affichage ;
- [chrono-story.ts:63](../../../demos/src/scenes/chrono-story.ts:63) anime
  l'aiguille et le texte du chronometre ;
- [space-bubbles-render-events.ts:21](../../../demos/src/scenes/space-bubbles/space-bubbles-render-events.ts:21)
  anime le temps affiche du HUD.

Dans ces trois cas, le strap gere les frontieres discretes (`start`, `pause`,
`resume`, `stop`) et emet une action animee. Le runtime evalue ensuite la
fonction a la position courante. Il n'y a pas de strap reexecute a chaque
frame.

Les transitions finies de `x`, `y`, `opacity`, `scale` ou de couleurs presentes
dans plusieurs demos relevent de la meme famille semantique : une evaluation
continue d'une valeur, materialisee par le service concerne.

### Behaviors periodiques

Deux demos declarent des valeurs temporelles perpetuelles ou repetitives :

- la derive des cercles decoratifs dans
  [s4-quiz-reference-scene.ts:88](../../../demos/src/scenes/s4-quiz-reference-scene.ts:88) ;
- les orbites des bulles dans
  [space-bubbles-scene.ts:119](../../../demos/src/scenes/space-bubbles/space-bubbles-scene.ts:119).

Ces valeurs sont des candidates a un Behavior periodique : elles sont
deterministes a partir du temps, de `from`, `to`, de la duree, de l'easing et des
options `alternate`/`loop`. Elles ne doivent pas etre implementees par une
emission reguliere d'events.

Le besoin d'un contrat V2 reste toutefois explicite pour les repetitions :
duree ou borne, arret, remplacement, seek et comportement d'une repetition
infinie. Les primitives ACE savent deja preparer des tweens avec
`loop`/`alternate`/`path` dans
[ace/tween.ts](../../src/ace/tween.ts), mais la resolution V2 des styles ne
transmet actuellement qu'une partie de ces options. Ce constat est un point
d'implementation a traiter dans le circuit existant, pas une raison pour
reintroduire `context.live`.

### Behaviors propres a un materializer

La demo Three.js contient un calcul temporel pur de pose, puis l'applique
directement aux objets Three :

- [threejs-anime-grid-scene.ts:69](../../../demos/src/scenes/threejs-anime-grid-scene.ts:69)
  calcule les facteurs temporels ;
- [threejs-anime-grid-scene.ts:95](../../../demos/src/scenes/threejs-anime-grid-scene.ts:95)
  applique la pose au mesh et a la lumiere.

La partie `f(t)` est bien un Behavior au sens semantique. La pose Three.js et
son application restent cependant dans le materializer Three.js. Le contrat
commun porte sur l'intention et le temps, pas sur une implementation DOM.

### Capacites continues qui ne sont pas des Behaviors

- Le DnD, le dessin SVG et le deplacement clavier du turret sont des captures
  continues : leur sortie depend des echantillons d'une source externe et de
  l'historique de la capture. Voir
  [stroke-path-scene.ts:138](../../../demos/src/scenes/stroke-path-scene.ts:138)
  et
  [space-bubbles-straps.ts:190](../../../demos/src/scenes/space-bubbles/space-bubbles-straps.ts:190).
- Le move/FLIP possede une interpolation continue, mais son graphe, ses
  endpoints, le reparent et sa presentation appartiennent au contrat move et
  au materializer. Il ne doit pas etre absorbe par un Behavior generique de
  style.
- Le media a une timeline, un decodage et des effets materiels. Sa
  synchronisation et son master restent dans le service media.
- `replace`, le morph polygon et les capacites de list sont des comportements
  de composant ou de module. Ils peuvent employer une interpolation interne,
  sans devenir des Behaviors globaux.

## Actions et methodes

La distinction a conserver est la suivante :

| Element V1 | Role |
|---|---|
| `perso.actions[eventName]` | Declaration d'une action choisie par un event ; comportement discret |
| Action `{ style: ... }`, `{ content: ... }`, etc. | Patch applique une fois ou declaration d'un tween |
| `TweenAction.fn` | Evaluateur pur du Behavior continu |
| `component.update()` | Orchestration et application au composant |
| `this.services.*` | Application des proprietes par les services du composant |

`actions` n'est donc pas un dictionnaire de methodes a executer librement. La
spec V1 le definit comme une correspondance `eventName -> action` dans
[v1-perso-spec.md:164](../../../../docs/formalisation/v1-perso-spec.md:164).

La fonction de `TweenAction` est le seul element de cette structure qui joue le
role d'une methode de calcul, mais elle reste une fonction pure : elle ne lit
pas le DOM, ne modifie pas le runtime et n'appelle pas directement un service.
Le composant et ses services recoivent ensuite son resultat par le circuit
normal. Voir
[v1-tween-action-spec.md:15](../../../../docs/formalisation/v1-tween-action-spec.md:15)
et [v1-component-api.md:130](../../../../docs/formalisation/v1-component-api.md:130).

## Etat du socle V2

Le modele V2 reconnait deja un etat continu evalue par ACE et un etat discret
reconstruit depuis les events. Le circuit `TweenAction` est present dans le
pipeline logique :

- `resolveScene` reconnait une `TweenAction` compilee ;
- la fonction est appelee avec `progress` et retourne un payload d'action ;
- le payload passe par la meme resolution que les actions statiques ;
- le seek reevalue la fonction sans reexecuter le strap.

Voir [action-sequence-tween-plan.md](../action-sequence-tween-plan.md) et
[resolve.ts:116](../../src/runtime/player/pipeline/resolve.ts:116).

En revanche, aucune API auteur generique `Behavior` n'est actuellement exposee
comme type ou objet autonome dans `packages/codplay-v2/src`. Pour l'instant,
`Behavior` est une categorie semantique du modele V2, dont `TweenAction` est une
forme concrete.

## Decisions deja fermees

- Ne pas porter `context.live`, `onUpdate` ou un scheduler de frames V1.
- Ne pas simuler une valeur continue par des events emis a chaque frame.
- Traiter les changements d'etat, les timeout et les compteurs d'occurrences
  par events et state.
- Garder la capture continue distincte d'un Behavior temporel.
- Garder les methodes de composant et les services du cote de l'application au
  materializer.
- Garder les comportements Three.js, media, move/FLIP, list et replace dans
  leurs capacites respectives.
- Ne conserver aucun lien runtime vers le code des demos V1 lors de la
  transposition V2.

## Points a reprendre ulterieurement

Cette note ne lance pas d'implementation. La reprise devra, dans cet ordre :

1. verifier si `TweenAction` suffit comme surface auteur ou si un nom
   `Behavior` autonome est necessaire ; ne pas creer les deux circuits sans
   decision explicite ;
2. completer, dans le resolver ACE/materializer existant, les options de
   Behavior periodique effectivement retenues (`loop`, `alternate`, `path`,
   bornes et interruption) ;
3. definir la frontiere exacte entre evaluation logique et materialisation pour
   HTML, SVG, canvas et Three.js ;
4. valider chaque capacite avec sa demo V2 correspondante, en utilisant la demo
   comme test visuel et non comme source de contrat ;
5. ajouter les tests de seek, remplacement, arret et absence d'emissions par
   frame.

Toute nouvelle capacite continue decouverte dans une demo doit d'abord etre
classe entre Behavior temporel, event/state, capture ou materializer
specialise, puis rattachee a cette note ou a la spec de sa capacite. Elle ne
doit pas etre ajoutee directement dans un strap ou dans un nouveau scheduler.

## Point de reprise : declaration des services dans les composants

### Correction validee le 2026-08-24 : base generique et base HTML separees

La reprise confirme un second ecart de frontiere : `BaseComponent` V2 est encore
une base de composant HTML/markup sous un nom generique. La presence de
`render(): string`, de `node`, de `_materialize()` et de la facade
`ComponentServices.apply(node, patch)` rend cette base dependante de la
materialisation HTML/SVG, meme lorsque les types restent `unknown`.

Le contrat vise est desormais le suivant :

```text
BaseComponent
  -> construction minimale, donnees auteur et update(state, time)

BaseHTMLComponent
  -> template markup, node, parts/outlets et services HTML/SVG

BaseCanvasComponent / BaseThreeComponent / BaseRiveComponent / ...
  -> contrat de projection propre au materializer et au substrat concerne
```

`BaseComponent` ne declare donc plus de service, de node, de part, ni de forme
de rendu. `render(): string`, la facade de services HTML et la materialisation
des parts sont deplaces dans `BaseHTMLComponent`. Les composants Three.js, Rive,
Canvas et autres materializers peuvent heriter de la base generique ou d'une
base specialisee sans recevoir une API DOM par defaut.

Cette correction implique le contrat `ComponentInput`, le catalogue de factories,
le materializer et les tests de frontiere. Elle doit etre implementee avant tout
nouveau composant de substrat specialise.

L'implementation V2 actuelle s'ecarte du contrat V1 sur la propriete de la
declaration des services.

En V1, le composant declare lui-meme les services dont il depend via
`this.services.declare([...])`. La declaration, son ordre et l'orchestration de
leur application appartiennent au composant. Le registry fournit les
implementations, mais ne decide pas a la place du composant de la liste qu'il
emploie. Voir
[v1-component-api.md:106](../../../../docs/formalisation/v1-component-api.md:106).

Dans V2, `TagComponent` et `MediaComponent` ne declarent pas leurs services.
La liste est actuellement placee dans `RuntimeComponentDefinition.services`,
par exemple dans
[create-core-runtime-catalog.ts:39](../../src/runtime/catalog/create-core-runtime-catalog.ts:39),
puis le catalogue injecte une facade deja construite dans `BaseComponent`.
`ComponentServices` n'expose actuellement que `apply(node, patch)`.

La possession d'une facade par `BaseComponent` n'est pas en elle-meme le
probleme : elle peut rester le point d'injection commun. L'ecart porte sur la
declaration et la surface :

```text
V1 : composant -> declare ses services -> registry -> implementation
V2 actuelle : catalogue -> impose la liste -> facade opaque au composant
```

Cette inversion a plusieurs consequences :

- le composant ne controle plus la liste ni l'ordre des services qu'il emploie ;
- il ne peut plus acceder proprement a un service nomme pour orchestrer son
  `update()` ;
- un service specialise de materialisation, par exemple `orbit` pour une
  camera Three.js, ne peut pas etre expose par la facade actuelle autrement
  qu'en le faisant passer indirectement dans un patch ;
- la declaration du composant est artificiellement dependante du catalogue
  choisi, alors qu'elle devrait rester abstraite et laisser le materializer
  fournir l'implementation ;
- les declarations actuelles `HTML_*_SERVICE` ne couvrent que le materializer
  HTML, ce qui ne constitue pas encore un support SVG, Canvas ou Three.js.

La reprise doit donc conserver une seule frontiere de registry/catalogue pour
l'enregistrement, la validation et les overrides core/foreign, mais remettre la
declaration des besoins au composant. Le flux vise est :

```text
composant -> declare les services abstraits
          -> catalogue de l'instance resout les noms
          -> materializer fournit les implementations adaptees
```

La facade devra aussi permettre l'usage individuel des services lorsque le
composant doit controler leur ordre ou dialoguer avec une capacite specialisee.
Cette evolution doit etre specifiee avant toute correction de `TagComponent`,
`MediaComponent` ou ajout d'un composant Canvas/Three.js. Il ne faut pas
ajouter un second catalogue, un service HTML parallele ou un patch local dans
les composants.
