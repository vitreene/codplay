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
matérialisée est le scrollport. L’adaptateur la résout par l’identité compilée
du perso à travers le résolveur HTML en lecture fourni par `runner-html`. Cette
résolution n’ajoute pas de `ScrollContainerSurface` à
`RuntimeComponentSurfaceMap` et n’est ni une API de façade ni une valeur
compilée.

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
d’un élément par perso, opérations `emit`/capture existantes et diagnostics.
Il ne transmet ni instance brute de runner/player, ni catalogue, ni registre
mutable de nodes ; `runner-html` possède l’ordonnancement des callbacks de cycle
de vie et du teardown. Le type `HtmlSourceAdapterFactory` est exporté par le
sous-chemin `codplay/runtime/runner-html`, et seul le point de composition de la
façade HTML consomme ce type.

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

Le pont `scroll-temp-capture-bridge` est interne à cette capacité et temporaire.
Il réutilise `RuntimePlayer.emit()`, `beginCompiledCapture()`,
`trackCapture()`, `endCapture()` et `cancelCapture()`. Il ne cherche pas de
cible, n’appelle pas directement `updateLive()` et n’est pas exporté comme API.

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

- Après `player.init()` et la matérialisation, l’adaptateur résout les
  scrollports et les racines persistantes des cibles via le résolveur HTML en
  lecture du hook, puis attache progress et observers.
- La progression continue pendant une pause temporelle et n’avance pas le
  temps CodPlay. Les phases d’intersection restent synchronisées pendant une
  pause, mais aucun event n’est émis hors de `playing` ou pendant un seek. Une
  action `liveAction` suit les ratios reçus pendant la pause.
- Pendant un seek, les callbacks IO ne produisent aucun event ; les événements
  déjà présents dans le journal ne sont pas réémis par l’observation. Le seek
  annule la session scroll ouverte avant la reconstruction. Il ne recherche pas
  de nouveau les ancêtres et ne réinitialise pas les règles `once`. Les actions
  live ne sont pas appliquées pendant la présentation reconstruite par le seek.
- La reprise ne rejoue pas les transitions d’intersection observées pendant la
  pause. Un seek ou replay ne relit jamais la géométrie du viewport pour
  reconstruire le journal.
- À `sequence:end`, le hook observe l’event dans le callback public existant,
  après sa présentation et avant la finalisation terminale du player. Il notifie
  l’adaptateur pour annuler la session avant l’annulation technique des sources.
  À la destruction, il annule la session, détache listener et observers, puis
  invalide la queue.
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
- [`scroll-container-providers.spec.ts`](../../authoring/component-v2/tests/scroll-container-providers.spec.ts)
  vérifie le cycle de vie des providers, le calcul et la coalescence du
  progress, ainsi que l’ordre des transitions d’observation.
- La scène réelle de validation est
  [`main.ts`](../../demos/src/v2/demos/scroll-container/main.ts). La validation
  navigateur de la feature a été confirmée par l’utilisateur ; ce constat ne
  prétend pas que le test unitaire couvre à lui seul le parcours navigateur ou
  chaque diagnostic de déclaration.

## Validation d’implémentation

Le 2026-09-25, les suites `codplay` (107 fichiers, 691 tests) et
`component-v2` (10 fichiers, 44 tests), les tests ciblés capture/player/runner
HTML/compilation/position (6 fichiers, 41 tests), les trois typechecks et le
build des démos ont réussi. Safari automatisé a monté la démo et observé le
défilement, mais sa page était masquée et n’a pas validé le cycle Play/Seek
complet. L’utilisateur a confirmé la validation navigateur du comportement
scroll.

Ces vérifications et la confirmation utilisateur clôturent la capacité scroll
décrite ici.
