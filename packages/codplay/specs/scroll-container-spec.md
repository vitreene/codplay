# CodPlay V2 — scroll-container

> Version de référence : CodPlay V2 — 2026-11-10.

## Périmètre vérifié

Cette spécification définit le type core `scroll-container` de CodPlay V2 :
le composant qui rend le scrollport, et les deux sources HTML du runner qui s'y
rattachent — la progression géométrique, avec la capture facultative d’une
activité de scroll, et les observations `IntersectionObserver` déclarées par
des persos descendants. Le scroll ne commande pas le temps logique CodPlay.

## Répartition des responsabilités

`scroll-container` est enregistré dans le catalogue core ; aucune intégration
n’a de composant, de module ou d’adaptateur à fournir. Ses identifiants restent
`scroll-container`.

- Le composant [`ScrollContainerComponent`](../src/runtime/components/scroll-container/scroll-container-component.ts)
  dérive de `BaseHTMLComponent` et applique les services `className`, `style`
  et `attr` à sa racine. Sa racine matérialisée est le scrollport. Il ne lit pas
  le défilement et n’ouvre aucune capture.
- La progression est une source HTML du runner,
  [`HtmlScrollProgressSource`](../src/runtime/runner-html/scroll-container/scroll-progress-source.ts),
  au même titre que la source pointeur. Elle alimente le circuit de capture
  commun.
- L’observation est une source HTML du runner,
  [`HtmlScrollObservationSource`](../src/runtime/runner-html/scroll-container/scroll-observation-source.ts).
  Elle réutilise les circuits `emit` et actions live du player et n’ouvre pas
  de session de capture.

`HtmlPlayerRunner` crée ces deux sources avant celles fournies par
`CodPlayOptions.htmlHost.sourceAdapterFactories`, et leur transmet le même
contexte borné ainsi que les mêmes frontières de cycle de vie : attache après
`init()`, reset après celui des composants, seek, `sequence:end` et
destruction. La source de progression reçoit en plus le port de capture
player-scoped. Les types DOM restent confinés au runner HTML ; la définition du
composant ne déclare aucun module.

## Composant auteur

Le `PersoDoc<'scroll-container'>` décrit sa racine (`tag`, `className`,
`style`, `attr`), sans contenu, et ajoute les réglages de progression. Le nom de
tag suit la validation du composant `tag` ; `div` est le défaut :

```ts
import type { ScrollContainerInitial } from 'codplay'

// Forme de ScrollContainerInitial :
type ScrollContainerShape = Readonly<{
  tag?: string
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
  values?: Readonly<{
    progress?: Readonly<{
      axis?: 'block' | 'inline'
      range?: 'scrollport'
    }>
  }>
}>
```

`tag` décrit l’unique élément HTML racine du conteneur. Par exemple :

```ts
initial: {
  tag: 'section',
  attr: { id: 'chapter-scroll-root' },
  style: { height: '24rem', overflowY: 'auto' },
}
```

Cet élément matérialisé est le scrollport. Le composant ne crée aucun layout et
ne lui impose ni hauteur ni `overflow`. Il ne porte pas de champ `content` : le
texte et les autres enfants sont des persos de la story, placés dans le
conteneur par leur `move.target`. Aucun enfant n’est ajouté au markup du
scroll-container.

`values.progress.axis` vaut `block` par défaut ; `inline` sélectionne l’axe
inline. `range` accepte uniquement `scrollport`. Pour l’axe choisi,
progress vaut `clamp(offset / (scrollExtent - viewportExtent), 0, 1)` ; il vaut
`0` lorsque l’étendue défilable est nulle. Le calcul initial a lieu après
matérialisation et se recalcule au scroll, au resize et lors d’une invalidation
de géométrie autorisée. Les notifications avant une même présentation sont
coalescées à la dernière valeur.

## Capture d’activité de scroll

La déclaration auteur utilise `Perso.emit.scroll.capture`, le contrat capture
existant. Une activité commence au premier sample utile, après l’émission
unique de l’event de début éventuel ; elle se ferme à `scrollend` par
`endCapture`. Un seek, un détachement, `sequence:end`, une destruction ou une
erreur annule la session sans event de fermeture.

À l’attache, la source de progression retient chaque perso `scroll-container`
qui déclare une capture `scroll`, et attache `scroll`, `scrollend`, resize
élément et resize viewport à sa racine matérialisée. Elle calcule la
progression à l’attache puis coalesce les samples à une présentation. Au
premier sample utile, elle ouvre la source `(storyId, persoId, 'scroll')` via
le port de capture player-scoped. Elle lui transmet les samples et la frontière
`scrollend`, sans choisir la règle ou l’event compilé. Elle retire ses
listeners à `sequence:end` et à la destruction ; un reset du player les
rattache.

Le port est servi par le circuit commun
[`RuntimeCaptureSourceCircuit`](../src/runtime/capture/capture-source-circuit.ts).
Ce circuit résout ensemble la règle `emit.scroll`, son event de départ et sa
déclaration capture depuis l’identité compilée. Il émet l’event par le player,
ouvre la session existante, conserve l’ordre des samples reçus pendant
l’ouverture puis conduit tracking, fermeture et annulation. Un event de départ
rejeté n’ouvre pas de session. L’adaptateur pointeur utilise le même circuit ;
il garde uniquement la conversion des événements natifs et l’appariement des
pointeurs.

L’événement d’ouverture réutilise la portée `visibility` du contrat capture
commun. Sans portée ou avec `story`, il vise la story du scroll-container ;
`scene` et `public` utilisent la cible globale. Le résolveur partagé porte ce
routage ; la source scroll ne crée pas de chemin de dispatch spécifique.

Pour cette source, `trackCommand` peut retourner une collection ordonnée
d’actions live :

```ts
type AuthorCaptureTrackOutput = Readonly<{
  actions?: readonly Readonly<{
    name: string
    data?: Record<string, unknown>
  }>[]
  captureState?: Record<string, unknown>
  updateState?: Record<string, unknown>
}>
```

Chaque `name` désigne une action déjà compilée dans `CompiledPerso.actions`.
Le player résout les cibles à partir de l’index compilé et applique les
actions dans l’ordre déclaré par `trackCommand`, via le circuit live existant
du composant et du materializer. La collection `actions` ne produit aucun
event et n’ajoute aucun sample au journal. `captureState`, `updateState`, les
sorties `endEmit`/`endCapture`, le journal et le seek conservent leur contrat.
Une collection absente ou vide retire les actions live précédentes de cette
session. Cette extension ne rend pas `trackCommand` obligatoire pour les autres
captures.

Pour une déclaration scroll sans `trackCommand`, CodPlay produit un warning
auteur, n’applique pas d’action live et ne fabrique aucune action de
remplacement. `endCapture` peut conserver des faits de l’activité scroll pour
leur relecture ; ses events de fin sont persist-only et ne changent pas
l’affichage courant. Si la scène doit conserver la dernière valeur progress
affichée après la fermeture de l’activité, `trackCommand` la place dans
`captureState`, puis `endEmit` produit à la fermeture un event ordinaire dont
l’action réapplique cette valeur. Cet event de fin apparaît une fois par
activité, jamais une fois par sample. Il conserve la valeur finale sans
enregistrer la trajectoire scroll.

## Observation des descendants

Une règle `observe` est portée par le perso observé dans `Perso.emit`. La
variante est exclusive de `event` et `capture` sur cette règle :

```ts
type ScrollObservationDeclaration = Readonly<{
  root?: string
  initial?: 'enter' | 'leave'
  liveAction?: string
  zone?: Readonly<{
    rootMargin?: string
    scrollMargin?: string
    threshold?: number | readonly number[]
    trackVisibility?: boolean
  }>
  enter?: readonly (AuthorEmitEvent & Readonly<{ once?: true }>)[]
  leave?: readonly (AuthorEmitEvent & Readonly<{ once?: true }>)[]
}>
```

`emit.observe` est la déclaration directe portée par le perso observé. `root`
référence l’identité logique (`perso.id`) d’un scroll-container parent et ne
sert qu’à désambiguïser plusieurs ancêtres possibles. Sans `root`, le premier
parent scroll-container est retenu. Une référence non ancêtre ou un perso sans
parent scroll-container est invalide. Aucun id de cible ni référence DOM n’est
ajouté à la déclaration : le perso qui porte `observe` est la cible.

`liveAction`, s’il est présent, désigne une action TweenAction déjà déclarée
dans `actions` sur le même perso. À chaque notification de l’observer, le
player applique cette action par l’index compilé des actions et le circuit live
commun. Sa fonction ACE reçoit `input.data.ratio`, le `intersectionRatio` natif
compris entre `0` et `1`, en plus des données de l’action. L’auteur peut ainsi
produire une couleur ACE à partir de la proportion visible. La fréquence des
mises à jour suit les seuils déclarés dans `zone.threshold`.

Cette sortie live n’est pas un event : elle n’ajoute aucune entrée au journal,
ne déclenche ni `listen` ni strap. Les events `enter` et `leave` restent
inchangés et continuent d’utiliser `RuntimePlayer.emit()`. Les callbacks
d’observation sont ignorés pendant le seek ; le player n’applique pas d’action
live pendant la présentation du seek. Les présentations normales réappliquent
la dernière valeur reçue de la source live, sans la lire depuis le journal.

La zone expose `rootMargin`, `scrollMargin`, `threshold` et `trackVisibility`.
`delay` est exclu de ce profil. `root` reste logique et est résolu depuis
le parentage du perso ; aucun node DOM n’est une valeur auteur. `threshold`
accepte la forme native, un nombre ou une liste de nombres. Il contrôle les
notifications de l’observer ; `enter` et `leave` suivent `isIntersecting` et,
si `trackVisibility` est activé, `isVisible`. Les sorties
`enter`/`leave` réutilisent `AuthorEmitEvent` et peuvent déclarer `once: true`.
Sans `once`, chaque transition de phase émet l’event. Avec `once`, cet event ne
peut être émis qu’une fois pendant la vie du player ; un seek ne réarme pas ce
choix. La phase ne conserve que `inside` ou `outside` : par défaut, le premier
callback synchronise la phase sans event, une phase inchangée n’émet rien, et
une transition ultérieure produit les events déclarés. `initial: 'enter'`
autorise l’event `enter` si la première phase est `inside`, et
`initial: 'leave'` fait de même pour `leave` si elle est `outside` ; une
première mesure dans l’autre phase ne produit rien. Les transitions d’un même
batch sont traitées dans l’ordre des déclarations compilées.

Au premier callback, la phase est synchronisée. Une action `liveAction` reçoit
quand même le ratio de cette première mesure ; une déclaration `initial`
compatible peut en plus produire l’event de phase correspondant. Si cette
première mesure correspond à `initial` pendant l’état `ready`, la source
diffère cette seule émission jusqu’au passage à `playing`, par le callback de
cycle de vie existant et le port player existant. Elle l’annule si la phase de la
cible change avant la lecture. Les transitions ordinaires observées en `ready`
ne sont pas rejouées.

Après la première matérialisation, la source résout une fois le parentage
logique courant. Sans `root`, il prend le premier scroll-container en remontant
depuis le parent du perso ; avec `root`, il cherche cet ancêtre précis. La
liaison reste attachée à ce scrollport pendant la durée de vie du player. Un
`move` ultérieur ne relance pas la recherche.
L’ascendance vient du graphe de persos résolu, jamais de l’ascendance DOM. Le
callback initial de l’observer synchronise la phase ; l’option `initial` peut
demander l’émission déclarative de l’event correspondant.

Les observers qui partagent exactement le même root et les mêmes options sont
mutualisés. La phase reste propre à chaque cible et règle. Les transitions
`enter`/`leave` produisent des events ordinaires par `RuntimePlayer.emit()` ;
elles suivent le journal, `listen`, les straps et les actions existants. Une
transition n’est pas envoyée dans le circuit capture. Les mises à jour de
`liveAction` passent par le circuit player commun des actions live et restent
hors du journal.

Les déclarations compilées conservent l’identité du perso porteur et l’ordre
issu du chemin de déclaration. Elles sont immuables et JSON-safe. Aucun node
DOM, `IntersectionObserverEntry`, `DOMRect` ou callback natif ne traverse la
compilation ou n’est placé dans `event.data`. Seul le nombre
`intersectionRatio` est transmis à l’action live sous `input.data.ratio`.
L’adaptateur DOM ignore la variante `observe` du dispatch d’events natifs
ordinaires.

## Cycle de vie et frontières

- Après `player.init()`, la source de progression attache ses listeners aux
  scrollports qui déclarent une capture `scroll`, et la source d’observation
  résout les racines persistantes des cibles via le résolveur HTML en lecture
  et la scène logique résolue ; elle n’attache aucun listener de progression
  ou de capture au scrollport.
- La progression continue pendant une pause temporelle et n’avance pas le
  temps CodPlay. Les phases d’intersection restent synchronisées pendant une
  pause, mais aucun event n’est émis hors de `playing` ou pendant un seek. Une
  action `liveAction` suit les ratios reçus pendant la pause. La reprise ne
  rejoue pas les transitions observées pendant la pause ; les émissions
  initiales en attente ne concernent que l’état `ready`.
- Pendant un seek, la source de progression suspend son échantillonnage et
  annule sa session ; après la reconstruction elle reprend la progression. Les callbacks IO ne produisent
  aucun event ; les événements
  déjà présents dans le journal ne sont pas réémis par l’observation. Le seek
  annule la session scroll ouverte et les émissions initiales différées avant
  la reconstruction. Il ne recherche pas de nouveau les ancêtres et ne
  réinitialise pas les règles `once`. Les actions live ne sont pas appliquées
  pendant la présentation reconstruite par le seek.
- La reprise ne rejoue pas les transitions d’intersection observées pendant la
  pause. Un seek ou replay ne relit jamais la géométrie du viewport pour
  reconstruire le journal.
- À `sequence:end`, le hook observe l’event dans le callback public existant,
  après sa présentation et avant la finalisation terminale du player. Le
  source de progression annule sa session et détache ses listeners ; la source
  d’observation annule ses observers. À la destruction, la source de
  progression retire ses listeners et la source d’observation déconnecte ses
  observers et invalide sa file d’émissions.
- Au reset explicite du player, `ScrollContainerComponent.onReset()` ramène à
  zéro la position du scrollport sur l’axe de progression configuré (`scrollTop`
  pour `block`, `scrollLeft` pour `inline`) ; la source de progression
  rattache ensuite ses listeners et échantillonne. La coordonnée de l’autre axe reste inchangée. Ce comportement suit le
  hook de reset existant ; il ne change pas les règles d’observation `once`.
- Les sources ne possèdent ni runner, ni player, ni journal parallèle et
  n’exposent aucune cible DOM à l’auteur ou à la démo.

## Validation de la déclaration et diagnostics

La compilation vérifie le nom du tag,
la forme de `emit.observe`, l’existence d’une action TweenAction déclarée par
`liveAction` sur le perso observé, l’existence du scroll-container désigné par
`root` dans la même story, le seuil, les options de visibilité, les events
déclarés et les combinaisons invalides. Après la première matérialisation,
la source d’observation valide l’ascendance réelle sur le graphe logique courant et signale
un root absent ou non ancêtre. Aucun provider ni classe runtime n’est instancié
pendant la compilation.

Les profils invalides produisent des diagnostics auteur avant l’initialisation
du player. Les options natives non supportées produisent un diagnostic runtime
et ne créent pas un circuit alternatif. Les formes inconnues, dont `delay`,
sont refusées.

## Fichiers de preuve et portée

- Le contrôle des déclarations auteur est
  [`scroll-observation-validation.ts`](../src/scene/compiled/scroll-observation-validation.ts) ;
  celui du profil est
  [`scroll-container-validation.ts`](../src/runtime/components/scroll-container/scroll-container-validation.ts).
- Le composant est
  [`scroll-container-component.ts`](../src/runtime/components/scroll-container/scroll-container-component.ts) ;
  les sources sont dans
  [`runtime/runner-html/scroll-container/`](../src/runtime/runner-html/scroll-container/).
- Le circuit commun source → règle compilée → session player est dans
  [`capture-source-circuit.ts`](../src/runtime/capture/capture-source-circuit.ts).
- [`scroll-container-sources.spec.ts`](../tests/runtime/runner-html/scroll-container-sources.spec.ts)
  vérifie le calcul de la progression, l’attache au scrollport, la coalescence
  des samples, la fin à `scrollend`, le seek, la fin de séquence, le reset et
  le teardown de la source ; le reset du composant sur l’axe configuré ; et
  l’ordre des transitions d’observation.
- [`scroll-container-player-integration.spec.ts`](../tests/runtime/runner-html/scroll-container-player-integration.spec.ts)
  exerce la matérialisation DOM, le vrai `HtmlPlayerRunner`, le contrôleur de
  capture, le journal, seek et destruction.
- [`scroll-container-observation-integration.spec.ts`](../tests/runtime/runner-html/scroll-container-observation-integration.spec.ts)
  exerce les émissions initiales différées, leur annulation par seek, reset,
  fin de séquence et destruction, et la resynchronisation après reset avec les
  actions live.
- [`capture-source-circuit.spec.ts`](../tests/runtime/capture/capture-source-circuit.spec.ts)
  vérifie la sélection par identité/source et le routage de l’événement
  d’ouverture selon les portées implicite, `story`, `scene` et `public`.
- La scène réelle de validation est
  [`main.ts`](../../demos/src/v2/demos/scroll-container/main.ts). Elle
  utilise le même composant, le même circuit capture et les mêmes sources que
  les intégrations applicatives.
