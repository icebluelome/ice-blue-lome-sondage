# Sondage clients — Ice Blue Lomé

Mini-site mobile-first prêt pour GitHub Pages, sans abonnement ni dépendance technique à installer.

## Ce qui est inclus

- `index.html` : formulaire public en 5 étapes ;
- `admin.html` : tableau de bord protégé par un code secret ;
- `assets/config.js` : seul fichier à modifier pour brancher Google Sheets ;
- `assets/logo-ice-blue-lome.jpeg` : logo officiel utilisé dans les deux écrans ;
- `apps-script/Code.gs` : collecteur des réponses et calcul des statistiques ;
- mode démonstration local avec graphiques et interprétations.

Les choix « Autre / votre proposition » sont présents pour les parfums, mélanges, toppings et sauces. Aucun tarif n’est présenté.

## 1. Connecter un Google Sheet

1. Créez un nouveau Google Sheet depuis le compte Ice Blue Lomé.
2. Dans ce Sheet, ouvrez **Extensions > Apps Script**.
3. Remplacez le contenu de `Code.gs` par celui du fichier `apps-script/Code.gs` fourni ici, puis enregistrez.
4. Dans la liste des fonctions, choisissez `installer`, cliquez sur **Exécuter** et acceptez les autorisations Google.
5. Ouvrez le **Journal d’exécution** et copiez la valeur affichée après `CODE ADMIN À CONSERVER`. Ce code donne accès aux résultats : ne le publiez pas.
6. Cliquez sur **Déployer > Nouveau déploiement > Application web**.
7. Choisissez **Exécuter en tant que : Moi** et **Qui a accès : Tout le monde**, puis déployez.
8. Copiez l’URL qui se termine par `/exec`.
9. Ouvrez `assets/config.js`, remplacez `COLLEZ_ICI_L_URL_APPS_SCRIPT` par cette URL et passez `demoMode` de `true` à `false`.

Le formulaire envoie alors chaque réponse vers l’onglet `Réponses`. Le tableau de bord ne renvoie les statistiques que si le bon code administrateur est fourni. Les réponses individuelles et les prénoms ne sont jamais transmis au tableau de bord public.

> Après une modification future du code Apps Script, créez une nouvelle version du déploiement pour la rendre active.

## 2. Obtenir le lien public avec GitHub Pages

1. Créez un dépôt GitHub, par exemple `ice-blue-sondage`.
2. Ajoutez à la racine du dépôt tous les fichiers et dossiers de ce projet.
3. Dans GitHub, ouvrez **Settings > Pages**.
4. Dans **Build and deployment**, choisissez **Deploy from a branch**, puis la branche `main` et le dossier `/ (root)`.
5. Enregistrez. Après quelques minutes, le lien public aura la forme :
   `https://VOTRE-COMPTE.github.io/ice-blue-sondage/`

Le formulaire public est à la racine. L’espace équipe est disponible à l’adresse :
`https://VOTRE-COMPTE.github.io/ice-blue-sondage/admin.html`

## 3. Tester avant la mise en ligne

Tant que `demoMode` vaut `true` :

- les réponses saisies restent seulement dans le navigateur utilisé ;
- le bouton **Voir les données de démonstration** permet d’ouvrir le tableau de bord ;
- aucune donnée n’est envoyée sur Internet.

Après avoir branché Apps Script, passez `demoMode` à `false`, envoyez une réponse test depuis le formulaire, vérifiez qu’elle apparaît dans le Google Sheet, puis connectez-vous à `admin.html` avec le code généré par `installer`.

## Sécurité et confidentialité

GitHub Pages est public : `admin.html` peut être découvert, mais les données restent protégées côté Apps Script par le code secret. Le code n’est pas écrit dans les fichiers du site et n’est conservé que pour la session de l’onglet. Pour invalider un code compromis, exécutez `genererNouveauCodeAdmin` dans Apps Script.

Le formulaire demande un consentement explicite. Le prénom, la tranche d’âge et la fréquence sont facultatifs. Adaptez le texte de consentement si Ice Blue Lomé ajoute ultérieurement d’autres usages aux données.
