#!/bin/sh
# Orchard e2e perpetual block miner.
#
# Mines a single block at a fixed cadence against the existing regtest
# `bitcoind` service in this stack. Coinbase rewards land in the `default`
# wallet that fund-{lnd,cln}-topology.sh creates during setup, so no extra
# wallet plumbing is needed here.
#
# Runs as a long-lived sidecar on every config that ships a regtest
# bitcoind. Started/stopped automatically by `compose.sh up|down`.
#
# Tunables (env):
#   MINE_INTERVAL_SECONDS   default 30
#   BTC_RPC_USER / BTC_RPC_PASS  required (mirrors setup scripts)

set -eu

INTERVAL="${MINE_INTERVAL_SECONDS:-30}"

log() { printf '[block-miner] %s\n' "$*"; }

bcli() {
    bitcoin-cli -regtest \
        -rpcconnect=bitcoind -rpcport=18443 \
        -rpcuser="$BTC_RPC_USER" -rpcpassword="$BTC_RPC_PASS" \
        -rpcwallet=default \
        "$@"
}

# Setup script creates the `default` wallet and mines 101 blocks before this
# service is allowed to start, so getnewaddress should succeed on first try.
ADDR=""
tries=30
while [ "$tries" -gt 0 ]; do
    if ADDR=$(bcli getnewaddress 2>/dev/null) && [ -n "$ADDR" ]; then
        break
    fi
    tries=$((tries - 1))
    sleep 1
done

if [ -z "$ADDR" ]; then
    log "could not obtain mining address from bitcoind default wallet"
    exit 1
fi

log "mining 1 block every ${INTERVAL}s to ${ADDR}"

while true; do
    if bcli generatetoaddress 1 "$ADDR" >/dev/null 2>&1; then
        log "mined block, height=$(bcli getblockcount 2>/dev/null || echo '?')"
    else
        log "mine failed (bitcoind unreachable?); will retry"
    fi
    sleep "$INTERVAL"
done
