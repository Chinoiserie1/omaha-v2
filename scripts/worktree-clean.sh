#!/bin/bash
# Usage: ./scripts/worktree-clean.sh <worktree-path>
# Example: ./scripts/worktree-clean.sh ../feat-liquidglass-ui
# Removes the worktree, prunes stale entries, and deletes the local branch.

WORKTREE_PATH=$1

if [ -z "$WORKTREE_PATH" ]; then
  echo "Usage: $0 <worktree-path>"
  exit 1
fi

# Get the branch name from the worktree before removing
BRANCH=$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref HEAD 2>/dev/null)

if [ -z "$BRANCH" ]; then
  echo "Error: Could not determine branch for worktree at $WORKTREE_PATH"
  exit 1
fi

echo "Removing worktree: $WORKTREE_PATH (branch: $BRANCH)"

git worktree remove "$WORKTREE_PATH" --force
git worktree prune
git branch -D "$BRANCH"

echo "Done. Worktree removed and branch '$BRANCH' deleted."
