# MAALKA — Gestion interne location de robes

Application interne premium pour gérer:
- le stock des robes,
- les clients,
- les réservations,
- les photos des robes (Supabase Storage),
- le téléchargement de contrat/facture PDF.

Stack: Next.js (App Router) + Tailwind + Supabase (Auth, Postgres, Storage) + Vercel.

## Prérequis

- Node.js 20+
- npm
- Compte Supabase avec un projet actif
- Supabase CLI (déjà incluse dans les dépendances dev de ce projet)

## Installation locale

1) Installer les dépendances:

```bash
npm install
```

2) Configurer les variables d'environnement:

```bash
cp .env.example .env.local
```

Puis remplir `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3) Lancer le serveur local:

```bash
npm run dev
```

Application: http://localhost:3000

## Base de données Supabase

Les migrations sont dans `supabase/migrations`.

Pour pousser les migrations vers le projet Supabase lié:

```bash
npx supabase db push
```

## Vérification qualité

```bash
npm run lint
npm run build
```

## Déploiement sur Vercel

1) Importer le repo dans Vercel.
2) Ajouter les variables d'environnement du projet:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3) Déployer.

Build command: `npm run build`

## Notes importantes

- Les PDFs (contrat/facture) sont générés à la volée et téléchargés directement (pas de stockage PDF).
- Les photos de robes sont stockées dans le bucket Supabase `dresses`.
- L'accès applicatif est protégé par authentification Supabase (email/mot de passe).
