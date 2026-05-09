#!/bin/sh
# Orchard e2e — host-side UTXO snapshot dump for the @mainchain stack.
#
# Writes e2e/.mainchain/utxos.dat (gitignored) via `bitcoin-cli dumptxoutset`
# against the user's LOCAL mainnet bitcoind. Idempotent; --force regenerates.
# See e2e/README.md §"Mainchain overlay" for host preconditions and env setup
# in e2e/.env (global).
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$(cd "$HERE/../../.." && pwd)/e2e/.mainchain"
SNAPSHOT="$OUT_DIR/utxos.dat"
GLOBAL_E2E_ENV="$(cd "$HERE/../../.." && pwd)/e2e/.env"

FORCE=0
for arg in "$@"; do
    [ "$arg" = "--force" ] && FORCE=1
done

mkdir -p "$OUT_DIR"

# Source optional global e2e env.
# Sourced (not --env-file'd) so `~` and `$HOME` expand in BITCOIN_CLI paths.
if [ -f "$GLOBAL_E2E_ENV" ]; then
    # shellcheck disable=SC1090
    . "$GLOBAL_E2E_ENV"
fi

if [ -f "$SNAPSHOT" ] && [ "$FORCE" = "0" ]; then
    echo "snapshot already present: $SNAPSHOT"
    echo "pass --force to regenerate"
    exit 0
fi

# Explicit BITCOIN_CLI wins over $PATH (shell aliases don't apply here).
BIN="${BITCOIN_CLI:-}"
if [ -z "$BIN" ]; then
    if command -v bitcoin-cli >/dev/null 2>&1; then
        BIN="bitcoin-cli"
    else
        echo "ERROR: bitcoin-cli not on PATH and BITCOIN_CLI not set." >&2
        echo "Export BITCOIN_CLI with a full path, e.g.:" >&2
        echo "  BITCOIN_CLI=/usr/local/bin/bitcoin-cli npm run e2e:bootstrap-mainchain" >&2
        echo "Or set it in e2e/.env — see e2e/README.md" >&2
        exit 1
    fi
fi

# dumptxoutset refuses to overwrite; clear the path first if forcing.
if [ "$FORCE" = "1" ] && [ -f "$SNAPSHOT" ]; then
    rm -f "$SNAPSHOT"
fi

echo "dumping UTXO snapshot to $SNAPSHOT"
echo "(takes 15-45 min on mainnet; host bitcoind is unresponsive while it"
echo " runs, then rebuilds chainstate from the snapshot height back to tip)"

# `rollback` (not `latest`) dumps at an AssumeUTXO-allowlisted height,
# which is the only kind of snapshot `loadtxoutset` will accept.
# -rpcclienttimeout=0 disables the default 900s client timeout — rollback
# can exceed it while rewinding ~36k blocks before the dump starts.
# shellcheck disable=SC2086
"$BIN" -rpcclienttimeout=0 ${BITCOIN_CLI_ARGS:-} dumptxoutset "$SNAPSHOT" rollback

echo ""
echo "snapshot written:"
ls -lh "$SNAPSHOT"
echo ""
echo "next: npm run e2e:up cln-nutshell-postgres"
