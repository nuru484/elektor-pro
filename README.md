# Elektor Pro

A secure, customizable **e-voting platform** for any organization: student
bodies, unions, companies, associations. Secret ballots, real-time results, a
maker-checker governance model, and a tamper-evident audit trail, end to end.

This branch (`backend-separation`) splits the original Next.js app into a
standalone **Express + Prisma API** (`server/`) and a **Next.js client**
(`client/`).

## Highlights

- **Secret ballot + verifiable receipts** - ballots are anonymous and
  hash-chained, and nothing on a voter's record points at their ballot, so not
  even database access reveals how anyone voted. The receipt code is shown to
  the voter once, at cast time; they alone hold it, and can verify with it on
  the public receipt page.
- **Maker-checker governance** - admins propose changes; a different approver
  signs them off (nobody can approve their own). Every action, super-admin
  included, is written to a hash-chained audit log whose verifier recomputes
  each entry's hash, so editing what an entry says breaks the chain.
- **5 roles** - super-admin, admin (electoral commission), agent (results-room
  observer), candidate, voter, with role defaults plus per-user, per-election
  capability grants.
- **Flexible elections** - single-choice, multi-select, or yes/no referenda;
  optional constituency scoping (faculty / hall / branch …) or "everyone votes
  everything". Per-election results policy (live / on-close / manual) and
  branding.
- **Layered auth** - staff use email + password + TOTP 2FA with account lockout;
  voters log in with an SMS one-time code.
- **Real-time results** - live tallies stream over Socket.IO; certify final
  results into an immutable snapshot and export CSV/PDF.

## Repository layout

```
server/   Express 5 + Prisma 7 (PostgreSQL) API - see server/README.md
client/   Next.js 16 + RTK Query frontend     - see client/README.md
```

## Quick start

Prerequisites: Node 22+, PostgreSQL running locally.

```bash
# 1. API
cd server
cp .env.example .env            # adjust DATABASE_URL etc.
npm install
npx prisma migrate deploy
npm run seed                    # demo org, accounts, and a live election
npm run dev                     # http://localhost:4040 (PORT in .env)

# 2. Client (in another terminal)
cd client
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

### Demo accounts (from the seed)

`npm run seed` is **development data only**: demo accounts sharing one
password, a demo election, and fabricated ballots. It refuses to run with
`NODE_ENV=production`. The shared password is printed when the seed finishes
and can be overridden with `SEED_PASSWORD`.

| Role        | Login                                                        |
| ----------- | ------------------------------------------------------------ |
| Super admin | `admin@elektorpro.com`                                       |
| Admin       | `commission@elektorpro.com`                                  |
| Agent       | `agent@elektorpro.com`                                       |
| Voter       | voter ID `STU1001` (OTP printed to the API log in mock mode) |

## Deploying

```bash
cd server
npm run deploy   # npm ci && build && prisma migrate deploy && bootstrap
npm start        # runs the COMPILED server (dist/), not tsx
```

`npm run bootstrap` is the production counterpart of the seed: it creates the
organization, the shipped role→capability defaults (only while that table is
empty, so a super-admin's later edits are never overwritten), and one
super-admin from `ADMIN_*`. That account's password is **generated, printed
once, and must be changed at first sign-in** - nothing is read from
`ADMIN_PASSWORD`. Re-running it leaves an existing super-admin untouched.

Production requires `ENCRYPTION_KEY`, and both token secrets must be at least
32 characters; the server refuses to boot otherwise. Set `REDIS_URL` before
running more than one instance: it is what makes rate limits, background
jobs, and live results correct across processes.

## Testing

```bash
cd server && npm test      # Vitest + Supertest (needs a local Postgres)
cd client && npm test      # Vitest + Testing Library
```
