# Paquet Sighty autonome — cours Demo 5

Cette page charge le scénario Demo 5 depuis son paquet exporté. Elle utilise le
loader livré dans le ZIP de distribution. Le paquet contient une seule copie de
CodPlay, de Sighty et de l’engine Demo 5, puis le scénario et ses paquets scène
CodPlay intacts avec leur CSS et leurs ressources locales.

```sh
npm run sighty-export:build --workspace=@codplay/demos
npm run dev --workspace=@codplay/demos
```

Ouvrir `/sighty-export/`. Quand le statut indique que les scènes sont prêtes,
aucune occurrence n’existe encore. Cliquer sur **Initialiser le cours** crée
les occurrences et affiche la page d’accueil du cours ; les gardes, le quiz,
le menu et la télécommande utilisent alors le scénario Sighty exporté.

Le retour à zéro recharge la page et prépare de nouveau le même paquet. La
source de la démo auteur reste disponible à `/sighty.html?demo=demo5`.
