# JSX CodPlay isolé d'une application React

Note de réflexion (2026-08-02). Elle examine comment employer un JSX d'auteur
pour CodPlay sans entrer en conflit avec React, Babel ou Vite dans une application
hôte.

> **Statut : non normatif.** Aucun JSX CodPlay n'est décidé ici. Cette note
> conserve une frontière d'intégration si ce choix est étudié plus tard.

## Le risque réel

JSX n'est pas un langage unique : sa transformation doit savoir quelle fonction
appeler pour chaque élément écrit dans un fichier. React transforme un élément en
`ReactElement`; un JSX CodPlay devrait produire une description de story ou de
perso.

Le conflit n'existe pas parce que React et CodPlay utiliseraient tous deux le nom
`jsx`. Avec le runtime automatique, ce nom est un import local généré dans chaque
module. Le conflit existe si le même fichier est transformé deux fois, ou si une
configuration globale demande à tous les fichiers JSX d'employer le runtime
CodPlay à la place de React.

## Décision de frontière recommandée

**Un fichier JSX appartient à un seul runtime.**

- Les fichiers React restent transformés avec le runtime React.
- Les fichiers CodPlay sont transformés avec un runtime distinct, par exemple
  `@codplay/jsx`.
- Un même module ne mélange pas JSX React et JSX CodPlay.
- Une app React consomme préférablement du JavaScript CodPlay déjà compilé, et
  non les sources JSX de CodPlay.

Après compilation, les imports sont distincts :

```ts
// Produit depuis un fichier React
import { jsx } from 'react/jsx-runtime'

// Produit depuis un fichier CodPlay
import { jsx } from '@codplay/jsx/jsx-runtime'
```

Ces deux imports peuvent coexister dans le même bundle sans collision.

## Cas recommandé : package CodPlay compilé séparément

La frontière la plus fiable est un package d'auteur compilé avec sa propre
configuration TypeScript ou Babel.

```text
packages/
  codplay-jsx/       runtime JSX CodPlay
  scenes/            stories CodPlay écrites en .tsx
    src/
    dist/
app-react/
  src/
```

Le package de stories emploie sa configuration locale :

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@codplay/jsx"
  }
}
```

Il publie du JavaScript ESM dans `dist/`. L'application React importe alors une
valeur déjà construite, par exemple une `Story` ou un `SceneDoc` : elle ne
transforme jamais le JSX CodPlay.

Cette séparation évite que le plugin React de Vite rencontre du JSX CodPlay. Elle
rend aussi le package de stories utilisable hors de React.

## Cas local : une story dans une application React

Une app peut garder des stories à côté de ses composants, à condition de séparer
les modules :

```text
src/
  lesson.story.codplay.tsx
  LessonPreview.tsx
```

Le fichier CodPlay désigne son runtime de manière locale :

```tsx
/** @jsxImportSource @codplay/jsx */

export const lesson = (
  <story id="lesson">
    <text id="title">Bonjour</text>
  </story>
)
```

Le composant React importe seulement la valeur produite :

```tsx
import { lesson } from './lesson.story.codplay'
```

La directive s'applique à l'ensemble du fichier. C'est précisément pourquoi un
composant React et une story CodPlay ne doivent pas partager un module `.tsx`.

Ce cas demande une vérification de la chaîne de transformation retenue par
l'application. Si le plugin React ne respecte pas cette directive pour les
fichiers concernés, le fichier CodPlay doit être précompilé ou traité par un
plugin Vite dédié avant le plugin React.

## Contrat du runtime CodPlay

Un runtime automatique CodPlay devrait fournir les sous-chemins standard :

```text
@codplay/jsx/jsx-runtime
@codplay/jsx/jsx-dev-runtime
```

Selon les formes autorisées, il expose `jsx`, `jsxs` et `Fragment`. Ces fonctions
retournent des descriptions CodPlay; elles ne retournent jamais des éléments
React.

Ses types JSX doivent être locaux au module du runtime. Il ne faut pas déclarer
un `namespace JSX` global, car ses éléments intrinsèques (`story`, `perso`,
etc.) se mêleraient alors aux éléments HTML et aux types React.

## Vite et monorepo

Dans une application React, `@vitejs/plugin-react` reste configuré pour React.
Le package de scenes CodPlay doit être résolu par ses `exports` vers son `dist/`
compilé. Il faut éviter un alias de workspace qui ferait importer directement
`packages/scenes/src/**/*.tsx` dans l'application : Vite tenterait alors de
traiter ces sources dans le pipeline React.

Un plugin Vite dédié, limité aux fichiers `*.codplay.tsx`, peut améliorer le
confort de développement d'un monorepo. Il doit transformer ces fichiers avant
le plugin React. Cette voie est secondaire : la compilation séparée reste la
frontière la plus simple à expliquer, tester et maintenir.

## Synthèse

Le JSX CodPlay ne doit pas devenir une extension globale de l'application hôte.
C'est un langage d'auteur dont le runtime et les types sont propres au package
qui le compile. React peut ensuite consommer les stories produites comme de
simples données, sans savoir qu'elles ont été écrites en JSX.
