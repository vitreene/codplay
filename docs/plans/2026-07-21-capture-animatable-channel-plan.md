# Plan — canal `CaptureUpdate` parallèle pour les mises à jour de capture

## Contexte

Le canal capture (`v1-capture-spec.md`) livre une `CaptureAction` à chaque frame via
`subscribeCaptureTick`. `PlayerFacade.applyCaptureTickActions` construit un
`AnimationResolvedAction` classique (`{ style: { x: <valeur> } }`) et le fait
transiter par le même pipeline qu'un event ponctuel : `enqueueCommit` →
`RendererFacade.tick()` → `orchestrator.routeUpdates` →
`deriveSimpleTransitions` → `AnimationAdapter.run()` → `animate()` (anime.js).

Ce pipeline crée une nouvelle transition anime.js (`animate()`) à chaque appel.
Pour un event ponctuel, une nouvelle transition par appel est correct. Pour une
capture (jusqu'à ~60 appels/seconde), cela crée des dizaines de transitions
concurrentes sur la même propriété du même nœud, jamais nettoyées avant la fin
de leur propre durée — constaté par test manuel : une transition longue déjà
active sur un autre nœud (l'orbite d'une bulle, `space-bubbles` demo) se fige
tant que ces re-déclenchements se poursuivent.

anime.js documente un mécanisme dédié à ce cas d'usage : `createAnimatable`
(module `animatable`, confirmé dans `node_modules/animejs/dist/modules/animatable/`).
Il crée une seule animation persistante par propriété, à l'initialisation, puis
chaque appel ultérieur (`animatable.x(valeur, duration?, ease?)`) réutilise ce
même tween interne (`tween._toNumber = valeur; animation.reset(true).resume()`)
au lieu d'en créer un nouveau. C'est le canal prévu par la bibliothèque pour un
flux de valeurs à haute fréquence (drag, curseur, scroll).

## Principe retenu

Le canal `CaptureUpdate` est un circuit parallèle au circuit `TransitionRequest`
existant — symétrique à la séparation déjà actée entre `subscribeJitTick`
(échantillonnage) et `subscribeCaptureTick` (livraison) : deux canaux distincts
pour deux rôles distincts, jamais mélangés.

Le nom est choisi côté codplay, pas côté anime.js : `CaptureUpdate` désigne ce
que le canal capture produit (une mise à jour continue), sans référence à la
bibliothèque tierce qui l'applique en interne — cohérent avec le reste du
contrat capture (`CaptureAction`, `CaptureState`...), qui ne nomme jamais un
mécanisme d'implémentation.

- Le pipeline `TransitionRequest`/`deriveSimpleTransitions`/`animate()` reste
  inchangé pour tout ce qui n'est pas capture (straps, events, drag existant
  hors capture, etc.).
- `CaptureUpdate` porte les mises à jour issues d'une capture. Il ne passe
  jamais par `deriveSimpleTransitions`.
- Le point d'intégration exact avec anime.js (`createAnimatable`, gestion du
  registre d'instances par nœud/propriété, cycle de vie création/nettoyage)
  est un détail d'implémentation non normatif. Seul le contrat observable
  (une capture ne crée jamais de nouvelle transition par frame) est normatif.
- Un second adaptateur interne, séparé du premier, est une piste possible pour
  organiser ce point d'intégration — pas une solution actée. D'autres formes
  (une seule classe d'adaptateur étendue, un registre partagé, etc.) restent
  ouvertes et à évaluer au moment de l'implémentation.
- Contrainte additionnelle pour ce choix : un remplacement d'anime.js par une
  bibliothèque maison est envisagé à terme (hors périmètre de ce plan). Le
  contrat `CaptureUpdate` doit donc rester aussi agnostique d'anime.js que
  `TransitionRequest`/`AnimationAdapter` le sont déjà aujourd'hui — `anime.js`
  ne doit apparaître nulle part au-dessus de l'adaptateur qui l'implémente,
  ni dans le nommage, ni dans la forme du contrat.

## Étapes

1. **Contrat** : ajouter `CaptureUpdate`, un type d'opération dédié aux mises
   à jour de capture, dans `animation/types.ts` — jamais confondu avec
   `TransitionRequest`.
2. **Adaptateur** : dans le module d'animation, tenir un registre
   `Map<target, Animatable-par-propriété>`, créé au premier besoin (lazy),
   jamais recréé pour les appels suivants sur le même nœud/propriété. Router
   une mise à jour de capture vers `animatable[property](valeur)`.
3. **Émission côté capture** : `PlayerFacade.applyCaptureTickActions`
   (`create-player.ts`) construit un `CaptureUpdate` plutôt qu'un
   `AnimationAction` classique avec `style`, pour ne jamais emprunter
   `deriveSimpleTransitions`.
4. **Nettoyage** : à la fermeture d'une capture (`endOn`), l'entrée
   `Animatable` correspondante est révoquée (`revert()`), pour qu'une capture
   suivante sur le même nœud reparte propre — jamais de réutilisation d'un
   `Animatable` d'un cycle de capture précédent.
5. **Tests** : vérifier par test unitaire (sur l'adaptateur, sans dépendre du
   vrai timing navigateur — voir limite ci-dessous) que router N mises à jour
   successives sur la même propriété ne crée qu'une seule instance
   `Animatable`, jamais N.
6. **Démo** : re-valider manuellement `space-bubbles` (turret clavier) une
   fois le canal branché — seul test qui peut confirmer la disparition du gel,
   les tests automatisés Node/jsdom ne reproduisant pas fidèlement le
   comportement temporel réel d'anime.js (dépendant de `Date.now()`/RAF navigateur).

## Point ouvert

L'organisation interne précise du point d'intégration `createAnimatable`
(second adaptateur ou autre forme) reste à écrire au moment de
l'implémentation — non bloquante pour la validation de ce plan.

## Prochaine étape

Consolider ce plan en une extension normative de `v1-capture-spec.md` (règle
sur le canal d'application des `CaptureAction` continues), avant d'implémenter.
