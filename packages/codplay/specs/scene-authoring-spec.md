# CodPlay V2 — déclaration et compilation d'une scène

## Périmètre vérifié

Cette spécification décrit le chemin structurel vérifié
`SceneDoc → CodPlay.build → CompiledScene`. Le suivi des décisions d'extension
et des critères d'acceptation est dans le [plan CompiledScene](../plan/compiled-scene-plan.md)
et les plans des composants concernés.

## Document auteur

`SceneDoc` possède un `id` et des `stories` nommées. Chaque `StoryDoc` possède
son `id` et ses `persos`. Un `PersoDoc` possède un `id`, un type de composant,
un état `initial` facultatif et des `actions` nommées facultatives. Un perso
peut également déclarer des sources `emit`. Les [types auteur](../src/scene/types.ts)
fixent les autres champs acceptés par cette fondation ; les profils de
composants et leurs validateurs décident des champs propres à chaque type.

```ts
import type { SceneDoc } from 'codplay'

const scene: SceneDoc = {
  id: 'message',
  stories: {
    main: {
      id: 'main',
      persos: [{
        id: 'texte',
        type: 'tag',
        initial: { tag: 'p', content: 'Avant', move: '@root' },
        actions: { changer: { content: 'Après' } },
      }],
      eventimes: [{ name: 'changer', startAt: 1_000 }],
    },
  },
}
```

L'eventime de story s'applique dans cette story. Un eventime déclaré sur la
scène est compilé comme occurrence relative commune à ses stories ; la borne
`sequence:end` peut y être déclarée. Le [plan de compilation](../plan/compiled-scene-plan.md)
et la [spécification du pipeline événementiel](./event-pipeline-v2-spec.md) règlent
leur interprétation. L'[exemple des composants](../../demos/src/v2/demos/components/components-scene.ts)
montre les deux niveaux de déclaration.

Les types core actuellement enregistrés sont `tag`, `img`, `input`, `layout`,
`list`, `media`, `polygon` et `slot`. Une capacité optionnelle peut enregistrer
son propre type par la façade avant le premier build. Les profils de
[img](./image-component-v2-spec.md), [input](./input-component-v2-spec.md),
[layout](./layout-component-spec.md), [polygon](./polygon-component-v2-spec.md),
[slot](./slot-component-spec.md) et [scroll-container](./scroll-container-spec.md)
ont leurs spécifications dédiées. Les spécifications `img`, `input` et `polygon`
décrivent leurs comportements vérifiés ; leur acceptation restante est suivie
dans le plan image/input/polygon.
`scroll-container` n'est pas enregistré dans le catalogue core.

## Normalisation des champs auteur

`normalizeSceneDoc` copie les données auteur sans modifier la source. Pour un
perso, `initial` absent devient `{}` ; `actions` absent devient une table vide,
puis la normalisation impose l'entrée interne `actions[perso.id] = null`, même
si l'auteur avait fourni une autre valeur sous cette clé. Cette forme canonique
est vérifiée par les tests de normalisation et de guards.
[`normalize-scene-doc.spec.ts`](../tests/scene/normalization/normalize-scene-doc.spec.ts)
vérifie la complétion de l'auto-référence et l'absence de mutation de la
déclaration source.

Le comportement éventuel de `SceneDoc.defaults` n'est pas certifié par cette
spécification : aucune règle d'application ou de priorité ne doit être déduite
de ce champ. La décision reste au
[plan CompiledScene](../plan/compiled-scene-plan.md).

## Résultat de `build`

`codplay.build({ scene })` utilise le snapshot de validation du catalogue
configuré pour ce propriétaire. Le [builder](../src/scene/compiled/scene-builder.ts)
normalise la forme, valide les profils et leurs références, applique la
sanitation déclarée par les composants, extrait les fonctions auteur puis
produit un `CompiledScene` immuable. L'artefact conserve la scène compilée,
les ressources dérivées, les identités racines, les requirements et les index
dérivés nécessaires à l'exécution. Les fonctions sont remises séparément dans
le résultat du build ; elles ne traversent pas le codec JSON de l'artefact.

Le résultat `ok: false` porte les diagnostics et aucun artefact exécutable.
Le résultat `ok: true` porte `compiledScene`, `functions` et les diagnostics.
Une instance reçoit l'artefact et les fonctions issus de ce même build. Le
[codec](./compiled-codec-v2-spec.md) revalide la forme sérialisée à sa
frontière. Les [tests du builder](../tests/scene/compiled/scene-builder.spec.ts)
et du [codec](../tests/scene/compiled/codec.spec.ts) vérifient ce partage.
Le mode d'export média et ses propriétés `src` reconnues sont décrits ci-dessous.

### Références média d'export

`build(input, { export: true })` applique la fermeture média vérifiée dans la
[spécification du paquet de scène](./scene-package-export-v1-spec.md). Le
résultat expose `resourceReferences` à côté du `CompiledScene` : chaque entrée
porte le type et le chemin compilé exact de chaque occurrence prise en charge.
Cette fermeture inclut les `url()` locaux d'image dans les valeurs `style` de
la scène. L'exporteur ne les redécouvre pas : il consomme les chemins remontés
par le builder et ne relocalise que la copie de diffusion. Le texte auteur et
le `CompiledScene` source restent inchangés.
Les formes non prises en charge énumérées dans cette spécification produisent
un diagnostic bloquant contextualisé dans ce mode. Ces métadonnées ne font pas partie du JSON
`CompiledScene`. Le chemin `build(input)` sans option `export` conserve sa
dérivation de ressources et ses diagnostics auteur actuels.

Les feuilles CSS importées et `styleSheet` sont compilés séparément par l'outil
d'export, car leurs chemins d'origine appartiennent aux fichiers CSS et ne sont
pas des champs de `SceneDoc`. Les règles vérifiées de capture, résolution et
relocalisation appartiennent à la
[spécification du paquet](./scene-package-export-v1-spec.md). La conversion
d'un style de perso en classe est hors du contrat d'export V1 : les valeurs
restent celles consommées par le moteur, à l'exception de la relocalisation de
leurs URL locales dans la copie de diffusion. La décision de portée est suivie
dans le [plan CompiledScene](../plan/compiled-scene-plan.md).

### Références de fonctions exportables

Avec `{ export: true }`, le résultat du build expose aussi
`functionReferences`, une entrée `{ ref, path }` pour chaque fonction extraite.
`path` est le chemin structuré exact depuis le `SceneDoc` d'entrée jusqu'à
l'objet fonction d'origine ; ces métadonnées restent hors du JSON
`CompiledScene`. Le builder vérifie que chaque chemin pointe encore vers
l'objet associé à `ref`. Une référence absente ou divergente bloque le build
export avec `CODPLAY_EXPORT_FUNCTION_REFERENCE_UNSUPPORTED`. Sans l'option
`export`, la forme du résultat et le parcours auteur restent inchangés.

Les tests du builder vérifient les chemins des fonctions de scène, des
transforms, des actions et de capture. Le paquet et son chargement sont décrits
dans la [spécification du paquet](./scene-package-export-v1-spec.md) ; les
limites de lecture encore ouvertes restent au
[plan d'export](../plan/2026-10-15-export-diffusion-plan.md#r8--fonctions-codplay-et-imports).

## Frontières à préserver

- Le build ne crée ni player, ni composant vivant, ni nœud DOM. Il utilise les
  définitions et validateurs du catalogue, pas les ressources chargées.
- Le player consomme l'artefact compilé et ne répète pas la validation auteur
  sur son chemin de lecture.
- Le temps, les événements reçus pendant la lecture et les mesures de
  présentation restent des données runtime. Ils ne sont pas inventés par la
  compilation.
- Un nouveau champ compilé doit rester déterministe et sérialisable depuis la
  déclaration validée. Sa règle relève du plan et de la spécification de la
  capacité concernée.

Le [plan général](../plan/codplay-v2-plan.md) indexe les contrats et les
suivis actifs après la compilation.
