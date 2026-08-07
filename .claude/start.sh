#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 > /dev/null 2>&1

# Point the Angular dev-server at a running e2e docker stack.
# Source the stack's own env file so the runtime-config generator produces
# a client config that matches that stack (bitcoin/lightning/tapass/mint flags).
# Override with ORCHARD_STACK to target a different stack.
#
# IMPORTANT — single-stack-at-a-time: every preview writes the same
# `public/config.json` (set by `npm run start:client` → generate-runtime-config.mjs).
# Two previews running simultaneously race that file and the loser silently
# serves the other stack's config. We refuse to start a second preview while
# another is live; the operator must stop the active one first.
REPO_ROOT="$(git rev-parse --show-superproject-working-tree 2>/dev/null)"
[ -z "$REPO_ROOT" ] && REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$REPO_ROOT" ] && REPO_ROOT="/Users/admin/Sites/orchard"
STACK="${ORCHARD_STACK:-lnd-nutshell-sqlite}"
case "$STACK" in
  lnd-nutshell-sqlite)   STACK_PORT=3322 ;;
  cln-cdk-postgres)      STACK_PORT=3323 ;;
  lnd-cdk-sqlite)        STACK_PORT=3324 ;;
  cln-nutshell-postgres) STACK_PORT=3325 ;;
  fake-cdk-postgres)     STACK_PORT=3326 ;;
  *) echo "start.sh: unknown ORCHARD_STACK=$STACK" >&2; exit 2 ;;
esac

# Refuse to clobber the file when another preview's `ng serve` is live.
# `pgrep` matches against the full command line — every preview shows up as
# `ng serve --proxy-config proxy.conf.cjs --port <P>`. Skip this guard for
# non-client tasks (server runs and one-off scripts).
case " $* " in
  *" start:client "*)
    if pgrep -f 'ng serve --proxy-config' >/dev/null 2>&1; then
      echo "start.sh: another Angular dev-server is already running — only one preview can be live at a time" >&2
      echo "         (they share public/config.json; the loser would serve the other stack's flags)" >&2
      echo "         stop the running preview first (mcp preview_stop or kill the ng process)." >&2
      exit 3
    fi
    ;;
esac

# Pre-define the flag vars the runtime-config generator reads, so that
# generate-runtime-config.mjs's dotenv(override:false) treats them as already
# set and doesn't leak values from the repo-root .env into the dev-server
# build. Stack env (sourced next) will overwrite the ones it actually uses.
export BITCOIN_TYPE="" LIGHTNING_TYPE="" TAPROOT_ASSETS_TYPE="" MINT_TYPE="" MINT_DATABASE=""

ENV_FILE="$REPO_ROOT/e2e/docker/configs/$STACK/env"
if [ ! -f "$ENV_FILE" ]; then
  echo "start.sh: stack env file not found at $ENV_FILE" >&2
  exit 4
fi

set -a
source "$ENV_FILE"
set +a

export SERVER_PORT="$STACK_PORT"
echo "start.sh: stack=$STACK port=$STACK_PORT bitcoin=${BITCOIN_TYPE:-off} lightning=${LIGHTNING_TYPE:-off} mint=${MINT_TYPE:-off} tapd=${TAPROOT_ASSETS_TYPE:-off}"
exec npm "$@"
