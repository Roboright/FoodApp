#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Running DB migrations..."
npx prisma migrate deploy
npx prisma generate

echo "Building..."
npm run build

echo "Copying static assets..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "Restarting service..."
sudo systemctl restart foodapp

echo "Done. FoodApp is live."
