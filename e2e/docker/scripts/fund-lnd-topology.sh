#!/bin/sh
# Orchard e2e pair1 — mines blocks, funds LND wallets, opens channel topology.
# Runs once from the `setup` compose service after all LND nodes are healthy.

set -eu

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

lnd() {
    local node="$1" method="$2" path="$3" body="${4:-}"
    local macaroon_hex
    macaroon_hex=$(xxd -p -c 10000 "/lnd/${node}/data/chain/bitcoin/regtest/admin.macaroon")
    if [ -n "$body" ]; then
        curl -sS --fail -X "$method" \
            --cacert "/lnd/${node}/tls.cert" \
            -H "Grpc-Metadata-macaroon: ${macaroon_hex}" \
            -H 'content-type: application/json' \
            -d "$body" \
            "https://lnd-${node}:8080${path}"
    else
        curl -sS --fail -X "$method" \
            --cacert "/lnd/${node}/tls.cert" \
            -H "Grpc-Metadata-macaroon: ${macaroon_hex}" \
            "https://lnd-${node}:8080${path}"
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

check_lnd_info() {
    lnd "$1" GET /v1/getinfo > /dev/null
}

check_lnd_balance() {
    local node="$1" minimum="$2"
    local bal
    bal=$(lnd "$node" GET /v1/balance/blockchain 2>/dev/null | jq -r '.confirmed_balance')
    [ -n "$bal" ] && [ "$bal" -ge "$minimum" ]
}

check_lnd_channel_active() {
    local count
    count=$(lnd "$1" GET '/v1/channels?active_only=true' 2>/dev/null | jq -r '.channels | length')
    [ -n "$count" ] && [ "$count" -ge 1 ]
}

# ConnectPeer/OpenChannel need SERVER_ACTIVE; getinfo passes at RPC_ACTIVE already.
check_lnd_server_active() {
    local state
    state=$(lnd "$1" GET /v1/state 2>/dev/null | jq -r '.state')
    [ "$state" = "SERVER_ACTIVE" ]
}

log "creating bitcoind wallet"
bcli listwallets 2>/dev/null | jq -e '.[] | select(. == "default")' >/dev/null 2>&1 \
    || bcli createwallet '["default"]' >/dev/null

MINER_ADDR=$(bcli getnewaddress)
log "mining 101 blocks to ${MINER_ADDR}"
bcli generatetoaddress "[101, \"${MINER_ADDR}\"]" >/dev/null
log "chain height: $(bcli getblockcount)"

for node in orchard alice bob; do
    wait_for "lnd-${node} info" check_lnd_info "$node"
    addr=$(lnd "$node" GET /v1/newaddress | jq -r '.address')
    log "funding lnd-${node} at ${addr}"
    bcli sendtoaddress "[\"${addr}\", 10]" >/dev/null
done

log "mining 6 confirmations"
bcli generatetoaddress "[6, \"${MINER_ADDR}\"]" >/dev/null

# 10 BTC = 1_000_000_000 sat; require ≥ 900M to allow fee buffer.
for node in orchard alice bob; do
    wait_for "lnd-${node} confirmed balance ≥ 9 BTC" check_lnd_balance "$node" 900000000
done

for node in orchard alice bob; do
    wait_for "lnd-${node} server active" check_lnd_server_active "$node"
done

ORCHARD_PK=$(lnd orchard GET /v1/getinfo | jq -r '.identity_pubkey')
BOB_PK=$(lnd bob GET /v1/getinfo | jq -r '.identity_pubkey')
log "orchard pubkey: ${ORCHARD_PK}"
log "bob pubkey:     ${BOB_PK}"

# Idempotency helpers — lnd's REST returns 500 on "already connected"/"already
# has channel" errors, which `curl --fail` turns into exit 22. Compose may
# re-trigger setup when a new `up` is issued after partial teardown, so these
# guards let the script be rerun safely against an already-funded topology.
peer_exists() {
    local node="$1" target_pk="$2"
    lnd "$node" GET /v1/peers 2>/dev/null \
        | jq -e --arg pk "$target_pk" '.peers[]? | select(.pub_key == $pk)' > /dev/null
}

channel_to_exists() {
    local node="$1" target_pk="$2"
    lnd "$node" GET /v1/channels 2>/dev/null \
        | jq -e --arg pk "$target_pk" '.channels[]? | select(.remote_pubkey == $pk and (.capacity // "0") != "0")' > /dev/null
}

if peer_exists alice "$ORCHARD_PK"; then
    log "alice already peered with orchard"
else
    log "peering alice → orchard"
    lnd alice POST /v1/peers \
        "{\"addr\":{\"pubkey\":\"${ORCHARD_PK}\",\"host\":\"lnd-orchard:9735\"},\"perm\":true}" \
        >/dev/null
fi

if peer_exists orchard "$BOB_PK"; then
    log "orchard already peered with bob"
else
    log "peering orchard → bob"
    lnd orchard POST /v1/peers \
        "{\"addr\":{\"pubkey\":\"${BOB_PK}\",\"host\":\"lnd-bob:9735\"},\"perm\":true}" \
        >/dev/null
fi

if channel_to_exists alice "$ORCHARD_PK"; then
    log "channel alice → orchard already open"
else
    log "opening channel alice → orchard (${CHANNEL_CAPACITY_SAT} sat, push ${CHANNEL_PUSH_SAT})"
    lnd alice POST /v1/channels "{
        \"node_pubkey_string\": \"${ORCHARD_PK}\",
        \"local_funding_amount\": ${CHANNEL_CAPACITY_SAT},
        \"push_sat\": ${CHANNEL_PUSH_SAT}
    }" >/dev/null
fi

if channel_to_exists orchard "$BOB_PK"; then
    log "channel orchard → bob already open"
else
    log "opening channel orchard → bob (${CHANNEL_CAPACITY_SAT} sat, push ${CHANNEL_PUSH_SAT})"
    lnd orchard POST /v1/channels "{
        \"node_pubkey_string\": \"${BOB_PK}\",
        \"local_funding_amount\": ${CHANNEL_CAPACITY_SAT},
        \"push_sat\": ${CHANNEL_PUSH_SAT}
    }" >/dev/null
fi

log "mining 6 confirmations for channel funding txns"
bcli generatetoaddress "[6, \"${MINER_ADDR}\"]" >/dev/null

for node in alice orchard; do
    wait_for "lnd-${node} channel active" check_lnd_channel_active "$node"
done

# Give LND a moment to gossip channel announcements network-wide.
# A poll-based check would be tighter but `/v1/graph` in 0.20-beta returns
# null for .edges until the first announcement lands, and handling that
# cleanly in shell is more brittle than the fixed wait.
sleep 3

mkdir -p /shared
touch /shared/ready
log "ALL DONE — channel topology ready"
