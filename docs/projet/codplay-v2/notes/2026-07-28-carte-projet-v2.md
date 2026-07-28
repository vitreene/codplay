# Codplay V2 — carte du projet : ce qui est conservé, ce qui est revu

Le corpus V2 est devenu conséquent et on perd de vue qu'il s'agit d'une **mise à jour**. Cette page rend
la vue d'ensemble : pour chaque domaine fonctionnel de codplay, elle dit si le **concept** change ou non,
et où la question est développée.

**Aucune duplication.** Cette page ne développe rien : elle classe et elle cite. En cas d'écart, le
document cité fait foi.

## L'articulation — engine, SceneDoc, player, render

Deux lignes qui se rejoignent au player, reliées en amont par une **déclaration de besoins**. C'est le
squelette dans lequel tout le reste de cette page vient se ranger.

```
                          ┌──────────────────────────────────► export
                          │  (transcript, SCORM, autre système)
  SceneDoc ──[builder]──► CompiledScene ────────────────┐
  auteur,                 résolu, sanitisé,             │
  sérialisable            + besoins déclarés            │
                                 │                      ├──► player ──► render
                       déclare   │                      │    évalue      projette sur
                                 ▼                      │    f(scène,t)  un substrat
                            engine ─────────────────────┘
                            fournit les capacités
                            et ressources demandées
```

**Une sortie latérale, avant le player** : l'**export** consomme la donnée sans passer par l'exécution —
depuis le `SceneDoc` quand on veut l'**intention** (transcript, transcription vers un autre système),
depuis le `CompiledScene` quand on vise une **exécution fidèle** ailleurs. Il ne demande rien au moteur, la
donnée étant sérialisable et lisible. Développé dans `../../notes/2026-07-28-note-generale-projet.md` §5.

**L'engine ne pilote pas le `SceneDoc`** : il ne le lit pas, ne le précède pas, et le builder ne consulte
aucune capacité pour compiler. Le lien va **de la scène vers l'engine** — la scène **déclare** les
ressources et capacités qu'elle réclame, l'engine les fournit. Le player reste le point de rencontre : la
scène compilée d'un côté, les capacités et ressources de l'autre.

**Le précédent existe** : `builder/extract-resource-manifest.ts` parcourt les persos et en dérive un
`ResourceManifest` — le builder dit déjà quelles *ressources* la scène réclame. L'étendre aux *capacités*
est le même geste : le builder valide déjà les types de perso employés, il ne les émet pas encore comme
une liste d'exigences.

Deux conséquences :
- **La provision cesse d'être paresseuse pour devenir déclarée.** L'engine prépare exactement ce que la
  scène annonce, au lieu d'instancier à la première demande. La résolution passe à la compilation —
  cohérent avec la question ouverte §4.6 de `conduite-chantier-v2.md`.
- **Un mode d'échec propre, à un endroit propre.** La scène déclare, l'engine répond s'il détient : la
  vérification a lieu **avant lecture**, hors chemin chaud, selon le partage « le builder sanitise, le
  player fait confiance » (§4.7). Réserve : cela couvre « l'engine ne détient pas la capacité », non « le
  dispositif refuse à l'exécution » — la classe d'échec que
  `2026-07-27-emetteurs-et-events-user-complexes.md` §4 laisse ouverte reste entière.

L'indépendance des deux lignes vis-à-vis du *rendu* est par ailleurs ce qui rend la chaîne de compilation
déplaçable — elle peut vivre ailleurs que dans le bundle de diffusion, question ouverte au §8 de
`2026-07-28-decoupage-engine-instances-pilotage.md`.

| Station | Ce qu'elle possède | Ce qu'elle ne fait jamais |
|---|---|---|
| **engine** | Le **catalogue** des capacités (types de perso, modules, services, adapters, bindings tiers) et les **ressources partagées** : horloge, ordre de tick, cache de preload, styles injectés. Il **fournit** ce que les scènes déclarent, aux N players. | Ne joue aucune scène, ne rend rien, ne décide d'aucune orchestration, ne lit pas le `SceneDoc`. |
| **SceneDoc → CompiledScene** | L'œuvre telle qu'écrite, sérialisable. Le **builder** est le lieu de **résolution et de validation** : il tourne une fois, hors chemin chaud, garantit un artefact propre, et en **dérive les besoins** que l'engine devra fournir. | Ne porte pas la cible de montage, ne s'exécute pas, ne consulte pas le catalogue pour compiler. |
| **player** | La **matérialisation** des events et l'**évaluation** de l'état à `t` : `materialize → resolve → solve`. Il calcule un état perso. | Ne touche pas au substrat, ne se défend pas contre ses entrées (le builder l'a fait). |
| **render** | La **Projection** : `project → render`, seul écrivain vers le substrat, via des capacités déclarées (`set`, `measure`, `mount`). Le DOM en est *une*. | N'interprète pas la scène, ne remonte jamais vers le perso. |

Trois règles traversent cette chaîne :

- **Sens unique.** `item → perso → node` ne s'inverse jamais ; une capture lit l'état logique, jamais le
  node de rendu.
- **Un seul écrivain.** Un état, un `set`, unifié dans `component.update`.
- **Ce qui est partagé s'arrête à l'engine.** Tout le reste — scène, état, racine de mesure, modules
  instanciés — appartient à une instance.

Développement : `2026-07-16-solve-project-moteur-custom.md` (le flux, la Projection),
`2026-07-28-decoupage-engine-instances-pilotage.md` (l'engine et les instances),
`conduite-chantier-v2.md` §4.7 (le partage builder / player sur la robustesse).

## Comment lire ce classement

**« Réécrit » n'est pas « revu ».** `2026-07-26-conduite-chantier-v2.md` §1 tranche une **réécriture
franche**, sans cohabitation de runtimes : *tout* le code est réécrit. La distinction utile n'est donc pas
au niveau du code mais du **concept**.

| Statut | Sens |
|---|---|
| **Conservé** | Le concept ne change pas. Le code est réécrit, mais rien n'est à re-concevoir : la spec V1 fait foi. |
| **Revu** | Le concept change. Un document V2 le porte, cité en regard. |
| **À statuer** | Ni revu par le corpus V2, ni explicitement confirmé comme conservé. |

**Fondement du classement, à connaître pour s'en méfier** : il est **dérivé du corpus**. Un domaine que
le corpus V2 ne revise pas est porté « conservé » par défaut. Cette déduction est bonne comme point de
départ, pas comme décision — les lignes « conservé » relèvent d'une confirmation de l'auteur, et les
lignes « à statuer » signalent les endroits où le corpus est muet plutôt qu'un manque à combler.

**Filet de sécurité commun à tous les statuts** : `2026-07-26-conduite-chantier-v2.md` §2 pose les tests
V1 comme **oracle anti-régression**, y compris pour les domaines conservés — leur concept ne change pas,
donc leurs tests restent valides à l'identique.

**Ce qui ne franchit pas la frontière** : un **signalement de défaut V1** n'est pas une entrée du projet
réécrit, qui s'appuie sur ses propres tests. Un bug non reproduit relève du code qui disparaît, pas de la
conception qui le remplace. Distinct de l'oracle ci-dessus, qui porte sur le *comportement* attendu et
reste valide. Distinct également des **dispositifs risqués** recensés dans
`2026-07-28-decoupage-engine-instances-pilotage.md` §7 : ce sont des constats de **structure** — ce qu'il
ne faut pas reproduire — non des défauts à corriger.

## Conservé — le concept ne change pas

| Domaine | Spec V1 | Ce qui le confirme |
|---|---|---|
| **Track manager** | `v1-track-manager-spec.md` | Aucune modification substantielle souhaitée. Un ajout hors du mécanisme : la **propriété de piste au seek-back** (`clear-ahead`/`persist`, `2026-07-26-etat-fonction-de-t.md`). La piste est par ailleurs l'un des supports possibles d'une **série d'events produisant une lecture différente** (`2026-07-28-decoupage…` §4), sans que cela touche son mécanisme. |
| **Média / horloge de média** | `v1-component-api.md`, `media-sync` | `conduite-chantier-v2.md` §10 #1 : « Déjà résolu — **acquis à PRÉSERVER** ». Master sélectionnable, sync par correction de dérive, runtime pur. Vis-à-vis de `f(t)` : effet à side-effect corrigé, cas déjà prévu. « La V2 préserve ce patron, ne le réinvente pas. » |
| **Injection de librairies tierces** | `v1-third-party-runtime-spec.md` | §9 : « **acquis à PRÉSERVER** et vérifier ». Seul déplacement : le point de déclaration remonte à l'engine — `2026-07-28-decoupage-engine-instances-pilotage.md` §7.7. |
| **Contrat module / service** | `v1-module-api.md`, `v1-component-api.md` | §4.3 : « **DÉJÀ SPÉCIFIÉS, à respecter (pas un trou)** », « la V2 **applique** ce contrat, ne le réinvente pas ». Sous réserve de l'audit §4.3 (3 modules sur 6 hors contrat) — l'audit décide si le contrat est *le* patron unique, il ne le remet pas en cause. |
| **Effets à side-effect** | `v1-scene-side-effects-api.md` | `2026-07-26-etat-fonction-de-t.md` : catégorie des **irréductibles**, explicitement maintenue comme rejeu filtré. |
| **Fins narrative et technique** | `v1-scene-spec.md` §9 | `scene:end` (fin métier) / `sequence:end` (fin technique) : vocabulaire déjà normatif, réemployé tel quel — voir `2026-07-28-decoupage-engine-instances-pilotage.md` §4. |
| **Contrat d'event** | `v1-event-spec.md` | Non revisé. Ce qui change est le *canal* (façade §6) et les *sources* d'émission (voir « Revu »), pas la forme d'un event. |
| **Chaînage d'actions** | `v1-action-sequence-spec.md` | Non revisé. Un ajout : la déclaration d'une émission sur ses phases — `2026-07-28-decoupage-engine-instances-pilotage.md` §4. |
| **Straps** | `v1-strap-spec.md` | Absent du corpus V2. Conservé par défaut ; à confirmer. |
| **Story / scène** | `v1-story-spec.md`, `v1-scene-spec.md` | Absents du corpus V2 hors §9 ci-dessus. Conservés par défaut ; à confirmer. |
| **Référentiel** | `v1-glossaire.md`, `v1-invariants.md`, `v1-validation.md` | Non revisés. `v1-invariants.md` reste à lire avant toute modification du cœur. |

## Revu — le concept change

| Domaine | Spec V1 | Nature du changement | Où c'est développé |
|---|---|---|---|
| **Flux du player** | `v1-player-api.md` | `materialize → resolve → solve → project → render`. Le player calcule un **état**, les composants le projettent. | `2026-07-16-solve-project-moteur-custom.md` S5/S7 (points 1, 4) |
| **Projection `item → perso → node`** | `v1-perso-spec.md` | Sens unique, jamais inversée. Toute capture lit l'**état logique**, jamais le node. | idem, S1 (point 2) |
| **Moteur d'interpolation** | `v1-tween-action-spec.md` | Retrait d'anime.js : algos purs empruntés, runtime à état rejeté. `solve(from,to,ease,t)` pure. | idem, S2-S4/S6 (point 3) |
| **Substrat de rendu** | `v1-render-adapter-spec.md`, `v1-component-api.md` | La **Projection** : cible de rendu déclarée, exposant `set`/`measure`/`mount`. Le DOM devient *une* Projection. | idem, S8 (point 5) |
| **Seek** | `v1-seek-spec.md` | D'un rejeu à une **évaluation** de `f(scène, t)`, donc **synchrone** et réversible. | `2026-07-26-etat-fonction-de-t.md` ; `2026-07-26-portabilite-contrainte-redaction.md` (synchronicité) |
| **Capture** | `v1-capture-spec.md` | Troisième **producteur d'état perso** (à côté de solve), à prévoir dès la conception du `PersoState` ; cesse de se greffer sur le canal d'animation. | `conduite-chantier-v2.md` §4ter |
| **Façade du player** | `v1-player-api.md`, `v1-author-api-spec.md` | De façade plate à **canaux typés à droits différenciés** : telco / injection / authoring / cycle de vie / observation. | `conduite-chantier-v2.md` §6 |
| **Canal de pilotage** | `v1-player-api.md` | Les **events comme contrat primaire** ; authoring hors protocole ; règle de sérialisabilité. | `2026-07-28-decoupage-engine-instances-pilotage.md` §4 |
| **Registres** | `v1-registry-api.md` | Les capacités deviennent un **catalogue déclaré par l'engine**, plus un câblage par instance. | idem §2, §3 |
| **Preload** | `v1-preload-api.md` | **Capacité de Projection** (neutralisable), plus deux modes de sélection de ressource (déléguée / forcée par intention). Le **cache** est un bien commun de l'engine ; la **stratégie** revient à qui sait à l'avance (orchestrateur, éditeur) — le preload de codplay ne sert que la **diffusion autonome**. | `conduite-chantier-v2.md` §10 #2 ; `2026-07-28-decoupage…` §2 |
| **Viewport / resize** | — | Résolu **dans la Projection** : cq* passif, unitless resize-sensible avec cadre fixe et whitelist en config. | `2026-07-26-unitless-resize-resolution.md` ; `conduite-chantier-v2.md` §10 #3 |
| **Sources d'émission** | `v1-event-spec.md`, `v1-capture-spec.md` | `endEmit` **libéré de `endOn`** : émettre sur la transition d'une phase déclarée. Émetteur = capacité déclarée. | `2026-07-27-emetteurs-et-events-user-complexes.md` ; `2026-07-28-decoupage…` §4 |
| **Portée d'un event** | `v1-event-spec.md` | `cascade: boolean` (story / scene) devient une **échelle nommée**, extensible d'un cran « sort de la scène » — qui *est* la déclaration de surface publique. Ce cran n'a pas de destinataire : les scènes ne communiquent pas entre elles, seul Sighty le fait. **Noms provisoires**, à fixer du côté de la visibilité et non du transport ; proposition non tranchée : `visibility: 'story' \| 'scene' \| 'public'`. | `2026-07-28-decoupage…` §4 |
| **Perso hôte** | `v1-perso-spec.md` | Un perso dont le contenu n'est pas fonction de son `t` : flux direct, instance imbriquée, composant tiers. | `2026-07-27-emetteurs…` §6 ; `2026-07-28-decoupage…` §5 |
| **Multi-instances** | — | Trois étages engine / factory de `CompiledScene` / instance ; horloge et ordre de tick partagés ; seek atomique sur un ensemble. | `2026-07-28-decoupage-engine-instances-pilotage.md` |
| **Propriété de la boucle** | `v1-third-party-runtime-spec.md` §1, `v1-render-adapter-spec.md` | Le **ticker devient délégable** : l'engine sait être piloté par un hôte via la silhouette `RenderAdapter`, comme il pilote un tiers. La règle « unique source d'avancement » porte sur l'unicité, non sur la propriété. | `2026-07-28-decoupage…` §2 |
| **Robustesse** | `v1-error-catalog.md` | Trois lieux séparés : player sans code défensif, **builder qui sanitise**, **moteur de warning** distinct orienté auteur. | `conduite-chantier-v2.md` §4.7 |
| **Structuration du code** | — | Dossiers dictés par le flux ; injection unifiée ; dédoublements traités comme concepts manquants. | `conduite-chantier-v2.md` §4 |
| **Typage** | — | Les `unknown` étaient de l'indétermination désormais résolue par les cas d'usage : remontée des cas vers les types. | `2026-07-26-portabilite-contrainte-redaction.md` |

## À statuer — le corpus V2 est muet

| Domaine | Spec V1 | Remarque |
|---|---|---|
| **Layout** | `v1-layout-spec.md` | Touché indirectement par la Projection (positionnement, mesure) sans être revisé en propre. |
| **Listes** | `v1-list-spec.md`, `v1-list-dnd-spec.md` | La liste suit ses mécanismes sous-jacents (capture, `move`, FLIP), tous revus ; son propre concept n'est pas discuté. |
| **Horizon** | `v1-horizon-spec.md` | Non abordé par le corpus V2, alors que `f(t)` et les fenêtres de validité le touchent de près. Le multi-scénario ne l'entame pas : déjà traité en pratique, rien à modifier (`2026-07-28-decoupage…` §4). |
| **Runtime policy** | `v1-runtime-policy-spec.md` | Non abordé. |
| **Helpers de strap** | `v1-strap-helpers-spec.md` | Non abordé ; `planned` vs `live` interroge pourtant `f(t)`. |
| **Rate** | `v1-rate-spec.md` | Non revisé, mais ignoré par un flux direct (`2026-07-27-emetteurs…` §6.3) — cas particulier, pas révision. |
| **Schéma compilé** | `v1-compiled-scene-schema.md` | Suit mécaniquement les déclarations nouvelles (phases d'émission, régime d'hôte) ; jusqu'où la compilation résout est une question ouverte (`conduite-chantier-v2.md` §4.6). |
| **Broadcast / diffusion** | `v1-broadcast-spec.md` | Non revisé en propre ; concerné par la frontière auteur/diffusion (§5) et le dosage dev/diffusion (§7). |

## Hors V2

| Sujet | Où | Statut |
|---|---|---|
| **Sighty** (orchestrateur multi-scènes) | `../../sighty/notes/2026-07-26-meta-orchestrateur-preambule.md`, `../../sighty/notes/2026-07-28-sighty-premiere-intention.md` | **Hors chantier V2, mais pas hors périmètre de spécification.** L'ordre de construction est codplay V2 *puis* Sighty ; l'ordre de **définition** est l'inverse — les specs codplay doivent impérativement préparer son usage, donc Sighty doit être suffisamment défini **avant** qu'elles ne se figent. Sans quoi la préparation se ferait après coup, soit la « pièce rapportée » que `conduite-chantier-v2.md` §0 traque. L'exigence portée sur codplay est instruite dans `2026-07-28-decoupage-engine-instances-pilotage.md`. |
| **Telco comme transport réseau/distant** | `conduite-chantier-v2.md` §10 #5 | « Porte à ne pas condamner, pas un axe de développement. » La décision « events comme contrat primaire » satisfait cette réserve sans ouvrir le chantier. **L'usage manquant est désormais nommé** : un outil calendrier distribuant à N Sighty sur N appareils (`../../sighty/notes/2026-07-28-sighty-premiere-intention.md` §6.3 ter) — ce qui est piloté à distance étant un Sighty, non un player. Reste hors axe. |
| **Portage (Flutter)** | `2026-07-26-portabilite-contrainte-redaction.md` | Pas un chantier : une **contrainte de rédaction** qui discipline le code TS présent. |

## Matrice et dissonances — où les lire

- **La matrice des intentions** (huit invariants directeurs, force obligatoire) :
  `2026-07-26-conduite-chantier-v2.md` §11.
- **Les dissonances**, inventoriées là où elles ont été relevées : `conduite-chantier-v2.md` §4.3, §4.4,
  §4ter ; `2026-07-28-decoupage-engine-instances-pilotage.md` §7.
- **La seule encore inaperçue** : `context.live` n'a pas de forme évaluable, donc `f(t)` ne peut pas
  l'accueillir. Analyse et remplacement par `TweenAction` : `2026-07-28-decoupage…` §8.

## Questions ouvertes du projet V2

Rassemblées ici pour mémoire ; chacune est développée à l'endroit cité.

| Question | Où |
|---|---|
| Jusqu'où pousser la compilation | `conduite-chantier-v2.md` §4.6 |
| Surface unique vs builds séparés (dev / diffusion) | idem §7 |
| Re-câblage des bindings tiers | idem §9 |
| Audit des modules — le contrat est-il *le* patron unique ? | idem §4.3 |
| Seek d'un FLIP sous ancêtres mobiles : abstraction vs mesure DOM | `2026-07-26-seek-flip-ancetres-mobiles.md` |
| Émetteurs : indisponibilité à l'exécution, scène vs story, nom | `2026-07-27-emetteurs-et-events-user-complexes.md` §4 |
| Frontière de bundle de la factory de `CompiledScene` | `2026-07-28-decoupage…` §8 |
| Surface publique d'une scène — sortie (quels events remontent) et **entrée** (ce qui est réglable du dehors) | idem §8 |
| Sens de la fin d'une séquence sous interruption (`onAbort`) | idem §4 |
| État central et portées (dont l'état de capture) | idem §8 |
| **`context.live` face à `f(t)`** — remplacement par `TweenAction` pour compteurs et chronomètres, et inventaire des usages qui résisteraient | idem §8 |
| Un **document d'invariants** — la matrice des intentions n'existe qu'en filigrane | ci-dessus |
| La **lecture arrière** comme capacité (modèle anime.js) — bon marché sous `f(t)`, régime à concessions déclarées : pas d'events utilisateur, média simulé par échantillonnage | idem §8 |
| Multi-scénario (dont multi-langue) : comment le déclarer et sous quel nom — rien à implémenter en aval | idem §4 |

## Statut

Carte de navigation, non normative. Elle ne décide rien : elle classe et cite. Les lignes « conservé »
sont des déductions du corpus à confirmer par l'auteur ; les lignes « à statuer » marquent le silence du
corpus, non un manque.

Lié : `2026-07-16-solve-project-moteur-custom.md` (*quoi* construire),
`2026-07-26-conduite-chantier-v2.md` (*comment* mener), `docs/formalisation/v1-index.md` (ordre de lecture
des specs V1, qui restent normatives jusqu'à leur remplacement).
