#!/bin/sh
# Orchard e2e — cln topology setup. Mines blocks, funds nodes, opens channels.
#
# Topology: cln-alice ⇄ cln-orchard ⇄ lnd-carol (cross-implementation)
#
# Driver strategy:
#   - CLN nodes: `docker exec <container> lightning-cli ...` via mounted socket
#   - lnd-carol: REST API
#   - bitcoind: JSON-RPC over HTTP
#
# CONFIG_NAME env var resolves sibling container names (${CONFIG_NAME}-cln-<node>).

set -eu
: "${CONFIG_NAME:?CONFIG_NAME must be set by compose (e.g. cln-cdk-sqlite)}"

log() { printf '[setup] %s\n' "$*"; }

bcli() {
    local method="$1"
    local params="${2:-[]}"
    curl -sS --fail \
        -u "${BTC_RPC_USER}:${BTC_RPC_PASS}" \
        -H 'content-type: application/json' \
        -d "{\"jsonrpc\":\"1.0\",\"method\":\"${method}\",\"params\":${params}}" \
        http://bitcoind:18443/ | jq -r '.result'
}

# CLN via docker exec — "$1" is the short node name (orchard|alice).
cln() {
    local node="$1"; shift
    docker exec "${CONFIG_NAME}-cln-${node}" \
        lightning-cli --lightning-dir=/home/clightning/.lightning --network=regtest "$@"
}

# LND REST for lnd-carol (only LND node in pair2).
lnd_carol() {
    local method="$1" path="$2" body="${3:-}"
    local macaroon_hex
    macaroon_hex=$(xxd -p -c 10000 /lnd/carol/data/chain/bitcoin/regtest/admin.macaroon)
    if [ -n "$body" ]; then
        curl -sS --fail -X "$method" \
            --cacert /lnd/carol/tls.cert \
            -H "Grpc-Metadata-macaroon: ${macaroon_hex}" \
            -H 'content-type: application/json' \
            -d "$body" \
            "https://lnd-carol:8080${path}"
    else
        curl -sS --fail -X "$method" \
            --cacert /lnd/carol/tls.cert \
            -H "Grpc-Metadata-macaroon: ${macaroon_hex}" \
            "https://lnd-carol:8080${path}"
    fi
}

wait_for() {
    local desc="$1"; shift
    local retries=60
    local last_err=""
    while true; do
        if last_err=$("$@" 2>&1); then
            log "ready: $desc"
            return 0
        fi
        retries=$((retries - 1))
        if [ "$retries" -le 0 ]; then
            log "timeout waiting for $desc"
            log "last output: ${last_err}"
            exit 1
        fi
        sleep 1
    done
}

check_cln_info() {
    cln "$1" getinfo > /dev/null
}

check_cln_balance() {
    local node="$1" minimum="$2"
    local bal
    bal=$(cln "$node" listfunds 2>/dev/null | jq -r '[.outputs[] | select(.status=="confirmed") | .amount_msat] | add // 0')
    # amount_msat is msat; convert to sat for comparison
    bal=$((bal / 1000))
    [ "$bal" -ge "$minimum" ]
}

check_cln_channel_active() {
    local node="$1"
    local count
    count=$(cln "$node" listpeerchannels 2>/dev/null \
        | jq -r '[.channels[] | select(.state=="CHANNELD_NORMAL")] | length')
    [ -n "$count" ] && [ "$count" -ge 1 ]
}

check_lnd_carol_info() {
    lnd_carol GET /v1/getinfo > /dev/null
}

check_lnd_carol_balance() {
    local minimum="$1"
    local bal
    bal=$(lnd_carol GET /v1/balance/blockchain 2>/dev/null | jq -r '.confirmed_balance')
    [ -n "$bal" ] && [ "$bal" -ge "$minimum" ]
}

check_lnd_carol_channel_active() {
    local count
    count=$(lnd_carol GET '/v1/channels?active_only=true' 2>/dev/null | jq -r '.channels | length')
    [ -n "$count" ] && [ "$count" -ge 1 ]
}

# Carol's p2p listener only binds at SERVER_ACTIVE; getinfo passes at RPC_ACTIVE already.
check_lnd_carol_server_active() {
    local state
    state=$(lnd_carol GET /v1/state 2>/dev/null | jq -r '.state')
    [ "$state" = "SERVER_ACTIVE" ]
}

log "creating bitcoind wallet"
bcli listwallets 2>/dev/null | jq -e '.[] | select(. == "default")' >/dev/null 2>&1 \
    || bcli createwallet '["default"]' >/dev/null

MINER_ADDR=$(bcli getnewaddress)
log "mining 101 blocks to ${MINER_ADDR}"
bcli generatetoaddress "[101, \"${MINER_ADDR}\"]" >/dev/null
log "chain height: $(bcli getblockcount)"

# Fund CLN nodes. Use the Taproot (p2tr) address because CLN 25.12 defaults
# BIP86/Taproot for its signing key; funding a P2WPKH address causes a
# signing-path mismatch at broadcast time (pubkey hash != witness script hash).
for node in orchard alice; do
    wait_for "cln-${node} info" check_cln_info "$node"
    addr=$(cln "$node" newaddr p2tr | jq -r '.p2tr')
    log "funding cln-${node} at ${addr}"
    bcli sendtoaddress "[\"${addr}\", 10]" >/dev/null
done

# Fund lnd-carol
wait_for "lnd-carol info" check_lnd_carol_info
carol_addr=$(lnd_carol GET /v1/newaddress | jq -r '.address')
log "funding lnd-carol at ${carol_addr}"
bcli sendtoaddress "[\"${carol_addr}\", 10]" >/dev/null

log "mining 6 confirmations"
bcli generatetoaddress "[6, \"${MINER_ADDR}\"]" >/dev/null

# 10 BTC = 1_000_000_000 sat; require ≥ 900M to allow fee buffer.
wait_for "cln-orchard confirmed balance ≥ 9 BTC" check_cln_balance orchard 900000000
wait_for "cln-alice confirmed balance ≥ 9 BTC"   check_cln_balance alice   900000000
wait_for "lnd-carol confirmed balance ≥ 9 BTC"   check_lnd_carol_balance  900000000

ORCHARD_ID=$(cln orchard getinfo | jq -r '.id')
CAROL_ID=$(lnd_carol GET /v1/getinfo | jq -r '.identity_pubkey')
log "orchard id: ${ORCHARD_ID}"
log "carol id:   ${CAROL_ID}"

wait_for "lnd-carol server active" check_lnd_carol_server_active

log "peering alice → orchard"
cln alice connect "${ORCHARD_ID}@cln-orchard:9735" > /dev/null

log "peering orchard → carol"
cln orchard connect "${CAROL_ID}@lnd-carol:9735" > /dev/null

log "opening channel alice → orchard (${CHANNEL_CAPACITY_SAT} sat, push ${CHANNEL_PUSH_MSAT} msat)"
cln alice fundchannel \
    "id=${ORCHARD_ID}" \
    "amount=${CHANNEL_CAPACITY_SAT}" \
    "push_msat=${CHANNEL_PUSH_MSAT}" \
    > /dev/null

log "opening channel orchard → carol (${CHANNEL_CAPACITY_SAT} sat, push ${CHANNEL_PUSH_MSAT} msat)"
cln orchard fundchannel \
    "id=${CAROL_ID}" \
    "amount=${CHANNEL_CAPACITY_SAT}" \
    "push_msat=${CHANNEL_PUSH_MSAT}" \
    > /dev/null

log "mining 6 confirmations for channel funding txns"
bcli generatetoaddress "[6, \"${MINER_ADDR}\"]" >/dev/null

wait_for "cln-alice channel active"   check_cln_channel_active alice
wait_for "cln-orchard channel active" check_cln_channel_active orchard
wait_for "lnd-carol channel active"   check_lnd_carol_channel_active

# Give gossip a moment to propagate announcements network-wide.
sleep 3

mkdir -p /shared

# Optionally mint a rune for REST auth (used by nutshell when configured
# as CLNRestWallet backend). CREATE_RUNE_FOR=<node> opts in.
if [ -n "${CREATE_RUNE_FOR:-}" ]; then
    log "creating rune on cln-${CREATE_RUNE_FOR} for REST auth"
    rune=$(cln "${CREATE_RUNE_FOR}" createrune | jq -r '.rune')
    if [ -z "$rune" ] || [ "$rune" = "null" ]; then
        log "ERROR: failed to create rune on cln-${CREATE_RUNE_FOR}"
        exit 1
    fi
    printf '%s' "$rune" > "/shared/${CREATE_RUNE_FOR}.rune"
    log "rune written to /shared/${CREATE_RUNE_FOR}.rune"
fi

touch /shared/ready
log "ALL DONE — channel topology ready"
