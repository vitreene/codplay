# Plan d'acceptation — composants `img`, `input` et `polygon` V2

## Statut

> Status: En cours — du code est présent et des comportements ciblés sont
> vérifiés ; les critères de clôture ci-dessous restent ouverts.
> CodPlay version: V2 foundation

Les contrats vérifiés sont séparés par composant :

- [composant image `img`](../specs/image-component-v2-spec.md) ;
- [composant de saisie `input`](../specs/input-component-v2-spec.md) ;
- [composant SVG `polygon`](../specs/polygon-component-v2-spec.md).

## Acceptation restante

- [ ] Exécuter les suites V2 complètes et les typechecks CodPlay/démos avant la
      clôture de cette tranche.
- [ ] Image : vérifier le nombre d'affectations de `src` sur un nœud déjà mis
      en cache, puis valider le chemin `replace` image par le runner.
- [ ] Input : valider dans un parcours quiz réel les états natifs, la sélection
      et la désactivation des réponses, la révélation de correction et les
      classes de résultat. Compléter la preuve du parcours quiz intégré.
- [ ] Décider si l'export V2 `resolveInputStandardActions` fait partie du contrat
      auteur public : il est exposé par le sous-chemin `runtime/components/input`
      et porte les actions quiz compatibles V1, mais aucun consommateur ni test
      V2 du dépôt ne valide sa fusion avec les actions auteur. S'il est conservé
      comme contrat, ajouter sa preuve avant de le décrire dans la spécification.
- [ ] SVG et `polygon` : vérifier les services sur racine et parts ainsi que
      parentage, détachement et destruction dans le materializer.
- [ ] Polygon : exercer Seek avant, pendant et après un morph, puis vérifier le
      retour par reset/replay. Le test runner courant valide les morphs en Play,
      pas le Seek de leur intervalle.
- [ ] Rejouer les parcours HTML concernés dans un navigateur Safari avant de
      déclarer la tranche `Fini`.

La suite ciblée image/input/polygon passe le 2026-09-25 : deux fichiers,
six tests. Les preuves et leurs limites sont référencées dans les trois
spécifications ci-dessus. Ne pas marquer cette tranche `Fini` tant que les
gates restants ne sont pas enregistrés.

## Demande Elcé — rendu alternatif du composant `img`

**A relire — contrat non décidé, aucune implémentation engagée.** Le
[plan de construction Elcé](../../elce/plan/2026-10-01-elce-construction-plan.md)
demande qu’un markup choisi puisse remplacer le rendu HTML par défaut du
composant image. Un bdc image Elcé à contenu unique génère un seul perso
`img`, sans `figure` ajoutée par ce bdc, y compris si ce rendu alternatif est
ajouté plus tard. Le preset Elcé « image avec légende » possède son propre
markup fixe avec une zone image et une zone texte ; sa structure HTML est à
définir par Elcé et ne modifie pas le composant `img`.
Le [contrat de scène](../specs/scene-authoring-spec.md) fait déclarer par
l’application les persos et leurs cibles de montage. Le contrat vérifié de
`img` prévoit actuellement un conteneur fixe et un nœud image natif créé par
CodPlay, conservé par source ; `ImageInitial` ne porte pas de markup
alternatif. La composition avec un `layout` peut entourer ce conteneur ;
la [démo scroll-container](../../demos/src/v2/demos/scroll-container/main.ts)
déclare déjà un perso `tag` de type `figure` qui accueille un perso `img`.
Cette configuration à deux persos est précisément celle qu’Elcé écarte pour
ses images.

Pour cette évolution, le builder Elcé fournit le markup alternatif dans la
scène, tandis que CodPlay reste propriétaire de la balise image native.
Dans Elcé, l’utilisateur de l’éditeur ne saisit jamais de HTML, pour le POC
comme pour ses suites. Avant de retenir une modification du cœur, décider
comment le markup accueille l’image native dans ce seul perso et quelle
forme garde le rendu par défaut.
Préserver ou redéfinir explicitement les invariants de
source, texte alternatif, services, animation, nœuds persistants et
matérialisation. Toute nouvelle entrée auteur doit être validée et
sérialisable. La politique de sanitation des templates est encore **A relire**
dans le [plan de représentation](./component-render-representation-plan.md) ;
ce point doit être tranché avant l’introduction d’un markup image auteur.

Le parcours d’acceptation à établir devra exercer les deux rendus par le
vrai player, y compris le changement et le retour de source, Play, Seek,
resize, reparent, persistance, lifecycle et navigateur ; les catégories
non concernées pourront être écartées seulement sur analyse causale. Le
markup auteur devra respecter la règle d’`id` explicite pour chaque parent.
Aucun code du cœur ne doit être modifié avant validation du contrat, plan
accepté et autorisation explicite prévus par les règles du dépôt.
