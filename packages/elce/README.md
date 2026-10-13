# Elcé

Elcé sert à composer des pages de lecture à partir de Sections, de Questions,
de Résultats, de Cartes et de Carousels. Les pages peuvent être organisées dans
des chapitres ou laissées à la racine du scénario.

## Démarrer

Depuis la racine du dépôt, lancez :

```sh
npm run dev:elce
```

Ouvrez dans un navigateur l’adresse de l’éditeur affichée par la commande.

## Créer une page et la lire

Ouvrez ou créez un projet, sélectionnez une page Flux, puis ajoutez du contenu
dans sa Section. Pour ajouter une image, déposez un fichier dans la Section.
Choisissez ensuite **Prévisualiser** pour ouvrir la lecture dans une fenêtre
distincte et voir la composition Sighty/CodPlay du document.

## Utiliser un projet dans plusieurs fenêtres

Chaque fenêtre choisit son projet séparément. Plusieurs fenêtres peuvent donc
travailler sur des projets différents. Pour un même projet, une seule fenêtre
à la fois peut modifier le contenu. Les autres affichent la dernière version
confirmée par le serveur en lecture seule.

### Prendre l'édition dans une autre fenêtre

Quand la fenêtre qui édite perd le focus ou passe en arrière-plan, Elcé tente
de synchroniser ses modifications confirmées puis de libérer l'accès. Si elle
ne le libère pas, vous pouvez tout de même demander l'édition depuis l'autre
fenêtre : cliquez dans la page ou utilisez le clavier. Elcé vérifie alors la
dernière version enregistrée sur le serveur avant d'activer l'édition.

La fenêtre entrante reste en lecture seule si elle ne peut pas vérifier la
version du serveur ou si elle a elle-même des modifications locales non
synchronisées. **Réessayer l'accès** relance la demande après le retour du
réseau ou la résolution de ces modifications. Le simple fait de donner le
focus à une fenêtre ne lui attribue pas l'édition.

### Exemple

Le même projet est ouvert dans les fenêtres A et B. A est éditable ; B affiche
la version confirmée en lecture seule. Vous cliquez dans B : elle charge la
dernière version confirmée par le serveur et devient éditable. A repasse en
lecture seule lorsqu'elle détecte la perte d'accès. Les modifications de A
qui n'étaient pas encore confirmées par le serveur ne sont pas transférées
automatiquement. Elcé ne fusionne pas deux éditions simultanées.

### Si la connexion ou la fenêtre est interrompue

Si le serveur ne peut pas confirmer la dernière version, la fenêtre entrante
reste en lecture seule. Au retour du réseau, utilisez **Réessayer l'accès**.
Si une fenêtre détentrice disparaît, son accès devient récupérable après
l'expiration du bail, au bout d'environ 12 secondes sans renouvellement.

**Forcer l'accès** reste un recours manuel si la demande par interaction ne
fonctionne pas. Il remplace l'accès courant et charge la dernière version
confirmée par le serveur. Les modifications locales non confirmées ne sont pas
récupérées automatiquement. Si **Enregistrer la copie locale sous…** est
proposé, utilisez cette action pour conserver ces modifications dans un autre
projet. Le forçage sert au dépannage ; son usage répété indique un problème à
examiner.

**Enregistrer sous…** crée un autre projet à partir de la version affichée et
ne modifie pas le projet source. **Fermer** ferme le projet dans cette fenêtre ;
le projet reste dans le catalogue. **Supprimer** retire le projet du serveur.
