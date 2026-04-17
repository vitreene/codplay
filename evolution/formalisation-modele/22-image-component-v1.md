# Image component V1

## Statut

Reference V1 pour le composant `image`.

## Preambule - intention

Le composant `image` est une brique unitaire d'affichage d'image.

Regle de perimetre:

- un carrousel/galerie n'est pas un composant `image`
- un carrousel/galerie releve d'un composant `list` avec des enfants `img`

## Portee

Ce document couvre:

- le contrat de donnees `image` (`initial`, `actions`, `emit`)
- le rendu DOM de reference `div + img`
- les regles `init`, `render`, `update`
- les modes d'usage `wallpaper` et `sprite`

## Hors perimetre V1

- galerie/carrousel (porte par `list`)
- preloading avance et cache policy detaillee
- transitions old/new image specialisees

## Dependances normatives

- `16-base-component-v1.md`
- `17-user-events-emit-v1.md`
- `03-event-model.md`

## Identite composant

- `persoType`: `img` (alignement runtime)
- 1 instance composant par `Perso` de type `img`

## Rendu DOM de reference

Pour V1, le modele de reference est un fragment:

- root container: `div`
- media node: `img` enfant

Template de reference:

```html
<div data-part="root" class="image-root">
  <img data-part="media" class="image-media" />
</div>
```

Regles:

- le `style` auteur s'applique par defaut sur `root`
- le `img` s'adapte aux dimensions du container
- le choix de `object-fit` definit l'usage visuel

## Modes visuels image

## wallpaper

- `object-fit: cover`
- usage fond/tapisserie
- rognage possible pour remplir le container

## sprite

- `object-fit: contain`
- usage sprite/element complet
- l'image reste integralement visible dans le container

Champ recommande:

```ts
type ImageFitMode = 'wallpaper' | 'sprite'
```

Mapping V1:

- `wallpaper` -> `cover`
- `sprite` -> `contain`

## Donnees d'entree auteur

## initial

Champs supportes:

- `id?`: id DOM optionnel (sur root)
- `className?`: classe initiale root
- `style?`: style initial root
- `attr?`: attributs initiaux root
- `src?`: source image (sur `media`)
- `alt?`: texte alternatif (sur `media`)
- `fitMode?`: `wallpaper | sprite` (defaut `wallpaper`)

Regles:

- `src` est fortement recommande au `init`
- si `src` absent, le composant reste valide mais emet un warning auteur

## actions

Actions supportees par `update`:

- patch de base root: `style`, `className`, `attr`
- patch media: `src`, `alt`, `fitMode`
- `move` (mecanisme commun d'insertion DOM, cf. `16-base-component-v1.md`)

Forme recommandee:

```ts
type ImageAction = {
  style?: Record<string, unknown>
  className?: string | { add?: string; remove?: string }
  attr?: Record<string, unknown>
  src?: string
  alt?: string
  fitMode?: 'wallpaper' | 'sprite'
}
```

## emit

`emit?` suit `17-user-events-emit-v1.md`.

Regles:

- listeners attaches au `root` au `init`
- les events media (`load`, `error`) peuvent etre relies via l'implementation composant

## Comportement runtime

## constructor(input)

- stocke `persoId`, adapter, reporter warning
- initialise refs internes (`root`, `media`)

## init(initial)

1. construire le fragment `div + img`
2. appliquer `id/className/style/attr` sur `root`
3. appliquer `src/alt/fitMode` sur `media`
4. attacher `emit` via `handleEvent(event)` au `root`

## render()

- retourne le `root` unique du composant

## update({ persoId, eventId, eventSeq, action })

Ordre recommande d'application:

1. `src`, `alt`, `fitMode` sur `media`
2. `style/className/attr` sur `root`

Regles:

- ignorer les champs non supportes
- warning dedoublonne si forme invalide
- pas d'event interne emis pendant `update`

## Contrat adapter (minimum image)

Le composant `image` consomme au minimum:

- creation fragment/template
- application `style`, `className`, `attr` sur un node cible
- application `src` et `alt` sur node media
- application `object-fit` sur node media
- attachement listeners DOM (si contexte DOM)

## Policy d'erreur

Regle generale:

- runtime permissif
- erreur locale capturee, warning auteur, runtime global continue

Warnings recommandes:

- `W_IMAGE_INIT_FAILED`
- `W_IMAGE_UPDATE_FAILED`
- `AUTHOR_IMAGE_SRC_MISSING`
- `AUTHOR_IMAGE_SRC_INVALID`
- `AUTHOR_IMAGE_FIT_MODE_INVALID`
- `AUTHOR_IMAGE_ACTION_INVALID`

## Invariants V1

- rendu de reference `div + img`
- `style` auteur applique par defaut sur `root`
- `fitMode` pilote `object-fit` du `media`
- `emit` attache au `root` au `init`
- `update` recoit une action deja agregee et resolue

## Exemple auteur

```ts
{
  id: 'hero-cover',
  type: 'img',
  initial: {
    src: '/assets/cover.jpg',
    alt: 'Cover image',
    fitMode: 'wallpaper',
    className: 'hero-cover',
    style: { width: '100%', height: '100%' }
  },
  emit: [
    {
      click: {
        events: ['cover:clicked'],
        data: { zone: 'hero' }
      }
    },
    {
      error: {
        events: ['cover:load-error']
      }
    }
  ],
  actions: {
    'cover:as-sprite': {
      fitMode: 'sprite'
    },
    'cover:switch': {
      src: '/assets/cover-2.jpg',
      alt: 'Cover image alternative'
    }
  }
}
```

## Tests smoke recommandes

1. init construit `root(div)` + `media(img)`
2. init `fitMode=wallpaper` => `object-fit: cover`
3. init `fitMode=sprite` => `object-fit: contain`
4. init sans `src` => warning auteur, runtime continue
5. `update.src/alt/fitMode` met a jour `media`
6. `update.style/className/attr` met a jour `root`
7. `emit.click/error` attache et emet les events publics attendus
