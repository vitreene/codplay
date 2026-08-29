[ ] clean dead code dans runtime : apply-actions notamment
[ ] regrouper les fichiers à peu de lignes
[ ] regrouper les configs au niveau app dans un dossier
[ ] dans mdei, et autres, utiliser les constantes pour "playing" et idems
[ ] exemples et demos dans le meme dossier ; si exemple n'est plus branché, jeter.

test media :
[ ] master,
[ ] suite de masters,
quand un son est joué, en master, peut-il etre interrompu par une action utilisateur (autre que telco) : exemple : question enoncée dans un quie. ou bien master n'est pas utile dans ce cas. quel périmetre pour master ?
[ ] test avec video.

[x] passer player poc dans un contexte Scene et non player facade.
[x] ajout d'un module auteur à une scene : comment est-ce réalisé
[x] ajouter un strap / story compte à rebours sur quiz

spec pause/telco a reprendre plus tard :
[ ] distinguer le pause telco du niveau courant active/inactive des tracks
[ ] un pause : **suspend** peut desactiver un ensemble de tracks de sequence principale et activer des tracks de suspension
[ ] les animations et events user joues pendant le mode pause ne sont pas conserves pour seek/rewind de la sequence principale
[ ] a la reprise play, restaurer l'etat normal des tracks, sauf celles deja inactives avant la pause
[ ] etudier un namespace ou une famille de tracks dediee au mode pause/suspension

spec inactivite user :
[x] garde-fou configurable du player, actif par defaut a 30 s et desactivable par `idle: false` (voir `packages/codplay/plan/idle-inactivity-plan.md`)
[x] idle core fonde sur les emissions externes recues par le player ; les signaux globaux (souris, clavier) restent du ressort d'un adaptateur hote
[x] un seuil idle produit l'event configure, `sequence:end` par defaut
[x] l'event idle passe par le circuit normal du player et son journal
[ ] ajouter l'adaptateur de signaux d'inactivite de fenetre (hors coeur CodPlay)

observation runtime a revoir plus tard :
[ ] separer clairement la phase de mise en place initiale avant t=0 du debut effectif de timeline; retard sporadique observe sur intro dans s4, a reconfirmer avant correction
