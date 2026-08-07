#!/bin/bash
# check_repo_status.sh
# Copied from screenbot-desktop 2026-08-07 as part of bootstrapping this repo
# onto the dev-session-protocol skill. Same script, same REPOS list — checks
# every active SCREENBot repo, not just this one, regardless of which repo
# it's run from.
#
# Exits non-zero and prints a loud failure if any repo is dirty or has
# untracked files. Ahead/behind origin (clean tree, unpushed commits) is
# still flagged but is an expected outcome given this environment's
# inconsistent push access to GitHub, not equivalent to a dirty tree.

set -e

REPOS=(
  "/Users/supercreativepeople/Projects/screenbot-desktop"
  "/Users/supercreativepeople/Projects/screenbot-backend"
  "/Users/supercreativepeople/Projects/screenbot-mvp"
  "/Users/supercreativepeople/Projects/screenbot-licensing"
)

FAIL=0

for REPO in "${REPOS[@]}"; do
  if [ ! -d "$REPO/.git" ]; then
    echo "SKIP: $REPO is not a git repo"
    continue
  fi
  echo "=== $REPO ==="
  cd "$REPO"
  git fetch origin --quiet 2>/dev/null || echo "  WARN: could not fetch origin"
  STATUS=$(git status --short --branch)
  echo "$STATUS"

  if echo "$STATUS" | grep -qE '^\s?[MADRCU?]'; then
    echo "  FAIL: uncommitted or untracked changes present"
    FAIL=1
  fi
  if echo "$STATUS" | head -1 | grep -qE '\[(ahead|behind)'; then
    echo "  FAIL: local branch is ahead/behind origin"
    FAIL=1
  fi
  if ! git status --short --branch | head -1 | grep -q '\.\.\.origin/'; then
    echo "  WARN: no upstream tracking branch configured, cannot verify sync"
  fi
  echo ""
done

if [ "$FAIL" -eq 1 ]; then
  echo "REPO STATUS CHECK: FAILED. Do not declare this session closed."
  echo "Commit, push, and re-run before writing 'pushed' anywhere."
  exit 1
else
  echo "REPO STATUS CHECK: PASSED. All repos clean and in sync."
  exit 0
fi
