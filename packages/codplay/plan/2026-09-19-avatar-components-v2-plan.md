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
- le profil idle TalkingHead, qui active ou désactive le canal de respiration
  via `breathe` et le canal de mouvement de tête via `headDrift` ; ces canaux
  sont échantillonnés par le sampler idle commun, avec les morphes et les
  poses du modèle natif ;
- la configuration de parole, des changements de pose et de la graine
  déterministe du profil.

Le sampler est une fonction de l'horloge absolue. Il est reconstruit après un
seek et appliqué après la pose corporelle afin que le mouvement ne soit pas
écrasé par la transition de pose. Aucun scheduler de dérive ou déclencheur de
respiration séparé n'est conservé : il n'y a qu'un chemin idle TalkingHead.
Aucun composant `avatar-pose` séparé n'est créé et aucun changement du core
CodPlay n'est requis.

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
  les contributions des composants, `avatar-types.ts` définit le contrat de la
  capacité échangée, et `AvatarEngine` expose la façade de cycle de vie, de
  lecture et de synchronisation vers Three.js ;
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

> Statut : **Fixe**.

L'hypothèse selon laquelle `rescale` était une courbe d'intensité est
invalidée par la source de MotionEngine : ce tableau répartit le temps ajouté
lorsqu'un geste reçoit une durée plus longue que sa durée native. Pour une
durée plus courte, les segments sont mis à l'échelle uniformément.

La transposition qui multipliait les canaux de morph par `rescale` a été
supprimée. Le lecteur répartit désormais le temps supplémentaire sur les
segments déclarés, ou compresse uniformément les temps lorsque la durée
demandée est plus courte. Les valeurs des morphes restent celles des templates
TH ; `rescale` ne change jamais leur intensité.

Les tests autonomes du catalogue couvrent la durée native, la durée étendue,
la durée raccourcie et la conservation des valeurs de morphes.

## 27. Composition déterministe clip / pose Avatar — 21 septembre 2026

> Statut : **En cours**.

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
une pose sémantique n'est pas une action et ne peut pas participer directement
à ce mélange. La décision validée est donc de reprendre le principe de pose
centrale de TalkingHead, dans une forme compatible avec l'horloge absolue de
CodPlay.

La tranche crée un composeur interne Avatar, sans nouvelle surface auteur :

1. `GestureEngine` résout une pose sémantique à une date absolue sans écrire
   les os ; les transitions de pose et de geste partent de leur pose précédente
   et utilisent une même courbe ease-out ;
2. `AvatarAnimationPlayer` emploie `AnimationMixer` pour échantillonner le
   clip à cette date, mais remet un échantillon de transform au composeur au
   lieu de conserver l'écriture native du mixer comme état final ;
3. les contributions osseuses de l'idle, des morphs et des overlays sont des
   deltas remis au même composeur ; le regard calcule sa correction après une
   première pose temporaire, puis remet son delta au composeur ;
4. le composeur applique la pose finale une seule fois : le clip remplace les
   canaux qu'il couvre, la release interpole vers la pose sémantique et garde
   séparément la translation atteinte.

L'acceptation comporte des fixtures squelettiques autonomes pour une pose, un
clip, une release, une translation et une même date reconstruite par lecture
et seek. La démo Avatar vérifiera ensuite les enchaînements réels ; elle ne
fournira aucune valeur d'oracle aux tests. La sémantique de `rescale` demeure
à la section 26 et reste hors de cette tranche.

L'implémentation répartit désormais ces rôles entre `pose/avatar-pose.ts`,
`gesture/gesture-engine.ts`, `motion/avatar-animation-player.ts` et les
adaptateurs internes existants. Le mixer Three.js ne conserve plus une écriture
concurrente : il échantillonne le clip, le composeur combine cet échantillon à
la pose et aux deltas, puis il écrit la pose finale une seule fois.

Validations exécutées le 21 septembre : typecheck et 44 tests autonomes de
`@codplay/component-v2`, typecheck et build de `@codplay/demos`, puis
`git diff --check`. La validation visuelle Play/Seek reste à faire dans
Safari : dans la session MCP actuelle, le preload audio de la démo reste
bloqué après sa requête `HEAD`, donc la scène ne matérialise aucun canvas.
Aucun correctif Avatar, démo ou core n'est déduit de cette limite
d'exécution.

### Décision complémentaire — animation d'entrée à root motion

Une animation d'entrée ne réclame pas un asset `walk-in`. Une ressource
déclare statiquement `rootMotion: 'arrival'` lorsqu'elle porte une translation
racine destinée à mener l'avatar vers sa position de référence. Cette position
reste `avatar.initial.position` : l'auteur place donc l'avatar là où il doit se
tenir après l'entrée, sans calculer son point de départ ni fournir de donnée de
position à l'eventime.

Le composant Avatar extrait au chargement la translation horizontale de la
piste racine canonique `Hips`. Il applique sa trajectoire au groupe Three
interne de présentation, décalée de son delta terminal ; la dernière frame
ramène ainsi ce groupe à `[0, 0, 0]` sous la position de référence. Le clip
échantillonné par le squelette ne porte plus cette translation horizontale :
elle ne peut donc pas être appliquée deux fois. Les rotations et les variations
verticales du squelette restent celles du clip.

Une entrée `arrival` est non bouclée. Sa fin naturelle est déduite de la durée
du clip et de sa vitesse ; elle engage alors la transition existante depuis la
pose terminale de cycle vers la pose Avatar persistante. Un
`avatar:motion:release` antérieur reste une interruption : il conserve la
position atteinte à cette date au lieu de faire glisser l'avatar jusqu'à la
position de référence.

Le calcul est une fonction du temps absolu CodPlay. Play, Pause et Seek
échantillonnent donc la même position de présentation et la même pose ; aucun
déplacement n'est accumulé entre les frames et aucune donnée de timeline ou du
runtime core n'est modifiée. L'extraction d'une rotation racine cumulée reste
hors de cette tranche : `hero-walk.fbx` ne la requiert pas.

L'acceptation comporte des fixtures squelettiques autonomes pour le départ, le
milieu et l'arrivée, l'absence de double translation, une interruption, puis
l'égalité Play/Seek. La démo Avatar n'utilise finalement pas cette animation
d'entrée : elle conserve seulement le modèle et les composants d'expression,
de geste, de regard et de lip-sync. Le root motion reste couvert par les
fixtures autonomes jusqu'à la reprise d'une scène d'animation dédiée.

### Implémentation et état de validation

`avatar-motion` applique maintenant cette décision sans étendre sa surface
d'event : `rootMotion: 'arrival'` appartient à la ressource déclarée par le
perso Avatar. La forme objet de `rootMotion` permet à une scène de sélectionner
`easing: 'ease-out'` et une durée `transitionMs` pour cette ressource précise.
`root-motion.ts` prépare une copie de clip où les axes horizontaux de
`Hips.position` sont plats et remet séparément l'offset de présentation ;
l'easing ralentit le temps du clip complet afin de conserver la synchronisation
des os et du déplacement. `AvatarComponent` possède le groupe de présentation
interne qui reçoit cet offset ; `AvatarPoseComposer` reste le seul écrivain des
os.

La démo ne charge plus le FBX d'entrée, n'enregistre plus `avatar-motion` et
n'envoie plus `avatar:motion:walk`. Les tests autonomes couvrent néanmoins
l'arrivée, l'absence de double translation, l'interruption, l'easing de scène et
l'équivalence Play/Seek. Les 44 tests de `@codplay/component-v2`, les
typechecks `component-v2` et `demos`, le build des démos et `git diff --check`
passent.

La vérification Safari réelle reste **En cours**. La requête du GLB réussit,
mais le preload de `/assets/1_7b_e.mp3` reste bloqué après `HEAD` et la scène
Avatar ne matérialise donc aucun canvas dans cette session. Aucun contournement
local de la démo n'est ajouté ; les composants restants doivent être observés
dès que le chemin audio réel délivre la scène.

## 28. Fidélité des mécanismes TalkingHead — 22 septembre 2026

> Statut : **En cours**.

La transposition doit restituer les mécanismes qui produisent le mouvement de
l'avatar, pas seulement exposer les noms d'actions. La frontière retenue est
la suivante :

- les templates TH sont échantillonnés sur le temps absolu CodPlay ; leurs
  délais, segments, alternatives, distributions gaussiennes, valeurs de base,
  boucles et conversions des yeux sont conservés ;
- le clignement, la respiration, les micro-mouvements du visage, les poses
  d'attente, le regard caméra et les changements d'état idle/parole restent
  dans la capacité Avatar ; ils ne deviennent pas des événements spéciaux du
  core ;
- les gestes de mains parlantes utilisent le même principe TH : une cible
  aléatoire stable, résolue par CCD-IK, puis une arrivée et un retour
  interpolés. Le composeur Avatar reste le seul écrivain des os ;
- DynamicBones conserve les cinq types TH, l'intégration velocity-Verlet, les
  forces du parent et des enfants, les offsets locaux et monde, les pivots,
  limites et exclusions, avec une sortie remise au composeur ;
- le chargement respecte `modelRoot` pour sélectionner l'armature déclarée par
  le modèle, et la capacité gaze restitue `lookAhead` lorsque la caméra est
  ignorée ; un événement de regard futur ne modifie pas la cible avant son
  `startAt`, puis interpole la direction sur sa durée ; le chemin emoji
  restitue également le contact caméra temporaire de TalkingHead ;
- les morphes présents sur toute géométrie Three.js portant un dictionnaire de
  blend shapes sont enregistrés, et les vues rapprochées appliquent la
  micro-variation faciale de TH sur le temps absolu ; le culling est désactivé
  sur toute l'instance afin que les parties animées restent visibles ;
- les animations et poses externes passent par les loaders Three.js et le
  lecteur absolu déjà établis. Aucun importateur, cache ou circuit parallèle
  n'est créé dans Avatar ;
- l'audio, le DOM, le renderer et le scheduler RAF propres à l'application
  TalkingHead restent des responsabilités du host CodPlay. Avatar reçoit les
  visèmes et autres événements ordinaires déjà présents dans la scène.

L'acceptation est indépendante de la démo : tests autonomes pour les templates,
le CCD-IK, les dynamiques, la reconstruction Play/Seek et la composition des
couches, le mode `lookAhead` sans caméra, l'interpolation de cible, la variation
des vues rapprochées et le choix de `modelRoot` ; puis vérification navigateur
sur la scène réelle. La démo ne fournit aucune valeur d'oracle.

Les mécanismes TH qui appartiennent à une autre frontière restent hors de cette
capacité : `setView` et l'éclairage relèvent du host Three, la lecture audio,
le TTS, le streaming, les sous-titres et l'analyseur de volume relèvent des
composants média/caption, et les callbacks de diagnostic relèvent du layout.
Avatar reçoit leurs événements ordinaires lorsqu'ils existent. Aucun circuit
CodPlay supplémentaire n'est créé pour les reproduire.

### Complément implémenté — mouvements spontanés et clips — 22 septembre 2026

La tranche Avatar porte maintenant les trois comportements TH qui manquaient
à la lecture des composants :

- `avatar-idle` active `speakWithHands` par défaut, comme l'appel natif de TH
  pendant la parole ; la désactivation explicite reste possible avec
  `speakWithHands: false` ;
- le sampler idle reconstruit le task `headmove` de TH à partir de son délai,
  ses quatre segments, sa probabilité et sa cible déterministe. Il est évalué
  sur le temps absolu et ajoute ses rotations au même composeur que le reste
  de l'Avatar ; le cas avec contact visuel vise `-bodyRotateY`, le cas sans
  contact reprend la direction des yeux et neutralise les morphes de regard,
  en conservant le premier segment d'attente du template natif ;
- `avatar-motion` n'agit pas avant son `startAt`, rend naturellement la pose
  aux couches Avatar lorsqu'une animation non bouclée atteint sa durée, et
  interpole l'entrée d'un clip depuis la pose sémantique courante. La durée
  d'entrée vaut `1_000 ms` pour une animation et `2_000 ms` pour une pose, ou
  `entryTransitionMs` sur la ressource.

Les tests autonomes couvrent le démarrage absolu, l'entrée de clip, le retour
automatique d'une animation non bouclée, la reproductibilité du `headmove` et
le défaut des mains parlantes. Le package `@codplay/component-v2` passe son
typecheck et ses 73 tests ; le typecheck et le build des démos passent aussi.

La scène réelle a été jouée dans Safari : le GLB se charge, l'avatar est rendu,
le journal reçoit les visèmes, les sous-titres, les moods, les gestes et les
changements de regard, puis la séquence atteint `sequence:end`. Une tentative
de retour au début après cette fin est refusée par le contrat core actuel
(`PLAYER_SEQUENCE_ENDED`) ; aucun correctif core n'est introduit dans cette
tranche Avatar. La validation Play/Seek après fin reste donc ouverte au plan
runtime concerné.

### Diagnostic de la régression de transition des gestes — 22 septembre 2026

La correction précédente, qui ne changeait que l'instant transmis lors de la
release d'un geste natif, ne corrigeait pas la cassure d'entrée observée vers
`6000 ms`. Elle est donc retirée de l'état de référence : le test ajouté ne
vérifiait que les arguments d'un mock `setGesture` et ne prouvait aucune pose
Three.js.

La reproduction autonome avec un vrai `GestureEngine`, un vrai
`AvatarPoseComposer` et un squelette synthétique reproduit la panne : après la
contribution `handup` à `6000 ms`, la présentation suivante à `6016 ms`
réappelle `setPose` alors que la pose de base n'a pas changé. L'écart de
quaternion du bras atteint alors `0,297 rad` au lieu de rester au début de la
transition. Le problème est donc une réinitialisation de la transition, pas une
durée de geste trop courte.

La cause localisée est l'invalidation inconditionnelle de `appliedPose` dans
`AvatarCoordinator.applyGestureMotion()` et `setGesture()`. La frame centrale
suivante entre alors dans `applyPoseLayer()`, sélectionne à nouveau `neutral`
et appelle `AvatarEngine.setPose(neutral, 0)`. `GestureEngine.setBodyPose()`
reconstruit une transition complète depuis cet instant ancien ; son target
contient pourtant déjà la gesture native active. À `6000 ms`, la montée est
ainsi remplacée par une pose presque immédiatement terminée.

Le chemin réel explique pourquoi le défaut apparaît à cet endroit : dans
l'ancien montage, le flux `avatar-coordinate` était enregistré avant le flux
`avatar-gesture`, donc la première contribution du geste arrivait après la
composition de `6000 ms`. La frame suivante était la première où
l'invalidation de pose pouvait écraser la transition nouvellement créée. Ce
flux a ensuite été supprimé au profit du commit natif du host Three décrit
plus bas.

TalkingHead ne présente pas cette régression : `playGesture()` date les
propriétés du geste avec l'horloge courante, tandis que `updatePoseBase()` les
interpole indépendamment de la pose corporelle. Quand une pose est reconstruite,
le geste actif est réinjecté dans la cible avec ses propres timestamps. La
transposition V2 doit conserver cette séparation : pose corporelle, geste actif
et overlays ne doivent pas partager une invalidation de transition.

La première correction ciblée conserve maintenant `appliedPose` lorsque seule
la contribution du geste, de ses morphes ou de son overlay change. Une pose de
base n'est invalidée que si la contribution de pose elle-même change. Le
parcours reste dans Avatar V2 et ne touche ni la timeline ni le core CodPlay.
Le test autonome `avatar-coordinator.spec.ts` compose un squelette réel avec
`GestureEngine` et `AvatarPoseComposer`, reproduit l'ordre `6000 → contribution
du geste → 6016`, puis vérifie l'entrée et la release depuis la pose présentée.

Le diagnostic initial signalait que les tests de cette tranche validaient
surtout des appels de mock et ne couvraient pas l'ordre
`6000 → contribution du geste → 6016`. La régression squelettique a depuis été
ajoutée dans `avatar-coordinator.spec.ts`. La rupture distincte de `celebrate`
et son test de catalogue sont consignés à la section suivante ; la séparation
complète des transitions de pose et de geste, ainsi que la validation
navigateur globale, restent **En cours**.

### Suppression du chemin idle dupliqué — 22 septembre 2026

Le remplacement par le sampler TalkingHead est désormais complet. Le
paramètre `thAnimation`, les fonctions `createAvatarHeadDrift` et
`createAvatarBreathTrigger`, `BreathAnimator` et les callbacks correspondants
de `AvatarEngine` et `AvatarTarget` ont été retirés. `avatar-idle` configure
uniquement `setIdleProfile` et le scheduler de clignement ; `breathe` et
`headDrift` sélectionnent les canaux du profil TH au même endroit. Les tests
ne valident donc plus un mécanisme supprimé et le contrat public ne conserve
aucun second chemin de respiration ou de dérive.

La même règle est appliquée à la pose initiale : `avatar-idle` ne transmet plus
la même pose par `setIdleProfile({ pose })` et par un second `setPose()`. La
capacité publiée aux composants ne contient plus `setPose`; le coordonnateur
reprend cette valeur depuis le profil idle et conserve son entrée interne pour
les transitions de pose réellement nécessaires. Aucun chemin de composition
utile n'a été supprimé.

Validation courante : le typecheck et les 73 tests autonomes de
`@codplay/component-v2` passent.

### Suppression du double chemin mood — 22 septembre 2026

Le baseline mood était auparavant écrit par deux propriétaires :
`ExpressionEngine` dans `AvatarEngine`, puis `AvatarCoordinator` pendant la
composition des couches. Cette duplication rendait une transition auteur
fragile : `setMood()` pouvait poser immédiatement le nouveau baseline avant
que l'animation `avatar-mood` n'applique son échantillon temporel.

`ExpressionEngine` et `mood/expression-engine.ts` sont supprimés. Les données
partagées résident dans `mood/mood-baselines.ts`; le coordonnateur est le seul
chemin qui applique les baselines de mood. `AvatarEngine.setMood()` ne pose
plus de morphes : il conserve seulement l'état mood utilisé par le scheduler
de clignement, tandis que `AvatarCoordinator.applyMood()` reste responsable
de la valeur temporelle présentée.

Le typecheck et les 73 tests autonomes passent. Aucun circuit core CodPlay ni
aucune timeline ne sont modifiés.

## 29. Rupture au début du mouvement interne `celebrate` — 22 septembre 2026

> Statut : **Fixe pour cette cause**.

La rupture visible autour de `16 000 ms` ne correspondait pas à un nouvel
événement auteur. Elle se produisait pendant `avatar:gesture:celebrate`, dont
le marqueur interne `handup` est posé vers `14 675 ms`. Le catalogue
`motions.json` contient ensuite un créneau `null` vers `15 408 ms`. Dans le
format TalkingHead, ce `null` ne signifie pas « relâcher le geste » : il
signifie qu'aucune nouvelle commande n'est émise pour ce canal. Le relâchement
est une opération distincte (`stopGesture`) ou intervient à la fin de l'action.

L'adaptateur V2 interprétait auparavant ce créneau comme une commande de
relâchement. `handup` revenait donc vers la pose corporelle au milieu de
`celebrate`, ce qui produisait la cassure observée au début de ce retour,
autour de `16 000 ms`.

La correction est limitée au catalogue Avatar :

- `sampleGestureMarker()` conserve le dernier marqueur non nul jusqu'à la fin
  réelle de l'action ; un créneau `null` ne remplace plus ce marqueur ;
- `released` ne devient vrai qu'après la durée active et sa courte transition
  de sortie ;
- l'événement auteur `avatar:gesture:release` reste le moyen explicite de
  demander un relâchement anticipé ;
- le composant Avatar s'enregistre comme contribution du commit natif du host
  Three, après les animations de contenu et juste avant le renderer ; aucune
  animation `avatar-coordinate` parallèle ne reste nécessaire.

Le temps CodPlay, les eventimes et le runtime core restent inchangés. La
régression est testée dans une suite autonome qui ne dépend d'aucune valeur de
la démo : `celebrate` conserve `handup` à `1 600 ms` et ne le libère qu'à la
fin de son action. Le navigateur Safari a rendu la scène réelle et les
échantillons du framebuffer autour de `15 800–16 200 ms` restent continus
après le correctif.

Validations exécutées :

- `@codplay/component-v2` : 73 tests et typecheck réussis ;
- test ciblé catalogue + coordonnateur + moteur de geste : 4 tests réussis ;
- `@codplay/demos` : typecheck et build réussis ;
- `git diff --check` réussi ;
- Safari MCP : scène Avatar rendue sur le chemin réel, avec contrôle de la
  plage temporelle autour de `16 000 ms`.

Le plan Avatar global reste **En cours** pour les autres mécanismes TH et
leurs validations intégrées.

## 30. Centralisation des types Avatar — 22 septembre 2026

Les contrats partagés de l'Avatar V2 sont maintenant définis dans
`packages/authoring/component-v2/src/avatar/avatar-types.ts`. Cela regroupe la
surface auteur, les cibles Avatar, les poses, les animations, les morphs, les
configurations DynamicBones, les capacités gaze/geste/idle et les contrats du
chargeur. Les modules `pose`, `model`, `gesture`, `idle`, `morph`, `motion` et
`runtime` ne conservent que leur logique. Les anciens réexports de types et le
module type-only `runtime/avatar-target.ts` ont été supprimés ; les
consommateurs passent directement par `avatar-types.ts`. Les types privés
propres à un algorithme restent locaux.

Le typecheck et les 74 tests autonomes de `@codplay/component-v2` passent. La
démo n'est pas utilisée comme oracle de cette réorganisation.

## 31. Suppression du chemin de sélection directe des gestes — 22 septembre 2026

La sélection directe `AvatarTarget.setGesture()` constituait un second chemin
pour les mêmes gestes que ceux déjà représentés par une
`AvatarGestureFrame`. Elle servait aux gestes natifs, au relâchement et au
fallback des noms non catalogués, tandis que `applyGestureMotion()` portait
déjà le nom, le seed, le miroir, l'instant de départ et l'état `released`.

Ce chemin est supprimé :

- `AvatarGestureComponent` transforme maintenant une sélection native ou un
  relâchement en frame ordinaire ;
- `AvatarTarget` et `AvatarCoordinator` n'exposent plus `setGesture()` ;
- `AvatarTarget.getAnimation()` et le getter `AvatarEngine.gestureEngine`, qui
  n'avaient aucun consommateur, sont également supprimés ; la vérification des
  clips embarqués reste portée par `AvatarEngine.getAnimation()` dans le
  composant central ;
- `AvatarEngine.playGesture()` et `releaseGesture()` restent internes : ils
  sont appelés par le coordonnateur pour composer le marqueur de la frame avec
  `GestureEngine`, et ne constituent pas une seconde API composant ;
- les tests de composants vérifient désormais les frames produites et leurs
  dates absolues, sans dépendre de la démo.

Cette suppression ne modifie ni les actions auteur, ni les eventimes, ni la
timeline CodPlay. Elle retire uniquement la voie interne redondante après la
centralisation des gestes dans `applyGestureMotion()`. Le typecheck et les 74
tests autonomes de `@codplay/component-v2` passent.

## 32. Pertes de fluidité dans les motions — 22 septembre 2026

> Statut : **Fixe pour cette cause**.

La rupture observée autour de `6 800 ms` venait du sampler interne des motions,
et non d'une perte d'eventime ou d'un défaut de la timeline CodPlay. Le sampler
avançait au segment suivant sans mémoriser la valeur atteinte par le segment
précédent. Dès qu'une motion dépassait sa première frame, les canaux qui
portaient une valeur unique (`mouthSmile`, `eyeSquint*`, etc.) redevenaient
indéfinis ; la frame suivante les retirait donc de la couche de geste. Les
mouvements semblaient interrompus avant leur cible.

Le correctif applique la convention TalkingHead utilisée par le sampler idle :
la dernière valeur numérique atteinte est conservée pendant les créneaux
`null` et jusqu'à la fin de la motion. Une valeur `null` ne constitue pas une
commande de relâchement. Le relâchement reste produit par la fin réelle de la
motion ou par `avatar:gesture:release`.

Un second écart réduisait aussi la durée utile de la transition native : la
première commande `gesture` du catalogue était datée de la fin de sa première
frame, alors que TalkingHead l'active à l'eventime de la motion. Le composant
Avatar transmet désormais le début de l'occurrence comme origine de la
transition ; seul l'échantillon explicitement libéré reprend sa date courante.

La correction reste dans `component-v2` : aucun eventime, aucune timeline et
aucun fichier du core CodPlay n'est modifié. Les tests autonomes vérifient la
conservation d'un morph jusqu'à sa cible, l'activation du geste dès le début de
la motion et la reconstruction déterministe du geste. Les 76 tests et le
typecheck de `@codplay/component-v2`, ainsi que le typecheck et le build des
démos V2, passent. Safari a vérifié le chemin réel par Seek à `6 000`, `6 800`
et `7 000 ms` ; l'avatar reste rendu et la motion conserve sa main et son
expression au lieu de retomber à zéro. Le bouton Play de cette session Safari
reste bloqué à `0 ms` par le problème indépendant de progression audio déjà
consigné ; cette limite ne concerne pas le chemin de présentation échantillonné
par Seek.

## 33. Fracture de frame autour de 2 940 ms — correctif annulé

> Cette piste a été annulée : elle introduisait un circuit de commit Three
> supplémentaire et ne constitue pas une explication retenue.

## 34. Transposition des transitions `talkinghands` — 22 septembre 2026

> Statut : **En cours**.

La première adaptation de `talkinghands` conservait un delta de rotation
calculé au début de la phrase, puis le multipliait pendant la montée et le
retour. Ce n'est pas le mécanisme de TalkingHead : celui-ci crée deux cibles
`moveto` datées, une cible de geste puis une cible de retour, et laisse le
composeur interpoler chaque propriété depuis la pose effectivement présentée.

Le planner Avatar V2 conserve maintenant une cible absolue par phrase. À
chaque échantillon, il la réconcilie avec la pose sémantique courante avant de
produire le delta final ; la pose de base peut donc changer pendant le geste
sans réutiliser un delta calculé sur une ancienne pose. La durée de montée
reste `1 000 ms` et celle du retour `2 000 ms`, conformément au template TH.
Le changement est limité à `component-v2/src/avatar/gesture/talking-hands.ts`.

Le test autonome `avatar-th-idle.spec.ts` vérifie qu'un changement de pose
pendant le retour produit un delta différent, recalculé depuis cette nouvelle
pose. La suite component-v2 passe avec 76 tests et le typecheck du package
passe. La validation navigateur de la scène autour de `2 940 ms` reste à
refaire ; aucune conclusion visuelle n'est portée par cette correction tant
qu'elle n'a pas été observée sur le parcours réel.

## 35. Durée automatique des animations externes — 22 septembre 2026

> Statut : **En cours**.

La lecture des ressources `avatar-motion` reprend maintenant le comportement
de `playAnimation(..., dur)` et `playPose(..., dur)` de TalkingHead : une
animation ou une pose reçoit une durée active, garde sa dernière pose, puis
rend progressivement la main à la pose Avatar. Une animation en boucle joue
au moins un cycle complet avant ce retour. La durée peut être fournie par
`data.durationMs` sur l'action de motion, par l'état initial du composant ou
prendre les valeurs par défaut de TalkingHead (`10 000 ms` pour une animation,
`5 000 ms` pour une pose). Sur `avatar:motion:release`, le même champ reste
réservé à la durée du hand-off explicite.

Le contrat et la sélection sont portés par `avatar-motion-component.ts` ; le
calcul de fin et l'échantillonnage Three restent dans
`avatar-animation-player.ts`. La timeline CodPlay, le ticker et le core ne
sont pas modifiés.

La vérification autonome couvre une animation Three en boucle, une ressource
de type pose et la propagation de la durée depuis l'API auteur. Les deux
fichiers de test ciblés et le typecheck du package passent. La présentation
navigateur de cette tranche reste à effectuer avant de la marquer **Fixe**.

## 36. Profils TH de regard dans les templates idle — 22 septembre 2026

> Statut : **En cours**.

La comparaison avec `animTemplateEyes` de TalkingHead a confirmé que la
hiérarchie `speaking`, `body` et `view` était déjà transposée. Le manque réel
était plus étroit : les probabilités `avatarIdleEyeContact`,
`avatarIdleHeadMove`, `avatarSpeakingEyeContact` et
`avatarSpeakingHeadMove` n'étaient pas transmises au sélecteur V2 ; les
alternatives restaient donc figées à `0.2` et `0.5`.

`AvatarCoordinator` fournit maintenant le profil du mode courant au sampler
idle. Celui-ci remplace uniquement les probabilités des alternatives et le
marqueur `headMove`; les délais, les valeurs, les transitions et le temps
absolu restent ceux des templates TH. Quand aucun template ne demande le
contact ou le mouvement, la contribution de regard est nulle pour cet
échantillon, comme dans la boucle TH.

Le test autonome échantillonne la même animation avec profils `0` et `1` et
vérifie respectivement l'absence et la présence du contact et du mouvement.
Les tests idle/composants/gaze et le typecheck passent. La scène navigateur
reste à vérifier avant de clore cette tranche.

## 37. Suspension des mains parlantes pendant une motion externe — 22 septembre 2026

> Statut : **En cours**.

TalkingHead ne fait pas jouer son comportement automatique de mains parlantes
pendant qu'une animation externe possède le squelette. Le chemin V2 applique
la même règle dans `AvatarEngine` : pendant le clip et sa transition de sortie,
`GestureEngine` suspend uniquement les mains parlantes automatiques. Les
gestes explicites et les cibles de mains envoyés par l'auteur restent actifs.
Quand la transition de sortie est terminée, les mains parlantes reprennent au
temps courant.

La correction reste dans `component-v2` et ne modifie ni la timeline ni le
core CodPlay. Le test autonome du moteur vérifie l’absence de delta pendant la
motion et sa reprise après suspension. Le typecheck et les 82 tests du package
passent. Une observation navigateur reste nécessaire avant de marquer cette
tranche **Fixe**.

## 38. Unification de la présentation Avatar autour du ticker — 23 septembre 2026

> Statut : **En cours**.

La régression de seek ne venait pas d'un nouveau ticker caché dans Avatar. Elle
venait de plusieurs chemins de présentation concurrents : le coordonnateur
appliquait certains setters Three au moment de la synchronisation des
composants, tandis que `avatar-coordinate` composait ensuite une autre frame
sur le temps CodPlay. Le modèle pouvait donc conserver une expression, un
regard ou une sélection de geste installés avant le seek, puis recevoir la
composition attendue après celui-ci.

La frontière est maintenant unique dans `component-v2` :

- `avatar-mood`, `avatar-lip-sync`, `avatar-gaze` et `avatar-gesture` déposent
  une timeline absolue auprès de `AvatarCoordinator` ; ils n'enregistrent plus
  de flux runtime séparé et n'écrivent plus l'engine pendant `update()` ;
- les setters du coordonnateur ne font que mémoriser l'état auteur ;
- `AvatarComponent` enregistre un seul flux `avatar-coordinate` ;
- ce flux échantillonne toutes les timelines, réinitialise les couches
  temporelles lors d'un retour en arrière ou lorsqu'une nouvelle
  synchronisation arrive au même `timeMs`, puis configure, anime et compose
  l'engine Three dans le même passage ;
- le chargement asynchrone du GLB ne présente plus directement une frame à
  `timeMs = 0` hors du passage du player.

La timeline CodPlay, le ticker et le core ne sont pas modifiés. Les tests
autonomes component-v2 vérifient la composition et la reconstruction après
seek ; le typecheck passe. La démo et la validation navigateur restent
nécessaires pour établir que les ruptures visuelles et la persistance du mood
ont disparu sur le parcours réel avant de marquer cette tranche **Fixe**.

## 39. Easing TH des morphs de geste — 23 septembre 2026

> Statut : **En cours**.

Le diagnostic des mouvements de tête et de la dernière salutation a identifié
une rupture dans la transposition de `MorphEngine` : les échantillons de geste
étaient envoyés par `AvatarCoordinator` à `snapFixed()`. Chaque changement de
frame, y compris l'entrée et la sortie d'un geste, annulait donc l'easing
accumulé par le moteur TH. `reapplyFixed()` réécrivait en plus la cible au lieu
de la valeur effectivement atteinte.

La correction reste dans `component-v2` et réutilise le circuit déjà présent :

- `AvatarCoordinator.applyFixedLayer()` transmet les cibles avec `setFixed()` ;
- `MorphEngine.update(deltaMs)` fait l'approche progressive sur le ticker
  CodPlay, y compris lorsque `avatar:gesture:release` retire la cible fixe ;
- `reapplyFixed()` réapplique la valeur courante et interpolée (`applied`),
  afin que la composition Three ne l'écrase pas ;
- `snapAll()` reste le chemin instantané réservé à la reconstruction après
  seek.

Aucune timeline, aucun eventime, aucune scène et aucun fichier du core CodPlay
ne sont modifiés. Le test autonome de fidélité vérifie l'approche d'une cible
de rotation de tête et la conservation de sa valeur interpolée. Les 84 tests
component-v2, son typecheck, le typecheck V2 des démos et leur build passent.
Le parcours Avatar a aussi été rejoué dans Safari sur les gestes de tête et la
séquence finale ; la tranche reste **En cours** jusqu'à une confirmation
visuelle complète des enchaînements par l'auteur.
