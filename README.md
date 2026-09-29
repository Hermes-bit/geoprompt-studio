# GéoPrompt Studio

Application privée de prompts géomatiques quotidiens, de veille, d'étude de marché (France et Burkina Faso), de gestion de projets Scrum, d'agenda et de prospection.

- **Code** : ce dépôt GitHub privé.
- **Hébergement** : Cloudflare Pages (gratuit, relié à ce dépôt privé).
- **Données personnelles** (projets, tâches, agenda, prospects, besoins, risques, favoris) : Supabase (gratuit), protégées par une connexion à votre adresse email.
- **Contenu du jour** (prompts, veille, besoins et contacts repérés) : fichiers `data/daily/AAAA-MM-JJ.json`, ajoutés chaque matin avant 7 h 00 par la veille automatique Claude.

---

## Installation (20 minutes, une seule fois)

### 1. Créer la base Supabase
1. Créez un compte gratuit sur **supabase.com**, puis cliquez sur **New project** (région : Europe, par exemple Paris ou Francfort).
2. Dans le projet, ouvrez **SQL Editor**, collez le contenu de `supabase/schema.sql` puis cliquez sur **Run**.
3. **Authentication → Sign In / Providers → Email** : laissez **Enable Email provider** activé. **Confirm email** activé (conseillé) : chaque nouveau compte reçoit un email de confirmation avant la première connexion.
4. **Authentication → Emails → Templates** : traduisez en français les modèles « Confirm signup » et « Reset password » (objet et texte), avec votre logo si vous le souhaitez.
5. Le service d'envoi d'emails fourni par Supabase est limité à quelques messages par heure : pour une utilisation réelle, renseignez votre propre serveur d'envoi dans **Project Settings → Authentication → SMTP** (par exemple Brevo, gratuit jusqu'à 300 emails par jour).
6. Ouvrez **Project Settings → API** et notez :
   - **Project URL** (ex. `https://abcd1234.supabase.co`)
   - la clé **anon public**.

### 2. Renseigner `config.js`
Remplacez `supabaseUrl` et `supabaseAnonKey` par les deux valeurs notées. La clé « anon » peut figurer dans le code : ce sont les règles de sécurité de la table qui protègent vos données (chaque ligne n'est lisible que par son propriétaire).
Vous pouvez aussi m'envoyer ces deux valeurs : je fais la modification pour vous.

### 3. Mettre l'application en ligne avec Cloudflare Pages
1. Créez un compte gratuit sur **dash.cloudflare.com**.
2. **Workers & Pages → Create → Pages → Connect to Git**, autorisez GitHub et choisissez le dépôt privé `geoprompt-studio`.
3. Réglages : *Framework preset* = **None**, *Build command* = vide, *Build output directory* = `/`.
4. **Save and Deploy**. Vous obtenez une adresse du type `https://geoprompt-studio.pages.dev`.
5. Dans Supabase, **Authentication → URL Configuration** : mettez cette adresse dans **Site URL**.

Chaque modification du dépôt (dont la veille de 7 h) redéploie le site automatiquement.

### 4. Connexion avec Google (facultatif mais conseillé)
1. Sur **console.cloud.google.com** : créez un projet, puis **API et services → Écran de consentement OAuth** (type Externe, nom « GéoPrompt Studio », logo GEOMESSEN).
2. **Identifiants → Créer des identifiants → ID client OAuth → Application Web**. Dans **URI de redirection autorisés**, collez l'adresse indiquée par Supabase (**Authentication → Sign In / Providers → Google**, de la forme `https://VOTRE-PROJET.supabase.co/auth/v1/callback`).
3. Recopiez l'**ID client** et le **Code secret** dans Supabase (**Providers → Google**), puis activez le fournisseur.
4. Dans Supabase, **Authentication → URL Configuration** : ajoutez votre adresse `https://…pages.dev` dans **Redirect URLs**.

### 5. Comptes et profils
- **Page d'ouverture** : logo GEOMESSEN animé, présentation, puis **Créer un compte** (prénom, nom, email, mot de passe de 8 caractères minimum avec un chiffre) ou **Se connecter** (email, mot de passe). « Mot de passe oublié ? » envoie un lien de réinitialisation. Google reste disponible en un clic.
- **N'importe qui peut créer un compte**, avec n'importe quelle adresse email. Le profil (nom, email) est créé automatiquement ; le reste (entreprise, logo, tarif, SIRET) se complète quand on veut dans « Mon profil ».
- **Chaque compte a son propre espace** : projets, agenda, prospects, devis, signatures et carnet ne sont visibles que par leur propriétaire (règles de sécurité de la table `docs`).
- Pour **réserver l'accès** à certaines personnes, listez leurs adresses dans `allowedEmails` de `config.js`, ou désactivez **Allow new users to sign up** dans Supabase une fois les comptes créés.
- Le contenu commun (prompts, veille, géotraitements, études de marché) est le même pour tous les comptes.

**Verrouillage total (facultatif)** : **Cloudflare Zero Trust → Access** (gratuit jusqu'à 50 utilisateurs) peut masquer tout le site derrière une vérification d'email.

---

## Installer l'application sur l'iPhone
1. Ouvrez l'adresse dans **Safari**.
2. Touchez **Partager** puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. Ouvrez l'icône et connectez-vous avec votre **email et votre mot de passe**. Sur l'application installée, préférez l'email et le mot de passe : la connexion Google s'ouvre dans Safari, qui ne partage pas sa session avec l'icône de l'écran d'accueil.

## Devis signés
- **PDF** : bouton « Télécharger en PDF » dans chaque devis ou facture, avec votre logo et vos coordonnées.
- **Signature** : bouton « Signer », tracé au doigt. L'application calcule une empreinte SHA-256 du contenu (lignes, montants, client, émetteur, signature) et l'imprime en bas du PDF avec un code de vérification.
- **Contrôle** : « Vérifier un document » compare le document enregistré à son empreinte. Toute modification après signature est signalée. Un document signé est verrouillé ; pour le modifier, il faut retirer la signature (elle est archivée).
- Il s'agit d'une **signature électronique simple** avec scellement d'intégrité. Pour un marché qui exige une signature électronique avancée ou qualifiée (eIDAS), passez par un prestataire certifié (Yousign, Docusign…).

L'application s'ouvre en plein écran et reste consultable hors connexion. Il n'y a pas besoin de l'App Store.

## Siri et la voix
Dans l'app **Raccourcis** :

**« Ajoute à GéoPrompt »** (ajout vocal d'un rendez-vous, d'une tâche ou d'un prospect)
1. Action **Dicter le texte** (langue : français).
2. Action **URL** : `https://VOTRE-ADRESSE.pages.dev/#ajout=` suivi de la variable **Texte dicté**.
3. Action **Ouvrir les URL**.
4. Nommez le raccourci « Ajoute à GéoPrompt ». Dites : « Dis Siri, ajoute à GéoPrompt », puis « Réunion avec l'ONEA jeudi 10 h ». L'application s'ouvre avec le formulaire pré-rempli : vous n'avez plus qu'à valider.

**« Ouvre mon agenda géomatique »** : action **Ouvrir les URL** avec `https://VOTRE-ADRESSE.pages.dev/#agenda` (ou `#prompts`, `#projets`, `#marches`, `#veille`).

Dans l'application, le bouton **Dicter** utilise la reconnaissance vocale du navigateur quand elle est disponible. Sinon, touchez le micro du clavier.

---

## Différences avec la version Claude
La version Claude (artifact) peut rédiger avec Claude : mails personnalisés, business plan complet, backlog, prompts sur mesure. Cette version autonome fonctionne sans Claude : modèles de mails, canevas de business plan et backlog type. Les prompts et la veille quotidiens arrivent dans les deux versions.

## Structure
```
index.html            application (une seule page)
config.js             adresse et clé Supabase
manifest.webmanifest  installation sur l'écran d'accueil
sw.js                 fonctionnement hors ligne
icons/                icônes
data/base.json        contenu de départ (46 prompts, études, besoins, risques, prospects)
data/index.json       liste des jours publiés par la veille
data/daily/           un fichier par jour de veille
supabase/schema.sql   table et règles de sécurité
tools/                script de génération de index.html
```
