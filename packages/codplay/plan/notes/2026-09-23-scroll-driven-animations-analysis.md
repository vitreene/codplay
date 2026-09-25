# Animations scroll-driven — étude d'intégration CodPlay V2

> Statut : **Obsolète** — les décisions actives sont portées par
> [`2026-09-23-scroll-container-integration-plan.md`](../2026-09-23-scroll-container-integration-plan.md)
> et [`scroll-container-spec.md`](../../specs/scroll-container-spec.md). Ce
> document ne fait plus autorité pour l’implémentation.
>
> Date : 2026-09-23
>
> Périmètre : animation liée au scroll, conditions d'apparition/disparition et
> éventuelle émission d'events dans une scène CodPlay V2.

## Conclusion

Le scroll ne doit pas devenir une horloge CodPlay ni un flux d'events.

- Une animation proportionnelle et réversible au défilement reçoit une valeur
  géométrique vivante `g`. Cette valeur alimente une **projection de
  présentation** dont les interpolations sont évaluées par **ACE**. Elle ne
  touche ni le player, ni le journal, ni `instance.telco`.
- Une apparition, une disparition ou le franchissement d'un seuil est un
  **changement discret de condition**. `IntersectionObserver` peut le réduire
  à un event CodPlay déclaré, journalisé et rejouable par le circuit V2 actuel.
  Il n'émet que sur transition d'état.
- Ce second cas n'est **pas une capture**. Une capture traite un échantillonnage
  dense dans une session bornée, pilote éventuellement une pose live et ne
  journalise qu'à sa fermeture. Le scroll est une condition ambiante, sans
  début, fin ou commit qui lui soit propre.
- Un **strap n'est pas la source** : il consomme un event déjà arrivé. La bonne
  extension, si le besoin est confirmé, est une capacité d'observation déclarée
  et player-scoped, avec un adaptateur HTML qui possède `IntersectionObserver`.
  Le strap reste alors libre de produire les events dérivés ordinaires.

Cette direction préserve le flux V2 unique :

```text
scroll / géométrie navigateur
  ├─ source continue ──> progression g ──> driver de présentation
  │                                      ──> ACE ──> composant propriétaire du DOM
  └─ IntersectionObserver ──> réduction de phase ──> event déclaré
                                                    ──> journal -> listen -> straps -> état(t)
```

L'hypothèse d'une construction CodPlay non reconstructible — exécuter des
events live sans journal et sans seek historique — est hors périmètre de cette
étude. C'est un projet architectural central distinct ; elle ne devient ni une
option locale de scroll, ni une clause cachée de `IntersectionObserver`.

`ScrollTimeline`, `ViewTimeline` et les fonctions CSS associées restent des
ressources utiles pour comprendre ou, sous réserve d’une décision de support,
obtenir la valeur `g`. Elles ne sont pas la cible de transformation envisagée :
les valeurs appliquées par CodPlay passent par ACE et par le composant runtime,
jamais par une animation CSS autonome.

## 1. Deux progressions, deux contrats

| Sujet | Progress temporel CodPlay | Progress géométrique du scroll |
|---|---|---|
| Variable | `t`, en millisecondes logiques | `g`, position/range de scroll ou position d'un sujet dans un scrollport |
| Source | ticker/engine, média master éventuel, `telco.seek()` | offsets et géométrie du navigateur, ou une timeline navigateur comme source facultative |
| Domaine | état logique, eventimes, tracks, behaviors ACE temporels | driver vivant de présentation, résolu par ACE à partir de `g` |
| Seek/replay | `state(t)` est reconstruit depuis le journal ; les straps ne sont pas rejoués | une nouvelle géométrie est lue par le navigateur au moment présent ; elle n'est pas reconstruite depuis un journal |
| Pause/rate | définis par le player | le scroll reste contrôlé par l'utilisateur et par le navigateur ; ni `rate`, ni pause CodPlay ne le définissent |
| Variation | le même journal et le même `t` doivent donner le même état logique | un resize, un changement de contenu, une barre d'outils mobile ou un autre scrollport peuvent changer `g` sans changer `t` |

Une `ScrollTimeline` est finie : son 0 % et son 100 % viennent de l'étendue
scrollable. Elle devient inactive en l'absence d'overflow. Une `ViewTimeline`
décrit au contraire le parcours géométrique d'un sujet dans son scrollport.
Ces valeurs sont des pourcentages de parcours, non des millisecondes ; les
convertir implicitement en `timelineMs` ferait dépendre l'état logique d'un
layout non rejouable.

En conséquence :

1. `instance.telco.getProgress()` et `seek()` gardent exclusivement leur
   signification temporelle actuelle.
2. `instance.projection.setInputValue()` n'est pas un canal générique pour le
   scroll : son contrat est limité à la valeur scalaire d'un composant `input`,
   sans état logique ni journal.
3. Un éventuel « scroll qui scrube le temps CodPlay » serait un contrôleur de
   transport explicite, avec son propre contrat de bijection, de pause, de
   resize et de `seek`. Ce n'est pas une conséquence des scroll-driven
   animations et ne doit pas être introduit dans cette tranche.

## 2. Ressources web pertinentes

| Besoin | Mécanisme | Ce qu'il apporte | Limite ou rôle dans CodPlay |
|---|---|---|---|
| Progression continue de tout un scrollport | listener `scroll` passif + lecture des dimensions ; éventuellement `ScrollTimeline` | une source pour calculer `g` de 0 à 1 | chaque notification est coalescée vers une mise à jour de présentation ; aucun event CodPlay par notification |
| Progression continue du parcours d'un élément | géométrie du root et du sujet ; éventuellement `ViewTimeline` | modèle de parcours distinct du scroll global | le contrat CodPlay définit les bornes de `g` |
| Interpolation des valeurs à présenter | ACE | valeurs `from`/`to` et easing dans le moteur de CodPlay | ACE ne possède aujourd'hui que le contrat temporel `resolveTween(tween, instant)` ; un contrat piloté par `g` est à concevoir |
| Apparition/disparition ou seuils sémantiques | `IntersectionObserver` | émetteur de transitions déclarées avec le `root` du conteneur, `rootMargin`, `scrollMargin`, `threshold`, `trackVisibility` et `delay` | l'adaptateur réduit chaque transition à un ou plusieurs events CodPlay |
| Fin d'un geste de défilement | `scrollend` | émetteur d'un fait de stabilisation et point où une position de scroll peut être capturée | l'event peut être `persist-only` et inscrire la géométrie dans le temps |
| Transformation CSS directe | `animation-timeline`, `scroll()`, `view()` | solution native de présentation dans le navigateur | hors cible : CodPlay ne la choisit pas comme writer de propriétés ; la progression peut seulement inspirer ou fournir une source à `g` |

Un listener `scroll` n'implique pas une masse d'events applicatifs : il est un
capteur local de valeur. Le browser peut le notifier souvent ; l'adaptateur ne
conserve que la dernière valeur et programme au plus une application de la
présentation pour le prochain rendu. `requestAnimationFrame` n'est donc pas
présenté comme un ralentisseur du taux de `scroll` — MDN avertit qu'il est
souvent appelé à une cadence comparable — mais comme la frontière naturelle
entre plusieurs lectures successives et une unique écriture de présentation.

`IntersectionObserver` est ici traité pour ce qu'il est : une source de
transitions de conditions géométriques. L'adaptateur transforme ses entrées en
events déclarés lors des seules transitions `outside -> inside` et
`inside -> outside` de chaque règle.

Sources primaires et documentaires consultées :

- [CSS Scroll-driven Animations Level 1](https://www.w3.org/TR/scroll-animations-1/) ;
- [MDN — scroll-driven animation timelines](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines) ;
- [MDN — `ScrollTimeline`](https://developer.mozilla.org/en-US/docs/Web/API/ScrollTimeline) ;
- [Intersection Observer specification](https://www.w3.org/TR/intersection-observer/) ;
- [MDN — Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) ;
- [MDN — événement `scroll`](https://developer.mozilla.org/en-US/docs/Web/API/Document/scroll_event) ;
- [MDN — `scrollend`](https://developer.mozilla.org/en-US/docs/Web/API/Document/scrollend_event) ;
- [MDN — préférences de réduction de mouvement](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).

Une étude locale fournie pour cette réflexion, `scroll-timeline-compression.md`,
apporte la proposition de simplification par keyframes, détection des pauses et
inversions, Ramer–Douglas–Peucker et progression fractionnaire.

La conversation ChatGPT partagée dans la demande n'a pas pu être lue depuis
l'environnement de recherche : le serveur retourne un challenge JavaScript et
cookies. La présente étude repose donc sur les questions explicites de la
demande et sur les contrats du dépôt.

## 3. Ce que CodPlay possède déjà

Les contrats V2 donnent des précédents utiles, mais pas encore les deux
capacités proposées :

- Dans ACE, `prepareTween()` produit un `Tween` et `resolveTween(tween, instant)`
  résout un **instant temporel**. Durée, délai, répétitions et directions font
  partie de ce contrat. Il ne faut pas lui faire croire qu'un `g` géométrique
  est une durée arbitraire.
- La résolution actuelle des tweens passe par le pipeline du player avec
  `elapsedMs`. `ComponentAnimation.sample(timeMs)` possède la même hypothèse
  temporelle : elle ne peut pas devenir un driver de scroll sans nouveau
  contrat.
- `RuntimeComponentRuntime.updateLive()` est le précédent de présentation live
  le plus proche : il applique un état live par l'update ordinaire du composant.
  Il sert actuellement à la capture ; son état global ne doit pas être réemployé
  implicitement pour mélanger des contributions de scroll indépendantes.
- `input-projection-spec.md` distingue déjà une valeur vivante de la timeline :
  elle est transitoire, ne crée aucun event et ne modifie pas le journal.
- `player-engine-plan.md` fixe `RuntimePlayer.emit()` comme entrée live unique,
  puis `seek` relit le journal sans réexécuter `listen`, transform ou strap.
- `HtmlPersoEmitSourceAdapter` est le précédent structurel utile : un adaptateur
  HTML indexe des déclarations compilées, se branche après la matérialisation,
  ancre l'event au temps courant du player et passe par `player.emit()`.
- `HtmlPointerCaptureSourceAdapter` et `RuntimeCaptureSession` donnent le
  précédent pour une **session de scroll bornée** : `trackCommand` peut
  alimenter une action live sans inscrire chaque sample, puis `endCapture`
  produit un event `persist-only` ancré sur la durée capturée. Le scroll
  ambiant n'est pas lui-même une capture ; une session ouverte par activité de
  scroll et close par `scrollend` peut en revanche employer ce modèle.
- `RuntimeCaptureSession` conserve aujourd'hui le tableau brut de ses samples.
  Cela ne satisfait pas seul le budget mémoire d'un scroll long : une réduction
  de capture devra conserver un accumulateur de transitions plutôt que chaque
  observation brute.
- `RuntimeCapabilityCatalog` sait enregistrer un module player-scoped, mais
  son `RuntimeModuleServiceContext` actuel ne fournit ni source DOM générique,
  ni entrée d'émission contrôlée vers le player. Un module ne peut donc pas
  devenir silencieusement un émetteur IntersectionObserver sans extension de
  contrat.

Le `ResizeObserver` déjà présent dans `facade/instance-host.ts` n'est pas une
source d'events utilisateur. Après `runner.init()`, l'instance host observe sa
root et appelle `runner.resize(...)`; au teardown, elle se désabonne. Cette
frontière doit être réemployée pour l'**ownership** et le cycle de vie des
observateurs. L'insertion d'un event reste, elle, le circuit de
`HtmlPersoEmitSourceAdapter` : queue sérialisée puis `player.emit()`.

La note existante
[`2026-07-27-emetteurs-et-events-user-complexes.md`](../../projet/notes/2026-07-27-emetteurs-et-events-user-complexes.md)
énonce déjà le principe à réemployer : une source externe réduit son flux vers
un vocabulaire fini d'intentions et n'émet que sur changement de condition. Le
scroll apporte le même besoin, mais ses conditions sont géométriques :
`outside` ou `inside` au seuil déclaré.

## 4. Trois régimes autour du scroll

| Régime | Fenêtre | Rendu live | Fait temporel |
|---|---|---|---|
| Driver vivant `g` | ambiante tant que la surface existe | ACE met à jour les bindings à chaque valeur utile | aucun |
| Condition d'intersection | ambiante, avec phase mémorisée | aucun rendu frame par frame requis | event `enter`, `leave` ou phase déclarée |
| Capture d'activité de scroll | première valeur de scroll jusqu'à `scrollend` ou fermeture contrôlée | `trackCommand` peut alimenter une action `fn` de perso | un event `persist-only` réduit pour replay/seek |

Le scroll ambiant n'est pas une capture. En revanche, lorsqu'il faut inscrire
sa géométrie dans le temps, le sous-ensemble borné « activité de scroll →
`scrollend` » est exactement une capture : les samples restent live, puis une
réduction compacte devient la trace rejouable. Il ne faut donc ni journaliser
chaque `scroll`, ni renoncer au mécanisme de capture déjà établi.

## 5. Circuit proposé pour la valeur vivante `g` et ACE

### 5.1 Un driver de présentation, pas un event

Le contrat visé est une contribution de présentation éphémère :

```text
état de base       = solve(scene, t)
contribution live  = ACE.resolveDrivenValue(binding, g)
présentation       = composant.project(état de base, contribution live)
```

Le player continue de construire l'état logique depuis `t`. Le driver ne
modifie ni `state(t)`, ni une track, ni le journal. À chaque changement de
scroll, il évalue seulement les bindings déclarés, puis le composant runtime,
unique propriétaire de son DOM, applique la présentation résultante.

Les lectures et écritures de valeur se font dans le runtime : l'auteur ne reçoit
ni listener DOM ni node. Les bindings visent des canaux de présentation déclarés
par le composant (par exemple une position, une opacité ou une valeur de
propriété), et non une propriété CSS arbitraire écrite depuis l'extérieur.

Le choix initial de canaux doit privilégier les propriétés que le composant peut
présenter sans recalculer sa géométrie à chaque valeur, notamment `transform` et
`opacity`. ACE calcule la valeur ; le composant reste seul à appliquer sa
représentation DOM, Canvas, SVG ou tierce.

### 5.2 Extension ACE à concevoir

Le `Tween` temporal existant ne doit pas être détourné par une convention du
type « `g * 1 000 ms` ». Cette convention réintroduirait artificiellement délai,
durée, loops, direction et fin temporelle dans une valeur qui n'en possède pas.

Une primitive ACE distincte pourrait réemployer les valeurs interpolables et
l'easing d'ACE, mais déclarer explicitement son entrée normalisée :

```ts
// Esquisse non normative : noms et surfaces restent à décider.
type DrivenValueInput = {
  from: unknown;
  to: unknown;
  ease?: string;
};

prepareDrivenValue(input: DrivenValueInput): DrivenValue;
resolveDrivenValue(value: DrivenValue, progress: number): unknown;
```

Le contrat doit décider si `progress` est strictement dans `[0, 1]`, clampé ou
autorise un dépassement, et quelles familles ACE sont admises à la première
tranche (numérique, couleur, transformations, chemin, etc.). Ces décisions sont
nécessaires avant de choisir la forme du binding de composant.

Le driver doit également pouvoir découper un même `g` global en progressions
locales, sans inventer une timeline temporelle :

```text
gTitre = clamp((g - 0.00) / (0.35 - 0.00), 0, 1)
gImage = clamp((g - 0.20) / (0.80 - 0.20), 0, 1)

valeurTitre = ACE.resolveDrivenValue(titre, ease(gTitre))
valeurImage = ACE.resolveDrivenValue(image, ease(gImage))
```

Cette opération `range` appartient au binding vivant, avant l'easing et
l'interpolation ACE. Elle permet à un scrollport unique de conduire plusieurs
animations à des intervalles géométriques différents, tout en restant
réversible quand l'utilisateur remonte.

### 5.3 Composition et cycle de vie

La composition de `state(t)` et de la contribution `g` est le point de contrat
central. Elle doit être définie par canal : remplacement, addition, produit,
composition de matrice ou interdiction de conflit. Un driver ne peut pas
silencieusement écraser un tween temporel qui écrit la même cible.

Le comportement minimal à valider serait :

1. une synchronisation temporelle (`play`, `seek`, replay, resize) applique
   d'abord l'état de base, puis réapplique la dernière contribution `g` connue ;
2. une mise à jour de `g` ne déclenche pas de résolution de journal ni de straps
   et n'écrit que les canaux concernés ;
3. à la destruction ou au détachement du binding, la contribution est retirée
   et le composant retrouve l'état de base courant ;
4. les politiques pause et mouvement réduit sont explicites : le scroll peut
   continuer à changer `g` sans faire avancer `t`.

`RuntimeComponentRuntime.updateLive()` peut inspirer cette couche, mais une
surface dédiée aux contributions de présentation évite de confondre le live de
capture, l'input vivant et le scroll.

### 5.4 Source et cadence

Le runner possède la source de scroll après matérialisation des surfaces
déclarées. Un listener passif lit la progression, mémorise la dernière valeur
et coalesce les écritures de présentation. Il n'émet aucun `player.emit()`.

Le contrat de source doit déclarer sa formule de normalisation, plutôt que de
laisser chaque composant l'inférer : scroll global entre deux offsets, ou
parcours d'un sujet entre l'entrée et la sortie d'un viewport. Le calcul est
clampé à `[0, 1]`, réévalué au montage, au resize et à chaque mutation de
géométrie pertinente, puis partagé par tous les bindings qui nomment cette
source.

`ScrollTimeline` ou `ViewTimeline` peuvent ultérieurement servir de source
navigateur de `g` lorsque leur support et leur lecture imperative auront été
validés dans les navigateurs cibles. Cela ne donne aucune responsabilité de
transformation au CSS. La première tranche peut rester sur une normalisation
explicite des offsets et de la géométrie, à condition de définir exactement :

- le scrollport racine ou publié par un composant ;
- l'axe et les bornes qui donnent 0 et 1 ;
- le traitement d'une absence d'overflow ;
- le recalcul après resize, changement de contenu et reparentage ;
- la politique de lecture de géométrie pour un view-progress sans provoquer de
  lectures/écritures alternées coûteuses.

#### 5.4.1 Une position commandée n'est pas une capture

Le conteneur peut aussi recevoir un event discret qui demande une position ou
un `progress` cible. Les helpers convertissent alors ce `progress` en offset du
scrollport, et le navigateur assure le transport fluide du scrollport. CodPlay
n'a pas à calculer ni à écrire une trajectoire intermédiaire frame par frame.
Cette voie emploie le lissage natif du scrollport ; elle ne délègue pas les
transformations visuelles à CSS.

```text
event discret { progress: 0.72 }
  -> conteneur : progress -> position courante
  -> scrollport : déplacement fluide natif
  -> source g : lit le déplacement réel si un binding vivant en dépend
```

Cette commande et l'enregistrement d'un geste sont deux contrats différents.
Un déplacement commandé n'a pas besoin d'une courbe persistée : l'event porte
déjà sa cible. Si le récit doit rejouer la trajectoire effectivement produite
par un utilisateur, la capture reste nécessaire. Au Seek, une commande de
position doit poser la position résolue sans relancer un lissage asynchrone ;
la politique de présentation du Seek ne peut dépendre d'une animation
navigateur en cours.

#### 5.4.2 Helpers de conversion réciproque

La capacité conteneur doit posséder les deux conversions, définies contre ses
mesures courantes et une même normalisation publiée :

```text
position -> progress : (position - start) / (end - start)
progress -> position : start + progress * (end - start)
```

Elles prennent explicitement le root, l'axe, les bornes et la politique hors
intervalle (clamp, absence d'overflow, éventuel dépassement). La première
alimente `g`, les snapshots et les keyframes fractionnaires ; la seconde sert
aux events discrets de position. Elles ne doivent pas être réimplémentées par
chaque perso consommateur.

### 5.5 Généraliser : une valeur vivante est une source, pas un fait temporel

Le même modèle doit pouvoir accueillir une valeur continue publiée par un
composant tiers : capteur, média, moteur 3D, simulation ou autre composant
runtime. Le scroll est seulement une première source possible.

Une source vivante player-locale devrait publier, sous un identifiant et un type
déclarés, sa dernière valeur normalisée et sa révision. Elle pourrait être lue
par deux consommateurs distincts :

```text
composant tiers / capteur
  -> source vivante v (dernière valeur, révision, cycle de vie)
     ├─ binding de présentation -> ACE -> composant cible
     └─ réducteur de condition -> incident déclaré -> player.emit() -> journal
```

La source ne possède pas le journal et n'appelle pas librement `events.emit()`.
Le réducteur de condition, déclaré et compilé, est le seul pont qui puisse
transformer une observation en fait temporel. Ainsi, un composant tiers ne
reçoit ni le runner, ni un accès général au DOM, ni une permission implicite de
produire des events arbitraires.

Cette capacité n'existe pas encore sous une forme générique. La projection
vivante des `input` en est un précédent étroit : elle reçoit une valeur et la
présente sans ticker, mémoire de progression ni effet journalisé. Son contrat ne
peut pas devenir silencieusement un registre de sources pour tous les composants.

#### 5.5.1 État dynamique déclaré

Le `state` de story ou de scène est un bon emplacement conceptuel pour nommer
une valeur vivante telle que `chapterProgress`, à condition de ne pas la
confondre avec `state(t)`. Celui-ci est reconstruit depuis le journal ; écrire
`g` à chaque scroll dans le state ordinaire ferait croire au Seek qu'il s'agit
d'un fait temporel.

La capacité à créer est donc une **déclaration d'état dynamique** : le
conteneur en est le propriétaire, déclare le type, le scope (`story` ou
`scene`), la source et le cycle de vie ; le player publie sa dernière valeur et
sa révision aux consommateurs autorisés. Elle disparaît avec le conteneur et
ne devient historique que lorsque la capture optionnelle produit sa trajectoire
persistante.

```text
source scroll du conteneur -> g vivant
  ├─ action / binding de présentation du perso
  └─ état dynamique déclaré de story ou de scène
capture activée -> keyframes persistantes -> replay / Seek
```

Le chemin le plus étroit pour une action live existe déjà : une
`RuntimeCaptureAction` peut porter une valeur dans `data.value`, identifiée par
`data.valueId`. En revanche, le `fn` de tween
actuel ne reçoit que `{ progress, data }`, pas le state de story ou de scène.
Lire un état dynamique depuis une action demande donc un contrat explicite de
projection ou une extension des entrées de fonction ; un état dynamique déclaré
ne doit pas être rendu accessible par fermeture JavaScript ou lecture globale.

#### 5.5.2 Capacité générique : souscrire publiquement, connecter en interne

`subscribe` est la face auteur d'une capacité de valeurs réactives. Elle décrit
les actions à mettre à jour lorsqu'une valeur publiée par **le même composant
porteur** varie. `value: 'progress'` est donc un nom local de valeur, et non un
accès à un état global ni une particularité du scroll. Un autre composant pourra
porter la même capacité et publier, par exemple, `selection`, `mediaProgress`
ou `formValidity`.

La source de cette valeur ne relève pas de `SceneDoc`. Le composant la raccorde
à la capacité, au montage, par une opération interne `connect` :

```ts
// API interne de capacité — jamais écrite par l'auteur dans la scène.
type ReactiveValueSource<T> = Readonly<{
  getSnapshot: () => T
  subscribe: (notify: () => void) => () => void
}>

type ReactiveValueConnection = Readonly<{
  disconnect: () => void
}>

interface ReactiveValueCapability {
  connect<T>(input: Readonly<{
    ownerId: string
    value: string
    source: ReactiveValueSource<T>
  }>): ReactiveValueConnection
}
```

`connect` lit immédiatement `getSnapshot()`, puis relit cette valeur après les
notifications de `source.subscribe()`. La capacité coalesce ces notifications
avant la projection de présentation et appelle les actions déclarées avec
`data.value` et `data.valueId`. Une connexion est unique pour le couple
`{ ownerId, value }`; sa fermeture intervient automatiquement au démontage du
composant, et peut être invoquée explicitement par son cycle de vie.

`scroll-container` construit en interne une source dont `getSnapshot()` calcule
le `progress` à partir de son scrollport et dont `subscribe()` attache ses
écouteurs `scroll` et `resize`. Un composant React ferait de même avec un
adaptateur vers son état ou son store React, dans son propre bridge runtime. Ni
les écouteurs, ni le state React, ni `connect` ne sont exposés à l'auteur :
celui-ci ne voit que `subscribe` et les actions de ses persos. La configuration
optionnelle `values.progress` calibre la valeur native du conteneur ; elle ne
remplace pas cette connexion interne et ne contient jamais une source.

### 5.6 La timeline peut ignorer la valeur, ou en journaliser un échantillon

Une valeur vivante est par défaut **hors timeline**. Le journal n'a pas à
conserver chaque évolution de `v` si le récit ne dépend que d'un incident, par
exemple « la carte est devenue visible ». L'event journalisé peut alors ne
contenir que son nom, l'identifiant de condition et la phase.

Si une action, un `listen` ou un strap a besoin de la valeur rencontrée lors de
l'incident, l'event doit au contraire porter un **snapshot déclaré** dans
`event.data`. Ce snapshot est une copie par valeur, finie et sérialisable ; il
ne contient jamais une référence à la source vivante, un node DOM, un
`IntersectionObserverEntry` ou un `DOMRect`.

```ts
// Esquisse non normative d'un event d'entrée journalisé.
{
  name: 'card:a:entered',
  data: {
    observation: 'card-a-visible',
    phase: 'inside',
    sampledProgress: 0.683,
  },
}
```

Le choix de capturer `sampledProgress` doit être explicite dans la déclaration
de l'incident. Dans le cas contraire, la valeur reste vivante uniquement et la
timeline ne la voit pas. Cette frontière évite que le coût de persistance et la
sémantique de replay soient imposés à toutes les sources continues.

Au `Seek`, un snapshot journalisé est **restitué comme donnée de l'event**, pas
réinjecté comme la valeur courante de la source vivante. Les straps et les
transforms ne sont pas réexécutés au seek : le journal contient déjà l'event
source et tous les events dérivés produits lorsqu'il a été accepté. Une action
qui doit dépendre de `sampledProgress` doit donc avoir reçu une donnée
journalisée dans l'un de ces faits ; elle ne doit jamais relire la source `v`
pendant la reconstruction.

Deux intentions différentes doivent rester séparées :

| Intention | Représentation correcte | Effet au Seek |
|---|---|---|
| « une condition a été vraie » | event journalisé, avec snapshot facultatif | le fait et son snapshot sont relus, sans consulter le navigateur |
| « la condition est vraie maintenant » | condition vivante appliquée à la présentation ou paire d'events `enter`/`leave` selon le récit | la géométrie actuelle ne doit pas être réintroduite dans `state(t)` |
| « utiliser continuellement la valeur courante » | binding vivant vers ACE | la dernière valeur présente est réappliquée après l'état de base, sans devenir historique |

Un event `IntersectionObserver` ne doit pas être révoqué au replay parce que la
cible n'est plus visible au moment du `Seek` : il atteste qu'une condition a été
observée dans l'histoire du player. Si le produit exige un effet seulement tant
que la cible est visible *maintenant*, cet effet est une contribution live et
ne peut pas être obtenu en revalidant discrètement un ancien event.

### 5.7 Réduire une capture de scroll en trajectoire temporelle

Lorsque `g` a déjà piloté le mouvement visible, une activité de scroll bornée
peut employer le contrat de capture existant : `trackCommand` reçoit les
samples live et `endCapture` retourne la trace de relecture. Les events issus
de `endCapture` sont déjà `persist-only` et sont ancrés à la durée de la
capture. Le rendu live ne subit donc aucun doublon ; au replay ou au Seek,
l'animation capturée prend le relais.

```text
scroll -> sample { g, timelineMs }
       -> trackCommand -> action fn live du perso
       -> accumulateur réduit de transitions
scrollend
       -> endCapture -> event persist-only { transitions }
       -> journal -> action fn temporelle au replay / Seek
```

Une action `fn` live lit la valeur de sa souscription dans
`data.value`, avec `data.valueId` pour connaître la source. Pour le scroll,
cette valeur est `g`. La résolution live lui fournit un instant temporel nul :
la fonction utilise donc `data.value` pour produire la pose présente. Au
replay, une action `fn` temporelle distincte lit les keyframes et son
`progress` ACE pour reconstruire la pose à l'instant demandé. Garder deux
actions nommées évite de confondre les deux significations de `progress`.

Voici la forme attendue côté perso. `reveal` est un canal de présentation
déclaré par le composant `reveal-title` : ce composant, et lui seul, en fait la
présentation concrète. Dérivé de `layout`, il reçoit donc un `markup` et publie
un point de montage `data-part`. L'auteur ne cible pas une propriété CSS ; la
fonction lit la valeur vivante, et ACE résout les valeurs interpolées.

```ts
import { parseEase, prepareInterval, resolveInterval } from 'codplay/ace'

type LiveValueInput = Readonly<{
  // Progression temporelle du TweenAction : non employée ici.
  progress: number
  data?: Readonly<{ value?: unknown; valueId?: unknown }>
}>

const revealOpacity = prepareInterval(0, 1)
const revealOffset = prepareInterval(32, 0)
const revealEase = parseEase('outCubic')

/** Produces the semantic reveal pose from the subscribed live value. */
function resolveTitleProgress({ data }: LiveValueInput) {
  if (data?.valueId !== 'progress' || typeof data.value !== 'number') return {}

  const progress = Math.min(1, Math.max(0, data.value))
  const eased = revealEase(progress)
  return {
    reveal: {
      opacity: resolveInterval(revealOpacity, eased),
      offsetY: resolveInterval(revealOffset, eased),
    },
  }
}

const title: PersoDoc<'reveal-title'> = {
  id: 'title',
  type: 'reveal-title',
  initial: {
    markup: `
      <article id="title-root">
        <h1 id="title-content" data-part="title:content">Le chapitre</h1>
      </article>
    `,
  },
  actions: {
    // `duration` est requise par le TweenAction actuel. En live, son `progress`
    // temporel vaut 0 ; seule `data.value` est utilisée par cette fonction.
    'chapter:progress': { duration: 1, fn: resolveTitleProgress },
  },
}
```

La souscription du `scroll-container` appelle cette action avec
`{ value: g, valueId: 'progress' }`. À ce stade, c'est une esquisse de contrat :
le core actuel ne connaît pas encore `scroll-container` ni `subscribe`, mais
son circuit de capture sait déjà résoudre une action `fn` avec les données
live. La durée factice ne doit pas devenir une convention auteur durable : le
plan d'implémentation devra introduire la forme explicite d'action live ou
normaliser cette contrainte hors de l'API publique.

La trace minimale d'un segment est :

```ts
// Esquisse non normative : données sérialisables, sans DOM ni sample brut.
type ScrollTransition = {
  from: number;
  to: number;
  duration: number;
  ease: string;
};

{
  name: 'chapter:scroll-captured',
  data: {
    duration: 860,
    transitions: [
      { from: 0.14, to: 0.42, duration: 280, ease: 'linear' },
      { from: 0.42, to: 0.68, duration: 580, ease: 'outCubic' },
    ],
  },
}
```

Le `duration` racine est la durée totale du tween de replay ; il peut compléter
la durée déclarée de l'action `fn`, car la résolution d'action fusionne déjà
`event.data` avec l'action ciblée. Chaque élément de `transitions` garde sa
durée et son easing locaux ; la fonction ACE les parcourt pour produire la
valeur correspondante.

La conclusion de capture doit porter cette durée à deux endroits, qui ont deux
responsabilités distinctes : `endCapture.duration` avec `durationMode: 'value'`
fixe l'ancrage temporel `applyAtMs`, tandis que `event.data.duration` donne au
tween `fn` résolu la même durée. Le runtime ne propage automatiquement une
durée que vers les transitions de `style` ; une action `fn` doit donc recevoir
explicitement sa durée dans ses données.

#### Compression : keyframes de progression fractionnaire

L'étude `scroll-timeline-compression.md` conduit à préférer une forme canonique
par keyframes temporelles de progression, plus compacte que la répétition de
`from` dans chaque transition. Les transitions restent une vue dérivée utile à
l'évaluateur : chaque `from` est la progression de la keyframe précédente et
sa durée est la différence de leurs offsets.

```ts
// Esquisse non normative. `ease` règle le segment qui arrive à cette keyframe.
type ProgressKeyframe = {
  offsetMs: number;
  progress: number;
  ease?: string;
};

{
  name: 'chapter:scroll-captured',
  data: {
    progressSource: 'chapter-scroll-range/v1',
    duration: 1460,
    keyframes: [
      { offsetMs: 0, progress: 0.10 },
      { offsetMs: 620, progress: 0.72, ease: 'outCubic' },
      { offsetMs: 910, progress: 0.72 },
      { offsetMs: 1460, progress: 0.38, ease: 'inOutQuad' },
    ],
  },
}
```

La paire à `620` puis `910 ms`, dont la progression est identique, exprime une
pause sans type spécial. Le `duration` racine est l'offset de la dernière
keyframe ; une trajectoire valide commence à `0`, a des offsets strictement
croissants ensuite et couvre ainsi tout l'intervalle temporel. L'évaluateur
reconstruit alors le segment `{ from, to, duration, ease }` sans le stocker.

`progress` est la fraction issue d'une normalisation déclarée (par exemple
`scrollTop / (scrollHeight - clientHeight)`), après la politique de borne
choisie par la source. La clé `progressSource` doit identifier cette formule et
sa version compilée ; une fraction isolée serait ambiguë. Au replay, cette
valeur ne demande pas de remettre le viewport à une ancienne position : elle
alimente ACE comme valeur de contrôle, et les valeurs présentées restent donc
adaptées à la géométrie courante. Rejouer le *scroll du document* est un autre
problème, qui ne garantit pas à lui seul la même position sémantique après un
changement de contenu.

La réduction enregistre les changements de direction, les pauses et les points
dont l'écart à l'interpolation dépasse une tolérance. Ramer–Douglas–Peucker est
une bonne simplification de clôture, mais il exige la trajectoire entière : il
ne convient pas seul à une trajectoire ouverte qui doit borner sa mémoire. Le
contrat devra employer un simplificateur en ligne, avec fenêtre bornée, qui
préserve obligatoirement les extrémités, pauses et inversions ; la simplification
complète peut rester une passe optionnelle lors de la fermeture.

La tolérance est exprimée dans l'espace `(offsetMs, progress)`, non directement
en pixels : elle doit donc être un choix auteur explicite, éventuellement relié
à une erreur maximale sur la sortie ACE. Conserver d'abord des segments
linéaires rend cette erreur mesurable. L'ajustement d'un easing pour reproduire
l'accélération humaine est une optimisation ultérieure : les chaînes d'easing
ACE déjà admises sont sûres ; une courbe Bézier arbitraire exige une forme
sérialisée et un parseur ACE explicitement validés.

Cette réduction doit être faite **avant** le journal : `RuntimeTrackJournal`
conserve des facts immuables, il n'est pas possible d'émettre un event puis de
muter progressivement son payload de trajectoire. Deux politiques compactes
sont possibles :

1. accumuler les keyframes dans l'état de capture puis émettre un unique event
   à `scrollend` ;
2. pour une activité longue, fermer au plus un lot par seconde : chaque event
   persistant contient les keyframes de sa fenêtre, et le
   lot final est flushé à `scrollend`, pause ou destruction.

La limite d'une écriture par seconde protège le journal contre les micro-events
sans réduire la cadence du rendu live. L'accumulateur peut fusionner les
samples voisins dans le segment courant en mettant à jour seulement la dernière
keyframe (`progress`, `offsetMs`) ; il ne conserve jamais chaque offset
intermédiaire.

`RuntimeCaptureSession` mémorise actuellement tous les samples bruts, même si
`captureState` a déjà réduit leur information. Cette capacité devra donc être
étendue avec une politique de rétention réduite (par exemple aucun sample brut
ou un accumulateur déclaré) avant de brancher un scroll continu : réduire
seulement l'event final ne suffit pas à borner la mémoire.

Un `Seek` direct vers l'endpoint calcule normalement la pose ACE à cet instant,
sans jouer une animation en temps réel. Le déplacement visuellement fluide se
voit lors d'une lecture qui traverse les segments, ou si une politique de
présentation de Seek distincte l'anime explicitement.

### 5.8 Inscrire une géométrie de scroll dans le temps

`scrollend` n'est pas un échantillon supplémentaire. Dans le régime borné
« activité de scroll », il ferme (ou flushe) l'accumulateur réduit de la
section précédente. Dans le régime du conteneur à trajectoire ouverte, il est
seulement une frontière de compaction ou de snapshot optionnelle : la capture
et l'observation restent ouvertes jusqu'au cycle de vie du conteneur. La
géométrie continue s'inscrit alors dans le temps sous la forme d'une
trajectoire, non d'un historique d'offsets :

```text
scroll -> g live -> présentation ACE + réduction { offsetMs, progress, ease? }
scrollend -> event persist-only { duration, keyframes } -> journal
          -> reconstruction temporelle ultérieure
```

Un simple snapshot `{ progress: g }` reste utile lorsque seule la pose finale
compte. C'est le cas dégénéré d'une trajectoire sans interpolation à conserver.
Pour une action qui doit se déplacer fluidement pendant le replay, la forme
keyframes (et ses transitions dérivées) est nécessaire : le scroll n'est
toujours pas l'horloge de la scène, mais sa trajectoire réduite devient une
durée dans l'horloge `t`.

### 5.9 Une trajectoire ouverte pendant la vie d'un conteneur

La direction retenue pour le conteneur est un **unique événement persistant
logique de trajectoire**, ouvert quand son perso entre dans sa durée de vie. Il
possède une identité stable, un début `t0` et une liste de keyframes
fractionnaires — ou sa vue dérivée en transitions — qui s'allonge ou dont le
dernier segment est révisé pendant toute cette durée. À sa fermeture, il
représente l'histoire entière de la valeur du conteneur.

La capture est une option explicite du conteneur. Désactivée, le conteneur
publie toujours `g` et ses conditions d'intersection, mais ne construit aucune
trajectoire historique. Activée, il ouvre l'événement persistant dynamique et
alimente son accumulateur réduit. Le choix ne modifie ni la formule de `g`, ni
les règles `IntersectionObserver`.

```text
montage logique du conteneur
  -> installe scroll + IntersectionObserver pour son contenu
  -> ouvre, si capture activée, event-persist { eventId, t0, keyframes: [] }
scroll / source vivante
  -> publie g (binding perso et état dynamique déclaré)
  -> réduit et révise la trajectoire courante
démontage logique / sequence:end / teardown de l'instance
  -> fixe la dernière révision
  -> persiste une unique copie immuable pour replay et Seek
  -> retire listener scroll, observers et état dynamique
```

Cette proposition est intéressante comme **modèle auteur** : il n'y a qu'un
événement à comprendre, et sa donnée est la courbe de la valeur vivante. Elle
ne peut cependant pas être réalisée en réécrivant un `RuntimeTrackEvent`
ordinaire à chaque sample : le journal actuel n'expose qu'`appendLiveEvent`,
attribue définitivement `eventSeq` et déclenche le dispatcher, les `listen` et
les straps au moment de l'append. Une réécriture normale devrait aussi
invalider sa révision ; le player reconstruirait alors l'état et la timeline
structurelle à chaque notification de scroll. Un seul event stocké ne
résoudrait donc ni ce coût, ni le risque de répéter des effets dérivés.

Muter directement l'objet JavaScript déjà retourné par le journal ne constitue
pas une solution : ce n'est pas son contrat, aucune révision ne serait publiée
et les scènes résolues ou les sorties de straps déjà dérivées resteraient
fondées sur l'ancienne donnée.

La frontière saine serait une **projection de trajectoire ouverte**, locale au
player, dont l'API d'auteur peut rester celle d'un event unique mais qui n'est
pas encore un fact du journal :

- elle ne cible que l'action pure qui évalue la trajectoire ; elle ne passe pas
  dans `listen`, ne déclenche pas de strap, de cascade, de contrôle de track ou
  d'observateur public à chacune de ses révisions ;
- elle possède un `revision` propre, coalescé au rendu, sans incrémenter la
  révision structurelle du journal ;
- à la fermeture, sa valeur finale est appendée une seule fois comme event
  `persist-only` ordinaire. C'est cette copie qui devient le fact rejouable.

Le nom `event-persist` décrit ici la sémantique auteur d'un event qui accumule
une trace. Pendant qu'il est ouvert, ses révisions appartiennent à la projection
player-locale ; la copie journalisée demeure immuable. Faire de la réécriture
d'un event de journal une API générale serait un autre projet central, avec une
sémantique de révision et d'invalidation qui dépasse cette capacité conteneur.

Le runtime peut garder un cache d'offsets cumulés pour cette projection. Ainsi,
le replay ou le Seek trouvent le segment qui contient `t - t0` par recherche
logarithmique, au lieu de reparcourir tout `transitions` à chaque frame. Les
offsets sont un détail runtime ; le payload persistant peut rester le tableau
simple demandé par l'auteur.

Le tableau `{ from, to, duration, ease }` n'est temporellement complet que si
les segments sont contigus et que leur somme couvre la durée courante de
l'événement. Une pause de scroll doit donc être représentée par un segment de
maintien (`from === to`), ou le contrat devra ajouter un offset explicite. Sans
l'une de ces deux règles, une reprise de scroll après une pause serait
artificiellement interpolée à travers le silence.

Un event unique ne rend pas le tableau borné par lui-même. Une session de très
longue durée demande encore une réduction en ligne : fusion de segments
compatibles, seuil d'erreur géométrique, et plafond de segments avec politique
de simplification explicite. La cadence de révision (au plus une fois par frame
de présentation) est distincte de cette politique de fidélité.

Au replay ou au Seek, la trajectoire persistée — déjà fermée ou projection
ouverte figée à sa dernière révision — est la seule contribution présentée : la
valeur `g` réellement lue dans le navigateur ne doit pas la recouvrir. Si un
Seek interrompt une capture en cours, il doit d'abord fixer ou annuler celle-ci,
puis arrêter son observation ; reprendre ensuite une nouvelle collecte exige
une frontière ou une branche explicite. Continuer à écrire la même trajectoire
après un Seek arrière réécrirait le passé.

Enfin, « montage du conteneur » doit désigner une frontière logique stable,
plutôt qu'une création DOM incidente : le materializer peut être remis en
présentation pendant un Seek sans que cela doive ouvrir une seconde
trajectoire. L'identité de session doit être liée à l'occurrence logique du
perso et fermée exactement une fois à son démontage logique, `sequence:end` ou
au teardown. Le player annule aujourd'hui les captures à `sequence:end` : cette
capacité exige une fermeture avec flush avant ce nettoyage, sinon la dernière
trajectoire serait perdue.

## 6. Architecture recommandée pour les conditions discrètes

### 6.1 Une déclaration portée par le conteneur

La capacité proposée est un **conteneur de scroll** : il possède son
scrollport, les écouteurs et les observations de ses descendants. Il n'expose
ni node DOM ni callback `IntersectionObserver` brut à l'auteur. Son contenu
profite de la capacité déclarée par son ancêtre ; aucun enfant ne recrée un
listener scroll, un observer ou une capture parallèle.

La surface auteur candidate appartient à un perso **`scroll-container`**
dédié. Ce type de composant n'existe pas encore : c'est la capacité proposée,
non une extension de `layout`. Le builder la normaliserait ensuite dans
`CompiledScene`, mais cette localisation exprime la propriété et le cycle de
vie réels : `Perso.emit` reste un événement DOM natif du perso, alors que
l'intersection relie un descendant et le scrollport du conteneur.

```ts
// Contrat auteur réutilisable de la capacité de valeurs réactives.
type ReactiveValueSubscription = {
  value: string;
  actions: readonly { target: { persoId: string }; action: string }[];
};

// Esquisse non normative du profil auteur du composant dédié.
type ScrollContainerInitial = {
  markup: string;
  values?: {
    progress?: {
      axis?: 'block' | 'inline';
      range?: 'scrollport';
      clamp?: boolean;
    };
  };
  state?: false | string | { key: string; scope?: 'story' | 'scene' };
  subscribe?: readonly ReactiveValueSubscription[];
  capture?: false | {
    event?: string;
    precision?: { tolerance?: number; maxKeyframes?: number };
  };
  observe?: readonly {
    id: string;
    target: { persoId: string };
    // Options natives d'IntersectionObserver, hormis `root` fixé au scrollport.
    zone?: {
      rootMargin?: string;
      scrollMargin?: string;
      threshold?: number;
      trackVisibility?: boolean;
      delay?: number;
    };
    enter?: readonly SceneEventDeclaration[];
    leave?: readonly SceneEventDeclaration[];
  }[];
  position?: false | { on: string; behavior?: 'smooth' | 'instant' };
};

type SceneEventDeclaration = {
  name: string;
  data?: Record<string, unknown>;
  visibility?: 'story' | 'scene' | 'public';
};
```

Une scène utilisatrice prendrait cette forme :

```ts
const chapter: PersoDoc<'scroll-container'> = {
  id: 'chapter',
  type: 'scroll-container',
  initial: {
    markup: '<section id="chapter-root"></section>',
    subscribe: [{
      value: 'progress',
      actions: [{ target: { persoId: 'title' }, action: 'chapter:progress' }],
    }],
    observe: [{
      id: 'card-a-half-visible',
      target: { persoId: 'card-a' },
      zone: { threshold: 0.5 },
      enter: [{ name: 'card:a:half-visible', visibility: 'story' }],
      leave: [{ name: 'card:a:less-than-half-visible', visibility: 'story' }],
    }],
    position: { on: 'chapter:scroll:to' },
  },
};
```

Les défauts sont opérants : root local au composant, axe `block`, intervalle du
scrollport, clamp, capture active, event `chapter:scroll:trajectory` dérivé de
l'id, keyframes et déplacement natif `smooth`. `values`, `state`, `capture`,
`subscribe`, `observe` et `position` ne sont renseignés que pour déroger ou
ajouter un besoin. `values.progress` calibre seulement la valeur native que
le conteneur connecte en interne. `subscribe` est le contrat générique de la
capacité : d'autres composants pourront le porter avec leurs propres valeurs
connectées. Les persos cibles conservent des actions ordinaires : la souscription à `progress` appelle `chapter:progress` avec
`data.value` et `data.valueId: 'progress'`; l'event persisté cible
`chapter:scroll:trajectory` avec `duration`, `progressSource` et `keyframes`.

Le tableau `observe` est la liste finie des déclencheurs que le
conteneur sait observer et des events qu'ils produisent. `zone` reprend les
options du constructeur `IntersectionObserver`, à l'exception volontaire de
`root` : il est toujours le scrollport du `scroll-container`. Ses défauts sont
ceux du navigateur (`rootMargin: '0px'`, `scrollMargin: '0px'`,
`threshold: 0`, `trackVisibility: false`, `delay: 0`). `enter` et `leave`
restent des sorties distinctes, chacune pouvant déclarer plusieurs events avec
les champs auteur existants (`name`, `data`, `visibility`).

Une règle possède un unique `threshold`. Elle est `inside` lorsque
`isIntersecting` est vrai et que `intersectionRatio >= threshold`; si
`trackVisibility` est demandé, `isVisible` doit aussi être vrai. Le franchissement
de cette condition produit `enter` ou `leave`. Pour suivre plusieurs seuils du
même perso, l'auteur déclare plusieurs règles `observe` avec leurs `id` et
leurs events : cela rend chaque fait journalisé non ambigu. `rootMargin` étend
ou rétrécit le rectangle du root ; `scrollMargin` agit sur les scrollports
intermédiaires. `delay` et `trackVisibility` sont transmis seulement lorsque le
navigateur les supporte, avec diagnostic explicite sinon.

Un snapshot d'incident, par exemple la progression au moment d'un `enter`,
reste déclaré séparément du payload statique. La capture de trajectoire est
quant à elle gouvernée seulement par `capture` : elle ne doit pas être
déduite implicitement de la présence d'une règle d'intersection.

Le chemin de formalisation est alors précis : la déclaration du conteneur est
validée avec ses cibles descendantes, son root publié, ses options d'observation
et ses events ;
le builder en produit l'artefact compilé de la capacité ;
`HtmlIntersectionObserverSourceAdapter` ne lit que cet artefact. Le conteneur
publie une seule surface `scroll-root` et une seule source `g` pour son contenu.

Le premier candidat d'implémentation est un
`HtmlIntersectionObserverSourceAdapter`, possédé par le runner comme
`HtmlPersoEmitSourceAdapter`. Il se branche après la matérialisation, au même
moment où le runner attache ses sources, puis se détruit avec lui :

```text
declaration compilée
  -> HtmlIntersectionObserverSourceAdapter
  -> un IntersectionObserver par configuration compatible
  -> phase précédente par cible
  -> queue sérialisée, seulement si la phase change
  -> player.emit(event déclaré)
  -> RuntimeTrackJournal -> listen -> straps -> events/actions ordinaires
```

Une capacité enregistrée dans `RuntimeCapabilityCatalog` reste une forme
possible, mais elle exige d'abord que son contexte reçoive des surfaces DOM
typées et une entrée contrôlée vers `player.emit()`. Il ne faut pas contourner
cette absence en donnant le runner ou des nodes bruts au module.

Ainsi, une entrée peut déclencher un `listen` et un strap qui produisent
d'autres events, y compris des eventimes planifiés. Ils restent les sorties
normales du pipeline : l'observateur n'écrit ni dans une track, ni dans le DOM,
ni dans une timeline parallèle.

### 6.2 Garde-fous structurels

- L'auteur déclare une liste finie de conditions binaires et le nom d'event
  associé à chaque transition. Il ne fournit pas une fonction qui peut émettre
  librement pour chaque `IntersectionObserverEntry`.
- Un callback qui reçoit deux fois `inside` n'émet rien la seconde fois. Une
  transition `outside -> inside` ou `inside -> outside` produit au plus un
  event déclaré.
- `rootMargin`, `scrollMargin`, `threshold`, `trackVisibility` et `delay` sont
  validés comme options d'observation ; le réducteur ne conserve que l'état
  déclaré `inside` ou `outside`.
- L'objet `IntersectionObserverEntry`, les `DOMRect` et le node DOM ne sont
  jamais copiés dans `event.data`. Les données journalisées restent des valeurs
  sérialisables : identifiant de condition, phase déclarée et, seulement si la
  déclaration le demande, snapshot normalisé d'une source vivante.
- Les callbacks asynchrones passent dans une queue d'émission unique, à la
  manière de la source HTML `emit` existante. Pour plusieurs transitions à la
  même observation, l'ordre doit être celui des déclarations compilées, non
  l'ordre accidentel de livraison du navigateur.

### 6.3 Condition de visibilité et snapshot d'incident

La condition de visibilité doit être entièrement vérifiée **avant** qu'un event
ne soit placé dans la queue. Pour chaque entrée reçue, l'adaptateur doit :

1. vérifier que le root et la cible sont encore les surfaces matérialisées
   déclarées ;
2. réduire l'entrée avec la règle déclarée (`isIntersecting`,
   `intersectionRatio`, `threshold` et, le cas échéant, `isVisible`) ;
3. comparer cette phase à la phase mémorisée pour cette condition ;
4. seulement sur transition valide, construire l'incident sérialisable et son
   snapshot éventuellement demandé ;
5. capturer `applyAtMs` au temps courant du player, puis placer cet incident
   déjà formé dans la queue d'émission.

La queue ne relit donc ni le DOM ni la source vivante. Si le scroll a continué
entre le callback et `player.emit()`, l'event reste le témoignage de
l'observation qui l'a déclenché. Sa validité est celle de l'étape 2, pas celle
de la géométrie présente au moment, plus tardif, de son insertion.

`IntersectionObserver` livre ses entrées de façon asynchrone et groupée. Un
`sampledProgress` lu dans son callback signifie donc « valeur de la source au
traitement de cette observation » ; il ne signifie pas nécessairement « valeur
mathématiquement exacte à l'instant où le seuil a été franchi ». Si cette
dernière précision est une exigence produit, l'incident doit être produit par
un même échantillonneur de progression qui détecte lui-même le franchissement,
et non par `IntersectionObserver` seul.

L'événement réduit est ancré au `currentTimeMs` capturé avant la queue, et non
à `IntersectionObserverEntry.time` : ce dernier est une horloge navigateur,
pas le temps logique CodPlay. Cette distinction rend le fait rejouable ; elle
ne prétend pas reproduire la géométrie qui l'a produit.

### 6.4 Réemploi du modèle de cycle de vie de `ResizeObserver`

L'instance host fournit le modèle de possession : l'observer est créé après un
`runner.init()` réussi et il est toujours arrêté avant `runner.destroy()`. Un
adaptateur `IntersectionObserver` doit respecter cette séquence et partager la
résolution player-locale des roots, sans listener global oublié.

La différence est volontaire : `ResizeObserver` appelle seulement
`runner.resize(...)`, tandis que l'adaptateur de conditions emploie la queue et
la validation d'état de `HtmlPersoEmitSourceAdapter` avant `player.emit()`.
Réemployer le cycle de vie ne signifie donc pas créer un second circuit
d'events utilisateur.

### 6.5 Cycle de vie à définir explicitement

| Moment | Comportement requis |
|---|---|
| compilation | valider les cibles, le root fixé, les options d'observation et les events déjà déclarés ; aucune cible n'est inventée au runtime |
| montage logique visible | après matérialisation, résoudre les roots/parts par les registres player-locaux, installer un listener scroll passif, construire les observateurs, publier l'état dynamique et ouvrir la trajectoire si `capture` n'est pas désactivée |
| callback initial | choisir explicitement entre `synchronize` (établit la phase sans event) et `emit` (l'apparition initiale est un fait) ; l'absence de choix provoquerait des entrées fantômes au montage |
| scroll actif | calculer `g`, coalescer la projection live, mettre à jour l'état dynamique ; si la capture est active, réduire les keyframes de l'event-persist sans passer par le dispatcher |
| callback IO | réduire chaque observation à une transition valide, puis appeler l'entrée d'event unique du player avec les events déclarés par le conteneur |
| pause | politique à décider pour l'observation et `g` ; elle ne doit pas confondre pause de `t` et arrêt physique du scrollport |
| `sequence:end` | flusher et fermer la trajectoire active avant le nettoyage terminal, puis retirer listener, observers, queue et état dynamique ; un simple `cancel` perdrait le replay demandé |
| démontage logique / suppression de l'instance | même fermeture ordonnée : dernier sample, copie `persist-only`, `disconnect()`, retrait du listener et suppression de l'état dynamique avant de retirer les surfaces |
| seek | ne pas reconnecter ni interroger le viewport pour « retrouver » des entrées ; présenter la trajectoire persistante et non `g` courant ; une capture ouverte doit être figée, finalisée ou annulée selon la politique explicite |
| resize, reparentage, scroll externe | le navigateur peut modifier une phase et produire une transition live ; la cible observée doit rester la matérialisation auteur persistante, jamais un overlay FLIP technique |
| destroy | appliquer la fermeture de l'instance si elle reste nécessaire, puis `disconnect()`, vider la phase et annuler la queue avant le teardown du runner |

La ligne pause mérite une décision avant tout code. Si l'observateur émet quand
le player est en pause, plusieurs faits peuvent recevoir le même `timelineMs` ;
si on le désactive, la phase peut avoir changé au moment de la reprise. Ces
deux politiques sont légitimes mais n'ont pas les mêmes effets de récit et de
replay.

## 7. Hypothèse d'un composant conteneur

L'hypothèse est saine si le conteneur reste une **portée de géométrie et de
présentation**, non une seconde timeline. Il pourrait apporter à ses descendants :

1. un scrollport identifié, matérialisé par sa root ou une part explicitement
   publiée ;
2. une source `g` nommée et ses bornes, consommable par les bindings de
   présentation déclarés des descendants ;
3. une portée de déclarations d'observation de ses descendants ;
4. une unique capacité d'observation qui mutualise les observers ayant le même
   `{ root, rootMargin, scrollMargin, threshold, trackVisibility, delay }` ;
5. le cycle d'attachement/détachement de ses targets persistantes.
6. l'option de capture, l'event-persist ouvert et sa fermeture ordonnée ;
7. les helpers `position -> progress` et `progress -> position` pour cette même
   normalisation.

Une scène longue peut employer une structure auteur `sticky` : le conteneur
crée l'étendue de scroll, tandis que son contenu reste visible pendant que `g`
la parcourt. Cette structure relève du markup et du composant de layout ; le
driver CodPlay la lit via la surface `scroll-root`, sans imposer de hauteur ni
de `position` au DOM.

Cela évite qu'un enfant crée son propre listener `scroll` ou son propre
observateur global. Il ne doit en revanche pas :

- imposer un temps CodPlay aux enfants ;
- propager une valeur `g` continue vers leur état logique reconstructible ; un
  état dynamique explicitement déclaré est le seul canal candidat ;
- lire leurs nodes depuis l'auteur, ou dépendre d'un ordre DOM implicite ;
- observer les clones/overlays que le runner emploie seulement pour le FLIP.

La frontière adaptée à V2 serait une surface HTML interne typée, par exemple
une publication de `scroll-root`, `scroll-target` et de canaux de présentation
par un composant. Le driver et la capacité résoudraient ces surfaces depuis le
registre player-local, comme `media-sync` le fait déjà pour la surface `media`.
Aujourd'hui, la map de surfaces ne contient pas encore ces types et le contexte
de module n'a pas de sortie d'event déclarée : ce sont deux extensions à
spécifier, pas des détails à contourner avec des accès au runner.

La direction à formaliser est donc le composant conteneur. Les deux autres
formes restent des alternatives écartées pour la première tranche :

| Forme | Atout | Risque |
|---|---|---|
| capacité de scène + root explicite | séparation nette de l'observation et du rendu | dissocie la déclaration de son propriétaire et de son cycle de vie |
| composant conteneur qui publie le scrollport, `g` et ses règles | propriété, mutualisation et fermeture réunies au même endroit | nécessite le contrat de surface, les règles de composition et la politique de descendants détachés/reparentés |
| règle `emit` ajoutée à chaque perso | proche du précédent DOM existant | duplique la configuration de root, crée beaucoup d'observers et confond déclencheur natif et condition géométrique |

Le conteneur doit être une capacité concrète avec son validateur, son artefact
compilé et sa suite d'intégration, jamais un comportement caché de `layout`.

## 8. Décisions à prendre avant un plan d'implémentation

1. **Déclaration de conteneur** — quelle capacité auteur porte le scrollport,
   la source `g`, l'option `capture`, l'état dynamique et le tableau
   `observe` ? Quels descendants, options d'observation et events `enter`/`leave`
   sont validés et compilés ?
2. **Primitive ACE** — quel type piloté par `g` est ajouté, quelles valeurs il
   accepte et quelle est sa règle de bornage hors `[0, 1]` ?
3. **Composition** — pour chaque canal de présentation, comment se combinent
   l'état de base issu de `t` et une ou plusieurs contributions vivantes ?
4. **Source de progression** — premier périmètre limité au scroll global, ou
   view-progress d'un sujet aussi ? Quelles bornes, quel axe et quel fallback
   en l'absence d'overflow ?
5. **État dynamique et incident** — quelles sources vivantes peuvent publier
   une valeur dans un scope `story` ou `scene`, avec quel type, propriétaire et
   cycle de vie ? Quelles valeurs peuvent être capturées dans `event.data`, et
   quel déclaratif choisit explicitement entre ignorer la valeur et en prendre
   un snapshot ?
6. **Précision de l'échantillon** — un snapshot pris au callback IO suffit-il,
   ou certains incidents exigent-ils un échantillonneur commun qui détecte le
   seuil et produit la valeur dans la même mesure ?
7. **Frontière persistante** — quels incidents sont `persist-only`, quelle
   action ACE ils rejouent, et sont-ils ancrés au début ou à la fin du segment
   qu'ils décrivent ?
8. **Réduction de trajectoire** — la forme persistée canonique est-elle une
   suite de keyframes `{ offsetMs, progress, ease? }`, dont
   `{ from, to, duration, ease }` est dérivé, ou conserve-t-on directement les
   segments ? Quelle normalisation versionnée produit `progress`, quelles
   valeurs d'easing ACE sont admises et quelle durée minimale évite les
   segments nuls ?
9. **Rétention et fermeture** — quel réducteur remplace les samples bruts pour
   cette source continue ? Pour le conteneur, la trajectoire ouverte est-elle
   flushée seulement à `scrollend`, ou aussi au démontage logique,
   `sequence:end` et destruction, avec quelle garantie de dernier sample ?
10. **Action de replay** — le contrat réserve-t-il deux actions `fn` (pose
   live par `data.value`, trajectoire temporelle par `transitions` et
   `progress`),
   ou normalise-t-il une primitive dédiée ? Comment une action ou un binding
   lit-il `g` et/ou l'état dynamique sans fermeture JS ?
11. **Event-persist ouvert** — l'auteur voit un event unique révisable ; le
    runtime conserve-t-il la projection player-locale et ne commite-t-il qu'à
    la fermeture, ou le journal adopte-t-il réellement un `upsert` révisionné,
    avec les invalidations et garanties d'effets dérivés que cela implique ?
12. **Densité et lecture** — les segments couvrent-ils sans trou toute la durée
    depuis le montage, notamment les pauses ? Quel algorithme de simplification
    borne leur nombre, et quel index runtime permet de lire un segment sans
    reparcourir toute la trajectoire ?
13. **Seek d'une trajectoire ouverte** — Seek ferme-t-il ou annule-t-il la
    capture ouverte, ou crée-t-il explicitement une nouvelle branche avant de
    reprendre les valeurs live ? Comment garantit-il que la présentation vient
    de l'event-persist et non de `g` navigateur ?
14. **Portée** — un driver ou une capacité appartient-il à une scène, une story,
   ou à un conteneur matériel publié par un composant ? Peut-il viser hors de sa
   scène ?
15. **Commande de position** — quel event cible le scrollport avec un
    `progress` discret, quel transport natif fluide est autorisé pendant Play,
    et quelle pose immédiate est imposée au Seek ?
16. **Conversions** — quelle API déclarée fournit `position -> progress` et
    `progress -> position`, avec quelles bornes, quel axe et quelle politique
    de clamp ?
17. **Condition initiale** — l'état déjà visible au montage est-il un `enter`
   journalisé ou seulement l'initialisation silencieuse du réducteur ?
18. **Pause et `sequence:end`** — observe-t-on, réduit-on et/ou émet-on hors de
   `playing` ? Quelle phase est reprise ensuite ? Le driver `g` continue-t-il
   sa présentation pendant une pause temporelle, et `sequence:end` flushe-t-il
   toujours la trajectoire avant de retirer les sources ?
19. **Seuils** — le premier contrat retient une règle par seuil. Faut-il
   plafonner le nombre de règles déclarées pour une même cible ?
20. **Destinée de l'event** — quels `storyId`, track et `visibility` sont
   autorisés pour une condition déclarée par un descendant ? Les mêmes règles
   que `Perso.emit` doivent s'appliquer.
21. **Accessibilité et fallback** — quel état reste lisible sans animation ou
   avec `prefers-reduced-motion` ? Une condition qui porte une fonction
   essentielle ne doit pas dépendre d'un effet de présentation.

## 9. Acceptance path si la capacité est validée

Avant tout changement de `packages/codplay`, créer un plan V2 accepté qui
mappe explicitement les points suivants :

- tests ACE purs du driver : bornes, easing, valeurs supportées et absence de
  sémantique temporelle parasite ;
- test du runtime de présentation : une variation de `g` met à jour seulement
  le binding visé, ne crée aucun event/journal et se réapplique correctement
  pendant la capture live ; quand une trajectoire persistante est sélectionnée
  par replay ou Seek, `g` n'écrase pas cette présentation ;
- mesure ou test de coalescence : plusieurs notifications de scroll avant un
  rendu ne causent qu'une présentation de la dernière valeur ;
- test d'une source vivante tierce : publication player-locale, destruction et
  refus d'un accès direct au journal ou aux nodes des autres composants ;
- test d'état dynamique : une source conteneur publie `g` dans le scope déclaré
  sans écrire dans le state reconstructible, le retire à la fermeture et ne
  reste pas lisible par une action sans contrat de projection explicite ;
- compilation et diagnostics de la déclaration conteneur : progression,
  surfaces, `capture`, état dynamique et tableau `observe` ;
  cible descendante, root publié, options d'observation, `enter`, `leave`, events multiples et
  visibilité invalide ;
- test unitaire du réducteur de condition : initialisation, entrée, sortie,
  inversion rapide, règles à seuils distincts, absence d'émission répétée et condition
  de visibilité invalide ;
- test de snapshot : l'incident journalisé conserve la valeur déclarée et la
  phase réduite, sans `IntersectionObserverEntry` ni référence vivante ;
- test de replay : après changement de `g` et de visibilité courante, un `Seek`
  relit le snapshot et les events dérivés existants sans relancer `listen`,
  strap ou observation ;
- test `persist-only` : le segment écrit après son observation ne modifie pas
  la pose live déjà produite par le driver, puis un Seek l'inclut dans la
  reconstruction ;
- test de trajectoire réduite : une action `fn` live reçoit `data.value` et
  `data.valueId`, produit la pose présente sans écrire dans le journal ; au
  replay, l'action `fn`
  temporelle évalue les keyframes de `progress` — et leurs segments dérivés —
  avec l'easing ACE et atteint la même pose ;
- test de normalisation responsive : à géométrie de scroll différente, les
  keyframes fractionnaires alimentent la même progression ACE sans écrire une
  position de viewport ; le `progressSource` identifie sans ambiguïté la
  formule, le root et la politique de borne ;
- test de conversions : `position -> progress -> position` respecte axe,
  bornes et clamp du conteneur ; l'event discret de position emploie le
  transport fluide du scrollport pendant Play, mais pose directement la valeur
  résolue pendant Seek ;
- test de bornage : l'accumulateur ne retient pas les samples bruts, fusionne
  les samples contigus et ne produit qu'un tableau sérialisable de keyframes ou
  de transitions ;
- test de compression : le simplificateur en ligne conserve début, fin, pauses
  et inversions, respecte sa tolérance déclarée sans stocker la trace complète ;
  une passe RDP de fermeture ne peut améliorer la trace qu'après sa clôture ;
- test de flush : dans le régime d'activité bornée, `scrollend` ferme ou flushe
  selon la politique retenue ; dans le régime conteneur ouvert, il ne produit
  qu'une compaction optionnelle et seul le cycle de vie ferme la trajectoire,
  sans micro-events ;
- test d'immutabilité : une transition déjà journalisée ne peut plus être
  complétée ; la réduction est terminée avant l'append du fact ;
- test de trajectoire ouverte : le montage logique produit une unique
  contribution identifiée, les révisions de sa liste ne traversent ni le
  dispatcher ni les `listen`/straps, et sa fermeture écrit une seule copie
  immuable `persist-only` ;
- test d'option : avec `capture: false`, le conteneur livre `g` et ses events
  d'intersection mais ne crée aucun event-persist ; avec la valeur par défaut,
  il ouvre et
  réduit la trajectoire ;
- test de fermeture : démontage logique, `sequence:end` et destruction
  prennent le dernier sample, flushent la copie persistante lorsque requis,
  puis retirent listener scroll, observers, queue et état dynamique ;
- test de coût : plusieurs révisions de la trajectoire pendant un même frame
  sont coalescées, n'invalident ni la révision du journal ni la timeline
  structurelle, et ne déclenchent qu'une mise à jour du perso ciblé ;
- test de couverture et d'index : les pauses sont représentées ou indexées
  explicitement ; une lecture et un Seek trouvent le segment correspondant à
  `t - t0` sans parcourir linéairement une longue liste ;
- test Seek d'ouverture : la politique retenue (fermeture, annulation ou
  branche) interdit qu'une nouvelle valeur scroll réécrive silencieusement la
  partie déjà observée de la timeline ; replay et Seek présentent la
  trajectoire persistante, jamais `g` lu dans le viewport à cet instant ;
- test de lecture : une lecture temporelle qui traverse un segment
  `persist-only` exerce le tween ACE de son début à son endpoint ; un Seek
  direct vers l'endpoint vérifie la pose finale sans exiger une animation réelle ;
- test du pont HTML avec un faux `IntersectionObserver` : root, partage des
  observers, queue stable, teardown et absence de node exposé ;
- intégration réelle : scroll d'un viewport puis d'un conteneur, animation ACE
  mise à jour par `g`, `enter` et `leave` IO déclenchant plusieurs events
  déclarés et présents dans le journal ;
- preuve `Play` puis `Seek` au même temps : le seek rejoue les faits sans créer
  d'observateur ni consulter le viewport, puis présente la trajectoire
  persistante sans contribution du viewport courant ;
- non-régressions pause/reprise, resize, persistances de matérialisation,
  parent/enfant, reparentage et destruction ;
- passe navigateur Chromium, Firefox et Safari pour la source continue et
  l'observation ; toute utilisation facultative de `ScrollTimeline` ou
  `ViewTimeline` doit être testée et posséder son fallback ;
- vérification `prefers-reduced-motion`, test, typecheck, build et contrôle
  navigateur conformément aux gates V2.

## Références CodPlay lues

- `packages/codplay/plan/codplay-v2-plan.md` ;
- `packages/codplay/plan/player-engine-plan.md` ;
- `packages/codplay/plan/facade-engine-instance-plan.md` ;
- `packages/codplay/specs/input-projection-spec.md` ;
- `packages/codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md` ;
- `packages/codplay/projet/notes/2026-07-27-emetteurs-et-events-user-complexes.md` ;
- `packages/codplay/plan/perso-emit-v2-portage-plan.md` ;
- `packages/codplay/src/scene/types.ts` ;
- `packages/codplay/src/scene/compiled/scene-builder.ts` ;
- `packages/codplay/src/ace/tween.ts` ;
- `packages/codplay/src/runtime/components/runtime-component-runtime.ts` ;
- `packages/codplay/src/runtime/runner-html/perso-emit-source-adapter.ts` ;
- `packages/codplay/src/runtime/player/pipeline/runtime-event-dispatcher.ts` ;
- `packages/codplay/src/runtime/player/pipeline/track-journal.ts` ;
- `packages/codplay/src/runtime/capture/capture-types.ts` ;
- `packages/codplay/src/runtime/capture/runtime-capture-session.ts` ;
- `packages/codplay/src/runtime/player/capture/live-capture-actions.ts` ;
- `packages/codplay/src/runtime/player/pipeline/action-sequence.ts` ;
- `packages/codplay/src/runtime/player/pipeline/materialize.ts` ;
- `packages/codplay/src/runtime/player/runtime-player/scene-state.ts` ;
- `packages/codplay/src/runtime/config/event-insertion.ts` ;
- `packages/codplay/src/facade/instance-host.ts` ;
- `docs/formalisation/v1-capture-spec.md`, `docs/formalisation/v1-seek-spec.md`,
  `docs/formalisation/v1-strap-spec.md` et `docs/formalisation/v1-event-spec.md`.
