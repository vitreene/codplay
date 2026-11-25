# Bornes intro/outro : placement, décor et transitions — plan

Statut : **Fixe** (B-1 à B-9 ; vocabulaire « implicite / liée / verrouillée » de B-2 à confirmer). Connaissances et sources : [note de référence](./notes/2026-11-25-bornes-intro-outro-note.md).

## Objectif

Appliquer les contraintes énoncées par l’utilisateur : un item naît à la tête de
lecture (D-NAISS, fait) ; intro et outro sont toujours des KF dont le placement est
hérité de la capsule ou fixé par l’auteur ; une borne n’est jamais entièrement
virtuelle (placement, décor et transition sont trois attributs, chacun hérité ou
fixé) ; une action hors de la fenêtre recale la tête sur la borne la plus proche
(D-HORS-PLAGE) ; les transitions d’apparition et de disparition sont visibles dans
la timeline.

## Décisions

| Id | Décision | Statut |
| --- | --- | --- |
| B-1 | Une borne a trois attributs indépendants : placement (hérité ou verrouillé), décor (hérité ou propre), transition (héritée ou explicite). | Énoncée par l’utilisateur (2026-11-25) |
| B-2 | Forme : `Keyframe.autoBound?: 'intro' \| 'outro'`. Un KF lié porte un décor (et éventuellement une transition) ; son instant est toujours recalculé par la distribution, `timeMs` n’en est que le reflet ; il ne verrouille pas l’enfant. SQLite : colonne `auto_bound` de la table `keyframes` (migration `ALTER TABLE`), comme `rotation_mode`. Vocabulaire : une borne est **implicite** (aucun KF, tout hérité — l’ancienne « borne virtuelle »), **liée** (KF `autoBound`, placement automatique) ou **verrouillée** (KF sans `autoBound`, instant fixé par l’auteur). | Forme acceptée ; vocabulaire « implicite / liée / verrouillée » à confirmer |
| B-3 | Capsule Automation est l’unique propriétaire de la résolution des bornes des enfants : distribution, verrous par borne, transition effective (explicite, défaut de la capsule, fusion aux bords). Une capacité publique et pure, indépendante de l’éditeur (entrées primitives, sans type Editor), réutilisable par un autre éditeur qui appliquerait la même logique ; la timeline et le Builder l’appellent avec les mêmes entrées. `CapsuleDistribution`, `TransitionTiming` et `CapsulePreset` (purs, sans dépendance) passent de `scene-factory` à Capsule Automation. Revient sur la répartition du 2026-07-08, sans recréer un second calcul. | Décidée par l’utilisateur (2026-11-25) |
| B-4 | Une action de l’auteur sur une borne héritée (cadre ou palette) crée un KF lié (B-2) avec un décor propre (copy-on-write) ; le placement reste automatique. Glisser ou double-cliquer la borne la verrouille (§9.2 inchangé). | Décidée par l’utilisateur (2026-11-25) |
| B-5 | D-HORS-PLAGE : recalage dès le début de l’interaction (appui sur le cadre, première modification de la palette) ; la preview suit en direct sur l’item à la borne ; le commit reste à la validation. | Énoncée par l’utilisateur (2026-11-25) |
| B-7 | Fusion aux bords d’une capsule : une borne d’enfant héritée qui coïncide (écart nul) avec la borne de même nom de sa capsule ne reçoit pas de transition par défaut ; la transition de la capsule la couvre. Une transition explicite posée par l’auteur sur cet enfant est conservée : un choix de l’auteur prime sur un défaut. Elle fait partie de la transition effective résolue par l’action 1. | Décidée par l’utilisateur (2026-11-25) |
| B-6 | La timeline montre les transitions d’apparition et de disparition de toutes les bornes en rampe : pleine pour une transition explicite, en pointillés pour une transition héritée. Essai, ajustable à l’usage. | Décidée par l’utilisateur (2026-11-25), forme à ajuster |
| B-8 | Entrer dans une capsule à placement temporel automatique désactive le placement temporel propre de l’item : ses bornes deviennent liées (B-2), leurs décors sont conservés. Une seconde action intentionnelle (glisser ou double-cliquer la borne) le libère en la verrouillant. Un dépôt dans une telle capsule place aussi l’item dans sa zone par défaut ; le temps suit. Une création dans cette capsule fait naître l’intro liée (D-NAISS précisée). Exception : capsule à placement libre, où la règle est sans objet — le mode « Libre » (grille 1 × 1) et sa variante à grille fine (90 × 160, placement par spans), c’est-à-dire les deux modes de placement de la racine (`rootPlacementModeForScene` : `transform`, `fine-grid`). Sortie d’une capsule vers un placement libre : les bornes liées sont figées à leur instant calculé et verrouillées ; l’item ne bouge pas dans le temps. | Décidée par l’utilisateur (2026-11-25) |
| B-9 | KF intermédiaires d’un item dont la fenêtre est recalculée (entrée dans une capsule, redistribution) : ils gardent leur position relative dans la fenêtre, compressée ou élargie à proportion. Un KF aligné sur un label garde ce lien et son instant — les labels sont les cues de texte, les noms de KF et, plus marginalement, les marqueurs auteur (`markerId`) ; s’il sort de la fenêtre, il devient **indisponible** — conservé dans le document, ignoré par le Builder, signalé dans la timeline — et redevient disponible quand il y revient. Il n’est jamais effacé : l’auteur peut le rendre inaccessible le temps de ses manipulations. | Décidée par l’utilisateur (2026-11-25) ; écart : seul `markerId` est un lien durable — la spec des cues dit qu’aimanter un KF sur une cue « ne crée pas de lien durable », et un nom de KF n’est pas un lien ; forme du lien à décider (B-10) |
| B-10 | Lien durable d’un KF à un label. **Cues de texte** : reporté au chantier des cues (prématuré). **Nom de KF** : deux sens retenus — un KF qui suit un autre KF nommé (prématuré) ; un nom qui sert de repère global sur lequel plusieurs KF s’alignent (à traiter en premier). L’existant fournit déjà un repère global durable : `Marker` (`label`) et `Keyframe.markerId`. Reste à décider, au moment de le traiter, comment un nom de KF devient ou rejoint un tel repère. | Décidée par l’utilisateur (2026-11-25) : cues reportées, repère nommé global en premier |

## Actions (dans l’ordre)

0. Mettre à jour `decisions-a-prendre.md` : le défaut d’échelle des trajectoires est
   corrigé dans le cœur (spec CodPlay « Interpolation de la pose ») ; retirer la
   correction Editor prévue.
1. **Résolution unique des bornes dans Capsule Automation (B-3, B-7).** Sur `develop`
   (paquets partagés ; elce et les démos sont concernés), puis remontée dans `editor`
   et `elce`. Déplacer
   `capsule-distribution.ts`, `transition-timing.ts` et `capsule-preset.ts` de
   `scene-factory` vers `capsule-automation` (imports des appelants mis à jour) ;
   ajouter une fonction pure qui, pour une capsule et ses enfants, rend les bornes
   résolues (origine héritée/verrouillée, transition effective avec fusion aux bords).
   `computeVirtualKeyframes` (timeline) et `resolveCapsuleDistribution` (Builder) la
   consomment ; leur préparation d’entrées en double disparaît. Corrige E8 et l’écart
   de durée d’entrée. Spec Capsule Automation et spec de distribution mises à jour.

2. **Modèle (B-2).** Spec du modèle de document et spec de distribution (§1, §9.2,
   §11) amendées ; `commands/types.ts`, commandes de KF, migration SQLite et
   persistance ; la résolution (action 1) traite un KF lié comme borne non verrouillée
   qui fournit son décor et sa transition.
3. **Écriture sur une borne héritée (B-4).** Pont Décor (`decor-target`,
   `setItemDecor`) : une cible sur une borne héritée produit la création du KF lié
   avec décor propre ; timeline : rendu « hérité » d’une borne liée, verrouillage par
   glisser/double-clic.
3b. **Entrée dans une capsule (B-8, B-9).** Commande `attachItem` (et création dans
   une capsule) : bornes verrouillées converties en bornes liées ; placement spatial
   dans la zone par défaut. KF intermédiaires recalés à proportion de la nouvelle
   fenêtre, sauf ceux rattachés à un marqueur. Builder : un KF hors de la fenêtre de
   son item est ignoré (indisponible) ; timeline : signalé (le diamant rouge « hors
   bornes » de la spec de distribution §9.1 existe déjà).
4. **D-HORS-PLAGE (B-5).** Coordination : port en lecture de la fenêtre d’un item
   (action 1). Session Décor : état `gesture.relocating` et édition palette retenue
   jusqu’au seek acquitté.
5a. **Repère nommé global (B-10).** Design à soumettre : relation entre nom de KF et
   repère global (`Marker`/`markerId` existants), alignement durable de plusieurs KF,
   comportement hors fenêtre (B-9).
5. **Transitions dans la timeline (B-6).** `render/track-row.ts` : rampes pour les
   transitions effectives des bornes (action 1). Rejoint le chantier retenu
   « Édition des transitions de KF » (interface d’édition, durée par défaut).

## Invariants

- Documents existants inchangés : un KF sans `autoBound` reste verrouillé.
- Le runtime ne voit que des bornes résolues ; aucune notion de borne héritée dans
  la `SceneDoc`.
- La timeline et le Builder placent toute borne au même instant.
- Copy-on-write (D-C) et naissance à la tête de lecture (D-NAISS) conservés.

## Acceptation

- Tests : résolution unique (timeline = Builder, racine et capsule, ordres, durée
  d’entrée par défaut, fusion : premier enfant à écart nul sans transition propre,
  enfant décalé avec transition héritée) ; KF lié (instant recalculé, décor propre, pas de verrou) ;
  migration SQLite et rechargement ; D-HORS-PLAGE (cadre et palette, bornes
  réelles et héritées) ; rendu des rampes.
- Suite Editor, typecheck, build ; Safari MCP sur une copie de scène : création à la
  tête de lecture, édition sur une outro héritée (décor propre, borne toujours
  placée par la capsule), verrouillage par glisser, recalage hors fenêtre, rampes
  explicites et héritées, Undo/Redo, Play/Seek, rechargement. Puis revue manuelle.
