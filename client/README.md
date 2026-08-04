# Elektor Pro — Client

Next.js 16 (App Router) + React 19 + Tailwind v4 + RTK Query. Minimal, flat,
fully responsive UI (down to the smallest folding-phone widths).

## Architecture

- **Server Components by default**; `"use client"` only on interactive leaves.
- **All data through RTK Query** — one `apiSlice` with cookie-credentialed
  `fetchBaseQuery` and a mutex-guarded silent token refresh on 401. Feature
  endpoints are added via `injectEndpoints`.
- **Forms** with react-hook-form + Zod (schemas mirror the backend contract).
- Every query consumer handles loading (skeleton) / error / empty states.

```
src/
  app/
    page.tsx           landing page
    (auth)/login       admin sign-in (+ TOTP step)
    vote, vote/[id]    voter OTP login, ballot, receipt
    (admin)/admin/*    dashboard, elections, approvals, candidates, voters, audit
    results/[slug]     public, real-time results
  components/ui        flat primitives (button, input, card, badge, modal, …)
  components/admin     responsive admin shell (sidebar + mobile drawer)
  redux/               api-slice + feature endpoints + store/provider
  hooks/               useElectionSocket (live results)
  lib/                 env, cn, api-error
  types/               shared API contract types
```

## Design language

Hairline borders instead of shadows, a single restrained indigo accent, generous
whitespace, accessible focus rings, and `text-balance` headings. Tokens live in
`app/globals.css` (light + dark via oklch).

## Scripts

```bash
npm run dev     # http://localhost:3000
npm run build
npm test        # vitest
npm run lint
```

Set `NEXT_PUBLIC_API_URL` (see `.env.example`) to point at the API.
