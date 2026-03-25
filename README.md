# Project M

## Supabase Auth (email/password)

This app now uses Supabase Auth for sign-in and route protection.

### Required environment variables

Add these to `.env.local` (and production env):

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
CRON_SECRET=...
```

### Behavior

- Unauthenticated browser users are redirected to `/login`
- Login page uses Supabase email/password sign-in
- API routes require authenticated Supabase session, except cron/integration calls that include `x-cron-secret` with `CRON_SECRET`

### Notes

- Drizzle + pg data access remains unchanged; Supabase Auth gates app access/session.
- This auth layer complements DB hardening / RLS strategy.
