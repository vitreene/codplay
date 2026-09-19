# CodPlay V2 — pont runtime des cibles `rel`

## Statut

> Status: En cours — orchestration runtime migrée vers l'identité
> `host`/`target` ; les responsabilités propres aux intégrations restent
> séparées et la validation transverse demeure ouverte.
> CodPlay version: V2 foundation
> Décision: 2026-09-18
> Plan: [`../plan/2026-09-18-third-party-render-target-codplay-plan.md`](../plan/2026-09-18-third-party-render-target-codplay-plan.md)

Cette spécification décrit le raccordement interne entre une relation compilée
et une cible runtime opaque. Elle ne définit ni Three.js, ni Rive, ni Lottie,
ni une nouvelle API auteur.

## Trois responsabilités séparées

Le pont ne fusionne pas les registres existants :

| Élément | Rôle | Contenu |
| --- | --- | --- |
| `RuntimeCapabilityCatalog` | registre engine des définitions | classes, validateurs, modules, bibliothèques, services et déclaration éventuelle d'un fournisseur de cible |
| `RuntimeComponentSurfaceResolver` | accès aux opérations d'une instance déjà montée | surfaces typées comme `media`, `input`, `foreignContent` ou `replace` |
| `RuntimeTargetRegistry` | registre player-local des cibles de relations | identités `rel.target` et valeurs natives opaques disponibles pendant la lecture |

`MountTargetRegistry` reste le registre distinct du graphe de placement produit
par `move`. Il ne contient aucun handle de bibliothèque et ne résout aucune
relation `rel`.

Le catalogue décrit donc un fournisseur ; il ne devient pas le registre des
instances publiées. Le registre runtime est créé par
`RuntimeComponentRuntime`, donc isolé par player, et il est vidé au teardown.

## Donnée compilée et identité runtime

La scène porte la relation immuable séparément de l'initial du composant :

```ts
type CompiledRel = {
  host: string
  target?: string
}
```

Le registre runtime stocke uniquement cette identité structurée. Il ne
transforme pas `host` ou `target` en sélecteur DOM et ne déduit aucune classe
native, aucun nœud Three et aucun élément de modèle à partir de leur nom. La
valeur associée reste `unknown` pour le core.

Une déclaration de composant peut fournir un `targetProvider` à son unité
engine :

```ts
targetProvider?: (
  component: BaseComponent,
  identity: RuntimeComponentIdentity,
  materializer: RuntimeMaterializer,
) => {
  value: unknown
  scope?: 'host' | 'target'
} | undefined
```

Cette fonction décrit ce que l'instance publie ; elle ne recherche pas ses
consommateurs et ne manipule pas le registre directement. Une publication de
portée `host` expose le contexte de rendu ; une publication de portée `target`
expose une capacité sélectionnable par `rel.target`. Pour la première
verticale Three, cette clé correspond à l'identité auteur du composant publié
(`grid`, `avatar1`, etc.) ; elle ne correspond jamais à un nœud interne du
modèle. Le core ne parcourt jamais la valeur native. Lorsque `scope` est omis,
la publication est traitée comme une cible attachée au host de la relation du
composant ; un host déclare explicitement la portée `host`.

La définition engine porte aussi un profil runtime interne, absent de la
surface auteur : `placed` (valeur par défaut) suit la disponibilité du
placement résolu, tandis que `attached` décrit un composant logique rattaché
à un host et ne recevant pas `move`. Ce profil détermine la disponibilité de
sa publication sans ajouter un cas particulier pour une intégration.

## Cycle de vie d'une instance

Le runtime distingue la logique d'un composant de la représentation qu'il
possède :

1. tous les persos de la scène sont instanciés ;
2. les composants `BaseHTMLComponent` sont remis au matérialiseur HTML global ;
3. chaque composant reçoit sa phase `initialize()` après sa représentation
   éventuelle et avant son premier `update()` ;
4. les composants `BaseComponent` qui n'ont pas de représentation HTML ne
   traversent pas ce matérialiseur ;
5. les fournisseurs publient leur valeur opaque et indiquent sa disponibilité
   selon le profil runtime de leur définition ;
6. les mises à jour sont distribuées, avec la cible résolue dans
   `ComponentUpdateInput.target` ;
7. au teardown, la publication est libérée, puis le composant et sa
   représentation éventuelle sont détruits.

L'ordre de déclaration n'est donc pas utilisé pour résoudre une cible. Un
consommateur peut apparaître avant son fournisseur dans `scene.persos`, car la
publication n'est rendue disponible qu'après la phase de montage de tous les
composants.

Un composant non HTML ne reçoit ni markup vide ni handle de matérialisation
factice. Il peut posséder un contexte natif et le libérer dans `destroy()` ;
la façon de créer ce contexte appartient à son intégration, pas au core.

## Disponibilité

Une cible publiée reste enregistrée avec son identité lorsque le fournisseur
est temporairement absent de la projection courante. Pour le profil `placed`,
elle devient indisponible tant que `placement.mounted` vaut `false`. Pour le
profil `attached`, elle reste disponible dès que l'instance logique est
présente dans la scène, sans exiger de placement DOM. Lorsqu'une publication
redevient disponible, le consommateur reçoit de nouveau la même valeur opaque
et `rel` n'est pas modifié.

La publication est protégée par un jeton interne : une ancienne instance ne
peut pas libérer la publication plus récente qui aurait repris la même
identité.

## Décisions closes pour le core

### Références inconnues

La validation auteur vérifie la forme et les identités de host connues par la
scène. `target`, lorsqu'il est présent, reste une clé opaque de l'intégration :
le core ne vérifie pas qu'un avatar, un mesh, un os ou un morph target interne
porte cette clé. Une identité de host inconnue produit un warning auteur
non bloquant.

Ces warnings ne bloquent pas la construction. Ils ne sont pas recalculés par le
codec ni par le player : une scène diffusée ne réémet donc pas ce diagnostic.
L'absence d'une publication `target` n'est pas une erreur de structure ; la
compatibilité de la valeur opaque appartient à l'intégration qui la publie et à
celle qui la consomme.

### Dépendances et cycles

Le core ne construit pas de graphe récursif à partir de `rel`. Une relation est
une identité résolue par une recherche directe dans le registre du player ; sa
valeur opaque n'est jamais parcourue par CodPlay. Il n'existe donc pas de
cycle `rel` à détecter dans le core, et aucune tranche ne doit ajouter un
registre de graphe parallèle.

Une intégration peut organiser ses propres objets internes — par exemple un
host, un avatar et plusieurs contrôleurs — mais cette organisation reste
derrière le `targetProvider` et le composant concerné.

### Présentation native et bibliothèques

La frontière commune de présentation est le cycle du player : synchroniser les
composants, appeler `presentAt(timeMs)`, puis remettre la scène au
matérialiseur concerné. Le core ne possède pas de transaction de rendu native
et ne lance pas de boucle propre à une bibliothèque. Un hôte tiers regroupe ses
écritures dans ce cycle et son intégration déclenche son rendu au point prévu
par son module ; aucun `flush` générique n'est ajouté au registre des cibles.

Le chargement d'une bibliothèque tierce est une responsabilité de l'engine,
distincte de la résolution de `rel`. Une définition de bibliothèque est
enregistrée dans le `RuntimeCapabilityCatalog`; les composants déclarent les
IDs dont ils dépendent, puis `RuntimeEngine.prepareScene()` les prépare avant
le preload des ressources et avant `player.init()`. Le pont de cibles ne charge
jamais une bibliothèque depuis `create`, `update` ou `targetProvider`. Le
contrat complet est décrit dans
[`third-party-library-spec.md`](./third-party-library-spec.md).

## Limites explicitement hors de ce contrat

Le pont ne définit toujours pas les types, les conventions de rendu ni le
préchargement propres à Three.js, Rive, Lottie ou TalkingHead. Ces éléments
seront ajoutés dans leurs unités externes après validation de leur contrat
engine ; aucun composant tiers n'est introduit pour les simuler.

## Vérification restante

Les tests du pont couvrent le cycle avec l'identité `host`/`target` et doivent
continuer à couvrir :

- l'isolation des identités host/target ;
- l'isolation entre deux players ;
- l'invalidation et la réactivation d'une publication ;
- la protection contre la libération d'une publication remplacée ;
- le warning auteur non bloquant pour un host de relation inconnu ;
- le montage en deux phases lorsque le consommateur est déclaré avant son
  fournisseur ;
- la transmission de la cible opaque et sa disparition/réapparition lorsque
  le fournisseur est démonté puis remonté ;
- l'absence de passage des composants non HTML par le matérialiseur HTML.
