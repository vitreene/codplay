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
  portées par des composants ou capacités Avatar distincts ;
- un coordonnateur Avatar recueille les contributions et les applique à
  l'objet chargé ;
- la scène auteur ne fait que déclarer les relations, les données et les
  eventimes.

Le dépôt TalkingHead est la référence fonctionnelle explicite de cette
transposition. L'adaptation V1 sert de référence de comportement pour le
portage demandé, sans import de `codplay-v1` et sans recopier son binding.

## 2. Relations et montage

Le host Three reste propriétaire du canvas, du renderer, de la scène et du
commit :

```ts
avatar:          { rel: { host: 'three-scene-host' } }
avatar-mood:     { rel: { host: 'three-scene-host', target: 'avatar' } }
avatar-lip-sync: { rel: { host: 'three-scene-host', target: 'avatar' } }
avatar-gesture:  { rel: { host: 'three-scene-host', target: 'avatar' } }
```

Le composant `avatar` ne reçoit pas `move`. Il ajoute son objet au
`ThreeSceneTarget` reçu par `rel.host`, puis publie une capacité Avatar opaque
identifiée par son perso. Les composants spécialisés ne recherchent ni le host,
ni le modèle, ni ses nœuds internes : ils consomment seulement cette capacité.

## 3. Découpage complet et ordre de transposition

Le dossier `packages/authoring/component-v2/src/avatar/` porte les types, les
définitions, le preload, le coordonnateur et les composants spécialisés. La
présence des morphs, os et conventions du GLB reste une responsabilité de la
ressource Avatar préparée ; la validation auteur ne prétend pas inspecter le
modèle.

Les tranches sont traitées dans cet ordre, chacune avec son contrat et sa
validation propre avant d'être utilisée par la démo :

1. `avatar-lip-sync` : événements ponctuels de visème, tables stables de
   correspondance vers les morphs, intensité et transition depuis l'état
   présent, puis replay déterministe après seek et reprise ;
2. `avatar-mood` : baselines et transitions de mood ;
3. `avatar-gesture` et `avatar-pose` : gestes, poses et replay déterministe ;
4. `avatar-idle` : clignement, respiration et dérive de tête ;
5. `avatar-gaze` : contact visuel vers la caméra du host ;
6. `avatar-morph` : attributs morph ciblés et durée de maintien ;
7. capacité caméra Avatar, raccordée au composant caméra Three existant ;
8. scène d'acceptation : port complet des eventimes, straps, piste optionnelle,
   audio et captions de la scène de référence, avec adaptation vers les
   composants spécialisés.

Une tranche ne déclare pas dans la scène des événements dont aucun composant
ne porte encore le comportement. Les tests de chaque tranche restent
autonomes et la démo ne sert qu'à l'acceptation intégrée finale.

Le coordonnateur applique dans un ordre stable les couches suivantes : mood,
geste, puis les morphs produits par les composants spécialisés. Le composant
lip-sync transforme un événement ponctuel en animation morphique et transmet
les échantillons au coordonnateur ; il ne conserve pas une liste de cues
persistants. Le temps absolu CodPlay reste la seule horloge et le rendu reste
celui du host Three.

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
L'adaptation est volontairement reprise par tranches : les comportements V1
restants ne sont pas encore déclarés dans la scène tant que leurs composants
spécialisés ne sont pas validés.

Validations exécutées :

- typecheck de `@codplay/component-v2` ;
- tests du package avec cibles Avatar synthétiques indépendantes de la démo ;
- typecheck et tests de `@codplay/avatar-engine` ;
- typecheck V2 et build de `@codplay/demos` ;
- contrôle HTTP local du GLB, de l'audio et de l'entrée `?demo=avatar`.

La vérification visuelle navigateur de la lecture, du seek et de la reprise
reste ouverte ; le plan demeure **En cours**.

## 8. Tranche `avatar-mood` — 20 septembre 2026

La deuxième tranche est portée dans `avatar-mood-component.ts` selon le même
contrat temporel que `avatar-lip-sync` :

- chaque occurrence `avatar:mood` reste un événement ordinaire reçu par le
  composant via `activeActions` ;
- le composant résout le mood, sa durée éventuelle (`durationMs`) et produit
  une transition absolue de baselines avec une interpolation smoothstep ;
- le composant remet la couche au `AvatarCoordinator`, sans connaître le
  modèle, ses meshes ou le host Three ;
- une absence de durée conserve le comportement discret : la bascule est
  immédiate et la couche complète explicite les valeurs remises à zéro ;
- le coordonnateur conserve les couches mood et morphes et les transmet à
  l'engine Avatar attaché au host.

La couverture autonome vérifie la transition `neutral -> sad`, ses valeurs
intermédiaires, la transmission par la capacité Avatar et la coexistence avec
le lip-sync et le geste. Elle n'importe aucune valeur de la démo.

La démo Avatar a été exercée sur le chemin navigateur réel : les événements
`avatar:mood` sont observés à `4600 ms` et `8800 ms`, et les positions `5000 ms`
et `10000 ms` ont été rendues après seek. Aucun changement du core CodPlay n'a
été nécessaire. La tranche mood est validée ; la transposition Avatar globale
reste **En cours**.

## 9. Tranche `avatar-idle` — 20 septembre 2026

La tranche suivante expose le clignement spontané prévu par TalkingHead :

- `avatar-idle` est un composant logique attaché à la cible Avatar ; il ne
  reçoit pas de `move` et ne dépend d'aucun événement auteur ;
- il installe le `BlinkScheduleFn` déjà porté par `@codplay/avatar-engine`
  via la capacité Avatar ;
- les séquences simple ou double utilisent les durées et les probabilités du
  modèle TalkingHead, mais leur hasard est déterministe à partir de l'identité
  du composant (ou de `blinkSeed`) afin que le seek reconstruise le même
  clignement ;
- le coordonnateur réinstalle le scheduler après `prepareSeek`, puisque
  l'engine efface ses callbacks d'animation pendant cette phase ;
- la démo déclare `avatar-idle` avec `blink: true`. La respiration et la
  dérive de tête restent les prochaines responsabilités de cette tranche
  d'idle.

Les tests du composant vérifient la production d'une fenêtre de clignement,
sa reproductibilité après retour temporel et son raccord exclusif à la
capacité Avatar. Aucun changement de `packages/codplay` n'est nécessaire.
