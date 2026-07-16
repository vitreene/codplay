# Plan — motions semantiques pour `avatar3d`

Statut : implementation progressive demarree. Le composant `avatar3d` fait partie des capacites core en approche v1 : toute nouvelle modification de `packages/codplay` core doit rester consequence d'une decision explicite et d'un plan agree.

## 0. Avancement implementation

Fait le 2026-07-15 :

- `RuntimeComponentUpdateInput` expose maintenant `eventMs` et `isSeekReplay` aux composants.
- `ServiceApplyContext` expose aussi `eventMs`, pour les services appliques pendant une update.
- `RendererFacade.tick()` propage le `eventMs` deja calcule depuis les commits vers `RuntimeComponentOrchestrator.routeUpdates()`.
- `TweenRunner` transmet maintenant `eventMs` et `isSeekReplay` aux updates qu'il genere pendant l'evaluation continue.
- `avatar3d` supporte un premier cas d'action continue locale : `viseme` avec `endMs` ou `durationMs`.
- Resolution viseme : `endMs` est prioritaire sur `durationMs`; sans fenetre temporelle, le comportement instantane existant est conserve. Les visemes continus reprennent les prereglages TalkingHead (`modules/talkinghead.mjs`) : `PP`/`FF` a `0.9`, autres visemes a `0.6`, pic au milieu du cue et release jusqu'a `end + duration/2`, avec chevauchement possible entre cues.
- Mapping Rhubarb : la table A-H/X vers visemes TalkingHead/Oculus est centralisee dans `packages/demos/src/scenes/avatar-data/rhubarb-viseme-map.ts` et partagee entre `avatar-poc-1` et la demo Rive. Elle corrige l'ancien mapping avatar (`B -> null`, `C -> aa`, etc.) qui creait des trous et des visemes incorrects.
- Catalogue MotionEngine : la source de reference est `https://github.com/lhupyn/motion-engine`. Le catalogue integre `avatar3d` a ete etendu avec des entrees morph/bone compatibles issues de `src/motions_th.json` (`neutral_face`, `smug`, `grin`, `open_grin`, `squint_smile`, `beam`, `crying_laugh`, `disappointed`, `side_glance`, etc.). Les gestes et overlays restent exclus du jeu effectif tant que leurs couches ne sont pas implementees.
- Support matrix : `resolveAvatar3DMotionSupport()` et `resolveBuiltinAvatar3DMotionSupport()` exposent `supported | partial | unsupported`, avec liste des canaux/features non supportes. Le runtime filtre aussi les canaux absents du modele courant et reporte un warning au lieu d'envoyer des no-op silencieux a `MorphEngine`.
- Seek : `_prepareSeek()` reset l'etat continu local; les events rejoues reconstruisent la fenetre active; `_seek(info.timelineMs)` evalue ensuite le viseme a la position cible.
- `avatar3d` possede maintenant un lecteur `motion` minimal dans `src/semantic-motion/`.
- Le lecteur supporte les motions inline ou referencees par `initial.motions`, limitees aux canaux numeriques `vs` compatibles avec `MorphEngine` / bone-morphs existants.
- Le lecteur ignore avec warning les canaux non supportes par l'avatar courant; gestures parametrees, overlays et moods MotionEngine restent hors de ce premier patch.
- Un sous-catalogue integre morph-only est disponible via `BUILTIN_AVATAR3D_MOTIONS` et `listBuiltinAvatar3DMotionNames()`.
- Les motions integrees sont adaptees de `lhupyn/motion-engine/src/motions_th.json` avec attribution MIT dans le fichier source; `initial.motions` surcharge les entrees integrees de meme nom.
- La demo `packages/demos/src/scenes/avatar-poc-scene.ts` utilise maintenant les visemes continus (`endMs`) et montre des motions integrees apres la phrase audio (`warm_smile`, `nod`, `head_shake`). Elle est visible via `?demo=avatar-poc-1`.
- `avatar:mood` supporte maintenant `durationMs` / `endMs` dans `avatar3d`. Sans timing, le mood reste instantane; avec timing, les baselines sont interpolees dans `_tick()` / `_seek()` et reconstruites depuis la timeline CodPlay.
- `avatar:morph` supporte maintenant aussi `durationMs` / `endMs` via `AvatarDirectMorphController`. Les morphs directs continus sont echantillonnes par `timelineMs`, composes avec les autres couches, puis appliques par `AvatarPoseApplier`. La demo d'isolation valide `jawOpen` en ouverture/fermeture progressive.
- Ordre d'application runtime cible : comportements automatiques engine, mood interpole, gaze, motion semantique, viseme continu, render. Les motions tete/yeux priment donc sur gaze/head-drift, et les visemes priment sur la bouche.
- Les lecteurs `motion`, `mood` et `morph` continu appliquent maintenant les valeurs actives comme des echantillons directs de timeline en play comme en seek. La douceur vient de la courbe echantillonnee elle-meme, pas de `MorphEngine.update()`. Le relachement d'une motion en lecture reste lisse (`setFixed(null)`), tandis que le seek reconstruit l'etat par snap.
- Diagnostic courant : la continuite `avatar:morph` prouve que la boucle timeline/render fonctionne. Le saut percu sur `avatar:mood` venait d'un probleme specifique a la couche mood/paupieres : `sleep` exposait a la fois `eyeBlinkLeft/right` et l'alias `eyesClosed`, qui ciblent les memes slots. La pose mood composee ignore maintenant les alias dont les cibles directes sont deja presentes dans les moods.
- Correction composition auto/mood : `AvatarAutoMotionController` n'emet plus `eyesClosed: 0` hors clignement. La couche blink ne force donc plus les yeux ouverts et ne masque plus les moods de paupieres.

Encore a faire : extension du catalogue MotionEngine au-dela du sous-ensemble morph-only, couverture gestures, baselines/moods et overlays/poseDelta.

## 13. Reprise V2 : adaptation MotionEngine/TH, pas reinvention

Le prototype actuel a revele un ecart conceptuel : plusieurs lecteurs (`mood`, `motion`, viseme, gaze/head-drift/blink) ecrivent directement dans `MorphEngine`. Cette approche produit des divergences `play` / `seek` et des conflits d'ordre. Elle ne correspond pas au modele TH/MotionEngine, ou les couches avatar sont evaluees puis composees avant application.

La V2 doit donc etre une adaptation de la logique MotionEngine/TH sous contrainte CodPlay, pas une nouvelle semantique propre a CodPlay.

Contraintes CodPlay a respecter :

- les actions arrivent via `RuntimeComponentUpdateInput` ;
- le temps de declenchement est `eventMs` ;
- l'evaluation runtime utilise `timelineMs` ;
- `play(t) = seek(t)` ;
- le composant `avatar3d` reste autonome cote rendu.

Ce qui ne doit pas etre reinvente :

- la notion de catalogue de motions ;
- les tracks morph/bone/gesture ;
- les moods comme couche de fond ;
- les overlays/poseDelta ;
- la composition finale des couches avant application.

### 13.1 Surface API a conserver

Les actions auteur actuelles restent valides :

- `avatar:viseme` ;
- `avatar:morph` ;
- `avatar:gesture` ;
- `avatar:gaze` ;
- `avatar:mood` ;
- `avatar:blink` ;
- `avatar:head-drift` ;
- `avatar:breathe` ;
- `avatar:motion`.

Extensions conservees :

- `durationMs` / `endMs` ;
- `motion: string | object` ;
- `initial.motions` comme catalogue local ;
- catalogue integre avec listing auteur.

### 13.2 Separation composant / metier

`Avatar3DBaseComponent` ne doit contenir aucune logique metier de motion. Son role cible :

- creer le canvas, la scene Three.js, la camera et `AvatarEngine` ;
- creer une instance `Avatar3DSemanticRuntime` ;
- transmettre `update(input)` au runtime ;
- transmettre `_tick`, `_prepareSeek`, `_seek`, `_stop` au runtime ;
- rendre la frame.

Toute logique de parsing, evaluation, composition, priorite et application doit vivre dans des classes testables separees.

### 13.3 Dossier cible

```txt
packages/authoring/components/avatar3d/src/semantic-runtime/
```

Classes cible :

- `Avatar3DSemanticRuntime` : facade metier appelee par le composant ;
- `AvatarMotionEngineAdapter` : convertit le catalogue MotionEngine/TH vers des tracks internes ;
- `AvatarMoodController` : moods, transitions, baselines ;
- `AvatarDirectMorphController` : actions `avatar:morph` directes, instantanees apres transition ou continues via `durationMs` / `endMs` ;
- `AvatarSpeechController` : visemes et lipsync continu ;
- `AvatarGestureController` : gestures TH/MotionEngine, parametres et release ;
- `AvatarAutoMotionController` : blink/head-drift/breathe/gaze comme couches ;
- `AvatarPoseComposer` : compose les sorties de couches ;
- `AvatarPoseApplier` : applique une pose finale unique a `AvatarEngine`.

### 13.4 Statut de `vs`

`vs` est un format d'import MotionEngine et un support temporaire de tests/regression. Il ne doit pas devenir la semantique interne durable.

Modele cible :

```ts
type AvatarMotionTrack =
  | { kind: "morph"; name: string; curve: NumericCurve }
  | { kind: "bone"; name: string; curve: NumericCurve }
  | { kind: "gesture"; gesture: AvatarGestureSpec; curve: GestureCurve }
  | { kind: "overlay"; overlay: AvatarOverlaySpec }
```

Donc :

- `vs` = source/import ;
- `AvatarMotionTrack` = modele metier interne ;
- `AvatarResolvedPose` = sortie composee ;
- `AvatarPoseApplier` = seul endroit qui ecrit dans `MorphEngine` / `GestureEngine`.

### 13.5 Implementation progressive

Phase V2.1 : extraire la logique actuelle hors du composant.

- fait : creer `Avatar3DSemanticRuntime` ;
- fait : creer `AvatarSpeechController` ;
- fait : faire deleguer `Avatar3DBaseComponent` au runtime ;
- fait : garder temporairement `Avatar3DMoodPlayer` et `Avatar3DMotionPlayer` derriere le runtime ;
- fait : aucun parsing `vs`, mood ou viseme dans le composant.

Phase V2.2 : remplacer les players temporaires par des controllers purs.

- fait pour mood/motion/speech : `evaluate(timelineMs)` retourne des sorties metier ;
- fait pour morph direct continu : `AvatarDirectMorphController` gere `durationMs` / `endMs` et conserve la compatibilite des morphs instantanes apres une transition ;
- fait : les motions catalogue exposent un statut de support et le runtime filtre les canaux non disponibles sur l'avatar courant ;
- fait : `AvatarPoseComposer` compose les sorties avant application ;
- fait : `AvatarPoseApplier` est le seul point d'ecriture pour les sorties composees ;
- fait : migrer head-drift et blink vers `AvatarAutoMotionController` comme couche pure ;
- reste : migrer gaze/breathe/gesture vers des controllers/layers purs ;
- reste : supprimer les anciens players temporaires une fois la migration terminee.

Phase V2.3 : importer/adaptater le catalogue MotionEngine/TH complet.

- garder metadata `_description`, `_tags`, `_track` ;
- produire une matrice de support `supported | partial | unsupported` ;
- ne pas masquer les entrees non supportees.

Phase V2.4 : gestures et overlays.

- adapter les gestures parametrees (`["handup", null, true]`, cote, release) ;
- adapter `OverlayManager` / `poseDelta` ;
- mapper vers les bones disponibles.

Phase V2.5 : generalisation third-party.

- extraire le protocole commun seulement apres validation avatar ;
- tester avec Rive lipsync continu.

## 1. Objectif

Ajouter a `@codplay/avatar3d` la capacite de reconnaitre et jouer des motions semantiques inspirees de `lhupyn/motion-engine`, sans importer le package externe.

La source externe est un catalogue et une implementation derivee de TalkingHead. CodPlay ne doit pas integrer ce runtime tel quel : `avatar3d` utilise deja `@codplay/avatar-engine`, son propre `MorphEngine`, son `GestureEngine`, son cycle `update()` et son `RenderAdapter`.

L'objectif est donc :

- recuperer les idees, les donnees et les algorithmes utiles de `motion-engine` ;
- les adapter au composant CodPlay existant ;
- permettre aux `persos` et aux `eventimes` de porter les motions a jouer ;
- garder CodPlay comme source unique du temps, du seek, du stop et du replay ;
- utiliser `avatar3d` comme prototype concret d'une capacite plus large : les actions continues necessaires aux composants third-party, dont Three.js, Rive, Lottie et les futurs bindings de rendu.

## 2. Non-objectifs

- Ne pas ajouter `motion-engine` comme dependance npm ou import runtime.
- Ne pas brancher `MotionEngine` sur une instance TalkingHead : `avatar3d` n'est pas TalkingHead.
- Ne pas deplacer la decision d'animation dans le LLM ou dans une boucle externe.
- Ne pas contourner le modele temporel CodPlay en ajoutant manuellement `startAt` dans `event.data`.
- Ne pas ajouter FaceMirror / MediaPipe dans la premiere phase : FaceMirror sert a lire la webcam avec MediaPipe pour detecter les expressions de l'utilisateur, puis produire une reaction avatar (`_detect` / `_react`). Dans CodPlay, cette capacite releve plutot d'un futur projet editor : permettre a l'utilisateur d'enregistrer des comportements ou expressions, puis de les relire ensuite dans `avatar3d`. Ce n'est pas le meme chantier que l'integration du catalogue de motions.

## 3. Source externe a recuperer

Depot analyse : `https://github.com/lhupyn/motion-engine`.

Elements utiles :

- `src/motions.json` : catalogue principal, 98 motions.
- `src/motions_th.json` : sous-catalogue plus proche des morphs/gestes TalkingHead.
- `src/utils.js` : extraction de baselines pour moods.
- `src/OverlayManager.js` : logique d'oscillation osseuse, a adapter plus tard a `boneMap` Three.js.

La recuperation doit se faire par copie/adaptation dans le depot CodPlay, avec attribution MIT explicite dans les fichiers concernes. Les donnees doivent etre converties en TypeScript ou JSON local stable, puis auditees pour compatibilite avec `@codplay/avatar-engine`.

## 4. Etat actuel de `avatar3d`

Le composant recoit les actions CodPlay dans `update({ action, eventMs, eventSeq, isSeekReplay })`.

Actions deja supportees :

- `avatar:viseme` → `viseme` ;
- `avatar:morph` → `{ name, value, snap? }` ;
- `avatar:gesture` → `gesture` ;
- `avatar:gaze` → `enabled` ;
- `avatar:mood` → `mood` ;
- `avatar:blink` → `blink` ;
- `avatar:head-drift` → `headDrift` ;
- `avatar:breathe` → `breathe`.

Le `RenderAdapter` de `createAvatar3DBinding()` appelle deja :

- `_tick(info)` pour avancer et rendre ;
- `_prepareSeek()` avant replay de seek ;
- `_seek(info)` apres replay ;
- `_stop()` au stop.

Ces hooks montrent que `avatar3d` possede deja des traitements continus internes : blink, head-drift et breathe sont declenches par des actions CodPlay, puis evoluent sur plusieurs frames via `AvatarEngine.animate(...)`.

Ils ne passent pas par le contrat generique `ContinuousAnimationEngine` du coeur. Ils sont donc deja une forme d'action continue locale au composant, mais leur statut n'est pas explicite et leur contrat n'est pas encore generalise aux autres actions temporelles du composant.

Ces comportements doivent evoluer : blink, head-drift et breathe ne doivent pas rester des fonctions speciales branchees par strap ou helpers ad hoc. Ils doivent rejoindre le catalogue d'expressions/motions et fonctionner par le meme mecanisme d'action continue que les motions semantiques. Les helpers actuels peuvent rester transitoires, mais le modele cible est catalogue + action nommee + evaluation temporelle CodPlay.

Le point critique du chantier est de rendre cette capacite explicite dans `avatar3d` : une action recue dans `update()` doit pouvoir enregistrer une animation interne continue, puis cette animation doit etre evaluee par `_tick(info)` et reconstruite par `_seek(info)` avec la meme garantie que les animations core : `play(t) = seek(t)`.

Cas visemes : le comportement instantane `avatar:viseme` reste supporte. Quand l'action contient `endMs` ou `durationMs`, `avatar3d` l'enregistre comme viseme continu local et l'evalue dans `_tick()` / `_seek()` a partir de la timeline CodPlay.

## 5. Contrat auteur propose

Le format privilegie est : **une action nommee dans le perso, puis un eventime qui declenche cette action avec `data` eventuel**.

Exemple privilegie, motion inline stockee dans l'action nommee du perso :

```ts
{
  id: "avatar",
  type: "avatar3d",
  actions: {
    smile: {
      motion: {
        dt: [300, 1200, 300],
        vs: { mouthSmile: [0, 0.6, 0] }
      }
    }
  }
}
```

L'eventime ne porte alors que le declenchement et les donnees variables eventuelles :

```ts
{ name: "smile", startAt: 1200, data: { intensity: 0.8 } }
```

Exemple privilegie, action nommee qui reference une motion du catalogue :

```ts
actions: {
  wink: { motion: "wink_smile" },
  think: { motion: "thinking" }
}
```

Puis :

```ts
{ name: "wink", startAt: 1200 }
```

Ce format est privilegie car il conserve le role du perso : le composant declare par ses actions ce qu'il sait faire, et les eventimes activent ces actions.

Les formes suivantes restent secondaires, utiles pour tests, generation dynamique ou straps, mais ne sont pas le modele auteur principal.

Ajouter une action semantique :

```ts
"avatar:motion": true
```

Forme secondaire : une action generique `avatar:motion` peut etre referencee par nom :

```ts
{ name: "avatar:motion", startAt: 1200, data: { motion: "warm_smile" } }
```

Forme secondaire : une motion peut etre portee directement par l'eventime :

```ts
{
  name: "avatar:motion",
  startAt: 1200,
  data: {
    motion: {
      dt: [300, 1200, 300],
      vs: { mouthSmile: [0, 0.6, 0] }
    }
  }
}
```

Forme secondaire : une persona peut stocker un catalogue local separe :

```ts
{
  id: "avatar",
  type: "avatar3d",
  initial: {
    src: "/avatars/avatarsdk.glb",
    motions: {
      welcome: {
        dt: [300, 1200, 300],
        vs: { mouthSmile: [0, 0.5, 0] }
      }
    }
  },
  actions: {
    "avatar:motion": true
  }
}
```

Puis l'eventime active la motion stockee :

```ts
{ name: "avatar:motion", startAt: 1000, data: { motion: "welcome" } }
```

Resolution d'une motion par nom :

1. catalogue local `perso.initial.motions` ;
2. catalogue integre `avatar3d` ;
3. warning auteur si introuvable, sans crash runtime.

Le catalogue local doit pouvoir surcharger le catalogue integre pour permettre des variantes projet.

## 6. Format de motion interne

Le format interne doit rester proche de `motion-engine` pour faciliter la recuperation des donnees :

```ts
export type Avatar3DMotion = {
  _description?: string
  _tags?: string[]
  _track?: "action" | "mood"
  dt?: number[]
  rescale?: number[]
  vs?: Record<string, Avatar3DMotionValue[]>
  _overlay?: Avatar3DOverlay
}
```

`vs` represente les valeurs morph/bone/gesture sur une timeline locale.

Exemples de cles deja compatibles avec `MorphEngine` :

- morphs ARKit : `mouthSmileLeft`, `mouthSmileRight`, `eyeBlinkLeft`, `jawOpen`, etc. ;
- alias deja supportes : `mouthSmile`, `eyesClosed`, `eyesLookUp`, `eyesLookDown` ;
- bone morphs deja supportes : `headRotateX`, `headRotateY`, `headRotateZ`, `bodyRotateX`, `bodyRotateY`, `bodyRotateZ`, `handFistLeft`, `handFistRight`.

La cle speciale `gesture` declenche `AvatarEngine.playGesture()` puis `releaseGesture()`.

## 7. Lecteur runtime propose

Ajouter un module dedie :

```txt
packages/authoring/components/avatar3d/src/semantic-motion/
```

Fichiers pressentis :

- `avatar3d-motion-types.ts` ;
- `avatar3d-motion-catalog.ts` ;
- `avatar3d-motion-player.ts` ;
- `avatar3d-motion-utils.ts` ;
- `avatar3d-overlay-player.ts` en phase 2.

`Avatar3DMotionPlayer` recoit :

- `AvatarEngine` ;
- le `boneMap` si overlays actifs ;
- le catalogue local de la persona ;
- le catalogue integre ;
- une fonction de warning auteur si disponible.

Responsabilites :

- resoudre une motion par nom ;
- accepter une motion inline ;
- enregistrer une motion action continue depuis un event CodPlay ;
- appliquer une motion mood persistante ;
- avancer les valeurs a chaque `_tick(info)` ;
- liberer les morphs fixes a la fin d'une action ;
- reconstruire son etat apres seek ;
- nettoyer au stop.

Le lecteur ne doit pas dependre d'un timer propre ni d'un `performance.now()` local. Son unique entree temporelle est `RenderTickInfo.timelineMs` / `RenderSeekInfo.timelineMs`.

## 7.1 Capacite locale d'action continue

Avant d'ajouter le catalogue complet, `avatar3d` doit formaliser une capacite interne minimale :

```ts
type Avatar3DContinuousAction = {
  eventId: string
  actionKey: string
  startMs: number
  durationMs: number
  evaluate(timelineMs: number, mode: "play" | "seek"): void
  stop(reason: "completed" | "interrupted" | "seek-reset" | "stop"): void
}
```

Le composant doit obtenir le temps de declenchement de l'event via le contrat CodPlay. Ce n'est pas une option auteur et ce n'est pas une donnee a dupliquer dans `event.data` : c'est un contrat runtime fondamental. Les traitements idle existants (`blink`, `head-drift`, `breathe`) sont seek-safe parce qu'ils sont recalcules depuis la timeline cible dans `commitSeek(...)`; les motions semantiques, elles, sont declenchees par un event precis et doivent donc recevoir le temps d'application de cet event par le protocole d'action continue.

Si l'API actuelle ne transmet pas encore ce temps au bon niveau, il faut corriger le protocole runtime. Cette correction fait partie du chantier, pas d'un contournement auteur.

Important : le moteur core possede deja un contrat voisin (`ContinuousAnimationEngine`) utilise par `TweenRunner`, mais ce contrat n'est pas encore expose aux `ThirdPartyBinding`.

- Point de depart retenu : adaptation locale dans `avatar3d`, pour tester vite sur un cas concret.
- Objectif garde en vue : elargir ensuite en primitive third-party generique si le prototype le confirme.

Ce point est une reflexion formelle, non normative a ce stade. Le prototype `avatar3d` doit trancher sur du concret avant de figer la spec finale, mais le principe n'est pas ouvert : CodPlay reste l'orchestrateur temporel et fournit les temps necessaires aux actions continues.

## 7.2 Primitive third-party d'action continue

La capacite d'action continue ne doit pas etre limitee a `avatar3d`, ni meme a Three.js. Tout composant third-party qui possede son propre modele d'animation a besoin du meme invariant : `play(t) = seek(t)`.

Cas concernes :

- **Three.js / avatar3d** : morph targets, bones, camera, lights, AnimationMixer, shaders, particules.
- **Rive** : state machines, inputs continus, timelines internes, transitions qui doivent etre resynchronisees au seek.
- **Lottie** : frame courante, segments, markers, progress, expressions ou timelines internes.
- **Futurs bindings** : PixiJS, Spine, Canvas/WebGL custom, moteurs physiques, scenes 3D specialisees.

Le besoin commun n'est pas seulement "recevoir un tick". Un binding third-party doit pouvoir :

- declarer, via le protocole de binding et le type de composant concerne, qu'une action est continue ;
- recevoir le temps de declenchement de l'event (`eventMs`) ;
- enregistrer une instance active ;
- evaluer cette instance a `timelineMs` pendant la lecture ;
- reconstruire cette instance pendant le seek par replay des events ;
- supprimer les instances terminees ou interrompues ;
- cohabiter avec les updates statiques du meme composant.

Le prototype `avatar3d` peut produire une spec third-party generique si le besoin se confirme. Une forme possible, non normative a ce stade :

```ts
type ThirdPartyBinding = {
  components: Record<string, RuntimeComponentClass>
  renderAdapter?: RenderAdapter
  preload?: ThirdPartyPreloadStrategy[]
  services?: ServiceRegisterInput[]
  continuousAnimationEngines?: ContinuousAnimationEngine[]
}
```

Cette piste alignerait les composants third-party sur le chemin deja utilise par `TweenRunner`, au lieu de laisser chaque binding contourner le probleme dans son propre `update()`.

## 7.3 Protocole de declaration third-party

CodPlay possede deja un protocole de declaration pour les bibliotheques tierces : `ThirdPartyBinding`. Le chantier ne doit pas creer un second protocole parallele. Il doit enrichir ce protocole existant, puis specifier precisement comment CodPlay consomme chaque capacite declaree.

Capacites deja declarees par un binding :

- `components` : types de persos fournis par la bibliotheque ;
- `renderAdapter` : hub appele par le ticker, le seek, le pause, le stop ;
- `preload` : strategies de chargement de ressources ;
- `services` : services runtime supplementaires.

Capacites a ajouter ou a confirmer apres prototype :

- `continuousAnimationEngines` : moteurs capables de claim et evaluer des actions continues ;
- eventuellement `modules` si un binding doit installer des hooks runtime associes a ses composants ;
- eventuellement `capabilities` / metadata si l'authoring doit exposer les capacites du binding.

Forme cible possible :

```ts
export type ThirdPartyBinding = {
  components: Record<string, RuntimeComponentClass>
  renderAdapter?: RenderAdapter
  preload?: ThirdPartyPreloadStrategy[]
  services?: ServiceRegisterInput[]
  continuousAnimationEngines?: ContinuousAnimationEngine[]
  modules?: ModuleRegisterInput[]
}
```

Hypothese de consommation par CodPlay au bootstrap, non normative tant qu'un prototype n'a pas teste le besoin :

1. `binding.services` alimente le service registry avant chargement de scene.
2. `binding.modules` alimente le module registry avant installation des modules.
3. `binding.components` alimente le component registry.
4. `binding.preload` alimente le registre de strategies preload avant `player.init()`.
5. `binding.renderAdapter` est ajoute a `RenderSync`.
6. `binding.continuousAnimationEngines` est ajoute a la liste des moteurs continus du renderer, apres les moteurs core ou selon un ordre documente.

Un binding devra pouvoir supposer que ses services/modules/composants sont enregistres avant la premiere resolution d'event, et que ses moteurs continus sont presents avant le premier commit anime. L'ordre normatif exact n'est pas a trancher ici faute de contexte suffisant ; il sera fixe dans `v1-third-party-runtime-spec.md` si la generalisation est retenue.

Le routage ne doit pas reposer sur une devinette globale du type "premier moteur gagnant". Chaque action resolue a une origine connue : le perso qui la porte, son type de composant, son `listenerId`, son `actionKey`, et donc le binding responsable de ce type.

Le protocole cible doit donc adresser les actions continues au moteur du binding concerne, ou a un moteur core explicitement applicable, a partir de cette origine. Le moteur ne doit pas capturer une action appartenant a un autre type de composant simplement parce que sa forme ressemble.

Forme cible possible du claim, plus riche que l'actuel `claims(action)`, a tester si le prototype sort de `avatar3d` :

```ts
type ContinuousAnimationClaimInput = {
  action: unknown
  actionKey: string
  listenerId: string
  componentType: string
  component: RuntimeComponent
}
```

Le binding peut alors declarer les types de composants qu'il sert, ou CodPlay peut les deduire de `binding.components`. Exemple : le moteur continu de `createAvatar3DBinding()` ne recoit que les actions issues de persos `type: "avatar3d"`.

Le conflit a eviter n'est donc pas resolu dynamiquement par priorite : il est evite par l'adressage correct. Si deux moteurs revendiquent le meme type de composant et la meme action, c'est une erreur de protocole ou de binding a signaler.

Le protocole doit aussi definir la relation avec `renderAdapter` :

- `continuousAnimationEngines.trigger(...)` enregistre les actions continues au moment ou les events sont appliques ;
- `renderAdapter.tick/seek/stop` fait avancer ou reconstruit l'etat visuel de la bibliotheque ;
- un binding peut utiliser les deux : moteur continu pour savoir quelles actions sont actives, render adapter pour appliquer et rendre a la timeline courante.

Pour `avatar3d`, cela signifie probablement :

- `continuousAnimationEngines` recoit les actions issues des persos `avatar3d` et traite les actions `motion` ou les actions nommees qui contiennent une motion ;
- le meme mecanisme traitera plus tard les visemes continus ;
- `renderAdapter` continue d'appeler `_tick`, `_prepareSeek`, `_seek`, `_stop` sur les instances ;
- la factory `createAvatar3DBinding()` partage une closure entre le moteur continu et le render adapter pour retrouver les instances actives.

Le document `v1-third-party-runtime-spec.md` devra etre mis a jour apres validation du prototype si la generalisation est retenue. Les sections existantes sur `ThirdPartyBinding` deviendront alors le lieu normatif de ce protocole enrichi.

## 7.4 Vers une base Three.js

La capacite d'action continue est fondamentale pour Three.js. Un composant Three.js ne se limite pas a recevoir des mutations discretes : il doit souvent maintenir des etats evolutifs sur plusieurs frames, puis reconstruire exactement ces etats au seek.

Exemples au-dela de `avatar3d` :

- camera dolly/pan/orbit ;
- transitions de lumiere ;
- morph targets ou skeletons non-avatar ;
- materials/shaders animes ;
- particules ou effets proceduraux ;
- timelines glTF ou clips d'animation Three.js ;
- interactions 3D qui doivent rester synchronisees avec le player.

Le chantier `avatar3d` doit donc eviter de figer une solution trop specifique aux visages ou aux motions. Le resultat attendu apres prototype est de savoir si une abstraction commune est necessaire. Hypothese non normative :

```ts
abstract class BaseThreeComponent extends BaseComponent {
  protected continuousActions: ThreeContinuousActionRegistry
  protected abstract renderThreeFrame(info: RenderTickInfo | RenderSeekInfo): void
}
```

Responsabilites possibles d'une base Three.js :

- gerer un registre d'actions continues seek-safe ;
- exposer un contexte temporel coherent aux actions (`timelineMs`, `eventMs`, `rate`) ;
- centraliser le pattern `_tick` / `_prepareSeek` / `_seek` / `_stop` ;
- fournir des helpers pour appliquer des deltas sur `Object3D`, `Material`, `Camera`, `AnimationMixer` ;
- eviter que chaque composant Three.js reinvente son propre modele `play(t) = seek(t)`.

`avatar3d` reste le premier cas d'usage parce qu'il concentre deja les problemes : morphs, bones, gestures, visemes, idle loops, gaze et overlays. Si le prototype confirme que certains besoins sont propres a Three.js, la spec issue de la phase 7 devra decrire une base Three.js en plus de la primitive third-party generique.

Si cette base est correctement concue, `avatar3d` devra l'utiliser lui-meme. Elle ne doit pas etre une abstraction posterieure theorique reservee aux futurs composants : elle doit sortir du besoin concret d'avatar, puis remplacer les parties communes du composant avatar.

## 8. Integration dans `avatar3d`

Dans `Avatar3DBaseComponent.loadModelAsync()` :

- creer `Avatar3DMotionPlayer` apres `engine.loadModel(...)` ;
- lui transmettre `engine`, `boneMap` et `initial.motions`.

Dans `_tick(info)` :

```ts
this.motionPlayer?.tick(info)
this.engine.animate(info.timelineDeltaMs)
this.gaze.computeAndApply()
this.render3D()
```

L'ordre exact est a verifier par test visuel. Le principe a respecter : les motions doivent pouvoir piloter des morphs/bones avant le rendu de la frame, sans casser visemes, gaze, blink ou head drift.

Dans `_prepareSeek()` :

- `motionPlayer.prepareSeek()` ;
- puis reset actuel de l'engine.

Dans `_seek(info)` :

- le replay des eventimes aura deja appele `update()` ;
- `motionPlayer.seek(info.timelineMs)` reconstruit les motions actives a la position cible ;
- l'engine snappe ensuite les morphs/bones.

Dans `_stop()` :

- `motionPlayer.stop()` ;
- puis logique actuelle de stop.

Dans `buildActionHandlers()` :

- reconnaitre toute action qui contient une propriete `motion`, qu'elle provienne d'une action nommee privilegiee (`smile`, `wink`, `think`) ou de l'action generique secondaire `avatar:motion` ;
- deleguer a `motionPlayer.triggerFromAction(action, eventSeq)`.

Ce point implique de passer le player de motion a `buildActionHandlers` ou d'ajouter un handler local dans `Avatar3DBaseComponent.update()` avant la table existante.

Le handler `motion` ne doit pas "jouer une frame" directement. Il enregistre une action continue dans le lecteur. L'evaluation effective se fait ensuite dans `_tick` ou `_seek`.

## 9. Temps, eventimes et seek

Le temps d'avancement vient du `RenderAdapter.tick(info)`, pas d'un timer propre.

Pour le playback normal, quand `update()` recoit une action contenant `motion`, le composant enregistre une action continue avec le temps de depart fourni par le contexte runtime CodPlay.

Pour le seek, le replay rejoue les events dus avant `_seek(info)`. Le lecteur enregistre les actions continues pendant ce replay, puis `_seek(info)` evalue chaque action active a `info.timelineMs`.

Invariant attendu :

- `play(t)` et `seek(t)` doivent produire le meme etat visible ;
- une motion terminee avant `t` ne reste pas active ;
- une motion en cours a `t` est evaluee avec `elapsed = t - startMs` ;
- une motion interrompue par une autre action rejouee avant `t` ne reapparait pas.

Le temps de depart d'une action continue est fourni par CodPlay. Ce point appartient au contrat runtime de base : une action continue ne peut pas etre seek-safe si son moteur ne connait pas le temps de l'event qui l'a declenchee.

Pourquoi le composant ne l'obtient-il pas directement aujourd'hui ? `RuntimeComponentUpdateInput` contient `persoId`, `eventId`, `eventSeq`, `action` et `serviceContext`, mais pas `eventMs`. Le `renderer` connait pourtant ce temps via `eventMsByEventId`, et le moteur continu core (`TweenRunner`) le recoit via `ContinuousAnimationEngineTriggerInput.eventMs`. Le manque n'est donc pas conceptuel : il est situe a l'interface composant/binding. Le prototype doit choisir le chemin minimal pour transmettre cette information au bon niveau.

## 10. Priorites et cohabitation

Regles proposees :

- Ne pas presupposer une priorite absolue des visemes. Les visemes, les motions de bouche et les expressions faciales peuvent toucher les memes morphs ; le lecteur doit definir une strategie de composition explicite plutot qu'une priorite implicite.
- Les actions `avatar:morph` explicites gardent leur comportement actuel.
- Une motion action applique des valeurs fixes temporaires et les libere a la fin.
- Une motion mood applique des baselines persistantes et reste active jusqu'au mood suivant.
- Tant que `blink`, `head-drift`, `breathe` n'ont pas encore migre dans le catalogue, ils restent des mecanismes idle transitoires ; ils peuvent etre neutralises temporairement seulement si la motion pilote explicitement les memes cles.
- `gaze` reste actif sauf motion qui pilote explicitement les yeux ou la tete et dont la priorite est definie.

Les conflits doivent etre explicites dans le lecteur. Ne pas compter sur l'ordre accidentel des appels pour regler les priorites.

Comportements qui recouvrent deja ou recouvriront le catalogue ajoute :

- `blink` recouvre `eyesClosed`, `eyeBlinkLeft`, `eyeBlinkRight`, et donc wink, sleep, close_eyes, yawn, laugh_closed ;
- `head-drift` recouvre `headRotateX`, `headRotateY`, `headRotateZ`, et donc nod, shake, look_up/down/left/right, listen, thinking ;
- `breathe` recouvre `chestInhale`, `mouthShrugLower` et potentiellement deep_breath / sigh selon adaptation ;
- `gaze` recouvre les morphs de regard (`eyeLook*`) et les motions de regard (`look_left`, `look_right`, `side_glance`, `eyesRotate*`).

Ces comportements ne doivent donc pas rester hors catalogue a long terme. Ils doivent etre reexprimes comme motions/expressions continues de meme niveau que les motions importees, avec des regles de composition documentees.

## 11. Moods dynamiques

Les moods actuels de `ExpressionEngine` sont une union fermee : `neutral`, `happy`, `angry`, `sad`, `fear`, `disgust`, `love`, `sleep`.

Le catalogue externe contient d'autres moods utiles : `thinking`, `nervous`, `shy`, `listen`, `smirk`, `grimace`, `pleading`, `sleeping`, `frown`, `squint`, `curious`, `surprise`.

Deux pistes :

- ajouter une API interne a `ExpressionEngine` pour enregistrer des baselines dynamiques ;
- gerer les baselines dynamiques dans `Avatar3DMotionPlayer` via `morphEngine.setBaseline()`.

Decision ouverte : gerer les baselines dynamiques dans `Avatar3DMotionPlayer` limite le changement a `avatar3d`, mais une API dans `@codplay/avatar-engine` peut devenir necessaire si les moods dynamiques deviennent une capacite stable. Le prototype doit tester avant de specifier.

## 12. Overlays osseux

Les overlays de `motion-engine` ciblent `TalkingHead.poseDelta`. CodPlay n'a pas cette structure ; il dispose d'un `boneMap` Three.js.

Phase 6 : adapter l'idee de `OverlayManager`. Deux options doivent etre evaluees :

- appliquer des deltas sinusoïdaux directement sur les bones, avec capture des rotations de repos et restauration propre au stop ;
- integrer une couche `poseDelta` interne au composant, proche du modele TalkingHead, puis la faire consommer par le rendu Three.js.

L'integration de `poseDelta` fait partie des adaptations possibles, car `avatar3d` vise une adaptation fidele du projet TalkingHead dans l'environnement CodPlay. Il ne faut pas rejeter `poseDelta` au motif que la structure n'existe pas encore dans CodPlay ; il faut determiner si elle est la bonne abstraction pour conserver les overlays et eviter les conflits entre gestures, bones et idle motions.

Motions concernees :

- `wave_right` ;
- `wave_left` ;
- `jump` ;
- `celebrate` ;
- `laugh` ;
- `applause` ;
- `dance` ;
- `excited` ;
- `dismiss` ;
- `head_circles` ;
- `shiver` ;
- `vibrate`.

Les overlays ne bloquent pas le MVP : les motions restent jouables avec leurs morphs et gestes, mais certaines perdront une partie de leur expressivite.

## 13. Phases d'implementation

### Phase 0 — validation de spec

- Valider ce plan.
- Valider l'invariant `play(t) = seek(t)` pour les motions `avatar3d`.
- Confirmer que les donnees recuperees peuvent etre copiees/adaptees sous attribution MIT.

### Phase 1 — capacite locale d'actions continues

- Auditer les traitements continus existants : blink, head-drift, breathe, gesture hold/release, visemes.
- Identifier lesquels contournent le modele continu et lesquels sont deja seek-safe.
- Ajouter un registre interne d'actions continues a `avatar3d`.
- Brancher ce registre sur `_tick`, `_prepareSeek`, `_seek`, `_stop`.
- Tester une action continue minimale sans catalogue externe.
- Preparer la migration de blink, head-drift et breathe vers le catalogue.

### Phase 2 — lecteur minimal de motions sans overlays

- Ajouter les types `Avatar3DMotion`.
- Integrer le catalogue le plus large possible depuis `motions.json` et `motions_th.json`, en marquant explicitement les motions partiellement supportees si une capacite manque encore.
- Ajouter `Avatar3DMotionPlayer`.
- Ajouter l'action `avatar:motion`.
- Supporter motion par nom, motion locale dans `initial.motions`, motion inline dans event data.
- Supporter `dt`, `vs`, `gesture`, fin d'action et liberation des morphs.

### Phase 3 — validation seek et refactor visemes

- Tester replay apres seek au milieu d'une motion.
- Tester replay apres seek apres la fin d'une motion.
- Refactorer les visemes pour les traiter comme actions continues quand les donnees portent une fenetre temporelle.
- Conserver la compatibilite avec les eventimes `avatar:viseme` existants si aucune fenetre continue n'est declaree.
- Comparer visuellement lecture normale, seek avant, seek milieu, seek apres parole.

Definition de "phoneme-level" dans ce plan : une action continue de lipsync dont chaque unite porte au minimum un viseme/phoneme cible, un temps de debut et un temps de fin. Le lecteur calcule alors l'etat labial a `timelineMs` en fonction de la fenetre active, au lieu de seulement rejouer le dernier event instantane. Exemple conceptuel : `{ viseme: "aa", startMs: 1200, endMs: 1280 }` ou une sequence equivalente portee par une motion continue.

### Phase 3b — migration idle vers catalogue

- Reexprimer blink, head-drift et breathe comme motions/expressions continues de catalogue.
- Remplacer progressivement les helpers `createBlinkScheduleFn`, `createHeadDriftFn`, `createBreathTriggerFn` par des declarations de motions.
- Garder les helpers comme compatibilite transitoire si necessaire, mais ne plus les considerer comme le modele cible.

### Phase 4 — moods dynamiques

- Extraire les baselines depuis les motions `_track: "mood"`.
- Appliquer les baselines persistantes.
- Ajouter les moods manquants du catalogue externe.

### Phase 5 — catalogue complet

- Integrer progressivement les 98 motions.
- Marquer les motions incompletes sans overlay.
- Ajouter warnings si une motion cible des morphs/bones absents du modele charge, sans interrompre le rendu.

### Phase 6 — overlays

- Adapter `OverlayManager` a `boneMap`.
- Ajouter les effets oscillatoires.
- Tester les conflits avec `GestureEngine` et les bone morphs (`headRotate*`, `bodyRotate*`).

### Phase 7 — spec et propagation eventuelle

- Rediger la spec issue du prototype : primitive third-party d'action continue, extension generique de `ThirdPartyBinding`, base Three.js, ou combinaison de ces options.
- Mettre a jour `v1-third-party-runtime-spec.md` pour decrire le protocole enrichi de declaration et de consommation des bindings.
- Evaluer explicitement l'interet d'un `BaseThreeComponent` partage pour les futurs composants Three.js.
- Tester l'elargissement avec le composant Rive existant : `packages/authoring/components/rive`.
- Identifier ensuite les besoins concrets du futur binding `lottie`.
- Adapter `rive` ou `lottie` seulement si un cas concret le justifie, en respectant la spec issue du prototype.

### Phase 8 — API auteur et mode d'emploi

- Exposer une API auteur pour lister les motions disponibles, leurs tags, leur track, leur description et leur niveau de support.
- Fournir un mode d'emploi utilisateur : declarer une action nommee, reference une motion, surcharger une motion, utiliser une motion inline, tester le seek.
- Preparer l'usage futur editor : interface d'ajout, de preview et de selection d'expressions.

### Phase 9 — FaceMirror / enregistrement editor eventuel

- Reporter MediaPipe et `_detect` / `_react` a un plan separe.
- Explorer plutot l'integration editor : enregistrer des comportements utilisateur via webcam, les convertir en motions CodPlay, puis les relire dans `avatar3d`.
- Ne pas coupler cette phase au lecteur de motions de base.

## 14. Tests requis

Tests unitaires :

- resolution d'une motion par nom ;
- priorite catalogue local > catalogue integre ;
- motion inline ;
- interpolation `dt` / `vs` ;
- liberation des morphs en fin d'action ;
- application d'une motion mood ;
- reconstruction seek sans `startAt` auteur ;
- stop nettoie les morphs fixes et gestes actifs.
- visemes continus : lecture normale et seek produisent le meme etat labial.

Tests integration/demo :

- scene demo avec `warm_smile`, `wink_smile`, `nod_yes`, `shake_no`, `thinking`, `shrug_confused` ;
- seek au milieu de chaque motion ;
- rewind complet ;
- cohabitation avec visemes et blink.

## 15. Demo cible

Ajouter ou etendre une scene `avatar-poc` :

```ts
eventimes: [
  { name: "avatar:motion", startAt: 500, data: { motion: "warm_smile" } },
  { name: "avatar:motion", startAt: 1800, data: { motion: "nod_yes" } },
  { name: "avatar:motion", startAt: 3200, data: { motion: "thinking" } },
  { name: "avatar:motion", startAt: 5200, data: { motion: "wink_smile" } },
  { name: "avatar:motion", startAt: 7000, data: { motion: "shrug_confused" } },
]
```

La demo doit rester un revelateur de gaps : ne pas modifier les motions uniquement pour masquer une limite du lecteur.

## 16. Points ouverts

- Generalisation third-party : demarrer localement dans `avatar3d`, puis tester l'elargissement avec `packages/authoring/components/rive` avant toute spec normative.
- Base Three.js : reflexion formelle non normative ; a extraire seulement si `avatar3d` revele une base commune reelle.
- Baselines dynamiques : a tester dans `avatar3d` avant de decider si l'API remonte dans `@codplay/avatar-engine`.
- Regard/tete/gaze : les motions de tete et d'yeux ont vocation a etre prioritaires sur les comportements automatiques quand elles sont actives ; la strategie de composition exacte reste a tester.
- Visemes : conserver les eventimes instantanes pour compatibilite, mais definir un mode continu phoneme-level quand les donnees contiennent des fenetres temporelles.

## 17. Critere de sortie MVP

Le MVP est valide quand une persona `avatar3d` peut :

- declarer des motions locales dans `initial.motions` ;
- jouer une motion integree par nom depuis un eventime ;
- jouer une motion inline portee par un eventime ;
- rester synchronisee avec le ticker CodPlay ;
- survivre a seek/rewind/stop sans etat fantome ;
- garantir `play(t) = seek(t)` pour une motion en cours et pour une motion terminee ;
- continuer a jouer visemes, blink, head drift, breath et gaze avec des priorites documentees.
# TH / MotionEngine parity matrix

This section is normative for the ongoing avatar3d adaptation. Demos must not be
changed to hide a gap listed here. A demo change is acceptable only when it uses
the same runtime path being validated, or when it is explicitly labelled as an
isolation scene.

| Layer | TH / MotionEngine behavior | Current CodPlay status | Gap / required action |
| --- | --- | --- | --- |
| time source | Runtime samples motions from a single clock. | CodPlay passes `timelineMs`, `eventMs`, `isSeekReplay`. | Keep all semantic layers pure on `timelineMs`; do not reconstruct by visual patches. |
| visemes | TH weights PP/FF stronger, peak mid-cue, release after cue. | Integrated in `AvatarSpeechController`. | Verify visual RPM morph intensity; do not change mapping without test. |
| mood/expression | Morph baselines + transitions. | Partially integrated as layer. | Confirm all TH moods and aliases; avoid mood overriding speech/gesture unintentionally. |
| direct morph | Explicit morph changes can be continuous. | Integrated as layer. | Needs broader tests with aliases and seek across interrupted continuous morphs. |
| motion morph channels | `vs` numeric channels sampled by `dt`/`rescale`. | Integrated for supported morph/bone channels. | Catalogue still partial; unsupported channels must remain visible as warnings. |
| body pose | TH starts from `side`, then interpolates `poseBase -> poseTarget`; poses are body baselines. | Partially integrated, but still coupled to imperative `GestureEngine`. | Replace with deterministic pose evaluator; import more complete templates; test play(t)=seek(t). |
| gesture | TH gesture overrides pose properties temporarily, then returns to current pose baseline. | Partially integrated; seek path is not yet exact. | Gesture must be evaluated from resolved command + start/end + baseline at `timelineMs`; no `update(elapsed)` approximation. |
| pose + gesture composition | Pose baseline first, gesture override second. | Conceptually present, but stateful implementation can diverge on seek. | Implement pure composition before application. |
| gesture release | MotionEngine gesture channel contains command then `null`; release must match playback timing. | Partial. | Represent release phase explicitly and test expired gesture absence on seek. |
| mirror gesture | MotionEngine may request mirrored gesture, e.g. `['handup', null, true]`. | Unsupported/partial. | Either implement mirroring or keep marked partial with warning. |
| poseDelta | TH adds pose deltas for idle/body movement. | Missing. | Port after pose/gesture deterministic core. |
| overlays | MotionEngine `_overlay` combines transient overlays. | Missing. | Add after deterministic pose/gesture core. |
| eyes/head channels | TH/MotionEngine includes `eyesRotateX/Y`, `headMove`, additional gaze-like channels. | Partial via bone morphs/headRotate only. | Map explicitly or mark unsupported. |
| auto behavior | TH alternates idle poses/micro-motions. | Partial blink/head drift/breathe only. | Reconcile with poseDelta and CodPlay deterministic time. |
| model calibration | TH templates target its reference rig; RPM differs. | Retarget only, no formal calibration. | Add calibration layer/spec after parity core is deterministic. |

Current rule: `avatar-poc-1` is a revealer. If `vs.pose` or `vs.gesture` breaks
on seek, fix `vs.pose`/`vs.gesture`; do not replace them with a different event
path just to improve the demo.
