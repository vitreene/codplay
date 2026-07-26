# Portabilité — le portage comme contrainte de rédaction

Note de réflexion (2026-07-26). Chapitre du cahier des charges V2
(`2026-07-16-solve-project-moteur-custom.md`). Part de l'intention : **codplay ignore la plateforme où
il joue** ; ce sont les **composants** qui font le relais vers la plateforme. Conséquence testée sur un
cas concret — un portage vers **Flutter**. Aucun code — trace de la réflexion.

## L'intention (pas un « test », une ligne de conception)

Cœur **agnostique**, composants **écrits sur mesure pour la plateforme visée** — « on ne peut pas y
échapper » : aucun degré d'abstraction ne rend un `<video>` HTML et un `video_player` Flutter
interchangeables sans code par plateforme. La frontière cœur/composants **n'est pas un défaut à
réduire** : c'est la ligne de conception. La Projection (S8) et les composants ne *contournent* pas
cette frontière — ils la **matérialisent** : tout ce qui est plateforme est d'un côté, nommément ; le
cœur ignore l'autre.

## Constat de code — l'hypothèse tient largement

Vérifié : **builder et track-manager n'ont AUCUNE dépendance web** (portables tels quels). Le **cœur
du player** ne touche le web qu'en une **poignée** d'endroits (`mountTarget`, `replaceChildren`,
`childNodes`, `style.pointerEvents`, `elementsFromPoint` — `player.ts`). Les **composants** touchent la
plateforme, mais c'est **leur rôle** — leur non-portabilité est voulue, pas un défaut.

## Les obstacles d'un portage Flutter — et ce qui les résout

| Obstacle | Nature | Résolu par |
|---|---|---|
| Le player tient encore des nodes DOM | Fuite de substrat dans le cœur | **Projection (S8)** — une `FlutterProjection` fournit `mount`/`set`/`measure`/`hitTest` ; le player ne touche plus un node |
| Impératif/mutatif vs déclaratif | Paradigme | **`f(t)` + solve/project (V2)** — « état(t)=f(scène,t), les composants projettent l'état » EST la boucle `build(context)` de Flutter |
| Unités cqw / mesure web-spécifiques | Résolution de plateforme | **Projection** — `resolveUnit` par cible ; le cqw reste une *intention*, chaque Projection la résout |
| Interpolation = anime.js (web) | Moteur de plateforme | **Moteur custom (V2)** — `solve(from,to,ease,t)→valeur` pur, tourne en Dart comme en TS |
| Composants riches (texte, média, SVG, DnD) | **Irréductible** | Réécriture par composant — **attendue** (les composants font le relais) |

**Le point qui boucle la V2** : les quatre premiers obstacles sont résolus par des points de la V2 déjà
posés. Le portage Flutter n'est donc **pas un chantier séparé** — c'est un **révélateur** qui confirme
la V2 par un autre angle. Chaque fuite que Flutter exposerait (nodes dans le player, cqw web, anime
web, mutation impérative) correspond exactement à un point V2. Si la V2 est faite, Flutter devient :
**cœur inchangé + composants réécrits + une `FlutterProjection`.** « Aisé » au sens fort — un portage
d'adaptateurs, pas de logique. Le seul irréductible (composants riches) est déjà assumé par l'intention.

## Le point de fond — le portage discipline le code TS lui-même

Le plus important, et c'est une **règle d'écriture**, pas seulement une propriété d'architecture :

> Se tenir à la contrainte « ce cœur doit pouvoir tourner sur une autre plateforme » **oblige un style
> de code**, y compris dans la version TS où aucun portage n'est prévu. Elle interdit *à l'écriture*
> les commodités qui *marchent* en TS/web mais sont des fuites de plateforme.

Elle rejette, dès l'écriture : lire `document`/`window`/un global de plateforme depuis le cœur ;
supposer une string CSS là où une valeur structurée suffit ; muter un node quand on peut produire un
état ; s'appuyer sur une particularité de moteur (cache transform d'anime, comportement de reflow).
Ce sont exactement les **cicatrices** trouvées en discussion (`resolveContainerQueryValue` parsant
contre `margin-left`, le hack `"Npx"`, `stripIdentityTransforms`) : des concessions à la plateforme
faites *dans le cœur*. La contrainte de portage les aurait **interdites à l'écriture**, pas corrigées
après coup. Le portage n'a pas besoin d'être *fait* pour être utile — il suffit qu'il soit le **critère
de relecture** présent : « cette ligne suppose-t-elle le web ? si oui, elle est mal placée ». C'est le
pendant *actif* de « codplay ignore sa plateforme » : non « il l'ignore par chance », mais « on écrit
chaque ligne du cœur en refusant de la connaître ». Sans cette discipline, le cœur re-fuite ligne après
ligne (comme il l'a fait — les nodes dans le player) ; avec elle, chaque fuite est visible à l'écriture.

## Curseur de rigueur — au-delà de la plateforme, la rigueur interne

La contrainte de portage a un cran supérieur : viser un cœur **rigoureux en soi**, indépendamment de
toute cible. Deux qualités internes qu'un portage exigeant révèle (et que la version TS gagne à avoir
de toute façon) :

- **Typage exhaustif** — pas de `unknown`/`Record<string, unknown>` qui traversent le cœur. Toute
  cible sérieuse l'exige (Flutter/Dart y compris : sound typing, sealed classes). Voir chantier ci-dessous.
- **Pas de mutation d'état partagé floue** — un état produit plutôt que muté, des dépendances sans
  cycles (l'orchestrateur ↔ composants ↔ registries actuels, et `create-player.ts` à 2500 lignes,
  sont les points à assainir). `solve/project` + `f(t)` y aident directement (moins d'état mutable,
  « produire une valeur » plutôt que « muter un node »).

« Rigoureux en soi » et « portable » sont la même exigence vue de deux angles : un cœur qu'on écrit
comme s'il devait être porté est un cœur plus rigoureux **même en TS**.

## Chantier V2 mûr — resserrer le typage (les `unknown` se dissipent)

Les `unknown`/`Record<string, unknown>` de codplay n'étaient **pas de la paresse** : c'était de
l'**indétermination légitime** au moment de l'écriture (on ne savait pas encore quelles formes les
données prendraient). Aujourd'hui le projet contient **de nombreux cas réels** qui cernent l'usage et
l'emploi des données — l'indétermination qui justifiait le `unknown` **s'est résolue** (même mouvement
que « l'interaction résout l'indétermination » du modèle `f(t)` : le `unknown` *était* l'indétermination,
les cas d'usage l'ont résolue en types nommables).

Conséquence : **mieux cerner les types est un chantier V2 mûr, pas spéculatif** — sa matière existe
(les cas). C'est le pendant côté typage de « la faisabilité de `f(t)` est un inventaire, pas un pari » :
la faisabilité du typage fort est une **remontée des cas existants vers des types**, pas une invention
*a priori*. Démonstratif.

## Correction — le seek V2 est SYNCHRONE (l'async est une dette V1, pas un obstacle de portage)

Point à ne pas laisser traîner (contradiction relevée par l'auteur). Le `seek()` actuel est `async`
(`await replayDueTimelineEventsForSeek`, `create-player.ts`) — **mais cet async vient du REJEU**
(rejouer les events un par un prend du temps, d'où l'`await`). Le modèle `f(t)`
(`2026-07-26-etat-fonction-de-t.md`) **supprime le rejeu** : le seek devient une **évaluation**
(interroger la scène à `t`), donc **synchrone**. `f(t)` ne rend pas seulement le seek réversible — il le
rend **synchrone**, en retirant la raison même de son asynchronie. L'async n'est donc **pas** un
obstacle de portage : c'est une **dette V1 que la V2 solde**. (Cohérent avec la décision antérieure :
seek synchrone/déterministe, `seek ≡ play` ; l'async debouncé ne concerne que la *correction de mesure*
du cas rare ancêtres-mobiles, jamais le seek de l'état — `2026-07-26-seek-flip-ancetres-mobiles.md`.)

## Statut

Portabilité = **conséquence de la V2**, pas chantier séparé. Le portage (Flutter comme cas concret) est
un **révélateur** qui confirme le cahier des charges, et surtout une **contrainte de rédaction** du code
TS présent. Chantier typage : **mûr** (adossé aux cas existants). Aucun code écrit. Lié :
`2026-07-16-solve-project-moteur-custom.md` (V2 : Projection, solve/project, moteur custom),
`2026-07-26-etat-fonction-de-t.md` (f(t) → seek synchrone).
