#!/bin/bash
# Claude Code hook -> MyTrack activity ping.
# Reads the hook JSON on stdin, derives the project key from the git repository of the working
# directory (worktrees resolve to their main repo), and POSTs a ping. Never blocks or fails Claude.
#
# Config: ~/.config/mytrack/activity.json  {"url": "https://...", "token": "..."}
# Key override: a .mytrack-key file (one line) in the folder or any parent, or MYTRACK_KEY in the env.
# Skip a folder: put "ignore" in .mytrack-key.

CONFIG="${MYTRACK_ACTIVITY_CONFIG:-$HOME/.config/mytrack/activity.json}"
[ -f "$CONFIG" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

INPUT="$(cat)"
CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // empty')"
EVENT_NAME="$(printf '%s' "$INPUT" | jq -r '.hook_event_name // empty')"
[ -n "$CWD" ] && [ -d "$CWD" ] || exit 0

# Not real work folders: home itself, temp dirs.
case "$CWD" in
  "$HOME"|/tmp|/tmp/*|/private/tmp|/private/tmp/*|/var/folders/*) exit 0 ;;
esac

ROOT=""
COMMON="$(git -C "$CWD" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
if [ -n "$COMMON" ]; then
  ROOT="$(dirname "$COMMON")"   # <repo>/.git -> <repo>, also from inside a worktree
else
  ROOT="$CWD"
fi

KEY="${MYTRACK_KEY:-}"
if [ -z "$KEY" ]; then
  # Nearest .mytrack-key walking up from the working directory (lets several repos share one key).
  DIR="$CWD"
  while [ "$DIR" != "/" ] && [ "$DIR" != "$HOME" ]; do
    if [ -f "$DIR/.mytrack-key" ]; then
      KEY="$(head -n1 "$DIR/.mytrack-key" | tr -d '[:space:]')"
      break
    fi
    DIR="$(dirname "$DIR")"
  done
fi
[ "$KEY" = "ignore" ] && exit 0
[ -n "$KEY" ] || KEY="$(basename "$ROOT")"

EVENT="ping"
[ "$EVENT_NAME" = "SessionEnd" ] && EVENT="end"

URL="$(jq -r '.url // empty' "$CONFIG")"
TOKEN="$(jq -r '.token // empty' "$CONFIG")"
[ -n "$URL" ] && [ -n "$TOKEN" ] || exit 0

BODY="$(jq -n --arg key "$KEY" --arg event "$EVENT" '{key:$key, origin:"claude-code", event:$event}')"

# Detached so Claude never waits on the network.
( curl -s -m 5 -o /dev/null -X POST "${URL%/}/api/activity/ping" \
    -H "Content-Type: application/json" \
    -H "X-Widget-Token: $TOKEN" \
    -d "$BODY" >/dev/null 2>&1 & )
exit 0
