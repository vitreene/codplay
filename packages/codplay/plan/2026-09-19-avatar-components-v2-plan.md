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
  le clignement et la dérive appartiennent à `avatar-mood` ;
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
avatar-gaze:     { rel: { host: 'three-scene-host', target: 'avatar' } }
avatar-motion:   { rel: { host: 'three-scene-host', target: 'avatar' } }
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
4. les capacités initialement prévues pour `avatar-idle` sont intégrées à
   `avatar-mood` : pose de repos, clignement, respiration et dérive de tête ;
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
  une transition absolue de baselines avec l'easing TalkingHead ; une nouvelle
  occurrence part de la valeur présentée à sa date de début ;
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
Aucun changement du core CodPlay n'a été nécessaire. Cette première vérification
des baselines ne clôt pas la tranche mood : la section 42 consigne l'écart de
perception et de responsabilité découvert pendant l'isolation des composants.

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
- la démo garde le contact caméra actif depuis l'initial du perso. Les actions
  ordinaires de désactivation et de réactivation restent disponibles dans le
  composant et couvertes par ses tests autonomes ; leur usage dépend des
  instructions auteur de chaque scène. Les tests du composant et du pont Three
  ne dépendent pas des valeurs de la démo.

Validations exécutées : typecheck et tests de `component-v2`, typecheck et
tests de `avatar-engine`, typecheck et build de `demos`, puis lecture
navigateur avec le journal d'événements et Seek aux positions `5000 ms`,
`5800 ms` et `6200 ms` avant la décision de garder le contact continu dans
cette scène. Les actions `avatar:gaze:off` et `avatar:gaze:on` ont été reçues ;
la position `6200 ms` montrait la transition progressive vers le contact
désactivé. Aucun changement de `packages/codplay` n'est nécessaire.

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
- la scène d'animation dédiée contient un clip FBX compatible et son entrée de
  preload afin d'exercer le chemin réel du composant.

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
contact ou le mouvement, cette contribution spontanée est nulle pour cet
échantillon, comme dans la boucle TH. Cela ne désactive pas le contact caméra
permanent demandé par `avatar-gaze`.

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

- `AvatarCoordinator.applyFixedLayer()` transmet les cibles de geste avec
  `setFixed()` ; les visèmes restent appliqués immédiatement ;
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

## 40. Isolation temporaire des composants Avatar — 26 septembre 2026

> Statut : **Fini**. L'instrument de diagnostic `temp` est retiré après la
> réintroduction et la validation provisoire des contributions par l'auteur.

L'auteur demande de repartir du comportement existant et d'isoler les causes
des ruptures en réactivant les composants Avatar un par un. La correction de
pose initiale tentée avant cette décision est retirée : elle n'a pas été
validée avec les autres contributions et ne doit pas être tenue pour stable.

La première étape conserve le composant central `avatar` et active seulement
`avatar-lip-sync` parmi les composants Avatar spécialisés. `avatar-mood`,
`avatar-gesture`, `avatar-idle`, `avatar-gaze` et `avatar-motion` restent
enregistrés et reçoivent leurs mises à jour, mais leur contribution est
temporairement suspendue au point commun des composants. La scène, ses
eventimes, l'audio, le layout et le core CodPlay restent sur leur circuit réel.
Après validation de la première étape, `avatar-mood` est réactivé avec
`avatar-lip-sync` ; `avatar-gesture`, `avatar-idle`, `avatar-gaze` et
`avatar-motion` restent suspendus pendant cette deuxième étape.
La troisième étape réactive `avatar-gesture` avec `avatar-lip-sync` et
`avatar-mood`. `avatar-gaze` et `avatar-motion` restent suspendus ;
`avatar-idle` a depuis été fusionné dans `avatar-mood` (§43).
Ce filtre n'est pas un contrat V2 ; sa portée est limitée à l'investigation
Avatar et sa condition de retrait est la réactivation et la validation des
composants concernés.
Tous les composants spécialisés étant réactivés et l'auteur validant leur
état actuel, la classe commune et les cinq composants ne portent plus ce
filtre. Les tracks continuent à passer par le même coordonnateur Avatar.

L'acceptation de cette première étape vérifie le lip-sync sur le modèle chargé
dans Safari TP, avec les visèmes reçus par le journal et les morphs effectivement
visibles aux dates de parole, puis le retour par Seek. Les tests du composant
lip-sync, le typecheck et le build des démos accompagnent cette observation.
La progression Play doit être vérifiée sur le chemin audio réel ; si elle reste
bloquée, cette limite est consignée sans modifier la scène pour la masquer.
Chaque composant sera ensuite réactivé seul, puis avec les précédents, en
réexécutant les frontières qui lui appartiennent avant toute correction de
comportement.

### Diagnostic et correction de la première étape — amplitude

Le filtre `temp` est en place au niveau de `AvatarFeatureComponent.update()` ;
seul `avatar-lip-sync` contribue parmi les composants spécialisés. Dans Safari
TP, le journal reçoit les eventimes `avatar:viseme`, la cible `viseme_O` vaut
environ `0,57` à `550 ms` sur les deux meshes du modèle, et l'image de la bouche
diffère de celle du silence à `3150 ms`. Le Seek active donc bien la chaîne
eventime → composant → coordonnateur → morph du GLB. Les deux tests ciblés
visème passent, ainsi que les typechecks `component-v2` et démos et le build
démos. L'auteur constate cependant que l'articulation en Play est trop faible
par rapport au réglage initial.

La cause est au raccord des couches fixes du coordonnateur. La tranche 39 a
remplacé `snapFixed()` par `setFixed()` pour rétablir l'easing des gestes, mais
elle a appliqué le même lissage aux visèmes courts. Une sonde du `MorphEngine`
dans Safari TP donne, pour une cible de visème `0,6`, seulement `0,015` après
`64 ms` et `0,031` après `96 ms` avec `setFixed()` ; `snapFixed()` donne `0,6`
immédiatement. L'état antérieur du coordonnateur utilisait `snapFixed()` pour
la couche commune. Le symptôme est donc reproductible sans modifier la scène
ni supposer une perte d'eventimes.

> Décision de correction validée par l'auteur. Séparer au coordonnateur les morphs de
> parole, appliqués immédiatement à chaque échantillon temporel, des morphs de
> geste, qui conservent `setFixed()` et leur easing. Préserver la priorité de la
> parole sur un morph commun et la reconstruction par `snapAll()` au Seek. La
> validation requiert un test autonome des visèmes courts en Play, la
> non-régression du lissage des gestes, puis Play, Seek et reprise dans Safari
> TP avec l'audio réel.

Le coordonnateur sépare désormais la parole (`snapFixed()`) des gestes
(`setFixed()`). Un morph partagé reste sous priorité parole, puis revient à
l'easing du geste lorsque la parole le libère. Les tests des frontières
coordonnateur, fidélité TH et binding morph passent (14 tests), ainsi que trois
tests ciblés du composant. Les typechecks des deux packages et le build des
démos passent. Dans Safari TP, le Play réel suit l'audio : `viseme_O` atteint
`0,567` vers `550 ms` et `viseme_U` atteint `0,599` vers `820 ms`. Le Seek
`550 → 3150 → 550 ms` reproduit `viseme_O = 0,571 → 0 → 0,571` et remet
l'audio aux mêmes dates. Un nouveau `Play` après `sequence:end` relance la
scène. Le bouton de retour au début utilise `seek`, que le contrat du player
refuse après la fin terminale ; son rejet observé ne signale pas une panne
du média.

L'isolation `temp` maintient les autres composants spécialisés inactifs. Leurs
tests de contribution ne sont donc pas une validation possible à cette étape ;
le plan Avatar reste **En cours**. Le changement de routage des morphs n'affecte
ni placement, ni reparent, ni taille, ni persistance.

## 41. Assouplissement des transitions de visèmes — 26 septembre 2026

> Statut : **Fixe** pour les réglages de `avatar-lip-sync` validés par l'auteur.

L'auteur constate maintenant des ouvertures et fermetures de bouche trop
brusques. Le composant construit une enveloppe dont l'attaque commence aux
deux tiers de la durée avant `occurrence.startAt`, comme TalkingHead lorsque
tous les visèmes sont déjà connus. Dans CodPlay, un événement ordinaire ne
devient disponible qu'à `startAt` : son premier échantillon apparaît donc déjà
avancé dans cette attaque. L'application immédiate du morph rend ce saut
visible. Pour deux occurrences successives du même morph, choisir seulement
la dernière enveloppe peut aussi couper net la sortie de la précédente.

La correction reste dans `avatar-lip-sync` et dans le circuit de timeline
absolue existant : l'attaque commence à la date de l'événement reçu, avec une
montée d'au moins `60 ms` ; la sortie dispose d'au moins `60 ms` après la fin
nominale. Les enveloppes simultanées du même morph se composent par leur
maximum, comme dans le contrôleur V1, afin que l'arrivée d'une occurrence
n'efface pas la fin de la précédente. Les intensités de pic restent celles de
la première correction et le Seek échantillonne la même courbe que Play.

L'acceptation vérifie les valeurs au tout début d'un visème court, son pic,
sa sortie, la continuité entre deux occurrences du même morph, puis Play,
Seek et replay dans Safari TP avec l'audio réel. Aucun changement de la scène
ou du core CodPlay n'est impliqué.

L'enveloppe causale et le recouvrement sont implémentés dans le composant.
Le test autonome vérifie une ouverture `0 → 0,3 → 0,6`, une sortie progressive
et l'absence de saut à l'arrivée d'une seconde occurrence du même morph. Les
quatre tests ciblés du composant passent avec le typecheck. Dans Safari TP,
le Play réel montre `viseme_O = 0` avant l'événement vers `490 ms`, puis
`0,303` vers `520 ms` et `0,595` vers `540 ms`, avec un maximum mesuré de
`0,599`. Il redescend à `0,092` vers `590 ms` et à zéro ensuite. Le Seek
avant, pendant et après la cue, puis le retour depuis `3150 ms`, reproduisent
la même courbe. La spécification ciblée est
[`avatar-lip-sync-spec.md`](../specs/avatar-lip-sync-spec.md).

L'auteur juge l'amplitude correcte mais les transitions encore trop rapides.
Le seuil minimal des deux rampes passe de `40` à `60 ms` ; les durées de
`120 ms` ou plus conservent leur enveloppe, et le pic nominal reste inchangé.
Les quatre tests ciblés du composant et les neuf tests coordonnateur et binding
morph passent. Les typechecks `component-v2` et démos et le build démos passent.
Dans Safari TP, le Play avec audio montre `viseme_O = 0` vers `490 ms`, une
montée jusqu'à `0,592` vers `550 ms`, puis `0,139` vers `600 ms` et zéro après
`630 ms`. Le Seek à `490 → 500 → 530 → 560 → 590 → 630 → 3150 → 560 ms`
reproduit respectivement `0 → 0 → 0,3 → 0,6 → 0,404 → 0 → 0 → 0,6` sur le morph
du modèle. La suite complète des composants conserve les échecs attendus des
composants temporairement désactivés, notamment le profil `avatar-idle`.

L'auteur valide le composant et ses réglages. La réintroduction des autres
composants reste suivie par la section 40 ; le plan Avatar global demeure
**En cours**.

## 42. Réactivation de `avatar-mood` — 26–27 septembre 2026

> Statut : **En cours**. Courbe validée et trajet technique vérifié ;
> l'expression `happy` actuelle ne permet pas encore l'acceptation visuelle.

La section 3 fixe `avatar-mood` comme étape suivante. Le plan initial et le
lecteur V1 utilisaient `smoothstep`, tandis que le composant V2 emploie déjà
`sampleTalkingHeadEasing()`. L'auteur choisit explicitement de conserver cette
dernière courbe pour V2 ; la section 8 est alignée sur cette décision. Le
composant V2 prenait le baseline cible de l'occurrence précédente
comme origine. Si une nouvelle action survenait pendant une transition, cette
origine pouvait créer un saut. La correction reconstruit, depuis les
occurrences disponibles et l'état initial, la valeur réellement présentée à
la date de la nouvelle action. La même date absolue doit produire la même
expression en Play, Seek et replay, et une absence de durée doit rester
immédiate. La scène Avatar actuelle déclare `happy` à `4600 ms` et `neutral`
à `8800 ms` sans durée ; elle vérifie le trajet intégré mais n'exerce pas le
recouvrement. Celui-ci a une fixture autonome. `avatar-mood` est
réactivé au niveau du composant avec `avatar-lip-sync` ; les autres composants
spécialisés resteront suspendus. L'acceptation comprend les tests de début,
milieu, interruption et retour temporel, puis Play, Seek, replay, coexistence
avec le lip-sync, typechecks et build sur le trajet réel.

Le test d'interruption autonome passe : une action `sad` déclenchée au milieu
de `happy` reprend `mouthSmile = 0,1` à sa frontière, atteint `0,05` au milieu
de sa propre transition et reconstruit la même valeur après Seek. Une action
sans durée ramène immédiatement les morphs absents à zéro. Le contrat normatif
est consigné dans [`avatar-mood-spec.md`](../specs/avatar-mood-spec.md).

La première passe Safari a révélé deux défauts supplémentaires à la frontière
du coordonnateur et du moteur. Après `5000 → 550 ms`, le visème était reconstruit
mais `mouthSmile = 0,2` restait appliqué : `prepareSeek()` conservait les
baselines dans `MorphEngine`, alors que le coordonnateur oubliait les noms de
la couche mood précédente avant de pouvoir les effacer. La mémoire des noms
appliqués est désormais conservée pendant ce Seek. Par ailleurs, la timeline
mood donnait immédiatement sa nouvelle valeur au Play, mais `setBaseline()`
ajoutait le lissage du moteur ; cela retardait le changement sans durée et
dénaturait la courbe choisie pour les transitions. `snapBaseline()` applique
maintenant l'échantillon du mood sans retarder les morphs qu'il possède, tout
en respectant les couches fixes, système et ambiantes prioritaires. Les deux
régressions sont couvertes par des tests au niveau du coordonnateur et du
`MorphEngine` réel.

Les tests ciblés mood, lip-sync, coordonnateur et priorité des morphs passent ;
le typecheck `component-v2`, le typecheck V2 des démos et leur build passent.
La suite complète `component-v2` compte `80` tests réussis et `10` échecs
attendus sur `avatar-gesture`, `avatar-motion`, `avatar-idle` et `avatar-gaze`
encore désactivés ; aucun test de mood ou de lip-sync n'échoue. Dans Safari TP,
le Play avec audio applique `mouthSmile = 0,2` dès `4600 ms` et le remet à zéro
dès `8800 ms`. Le Seek `550 → 4500 → 4600 → 5000 → 8790 → 8800 → 10000 → 5000
→ 550 → 5000 ms` donne `0 → 0 → 0,2 → 0,2 → 0,2 → 0 → 0 → 0,2 → 0 → 0,2` sur
le sourire du modèle ; `viseme_O` vaut encore environ `0,58` à `550 ms`.
Le replay après `sequence:end` et le rechargement de scène ramènent l'état à
zéro. Les frontières de placement, reparent, taille et persistance ne sont
pas touchées par ce changement de composition des morphs.

L'auteur ne perçoit pas l'expression mood à la lecture. La comparaison Safari
à `4590/4610 ms` garde pratiquement le même visème (`viseme_DD` environ
`0,58`), tandis que `mouthSmile` passe de `0` à `0,2` ; les images restent
très proches. Le modèle paraît déjà souriant au repos et le cadrage du corps
réduit encore la différence visible. Une sonde temporaire dans la page a
confirmé qu'une baseline `sad` plus riche active réellement les sourcils, les
yeux et la bouche du modèle ; elle a été retirée sans modification du dépôt.
Augmenter seulement `mouthSmile` jusqu'à `1` ne rend pas l'état `happy`
nettement plus lisible dans ce cadrage. Le trajet runtime fonctionne, mais le
scénario auteur actuel ne démontre pas visuellement le changement de mood.

La comparaison avec `TalkingHead/modules/talkinghead.mjs`, dans `animMoods`,
confirme les valeurs natives : `neutral` contient `eyesLookDown = 0,1` et
`happy` ajoute `mouthSmile = 0,2`. Son morph mixte `mouthSmile` combine les
côtés gauche et droit à `0,8`, comme le chargeur Avatar V2. Sur le modèle réel,
les deux slots de `mouthSmile` reçoivent `0,2` dans Safari. TalkingHead associe
aussi à `happy` des animations périodiques de bouche, regard, tête et pose ;
elles relèvent de `avatar-idle`, encore désactivé par l'isolation des composants.
Un grossissement temporaire du canvas dans Safari à `4590/4610 ms` garde le
même constat visuel : le sourire du modèle au repos et sa barbe rendent le
petit changement des commissures difficile à lire, même avec le visage agrandi.
Le canvas et le journal ont été remis dans leur état initial après la sonde.
La proposition de substituer un mood plus expressif à `happy` est écartée :
elle ne traiterait pas la cause de la faible visibilité de l'action actuelle.

L'auteur précise ensuite que `avatar:mood:happy` doit produire une expression
perceptible par sa propre contribution : un perso auteur ne peut dépendre
implicitement d'un autre composant pour rendre son instruction intelligible.
L'examen de la construction révèle une séparation incomplète de TalkingHead.
Son `setMood()` remplace à la fois les baselines et les boucles de `animMoods` ;
`avatar-mood` V2 ne produit que les baselines, tandis que le coordonnateur
échantillonne les boucles de bouche et de visage via `sampleThIdle()`, bloqué
par le profil `avatar-idle.enabled = false` pendant l'isolation. De plus, le
sampler actuel reçoit le temps global et choisirait les boucles du nouveau mood
comme si celui-ci était actif depuis `t = 0`, au lieu de dater leur démarrage à
l'occurrence de mood. Cette frontière peut rendre l'action peu perceptible seule
et créer une rupture lors de la réactivation de `avatar-idle`.

La correction exige une décision de contrat sur le propriétaire des boucles
`animMoods` et leur origine temporelle avant de modifier l'implémentation. La
validation devra inclure `happy` visible sur le modèle actuel avec seulement
`avatar-mood` et `avatar-lip-sync`, puis Play, Seek et changement de mood sans
discontinuité, sans dupliquer l'échantillonneur de templates.

## 43. Fusion auteur de `avatar-idle` dans `avatar-mood` — 27 septembre 2026

> Statut : **Fixe** pour le contrat approuvé par l'auteur ; implémentation
> **En cours**.

L'auteur valide un unique perso `avatar-mood` pour l'expression et le comportement
spontané TalkingHead. Dans TalkingHead, `idle` est une branche de `animMoods`,
pas une humeur indépendante. La définition publique `avatar-idle` est retirée ;
sa configuration de pose, clignement, respiration, tête, changements de pose,
mains parlantes et graine rejoint `AvatarMoodInitial`. Le sampler interne de
templates est conservé et réutilisé, sans second circuit. `avatar-lip-sync`,
`avatar-gesture` et `avatar-gaze` gardent leurs contributions et priorités.

Ordre de correction :

1. déplacer la configuration et le déclenchement des boucles `animMoods` dans
   la contribution du perso `avatar-mood`, puis retirer l'enregistrement et les
   usages auteur de `avatar-idle` ;
2. dater les boucles à l'occurrence de mood, avec origine `t = 0` pour le mood
   initial, et reconstruire leur état au Seek sans phase héritée de la scène ;
3. établir la pose de repos dès le premier rendu, sans transition depuis la
   pose de bind, puis préserver les transitions de pose ultérieures ;
4. vérifier les priorités avec visèmes, geste et regard et le nettoyage des
   couches au changement de mood ;
5. exercer le modèle réel dans Safari TP en Play, Seek, replay, rechargement et
   changement de mood : `happy` doit être perceptible avec `avatar-mood` et
   `avatar-lip-sync` seuls. Les tests autonomes de timeline, pose et couches,
   les typechecks, la suite pertinente et le build complètent l'acceptation.

La spécification ciblée est [`avatar-mood-spec.md`](../specs/avatar-mood-spec.md).
La visibilité reste une gate : si le paquet TalkingHead complet ne suffit pas
sur ce modèle, le travail reste **En cours** jusqu'à une décision explicite sur
le rendu, sans ajuster silencieusement les valeurs natives.

### Contrôle de la fusion — 27 septembre 2026

La configuration de repos et les boucles TalkingHead passent par
`avatar-mood` ; la définition auteur `avatar-idle` est retirée. Le coordonnateur
date ces boucles à l'occurrence, y compris si le même mood revient. La pose
`neutral` est appliquée avant la première présentation et reconstruite au
Seek à zéro. Le clignement reçoit maintenant le temps absolu du ticker : une
réinstallation de son callback au changement de mood ne décale plus sa phase.
Le lip-sync conserve sa couche et sa timeline propres.

Les tests ciblés de coordonnateur, pose et fidélité morph passent, ainsi que
les typechecks `component-v2` et démos, le build démos et `git diff --check`.
La suite `component-v2` compte 84 réussites et 9 échecs circonscrits aux
composants `gesture`, `gaze` et `motion` encore volontairement désactivés
pendant cette isolation ; aucun échec mood ou lip-sync. Dans Safari TP, le
modèle réel présente une pose relâchée à 0 ms après présentation et Seek, le
mood `happy` à 5 500 ms diffère visiblement du neutre à 4 590 ms, et Play,
Seek arrière et rechargement ont été exercés. La page partagée reste vide en
état `ready` immédiatement après un rechargement, avant sa première
présentation par Play ou Seek ; ce comportement de la page n'affiche pas de
pose T et n'est pas modifié dans cette tranche Avatar. Les cas de
redimensionnement, persistance et hiérarchie parent/enfant ne traversent pas
les chemins modifiés : ceux-ci ne touchent ni le host Three ni CodPlay core.

Le contrôle Safari du parcours complet révèle cependant des cassures dans les
transitions de poses. L'analyse identifie deux pertes d'historique côté
coordonnateur : il compare seulement le nom de pose, ce qui ignore une nouvelle
occurrence du même nom, et le Seek ne reconstruit que la dernière pose choisie,
sans les poses antérieures qui déterminent sa pose source. La correction
reconstruit la suite déterministe des poses depuis le mood initial et les
occurrences de mood actives ; le moteur reçoit les poses dans l'ordre absolu
pour retrouver la même origine en Play, Seek et replay.

Le correctif transmet l'historique ordonné des moods au coordonnateur et fait
produire par le sampler l'historique des poses sélectionnées. Au premier tick
et après Seek, le coordonnateur réapplique la pose auteur puis rejoue chaque
transition antérieure jusqu'au temps demandé. En lecture, il compare le couple
nom/date d'occurrence pour ne pas ignorer un retour au même nom. Les tests
comparent le moteur sémantique réel après lecture continue et Seek direct à
6 secondes avec un changement de mood, et vérifient deux occurrences du même
nom de pose ; ils passent. Les tests du sampler et le typecheck passent aussi.

La reprise visuelle Safari reste à confirmer : la page contrôlée par l'outil
est en arrière-plan, le ticker n'avance pas et la capture du canvas est noire.

Une autre cassure est localisée vers `2930 ms`. La piste de visèmes passe de
`DD` à une occurrence nulle au milieu de la phrase ; `avatar-lip-sync`
convertissait cette seule information de bouche en mode corporel `idle` du
coordonnateur. Les templates de tête `speaking` et `idle` donnent à cette date
respectivement `bodyRotateY ≈ +0,025` et `−0,077`, et `headRotateY ≈ −0,046`
et `+0,001`. Le remplacement instantané explique la cassure observée autour
de `2950 ms`.

L'auteur fixe la frontière : les visèmes commandent uniquement la bouche.
Une occurrence nulle ferme la bouche selon l'enveloppe lip-sync, sans changer
le mood, la pose ou le regard ; `happy` garde son sourire. La piste `word`
sert aux sous-titres et ne commande pas l'Avatar. La correction retire la
commande de mode corporel du perso lip-sync, puis vérifie l'absence de cette
commande, la composition sourire/visème et la continuité à la frontière en
Play et Seek sur le modèle réel. Les comportements spontanés restent portés
par l'initial du perso mood ; un profil général d'humeur (`agité`,
`tranquille`, `nerveux`) reste une idée à définir séparément avant tout code.

Le perso lip-sync ne commande plus `setGazeMode` ; ses occurrences restent dans
la seule timeline `lip-sync`. Dans la scène, `avatar:viseme` vise ce perso,
`avatar:mood:*` vise `avatar-mood`, et `subtitle:word` vise uniquement le perso
de sous-titres. Le test de frontière vérifie qu'un visème parlé puis nul ne
commande aucun mode corporel ; le test de composition vérifie que le sourire
`happy` reste présent quand `viseme_O` retombe à zéro. Les tests ciblés
coordonnateur/sampler (25) et composant (4), les typechecks du composant et
des démos, le build des démos et `git diff --check` passent. La suite complète
compte 89 réussites et les 9 échecs déjà attribués aux persos `gesture`,
`gaze` et `motion` désactivés pendant l'isolation. Safari TP présente la même
orientation à `2920` et `2950 ms` après Seek ; Play traverse cette frontière
avec le modèle réel et sans erreur de runtime. Les chemins de resize,
persistance et hiérarchie restent hors de ce changement : seule l'émission
d'une commande latérale depuis le perso lip-sync est supprimée.

Le balayage numérique des autres frontières révèle encore un écart distinct
aux changements de mood (`4600` et `8800 ms`) : le redémarrage des templates
à l'occurrence remet instantanément les morphs spontanés à leur valeur
initiale. Par exemple, `headRotateX` passe d'environ `−0,106` à `0` à
`4600 ms`. L'auteur demande de reprendre la règle TalkingHead par défaut :
chaque nouveau template part de la valeur affichée et suit ses durées natives ;
une tâche autonome `headmove` déjà lancée continue jusqu'à sa sortie. La
correction doit reconstruire cet état depuis l'historique des moods, y compris
au Seek et quand une occurrence interrompt la précédente. Les tests comparent
les valeurs de part et d'autre de la frontière, puis Play et Seek ; Safari TP
contrôle le modèle aux deux changements de mood. La tranche demeure
**En cours** jusqu'à cette validation.

### Raccord des tâches natives — 27 septembre 2026

L'analyse de TalkingHead précise trois causes qui se cumulaient : le marqueur
`headMove` était lu comme une valeur continue et sa tâche était datée du début
du mood ; la reprise des yeux par la tête remettait le regard horizontal à zéro
sans parcourir la durée native ; enfin, le sampler oubliait les valeurs
affichées et les tâches antérieures lors d'un changement ou d'un chevauchement.
Le sampler des templates restitue désormais les marqueurs à leur slot natif.
Le coordonnateur reconstruit les sources de chaque mood depuis l'historique et
conserve les tâches autonomes déjà émises, sans générer de nouveaux marqueurs
depuis une ancienne boucle après son remplacement. Une nouvelle tâche reprend
les canaux de tête et de regard à leur valeur courante ; la libération des yeux
attend leur prochaine boucle native.

Les tests de régression couvrent le délai du marqueur, le début et la sortie du
regard, deux tâches de tête superposées, la transition vers un mood répété, une
tâche qui traverse un changement de mood, la reprise par la tâche d'un mood
ultérieur et l'identité Play/Seek. Les 30 tests ciblés passent. Un balayage de
la scène de `0` à `12 000 ms`, pas `1 ms`, donne un plus grand écart de
`0,00399` entre deux pas sur les canaux tête, buste et yeux observés. Un
balayage de 30 graines, trois occurrences de mood et un pas de `5 ms` ne
retrouve plus les ruptures supérieures à `0,03` ; il exerce notamment les
tâches superposées et les changements de mood. Les typechecks composant et
démos, le build des démos et `git diff --check` passent. La suite complète du
composant compte 94 réussites et les mêmes 9 échecs attribués à `gesture`,
`gaze` et `motion`, toujours désactivés pour l'isolation.

Safari TP a été rechargé puis contrôlé en Seek à `0`, `4030/4040`,
`4590/4600` et `8790/8800 ms` : la pose initiale n'est pas en T et les
frontières contrôlées ne montrent plus de changement d'orientation brusque.
Une lecture réelle depuis `3900 ms` a traversé les actions mood de `4600` et
`8800 ms` jusqu'à la fin de la scène ; le journal ne rapporte pas d'erreur
runtime. Après le dernier raccord des tâches superposées, une nouvelle passe
Safari TP a confirmé le Seek à `0`, `4590/4600` et `8790/8800 ms`, puis Play
de `3900` à `18500 ms` avec les deux actions mood effectivement traversées.
La tranche reste **En cours** pendant l'isolation des autres composants et
jusqu'à l'appréciation visuelle de l'auteur.

### Perceptibilité du mood — 27 septembre 2026

L'auteur confirme la fluidité des raccords, mais ne distingue pas suffisamment
le mood dans la lecture : le visage lui paraît neutre. Le journal Safari TP
confirme la réception de `avatar:mood:happy` à `4600 ms` et le retour à
`neutral` à `8800 ms`. La baseline `happy` reste la valeur TalkingHead native
`mouthSmile = 0,2`, distribuée en `0,16` sur chaque morph de sourire du
modèle ; le sampler spontané conserve cette même cible. Les captures au Seek
montrent une différence légère entre `0` et `5500 ms`, insuffisante comme
critère d'acceptation en lecture. La gate de visibilité du §43 reste donc
ouverte. L'auteur choisit un réglage optionnel par expression dans l'initial
du perso `avatar-mood`, par exemple `moods: { happy: { mouthSmile: 0.5 } }`.
`mood: 'happy'` reste accepté pour sélectionner l'expression initiale, avec
ou sans cette table. Chaque valeur remplace le canal homonyme de la baseline
TalkingHead pour ce seul perso ; les autres valeurs et les moods non renseignés
restent natifs. La même baseline résolue doit alimenter la transition
d'expression et le sampler spontané, y compris les reconstructions Play/Seek
et les tâches traversant un changement de mood. Les valeurs sont absolues,
finies et validées à la construction. La démo exerce `happy` avec ce réglage
via son vrai perso et la piste `avatar:mood:happy`, puis Safari TP permet de
juger le modèle en lecture, Seek et replay. La tranche reste **En cours**
jusqu'à cette appréciation.

Le réglage par perso est implémenté sans modifier les valeurs globales de
TalkingHead. Le perso transmet la baseline résolue avec chaque occurrence de
mood ; le coordonnateur la réutilise dans les templates spontanés, y compris
pour une tâche de tête qui traverse un changement de mood. `mood: 'happy'`
fonctionne comme expression initiale avec `moods`, et un `happy` ultérieur
utilise la même valeur. La scène de validation déclare
`moods: { happy: { mouthSmile: 0.5 } }` sur son perso mood ; l'événement
`avatar:mood:happy` et le lip-sync continuent par leurs pistes dédiées.

Les tests ciblés du composant, du coordonnateur et du sampler comptent 45
réussites ; les quatre échecs de cette sélection concernent les composants
`gesture` et `gaze` volontairement désactivés. La suite complète compte 97
réussites et les neuf échecs déjà connus de `gesture`, `gaze` et `motion`.
Les typechecks composant et démos et le build démos passent. Safari TP a
chargé le GLB réel : il contient `mouthSmileLeft` et `mouthSmileRight`, et
le morph mixte `mouthSmile` accepte la valeur `0,5`. La démo a été vérifiée
en Seek à `5500` et `6200 ms`, puis en lecture réelle traversant l'action
`happy` jusqu'à `6200 ms`, avec le visage présent et sans erreur runtime
observée. La perceptibilité en lecture reste à juger par l'auteur avant de
clore la tranche.

### Fréquence de clignement observée — 27 septembre 2026

L'auteur observe un seul clignement sur les `18 500 ms` de la scène, contre
trois à quatre avant la fusion de `avatar-idle` dans `avatar-mood`. Le calcul
déterministe du sampler confirme un clignement complet vers `15 550 ms` avec
la graine dérivée de `avatar-mood` et le redémarrage du temps de clignement
aux moods de `4600` et `8800 ms`. Avec la même graine mais un temps absolu
continu, le sampler en produit trois ; l'ancien perso `avatar-idle` avec sa
graine propre et un temps continu en produisait quatre. TalkingHead recrée
la boucle `blink` dans `setMood`, ce qui explique le redémarrage actuel, mais
la spécification Avatar ne définit pas encore de réglage de fréquence pour
répondre au besoin auteur. Une décision de contrat est nécessaire avant de
modifier la boucle ou sa configuration ; la tranche reste **En cours**.

### Troisième étape : réactivation de `avatar-gesture` — 27 septembre 2026

À la demande de l'auteur, le filtre `temp` du composant `avatar-gesture` est
levé. Son circuit existant dépose toujours ses frames sur la timeline `gesture`
du coordonnateur ; ni les événements de la scène ni le core CodPlay ne sont
modifiés. Les pistes mood et lip-sync restent indépendantes. La sortie
`avatar:gesture:release` et les gestes successifs empruntent le même circuit.

Les tests ciblés du composant, du coordonnateur, du catalogue de motions et de
fidélité TH comptent 48 réussites ; les six échecs restants portent uniquement
sur `avatar-gaze` et `avatar-motion`, toujours désactivés. La suite complète
compte 100 réussites et ces mêmes six échecs. Les typechecks `component-v2` et
démos ainsi que le build démos passent. Dans Safari TP, le modèle réel présente
`nod_yes` à `4500 ms`, `wave_left` en Seek à `6800 ms` et en Play de `5500` à
`6300 ms`, revient aux bras au repos à `8500 ms`, présente `wave_right` à
`9400 ms`, `thumbup_right` à `12500 ms`, `celebrate` à `15100 ms` puis `bow`
à `17800 ms`. La lecture intégrale de `0` à `18430 ms`, un Seek arrière et un
rechargement suivi d'un Seek retrouvent la même pose à `6800 ms`. Aucune erreur
ou alerte n'est relevée dans la console.
La validation visuelle de la continuité par l'auteur reste ouverte ; la tranche
demeure **En cours**. Le réglage de clignement et la perceptibilité du mood
restent suivis séparément.

### Cassure de tête à la sortie de `nod_yes` — 27 septembre 2026

L'auteur signale une cassure d'orientation vers `5400 ms`, à la frontière de
`avatar:gesture:release`. L'action `nod_yes` commence à `3900 ms` et dure
`1200 ms` ; sa sortie interne de `250 ms` se termine vers `5350 ms`. Le geste
libère alors ses morphs de tête. `MorphEngine.setFixed(null)` démarrait bien un
retour progressif, mais le prochain échantillon spontané du mood appelait
`snapAmbient()` sur ces mêmes canaux : dès que `fixed` était nul, il écrasait
la valeur en cours par la cible ambiante. Cette interaction, indépendante des
visèmes et de l'eventime `release`, explique une rupture visible peu après la
sortie interne du geste.

Le circuit existant de `MorphEngine` conserve maintenant l'approche en cours
quand `snapAmbient()` reçoit une nouvelle cible ; celle-ci continue de suivre
le mood pendant le retour du geste. Le test de frontière fait échouer l'ancien
comportement avec un saut de `0,177 rad` sur `headRotateX`, puis vérifie que la
valeur reste continue et reprend sa progression. Les sept tests de fidélité TH
passent. La suite `component-v2` compte 101 réussites et les six échecs connus
de gaze et motion désactivés ; les typechecks composant et démos ainsi que le
build démos passent.

Safari TP a été rechargé sur le vrai modèle ; Play a traversé `5367 → 5433 ms`
sans réorientation nette observée, puis la scène entière de `0` à `18450 ms`.
Un Seek arrière `5390 → 5400 ms` et un rechargement suivi d'un Seek à `5400 ms`
ont été exercés. La seule erreur console est une requête de `favicon.ico`
absent (`404`), sans lien avec l'Avatar. Cette correction ne touche ni la
hiérarchie, ni la taille du host, ni la persistance : ces catégories ne
traversent pas le moteur de morphs modifié. La tranche reste **En cours**
jusqu'à l'appréciation visuelle de l'auteur autour de cette sortie et des
autres gestes.

### Cassure à la sortie de `bow` — 27 septembre 2026

Le balayage de la lecture réelle après le premier correctif révèle une
seconde cassure vers `18400 ms`, à la sortie explicite de `bow`. La trace du
`MorphEngine` montre que `bodyRotateX` tombe de la valeur encore interpolée
vers la valeur spontanée sur une seule frame. Cette fois, la cause est un
`snapSystem('bodyRotateX', null)` répété par le regard : bien que cette
contrainte soit déjà nulle, son traitement instantané annule la sortie du
geste. Le coordonnateur ne fait pas de Seek à cette frontière ; la correction
reste dans le moteur de morphs existant.

`snapSystem()` laisse désormais une interpolation en cours quand sa valeur
système est inchangée. Une nouvelle valeur système reste instantanée. Le test
de régression reproduit l'ancien saut de `0,219 rad` sur `bodyRotateX` et
vérifie les deux comportements. Les huit tests de fidélité TH passent ; la
suite complète compte 102 réussites et les six échecs déjà connus de gaze et
motion suspendus. Les typechecks composant et démos, le build démos et
`git diff --check` passent.

Safari TP présente `bow` avant et après `18400 ms` sans redressement immédiat.
Dans le relevé exploratoire de la zone tête/buste, la variation de cette
frontière passe d'environ `9,9` à `1,4` unités moyennes par frame ; la lecture
complète ne montre plus de pic comparable aux autres frontières de geste.
Play et Seek direct présentent cependant deux poses différentes à `18400 ms` :
Play conserve le retour progressif, tandis que le Seek applique `snapAll()` et
présente la cible. Le §39 autorise ce snap au Seek, mais l'égalité souhaitée
entre ces deux modes pour une transition encore active reste à décider avec
l'auteur avant tout changement de reconstruction. La tranche demeure
**En cours**.

### Quatrième étape : réactivation de `avatar-gaze` — 27 septembre 2026

À la demande de l'auteur, le filtre `temp` est levé sur `avatar-gaze` au niveau
du composant. `avatar-lip-sync`, `avatar-mood` et `avatar-gesture` restent
actifs ; `avatar-motion` reste suspendu. Les eventimes, la scène, le host Three
et le core CodPlay ne changent pas. Le regard utilise sa timeline existante
et la caméra transmise au coordonnateur Avatar par le composant central.

Les 39 tests ciblés des composants, du regard natif et du coordonnateur
passent. La suite complète `component-v2` compte 104 réussites et quatre
échecs, tous dus à `avatar-motion` encore suspendu. Les typechecks
`component-v2` et démos, le build démos et `git diff --check` passent. Dans
Safari TP, le journal reçoit `avatar:gaze:off` à `5400 ms` et
`avatar:gaze:on` à `9600 ms`. Les images juste avant et à chaque événement
sont identiques ; la tête et les yeux évoluent pendant les fenêtres
`5400–6200 ms` et `9600–10400 ms`. Les poses à `6200` et `10400 ms` ont été
observées par Seek puis par Play sur le vrai modèle. Un Seek arrière à `0 ms`
retrouve la pose de repos, et un changement de taille suivi d'un Seek puis un
rechargement suivi d'un Seek à `6200 ms` représentent le modèle sans erreur
console. La validation visuelle de l'auteur et le raccord Play/Seek transitoire
du geste à `18400 ms` restent ouverts ; cette étape reste **En cours**.

Le contrôle du rechargement révèle aussi une lacune distincte du regard :
après chargement asynchrone du GLB, le lecteur est `ready` à `0 ms`, mais le
canvas reste vide tant qu'aucune nouvelle présentation Play ou Seek n'a lieu.
`AvatarComponent.loadModel()` attache le modèle et incrémente sa révision
après le dernier passage de présentation initial ; l'absence de nouveau tick
laisse le host sans rendu. Le défaut persiste après douze secondes à `0 ms`
et après un Seek vers cette même date. Un Seek à `5000 ms` présente le modèle ;
un retour à `0 ms` présente ensuite la bonne pose.
Le §38 interdit de présenter directement une frame depuis le callback de
chargement ; le contrat ne précise pas encore comment un chargement asynchrone
demande un nouveau passage du flux commun lorsque le lecteur est à l'arrêt.
Cette frontière devra être décidée avant une correction, sans rendu parallèle
dans le composant ou contournement de la démo.

### Décision : identité de pose entre Play et Seek — 27 septembre 2026

> Statut : **En cours**. L'auteur décide explicitement que, pour toute date
> `t`, `Play(t) = Seek(t)`, y compris au milieu d'une transition. Cette décision
> remplace l'exception de reconstruction instantanée admise au §39.

L'écart à `18400 ms` est une preuve de non-conformité : en Play,
`MorphEngine.update(deltaMs)` garde la valeur et la vitesse de sortie de
`bow`, tandis que `commitSeek()` appelle `snapAll()` et saute à la cible.
Corriger cette seule date serait insuffisant. Le même état dépendant des
frames existe dans les transitions sémantiques de `GestureEngine`, la
conservation des translations du lecteur de clips et les ressorts
`AvatarDynamicBones`. `AvatarCoordinator` ne reçoit actuellement que la
timeline de la dernière occurrence de geste ; cette représentation ne permet
pas de rejouer tout l'historique au Seek. Une variation de cadence en Play
modifie également les intégrations qui consomment directement `deltaMs`.

L'auteur précise que toute transformation doit passer par le flux commun des
composants. Le raccord doit garder `avatar-coordinate` comme seule
présentation persistante et faire de la pose une fonction de la date CodPlay,
de l'initial du modèle et des historiques d'instructions de chaque composant.
Les transformations de `bow` et des autres gestes, les corrections de regard,
les morphs et les animations externes doivent être composés dans ce même
passage. Les traitements TH qui intègrent une vitesse ou un ressort devront
partager une progression déterministe, indépendante des frames de rendu, puis
reconstruire la même progression au Seek. `snapAll()` ne peut plus remplacer
cette reconstruction pour une transition en cours. Les historiques restent
dans leurs tracks respectives ; aucun événement visème ne pilote le corps.
Le raccord des transformations ne prévoit aucun changement du core CodPlay ni
contournement de la démo. Le chargement asynchrone à `0 ms` relève d'une
frontière distincte du runtime, décrite plus bas.

L'acceptation comparera les morphs, les rotations et les positions du modèle
à la même date après Play continu, Play à cadences différentes, Seek direct,
Seek arrière, replay et rechargement, avant, pendant et après les frontières
de geste, mood, regard et motion. Elle couvrira les ressorts lorsque le perso
les configure, puis le parcours Safari TP du modèle réel. Les tests ciblés,
les non-régressions des couches précédentes, les typechecks et le build
accompagneront ce contrôle. Le défaut d'affichage initial à `0 ms` reste une
frontière distincte du chargement asynchrone.

Première correction du flux commun : `avatar-gesture` conserve maintenant les
occurrences de sa track et calcule chaque morph de geste à la date CodPlay.
Une interruption, notamment le `release` de `bow`, part de la valeur du geste
précédent à la frontière et suit une courbe TH absolue sur `250 ms`. Le
coordonnateur applique cet échantillon avec `snapFixed()` ; le moteur de morphs
ne lui ajoute plus un easing dépendant des frames. Les marqueurs squelettiques
des gestes et poses sont transmis comme historique au même coordonnateur, qui
les rejoue avec les poses mood dans l'ordre des dates au premier passage et
après Seek. Le moteur sémantique est réinitialisé puis reconstruit à chaque
date présentée : un Seek avant ou un Seek arrière ne dépend donc pas de la
taille du saut ni de la cadence des frames précédentes. Un test de frontière
compare la rotation de `bow` en Play et Seek au milieu du retour ; un autre
compare le relâchement d'un geste natif, y compris après un saut direct vers
l'avant.

Une erreur d'intégration lors de cette correction (`sameGestureHistory` absent)
a empêché la création de l'instance dans Safari TP. La fonction est rétablie :
la démo revient à l'état `ready` et le canvas contient le modèle à `5000` et
`18400 ms`, sans nouveau diagnostic console. Les tests ciblés des composants,
du coordinateur et du regard passent ; la suite complète compte 108 réussites
et les quatre échecs préexistants du
composant `avatar-motion` encore désactivé. Les typechecks du composant et des
démos, ainsi que le build des démos, passent. Cette preuve ne clôt pas la
tranche : le template `look-ahead`, les translations conservées des clips,
les ressorts optionnels et la comparaison Safari Play/Seek à toutes les
frontières restent à vérifier et à corriger.

Le composant de regard ne gardait que la dernière occurrence et la précédente.
Une interruption au milieu d'une transition repartait de la cible finale
précédente, avec un saut. Il échantillonne désormais toutes les occurrences
de sa track à chaque nouvelle frontière ; le moteur natif reçoit aussi la
cible source de la transition, même après Seek direct. Un test autonome vérifie
la continuité et la même valeur après reconstruction. La source des morphs du
template natif `look-ahead`, encore capturée dans l'état mutable du moteur,
reste à reconstruire sur l'horloge commune ; cette correction n'est donc pas
une validation globale de la parité du regard.

Le canvas est encore vide après un chargement frais arrêté à `0 ms` ; le
framebuffer vaut `[0,0,0,0]`. Après une présentation par Seek à `0 ms`, le
modèle apparaît. `AvatarComponent.loadModel()` ne dispose que de la révision
locale et du target Three ; `registerAnimation` n'est valable que durant
`update()`. Le runtime ne propose pas de demande de nouvelle présentation
après la fin asynchrone du chargement. Une capacité de réévaluation du frame
courant par le pipe commun doit être spécifiée et acceptée avant toute
modification du core ; le callback de chargement ne doit pas écrire la pose ni
dessiner directement dans le host.
L'auteur n'autorise pas de modification de `packages/codplay` pour cette
demande. Le défaut du chargement frais arrêté à `0 ms` demeure donc ouvert ;
aucun rendu parallèle dans le composant Avatar ne doit le masquer.

### Continuité du hochement vers `5500 ms` — 28 septembre 2026

La trace du modèle réel en Safari TP isole deux ruptures du même circuit :
`nod_yes` finissait sa sortie naturelle vers `5350 ms` en tenant
`headRotateX` à zéro, puis cédait immédiatement au mood spontané
(`-0,112 rad` dans ce scénario). À `5400 ms`, le `release` explicite
réintroduisait les canaux déjà libérés à zéro jusqu'à `5650 ms`, avant un
second saut vers le mood. L'action de regard simultanée ne provoquait pas
ces sauts de morph.

Le sampler de geste transmet maintenant la part de pose encore possédée par
la motion durant sa sortie. Le coordonnateur mélange cette part avec le
dernier échantillon spontané dans `avatar-coordinate`. Un `release` après la
fin naturelle reste libéré et ne recrée pas de canal fixe. Les interruptions
actives conservent leur easing et la priorité des visèmes reste inchangée.

Les tests ciblés des composants, du coordonnateur et de fidélité TH passent
(`50/50`). La suite complète compte `110` réussites et les quatre échecs
connus du composant `avatar-motion` encore désactivé. Les deux typechecks,
le build des démos et `git diff --check` passent. Dans Safari TP, la trace
Play de `5335` à `5450 ms` varie continûment de `-0,105` à `-0,112 rad`,
puis reste à `-0,112 rad` pendant le `release` ; les Seek directs de
`5250` à `5800 ms` donnent les mêmes échantillons aux dates communes. La
validation perceptive par l'auteur et les autres frontières de composition
du plan restent ouvertes ; la tranche demeure **En cours**.

### Regard caméra continu dans la scène Avatar — 28 septembre 2026

L'auteur demande que le contact caméra reste actif pendant toute la scène.
Le perso `avatar-gaze` garde `enabled: true` et `contact: 1` dès son initial ;
les occurrences `avatar:gaze:off` à `5400 ms` et `avatar:gaze:on` à `9600 ms`
sont retirées des eventimes de cette scène. Les deux actions restent déclarées
sur le perso et disponibles pour les scènes qui veulent piloter cette option.
La capacité et ses tests de transitions restent dans le composant partagé.
Le parcours de validation compare le regard caméra en Play, Seek et
rechargement avant, pendant et après les anciennes fenêtres d'extinction,
sur le modèle réel dans Safari TP. Le flux `avatar-coordinate` et le core
CodPlay ne changent pas.

Le premier contrôle du parcours réel révèle un écart de contrat : malgré
`enabled: true`, `contact: 1` et la cible `camera`, le coordonnateur transmet
un contact effectif de `0` à `5000`, `5400`, `5500`, `6200`, `8000`, `9600`
et `10400 ms`. La couche spontanée mood produit un `eyeContact` nul à ces
dates et le coordonnateur multiplie systématiquement le contact auteur par
cette valeur. Porter la probabilité du profil idle à `1` ne donne pas un
contact continu non plus : les templates TH contiennent des fenêtres sans
contact. Les tests ciblés (`45/45`), le typecheck et le build passaient sans
valider l'intention auteur ; cette observation a fixé la décision suivante.

Décision de l'auteur : **l'eye contact est actif par défaut**. La track
`avatar-gaze` possède donc la force du contact continu (`1` sans réglage
auteur) et ses actions `on/off` la font varier ou la coupent. Les probabilités
des templates TH restent dans le mood et ne multiplient plus la force demandée
par `avatar-gaze` ; un marqueur de geste ne désactive pas cette option. La
correction reste dans `AvatarCoordinator`, sans chemin de présentation
supplémentaire. L'acceptation comprend une régression autonome avec une
fenêtre TH sans contact, puis Play, Seek et rechargement Safari TP sur la
scène entière, en plus des tests du regard et des autres composants actifs.

`AvatarCoordinator` transmet désormais directement la force échantillonnée
par `avatar-gaze` ; les marqueurs de contact du mood et du geste ne la
remplacent plus. Le test de frontière utilise une date où le template TH ne
demande aucun contact, vérifie le contact auteur `0,8`, puis une désactivation,
une réactivation et un Seek arrière. Les tests du composant couvrent le défaut
`enabled: true`, `contact: 1`, cible `camera`, ainsi que `on/off` de la
timeline jusqu'au coordonnateur. Les 61 tests ciblés passent ;
la suite complète compte `113` réussites et les quatre échecs connus de
`avatar-motion` encore suspendu. Les typechecks du composant et des démos,
le build des démos et `git diff --check` passent. Sur le modèle réel dans
Safari TP, le contact reste à `1` et la cible `camera` en Seek de `0` à
`18000 ms` ; les `1111` présentations d'un Play complet jusqu'à `18500 ms`
gardent aussi ces valeurs. Après redimensionnement et rechargement, le Seek
à `5510 ms` garde ces valeurs et le framebuffer contient le modèle. Aucun
diagnostic runtime n'apparaît. La composition n'écrit ni état persistant ni
hiérarchie du host ;
ces frontières ne sont pas modifiées. La tranche Avatar reste **En cours**
pour ses autres frontières de composition et la validation perceptive.

### Dernière étape : réactivation de `avatar-motion` — 28 septembre 2026

À la demande de l'auteur, le filtre `temp` est levé sur `avatar-motion` au
niveau du composant. La surface auteur et le lecteur de clip existants des
sections 20, 27 et 35 restent le circuit de référence. Les `117` tests de
`component-v2` passent après activation, dont les quatre tests auparavant
suspendus avec ce composant ; le typecheck du package passe. Aucun core
CodPlay n'est modifié.

La scène Avatar principale conserve son rôle de validation des expressions,
gestes et regard. Le parcours d'acceptation de la motion utilise la scène
d'animation dédiée prévue en section 27, avec le modèle préparé et la ressource
`hero-walk.fbx` déclarés dans le preload réel. Il doit exercer l'initial et
l'action `avatar:motion:walk`, comparer Play et Seek au départ, pendant le
clip, pendant le retour à la pose Avatar et après, puis rechargement et
redimensionnement dans Safari TP. La tranche reste **En cours** jusqu'à cette
validation, y compris l'égalité des translations et rotations.

### Validation de `avatar-motion` sur le modèle réel — 28 septembre 2026

La scène dédiée `?demo=avatar-motion` charge `avatarsdk.glb` et
`hero-walk.fbx` par le manifeste et les stratégies Three.js communs. Elle
active le composant avec `motion: 'walk'` et une occurrence
`avatar:motion:walk` à `0 ms`. Son cadrage auteur montre le corps entier pour
observer la marche ; ce réglage ne remplace aucun comportement du runtime.

Le premier balayage Safari TP a révélé deux dépendances à la frame précédente.
L'équilibre hanches/pieds lisait les pieds et les limites du modèle en
coordonnées mondiales : le déplacement `arrival` du parent se retrouvait ainsi
ajouté aux hanches du squelette. Le calcul est désormais effectué dans le
repère local de l'armature, avec une régression où le parent est déplacé et
tourné. Ensuite, pendant la sortie naturelle, le temps du clip restait sur sa
dernière image. Le mixer Three.js évitait de réécrire une valeur jugée
identique, alors que le composeur avait entre-temps écrit la pose de la frame
précédente. Le lecteur renouvelle les bindings quand ce temps est répété ; une
régression compare désormais la pose terminale lue sur plusieurs frames Play
avec un Seek direct au milieu de la sortie.

Après correction, les hanches et leur quaternion ont les mêmes valeurs en
Seek avant et après un retour temporel (`500`, `1000`, `1180`, `6000` puis
`1180 ms`). À `1200 ms`, une frame Play et un Seek au même temps donnent des
translations et quaternions identiques sur le vrai modèle. Les échantillons de
`900` à `1800 ms` montrent un déplacement `arrival` qui atteint zéro puis un
retour progressif à la pose. La capture Safari montre le modèle entier en
marche à `500 ms`. Après redimensionnement à `900 × 800`, puis rechargement de
la scène, le framebuffer contient toujours le modèle aux dates testées. La
démo Avatar principale reste affichée à `5500 ms` après réactivation de
`avatar-motion`. Aucun état persistant ni hiérarchie du host n'est modifié par
ces corrections ; la vérification de persistance ne requiert donc pas de
nouveau scénario.

La suite `component-v2` passe avec `118` tests, les deux typechecks et le build
des démos passent. Le contrôle `git diff --check` et les diagnostics navigateur
terminent cette étape. Le défaut connu de première présentation asynchrone à
`0 ms`, déjà documenté plus haut et hors de cette correction sans autorisation
core, reste ouvert. La tranche Avatar demeure **En cours** pour sa validation
perceptive d'ensemble.

### Continuité à 630 ms et regard caméra — 28 septembre 2026

Sur `?demo=avatar-motion`, l'auteur observe une petite cassure de tête au début
de la levée du bras et ne voit jamais de contact caméra. À `630 ms`, le
coordonnateur reçoit pourtant `avatar-gaze` actif, un contact de `1` et la cible
`camera`. Le mouvement de tête transmis au regard est nul : le mood de cette
scène coupe son mouvement spontané de tête, et le coordonnateur multipliait à
tort la force propre au regard par ce réglage mood. Le regard conserve désormais
sa force auteur indépendamment du mouvement spontané ; une régression vérifie
ce cas avec un mood immobile et une force de regard explicite.

L'arrivée animée déplace le parent du modèle à chaque date. La résolution du
regard utilisait sa position de la présentation précédente, car le déplacement
du parent était appliqué après la composition et les matrices mondiales de ses
ancêtres restaient parfois périmées. Le déplacement est maintenant posé dans
la présentation Avatar, après l'échantillon du clip et avant le calcul du
regard. Le regard actualise aussi les matrices mondiales de ses ancêtres. Une
régression déplace le parent entre deux échantillons ; le regard obtenu égale
celui d'un modèle directement placé à la nouvelle position.

La comparaison Safari TP a ensuite isolé une seconde dépendance temporelle :
Three.js pouvait conserver une valeur de piste inchangée dans son mixer alors
que le composeur avait écrit une autre pose sur l'os entre deux échantillons.
Le lecteur renouvelle les bindings natifs à chaque échantillon. Le test ciblé
reproduit ce cas sur la translation constante des hanches. Pour l'arrivée
centrée, l'ancrage de cette translation est la position du modèle chargé,
conformément au contrat `arrival` ; un autre test couvre cette origine.

Après ces corrections, les parcours Safari TP `0 → 1200 → 633 → 1200 → 0 →
1200 → 633 ms` produisent exactement la même position et le même quaternion
de tête, la même position locale des hanches et le même déplacement du parent
à chaque retour sur `633` ou `1200 ms`. Le regard calculé à `630 ms` est non
nul et son axe final pointe vers la caméra à quelques centièmes de radian
près. Le modèle est présent dans le framebuffer après redimensionnement et
rechargement sur la scène dédiée, ainsi qu'à `5500 ms` dans la scène Avatar
principale. Les `123` tests de `component-v2`, les deux typechecks, le build
des démos et `git diff --check` passent. Safari TP signale actuellement son
onglet comme masqué et suspend le RAF ; cette session ne permet donc pas de
confirmer visuellement un Play continu après la dernière correction. La
tranche reste **En cours** jusqu'à ce contrôle perceptif et au retour de
l'auteur sur les deux symptômes.

Le chargement du FBX émet des avertissements Three.js pour des pistes dont
l'os cible est absent du modèle. Un Seek supplémentaire à `630 ms` n'en émet
pas après vidage du journal ; aucun traitement du clip n'a été ajouté sur la
base de ces seuls avertissements.

### Lisibilité des trois appuis de l'entrée — 28 septembre 2026

L'auteur observe que la marche de la scène dédiée finit trop tôt et ressemble
à un glissement ou à une avancée de caméra. Le clip `hero-walk.fbx` dure
`0,967 s` et porte une translation de hanches d'environ `1,62 m` avec trois
phases d'appui visibles dans ses pistes pied droit, pied gauche, pied droit.
L'ancienne scène laissait la transition d'entrée à sa valeur TH de `1 000 ms` :
la pose de marche n'atteignait donc son poids entier qu'après la fin du clip.
Le `ease-out` auteur comprimait en outre la cadence des premiers appuis. La
caméra de cette scène est fixe, sans action ; c'est le groupe de présentation
de l'avatar qui avance selon `rootMotion: arrival`.

La scène d'acceptation règle maintenant la vitesse auteur de `avatar-motion`
à `0,5`, soit `1,933 s` pour le clip complet, et `entryTransitionMs` à `0`
sur la ressource. Elle retire l'easing de ce clip pour conserver le rythme
de ses appuis. C'est un réglage du scénario au moyen des surfaces déjà prévues
par les sections 20, 27 et 35 : le runtime est responsable d'échantillonner
ce clip et son déplacement à la même date, mais ne doit pas inventer une
durée ou une transition particulière pour cette ressource. Le preload et le
flux réel `avatar-coordinate` restent exercés ; aucun composant ni core
CodPlay n'est modifié.

Dans Safari TP, les images du canvas aux Seek `0`, `700`, `1300`, `1900` et
`2500 ms` montrent le cycle encore actif à `1900 ms` puis la pose de repos.
Après rechargement et redimensionnement, le modèle reste présent à `1900 ms`.
Les Seek `700 → 1300 → 1900 → 700 → 1300 → 1900 ms` reproduisent des images
identiques pour chaque date. Le Play atteint la fin de la scène ; la session
Safari masque parfois l'onglet et ne permet pas une observation fiable de
toutes ses frames intermédiaires. Les `123` tests `component-v2`, les deux
typechecks, le build des démos et `git diff --check` passent. La tranche
reste **En cours** pour l'appréciation perceptive de l'auteur.

### Audit des frontières de tête — 28 septembre 2026

L'auteur constate de nouvelles cassures de tête après les corrections
précédentes et demande de vérifier les changements de propriété des canaux,
sans lissage local. La scène Avatar principale n'utilise pas `avatar-motion` :
les réglages de vitesse et d'entrée de la marche dédiée ne peuvent pas être
leur cause directe. La suite existante du coordonnateur et des composants
passe (`46/46`), mais elle ne contrôle pas la continuité entre les deux côtés
de chaque frontière.

L'audit en lecture seule des échantillons mood et des motions de geste révèle
un écart avant la correction de regard : à l'entrée de `nod_yes`, la valeur
spontanée `headRotateX` vaut environ `-0,01212` à `3899 ms`, tandis que le
premier échantillon du geste lui substitue `0` à `3900 ms`. Un premier calcul
isolé suggérait aussi une rupture à l'entrée de `bow`, mais le passage réel
par `avatar-gesture` la dément : son raccord avec l'action précédente conserve
`bodyRotateX` autour de `0,03267` à `17300 ms`. Les autres entrées de la scène
ne revendiquent pas ces canaux au même instant. Dans un balayage
de la seule couche mood à pas de `10 ms`, aucun des six canaux de rotation
tête/corps ne varie de plus de `0,00265` rad entre deux échantillons ; cela
n'exclut pas un autre défaut après composition. Les valeurs rapportées ici ne
sont pas une mesure du quaternion final du modèle dans Safari.

Le mécanisme est dans la composition commune : les canaux numériques d'un
geste sont initialisés depuis zéro. Le premier geste ne conserve pas l'action
initiale relâchée dans son historique ; son poids vaut donc `1` dès sa première
frame et `applyFixedLayer()` retire la valeur spontanée. Les actions suivantes
passent par le raccord commun de `avatar-gesture`, qui part de la valeur à leur
frontière. La correction doit rendre ce raccord cohérent pour la première
action et les suivantes, puis mesurer les
contributions et le quaternion final immédiatement avant, à et après les
entrées, sorties et interruptions sur une fixture autonome, puis vérifier
Play, Seek, replay et Safari sur le modèle réel. La tranche reste **En cours**.

Le test autonome a d'abord reproduit l'entrée fautive avec une valeur
spontanée de tête de `-0,05421` rad : le premier geste présentait `0` à sa
date de départ. `avatar-gesture` conserve maintenant son état initial dans
l'historique, afin que le premier geste utilise le même raccord daté que les
suivants. Le contrôle du quaternion final avec regard caméra a ensuite révélé
un autre défaut au `release` d'un hochement : les morphs restaient continus,
mais la tête sautait de `0,371` rad, parce que le marqueur `headMove: 0` du
geste cessait instantanément de remplacer la force du perso `avatar-gaze`.
Le coordonnateur laisse désormais cette force au regard. Le contact caméra
temporaire des gestes emoji reste conservé, conformément à la décision de
fidélité TalkingHead de la section 18.

Enfin, le raccord commun utilisait un poids unique pour tous les morphs : un
`bow` arrivant pendant la sortie d'un autre geste retirait environ `0,0087`
rad de `bodyRotateX` spontané dès sa première frame. Le raccord transmet
maintenant une part de propriété par canal, puis le coordonnateur compose
chaque canal avec sa propre part. Les tests autonomes couvrent l'entrée du
premier geste, le retour en Seek, la conservation d'un geste initial auteur,
la propriété du regard et le quaternion final sur une entrée, une sortie
interrompue, un nouveau geste et un second `release`. Les tests ciblés passent
(`51/51`). La suite `component-v2` passe (`129` tests, `17` fichiers), ainsi que
les typechecks du composant et des démos, le build des démos et
`git diff --check`.

Dans Safari TP, la scène réelle se charge et le modèle reste visible en Seek
à `3900` et `5600 ms`. Le framebuffer à `3900 ms` produit la même empreinte
(`3438449930`) après Seek arrière et après rechargement. Un redimensionnement
change la résolution du canvas de `1440×960` à `1440×620`, avec modèle présent,
puis la rétablit. La lecture réelle a démarré à `3890 ms`, mais le temps n'a
pas avancé dans cette session Safari suspendue ; sa fluidité perceptive reste
à contrôler avant de déclarer la tranche stabilisée.

### Ouverture de bouche concurrente avec le lip-sync — 28 septembre 2026

L'auteur observe une bouche maintenue ouverte autour de `15000 ms` pendant la
parole. À cette date, la scène est revenue à `neutral` depuis `8800 ms` ; le
geste `celebrate`, démarré à `14400 ms`, contribue simultanément
`mouthSmile`, `mouthOpen` et `jawOpen`. Le cue de silence `14860–15060 ms`
ramène les visèmes à zéro, mais la couche lip-sync ne revendiquait pas les deux
ouvertures laissées par le geste. La frontière auteur déjà fixée en section 43
est que le visème nul referme la bouche sans retirer le sourire ni changer les
autres comportements.

La correction reste dans la timeline `avatar-lip-sync` : elle présente
`mouthOpen = 0` et `jawOpen = 0` avec ses visèmes, y compris au silence. La
priorité existante des morphs de parole sur ceux de geste suffit ; le geste
conserve `mouthSmile` et ses canaux corporels. Un test autonome compose les
deux ouvertures et le sourire d'un geste avec un visème parlé puis nul, puis
compare Play et Seek sur le moteur morphique réel. La scène Avatar sert à
contrôler l'articulation sur le modèle chargé autour de `15000 ms`, avec le
reste de la séquence et le rechargement. Le code se limite au composant
lip-sync et à ses tests. La validation couvre les frontières du composant et
la scène réelle.

Le test a d'abord échoué au silence : la frame lip-sync ne contenait que les
visèmes à zéro. Après correction, les `50` tests ciblés et les `130` tests de
la suite `component-v2` passent, ainsi que les deux typechecks, le build des
démos et `git diff --check`. Dans Safari TP, le modèle montre la bouche fermée
et le sourire de `celebrate` à `15000 ms`. La lecture réelle traverse cette
zone ; les Seek `14800 → 15000 → 15100 → 14800 → 15000 ms` redonnent les mêmes
images pour chaque date répétée. Après rechargement, l'image à `15000 ms`
garde la même empreinte (`1853715325`). La correction ne modifie ni taille,
hiérarchie, reparentage, placement, ni persistance : elle ajoute deux morphs
fixes à la contribution existante du lip-sync. La tranche Avatar globale
reste **En cours** pour les autres validations perceptives de l'auteur.

### Relecture de cohérence du premier Seek — 29 septembre 2026

La revue Safari TP de `?demo=avatar-motion` retrouve la divergence entre la
première présentation après chargement et les suivantes. Après rechargement,
le canvas est vide à `0 ms` (défaut asynchrone déjà documenté plus haut).
Les Seek `700 → 1300 → 1900 → 700 → 1300 → 1900 ms` donnent ensuite des
captures différentes entre le premier et le second passage à chaque date.
Une comparaison des pixels à taille constante (`1440 × 884`) situe les écarts
sur les yeux : respectivement `104`, `113` et `140` pixels modifiés, dans des
rectangles de moins de `42 × 17` pixels. Une fois ces dates revisitées, les
captures restent identiques lors des Seek répétés. Un premier Seek direct à
`1300 ms` reproduit aussi une différence après retour à cette date. Ce
résultat corrige la portée du contrôle antérieur qui annonçait des images
identiques : l'égalité ne tient pas encore pour la première présentation.

Le coordonnateur emprunte effectivement deux chemins : quand `lastTimeMs` est
absent, sa première présentation appelle `animate(0, timeMs)` ; un retour
arrière appelle `prepareSeek()` puis `commitSeek(timeMs)`, qui force tous les
morphs à leur cible. Leur effet exact sur les yeux reste à isoler. Aucun
réglage de scène ni lissage n'est retenu sur cette seule observation. La
prochaine validation doit comparer
les valeurs des morphs oculaires, la pose de tête et l'état du regard à une
date obtenue en premier Seek, en Play et après un retour Seek, sur une fixture
autonome puis sur le modèle réel. La tranche reste **En cours**.

La revue des coûts repère aussi trois trajets à mesurer après cette correction :
reconstruction de l'historique sémantique à chaque présentation dans le
coordonnateur, renouvellement des bindings du mixer à chaque échantillon de
clip et calcul des bornes locales pour l'équilibre hanches/pieds. Aucun cache
n'est décidé sans profilage et sans preuve de l'égalité Play/Seek/replay aux
frontières de propriété des canaux.

### Proposition de correction structurelle — 29 septembre 2026

> Statut : **En cours**. L'auteur a demandé une démonstration et du code pour
> l'évaluation live en Play et la reconstruction en Seek. La première tranche
> concerne les transitions `avatar-mood` et les marqueurs squelettiques.

La décision de l'auteur du 29 septembre révise le critère global d'identité
Play/Seek ci-dessus : le Seek est un outil de diagnostic pour l'auteur. Il doit
retrouver les instructions et une pose visuellement assez proche du Play pour
ne pas fausser le diagnostic ; l'identité pixel par pixel n'est pas exigée.
Le Play sans cassure ni régression visible est prioritaire. TalkingHead reste
la référence de comportement, notamment son intégration des ressorts avec le
`dt` effectivement reçu. Aucun autre algorithme de ressort ni calendrier de
pas n'est décidé. Si une reconstruction Seek fidèle à TH ne peut être obtenue
sans écart de construction nuisible au Play, cette question reste ouverte pour
le moment. Cette révision ne relâche pas les égalités exactes déjà établies
pour les contributions datées déterministes (visèmes, mood, geste, regard et
clips), ni l'obligation de tester leurs frontières.

En Play, chaque composant doit écarter du calcul courant les contributions
terminées, tout en conservant leur effet final lorsqu'il sert de source à une
transition suivante. Au Seek, rejouer le parcours nécessaire est admis. Les
visèmes conservent toutes les enveloppes simultanément actives, car l'arrivée
d'un visème ne termine pas nécessairement la sortie du précédent.

Le profilage seul ne résout pas l'écart de construction. Trois faits du code
doivent guider la correction : le premier `applyAt(t)` après `attachEngine()`
appelle `animate(0, t)`, alors qu'un retour Seek appelle `prepareSeek()` puis
`commitSeek(t)` ; `MorphEngine.update(0)` peut laisser un canal dépendant
marqué `needsUpdate` sans réappliquer sa limite, tandis que `snapAll()` force
toutes les valeurs ; `resetSemantic()` rend la reconstruction de l'historique
des poses obligatoire à chaque présentation actuelle. La dépendance des
paupières envers le regard vers le bas et les sourcils est une piste causale
précise pour les pixels observés, à confirmer sur les valeurs internes.

1. Établir une trace autonome du premier `applyAt(t)`, d'un Play, d'un retour
   Seek et d'un rechargement : cibles, valeurs appliquées, indicateurs de mise
   à jour et limites des morphs oculaires, pose de tête, correction de regard,
   clip et déplacement racine. Isoler gaze, blink et motion sans changer la
   scène d'acceptation. Le test doit échouer sur la première présentation si
   ses valeurs diffèrent de la reconstruction au même `t`.
2. Normaliser la construction d'une frame Avatar : mêmes contributions datées,
   mêmes priorités et mêmes dépendances de morphs pour une première présentation,
   Play et Seek. Résoudre les canaux dépendants à partir d'un état cohérent
   avant l'écriture des morphs et des os ; retirer le rôle de `snapAll()` comme
   substitut à une transition temporelle. Garder `avatar-coordinate` seul
   propriétaire de la pose finale et le commit Three après cette pose. Quand
   les données changent à temps égal, le commit commun doit repeindre après
   l'application du contenu modifié, même si `[temps, largeur, hauteur]` ne
   change pas.
3. Construire l'état Avatar au fil des instructions réellement reçues, sans
   lecture préalable de la scène entière ni connaissance des instructions
   interactives futures. À l'arrivée d'une instruction datée, échantillonner
   l'état courant à sa date, puis enregistrer les seules transitions et tâches
   encore actives avec leur source, cible, début, durée et graine déterministe.
   Une présentation à `t` évalue cet état avec les données actualisées à `t` ;
   elle ne rejoue pas tout l'historique en Play. CodPlay remet les eventimes
   auteur lorsqu'ils deviennent dus et les instructions interactives
   lorsqu'elles sont émises. Un saut en avant doit traiter toutes les
   instructions effectivement survenues jusqu'à `t` avant la présentation.
   Un Seek ou replay reconstruit le même état en rejouant uniquement le journal
   des instructions réellement
   reçues jusqu'à `t`, puis utilise le même évaluateur. Une action interrompue
   repart de la valeur échantillonnée à sa date, jamais de la dernière frame
   peinte. Les contributions datées déterministes ne doivent pas intégrer
   librement `deltaMs` ; les ressorts TH conservent leur intégration native
   avec le `dt` du Play selon la révision ci-dessus. La prescription actuelle de
   `avatar-gesture-spec.md` de rejouer à chaque présentation devra être revue
   avant le code.
4. Faire du preload la barrière de disponibilité du modèle : il ne réussit
   qu'une fois les ressources Avatar utilisables, avant la création de
   l'instance et le démarrage du player. Le runner et la démo attendent déjà
   `preload.load()` avant leur initialisation ; c'est la stratégie Three qui
   annonce prématurément la réussite après le seul téléchargement des octets.
   `AvatarComponent.initialize()` lance alors `GLTFLoader.parse()` sans
   l'attendre, si bien que la première présentation peut précéder le modèle.
   Le contrat `third-party-threejs-spec.md`, qui prescrivait ce partage entre
   téléchargement et parsing, est corrigé pour faire du preload la barrière de
   décodage. Le manifeste reste indexé par URL : le document décodé est partagé
   comme source immuable, et chaque instance en construit une copie privée
   pendant son initialisation synchrone. La pose à `0 ms` passe par le commit
   commun ; aucun refresh direct du composant n'est nécessaire.

   **Décision validée le 29 septembre 2026 :** la stratégie Three.js
   prépare sous chaque URL la scène GLB décodée avec ses textures et clips,
   ou les clips d'un FBX d'animation. Une instance Avatar clone synchroniquement
   la scène GLB préparée
   avant sa première présentation, avec géométries et matériaux privés, et
   associe les clips décodés du même cache. Le clone conserve la relation de
   squelette partagée par les maillages qui la partageaient dans la source.
   L'essai isolé de `SkeletonUtils.clone` a montré que cette relation est
   scindée alors que les os clonés restent communs : il faut donc réunifier
   ces squelettes avant le retargeting. Le preload reste la seule barrière de
   chargement et le commit Avatar existant présente la pose à `0 ms` ; aucun
   nouveau circuit du core n'est proposé. L'acceptation devra prouver deux
   instances indépendantes, la conservation de la topologie et du cadrage,
   les morphs mixtes et le retarget privés, les clips externes FBX/GLB, la
   libération d'une instance sans effet sur l'autre, le premier rendu à
   `0 ms`, Play, Seek, rechargement et Safari TP. Aucun changement du core
   CodPlay n'est prévu pour cette tranche.

L'acceptation exige l'égalité des contributions datées déterministes et une
cohérence visuelle diagnostique des ressorts TH à
`t = 0` puis avant, pendant et après les frontières mood, gesture, gaze et
motion, pour premier passage, Play à plusieurs cadences, Seek direct/arrière,
replay, rechargement et instruction interactive reçue pendant la lecture ou
à temps inchangé pendant une pause. Le Seek doit retrouver l'état antérieur à
cette instruction ou son effet selon la date demandée, sans inventer une
instruction future. Vérifier d'abord que le Play reste fluide et fidèle à TH,
puis la continuité de la tête, l'articulation
lip-sync et le regard sur le modèle réel, ainsi que resize, lifecycle,
parent/enfant, reparentage, persistance, tests autonomes, typechecks, build et
Safari TP selon les frontières effectivement touchées. Aucun gain de
performance ne clôt cette tranche si l'égalité ou la continuité régresse.

La première tranche conserve la transition courante de `avatar-mood` entre
deux instructions et n'applique chaque marqueur squelettique qu'une fois en
Play. Un Seek, ou une modification rétroactive des marqueurs reçus,
reconstruit l'état depuis les mêmes événements datés. Les tests autonomes
prouvent qu'une transition mood interrompue donne les mêmes valeurs après
Seek, qu'une frame Play supplémentaire ne recrée pas sa timeline, qu'une action
mood interactive reçue à temps inchangé part de la valeur alors affichée, et
qu'un geste natif n'est appliqué qu'une fois en Play puis reconstruit à la même
pose après Seek. Les 133 tests et le typecheck de `@codplay/component-v2`, le
typecheck et le build des démos, ainsi que `git diff --check` passent. Dans
Safari TP, la scène Avatar a joué les événements `avatar:mood:happy @4600 ms`
et `avatar:gesture:release @5400 ms` dans le player réel. Après rechargement,
les Seek `5590 → 7000 → 5590 ms` ont produit la même empreinte PNG du canvas
à `5590 ms` (`827904826`). La comparaison visuelle stricte entre Play et Seek
à la même date reste ouverte : le slider de cette démo quantifie ses valeurs
par pas de `10 ms`, et l'écart oculaire du premier Seek demeure à isoler.
La correction des morphs oculaires et le preload complet restent dans les
étapes ouvertes ci-dessus. La tranche globale reste **En cours** jusqu'à la
validation Play et Seek sur le modèle réel selon le critère révisé plus haut,
et jusqu'aux autres frontières d'acceptation.

La reprise du 29 septembre réduit les calculs répétés en Play dans la branche
de travail courante : les raccords des occurrences mood reçues sont conservés ;
gaze et gesture échantillonnent l'action sélectionnée avec un curseur temporel ;
lip-sync ne parcourt plus que les enveloppes encore actives. Les tests ciblés
vérifient les interruptions de gaze et de gesture ainsi que les visèmes
recouvrants après un Seek arrière. Les 137 tests `component-v2`, ses typechecks,
le typecheck et le build des démos V2 et `git diff --check` passent. Dans Safari
TP, le Play réel présente le modèle et les actions jusqu'à `13752 ms`, puis la
pause conserve une pose. Ce parcours ne prouve pas à lui seul l'absence de
cassure de tête sur toutes les frontières. À `0 ms` après un chargement frais,
le canvas reste vide tant qu'aucune présentation ultérieure n'a lieu : la
frontière preload décrite plus haut demeure un défaut bloquant pour une entrée
en Play sans écueil.

La tranche suivante supprime aussi la refusion des marqueurs squelettiques à
chaque frame et garde, par occurrence mood, les cycles TH courants de
respiration, tête, yeux et bouche, les tâches de tête encore actives et le
prochain changement de pose. Les tâches finies sont retirées de la liste active ;
leurs libérations oculaires restent datées dans le flux nécessaire à la boucle
des yeux. Les anciens marqueurs et cycles sont rejoués pour un Seek
ou une révision rétroactive des instructions. Un test dense compare le Play et
la reconstruction sur 30 s, trois graines et les recouvrements de tâches de
tête. Il a exposé une dépendance rétroactive : la fin d'une tâche oculaire
modifiait la source d'une tâche de tête déjà créée. La libération oculaire est
maintenant datée dès la création de la tâche et le même calcul causal sert en
Play et au Seek. Un test autonome vérifie qu'un mood ajouté pendant le Play ne
réapplique pas les gestes antérieurs. Les 141 tests `component-v2`, les
typechecks `component-v2` et démos, le build V2 et `git diff --check` passent.
Safari TP présente le modèle en Play puis au Seek à `5400 ms` ; après resize,
le backing store du canvas suit ses dimensions CSS au facteur de pixels `2` et
la pose reste affichée.

Le défaut historique du canvas vide à `0 ms` est traité par la décision du
point 4. La comparaison diagnostique des yeux en premier Seek et le parcours
complet des frontières navigateur restent ouverts. La reconstruction exacte
des ressorts au Seek n'est pas poursuivie dans cette tranche, conformément au
critère révisé. **Statut global : En cours.**

### Disponibilité du modèle dès `0 ms` — 29 septembre 2026

Les stratégies `three-glb` et `three-fbx` attendent maintenant le décodage du
document et des clips avant de résoudre le preload. Une ressource invalide
fait échouer ce preload. `Avatar.initialize()` instancie synchroniquement la
source décodée ; le premier `update()` attache le modèle avant le flux de
contenu Avatar et le commit Three déjà utilisés par CodPlay. Aucun callback
de refresh, horloge ni rendu direct n'est ajouté. Le contrat Three.js, le guide
d'utilisation et l'API interne de chargement Avatar sont alignés.

La copie privée restaure le partage des squelettes entre les maillages qui le
partageaient dans la source, puis clone la géométrie de chaque maillage : les
morphs mixtes et le retarget peuvent ainsi la modifier sans toucher une autre
instance ou appliquer deux fois une mutation à une géométrie partagée. Les
matériaux sont privés par instance. Les tests autonomes vérifient deux
instances, leur squelette interne, leurs os et morphs indépendants, le décodage
GLB/FBX, l'erreur de décodage, l'abandon et le premier échantillon à `0 ms`
après preload. Les 145 tests `component-v2`, le typecheck du package et des
démos, le build V2 et `git diff --check` passent.

Dans Safari TP, la scène `avatar-motion` suit le vrai preload GLB + FBX et le
player commun : à `ready` et `0 ms`, le canvas contient une image non vide
(échantillon central `[17,24,39,255]`, empreinte 64 × 64 `1388442`). Un Seek à
`1900 ms` donne une autre image, puis le retour à `0 ms` retrouve la même
empreinte. Le resize change le backing store de `1440 × 674` à `1440 × 744`
et conserve l'image ; le rechargement de l'instance présente encore l'avatar à
`0 ms`. Le Play n'avance pas dans cet onglet Safari masqué par le connecteur
(`document.visibilityState === 'hidden'`) ; cette observation ne valide donc
pas sa cadence. **Tranche de disponibilité du modèle implémentée et testée ;
statut Avatar global : En cours.**

La mention précédente d'un preload audio bloquant la démo Avatar complète
était prématurée. Après un chargement frais de cette démo dans Safari TP, le
player atteint `ready` à `0 ms` avec son canvas ; l'audio adopté est à
`readyState=4`, `networkState=1`, sans erreur, et `currentTime` avance après
`Lire`. La stratégie audio attend `canplaythrough` conformément au contrat
V1/V2 et le preload possède un délai maximal de `10 000 ms` par ressource.
Un chargement audio indépendant, avec une URL de contrôle non mise en cache,
reçoit `loadedmetadata` à `27 ms`, puis `loadeddata`, `canplay` et
`canplaythrough` à `35 ms`, également dans l'onglet masqué.
Aucun défaut du preload audio n'est reproduit par ce contrôle ; aucun correctif
core ni changement de scène n'est justifié. Le seul constat Play non résolu
dans cette session est la suspension des frames du player quand l'onglet du
connecteur est masqué, malgré la progression de l'audio natif. La validation
visuelle Play dans un onglet actif reste ouverte.
