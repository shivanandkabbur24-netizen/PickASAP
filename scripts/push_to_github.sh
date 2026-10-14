#!/usr/bin/env bash
# Push changes to GitHub helper script for PickASAP
set -e

REPO_URL="$1"

if [ -z "$REPO_URL" ]; then
  # Check if remote origin already exists
  CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
  if [ -n "$CURRENT_REMOTE" ]; then
    echo "Using existing remote origin: $CURRENT_REMOTE"
    git add -A
    git diff --cached --quiet || git commit -m "update: sync latest changes and fixes"
    git branch -M main
    echo "Pushing to $CURRENT_REMOTE..."
    git push -u origin main
    echo "Successfully pushed to GitHub!"
    exit 0
  fi

  echo "=========================================================="
  echo "PickASAP GitHub Push Helper"
  echo "=========================================================="
  echo "Usage: npm run push:github -- <YOUR_GITHUB_REPO_URL>"
  echo ""
  echo "Example:"
  echo "  npm run push:github -- https://github.com/shivanandkabbur/pickasap.git"
  echo "  OR"
  echo "  git remote add origin https://github.com/shivanandkabbur/pickasap.git"
  echo "  git branch -M main"
  echo "  git push -u origin main"
  echo "=========================================================="
  exit 1
fi

echo "Configuring GitHub remote origin: $REPO_URL"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

git add -A
git diff --cached --quiet || git commit -m "update: sync latest changes and fixes"
git branch -M main

echo "Pushing branch 'main' to $REPO_URL..."
git push -u origin main

echo ""
echo "Successfully pushed PickASAP to GitHub!"
