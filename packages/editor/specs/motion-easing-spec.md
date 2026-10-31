# Easing de mouvement dans Editor

## Contrat

L’aperçu Editor utilise `parseEase` d’ACE, comme le runtime qui consomme la
scène compilée. Il ne possède pas de calcul Bézier indépendant.

Les alias auteur `ease-in`, `ease-out` et `ease-in-out` deviennent respectivement
`in`, `out` et `inOut`. `linear` est conservé. Toute autre chaîne doit être
résoluble par le catalogue ACE existant.

Le builder vérifie les easings des transitions interpolées avant de produire
une scène. Une forme non reconnue renvoie `EDITOR_V2_EASING_UNSUPPORTED`, avec
l’item, le keyframe et la chaîne refusée ; aucune scène partielle n’est fournie.
L’objet auteur `cubic-bezier` reste sérialisable dans le document, mais sa
représentation `cubic-bezier(...)` est actuellement refusée par le runtime ACE
utilisé. Editor ne simule pas sa prise en charge et ne remplace pas cette
courbe par une autre.

## Preuves

- [`easing.spec.ts`](../tests/motion-editor/easing.spec.ts) compare les
  progressions Editor au parseur ACE et vérifie le refus de l’objet Bézier.
- [`build-scene.spec.ts`](../tests/builder-v2/build-scene.spec.ts) vérifie le
  diagnostic avant sortie et la compilation CodPlay réelle des alias acceptés.
- Safari MCP, le 30 octobre 2026 : les quatre alias donnent les mêmes résultats
  qu’ACE aux six instants contrôlés ; le builder renvoie le diagnostic attendu
  pour l’objet Bézier.

Les corrections structurelles restantes sont suivies dans le
[plan ciblé](../plan/2026-10-30-editor-motion-responsibility-fix-plan.md).
