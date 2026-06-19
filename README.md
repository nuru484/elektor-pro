# Elektor Pro

A secure, customizable **e-voting platform** for any organization — student
bodies, unions, companies, associations. Secret ballots, real-time results, a
maker-checker governance model, and a tamper-evident audit trail, end to end.

This branch (`backend-separation`) splits the original Next.js app into a
standalone **Express + Prisma API** (`server/`) and a **Next.js client**
(`client/`).

## Highlights

- **Secret ballot + verifiable receipts** — ballots are anonymous and
  hash-chained; voters get a receipt code to confirm their vote counted without
  revealing their choice.
- **Maker-checker governance** — admins propose changes; a super-admin approves
  before anything applies. Every action (super-admin included) is written to a
  hash-chained, tamper-evident audit log.
- **5 roles** — super-admin, admin (electoral commission), agent (results-room
  observer), candidate, voter — with role defaults plus per-user, per-election
  capability grants.
- **Flexible elections** — single-choice, multi-select, or yes/no referenda;
  optional constituency scoping (faculty / hall / branch …) or "everyone votes
  everything". Per-election results policy (live / on-close / manual) and
  branding.
- **Layered auth** — staff use email + password + TOTP 2FA with account lockout;
  voters log in with an SMS one-time code.
- **Real-time results** — live tallies stream over Socket.IO; certify final
  results into an immutable snapshot and export CSV/PDF.

## Repository layout

```
server/   Express 5 + Prisma 7 (PostgreSQL) API — see server/README.md
client/   Next.js 16 + RTK Query frontend     — see client/README.md
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
npm run dev                     # http://localhost:4000

# 2. Client (in another terminal)
cd client
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

### Demo accounts (from the seed)

| Role        | Login                                            |
| ----------- | ------------------------------------------------ |
| Super admin | `admin@elektorpro.com` / `Admin123!`             |
| Admin       | `commission@elektorpro.com` / `Password123!`     |
| Agent       | `agent@elektorpro.com` / `Password123!`          |
| Voter       | voter ID `STU1001` (OTP printed to the API log in mock mode) |

## Testing

```bash
cd server && npm test      # Vitest + Supertest (needs a local Postgres)
cd client && npm test      # Vitest + Testing Library
```
