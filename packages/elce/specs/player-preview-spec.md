# Elcé — surface de preview

## Statut

**En cours — la fenêtre distincte, la navigation indépendante et la
synchronisation manuelle sont vérifiées. Le sommaire accessible présente un
état `aria-expanded` incohérent à 801 px et un transfert de focus tardif à la
fermeture ; voir le plan de construction avant de clore l’acceptation.**

## Contrat

Le bouton « Prévisualiser » ouvre le lecteur dans une fenêtre distincte. La
modale intégrée est conservée dans le code, mais son accès reste désactivé
pendant le POC afin de comparer les deux parcours. La fenêtre reçoit le
document de l’éditeur et la page sélectionnée au moment de son ouverture.

Le lecteur monte la composition Sighty/CodPlay réelle dans son propre contexte
de navigateur. Sa navigation est indépendante de celle de l’éditeur. Les
modifications de l’éditeur ne changent pas le rendu ouvert tant qu’une
synchronisation n’est pas demandée.

La barre du lecteur propose deux commandes :

- « Réafficher la page éditée » sélectionne la page active dans l’éditeur. Si
  cette page n’existe pas encore dans l’instantané du lecteur, la commande
  demande une synchronisation une seule fois avant de l’afficher.
- « Synchroniser » transmet le document courant de l’éditeur et sa page
  sélectionnée. Le lecteur affiche cette page dans le nouvel instantané.

Chaque commande associe une icône à son libellé. À 800 px et en dessous, le
libellé visible est masqué et l’icône reste seule. Le texte reste disponible
dans l’attribut `title` et dans le nom accessible du bouton. Au-dessus de
800 px, l’icône et le libellé sont visibles ensemble.

Chaque instantané reçu monte une nouvelle composition du lecteur. La
progression, les réponses et l’historique restent locaux à cette session de
lecture et ne sont pas persistés.

Le document de l’éditeur reste la source unique. La communication entre les
fenêtres transporte des demandes et des instantanés ; elle ne crée ni document,
ni catalogue, ni navigation parallèle. Les médias réutilisent le stockage
IndexedDB existant et leurs sources sont chargées dans le contexte du lecteur.

Le lecteur rend le menu, le titre de page, le contenu Flux et la navigation
précédente/suivante avec les compositions Sighty/CodPlay existantes. Le menu et
l’ordre de lecture reprennent la séquence racine du document : les pages
autonomes sont au même niveau que les chapitres. Les pages du catalogue restent
exclues du scénario.

## Preuves

- [`app-layout.tsx`](../src/app/layout/app-layout.tsx) expose le lancement du
  lecteur et désactive l’accès à la modale intégrée pour le POC.
- [`popup-preview-host.ts`](../src/app/player/popup-preview-host.ts) ouvre le
  lecteur depuis la page sélectionnée et transmet les instantanés depuis
  l’acteur XState existant.
- [`popup-player.tsx`](../src/app/player/popup-player.tsx) reçoit les
  instantanés, restaure les médias depuis IndexedDB et remonte la composition
  à chaque nouvelle révision.
- [`popup-player.css`](../src/app/player/popup-player.css) conserve les libellés
  des commandes sur ordinateur et masque le texte au profit des icônes à 800 px
  et en dessous.
- [`popup-preview-host.test.ts`](../src/app/player/popup-preview-host.test.ts)
  vérifie la page de départ, la synchronisation du document édité et la
  sélection de la page courante.
- [`popup-player.test.tsx`](../src/app/player/popup-player.test.tsx) vérifie la
  synchronisation automatique demandée lorsque la page éditée a été créée
  depuis le dernier instantané.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie que la composition réutilise les sources de scènes inchangées lors
  d’un changement d’organisation et reconstruit la scène d’une page éditée.
- Brave DevTools, le 5 octobre 2026, confirme l’ouverture dans une fenêtre
  distincte depuis la page éditée, la navigation indépendante, l’attente d’une
  synchronisation manuelle après correction, le retour à la page éditée et la
  synchronisation unique lorsque cette page vient d’être créée. Après
  réorganisation, le nouveau scénario place la page éditée en première
  position ; le test de composition vérifie l’identité des sources de scènes
  conservées. Brave confirme aussi les deux icônes, les libellés accessibles et
  les `title` à 390 px et 800 px, puis les libellés visibles à 801 px ; aucune
  erreur ni aucun avertissement n’apparaît dans la console du lecteur.
- Le même parcours Brave charge une image dans le lecteur après synchronisation
  et après fermeture/réouverture. L’événement `change` de l’input natif a été
  déclenché avec un fichier `File` synthétique, car l’outil MCP a refusé le
  chemin local ; la boîte de dialogue système de sélection de fichier n’a pas
  été observée dans ce test.
- À 390 × 844 et 800 × 900, Brave vérifie l’ouverture du tiroir, la sélection
  d’une page, la fermeture par Échap et par clic extérieur, et le retour final
  du focus. À 390 px, il n’y a pas de débordement horizontal. Lors du passage
  de 800 à 801 px, le bouton masqué conserve `aria-expanded="true"` alors que
  le tiroir est fermé. À la sélection d’une page, le navigateur signale aussi
  que le focus reste brièvement sur le bouton de page pendant que son ancêtre
  reçoit `aria-hidden`. Ces deux états d’accessibilité restent à corriger ;
  l’acceptation correspondante est suivie dans le
  [plan de construction](../plan/2026-10-01-elce-construction-plan.md).
- Vérifications workspace Elcé : typecheck réussi, 130 tests réussis sur 130,
  build réussi. Le build signale un chunk JavaScript supérieur à 500 kB.
