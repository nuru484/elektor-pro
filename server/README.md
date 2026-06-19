# Elektor Pro — API

Express 5 + Prisma 7 (PostgreSQL, driver adapters) e-voting API. TypeScript, ESM,
service-layered, with `eslint-plugin-perfectionist` enforcing ordering.

## Architecture

Strict one-way layering: **routes → controllers → services → lib/prisma**.

```
src/
  config/        env (fail-fast), constants, cloudinary, multer
  controllers/   thin HTTP adapters (validate → call service → respond)
  services/
    auth/        staff login, lockout, TOTP 2FA, password reset
    voting/      OTP login, eligibility, secret-ballot casting, accreditation
    results/     tally, visibility rules, certification, CSV/PDF export
    change-request/  maker-checker engine + per-entity appliers
    governance/  staff accounts, agent assignments, capability grants
    domain/      election / portfolio / candidate / voter / group / org
    audit/       hash-chained append + integrity verification
    authorization/ role + grant capability checks
  routes/        feature routers mounted under /api/v1
  middlewares/   auth (JWT cookie), capability guard, validation (Zod), errors
  realtime/      Socket.IO server (live results)
  lib/prisma.ts  single client with soft-delete extension
prisma/          schema, migrations, idempotent seed
test/            Vitest + Supertest (unit + integration)
```

## Key design decisions

- **Secret ballot** — `Ballot`/`BallotEntry` carry no `voterId`. Turnout and
  one-person-one-vote live on `VoterElection` (atomic guarded `updateMany`).
  Ballots are hash-chained per election; the receipt code proves inclusion.
- **Maker-checker** — `proposeOrExecute` stages an admin mutation as a
  `ChangeRequest` (applied only on super-admin approval) or applies a
  super-admin mutation immediately. Per-entity "appliers" run inside a
  transaction with the audit write.
- **Soft delete** — mutable models carry `deletedAt`; a Prisma client extension
  rewrites `delete`→`update` and scopes reads. Only super-admins delete.
- **Hash-chained audit** — every action appends `sha256(prevHash + payload)`;
  `/audit-logs/verify` re-derives the chain to detect tampering.

## Environment

See `.env.example`. Notable: `OTP_MODE=mock` (logs the code, no SMS) vs `live`
(Wigal FROG); `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET`; `CORS_ACCESS`.

## Scripts

```bash
npm run dev          # tsx watch
npm run build        # tsc → build/
npm run migrate      # prisma migrate dev
npm run seed         # idempotent demo seed
npm test             # vitest run
npm run lint         # eslint (perfectionist)
```

## Selected endpoints (all under `/api/v1`)

| Area      | Endpoint                                            |
| --------- | --------------------------------------------------- |
| Auth      | `POST /auth/login`, `/auth/2fa/verify`, `/auth/refresh` |
| Elections | `GET/POST /elections`, `PATCH /elections/:id/status`    |
| Approvals | `GET /change-requests`, `POST /change-requests/:id/approve` |
| Voting    | `POST /voter/otp/request|verify`, `POST /voter/elections/:id/ballot` |
| Results   | `GET /elections/:id/results`, `POST /elections/:id/results/certify` |
| Receipts  | `GET /elections/:id/receipts/:code`                 |
| Audit     | `GET /audit-logs`, `GET /audit-logs/verify`         |
| Health    | `GET /health`, `GET /ready`                         |
