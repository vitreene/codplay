# Plan V2 — transposition Avatar par composants

> Statut : **En cours**.
>
> Cette tranche est engagée à la demande de l'auteur. Elle porte sur la
> composition Avatar V2 et sa démonstration ; elle ne modifie pas le core
> CodPlay sans obstacle démontré, argumenté et autorisé.

## 1. Objectif

Transposer intégralement l'application Avatar de TalkingHead dans un dossier
dédié de `@codplay/component-v2`, sans reproduire son regroupement monolithique :

- `avatar` charge et initialise un modèle 3D préparé ;
- `avatar-mood`, `avatar-lip-sync` et `avatar-gesture` portent chacun une
  responsabilité auteur distincte ;
- les responsabilités encore regroupées dans l'adaptation de référence
  (`morph`, `gaze`, `blink`, `head-drift`, `breathe`, `pose` et caméra) sont
  portées par des composants ou capacités Avatar cohérents ; la pose de repos,
  le clignement et la dérive appartiennent à `avatar-idle` ;
- un coordonnateur Avatar recueille les contributions et les applique à
  l'objet chargé ;
- la scène auteur ne fait que déclarer les relations, les données et les
  eventimes.

Le dépôt TalkingHead est la référence fonctionnelle explicite de cette
transposition. L'implémentation Avatar V2 est autonome : elle ne partage aucun
composant, moteur, type ou circuit d'exécution avec l'implémentation V1.

## 2. Relations et montage

Le host Three reste propriétaire du canvas, du renderer, de la scène et du
commit :

```ts
avatar:          { rel: { host: 'three-scene-host' } }
avatar-mood:     { rel: { host: 'three-scene-host', target: 'avatar' } }
avatar-lip-sync: { rel: { host: 'three-scene-host', target: 'avatar' } }
avatar-gesture:  { rel: { host: 'three-scene-host', target: 'avatar' } }
avatar-idle:     { rel: { host: 'three-scene-host', target: 'avatar' } }
avatar-gaze:     { rel: { host: 'three-scene-host', target: 'avatar' } }
```

Le composant `avatar` ne reçoit pas `move`. Il ajoute son objet au
`ThreeSceneTarget` reçu par `rel.host`, puis publie une capacité Avatar opaque
identifiée par son perso. Les composants spécialisés ne recherchent ni le host,
ni le modèle, ni ses nœuds internes : ils consomment seulement cette capacité.

## 3. Découpage complet et ordre de transposition

Le dossier `packages/authoring/component-v2/src/avatar/` sépare les composants
CodPlay des capacités internes par responsabilité. `components/` contient la
surface auteur et ses définitions ; `runtime/` contient le coordonnateur et la
façade qui composent les capacités ; `model/`, `morph/`, `mood/`, `gesture/`,
`gaze/` et `idle/` contiennent chacun un traitement interne homogène. Il n'y a
pas de dossier `core/` ou `engine/` fourre-tout. La présence des morphs, os et
conventions du GLB reste une responsabilité de la ressource Avatar préparée ;
la validation auteur ne prétend pas inspecter le modèle.

Les tranches sont traitées dans cet ordre, chacune avec son contrat et sa
validation propre avant d'être utilisée par la démo :

1. `avatar-lip-sync` : événements ponctuels de visème, tables stables de
   correspondance vers les morphs, intensité et transition depuis l'état
   présent, puis replay déterministe après seek et reprise ;
2. `avatar-mood` : expressions sémantiques, baselines et transitions de mood ;
3. `avatar-gesture` : gestes corporels et replay déterministe ;
4. `avatar-idle` : pose de repos, clignement, respiration et dérive de tête ;
5. `avatar-gaze` : contact visuel vers la caméra du host ;
6. capacité caméra Avatar, raccordée au composant caméra Three existant ;
7. scène d'acceptation : port complet des eventimes, straps, piste optionnelle,
   audio et captions de la scène de référence, avec adaptation vers les
   composants spécialisés.

Une tranche ne déclare pas dans la scène des événements dont aucun composant
ne porte encore le comportement. Les tests de chaque tranche restent
autonomes et la démo ne sert qu'à l'acceptation intégrée finale.

Le coordonnateur applique dans un ordre stable les couches suivantes :
expression/mood, geste, puis les morphs produits par les composants spécialisés.
Le composant lip-sync transforme un événement ponctuel en animation morphique
et transmet les échantillons au coordonnateur ; il ne conserve pas une liste de
cues persistants. Le temps absolu CodPlay reste la seule horloge et le rendu
reste celui du host Three.

## 4. Démo d'acceptation

La démo V2 est ajoutée au registre partagé. Elle reprend les assets et le
scénario Avatar déjà présents dans le dépôt, mais déclare uniquement les
composants V2 et passe par le layout V2 commun. Elle doit permettre de
constater au minimum :

- chargement et centrage de l'avatar dans un `three-scene-host` ;
- changement de mood par eventime ;
- lecture d'une séquence de visèmes synchronisée avec l'audio préparé ;
- déclenchement d'un geste indépendant du lip-sync ;
- reprise et seek par le telco commun.

Les tests du package restent indépendants de cette démo et utilisent des
cibles Avatar synthétiques propres au composant. Les valeurs de la démo ne
sont jamais leurs oracles.

## 5. Gate de core

Cette tranche utilise les circuits existants : `rel`, le registre de cibles,
`ComponentAnimation`, le preload V2 et le commit du host Three. Si une
capacité manque réellement dans `packages/codplay`, l'implémentation s'arrête
à la frontière concernée et le besoin est documenté avant toute modification
du runtime.

### Correction générique autorisée — 19 septembre 2026

La première démo a révélé une lacune de disponibilité : le runtime liait la
publication d'une cible à `placement.mounted`, alors que le composant central
Avatar est un composant logique attaché au host et n'a pas de `move`. La
correction retenue est générique : la définition engine porte un
`runtimeProfile` interne (`placed` ou `attached`). Elle ne contient aucune
connaissance d'Avatar, de Three.js ou de Rive ; elle permet d'étendre plus tard
les divergences de cycle de vie au même endroit.

Le test visuel navigateur est concluant : un Avatar sans `move` publie sa
cible, les composants spécialisés la reçoivent et la scène présente bien les
changements attendus. Cette validation clôt la correction de disponibilité,
mais pas la validation complète des comportements Avatar restants.

## 6. Validation

À chaque étape :

1. typecheck du package Avatar et de `@codplay/component-v2` ;
2. tests unitaires des composants avec fixtures autonomes ;
3. build/typecheck de la démo V2 ;
4. tentative navigateur sur le chemin réel quand les assets sont disponibles.

## 7. État du 19 septembre 2026

La première transposition du composant central, de `mood`, `lip-sync` et
`gesture` est écrite dans `packages/authoring/component-v2/src/avatar/`.
Les capacités Avatar V2 sont reprises par tranches ; une capacité n'est
déclarée dans la scène qu'une fois son composant V2 validé.

Validations exécutées :

- typecheck de `@codplay/component-v2` ;
- tests du package avec cibles Avatar synthétiques indépendantes de la démo ;
- typecheck du moteur Avatar interne à `component-v2` (inclus dans le
  typecheck du package) ;
- typecheck V2 et build de `@codplay/demos` ;
- contrôle HTTP local du GLB, de l'audio et de l'entrée `?demo=avatar`.

La vérification visuelle navigateur de la lecture, du seek et de la reprise est
progressivement menée dans les tranches détaillées ci-dessous ; le plan
demeure **En cours** tant que l'ensemble Avatar n'est pas clôturé.

## 8. Tranche `avatar-mood` — 20 septembre 2026

La deuxième tranche est portée dans `avatar-mood-component.ts` selon le même
contrat temporel que `avatar-lip-sync`. `avatar-mood` est l'unique composant
public de la famille des expressions faciales : les morphs sont sa mécanique
interne et aucun composant `avatar-morph` séparé n'est enregistré.

- le perso déclare une action par mood (`avatar:mood:neutral`,
  `avatar:mood:happy`, etc.) ; chaque occurrence reste un événement ordinaire
  reçu par le composant via `activeActions` ;
- le composant résout le mood, sa durée éventuelle (`durationMs`) et produit
  une transition absolue de baselines avec une interpolation smoothstep ;
- le composant remet la couche au `AvatarCoordinator`, sans connaître le
  modèle, ses meshes ou le host Three ;
- une absence de durée conserve le comportement discret : la bascule est
  immédiate et la couche complète explicite les valeurs remises à zéro ;
- le coordonnateur conserve les couches expression et morphes et les transmet à
  l'engine Avatar attaché au host.

Les entrées auteur actuellement disponibles sont `neutral`, `happy`, `angry`,
`sad`, `fear`, `disgust`, `love` et `sleep`. La liste et un exemple d'emploi
sont maintenus dans le README de `component-v2`. Toute nouvelle action faciale
sémantique devra étendre cette même famille, sans exposer les morph targets
internes du modèle et sans créer un composant parallèle.

La couverture autonome vérifie la transition `neutral -> sad`, ses valeurs
intermédiaires, la transmission par la capacité Avatar et la coexistence avec
le lip-sync et le geste. Elle n'importe aucune valeur de la démo.

La démo Avatar a été exercée sur le chemin navigateur réel : les actions
`avatar:mood:happy` et `avatar:mood:neutral` sont observées à `4600 ms` et
`8800 ms`, et les positions `5000 ms` et `10000 ms` ont été rendues après seek.
Aucun changement du core CodPlay n'a été nécessaire. La tranche mood est
validée ; la transposition Avatar globale reste **En cours**.

## 9. Tranche `avatar-idle` — 20 septembre 2026

La tranche suivante expose le clignement spontané prévu par TalkingHead :

- `avatar-idle` est un composant logique attaché à la cible Avatar ; il ne
  reçoit pas de `move` et ne dépend d'aucun événement auteur ;
- il installe le `BlinkScheduleFn` du moteur Avatar interne V2 via la capacité
  Avatar ;
- les séquences simple ou double utilisent les durées et les probabilités du
  modèle TalkingHead, mais leur hasard est déterministe à partir de l'identité
  du composant (ou de `blinkSeed`) afin que le seek reconstruise le même
  clignement ;
- le coordonnateur réinstalle le scheduler après `prepareSeek`, puisque
  l'engine efface ses callbacks d'animation pendant cette phase ;
- la démo déclare `avatar-idle` avec la pose `neutral`, `blink: true`,
  `breathe: false` et `headDrift: true` ; la respiration reste une capacité
  optionnelle regroupée dans cette même responsabilité d'idle.

Les tests du composant vérifient la production d'une fenêtre de clignement,
sa reproductibilité après retour temporel et son raccord exclusif à la
capacité Avatar. Aucun changement de `packages/codplay` n'est nécessaire.

## 10. Composant `avatar-gaze` — 20 septembre 2026

La tranche suivante ajoute le contact visuel générique comme composant Avatar
distinct :

- `avatar-gaze` se rattache à la cible Avatar et reçoit les événements
  ordinaires `avatar:gaze:on` et `avatar:gaze:off` ; le choix stable est porté
  par le nom de l'action, tandis que `contact` et `durationMs` restent des
  données dynamiques ; il ne connaît ni le modèle, ni ses os, ni la scène Three ;
- lorsqu'une durée est fournie, le composant fait varier progressivement le
  contact avec une courbe ease-out : le mouvement démarre rapidement puis
  ralentit à l'approche de la pose finale. Lors d'une désactivation, la
  contrainte reste active jusqu'à la fin de la transition afin que la
  correction tête/yeux revienne progressivement ;
  sans durée, le changement reste discret ;
- le composant central conserve la caméra publiée par le host et la transmet
  à l'`AvatarEngine` ; le composant Avatar spécialisé ne reçoit donc pas une
  référence Three directe ;
- `AvatarEngine` réutilise `GazeService` pour appliquer la correction
  tête/yeux après les couches morphiques et la reconstruit au `commitSeek` ;
- `ThreeSceneTarget.getCamera()` est une lecture de la caméra sélectionnée par
  le host. Elle complète `setCamera()` sans déplacer la responsabilité de
  création ou de rendu hors de `three-camera` et `three-scene-host` ;
- la démo exerce l'activation initiale et deux événements ordinaires de
  désactivation/réactivation. Les tests du composant et du pont Three restent
  autonomes et ne dépendent pas des valeurs de la démo.

Validations exécutées : typecheck et tests de `component-v2`, typecheck et
tests de `avatar-engine`, typecheck et build de `demos`, puis lecture
navigateur avec le journal d'événements et Seek aux positions `5000 ms`,
`5800 ms` et `6200 ms`. Les actions `avatar:gaze:off` et `avatar:gaze:on` sont
reçues ; la position `6200 ms` montre la transition progressive vers le
contact désactivé. Aucun changement de `packages/codplay` n'est nécessaire.

## 11. Validation de `avatar-gesture` — 20 septembre 2026

La composante geste existante est conservée comme responsabilité corporelle
distincte. Le perso déclare une action par entrée publiée par `GestureEngine` :
`avatar:gesture:handup`, `avatar:gesture:index`, `avatar:gesture:point`,
`avatar:gesture:ok`, `avatar:gesture:thumbup`, `avatar:gesture:thumbdown`,
`avatar:gesture:side`, `avatar:gesture:shrug`, `avatar:gesture:namaste` et
`avatar:gesture:release`. Le choix du geste n'est donc pas placé dans `data`.

Le composant continue de transmettre le nom et un seed déterministe à la
capacité Avatar. `AvatarEngine` assure l'interpolation des os, le retour vers
la pose active sur `avatar:gesture:release` et la reconstruction instantanée
lors d'un Seek. La démo a été vérifiée sur le chemin navigateur réel aux
positions `6200 ms`, `7000 ms`, `9400 ms` et `12800 ms` : `handup` et `thumbup`
sont visibles, et le relâchement est engagé après `9200 ms`.

## 12. Pose de repos et balancement idle — 20 septembre 2026

`avatar-idle` reste le seul composant supplémentaire pour la présentation
spontanée du personnage. Il transmet au coordonnateur :

- la pose de repos (`neutral` par défaut), appliquée dès que le modèle est
  disponible ;
- le scheduler de clignement existant ;
- un déclencheur de respiration déterministe, joué par l'animation native de
  l'engine et désactivable par `breathe: false` ; il anime le torse via
  `chestInhale` et conserve la réponse faciale associée ;
- une dérive déterministe contenue mais perceptible, inspirée de l'animation
  idle de TalkingHead, qui combine les rotations du corps et de la tête.

La dérive est une fonction de l'horloge absolue. Elle est réinstallée après un
seek et appliquée après la pose corporelle afin que le mouvement ne soit pas
écrasé par la transition de pose. Aucun composant `avatar-pose` séparé n'est
créé et aucun changement du core CodPlay n'est requis.

Les tests autonomes couvrent la transmission de la pose, des schedulers de
clignement et de respiration, ainsi que la reproductibilité de la dérive. La
vérification navigateur sur le chemin réel confirme qu'après chargement, un
retour à `0 ms` présente déjà l'avatar en pose `neutral`, sans passage visible
par la pose en T ; la lecture traverse ensuite les cycles idle avec le modèle
rendu. La tranche est validée ; la transposition Avatar globale demeure
**En cours**.

## 13. Vocabulaire d'actions Avatar — 20 septembre 2026

Un perso Avatar déclare dans `actions` les actions stables qu'il accepte. Le
nom de l'action porte donc le choix sémantique : `avatar:mood:happy`,
`avatar:gesture:thumbup`, `avatar:gesture:release`, `avatar:gaze:on` et
`avatar:gaze:off`, par exemple. L'eventime ne répète pas ce choix dans `data`.

`data` reste réservé aux valeurs qui varient par occurrence : `durationMs`,
`contact` et le contenu dynamique d'un événement `avatar:viseme`. Cette règle
évite de déclarer plusieurs fois une même action générique et maintient la
surface auteur lisible ; elle ne change pas le circuit ordinaire des events ni
le core CodPlay.

Pour `avatar:viseme`, le perso lip-sync porte directement l'id
`avatar:viseme`. L'auto-action canonique `actions[perso.id] = null` suffit donc
à recevoir les données du visème ; aucune entrée vide `actions['avatar:viseme']`
n'est répétée dans la scène.

Les types publics du dossier Avatar décrivent séparément les propriétés
initiales de chaque perso (`avatar`, `avatar-mood`, `avatar-lip-sync`,
`avatar-gesture`, `avatar-idle` et `avatar-gaze`) et leurs payloads dynamiques
d'action. Chaque propriété est commentée ; les choix stables restent dans le
nom des actions et ne réapparaissent pas dans ces payloads.

La démo a été relue dans Safari sur le chemin réel : le journal reçoit
`avatar:mood:happy`, `avatar:mood:neutral`, les quatre actions de geste et
`avatar:gaze:on/off`, avec `durationMs` et `contact` seulement dans les données
dynamiques. Aucun événement générique `avatar:mood`, `avatar:gesture` ou
`avatar:gaze` n'est déclaré par cette scène.

## 14. Organisation interne par responsabilité — 20 septembre 2026

Le dossier Avatar V2 ne possède plus de répertoire générique `core/` ni de
répertoire `engine/` regroupant des traitements sans lien direct :

- `components/` porte les classes de composants, les types auteur, les
  validations et les définitions d'enregistrement ;
- `runtime/` porte uniquement la composition : `AvatarCoordinator` recueille
  les contributions des composants, `avatar-target.ts` définit la capacité
  échangée, et `AvatarEngine` expose la façade de cycle de vie, de lecture et
  de synchronisation vers Three.js ;
- `model/` porte le parsing d'une instance GLB et le retargeting du modèle ;
- `morph/` porte l'état, l'application des morph targets et leur binding vers
  les os Three.js ;
- `mood/`, `gaze/` et `idle/` portent chacun le traitement interne de leur
  capacité respective ; `gesture/` sépare son catalogue de poses et de gestes
  (`gesture-definitions.ts`) de l'état mutable et du comportement
  (`gesture-engine.ts`).

Le nom `AvatarEngine` désigne donc la façade runtime qui compose ces modules ;
les animations, tables et traitements spécialisés ne sont plus rangés dans un
répertoire `engine`. Le binding des morphes osseux est porté par `morph/`, pas
par la façade. Le catalogue statique des gestes n'est pas mélangé à leur état
d'exécution. `avatar/index.ts` reste la façade publique et réexporte
seulement les composants, le coordonnateur et les utilitaires explicitement
exposés. Le déplacement ne change ni le contrat des composants, ni les
relations `rel.host` / `rel.target`, ni le circuit de preload Three.js.

La vérification de cette réorganisation reste autonome : le typecheck et les
tests du package `@codplay/component-v2` passent, sans test dérivé d'une démo.

## 15. Isolation complète du moteur Avatar V2 — 20 septembre 2026

L'implémentation Avatar V2 reste autonome dans
`packages/authoring/component-v2/src/avatar/`. Elle utilise le support Three.js
V2 et son manifeste explicite `type: 'three-glb'` ou `type: 'three-fbx'` ; `AvatarComponent` consomme
les octets préparés et utilise le `GLTFLoader` fourni par Three.js pour parser
une instance indépendante. Avatar ne possède donc ni cache ni stratégie de
preload spécifique.

## 16. Simplification de la responsabilité mood — 20 septembre 2026

Le fichier intermédiaire `avatar-mood-profile.ts` a été supprimé. La table
`MOOD_BASELINES` du moteur Avatar V2 reste la source unique des expressions ;
`avatar-mood` produit directement ses transitions à partir de cette table et
le coordonnateur initialise sa couche avec la même donnée.

La transition parcourt l'union des morphes source et cible : un morph qui
disparaît d'un mood revient donc progressivement à zéro, sans profil dérivé ni
seconde table. Le comportement auteur et la surface publique des composants ne
changent pas.

## 17. Preload GLB délégué au support Three.js — 20 septembre 2026

Le chargement du modèle ne passe pas par une nouvelle ressource binaire du
core CodPlay. Le support Three.js expose `THREE_PRELOAD_STRATEGIES` et ses types
`three-glb` et `three-fbx` : la stratégie utilise le `FileLoader` du runtime Three préparé par
l'engine, conserve les octets par URL et relie le signal d'annulation au
loader.

`AvatarComponent` lit la ressource préparée par ce support puis remet les
octets au `GLTFLoader.parse` déjà utilisé par l'engine Avatar V2. Chaque Avatar
obtient ainsi sa scène et son squelette indépendants ; Avatar ne fait ni
requête réseau, ni cache, ni import parallèle. Les animations FBX liées à un
avatar réutilisent cette même stratégie binaire ; leur parsing reste dans le
composant Avatar. Le manifeste de l'application
déclare explicitement `type: 'three-glb'`, car le builder générique ne déduit
pas une ressource Three.js à partir de l'extension `.glb`.

Le correctif ne modifie aucun fichier de `packages/codplay/src`. Il est couvert
par le test autonome `component-v2/tests/threejs-preload.spec.ts`, le typecheck
et les tests du package, ainsi que le typecheck et le build V2 des démos.

## 18. Catalogue de motions réparti par composants — 20 septembre 2026

Cette tranche adapte le catalogue de motions de `motion-engine` sans importer
son runtime TalkingHead. Le catalogue est une donnée interne de la capacité
Avatar ; il ne devient pas une seconde API auteur et ne crée pas de composant
par motion.

- `avatar-gesture` reçoit les actions sémantiques de la piste `action` et
  transforme chaque nom déclaré en échantillons de morphes, de pose native et,
  lorsque le mouvement en possède un, d'overlay. La durée et le seed restent
  des données d'occurrence facultatives ; le nom de l'action porte le choix
  stable.
- `avatar-mood` reste le composant des entrées de la piste `mood`. Les
  baselines sont adaptées dans le catalogue interne puis appliquées par la
  même transition de mood ; aucun composant `avatar-morph` ou composant de
  motion générique n'est créé.
- `avatar-idle` conserve les comportements autonomes de repos (`blink`,
  `breathe`, `headDrift`) et ne reçoit pas les motions d'action.
- `AvatarCoordinator` sépare la couche parole de la couche gesture avant de
  les composer. Les visèmes restent des events ordinaires et conservent la
  priorité sur un morph de parole ; aucune conversion ne passe par le core
  CodPlay.
- `AvatarEngine` reste une façade d'adaptation vers Three.js. Il n'héberge ni
  catalogue ni logique d'auteur : il applique les frames résolues, le miroir
  et les overlays sur l'instance du modèle.

La validation autonome couvre la séparation des pistes, le sampling
déterministe, l’override de durée, l’exclusion des canaux réservés au
lip-sync/gaze/idle, la libération d’une action, la composition avec les
visèmes et le rejeu d'un geste après un retour temporel. La démo exerce le
chemin réel avec plusieurs gestes sémantiques, les moods adaptés, les visèmes
et les événements de regard ; ses valeurs ne servent pas d'oracle aux tests.

La documentation publique est complétée dans
`packages/authoring/component-v2/src/avatar/README.md` : relations,
déclarations TypeScript, propriétés de chaque composant, actions et catalogue.

Statut de la tranche motion : **Fixe**. Le statut global du plan reste
**En cours** pour les capacités Avatar qui ne sont pas encore clôturées. La
tranche ne modifie pas `packages/codplay/src`.

## 19. Correction du rejeu de geste après Seek — 20 septembre 2026

Le rejeu d'un Seek reconstruit la scène depuis `0 ms` avant de présenter la
position finale. Le coordonnateur Avatar conserve donc l'indication de rejeu
jusqu'à ce que `avatar-gesture` fournisse la pose corporelle effectivement
active à la position finale. Une remise à la pose neutre pendant cette
reconstruction ne consomme plus cette indication ; la pose sémantique est
ensuite appliquée avec `AvatarEngine.snapGesture()` lorsque la lecture est en
pause.

Cette correction reste limitée à `component-v2` : elle n'ajoute aucun circuit
au core CodPlay et ne modifie pas le host Three. Le test autonome couvre le
retour temporel et la sélection d'un nouveau geste ; Safari a vérifié le
scénario réel lecture jusqu'à environ `6990 ms`, retour à `6800 ms` et pose
`wave_right` immédiatement visible sans reprise de lecture.

Validations de la tranche :

- `@codplay/component-v2` : typecheck et 27 tests autonomes réussis ;
- `@codplay/demos` : typecheck et build Vite réussis ;
- navigateur Safari : GLB chargé par le preload Three.js, avatar rendu,
  événements `avatar:viseme`, `avatar:mood:happy`,
  `avatar:gesture:wave_right` et `avatar:gaze:off` observés dans le journal,
  puis vérification visuelle du geste après Seek.

## 20. Animations liées à l'avatar — 20 septembre 2026

Cette tranche est acceptée pour implémentation. Elle ajoute une seule surface
auteur générique, `avatar-motion`, pour jouer une animation ou une pose
explicitement associée à un avatar.

- `avatar.initial.animations` associe un nom auteur à une ressource Three.js
  préchargée et, si nécessaire, au nom de son clip ; cette déclaration ne
  charge que les ressources que la scène réclame dans son manifeste de preload ;
- `avatar-motion` reçoit les actions ordinaires `avatar:motion:<name>` et
  `avatar:motion:release` ; les noms stables restent dans les actions, et les
  données d'occurrence se limitent à la durée, la vitesse et la boucle ;
- le support Three.js fournit les octets et les loaders Three.js analysent les
  clips ; Avatar ne crée ni import ni cache parallèle ;
- les ressources peuvent être des GLB ou des FBX d'animation compatibles avec
  le squelette Avatar ; les noms Mixamo et l'unité de position sont normalisés
  par l'adaptation Avatar ;
- le composant central possède le modèle et les clips enregistrés ;
  `avatar-motion` ne reçoit ni scène, ni mixer, ni os ;
- la lecture est échantillonnée sur le temps absolu CodPlay et doit être
  reconstructible après Play, Pause et Seek ; le composant ne télécharge pas
  une ressource au moment d'un événement.

La première implémentation porte les ressources liées à un avatar. Le catalogue
d'animations pré-enregistrées, réclamées uniquement lorsqu'une scène les
déclare, reste une tranche distincte afin de ne pas mélanger les deux modes de
provisionnement.

### Implémentation de la tranche

La surface est maintenant implémentée dans `component-v2` :

- `avatar.initial.animations` décrit les ressources nommées et
  `avatar-motion` expose `avatar:motion:<name>` et `avatar:motion:release` ;
- `animation-loader.ts` délègue le parsing aux `GLTFLoader` et `FBXLoader` de
  Three.js, puis normalise seulement les noms Mixamo et l'unité des positions
  FBX nécessaires au squelette de l'avatar ;
- `avatar-animation-player.ts` échantillonne le clip sur le temps absolu,
  reconstruit son état après Seek et laisse une pose non bouclée sur sa dernière
  frame jusqu'à sa libération ;
- `three-fbx` réutilise la même stratégie binaire Three.js que `three-glb` ;
  aucun importateur, cache ou circuit CodPlay parallèle n'a été ajouté ;
- la démo Avatar contient un clip FBX compatible et son entrée de preload afin
  d'exercer le chemin réel du composant.

Les tests autonomes couvrent la lecture absolue, la fin d'une animation, le
Seek, le changement de boucle, la borne de démarrage et la stratégie `three-fbx`.
Le typecheck de `component-v2`, le typecheck V2 des démos et leur build passent.
La vérification navigateur a été effectuée sur la démo : `hero-walk.fbx` est
chargé par le preload Three.js et le personnage reste à la position atteinte
après `avatar:motion:release`. La tranche reste à `En cours` jusqu'à la clôture
globale de l'ensemble Avatar.

## 21. Démo gestes et idle visible — 20 septembre 2026

La scène d'acceptation enrichit maintenant sa séquence corporelle avec des
gestes distincts et espacés : `nod_yes`, `wave_left`, `wave_right`,
`thumbup_right`, `celebrate` et `bow`. Chaque geste reste une action ordinaire
du composant `avatar-gesture` ; les durées propres à cette démonstration ne
modifient pas le catalogue ni le contrat auteur.

L'idle conserve une seule responsabilité et sa surface initiale inchangée.
La démo n'active plus `breathe`, car la déformation obtenue n'est pas acceptable
pour cette présentation. `headDrift: true` conserve le balancement du corps et
de la tête avec une amplitude suffisante pour être perceptible dans la scène.
La capacité de respiration reste disponible séparément, mais n'est plus
présentée comme un mouvement actif par défaut dans cette scène. Aucun composant
ni circuit parallèle n'a été ajouté.

La régression autonome vérifie la respiration du torse sans importer de valeur
de la démo. Les 34 tests `component-v2`, les typechecks `component-v2` et
`demos` passent. La vérification visuelle navigateur des gestes et de l'idle a
été effectuée sur les positions `6500 ms`, `9500 ms`, `12500 ms`, `15500 ms` et
`17800 ms` ; le plan demeure **En cours** pour les tranches restantes.

## 22. Pose neutre relâchée et déplacement relatif — 20 septembre 2026

La pose `neutral` de `avatar-idle` est maintenant une pose de repos relâchée :
les épaules et les bras ne restent plus dans une attitude statuaire. `straight`
est conservé comme alias de compatibilité pour les scènes déjà écrites ; il
désigne la même pose.

Le lecteur `avatar-motion` ne modifie aucune donnée de la timeline CodPlay.
L'event conserve son `startAt`, et le lecteur calcule toujours le temps local
du clip à partir du `timeMs` absolu reçu. Seules les pistes Three.js de
translation sont clonées avec un décalage constant : la première frame du clip
est alignée sur la position locale courante du modèle.

Lorsqu'une action est libérée ou remplacée, la position atteinte est conservée.
Une nouvelle action repart donc de cette position au lieu de revenir à la base
capturée par Three.js. `prepareSeek()` reste le seul chemin qui restaure cette
base, avant de rééchantillonner l'animation à la position absolue demandée.

La régression autonome couvre le démarrage à une position non nulle, la
conservation de la position après `release`, le changement d'animation et la
restauration déterministe après Seek. Les 34 tests `component-v2`, son
typecheck et `git diff --check` passent. La marche d'entrée centrée est
précisée à la section suivante.

## 23. Marche d'entrée centrée — 20 septembre 2026

La marche de la démo est une animation d'entrée, et non une boucle de
déplacement autour du host. Le modèle démarre avec une position locale calculée
à partir du déplacement final du clip `hero-walk.fbx` et de sa rotation de
présentation. Le clip est joué une seule fois depuis `0 ms`, puis libéré après
son arrivée ; la position actuelle est conservée par `avatar-motion`.

Cette adaptation ne modifie ni la timeline CodPlay ni le lecteur générique :
`position` est une propriété de présentation initiale du perso Avatar, tandis
que `avatar-motion` continue de respecter le temps absolu, le `loop` déclaré et
la conservation de la position au `release`. La vérification navigateur réelle
confirme un départ décalé, une arrivée au centre du host, puis une position
stable après `2500 ms`. Les 34 tests component-v2 et les deux typechecks
concernés passent.

## 24. Reprise progressive de pose et respiration — 20 septembre 2026

La libération d'une animation Three.js ne doit pas remplacer brutalement la
pose courante par la pose idle. La première tentative de recalage par
`GestureEngine.syncCurrentPose()` est abandonnée : `AnimationAction.stop()`
restaure les rotations avant que cette méthode ne puisse les lire.

Le lecteur conserve maintenant un instantané complet de la pose du clip à la
frontière de libération. Il conserve les translations, puis interpole les
rotations et les échelles vers la pose sémantique déjà composée. L'instantané
est échantillonné à partir du temps absolu et non depuis l'état de la frame
précédente ; il peut donc être reconstruit par un seek avec la même valeur.

Le morph interne `chestInhale` n'allonge plus `Spine1` sur Y. Il élargit très
légèrement le torse sur X/Z, ce qui conserve le mouvement de respiration sans
effet d'étirement du corps. Cette correction reste dans l'adaptation Avatar V2
et ne modifie ni la timeline CodPlay ni le runtime core.

La régression autonome couvre la transition depuis une pose écrite par une
animation et le binding de respiration. Les 35 tests `component-v2`, son
typecheck, le typecheck et le build des démos passent. La lecture navigateur
réelle confirme une reprise progressive entre environ `1800 ms` et `2500 ms`,
puis un lever de bras progressif autour de `6000 ms`.

## 25. Transition de release et équivalence Play/Seek — 20 septembre 2026

La tentative `positionOnly`/`holdAt` est supprimée. Elle conservait la
translation mais supprimait les pistes de rotation du clip, ce qui expliquait
la cassure de pose et la direction différente après seek.

`avatar-motion` transmet désormais sa sélection au coordonnateur pendant la
mise à jour du composant. Le lecteur ne dépend plus d'une animation de
présentation exécutée après le coordinateur pour connaître la motion active.
À `avatar:motion:release`, il échantillonne la pose complète du clip à
`releaseAt`, garde la translation atteinte et applique une transition ease-out
vers la pose Avatar. La durée par défaut est de 400 ms et peut être remplacée
par `data.durationMs`. Tant que `releaseAt` n'est pas atteint, cette sélection
continue de jouer le clip source normalement ; la transition ne commence qu'à
la frontière temporelle de release.

Après `prepareSeek()`, le même clip est échantillonné au même `releaseAt` et la
même fonction absolue est appliquée. Aucun changement de timeline CodPlay ou
de runtime CodPlay n'est nécessaire.

La démo n'active plus `breathe` : cette variation déformait le corps au lieu de
produire un idle naturel. La capacité optionnelle reste distincte de ce
scénario tant qu'elle n'est pas redessinée.

La régression autonome vérifie maintenant une vraie rotation de clip, la
transition ease-out, la conservation de la translation, le maintien du clip
avant `releaseAt` et l'égalité des poses Play/Seek à la frontière, pendant et
après la transition. Les 40 tests du package passent, sans réutiliser aucune
valeur de la démo.

La validation navigateur de la marche et du seek n'a pas pu être menée jusqu'au
rendu : la démo reste bloquée dans le preload audio CodPlay, qui attend
`canplaythrough` pour `/assets/1_7b_e.mp3` dans Safari. Le test direct de la
stratégie Three.js confirme séparément que le GLB et le FBX sont chargés. Cette
limite relève du preload audio core ; aucun contournement n'est ajouté à la
démo et aucun patch core n'est inclus dans cette tranche. Elle demeure donc
**En cours**.

Le scénario de reprise utilise aussi `avatar-motion.initial.motion` pour que la
marche d'entrée soit disponible lorsque le retour à `0 ms` se situe avant la
première borne d'eventime. Cette déclaration complète l'eventime sans modifier
sa valeur ni ajouter de chemin runtime.

## 26. Sémantique de `rescale` — 20 septembre 2026

> Statut : **A relire**.

L'hypothèse selon laquelle `rescale` était une courbe d'intensité est
invalidée par la source de MotionEngine : ce tableau répartit le temps ajouté
lorsqu'un geste reçoit une durée plus longue que sa durée native. Pour une
durée plus courte, les segments sont mis à l'échelle uniformément.

La transposition qui multiplie les canaux de morph par `rescale`, ainsi que sa
régression associée, ne peut donc pas être considérée correcte. Aucune nouvelle
modification de code ne sera effectuée sur cette base avant la validation de la
tranche de transition ci-dessous.

## 27. Diagnostic de la transition clip / pose Avatar — 20 septembre 2026

> Statut : **A relire**.

Le retour visuel de la démo invalide la tentative de la section 25. Le défaut
ne relève pas d'une durée de release : il manque un propriétaire unique de la
pose squelettique finale.

- `GestureEngine` avance des rotations à partir du delta de frame ; il écrit
  directement les os et ne peut pas reconstruire une pose intermédiaire à une
  date absolue ;
- `AvatarAnimationPlayer` écrit ensuite les mêmes os via `AnimationMixer`,
  puis écrit encore une interpolation locale de release ;
- à la fin de cette interpolation, la pose sémantique a continué à évoluer en
  arrière-plan. Sa reprise de propriété expose donc une valeur différente de la
  destination capturée : c'est une cassure structurelle, présente également
  entre Play et Seek.

Three.js sait croiser deux `AnimationAction` du même `AnimationMixer`, mais
une pose sémantique écrite directement sur les os n'est pas une action et ne
peut pas participer à ce mélange. La prochaine tranche devra définir une
composition unique et échantillonnable à temps absolu : pose sémantique,
échantillon du clip, règle distincte de translation racine, puis écriture
unique des os. Cette décision et son plan de migration doivent être validés
avant toute nouvelle implémentation.
