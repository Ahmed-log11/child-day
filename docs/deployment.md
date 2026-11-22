# Deployment

Nothing is deployed yet. These are the steps for when the app is ready.

## Backend → Hugging Face Space (Docker, free CPU)

1. Create a new Space: SDK **Docker**, hardware **CPU basic**.
2. Push the contents of `backend/` to the Space repo.
3. The Space needs a `README.md` at its root starting with:
   ```yaml
   ---
   title: Child Day API
   sdk: docker
   app_port: 7860
   ---
   ```
4. In the Space **Settings → Secrets**, add `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`,
   and `CORS_ORIGINS` (the Vercel URL, as a JSON list).
5. Model weights: upload them to a Hugging Face model repo and download them in the Dockerfile.

If Docker Spaces are not available on the account, the fallback is Render (2 GB plan). The Dockerfile works there unchanged.

## Frontend → Vercel

1. Import the GitHub repo in Vercel, root directory `frontend`.
2. Environment variables: `VITE_API_URL` = the Space URL, `VITE_USE_MOCKS` = `false`.
3. `vercel.json` already handles page refreshes on routes like `/dashboard`.

## Database → Supabase

1. Create a free project. Copy the Postgres connection string into `DATABASE_URL`.
2. Create a Storage bucket named `clips` for alert clips.
3. Run `python -m app.seed` once to load the demo household.
4. Free projects pause after about a week without use. Open the dashboard the day before the demo.
