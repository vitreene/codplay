# Elcé — sujet Mods

Ce dossier réunit les études et notes sur les mods d’Elcé. Le
[plan unique](plan/2026-10-20-elce-mods-reconfiguration-plan.md) conserve
les conclusions, les décisions retenues et celles qui restent à prendre.

## Architecture

- [Audit des dépendances de Learning](notes/2026-10-27-learning-independence-audit.md) : graphe d’imports actualisé, frontières à séparer et cause du défaut de cache Question, corrigé depuis ; aucune extraction certifiée.
- [Ressources réutilisables de Learning](notes/2026-10-27-learning-reusable-resources-study.md) : réexamen des fonctionnalités actuelles, de leurs classes métier et des adaptations à la composition du mod.
- [Faisabilité et reconfiguration](notes/2026-10-20-elce-reconfiguration-study.md) : articulation du noyau, des ressources et des dispositifs des mods.
- [Étude technique de l’extraction Learning](notes/2026-10-20-learning-extraction-study.md) : analyse du code, arborescence, cartographie et raccords envisagés.
- [Construction progressive et API internes](notes/2026-10-20-mod-composition-internal-api-study.md) : composition, façades, machines et évolution des fonctionnalités.
- [Étude générale des mods](notes/2026-10-15-elce-mods-study.md) : intentions auteur, cohérence des interfaces et réemploi par copie puis adaptation.

## Intérêts prioritaires

- Learning est le nom du mod actuel, précédemment appelé « Général ».
- [DGS](notes/2026-10-20-dgs-mod-study.md) étudie la diffusion TV collective et autonome.
- [Sequence et scheduler](notes/2026-10-20-sequence-scheduler-study.md) explore les enchaînements locaux et leur programmation temporelle ; l’autonomie de `sequence` reste ouverte.
- [Diffusion par destination](notes/2026-10-20-sequence-scheduler-study.md#diffusion-uniforme-et-diffusion-par-destination) étudie l’affectation de plusieurs récepteurs à des schedulers distincts dans un même projet DGS.

## Exemples secondaires

- [Quiz Hunt](notes/2026-10-15-quiz-hunt-adaptation-study.md).
- [Quest](notes/2026-10-15-quest-mod-note.md).
- [Cours partagé et application de participation](notes/2026-10-15-elce-mods-study.md#autre-exemple-cité--cours-partagé-et-réponses-des-participants).

Ces exemples ne constituent pas des engagements de réalisation.

## Frontières transversales

- [Extensions par des BDC dédiés](notes/2026-10-20-elce-reconfiguration-study.md#extensions-envisagées-par-des-bdc-dédiés) : composants externes et scènes préconçues.
- [Services applicatifs et commercialisation](notes/2026-10-20-elce-reconfiguration-study.md#contenus-accessibles-et-services-applicatifs-hors-périmètre) : utilisateurs, catalogues, ACL et droits d’accès ; hors de cette étude.
- [État de lecture et responsabilité de Sighty](notes/2026-10-16-reading-state-ownership-study.md).
- [Transit des données et SCORM](notes/2026-10-15-scorm-data-flow-study.md).

Les comportements vérifiés restent décrits dans les
[spécifications Elcé](../specs).
