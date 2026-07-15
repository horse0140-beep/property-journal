# Supabase Auth URL configuration (HomeWise)

Apply in **Supabase Dashboard → Authentication → URL Configuration**.

> If confirmation links still open `https://homewise.app` (404), Supabase is falling back to **Site URL** because the redirect URL from the app is not allow-listed. Fix Site URL **and** Redirect URLs below.

## Site URL

```
homewise://auth/callback
```

**Do not use** `https://homewise.app` — there is no web auth handler yet.

## Redirect URLs (add every line)

```
homewise://auth/callback
homewise://auth/reset-password
homewise://**
exp://**
exp://192.168.*.*:*/**
exp://127.0.0.1:*/**
http://localhost:8081/**
http://127.0.0.1:8081/**
```

Do **not** add `https://homewise.app/*` until that domain serves a real auth callback page.

## Email template check

**Authentication → Email Templates → Confirm signup**

The link must use Supabase’s built-in variable (not a hardcoded domain):

```html
<a href="{{ .ConfirmationURL }}">Confirm your email</a>
```

If the template uses `{{ .SiteURL }}` instead, links will always go to homewise.app.

## What the app sends

| Action | `emailRedirectTo` / `redirectTo` |
|--------|----------------------------------|
| Sign up | `homewise://auth/callback` (native build) or `exp://…/--/auth/callback` (Expo Go) |
| Password reset | `homewise://auth/reset-password` or `exp://…/--/auth/reset-password` |

In dev, Metro logs: `[auth] signUp emailRedirectTo: …` — copy that exact URL into Supabase Redirect URLs if needed.

## Optional env override

```env
EXPO_PUBLIC_AUTH_REDIRECT_URL=homewise://auth/callback
```

## Verify

1. Update Site URL + Redirect URLs in Supabase.
2. Restart Expo (`npx expo start --tunnel`).
3. Sign up with a **new** email on the same device.
4. Check Metro log for `[auth] signUp emailRedirectTo`.
5. Tap the email link — should open HomeWise at `/auth/callback`, not homewise.app.
