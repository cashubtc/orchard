#!/bin/sh
# Orchard e2e — container-side UTXO snapshot load for the @mainchain stack.
# Idempotent: re-runs on an already-loaded volume are treated as success.
set -eu

SNAPSHOT=/snapshot/utxos.dat

if [ ! -f "$SNAPSHOT" ]; then
    echo "ERROR: $SNAPSHOT missing." >&2
    echo "Run 'npm run e2e:bootstrap-mainchain' on the host first." >&2
    exit 1
fi

CLI="bitcoin-cli -rpcconnect=bitcoind-mainchain -rpcport=8332 \
     -rpcuser=${MAINCHAIN_RPC_USER} -rpcpassword=${MAINCHAIN_RPC_PASS}"

log() { printf '[setup-mainchain] %s\n' "$*"; }

# Retry until headers sync from the host peer catches up to the snapshot
# block (30-60s over LAN). Other errors bubble on the final attempt.
ATTEMPTS=120
for i in $(seq 1 $ATTEMPTS); do
    if OUT=$($CLI loadtxoutset "$SNAPSHOT" 2>&1); then
        log "loadtxoutset complete"
        echo "$OUT"
        break
    fi

    # Already-loaded chainstates: don't keep retrying. Bitcoin Core phrases
    # this as "Can't activate a snapshot-based chainstate more than once" when
    # the volume already has the snapshot loaded (e.g. a re-`up` after the
    # node container survived but the one-shot setup was recreated).
    if echo "$OUT" | grep -qiE 'already (loaded|active|have)|more than once'; then
        log "snapshot already loaded — skipping"
        break
    fi

    # Base hash not in the AssumeUTXO allowlist — permanent; bail fast.
    if echo "$OUT" | grep -qiE 'not recognized|snapshot heights are available'; then
        echo "ERROR: snapshot base hash is not in Bitcoin Core's AssumeUTXO allowlist." >&2
        echo "The host-side dump must use 'rollback' mode (not 'latest') to land on" >&2
        echo "an eligible height. Regenerate:" >&2
        echo "  npm run e2e:bootstrap-mainchain -- --force" >&2
        echo "Full daemon error:" >&2
        echo "$OUT" >&2
        exit 1
    fi

    log "attempt $i/$ATTEMPTS waiting (headers likely not synced yet):"
    echo "$OUT"

    if [ "$i" = "$ATTEMPTS" ]; then
        echo "ERROR: loadtxoutset did not succeed after $ATTEMPTS attempts" >&2
        exit 1
    fi

    sleep 5
done

log "chain summary:"
$CLI getblockchaininfo | head -20
