# Plan — clôture du runtime Sighty

## Statut

**En cours.** Les corrections de surface ci-dessous sont intégrées et vérifiées.
Le CSS auteur des scènes de diffusion est intégré ; plusieurs décisions runtime restent ouvertes.

## Intégration vérifiée

- La vue de départ du graphe racine désigne la scène hôte par `view.scene` ;
  `runtime.layout` et `storyId` ont disparu.
- `scenario.actions` et `scenario.guards` portent les fonctions référencées par
  les vues. Les clés enregistrées suivent respectivement les formes lisibles
  `action:<domaine>:<verbe>` et `guard:<domaine>:<prédicat>`, distinctes des
  identifiants de scène ; les vues acceptent aussi les fonctions inline, qui ne
  passent par aucun registre.
- `scenario` est la définition unique du parcours, sur le modèle d’une
  machine : il porte directement `id`, `version`, `format`, `showMode`,
  `data`, `views`, `scenes`, `sceneSources`, `guards` et `actions`. La propriété
  intermédiaire `file`, le type public `SightyFile`, le doublon
  `resources.scenes`, la normalisation de placements anciens, l’alias
  `view.graph`, les copies runtime des registres et `getViewGraph()` ont été
  retirés. L’index est dérivé de `scenario.views` et reconstruit sur mutation.
  La migration couvre les démos Sighty 1 à 5, dont la démo 5 qui construit
  désormais son scénario complet dans un seul module. Acceptation : 47 tests
  Sighty, typechecks Sighty et démos, build démos et `git diff --check`.
  Le smoke test du navigateur charge les cinq démos ; la démo 3 exécute son action
  d’injection, la démo 4 navigue vers la scène A et la démo 5 parcourt les dix
  pages, refuse une page verrouillée, affiche les félicitations après les trois
  réponses finales et restaure la première page et son titre après reset. La
  matrice générale de Play, Seek, resize et cycle de vie reste ouverte pour les
  autres tranches ; la démo 5 est stabilisée pour son parcours déclaré.
- `showMode` est défini dans le scénario ; le défaut runtime est `rewind`.
- `onPreloadWarning` a disparu de Sighty. Les erreurs runtime non bloquantes
  vont à `console.warn` ; les avertissements de preload restent dans le résultat
  du service preload.
- `runtime.styles` reçoit le CSS fourni par l’application et le transmet à
  `CodPlay.preload.css.set()` ; son application et son nettoyage sont testés.
- Une ressource de scène peut associer `{ sceneDoc, styleSheet }`. Sighty
  compile le document et installe le CSS sur `runtime.root` via le canal `@scope`
  existant, avant le montage ; une scène retirée libère son slot.

- La passerelle `RuntimeSceneEventGateway` est l’unique sortie d’événements
  vers CodPlay. Les actions qui ciblent une scène active transmettent l’événement
  sans sauvegarder ni restaurer le transport ; les actions CodPlay suivent le
  cycle normal de lecture et de présentation. Les tests runtime couvrent
  l’absence de seek automatique et l’effet des événements `entry` après la
  lecture normale.
- La correction et la revalidation de la démo 5 sont terminées :
  `COURSE_PAGES` est l'unique source des entrées de page, le graphe des
  chapitres, les routes du menu et les scènes de page en sont dérivés dans
  `scenario.ts`, et le guard `page-access` du parent `view-course` est la seule
  règle d'admission héritée. La télécommande partagée cible les scènes exposées
  par `scenarioState.current` et ajoute seulement l’occurrence layout résolue
  par `runtime.getInstance`. L’acceptation automatisée est passée : 47 tests
  Sighty, 48 tests component-v2, 711 tests CodPlay, typechecks, build des
  démos et `git diff --check`. Le parcours MCP du navigateur couvre l’initialisation,
  le refus d’une page verrouillée, les repères bas, le quiz du chapitre 1, les
  trois questions finales, les félicitations et la remise à zéro.
- La transition d’image de la démo 5 suit désormais le circuit attendu par
  CodPlay : le cadre porte l’observation, l’image démarre à
  `translateX(-112%)`, puis les events `enter`/`leave` déclenchent sur le perso
  image des tweens `style.translateX` de 520 ms (`outCubic`) et 420 ms
  (`inCubic`). La classe CSS et la `liveAction` qui réappliquaient le même
  état ont été retirées. L’instrumentation DOM vérifie une mutation de style
  par action logique, sans double mise à jour de classe.

## Régression Demo 5 — repères de fin après recommencer — 2026-09-30

**Statut : En cours.** La réinitialisation du signet remet bien à zéro les
pages terminées et les réponses, mais les marqueurs `pageBottom` étaient
déclarés `once: true`. Le contrat scroll précise qu’un tel event ne peut partir
qu’une fois pendant la vie du player ; le retour à la première page conserve
les instances et ne réarme donc pas les marqueurs consommés. La première page
reste alors verrouillée vers la suite après son second défilement au bas.

**Correction appliquée pour le repère de fin :** garder l’observation
`emit.observe` et ses phases normales, retirer `once` des marqueurs de fin de
page et rendre le traitement Sighty idempotent tant que la page est déjà
inscrite dans le signet. Après la nouvelle action de replay, le signet vide
permet à la prochaine entrée du marqueur de réinscrire la page et de reprojeter
les gardes. Le comportement visuel après replay reste à vérifier dans le
parcours navigateur complet.

**Propriété `reset` des actions de relecture : En cours.** Sighty prend en
charge la liste `reset`, la restauration du contexte et les événements
`onReset` pour les occurrences conservées. Demo 5 utilise `reset: ['all']` au
redémarrage ; l’action route d’abord vers la première page, puis le runtime
restaure le signet, réinitialise les quiz conservés et rafraîchit la
présentation. Les pages suivantes reviennent en haut lors de leur réadmission
par leur `showMode: 'reset'`. Le contrat et ses tests figurent dans la
[spécification Sighty](../specs/authoring-library-spec.md) et le [plan dédié](./2026-09-30-sighty-replay-reset-plan.md).

Les étapes restantes et la matrice d’acceptation sont suivies dans le
[plan de la propriété reset par action de relecture](./2026-09-30-sighty-replay-reset-plan.md).
Le contrat runtime est vérifié par tests unitaires ; son intégration visuelle
dans Demo 5 reste à valider. Cette tranche reste côté Sighty et démo de
validation ; toute nécessité de modifier `packages/codplay` exigerait un plan
accepté distinct.

**Acceptation du repère :** rejouer le parcours Demo 5 jusqu’aux félicitations,
choisir « Recommencer le cours », vérifier que les accès et Suivant sont remis
à zéro, puis descendre au bas de la première page et vérifier que `pageBottom`
est de nouveau émis et active Suivant. Repasser par le même marqueur sans
réinitialiser le cours ne doit pas republier une progression déjà inscrite. Le
parcours navigateur complet reste à valider.

## Travail restant

### Export de scénario — projection à relire

**Statut : A relire, non implémenté.** Étude demandée le 2026-10-15 à partir
de l'[entrée de diffusion CodPlay](../../codplay/plan/2026-10-15-export-diffusion-plan.md#8-initialisation-côté-site-à-prouver).
La scène CodPlay reste la première tranche à réaliser ; aucun changement de
runtime Sighty n'est autorisé par cette seule projection.

Forme d'usage proposée pour le paquet de scénario :

```js
const sy = new Sighty(root, scenarioPath)
await sy.init()
await sy.play()
```

Cette forme n'est pas disponible actuellement. La construction auteur
`new Sighty({ scenario, runtime })` et ses surfaces existantes sont conservées.

- [ ] Exporter la description initiale du parcours : vues, slots, routes,
  couplages, règles d'admission, showMode et données initiales ; pas l'état
  d'une session vivante, ses handles, instances, réponses ou générations.
- [ ] Produire le code des actions/guards nommés et inline et des callbacks
  `onReset`, avec leurs références exactes, imports et closures. Réutiliser
  les mécanismes de transport de fonctions validés pour CodPlay ; conserver
  la résolution et l'exécution Sighty dans leur circuit actuel.
- [ ] Exporter chaque définition de scène par le circuit CodPlay, une seule
  fois même si plusieurs vues/slots la référencent. Conserver la possibilité
  de plusieurs occurrences indépendantes de cette même définition.
- [ ] Embarquer CodPlay et Sighty une seule fois avec les capacités nécessaires ;
  les scènes référencent les mêmes bibliothèques. Dédupliquer les ressources
  par le circuit d'export accepté, sans second inventaire Sighty concurrent.
- [ ] Étendre le propriétaire actuel `RuntimeSceneManager` pour consommer les
  scènes déjà compilées ; son chemin actuel appelle encore `owner.build()`
  pour les sources directes et lazy. Aucun re-build auteur à destination.
- [ ] Garder un propriétaire CodPlay partagé pour Sighty : la lecture d'un
  paquet de scène doit pouvoir être utilisée avec ce propriétaire. Ne pas
  créer un `new CodPlay(root, scenePath)` autonome pour chaque scène.
- [ ] `sy.init()` charge/valide scénario et fonctions, prépare le catalogue
  de scènes exportées et initialise la composition de départ par le runtime
  existant. Ne pas reconstruire navigation, montage, journal ou telco.
- [ ] Définir et vérifier la frontière sans lecture de `sy.init()` ; `sy.play()`
  utilise le `runtime.play` existant depuis la scène de départ, avec ses
  sélections actives parent/enfant. Ne pas appeler play sur toutes les scènes.
- [ ] Conserver navigation/événements sur `sy.runtime.dispatch` et la passerelle
  actuelle. Les entrées/sorties de vues continuent de suivre leurs showMode,
  guards, couplages et cycles CodPlay.
- [ ] Pour un premier export autonome, résoudre à l'export l'ensemble fermé
  des définitions lazy connues, tout en permettant leur chargement différé
  depuis le paquet à la lecture. Définir les refus pour les scènes fabriquées
  depuis une API ou des données externes non empaquetées ; ne pas exporter
  seulement les scènes rencontrées dans le parcours courant.
- [ ] Fixer le traitement des mutations : navigation entre scènes exportées
  et création d'une nouvelle définition auteur à destination sont deux cas
  distincts ; le second n'est pas implicitement inclus dans cette proposition.
- [ ] Définir le format du paquet, sa convention d'entrée, son codec/version
  et le cycle async/erreurs avant implémentation ; ne pas déduire le format
  compilé/exportable d'un simple JSON.stringify de l'objet auteur actuel.

Acceptation propre à cette tranche future : initialisation puis lancement,
navigation entre deux scènes, même définition dans deux slots, lazy empaqueté,
guard, action avec closure, reset/onReset, couplage, retour/relecture et
destruction, depuis un dossier déplacé sur un site statique sans sources.
Ces décisions ne sont transférées à la spec qu'après implémentation et preuves.

### Autres décisions runtime

- Valider l’action de portée héritée : une action de vue complète les actions
  événementielles descendantes qui n’en déclarent pas ; une action locale reste
  prioritaire. L’utiliser pour les routes de Demo 5. Acceptation : tests de
  résolution et parcours navigateur de la navigation du cours.
- Décider si une mutation peut remplacer `view.scene` sur la vue de départ ;
  la scène hôte doit alors être recréée, ou le patch refusé.
- Définir comment l’application reçoit le résultat de preload lorsque Sighty
  lance lui-même `preload.load()` ; ne pas réintroduire un callback Sighty.

## Acceptation réalisée

- `npm run typecheck --workspace=@codplay/sighty`
- `npm run typecheck --workspace=@codplay/demos`
- `npm run test --workspace=@codplay/sighty`
