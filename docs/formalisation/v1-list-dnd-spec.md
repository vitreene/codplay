# List DND spec V1 - drag-and-drop positionne entre listes

## Statut

Spec normative V1 pour le drag-and-drop d'un item entre composants `list`,
avec insertion a un index precis (pas seulement en fin de liste).

## Objectif

Fixer le contrat qui permet a un auteur de scene de declarer un item
deplacable entre listes par pointeur, sans jamais exposer de geometrie, de
node runtime, ou de mecanisme d'attachement specifique a l'auteur. Ce
mecanisme est un cas particulier de capture (`v1-capture-spec.md`), jamais
un canal separe : tout ce qui suit s'ajoute a ce contrat, ne le remplace pas.

## Definition

- Un item deplacable entre listes declare une capture pointeur ordinaire
  (`emit.pointerdown.capture`) ; rien dans `PersoDoc`/`ListConfig` ne porte
  d'information de dnd.
- Le guard de disponibilite (l'item est-il draggable, vers quelles listes)
  est entierement porte par `initCaptureState`, via le champ conventionnel
  `captureState.dropIn: string[]` — la liste des id de listes candidates
  pour cette capture. Codplay ne lit jamais que ce seul champ ; capacite de
  liste, regles d'eligibilite, ou toute autre logique applicative restent
  entierement a la charge de l'auteur, dans son propre `state`.
- `capture.ghost?: { className?: string; style?: Record<string, string |
  number> }` declare le style optionnel d'un placeholder visuel montre
  pendant le drag, insere a l'endroit ou l'item atterrirait s'il etait
  relache maintenant. Dimensions toujours calquees sur celles du node
  drague, imposees par le runtime, independamment de `ghost` — l'auteur ne
  peut styler que l'apparence, jamais la taille.
- Sans `trackCommand` declare, le suivi 1:1 du pointeur ne s'applique pas a
  un item en cours de drag-and-drop de liste : le node suit le pointeur en
  position fixe geree par le runtime, pas par le canal `position` par
  defaut d'une capture ordinaire (`v1-capture-spec.md`) — les deux se
  substituent, jamais ne se cumulent.

## Preview — jamais materialise, jamais rejoue au seek

- Tant que `captureState.dropIn` est un tableau, chaque `pointermove`
  produit, en plus (ou a la place) d'`action`/`position`, un canal `dnd`
  distinct portant `clientX`/`clientY`/`candidateListIds` (= `dropIn`)/
  `ghost` — jamais un `event`, jamais materialise en track, jamais rejoue
  au seek : memes garanties que tout le tracking d'une capture
  (`v1-capture-spec.md` regle 4).
- Ce canal resout, par hit-test geometrique contre les enfants montes de
  chaque liste candidate (jamais expose a l'auteur), la liste cible et
  l'index d'insertion que le point de pointeur courant designerait, puis
  positionne le ghost a cet endroit.
- Le hit-test applique une hysteresis autour de la derniere cible resolue :
  un pointeur immobile ne doit jamais faire osciller la cible resolue sur
  un jitter sous-pixel — la resolution d'un index deja retenu exige que le
  point depasse nettement la frontiere consideree, pas seulement au pixel
  pres.
- Les enfants reels d'une liste ne sont jamais reordonnes pendant la
  preview : seul le ghost (jamais un perso, jamais suivi par les
  registries ni par le moteur FLIP) occupe la place resolue. L'ordre reel
  des enfants ne change qu'au commit.

## Commit — une action `move` ordinaire, rien de plus

- Au relachement (`endOn`), la resolution finale (liste cible + index)
  reutilise le cache deja etabli par la preview — jamais un nouveau
  hit-test a cet instant precis, pour rester coherent avec ce que le ghost
  a visuellement montre a l'utilisateur jusque-la.
- Si le point de relachement ne designe aucune liste candidate, la
  resolution finale retombe sur la liste et l'index d'origine du drag
  (avant tout deplacement) : un drop hors zone ramene toujours l'item a sa
  place de depart, jamais un etat detache.
- Cette resolution peuple `captureState.move = { parentId, mode,
  flipMode: 'overlay-world' }` (`parentId`/`mode` = liste/index resolus) et
  `captureState.persoId`, avant que `endEmit` ne materialise son event —
  jamais une action ou un event specifique au dnd : `move` est l'action
  ordinaire deja normative pour tout deplacement de perso entre parents
  (`v1-move-separation-policy-state-backend-dom.md`), integralement prise
  en charge par le module `move`/le moteur FLIP existants (detachement,
  attachement a l'index resolu, animation rotation/ancetres-aware,
  seek-safe par construction) — aucune logique d'attachement, de
  detachement, ou d'animation propre au dnd n'existe en dehors de ce
  chemin deja normatif.
- L'auteur declare `perso.actions[endEmit.name] = {}` (vide) : cette
  declaration n'active que la fusion action-statique + payload d'event
  deja normative (`v1-perso-spec.md`, "policy de fusion shallow") — `move`
  vient entierement du payload (`captureState`), jamais d'une valeur figee
  a l'authoring, puisque la liste/l'index cibles ne sont connus qu'a
  l'execution.
- Un Strap qui doit reagir au resultat d'un drop ecoute directement l'event
  d'`endEmit` de la capture via `story.listen`/`scene.listen` — routage par
  nom, independant de toute action perso, identique a n'importe quel autre
  event applicatif (`v1-event-spec.md`). Il lit `event.data.persoId`/
  `event.data.move.parentId` pour identifier l'item deplace et sa liste
  d'arrivee.

## Invariants

- Le tracking dnd (position du pointeur, hit-test, ghost) n'est jamais
  materialise en track ni rejoue au seek — memes garanties que tout
  tracking de capture (`v1-capture-spec.md` regle 4).
- Le commit d'un drop est toujours une action `move` ordinaire : aucun
  mecanisme d'attachement/detachement/animation specifique au dnd n'existe
  en dehors de ce que le module `move`/le moteur FLIP fournissent deja pour
  tout deplacement de perso.
- `dropIn` est le seul champ que codplay lit dans `captureState` pour ce
  mecanisme ; toute autre donnee applicative (capacite, regles de jeu)
  reste entierement a la charge de l'auteur.
- Le ghost n'est jamais un perso, jamais suivi par les registries ni par le
  moteur FLIP — un noeud DOM que le mecanisme de preview possede seul.
- Un drop hors de toute liste candidate ramene toujours l'item a sa liste
  et son index d'origine, jamais un etat detache.

## Exemple applique — deux listes, items reordonnables

```ts
const LIST_IDS = ['list-a', 'list-b'] as const

function makeItemPerso(id: string): PersoDoc {
  return {
    id,
    type: 'text',
    initial: { move: { parentId: 'list-a' } },
    emit: {
      pointerdown: {
        event: { name: 'item:drag:start', cascade: true },
        capture: {
          initCaptureState: () => ({ dropIn: [...LIST_IDS] }),
          endEmit: { name: `item:dropped:${id}` }
        }
      }
    },
    actions: {
      // Vide a dessein : active seulement la fusion action-statique +
      // payload d'event — `move` vient entierement de `captureState`.
      [`item:dropped:${id}`]: {}
    }
  }
}
```

```ts
const straps: StrapCollection = {
  'on-item-dropped': ({ event }) => {
    const data = event.data as { persoId: string; move: { parentId: string } }
    // ... reaction applicative au deplacement (ex: mise a jour d'un compteur)
  }
}

listen: [
  { on: 'item:dropped:item-1', straps: ['on-item-dropped'] }
  // ... une regle par item, le nom d'event n'est jamais partage entre items
]
```

Ce que cet exemple illustre :

- aucune donnee de dnd sur le `PersoDoc` : seule la declaration `capture`
  la porte
- `actions[eventName]` reste vide — la resolution `move` est entierement
  dynamique, jamais figee a l'authoring
- le Strap ne lit que le `data` de l'event `endEmit`, sans jamais toucher a
  un node, une liste, ou une geometrie quelconque
