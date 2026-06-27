# Supabase setup for cloud accounts

## 1. Create a project
1. Go to [supabase.com](https://supabase.com) → New project
2. Wait for the database to finish provisioning

## 2. Run the schema
1. Open **SQL Editor** in the Supabase dashboard
2. Paste the contents of `supabase/schema.sql` and run it

## 3. Get API keys
1. **Project Settings → API**
2. Copy **Project URL** → `SUPABASE_URL`
3. Copy **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - Never expose this in the frontend — server API routes only

## 4. Session secret
Generate a random string (32+ chars) for `SESSION_SECRET` — used to sign login cookies.

## 5. Add to environment
**Local** — `.env`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SESSION_SECRET=your-long-random-string
```

**Vercel** — Project → Settings → Environment Variables (same three keys)

## 6. Verify
Visit `/status` on your deploy — **Account sync** should show `configured`.

## 7. Use the app
Open **Account** in the header → Create account or Sign in.

- Username: 3–20 chars, letters/numbers/underscore
- PIN: 4–6 digits
- Portfolio auto-syncs ~2s after changes
