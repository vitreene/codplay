# CodPlay V2 — scroll-container

## Périmètre vérifié

Le contrat de la capacité scroll-container a été validé le 2026-09-25.

Cette spécification définit la capacité optionnelle `scroll-container` de
CodPlay V2 : une source de progress géométrique, les observations
`IntersectionObserver` déclarées par des persos descendants et la capture
facultative d’une activité de scroll. Le scroll ne commande pas le temps
logique CodPlay.

## Enregistrement optionnel

La capacité est fournie hors du catalogue runtime core. Son intégration expose
une définition de composant `scroll-container` et une définition de module
player-scoped. Les deux sont enregistrées via
`CodPlayEngineOptions.components` et `CodPlayEngineOptions.modules`.

Une scène qui utilise la capacité déclare ses requirements compilés. Si le
composant ou le module n’est pas enregistré, l’engine refuse l’initialisation
selon le contrôle de requirements existant. En leur absence, le catalogue core
ne crée aucun composant scroll, provider ou observer. Aucun registre générique
de providers n’est ajouté.

Le composant est matérialisé par le circuit HTML existant. Sa racine HTML
matérialisée est le scrollport. Après la matérialisation, le runtime assigne
cette racine à `BaseHTMLComponent.node`, puis appelle
`ScrollContainerComponent.initialize()` avant son premier update. Le composant
résout son propre node à cette étape ; la progression et la capture attachent
leurs listeners à cette racine. Aucune `ScrollContainerSurface` n’est ajoutée
à `RuntimeComponentSurfaceMap` et le node n’est ni une API de façade ni une
valeur compilée.

La définition de module runtime et son contexte restent neutres par rapport à
la matérialisation. La factory de l’adaptateur de source HTML est fournie
séparément à la frontière `runner-html` par l’hôte HTML ; elle n’est pas un
hook de `RuntimeModuleServiceDefinition` et ne traverse ni le catalogue, ni
`RuntimeModuleServiceContext`, ni `CompiledScene`. Les types DOM et l’accès aux
surfaces/nœuds de présentation restent confinés à cette intégration HTML.
La façade la transmet par
`CodPlayOptions.htmlHost.sourceAdapterFactories`, séparément de
`CodPlayEngineOptions`, puis `createInstanceHost` la fournit aux
`HtmlPlayerRunnerOptions`. Le hook expose un contexte borné : lecture de la
scène compilée et de la scène résolue, accès à l’état/temps du player, résolution
d’un élément par perso, `emit`, actions live et diagnostics. Il ne transmet ni
instance brute de runner/player, ni commandes bas niveau de capture, ni
catalogue, ni registre mutable de nodes. Il ne résout pas le node scrollport et
ne pilote pas sa progression ou sa capture ; il attache les observations des
descendants à leurs racines logiques. `runner-html` possède l’ordonnancement
des callbacks de cycle de vie et du teardown. Le type
`HtmlSourceAdapterFactory` est exporté par le sous-chemin
`codplay/runtime/runner-html`, et seul le point de composition de la façade
HTML consomme ce type.

Le hook est générique aux factories de sources HTML optionnelles. Un module peut
fournir une telle factory lorsqu’il a besoin d’une source navigateur ; cela ne
rend pas `RuntimeModuleServiceDefinition` dépendant d’un runner et ne constitue
pas un hook générique de module.

## Composant auteur

Le `PersoDoc<'scroll-container'>` reprend le profil du composant `tag` et
ajoute les réglages de progression :

```ts
import type { TagInitial } from 'codplay/runtime/components'

type ScrollContainerInitial = Omit<TagInitial, 'content'> & Readonly<{
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

`ScrollContainerComponent.initialize()` attache `scroll`, `scrollend`, resize
élément et resize viewport à la racine déjà matérialisée. Il calcule la
progression à l’initialisation puis coalesce les samples à une présentation.
Au premier sample utile, il ouvre la source `(storyId, persoId, 'scroll')` via
le port de capture player-scoped fourni au composant. Il lui transmet les
samples et la frontière `scrollend`, sans choisir la règle ou l’event compilé.
Le composant retire ses listeners à `sequence:end` et à la destruction ; un
reset du player les rattache.

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
routage ; l’adaptateur scroll ne crée pas de chemin de dispatch spécifique.

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
`delay` reste hors de cette tranche. `root` reste logique et est résolu depuis
le parentage du perso ; aucun node DOM n’est une valeur auteur. `threshold`
accepte la forme native, un nombre ou une liste de nombres. Il contrôle les
notifications de l’observer ; `enter` et `leave` suivent `isIntersecting` et,
si `trackVisibility` est activé, `isVisible`. Les sorties
`enter`/`leave` réutilisent `AuthorEmitEvent` et peuvent déclarer `once: true`.
Sans `once`, chaque transition de phase émet l’event. Avec `once`, cet event ne
peut être émis qu’une fois pendant la vie du player ; un seek ne réarme pas ce
choix. La phase ne conserve que `inside` ou `outside` : le premier callback
synchronise la phase sans event, une phase inchangée n’émet rien, et une
transition ultérieure produit les events déclarés. Les transitions d’un même
batch sont traitées dans l’ordre des déclarations compilées.

Au premier callback, la phase est synchronisée sans event, mais une action
`liveAction` reçoit quand même le ratio de cette première mesure.

Après la première matérialisation, l’adaptateur résout une fois le parentage
logique courant. Sans `root`, il prend le premier scroll-container en remontant
depuis le parent du perso ; avec `root`, il cherche cet ancêtre précis. La
liaison reste attachée à ce scrollport pendant la durée de vie du player. Un
`move` ultérieur ne relance pas la recherche dans cette première tranche.
L’ascendance vient du graphe de persos résolu, jamais de l’ascendance DOM. Le
callback initial de l’observer synchronise la phase sans produire d’event.

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

- Après matérialisation, `ScrollContainerComponent.initialize()` attache la
  progression et la capture à son node. Après `player.init()`, l’adaptateur
  d’observation résout les racines persistantes des cibles via le résolveur HTML
  en lecture et la scène logique résolue ; il n’attache aucun listener de
  progression ou de capture au scrollport.
- La progression continue pendant une pause temporelle et n’avance pas le
  temps CodPlay. Les phases d’intersection restent synchronisées pendant une
  pause, mais aucun event n’est émis hors de `playing` ou pendant un seek. Une
  action `liveAction` suit les ratios reçus pendant la pause.
- Pendant un seek, le composant suspend sa source et annule sa session ; après
  la reconstruction il reprend la progression. Les callbacks IO ne produisent
  aucun event ; les événements
  déjà présents dans le journal ne sont pas réémis par l’observation. Le seek
  annule la session scroll ouverte avant la reconstruction. Il ne recherche pas
  de nouveau les ancêtres et ne réinitialise pas les règles `once`. Les actions
  live ne sont pas appliquées pendant la présentation reconstruite par le seek.
- La reprise ne rejoue pas les transitions d’intersection observées pendant la
  pause. Un seek ou replay ne relit jamais la géométrie du viewport pour
  reconstruire le journal.
- À `sequence:end`, le hook observe l’event dans le callback public existant,
  après sa présentation et avant la finalisation terminale du player. Le
  composant annule sa session et détache ses listeners ; l’adaptateur annule
  ses observers. À la destruction, le composant retire ses ressources DOM et
  l’adaptateur déconnecte ses observers et invalide sa file d’émissions.
- L’adaptateur ne possède ni runner, ni player, ni journal parallèle et
  n’expose aucune cible DOM à l’auteur ou à la démo.

## Validation de la déclaration et diagnostics

La compilation vérifie les exigences du composant et du module, le nom du tag,
la forme de `emit.observe`, l’existence d’une action TweenAction déclarée par
`liveAction` sur le perso observé, l’existence du scroll-container désigné par
`root` dans la même story, le seuil, les options de visibilité, les events
déclarés et les combinaisons invalides. Après la première matérialisation,
l’adaptateur valide l’ascendance réelle sur le graphe logique courant et signale
un root absent ou non ancêtre. Aucun provider ni classe runtime n’est instancié
pendant la compilation.

Les profils invalides produisent des diagnostics auteur avant l’initialisation
du player. Les options natives non supportées produisent un diagnostic runtime
et ne créent pas un circuit alternatif. Les formes inconnues, dont `delay`,
sont refusées.

## Fichiers de preuve et portée

- Le contrôle des déclarations auteur dans CodPlay est
  [`scroll-observation-validation.ts`](../src/scene/compiled/scroll-observation-validation.ts).
  La validation et l’adaptation du composant sont dans
  [`scroll-container-validation.ts`](../../authoring/component-v2/src/scroll-container/scroll-container-validation.ts),
  [`scroll-container-component.ts`](../../authoring/component-v2/src/scroll-container/scroll-container-component.ts)
  et [`scroll-container-source-adapter.ts`](../../authoring/component-v2/src/scroll-container/scroll-container-source-adapter.ts).
- Le circuit commun source → règle compilée → session player est dans
  [`capture-source-circuit.ts`](../src/runtime/capture/capture-source-circuit.ts).
- [`scroll-container-component-source.spec.ts`](../../authoring/component-v2/tests/scroll-container-component-source.spec.ts)
  vérifie que l’initialisation attache au node matérialisé, coalesce les
  samples, termine à `scrollend` et gère seek, sequence-end, reset et teardown.
- [`scroll-container-player-integration.spec.ts`](../../authoring/component-v2/tests/scroll-container-player-integration.spec.ts)
  exerce la matérialisation DOM, le vrai `HtmlPlayerRunner`, le contrôleur de
  capture, le journal, seek et destruction.
- [`scroll-container-providers.spec.ts`](../../authoring/component-v2/tests/scroll-container-providers.spec.ts)
  vérifie le cycle de vie des providers, le calcul et la coalescence du
  progress, ainsi que l’ordre des transitions d’observation.
- [`capture-source-circuit.spec.ts`](../tests/runtime/capture/capture-source-circuit.spec.ts)
  vérifie la sélection par identité/source et le routage de l’événement
  d’ouverture selon les portées implicite, `story`, `scene` et `public`.
- La scène réelle de validation est
  [`main.ts`](../../demos/src/v2/demos/scroll-container/main.ts). La validation
  navigateur de la feature a été confirmée par l’utilisateur ; ce constat ne
  prétend pas que le test unitaire couvre à lui seul le parcours navigateur ou
  chaque diagnostic de déclaration.

## Validation d’implémentation

La validation navigateur du comportement scroll a été confirmée par
l’utilisateur le 2026-09-25. La vérification de l’attachement au node
matérialisé et du cycle seek/teardown repose maintenant aussi sur le test
d’intégration avec `HtmlPlayerRunner` décrit ci-dessus.

Le 2026-09-26, après le déplacement de la source vers
`ScrollContainerComponent.initialize()` et l’unification du circuit, les suites
CodPlay (108 fichiers, 710 tests) et `component-v2` (12 fichiers, 47 tests),
les typechecks CodPlay, `component-v2` et démos V2, ainsi que le build V2 ont
réussi. Le test `scroll-container-player-integration.spec.ts` vérifie dans le
vrai `HtmlPlayerRunner` les événements DOM, la session player, le journal, le
seek et le teardown.
