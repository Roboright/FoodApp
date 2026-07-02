#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ -z "$(git status --porcelain)" ]]; then
  echo "Nothing to commit."
  exit 0
fi

git add -A

MSG="${1:-Update}"
git commit -m "$MSG"

git push origin main

echo "Done."
