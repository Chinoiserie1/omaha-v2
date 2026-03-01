#!/bin/bash
# Usage: ./scripts/worktree-create.sh <branch-name> <worktree-path>
# Example: ./scripts/worktree-create.sh feat/liquidglass-ui ../feat-liquidglass-ui
# Creates a new git worktree with a new branch based on HEAD.

BRANCH=$1
WORKTREE_PATH=$2

if [ -z "$BRANCH" ] || [ -z "$WORKTREE_PATH" ]; then
  echo "Usage: $0 <branch-name> <worktree-path>"
  echo "Example: $0 feat/liquidglass-ui ../feat-liquidglass-ui"
  exit 1
fi

git worktree add -b "$BRANCH" "$WORKTREE_PATH"
echo ""
echo "Worktree created:"
echo "  Branch: $BRANCH"
echo "  Path:   $WORKTREE_PATH"
echo ""
echo "Next: cd $WORKTREE_PATH && pnpm install"
