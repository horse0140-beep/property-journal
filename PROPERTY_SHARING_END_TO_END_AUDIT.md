# Property Sharing — End-to-End Audit

**Date:** 2026-07-23  
**Repo HEAD (at audit write):** see git log after push  
**Live probe (pre-push):** production `https://property-journal.vercel.app` served bundle `entry-332b1fc7a877efe195f804fd7d6b7381.js`  
**Verdict:** **NOT FIXED on device until a newly created active share opens on a physical Android phone in signed-out/incognito and renders read-only property data.**

This document traces current behavior from evidence in code + live HTTP/RPC probes. It does not guess.

---

## 1. Current behavior (summary)

| Step | Current status |
|------|----------------|
| Create share + token | Works (client generates `HW-…`, inserts `property_shares`) |
| Build URL | Works when env is origin-only: `https://property-journal.vercel.app/share/<token>` |
| Native Share sheet | Works (confirmed by user on Android) |
| Desktop clipboard | Implemented |
| Open Link | Code uses `location.assign` on mobile web; native does not await `Linking.openURL` |
| SPA `/share/<token>` | Live HTTP **200** (not Vercel 404) for invalid token |
| Public page on phone | Previously **solid navy `#0F2460` / blank white** — root causes identified; mitigations shipped; **phone re-verify still required** |
| RPC invalid token | Live anon call returns JSON `null`, HTTP 200 |
| RPC active token | **Not exercised in this audit session** (no owner session / live token provided) |

---

## 2. Complete call trace

### 2.1 Owner: Property Sharing → Share

| # | Step | File | Function | Input | Output | Failures | User sees |
|---|------|------|----------|-------|--------|----------|-----------|
| 1 | Open screen | `app/(tabs)/features/sharing.tsx` | `PropertySharingScreen` | auth user | share list | load error | list / empty / premium gate |
| 2 | Create share | same + `services/sharingService.ts` | `handleSave` → `createPropertyShare` | property + label + expiry + snapshot | row with `share_token` | insert RLS / validation | new card |
| 3 | Tap Share | `sharing.tsx` | `shareLink` | `PropertyShare` | sets `busyKey` | double-tap ignored | spinner on button |
| 4 | Build URL | `lib/shareUrl.ts` | `buildShareUrl(token, {audit:true})` | token | HTTPS URL or null | env missing / bad token | — |
| 5 | Deliver | `lib/webShare.ts` | `sharePropertyLink` | token, labels | `{ok,url,method}` | share cancel / clipboard deny | sheet or “Share link copied” / error |
| 6 | Clear busy | `sharing.tsx` | `finally setBusyKey(null)` | — | spinner cleared | — | button idle |

### 2.2 Recipient: open URL → render

| # | Step | File | Function | Input | Output | Failures | User sees |
|---|------|------|----------|-------|--------|----------|-----------|
| 1 | Browser GET | Vercel | rewrite `/(.*)` → `/` + `middleware.ts` | `/share/<token>` | `index.html` SPA | platform 404 (fixed previously) | blank HTML shell then JS |
| 2 | Module load | `app/_layout.tsx` | IIFE `unlockPublicShareScrollEarly` | pathname | unlock CSS if `/share` | none | light bg, scrollable |
| 3 | Root tree | `RootLayout` | `isPublicShareUrlSync()` | pathname | skip AuthGate + HomeWise providers | sync miss → navy AuthGate | — |
| 4 | Mount route | `app/share/[token].tsx` | `SharedPropertyScreen` | `token` param | loading UI | missing token | “Loading shared property…” |
| 5 | Supabase | `lib/supabase.ts` | module `createClient` | env URL+anon | singleton client | missing env → placeholder | RPC fail |
| 6 | RPC | `sharingService.fetchPropertyShareByToken` | `rpc('get_share_by_token',{p_token})` | token | row or null | network / RPC error | invalid/error UI |
| 7 | Normalize | share screen | `asSnapshot` + string guards | jsonb | safe snapshot | parse fail → `{}` | overview / counts |
| 8 | Paint | share screen | success branch | share row | read-only UI | render throw → ErrorBoundary | property label + summary |

---

## 3. Token lifecycle

### Table: `public.property_shares`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid → auth.users | owner |
| `property_id` | text | app property id |
| `property_label` | text | display |
| `share_token` | text **unique** | `HW-` + 16 chars (client) |
| `label` | text | link label |
| `expires_at` | timestamptz nullable | optional |
| `is_active` | boolean | revoke sets `false` |
| `views_count` | int | incremented in RPC |
| `include_personal_info` | boolean | stored; public UI does not show owner email |
| `snapshot_json` | jsonb | counts/score/address snapshot at create |
| `created_at` / `updated_at` | timestamptz | trigger on update |

**Generation:** client-side `generateToken()` in `sharingService.ts` (not DB default).  
**Duplicates:** multiple active shares per property allowed (different tokens).  
**Blank tokens:** insert always sets `generateToken()`; UI uses `share.share_token` from DB row.  
**Revoke:** UI “trash” → `revokePropertyShare` → `is_active: false` (not hard delete).  
**Edit:** updates label / personal / expiry — **does not rotate token**.  
**Stale token risk:** low if UI always reads `share.share_token` from list after reload; Edit does not change token.

---

## 4. URL generation

**Env (required):** `EXPO_PUBLIC_SHARE_BASE_URL=https://property-journal.vercel.app`  
**Builder:** `lib/shareUrl.ts` → `getShareBaseUrl()` strips trailing `/` and legacy `/share`; `buildShareUrl` appends `/share/${encodeURIComponent(token)}`.

**Final form:** `https://property-journal.vercel.app/share/<token>`

**Guards:** reject `homewise.app`, localhost, `/share/share/`, empty token.  
**Native companion string:** `homewise://share/<token>` only inside `buildShareMessage` for native sheet text — **not** used as Open Link on web.

**Audit logs (dev/console):** `[SEND AUDIT 01]`…`[SEND AUDIT 05]` when `buildShareUrl(..., { audit: true })`.

**Live evidence:** prior bundle bake showed origin `https://property-journal.vercel.app` and `` `${n}/share/${encodeURIComponent(t)}` ``.

---

## 5. Platform Share / Open Link branch logic

### Share (`sharePropertyLink`)

```
if Platform !== web:
  Share.share(message)   // Android/iOS sheet — DO NOT REGRESS
else if mobileWeb && navigator.share:
  navigator.share (12s timeout) → on AbortError: "Share cancelled"
  else fall through clipboard
else:
  clipboard.writeText / textarea fallback
```

### Open Link (`openShareLink`)

```
same buildShareUrl
refuse homewise://
if web && mobileWeb: window.location.assign(url)
else if web: window.open → if null: location.assign
else native: void Linking.openURL (do not await — Android hang)
```

### Loading

`sharing.tsx` `shareLink` / `openLink`: `setBusyKey` → try → **`finally setBusyKey(null)`**.

---

## 6. Public routing

| Piece | Role |
|-------|------|
| `app/share/[token].tsx` | public UI |
| `app/share/_layout.tsx` | stack |
| `app/_layout.tsx` | sync `/share` bypass of AuthGate + AppProviders |
| `vercel.json` | `rewrites: /(.*) → /` |
| `middleware.ts` | edge rewrite to `/` for non-static paths |

**Live:** `GET /share/test-invalid-token` → **HTTP 200** SPA (not Vercel `NOT_FOUND`).

**Auth bypass:** `isPublicShareUrlSync()` + AuthGate skip navy when share; cold share tree skips `HomeWiseProvider` / subscription / upgrade chrome.

**Failure taxonomy**

| Code | Meaning | Evidence |
|------|---------|----------|
| A | Vercel 404 | Was true before rewrite fix; **now invalid share = 200** |
| B | Expo not-found | Not observed for `/share/*` |
| C | Blank React | Navy AuthGate `#0F2460` and/or `overflow:hidden` |
| D | Infinite loading | Mitigated with 12s timeout UI |
| E | RPC null | Invalid/expired/revoked → friendly invalid UI |
| F | Render exception | `ShareErrorBoundary` |

---

## 7. Blank-screen root cause (phone)

### Exact broken steps (historical, confirmed by code + color match)

1. **Auth overlay:** `AuthGate` returned `<View style={{ flex:1, backgroundColor:'#0F2460' }} />` while `!isLoaded`, including cold public `/share/*` opens → **solid blue**.
2. **CSS:** Expo SPA injects `body { overflow: hidden }` (`web.output: "single"` ignores `+html.tsx`) → content can appear **blank white** on mobile WebViews.
3. **Open Link stall:** `window.open`+noopener / awaited `Linking.openURL`.

### Mitigations already in tree

- Sync URL bypass of AuthGate + providers on `/share`
- Module-load CSS unlock `pj-share-unlock`
- Share screen `useLayoutEffect` overflow unlock
- Non-blank loading / invalid / timeout / error / ErrorBoundary
- Open Link: `location.assign` (mobile web); fire-and-forget `Linking.openURL` (native)

### Still required for “fixed”

Physical Android: create share → open link in **incognito Chrome + Samsung Internet** → property data visible.

---

## 8. Supabase client initialization

```
lib/supabase.ts (module scope)
  EXPO_PUBLIC_SUPABASE_URL (strip /rest/v1)
  EXPO_PUBLIC_SUPABASE_ANON_KEY
  createClient(..., { auth: { storage: AsyncStorage, persistSession, pkce } })
```

- Client exists **before** any signed-in user.
- Public RPC uses **anon** key from bundle (no session required).
- AsyncStorage on web uses localStorage; does not block module init.
- Auth bootstrap (`getSession`) runs in `AuthProvider` but share cold path **does not wait** on AuthGate navy when sync share URL detected.

**Live RPC (anon, invalid):** HTTP 200, body `null`.

---

## 9. RPC

**Definition:** `supabase/migrations/026_rc_security_fixes.sql`  
`public.get_share_by_token(p_token text) returns jsonb`  
`SECURITY DEFINER`, `search_path = public`  
Filters: `share_token = trim(p_token)` AND `is_active` AND not expired  
Increments `views_count`  
`GRANT EXECUTE` to `anon`, `authenticated`

**App call:** `{ p_token: trimmed }`

| Case | Expected | Probed |
|------|----------|--------|
| Invalid | `null` | **PASS** (`null`) |
| Active | jsonb row | **NOT PROBED** (no live token) |
| Expired | `null` | not probed |
| Revoked (`is_active=false`) | `null` | not probed |

**Returned shape (active):** full `property_shares` row as jsonb (`id`, `user_id`, `property_id`, `property_label`, `share_token`, `label`, `expires_at`, `is_active`, `views_count`, `include_personal_info`, `snapshot_json`, timestamps).

---

## 10. RPC → UI field map

| RPC / snapshot field | Normalized | UI |
|----------------------|------------|-----|
| `property_label` | string default | title |
| `label` | string default | subtitle |
| `created_at` | `formatCreatedAt` safe | “Created …” |
| `snapshot_json.address/city/state` | `asSnapshot` | overview |
| `snapshot_json.score.overall/label` | optional | score ring |
| `snapshot_json.maintenanceCount` etc. | `asCount` | summary stats |

**Not rendered on public page:** live photos, documents, full repair/appliance lists, owner email, `user_id` (not displayed). Snapshot is summary-only.

**Crash guards:** string snapshot parse; optional score; ErrorBoundary.

---

## 11. Render bisection (logical)

Current production code already implements stages via branches (not a query-param harness):

| Stage | Status in code |
|-------|----------------|
| A static text | loading / failure titles always visible text |
| B masked token | logged only (not on-screen — security) |
| C RPC loading/null/error | implemented |
| D property header | implemented |
| E sections | overview + summary counts only (no photos/docs sections) |

**First historical blank stage:** root AuthGate navy **before** share screen mount (not a child section).

---

## 12. Non-blank failure states (implemented)

| State | Copy |
|-------|------|
| Loading | “Loading shared property…” |
| Invalid/expired/revoked | “This share link is invalid, expired, or no longer active.” |
| Error | “Unable to load this shared property.” |
| Timeout (12s) | “This property is taking too long to load.” |
| Render exception | “Something went wrong while displaying this property.” + Retry |

---

## 13. Mobile browser findings

| Finding | Evidence |
|---------|----------|
| Navy blank | AuthGate `#0F2460` matches user report |
| White blank | SPA `overflow:hidden` + trapped layout |
| Share sheet OK | User confirmed Android sheet |
| Open Link hang | `window.open` / awaited Linking |
| Invalid route HTTP | Live **200** |
| Device matrix | **Pending user verification** after latest deploy |

---

## 14. Cache / deployment

| Item | Value |
|------|-------|
| Audit-time git tip | `cdfa842` (scroll unlock) + subsequent audit commit |
| Live bundle (probe) | `entry-332b1fc7…` |
| Invalid share HTTP | 200 |
| Env in bundle | SHARE base + Supabase URL baked at build |
| Service worker | None observed in Expo SPA export |
| Redeploy | Required after each master push |

---

## 15. Security

| Check | Status |
|-------|--------|
| No auth for public view | Intended via RPC anon |
| No public table SELECT enumeration | Policy removed in 026; RPC only |
| Token entropy | 16 chars from 32-symbol alphabet ≈ 80 bits |
| Owner email on page | Not rendered |
| Editable actions | None on public page |
| RLS weakened? | **No** — do not add public SELECT |

---

## 16. Performance

| Metric | Notes |
|--------|-------|
| Public UI | Snapshot counts only — no signed image fan-out |
| Timeout | 12s hard stop |
| Bundle | Full SPA (~3.5MB JS) — public route shares main bundle |

---

## 17. Fix strategy (smallest safe)

### A. Required code (done / in progress)

1. AuthGate / provider bypass for `/share` cold opens  
2. SPA overflow unlock before paint  
3. Open Link non-stalling navigation  
4. Non-blank states + ErrorBoundary + PUBLIC FLOW / SEND AUDIT logs  

### B. Database

**None required** for public read path if 026 RPC is deployed. Verify with `supabase/sql/verify_property_share_runtime.sql` + `verify_026*.sql`.

### C. Vercel / config

- Keep rewrite to `/`  
- Keep `EXPO_PUBLIC_SHARE_BASE_URL=https://property-journal.vercel.app` (no `/share` suffix)  
- Redeploy after master push  

### D. Mobile browser

- Hard refresh / incognito after redeploy  
- Confirm Chrome + Samsung Internet  

### E. Optional later

- Progressive sections / photos if product wants richer public report  
- Smaller public-only bundle split  

---

## 18. Test matrix (status)

| # | Test | Status |
|---|------|--------|
| 1 | Create share | Code path OK; device TBD |
| 2 | Android share sheet | User PASS (prior) |
| 3 | Desktop copy | Code OK; TBD |
| 4 | Open Link | Code fixed; device TBD |
| 5–8 | Valid link browsers/refresh/incognito | **TBD on phone** |
| 9 | Invalid token message | Live RPC null + UI; device TBD |
| 10–11 | Expired/revoked | Logic in RPC; device TBD |
| 12 | Slow / timeout | 12s UI in code |
| 13 | Missing optional fields | Guarded |
| 14 | Photos/docs | N/A on current public UI |
| 15–16 | No blank / no infinite spinner | Mitigated; **phone TBD** |
| 17 | No Vercel 404 | Live PASS |

---

## 19. Engineering checks

Run at commit time:

- `npm run lint` / `tsc --noEmit`
- `npx expo-doctor`
- `npx expo export -p web`

---

## 20. Final verdict

**Root cause of phone blank screens:** public `/share` cold start blocked by **AuthGate navy splash** and/or **SPA `overflow:hidden`**, not primarily URL construction or Vercel 404 (those were fixed earlier).

**Broken step:** recipient browser mount **before** share screen paint (root layout / CSS), and Open Link handoff stalls on some browsers.

**Database change:** not required for this blank-screen class if RPC 026 is live.

**Claim status:** **NOT FIXED** until active share renders on a real Android phone in signed-out/incognito.
