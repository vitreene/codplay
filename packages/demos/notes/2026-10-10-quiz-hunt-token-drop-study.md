# Étude de la cible DOM du jeton Quiz Hunt

## Conclusion et décision

Aucun mécanisme de dépôt inter-scènes n'est attendu. L'utilisateur autorise
une seule concession : le DOM partagé identifie l'item sous le pointeur, puis
son identité est transmise à Sighty. Sighty reste responsable de vérifier la
progression, de lancer le retrait du jeton, puis d'admettre la question échouée
après la transition, de consommer le jeton à l'admission et de révéler
immédiatement la question.

Cette voie ne donne pas à CodPlay un hit-test entre instances, ne pilote pas
directement une occurrence de menu et n'écrit pas dans `SceneDoc`. Le DOM ne
fournit que l'identité de la cible ; la règle de jeu reste dans Sighty.

## Contrats et chemins observés

- La [spécification Sighty](../../sighty/specs/authoring-library-spec.md)
  expose les événements publics d'une scène active à Sighty. Une action peut
  envoyer un événement à une scène active avec `send`; ce circuit ne recherche
  pas de nœud DOM.
- La [spécification de capture CodPlay](../../codplay/specs/capture-v2-spec.md)
  limite `trackCommand` aux samples, à l'état de capture et aux actions live.
  `public` publie l'événement ; il ne le transporte pas vers une autre instance.
  `trackCommand` n'accède pas aux nœuds de présentation.
- La [spécification des événements](../../codplay/specs/event-pipeline-v2-spec.md)
  confirme que `visibility: 'public'` publie l'événement à l'hôte ; le transport
  vers une autre instance relève du circuit hôte/Sighty.
- Dans l'implémentation HTML, `HtmlPointerCaptureSourceAdapter` écoute les
  événements pointeur sur la fenêtre propriétaire en phase de capture. Le
  `HtmlPersoEmitSourceAdapter` écoute les mêmes événements en phase de
  propagation et ne retient qu'un événement dont la cible DOM appartient à un
  perso de sa propre scène. Ainsi, un `pointerover` qui atteint une tuile du
  menu est résolu par l'adaptateur du menu, tandis que la fin du glissement
  reste résolue par la capture du layout.
- V2 n'expose pas l'API V1 `context.api.getPersoIdAt`. La V1 utilise cette
  recherche dans sa scène unique, puis une lecture directe de rectangles DOM
  comme secours ; ces deux accès ne sont pas un contrat de ciblage entre scènes.

## Vérification navigateur ciblée

Dans une page Safari temporaire, un bouton désactivé a reçu `pointerover`,
`pointerdown` et `pointerup` lorsqu'il était sous le pointeur. Dans une seconde
vérification, un overlay situé au-dessus du bouton a passé
`pointer-events: none` à son `pointerdown` : le `pointerdown` est resté ciblé sur
l'overlay, puis le `pointerover` et le `pointerup` suivants ont atteint le
bouton désactivé sous-jacent. Cela confirme le comportement navigateur utile aux
tuiles échouées, désactivées dans le menu.

Sur l'onglet Safari de test de la démo, un bouton temporaire placé au-dessus
d'une vraie tuile du menu a capturé un `pointerdown` natif, puis passé
`pointer-events` à `none`. Le `pointerup` natif est resté ciblé sur ce bouton,
alors que `ownerDocument.elementFromPoint(clientX, clientY)` a retourné la tuile
`arrakis`, contenue dans le stage Sighty. Cela valide le hit-test choisi au
point de frontière DOM réel, avec des scènes montées dans le même document ; le
bouton temporaire ne simule ni le jeton, ni le dispatch Sighty.

Cette vérification utilise le DOM de la page réelle, mais ne traverse pas le
cycle de capture CodPlay du jeton, le callback de composition,
`runtime.dispatch` et l'admission d'une nouvelle question. Le glissement du
vrai jeton, les rejets, la réadmission, le redimensionnement et l'annulation
restent des critères de la validation réelle P5.

## Parcours retenu pour P5

1. La capture du jeton démarre dans `scene-layout`. Les actions live CodPlay
   font suivre le pointeur au jeton et rétablissent son ancrage à la fin de la
   capture.
2. Au `pointerup` natif, un listener `window` enregistré avant les sources
   CodPlay copie la pile sous le pointeur avec
   `ownerDocument.elementsFromPoint(clientX, clientY)`. Il ignore le jeton
   capturé et ses descendants, puis trouve la tuile menu. Un listener sur le
   `stage` transmet ensuite cette identité à Sighty par `runtime.dispatch`, une
   fois le passage des listeners CodPlay sur `window` terminé. Avec la capture
   pointeur, `event.target` peut rester le jeton ; le hit-test DOM retrouve
   l'élément menu sous la surimpression sans calculer de rectangles ni
   sélectionner d'instance CodPlay.
3. Sighty n'accepte qu'une tuile échouée lorsque le jeu est revenu au menu et
   que le jeton est disponible. Il envoie d'abord `extraHide` à `scene-layout`,
   puis publie l'événement de reprise à la fin de la transition CSS de 0,8 s.
   La route réadmet alors la question avec `showMode: 'reset'`, marque l'épreuve
   disponible, consomme le jeton à l'admission et révèle immédiatement la
   question. Un dépôt invalide conserve le jeton et le replace dans son
   emplacement. L'ordre retrait-avant-réadmission reste à valider sur le vrai
   parcours navigateur.

Le comportement de reprise est décidé : aucune attente d'indice de 3 s sur la
tentative rouverte. Le relais cible maintenant la tuile via le hit-test du DOM
partagé. La preuve du vrai pointeur et du parcours complet reste un critère
d'acceptation P5b.
