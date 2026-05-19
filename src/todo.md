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

[ ] passer player poc dans un contexte Scene et non player facade.
[ ] ajout d'un module auteur à une scene : comment est-ce réalisé
[ ] ajouter un strap / story compte à rebours sur quiz

spec pause/telco a reprendre plus tard :
[ ] distinguer le pause telco du niveau courant active/inactive des tracks
[ ] un pause peut desactiver un ensemble de tracks de sequence principale et activer des tracks de suspension
[ ] les animations et events user joues pendant le mode pause ne sont pas conserves pour seek/rewind de la sequence principale
[ ] a la reprise play, restaurer l'etat normal des tracks, sauf celles deja inactives avant la pause
[ ] etudier un namespace ou une famille de tracks dediee au mode pause/suspension

spec inactivite user a reprendre plus tard :
[ ] garde-fou de fin automatique apres une longue inactivite user configurable (ex: 5 min)
[ ] definir si l'inactivite se base seulement sur les events recus par le track manager ou aussi sur des signaux globaux (souris, clavier)
[ ] definir des events `idle` derivables a partir de seuils d'inactivite (ex: 30s -> assombrir la sequence)
[ ] clarifier si les events idle sont places dans la sequence ou emis par un mecanisme runtime distinct
