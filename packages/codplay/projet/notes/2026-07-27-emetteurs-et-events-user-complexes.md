# Exploration — sources d'events utilisateur complexes

> Statut : piste exploratoire, pas une feature acceptée du socle V2. Aucune
> API, capacité runtime ou implémentation n'est décidée ici. Les contrats
> actuels restent dans les spécifications et plans CodPlay liés ci-dessous.

## Problème à explorer

`Perso.emit` relie une entrée utilisateur discrète à un événement CodPlay.
`capture` observe une suite d'échantillons pendant une fenêtre et peut produire
une sortie à sa fermeture. Une reconnaissance de geste ou de signal continu
pourrait avoir besoin des deux : observer pendant une durée, puis émettre un
fait discret qui entre dans le journal et peut être reconstruit par Seek.

La piste de conception consiste à réduire les observations fréquentes à des
transitions sémantiques déclarées. Un flux d'échantillons ne deviendrait pas un
flux d'événements journalisés. Une source de caméra ou un moteur de
reconnaissance aurait par ailleurs un cycle de vie propre, distinct de la
fenêtre éventuelle de capture.

Ces principes restent une proposition. Ils ne définissent pas un nouveau
chemin d'émission et n'étendent pas le contrat actuel de capture.

## Questions avant d'ouvrir un plan de feature

- Quelle déclaration possède la source ou le reconnaisseur, et dans quelle
  portée de scène ou de story ?
- Comment une capacité indisponible, refusée ou asynchrone affecte-t-elle la
  lecture et le diagnostic auteur ?
- Quels événements sémantiques sont déclarés, et qui décide qu'une transition
  est assez stable pour être émise ?
- Comment la source se comporte-t-elle pendant pause, reset, Seek, replay et
  destruction ?
- Quels faits sont journalisés, et quelle règle s'applique à une interaction
  ajoutée après un Seek arrière ?

La décision de créer cette feature, son périmètre V2 et son parcours
d'acceptation doivent précéder toute API ou modification du core.

## Frontières actuelles

- Le cycle source-agnostique et les sorties vérifiées de capture sont décrits
  dans la [spécification capture](../../specs/capture-v2-spec.md), qui reprend
  le routage événementiel `visibility`. L’acceptation navigateur S5 du runtime
  CodPlay, exercée avec la fixture `stroke-path`, a été confirmée par
  l’utilisateur ; le Seek navigateur S6 reste
  au [plan dédié](../../plan/drag-capture-list-s6-validation-plan.md).
- Le dispatch de `listen`, la journalisation et l'absence de rejeu des straps
  sont décrits dans la [spécification événementielle](../../specs/event-pipeline-v2-spec.md).
- Le sous-ensemble vérifié des déclarations ordinaires `Perso.emit` est dans sa
  [spécification](../../specs/perso-emit-v2-spec.md) ; les validations
  restantes sont au [plan dédié](../../plan/perso-emit-v2-portage-plan.md).
- Le mode média en direct est séparé de cette piste ; sa décision acceptée et
  les choix d'application ouverts sont consignés dans le
  [plan média](../../plan/media-preload-plan.md).
