# Production deploy

`deploy.yml` builds the API on a GitHub runner and ships the compiled output to
an EC2 box after CI passes on `main`. The box compiles nothing.

It triggers on **CI completing successfully**, not on the push itself, so the
suite runs once per merge and a deploy can never outrun it. CI keeps its own push
trigger, so `main` stays covered even if this workflow is disabled.

**Until the secrets below are configured the deploy job skips with a notice
rather than failing**, so merging this workflow changes nothing about your
current process. Setting the secrets is what switches auto-deploy on.

This workflow deploys **`server/` only**. The Next.js client is hosted separately
- see [Deploying the client](#deploying-the-client).

## Why it works this way

`tsc` has to type-check the whole API plus Prisma's generated client, whose types
are heavy. A 1-2 GB instance caps Node's old-space heap well below what that
needs, so `npm run build` on the box dies with `FATAL ERROR: Reached heap limit`.
CI already builds the identical code, so the runner builds and the box unpacks.

Migrations run **from the runner**, not the box: the Prisma CLI is a
`devDependency` (and the box installs production dependencies only), the database
URL lives in one place, and the migration output lands in the workflow log.

## One-time setup

### 1. The box

Ubuntu, `x86_64` (not Graviton - `bcrypt` ships prebuilt native binaries and the
`Preflight` step will stop a mismatched deploy), Node >= 22.12.

```bash
# on EC2
sudo mkdir -p /home/ubuntu/elektor-pro-api
sudo chown ubuntu:ubuntu /home/ubuntu/elektor-pro-api
```

### 2. Runtime environment

The service reads `/etc/elektor-pro.env`. There is no `.env` on the box.

```bash
# on EC2
sudo tee /etc/elektor-pro.env >/dev/null <<'EOF'
NODE_ENV=production
PORT=4040

DATABASE_URL=postgresql://...
DB_POOL_MAX=20

# Generate each with: openssl rand -base64 48
# All three must be at least 32 characters; the API refuses to boot otherwise.
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
# Separate from the token secrets on purpose: sharing them meant rotating
# ACCESS_TOKEN_SECRET silently made every stored TOTP secret undecryptable.
ENCRYPTION_KEY=

# The client's origin. Without it every browser request fails CORS.
CORS_ACCESS=https://vote.example.org
FRONTEND_URL=https://vote.example.org

# NOT optional in practice. Without Redis the background queues are disabled,
# which means elections DO NOT auto-open or auto-close on schedule, expired
# sessions and OTPs are never swept, rate limits reset on every restart, and a
# second instance would silently stop receiving live results.
REDIS_URL=redis://...

OTP_MODE=live
FROG_API_KEY=
FROG_SENDER_ID=
FROG_USERNAME=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SMTP_HOST=
SMTP_PORT=587
GMAIL_USER=
GMAIL_PASSWORD=
SMTP_MAIL=

SENTRY_DSN=

ADMIN_EMAIL=admin@example.org
ADMIN_FIRST_NAME=Super
ADMIN_LAST_NAME=Admin
ADMIN_PHONE=+233200000001
ORGANIZATION_NAME=Your Organization
EOF
sudo chmod 600 /etc/elektor-pro.env
```

The deploy's `Check runtime configuration` step warns about anything missing from
this file, so a forgotten variable shows up in the deploy log rather than on
election day.

### 3. systemd unit

```bash
# on EC2
sudo tee /etc/systemd/system/elektor-pro-api.service >/dev/null <<'EOF'
[Unit]
Description=Elektor Pro API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/elektor-pro-api
EnvironmentFile=/etc/elektor-pro.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
# The app closes HTTP, realtime, workers and the pool in order on SIGTERM,
# with its own 35s hard cap. Give it room to finish rather than killing
# mid-ballot.
KillSignal=SIGTERM
TimeoutStopSec=40

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable elektor-pro-api
```

### 4. First bootstrap

`npm run bootstrap` is the production counterpart of the demo seed. It creates
the organization, the shipped role to capability defaults (only while that table
is empty, so later edits are never overwritten), and one super-admin whose
password is **generated and printed once**.

It is a **one-time manual step**, deliberately not part of the deploy: printing a
super-admin password into a workflow log would put it in GitHub's retention.

Run it from a workstation with the dev dependencies installed, pointed at
production:

```bash
cd server
NODE_ENV=production \
DATABASE_URL="<prod url>" \
ACCESS_TOKEN_SECRET="<same as the box>" \
REFRESH_TOKEN_SECRET="<same as the box>" \
ENCRYPTION_KEY="<same as the box>" \
ADMIN_EMAIL="admin@example.org" \
npm run bootstrap
```

Save the printed password somewhere safe; it must be changed at first sign-in and
is never shown again. Re-running the command leaves an existing super-admin
untouched.

`npm run seed` is development data - demo accounts sharing one password, a demo
election, fabricated ballots - and **refuses to run with `NODE_ENV=production`**.

### 5. Deploy key

On a trusted machine:

```bash
ssh-keygen -t ed25519 -f elektor-deploy -C "github-actions-deploy" -N ""
```

Append the **public** half to the box:

```bash
# on EC2
echo "<contents of elektor-deploy.pub>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 6. Repository secrets

`Settings -> Secrets and variables -> Actions`:

| Secret | Value |
| --- | --- |
| `EC2_HOST` | the instance's public DNS or IP |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | the **private** half of `elektor-deploy`, whole file including header/footer |
| `PROD_DATABASE_URL` | the production database URL, used for `prisma migrate deploy` |

The `deploy` job targets a `production` environment, so you can add required
reviewers under `Settings -> Environments` if you want a manual approval gate
before anything reaches the box. **For an election system this is worth doing**:
it stops an accidental merge from restarting the API mid-vote.

### 7. Passwordless sudo for the service

The workflow restarts the service and reads its journal, so it needs `sudo -n`
for those. On the standard AWS Ubuntu AMI **this already works**: cloud-init
grants the `ubuntu` user `NOPASSWD: ALL`. Check before changing anything:

```bash
# on EC2
sudo -n systemctl is-active elektor-pro-api && echo "sudo already fine, nothing to do"
```

If that prints the status, skip this step. `Preflight` fails the deploy if it is
genuinely missing, before anything is touched.

Only if it is missing:

```bash
# on EC2
sudo tee /etc/sudoers.d/elektor-deploy >/dev/null <<'EOF'
ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart elektor-pro-api, \
                            /usr/bin/systemctl status elektor-pro-api, \
                            /usr/bin/systemctl is-active elektor-pro-api, \
                            /usr/bin/journalctl -u elektor-pro-api *
EOF
sudo chmod 440 /etc/sudoers.d/elektor-deploy
sudo visudo -c   # must report "parsed OK"
```

### 8. Letting the runner reach the box

A GitHub-hosted runner connects from an Azure address that your security group
does not admit by default, so the first deploy attempt fails at `Configure SSH`
with `Connection timed out`.

Whitelisting GitHub's ranges is **not** an option: GitHub publishes over 7000
CIDRs for Actions, against a limit of 60 inbound rules per security group.

**Recommended: let the workflow open the port for one IP, for one run.**

Port 22 stays closed except for the couple of minutes a deploy is running, and
only to that runner's address. The revoke step runs with `if: always()`, so the
hole closes even if the deploy fails partway. Add these secrets on top of the
four above:

| Secret | Value |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | access key of a dedicated IAM user (see policy below) |
| `AWS_SECRET_ACCESS_KEY` | its secret |
| `AWS_REGION` | the instance's region, e.g. `eu-west-1` |
| `EC2_SECURITY_GROUP_ID` | the instance's security group, e.g. `sg-0abc123…` |

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupIngress"
    ],
    "Resource": "arn:aws:ec2:<region>:<account-id>:security-group/<sg-id>"
  }]
}
```

That IAM user cannot start, stop, or read instances, and cannot touch any other
security group. If these secrets are absent the workflow skips the open/close
steps and assumes port 22 is already reachable, so this is opt-in.

To read the values off the box:

```bash
TOKEN=$(curl -s -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 120")
md() { curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/$1; }
md placement/region; md instance-id
MAC=$(md network/interfaces/macs/ | head -1 | tr -d /)
md network/interfaces/macs/$MAC/security-group-ids
md network/interfaces/macs/$MAC/owner-id
```

**Simpler, weaker: allow inbound 22 from anywhere.** One rule (`0.0.0.0/0` on
port 22) and deploys work immediately. Authentication is key-only, so this is not
catastrophic, but it leaves SSH on a system holding an electoral register
permanently exposed to internet-wide scanning.

## What a deploy does

1. Runs `ci.yml` in full: lint, type-check, build and the whole suite, for both
   `server/` and `client/`. A failure here means nothing is deployed.
2. Builds and packages `dist/ prisma/ package.json package-lock.json`.
3. Preflight: architecture, Node version, sudo access.
4. `prisma migrate deploy` against production.
5. Uploads and unpacks the release, keeping the previous `dist/` as `dist.prev`.
6. `npm ci --omit=dev --ignore-scripts`, then restarts the service.
7. Polls `/health/ready` for up to 60s. On success `dist.prev` is deleted; on
   failure it is **restored and the service restarted**, and the job fails with
   the last 40 journal lines.
8. Warns about any missing runtime configuration.

Migrations run before the restart on purpose: every migration in this project is
additive, so the still-running old code tolerates the new schema. A migration
that is *not* backward compatible (dropping or renaming a column the running code
still reads) must be split across two deploys instead.

## Deploying during an election

Don't, if you can avoid it. A restart drops in-flight requests and every open
websocket, and voters mid-ballot see an error.

If you must:

- Use the `production` environment approval gate so it cannot happen by accident.
- The service's `TimeoutStopSec=40` lets the app drain in-flight ballots rather
  than being killed mid-transaction, so a restart does not lose a vote that was
  already committing.
- Prefer a window when no election is `IN_PROGRESS`. `GET /api/v1/elections?status=IN_PROGRESS`
  answers that in one call.

## Rollback

The health check reverts a broken build automatically. To roll back a deploy that
came up healthy but is behaving badly, re-run the `Deploy API` workflow from the
last good commit (`Actions -> Deploy API -> Run workflow`).

**Migrations are not rolled back.** That is deliberate: reversing a migration
automatically is more dangerous than leaving an additive column in place. If a
migration itself is the problem, write a forward migration that corrects it.

## The box holds a release, not the repository

Everything the service needs at runtime is inside `dist/`: `tsc` emits the
compiled sources and the generated Prisma client there together, and every import
is a relative `.js` specifier that resolves after compilation.

So the box needs exactly four things: `dist/`, `node_modules/`, `package.json`
(for `npm run start`) and `package-lock.json` (for `npm ci`). `prisma/` ships as
well, purely so the migration history is present for reference. It does **not**
need a git checkout.

## Manual deploy

Preferred: **Actions -> Deploy API -> Run workflow**, choosing the commit.

If GitHub is unavailable:

```bash
# on your workstation
cd server
npm ci && npm run build
tar -czf release.tar.gz dist prisma package.json package-lock.json
scp release.tar.gz ubuntu@<host>:/tmp/

# on EC2
cd ~/elektor-pro-api
rm -rf dist.prev && cp -r dist dist.prev
tar -xzf /tmp/release.tar.gz -C ~/elektor-pro-api
unset NODE_ENV                     # else npm skips devDependencies
npm ci --omit=dev --ignore-scripts
sudo systemctl restart elektor-pro-api
curl -fsS http://127.0.0.1:4040/health/ready || { rm -rf dist && mv dist.prev dist; sudo systemctl restart elektor-pro-api; }
```

Migrations by hand, from a machine with dev dependencies:

```bash
cd server && DATABASE_URL="<prod url>" npx prisma migrate deploy
```

## Deploying the client

The Next.js client is **not** shipped by this workflow. Two options:

**Vercel (recommended).** Point a project at this repository with root directory
`client`, set `NEXT_PUBLIC_API_URL` to the API's public URL, and it deploys on
every push with preview URLs per pull request. Nothing to run or patch.

**Same EC2 box.** `npm run build && npm run start` behind the same nginx that
fronts the API. Cheaper and keeps everything on one host, but you own the
process supervision, the TLS, and the Node upgrades.

Either way `NEXT_PUBLIC_API_URL` is baked in **at build time** and also lands in
the CSP's `connect-src`, so changing the API's hostname requires a rebuild, not
just an environment change.
