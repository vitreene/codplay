# Rationale — frontières entre `SceneDoc` et `CompiledScene`

## Rôle

Cette note garde le motif des frontières du build ; elle n'est pas normative.
Les comportements vérifiés sont dans les spécifications de [scène](../../specs/scene-authoring-spec.md),
du [codec](../../specs/compiled-codec-v2-spec.md) et des capacités
concernées. Les décisions encore ouvertes sont au
[plan CompiledScene](../compiled-scene-plan.md).

## Motif des frontières

La normalisation donne aux guards une forme canonique sans muter la déclaration
auteur. Elle peut réserver des chemins internes, comme l'auto-référence du
perso, qui ne doivent pas être interprétés comme des actions auteur. La
spécification de scène décrit cette forme et ses preuves.

Le snapshot du catalogue isole un build des enregistrements ultérieurs. Le
`CompiledScene`, lui, traverse la frontière vers le player et le codec ; son
immutabilité fait partie du contrat de diffusion. Le détail des comportements
certifiés appartient aux spécifications correspondantes, pas à cette rationale.

La sémantique de `SceneDoc.defaults`, la profondeur de découverte des
ressources et l'acceptation du manifeste `rootNodeIds` restent au
[plan CompiledScene](../compiled-scene-plan.md). Le code observé sur ces sujets
n'est pas élevé au rang de contrat par cette note.
