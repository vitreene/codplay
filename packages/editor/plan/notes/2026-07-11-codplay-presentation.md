# Codplay — présentation

Explication par l'image : **de quoi Codplay est fait** (sa structure : scène, stories, persos) **et quelle est sa logique** (les events qui y circulent) — les deux dans un même schéma. La structure est l'anatomie ; l'event est ce qui la fait vivre. Support d'un futur rendu graphique ; le texte est la légende du schéma. Vocabulaire Codplay (scène, story, perso, event, strap) — distinct du vocabulaire auteur (item, capsule), qu'il ne connaît pas.

---

## Le schéma — la structure, et l'event qui la traverse

```
   TELCO  ── pilote de l'extérieur : play/pause/seek, emit(event) ──┐
                                                                     │
   ╔═════════════════════════════════════════════════════════════╗  │
   ║                          SCÈNE                               ║  │
   ║  racine d'orchestration · state · listen · scene-straps      ║  │
   ║                                                              ║  │
   ║   ┌────────────────────────┐     ┌────────────────────────┐  ║  │
   ║   │        STORY A         │     │        STORY B         │  ║  │
   ║   │  state · listen        │     │  state · listen        │  ║  │
   ║   │  story-straps          │     │  story-straps          │  ║  │
   ║   │                        │     │                        │  ║  │
   ║   │  persos  ── ce qui      │     │  persos                │  ║  │
   ║   │  (texte,   est rendu    │     │  eventimes             │  ║  │
   ║   │   image,  dans le DOM   │     │                        │  ║  │
   ║   │   liste…)              │     │                        │  ║  │
   ║   │  eventimes ── déclen-   │     │                        │  ║  │
   ║   │            cheurs sur   │     │                        │  ║  │
   ║   │            la timeline  │     │                        │  ║  │
   ║   └────────────────────────┘     └────────────────────────┘  ║  │
   ╚═════════════════════════════════════════════════════════════╝  │
                                                                     │
   ───────────────────────────────────────────────────────────────  │
   CE QUI CIRCULE : l'EVENT                                          │
                                                                     ▼
     source ──► EVENT ──► listen ──► transform ─► straps ─► emit ──► perso
     (eventime  {name,     (filtre    (change    (compor-  (émet    (action
      = temps,   data,      d'une      data)      tement)   d'autres → mutation
      telco,     context}   story ou              pur       events)   → DOM)
      strap)                de la scène)
                    │
                    └─► ou directement une ACTION nommée sur un perso ─► DOM

   seek : rejoue les events déjà matérialisés → reconstruit un état
          (ne ré-exécute ni straps ni logique)
```

Deux lectures d'une même image :

- **De quoi c'est fait (vertical)** : une **scène** contient des **stories** ; chaque story contient des **persos** (ce qui est rendu), des **eventimes** (déclencheurs temporels), et des règles **listen** avec ses **straps**. La scène et les stories ont chacune leur `state`, leur `listen`, leurs straps.
- **Ce qui la fait vivre (horizontal)** : un **event** naît (du temps, de la telco, d'un strap), traverse le pipeline `listen → transform → straps → emit`, et finit en mutation d'un **perso** dans le DOM — ou déclenche directement une **action** sur un perso.

La structure est le **où** ; l'event est le **comment**. Codplay = ces objets + cette circulation.

---

## Légende — les objets (de quoi Codplay est fait)

### La scène

La **racine d'orchestration**. Elle ne fait pas de hiérarchie visuelle entre les stories — elle les déclare et coordonne. Elle porte :
- **stories** — les stories disponibles ;
- **listen** — ses règles réactives (filtres d'events, orchestration entre stories) ;
- **scene-straps** — les comportements de niveau scène (cross-stories, effets globaux) ;
- **state** — un état de niveau scène (partagé, distinct de celui des stories) ;
- **init**, **tracks** — initialisation et métadonnées.

### La story

L'unité **portable** : elle se déplace avec son contenu, indépendamment de son placement visuel. Elle contient :
- **persos** — ses composants visuels (ce qui est rendu dans le DOM) ;
- **eventimes** — ses déclencheurs placés sur la timeline (le temps qui émet des events) ;
- **listen** — ses règles réactives, résolues en `transform → straps → emit → persos` ;
- **story-straps** — ses comportements propres, portables avec elle ;
- **state** — son état local.

### Le perso

Le **composant visuel** — ce qu'est devenu, au build, l'item ou la capsule de l'auteur (toute capsule devient une **liste**). Il répond à des **actions** nommées ; le runtime les applique sur le DOM selon son type : texte, image, média, liste, layout, input.

---

## Légende — l'event (la logique)

L'event est **le cœur logique**. Une **enveloppe unique** (`{name, data?, context, applyAtMs}`) sert partout : compilation, exécution, replay, observation. Un event **ne fait rien seul** — il *déclenche*.

**Ses trois sources** :
- **eventime** — le **temps** : un déclencheur sur la timeline émet son event à l'instant voulu. C'est par là que la scène se déroule seule.
- **telco** — la **surface de pilotage externe** : opère le player du dehors (play/pause/seek) et **injecte** des events (`emit`). La télécommande de la scène.
- **strap** — un comportement qui émet des events en réaction.

**Son parcours** — le pipeline `listen` (d'une story ou de la scène) : `transform` (transforme la donnée) → `straps` (déclenche des comportements) → `emit` (émet d'autres events) → **persos**. Ou, plus court : l'event déclenche directement une **action** nommée sur un perso.

**Le strap** — l'unité de comportement : une **fonction pure déclenchée par un event**, qui émet events/actions ou planifie des occurrences. Deux niveaux : **story-strap** (portable avec sa story) et **scene-strap** (orchestration globale). Pur : il ne touche pas le DOM, il *décrit* ; le runtime exécute.

**Le seek** — l'enveloppe unique rend le replay possible : rejouer les events matérialisés reconstruit un état à un instant, **sans** ré-exécuter les straps ni la logique.

---

## Le point clé — structure stable, logique événementielle, contexte ignoré

- **La structure est déclarative** : une scène et ses stories décrivent *ce qui existe* (persos, eventimes, listen). Elles ne « tournent » pas — elles sont traversées par des events.
- **La logique est l'event** : rien ne se produit sans qu'un event circule. Le player ne fait que **cadencer** cette circulation dans le temps.
- **Le contexte est ignoré** : Codplay ne mesure ni taille, ni orientation, ni support — ça n'entre pas dans le moteur. La résolution du contexte est portée par le CSS produit en amont, ou par des composants qui observent.

Deux conséquences : Codplay est **autonome à la diffusion** (la scène compilée se suffit, la telco l'opère du dehors sans y être requise), et le **Builder résout tout en amont** (vocabulaire auteur et dépendances au contexte traduits *avant* d'arriver ici). Codplay ne reçoit qu'une scène — objets + events — prête à jouer.
