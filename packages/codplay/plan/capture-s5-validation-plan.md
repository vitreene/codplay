# Validation S5 — capture HTML classique V2

## Statut

`En cours` — la migration du contrat capture vers `visibility` est appliquée
et vérifiée par les tests builder, codec, session, player et adaptateur HTML.
La revalidation navigateur visible de S5 reste ouverte ; elle doit exercer la
cible story par défaut sur le chemin HTML et la telco réels.

Le contrat source-agnostique vérifié est décrit dans la
[spécification capture V2](../specs/capture-v2-spec.md). Ce plan suit
uniquement l’acceptance navigateur de la fixture S5.

## Parcours navigateur

Le parcours d'acceptance est la démo V2 existante
[`stroke-path`](../../demos/src/v2/demos/stroke-path/main.ts), sélectionnée par
`?demo=stroke-path`. Sa règle `pointerdown` déclare une capture compilée et
traverse l'adaptateur pointeur, le player, le journal et le layout/telco
partagés. L'ancien libellé `Drag & Capture` ne correspond pas à une fixture
présente dans l'arbre actuel ; ce plan ne demande ni une nouvelle démo ni un
circuit de capture parallèle.

## Acceptance restante

- Rejouer `stroke-path` dans un navigateur visible via le chemin HTML et la
  telco existants ; vérifier l’ouverture, `endEmit` et leur cible story par
  défaut. Les cibles `scene`/`public` et les sorties `endCapture` sont déjà
  couvertes par les tests source-agnostiques référencés dans la spec capture.
- Vérifier Play, pause, seek continu, fermeture, seconde capture, rewind et
  teardown sur ce parcours réel.
- Confirmer que le journal et la présentation gardent les sémantiques
  `apply-now` et `persist-only` certifiées dans la spec.
- Consigner la preuve navigateur et clore ce plan si aucun écart n’apparaît.

Les frontières automatisées de capture et S6 ont été revérifiées le
2026-09-26 : suite CodPlay
(107 fichiers, 706 tests), suite component-v2 (11 fichiers, 48 tests), tests
ciblés S5 et S6 dans CodPlay et typechecks CodPlay, component-v2 et démos V2.

Les seuls tests directs de `RuntimePlayer.trackCapture()` ne suffisent pas à
accepter cette tranche : la validation navigateur doit traverser le
dispatcher, le journal, la présentation et le cycle de vie HTML concernés.
