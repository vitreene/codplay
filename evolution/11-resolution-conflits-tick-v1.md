# Resolution de conflits au meme tick - V1

## 1) Portee

Ce document fixe la resolution deterministe quand plusieurs events impactent la meme cible
au meme tick (`ms` identique).

References:

- ordonnancement global: `evolution/02-specifications-engine-v1.md` (section 5)
- priorite inter-machines: `evolution/06-machines-et-traces-v1.md` (section 4)
- registre reasons/codes: `evolution/15-registre-erreurs-v1.md`

## 2) Ordre de base (avant conflits)

Le tri d'execution est applique dans cet ordre:

1. `ms` croissant
2. `track.order` croissant
3. `event.index` croissant
4. `source=user` apres `story/system` a egalite

Si l'ordre ci-dessus suffit a departager, il n'y a pas de conflit.

## 3) Conflit de commandes globales vs locales

Regle prioritaire:

1. systeme/runtime
2. player global
3. scenario/story
4. playable/item local

Effet:

- une commande globale peut neutraliser une commande locale incompatible
- trace obligatoire de la commande locale rejetee (`REJECTED`, `reason=GLOBAL_COMMAND_PRECEDENCE`)

## 4) Conflits d'actions sur un meme item

## 4.1 `style`

- fusion par propriete CSS
- sur une meme propriete, la derniere action dans l'ordre d'execution gagne
- trace d'ecrasement: `reason=STYLE_OVERRIDDEN_SAME_TICK`

## 4.2 `className`

- operations normalisees en delta `{ add[], remove[] }`
- conflit add/remove meme classe au meme tick: la derniere operation gagne
- classe dupliquee ignoree (idempotent)

## 4.3 `attr`

- merge par cle
- derniere valeur gagne sur la meme cle

## 4.4 `move`

- plusieurs `move` au meme tick sur la meme cible: dernier `move` gagne
- les moves precedents sont traces comme ecrases (`reason=MOVE_OVERRIDDEN_SAME_TICK`)

## 4.5 `media`

- ordre interne force: `rewind` > `seek` > `pause` > `play`
- si plusieurs commandes media coexistent, garder la plus prioritaire
- trace des commandes non retenues: `reason=MEDIA_COMMAND_OVERRIDDEN`

## 5) Conflits scenario wait

- un seul gate wait actif par story source
- `scenario:wait:start` concurrent sur meme source:
  - premier event applique
  - suivants rejetes `WAIT_ALREADY_ACTIVE_FOR_STORY`
- `scenario:wait:resolve` sans handle actif -> `WAIT_HANDLE_NOT_FOUND`

## 6) Conflits track toggle

- `track:enabled` et `track:disabled` au meme tick pour meme `trackId`:
  - dernier event gagne selon ordre d'execution global
  - trace d'ecrasement: `reason=TRACK_STATE_OVERRIDDEN_SAME_TICK`

## 7) Sortie de trace minimale en cas de conflit

Chaque conflit doit produire:

- une ligne `APPLIED` pour la decision finale
- une ligne `REJECTED` pour chaque action perdante
- payload avec `winnerEventId` et `loserEventId` quand disponible

## 8) Invariant de determinisme

- meme entree (scene + tracks + events + mode) => meme gagnant/perdant sur conflits
- toute regle de departage ajoutee doit etre documentee ici avant implementation
