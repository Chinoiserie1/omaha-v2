#!/bin/bash
# Usage: ./scripts/worktree-dev.sh [ios|android]
# Starts Expo with a deterministic Metro port based on the worktree name,
# preventing port conflicts when running multiple worktrees simultaneously.

# Detect worktree name
if [ -f .git ]; then
  WORKTREE_NAME=$(basename "$(pwd)")
else
  WORKTREE_NAME="main"
fi

# Hash worktree name to port 8081-8199
PORT_OFFSET=$(echo -n "$WORKTREE_NAME" | cksum | awk '{print $1 % 119}')
METRO_PORT=$((8081 + PORT_OFFSET))

PLATFORM=${1:-ios}
shift 2>/dev/null

echo "Worktree: $WORKTREE_NAME | Port: $METRO_PORT | Platform: $PLATFORM"
npx expo start --port "$METRO_PORT" "--$PLATFORM" "$@"
