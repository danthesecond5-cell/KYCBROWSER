#!/usr/bin/env bash
set -euo pipefail

# Branches to fix (prefer PR side on conflicts)
BRANCHES=(
  "cursor/application-stability-f4d4"               # PR 23
  "cursor/aowlevel-script-expo-compatibility-9e8e"  # PR 32
  "cursor/video-overlay-protocols-0040"             # PR 35
)

# PRs to retarget to main
PRS_RETARGET=(31 32 35)

# PR merge order
PRS_MERGE=(31 23 32 35)

# --- Checks ---
command -v gh >/dev/null 2>&1 || { echo "gh CLI not found. Install gh in Codespaces first."; exit 1; }
git status >/dev/null 2>&1 || { echo "Not inside a git repo."; exit 1; }

echo "Fetching origin..."
git fetch origin

# --- Resolve conflicts by keeping PR side ---
for BR in "${BRANCHES[@]}"; do
  echo "Processing branch: $BR"
  git checkout "$BR"
  git merge origin/main -X ours || { echo "Merge failed on $BR"; exit 1; }
  if git status --porcelain | grep -q .; then
    git commit -am "Resolve conflicts favoring PR branch for $BR"
  else
    echo "No changes to commit on $BR"
  fi
  git push origin HEAD
done

# --- Retarget PRs to main ---
for PR in "${PRS_RETARGET[@]}"; do
  echo "Retargeting PR #$PR to main"
  gh pr edit "$PR" --base main
done

# --- Merge PRs in order ---
for PR in "${PRS_MERGE[@]}"; do
  echo "Merging PR #$PR"
  gh pr merge "$PR" --merge --delete-branch=false
done

echo "Done. Consider cleaning merged branches after verifying."