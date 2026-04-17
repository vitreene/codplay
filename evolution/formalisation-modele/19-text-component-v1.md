# Text component V1

## Statut

Reference V1 pour le composant `text`.

## Preambule - intention

Le composant `text` fournit une brique simple pour afficher et mettre a jour du texte dans une scene.

Le composant doit:

- respecter le contrat base composant V1
- rester declaratif
- supporter interactions utilisateur via `emit`
- rester compatible DOM et adaptable hors DOM

## Portee

Ce document couvre:

- le contrat de donnees `text` (`initial`, `actions`, `emit`)
- le comportement `init`, `render`, `update`
- les warnings minimaux

## Hors perimetre V1

- edition riche (HTML arbitraire)
- mise en page avancee multi-nodes
- comportement list/reparent specialise

## Dependances normatives

- `16-base-component-v1.md`
- `17-user-events-emit-v1.md`
- `03-event-model.md`

## Identite composant

- `persoType`: `text`
- 1 instance composant par `Perso` de type `text`

## Donnees d'entree auteur

## initial

Champs supportes:

- `tag?`: tag HTML du root (defaut `p`)
- `id?`: id DOM optionnel
- `className?`: classe initiale
- `style?`: style initial
- `attr?`: attributs initiaux
- `content?`: contenu texte initial

Regles:

- `content` est rendu en texte brut (`textContent`), jamais comme HTML interprete
- si `tag` absent, utiliser `p`

## actions

Actions supportees par `update`:

- patch de base: `style`, `className`, `attr`
- `content` (mise a jour du texte)
- `move` (mecanisme commun d'insertion DOM, cf. `16-base-component-v1.md`)

Forme recommandee:

```ts
type TextAction = {
  style?: Record<string, unknown>
  className?: string | { add?: string; remove?: string }
  attr?: Record<string, unknown>
  content?: string
}
```

## emit

`emit?` suit la spec:

- `17-user-events-emit-v1.md`

Regle:

- les listeners utilisateur sont attaches au root node au `init`

## Comportement runtime

## constructor(input)

- stocke `persoId`, adapter, reporter warning
- initialise l'etat interne minimal

## init(initial)

1. creer le root node (`tag` ou `p`)
2. appliquer `id`, `className`, `style`, `attr`
3. appliquer `content` vers `textContent`
4. normaliser puis attacher `emit` (si present) via `handleEvent(event)`

## render()

- retourne le root node unique du composant

## update({ persoId, eventId, eventSeq, action })

Ordre recommande d'application:

1. `content` (si present)
2. patch base `style/className/attr`

Regles:

- ignorer les champs non supportes
- signaler warning auteur dedoublonne si forme invalide
- ne pas emettre d'event interne pendant `update`

## Contrat adapter (minimum text)

Le composant `text` consomme au minimum:

- creation node (`createElement` ou equivalent)
- application `style`
- application `className`
- application `attr`
- application `textContent`
- attachement listeners DOM (si contexte DOM)

## Policy d'erreur

Regle generale:

- runtime permissif
- erreur locale capturee, warning auteur, runtime global continue

Warnings recommandes:

- `W_TEXT_INIT_FAILED`
- `W_TEXT_UPDATE_FAILED`
- `AUTHOR_TEXT_CONTENT_INVALID`
- `AUTHOR_TEXT_ACTION_INVALID`

## Invariants V1

- un composant `text` ne gere qu'un root node
- `content` est textuel (pas HTML)
- `emit` est attache au root au `init`
- `update` recoit une action deja agregee et resolue

## Exemple auteur

```ts
{
  id: 'title-main',
  type: 'text',
  initial: {
    tag: 'h1',
    className: 'title',
    content: 'Bienvenue',
    style: { opacity: 0 }
  },
  emit: [
    {
      click: {
        events: ['title:clicked'],
        data: { section: 'hero' }
      }
    }
  ],
  actions: {
    'title:show': {
      style: { opacity: { to: 1, duration: 300 } }
    },
    'title:update': {
      content: 'Bienvenue !'
    }
  }
}
```

## Tests smoke recommandes

1. init avec `tag` absent => root `p`
2. init avec `content` => `textContent` present
3. `update.content` met a jour le texte
4. `update.style/className/attr` applique les patches
5. `emit.click` attache et emet les events publics attendus
6. action invalide ignoree + warning dedoublonne
