#!/usr/bin/env bash
# Deploy script intended to live on the VPS at /opt/smpn3/deploy.sh
# Triggered by GitHub Actions via SSH. Atomic: if any step fails, PM2 keeps running the old build.
#
# DESTRUCTIVE NOTE: `git reset --hard origin/main` discards any local file changes
# on the VPS. The VPS is deploy-only; never edit files there directly. If you do,
# they will be lost on the next deploy.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/smpn3/app}"
PM2_NAME="${PM2_NAME:-smpn3}"

cd "$REPO_DIR"

echo "==> Pull latest"
git fetch --all --quiet
git reset --hard origin/main

echo "==> Install deps"
npm ci --no-audit --no-fund

echo "==> Generate Prisma client"
npx prisma generate

echo "==> Run migrations"
npx prisma migrate deploy

# NOTE: content seeding is intentionally NOT run on routine deploys. Admin CRUD is
# live, so production holds real school-entered data (teachers, photos, etc.). Running
# the seed here would at best be a no-op (entity seeds are now create-only) and at
# worst risk clobbering data. The seed is a ONE-TIME setup for a fresh DB — run it
# manually on first provisioning only:
#     npm run db:seed          # creates the first admin user
#     npm run db:seed:content  # populates demo/initial content into an empty DB

echo "==> Build"
npm run build

echo "==> Reload PM2"
pm2 reload "$PM2_NAME" --update-env
pm2 save  # persist process list across VPS reboots

echo "==> Done"
