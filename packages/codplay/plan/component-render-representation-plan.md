# Relecture restante — représentation des composants V2

> Status: A relire — les comportements HTML/DOM vérifiés sont dans la
> [spécification de matérialisation](../specs/component-materialization-v2-spec.md).
> Le plan garde une frontière d'état à confirmer, une décision de sanitation et
> deux preuves d'acceptation manquantes.
> CodPlay version: V2 foundation

Ce plan ne porte plus les contrats des composants, des services HTML, des
parts, des fragments ou du parentage structurel. Leur périmètre vérifié est
dans la spécification de matérialisation ; les composants spécialisés et le
mouvement ont leurs propres spécifications et plans.

## Décisions et preuves restantes

- [ ] Confirmer par une preuve représentative que l'état résolu transmis à
      `update()` est la source de présentation et que la racine DOM reste une
      cible de matérialisation, pas une source de reconstruction. Le contrat
      historique le posait comme invariant `f(t)`, mais les tests cités par la
      spécification ne couvrent pas ce point général ; le player garde par
      ailleurs sa propre gate sur la réutilisation de l'état logique.
- [ ] Clarifier les réécritures d'attributs à effet de bord pendant un seek.
      Dans Quiz Hunt, l'événement Sighty `questionRevealDue` lance
      `createRevealQuestionAction`, qui envoie `:reveal` à la scène question via
      `SightyActionContext.send`. La passerelle émet d'abord l'événement CodPlay,
      puis appelle systématiquement `telco.seek()` à la position courante pour
      préserver le transport. L'émission immédiate a déjà présenté l'événement
      à cette position ; le seek de même position passe ensuite par
      `replayForSeek()`, dont la synchronisation `geometry-capture` force la
      mise à jour des composants. `TagComponent.update()` renvoie alors tout
      `attr` vidéo à [`createHtmlAttrService()`](../src/services/attr/html-attr-service.ts),
      qui réécrit `src` même inchangé. Dans Safari, une telle réécriture observée
      sur le même nœud `<video>` déclenche `emptied`, `loadstart` et un retour à
      `currentTime = 0`. L'anomalie est donc située sur le circuit
      `send → émission → seek à position égale → réapplication de src`, pas sur
      `showMode`. Décider à quelle frontière empêcher cette réapplication sans
      perdre le transport ni la matérialisation de l'événement, et sans changer
      le rechargement d'une source réellement modifiée. Preuve requise : exercer
      l'événement de révélation dans Safari, confirmer le temps/la lecture de la
      scène, l'identité du nœud, l'absence de réécriture identique de `src` et de
      `emptied`/`loadstart`, puis vérifier qu'un nouveau `src` recharge bien le
      média. Cette piste reste à relire ; aucun correctif core n'est autorisé par
      ce constat seul.
- [ ] Décider si les templates fournis par `BaseHTMLComponent.render()` doivent
      être filtrés avant parsing. Le texte antérieur exigeait un
      `readAndSanitize(template)` qui valide les balises et attributs. Le chemin
      runtime examiné affecte le markup à `template.innerHTML`, consomme les
      marqueurs `data-part` et conserve les nœuds. Le test
      [`template-materializer.spec.ts`](../tests/runtime/runner-html/template-materializer.spec.ts)
      couvre le parsing et les parts, pas une politique de sanitation. Ne pas
      certifier cette politique ni modifier le cœur avant décision.
- [ ] Vérifier si le contrat voulu est que `render()` ne soit appelé qu'une
      fois par instance pendant toute sa durée de vie. La spécification vérifie
      l'identité des instances et leur teardown, mais pas le nombre d'appels à
      `render()`.

## Décisions différées

- Le runtime JSX autonome et une méthode `init()` d'authoring sont hors du
  contrat V2 foundation ; la note antérieure les reportait à V2.5. Les reprendre
  dans un plan dédié avant toute conception ou implémentation.

## Contrats suivis ailleurs

- Bases, services déclarés, cycle d'instance et matérialisation HTML :
  [spécification composant](../specs/component-materialization-v2-spec.md).
- `layout`, marqueurs et outlets :
  [spécification layout](../specs/layout-component-spec.md) et plan de
  validation navigateur [`layout-part-marker-plan.md`](./layout-part-marker-plan.md).
- `img`, `input` et `polygon` : [spécifications par composant](../specs/image-component-v2-spec.md),
  [input](../specs/input-component-v2-spec.md), [polygon](../specs/polygon-component-v2-spec.md)
  et [plan d'acceptation partagé](./components-image-input-polygon-svg-plan.md).
- Media, preload et conservation des nœuds :
  [plan média](./media-preload-plan.md) et spécifications associées.
- Contenu foreign et projections tierces :
  [plan foreign](./foreign-scene-component-plan.md) et
  [plan de cibles tierces](./2026-09-18-third-party-render-target-codplay-plan.md).
- Move, FLIP, reparent et Seek : plans
  [`runner-flip-integration-study.md`](./runner-flip-integration-study.md) et
  [`motion-live-discovery-invalidation-plan.md`](./motion-live-discovery-invalidation-plan.md).

## Clôture

Relire les gates ci-dessus et respecter le report V2.5. Transférer toute
décision certifiée dans la spécification, puis retirer ce plan si aucune action
propre à la représentation HTML ne reste ouverte.
