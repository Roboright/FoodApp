#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Building..."
npm run build

echo "Copying static assets..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "Restarting service..."
sudo systemctl restart foodapp

echo "Done."
