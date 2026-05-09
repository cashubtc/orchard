#!/bin/sh
# Orchard e2e — activity generator for CLN topology (alice/orchard via CLN,
# carol via LND cross-impl).
#
# Runs once from the `activity` compose service after orchard is healthy.
# Sprays realistic LN + Cashu wallet activity on a freshly-funded stack so
# the SUT has history to observe.
#
# Categories (each count env-overridable; set to 0 to skip, or ACTIVITY_SKIP=1
# to disable the whole script):
#   - ACTIVITY_FORWARDS — alice ⇄ carol via orchard (forwarded LN payments)
#   - ACTIVITY_INBOUND  — alice/carol → orchard (inbound LN)
#   - ACTIVITY_OUTBOUND — orchard → alice/carol (outbound LN)
#   - ACTIVITY_MINTS        — wallet mints ecash; alice pays the mint's invoice
#   - ACTIVITY_SWAPS        — wallet sends + receives to itself (internal swap)
#   - ACTIVITY_MELTS        — wallet pays alice/carol invoice (burns ecash → LN)
#   - ACTIVITY_BOLT12_MINTS — wallet mints via bolt12 offer (cln-cdk only;
#                             requires mint NUT-25 support)
#   - ACTIVITY_BOLT12_MELTS — wallet melts by paying an alice offer (cln-cdk only)
#
# Requires:
#   - docker socket mounted (for exec into wallet + cln containers)
#   - /lnd/carol volume mounted ro for macaroon + tls access
#   - CONFIG_NAME, MINT_SERVICE, MINT_PORT env vars set by compose

set -eu

: "${CONFIG_NAME:?CONFIG_NAME must be set}"
: "${MINT_SERVICE:?MINT_SERVICE must be set (nutshell|cdk-mintd)}"
: "${MINT_PORT:?MINT_PORT must be set (3338|3339)}"

MINT_URL="http://${MINT_SERVICE}:${MINT_PORT}"

ACTIVITY_FORWARDS=${ACTIVITY_FORWARDS:-6}
ACTIVITY_INBOUND=${ACTIVITY_INBOUND:-4}
ACTIVITY_OUTBOUND=${ACTIVITY_OUTBOUND:-4}
ACTIVITY_MINTS=${ACTIVITY_MINTS:-5}
ACTIVITY_SWAPS=${ACTIVITY_SWAPS:-4}
ACTIVITY_MELTS=${ACTIVITY_MELTS:-3}
ACTIVITY_BOLT12_MINTS=${ACTIVITY_BOLT12_MINTS:-0}
ACTIVITY_BOLT12_MELTS=${ACTIVITY_BOLT12_MELTS:-0}
ACTIVITY_MEMPOOL_PER_RATE=${ACTIVITY_MEMPOOL_PER_RATE:-4}

log() { printf '[activity] %s\n' "$*"; }

if [ "${ACTIVITY_SKIP:-0}" = "1" ]; then
    log "ACTIVITY_SKIP=1 — exiting without generating activity"
    exit 0
fi

# ── bitcoind JSON-RPC wrapper (mirrors fund-cln-topology.sh). ──
bcli() {
    method="$1"; params="${2:-[]}"
    curl -sS --fail \
        -u "${BTC_RPC_USER}:${BTC_RPC_PASS}" \
        -H 'content-type: application/json' \
        -d "{\"jsonrpc\":\"1.0\",\"method\":\"${method}\",\"params\":${params}}" \
        http://bitcoind:18443/ | jq -r '.result'
}

# ── CLN via docker exec (mirrors fund-cln-topology.sh). $1 = short node name. ──
cln() {
    node="$1"; shift
    docker exec "${CONFIG_NAME}-cln-${node}" \
        lightning-cli --lightning-dir=/home/clightning/.lightning --network=regtest "$@"
}

# ── LND REST for lnd-carol (the sole LND node in this topology). ──
lnd_carol() {
    method="$1"; path="$2"; body="${3:-}"
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

# Random 10-digit ID for unique labels.
rand_id() { od -An -N4 -tu4 < /dev/urandom | tr -cd '0-9'; }

# Produce an invoice on a CLN node; echoes bolt11.
# CLN `invoice` needs msat + unique label + description.
cln_invoice() {
    node="$1"; amt_sat="$2"
    msat=$((amt_sat * 1000))
    label="activity-${node}-$(rand_id)"
    cln "$node" invoice "$msat" "$label" "e2e-activity" | jq -r '.bolt11'
}

# Produce an invoice on lnd-carol; echoes bolt11.
carol_invoice() {
    lnd_carol POST /v1/invoices "{\"value\":$1}" | jq -r '.payment_request'
}

# Pay a bolt11 from a CLN node.
cln_pay() {
    cln "$1" pay "$2" > /dev/null
}

# Pay a bolt11 from lnd-carol.
carol_pay() {
    resp=$(lnd_carol POST /v1/channels/transactions "{\"payment_request\":\"$1\"}")
    err=$(printf '%s' "$resp" | jq -r '.payment_error // ""')
    if [ -n "$err" ]; then
        log "  pay failed: $err"
        return 1
    fi
}

# Produce an invoice on any topology node; $1 ∈ {alice, orchard, carol}.
any_invoice() {
    case "$1" in
        alice|orchard) cln_invoice "$1" "$2" ;;
        carol)         carol_invoice "$2" ;;
        *) log "unknown node: $1"; return 1 ;;
    esac
}

# Pay from any topology node.
any_pay() {
    case "$1" in
        alice|orchard) cln_pay "$1" "$2" ;;
        carol)         carol_pay "$2" ;;
        *) log "unknown node: $1"; return 1 ;;
    esac
}

# Run cdk-cli inside the wallet container. MINT_URL is passed per-subcommand
# (cdk-cli tracks mints in its local DB; the first `mint <url>` call registers
# the mint so subsequent commands resolve it).
wallet() {
    docker exec -i "${CONFIG_NAME}-wallet" cdk-cli "$@"
}

# Run cdk-cli with a hard kill after N seconds. cdk-cli's `mint` keeps a
# NUT-17 websocket subscription open after returning the quote (and after
# proof redemption) and ignores SIGTERM. A host-side `kill` of the
# `docker exec` wrapper would orphan it — signals don't cross the docker
# exec PID-namespace boundary. `timeout` runs alongside cdk-cli inside the
# container; `-k 1` escalates to SIGKILL one second after the SIGTERM, which
# cdk-cli does honor.
wallet_bounded() {
    secs="$1"; shift
    docker exec -i "${CONFIG_NAME}-wallet" timeout -k 1 "$secs" cdk-cli "$@"
}

rand_sat() {
    min="${1:-100}"; max="${2:-5000}"
    range=$((max - min))
    r=$(od -An -N2 -tu2 < /dev/urandom | tr -cd '0-9')
    echo $((min + (r % range)))
}

# ───── 1. Forwarded LN payments (alice ⇄ carol via orchard) ─────
# alice → orchard → carol exercises CLN → CLN → LND forwarding;
# the reverse direction exercises LND → CLN → CLN.
if [ "$ACTIVITY_FORWARDS" -gt 0 ]; then
    log "forwarded LN payments: $ACTIVITY_FORWARDS"
    i=0
    while [ "$i" -lt "$ACTIVITY_FORWARDS" ]; do
        amt=$(rand_sat 100 5000)
        if [ $((i % 2)) -eq 0 ]; then src=alice; dst=carol; else src=carol; dst=alice; fi
        inv=$(any_invoice "$dst" "$amt")
        any_pay "$src" "$inv" || true
        log "  fwd ${src} → ${dst} ${amt} sat"
        i=$((i + 1))
    done
fi

# ───── 2. Inbound LN to orchard ─────
if [ "$ACTIVITY_INBOUND" -gt 0 ]; then
    log "inbound LN to orchard: $ACTIVITY_INBOUND"
    i=0
    while [ "$i" -lt "$ACTIVITY_INBOUND" ]; do
        amt=$(rand_sat 100 2000)
        if [ $((i % 2)) -eq 0 ]; then src=alice; else src=carol; fi
        inv=$(cln_invoice orchard "$amt")
        any_pay "$src" "$inv" || true
        log "  in  ${src} → orchard ${amt} sat"
        i=$((i + 1))
    done
fi

# ───── 3. Outbound LN from orchard ─────
if [ "$ACTIVITY_OUTBOUND" -gt 0 ]; then
    log "outbound LN from orchard: $ACTIVITY_OUTBOUND"
    i=0
    while [ "$i" -lt "$ACTIVITY_OUTBOUND" ]; do
        amt=$(rand_sat 100 2000)
        if [ $((i % 2)) -eq 0 ]; then dst=alice; else dst=carol; fi
        inv=$(any_invoice "$dst" "$amt")
        cln_pay orchard "$inv" || true
        log "  out orchard → ${dst} ${amt} sat"
        i=$((i + 1))
    done
fi

# ───── 4. Wallet mints ─────
# Two-phase: ask the mint for a quote (phase 1), pay externally (phase 2),
# redeem proofs by quote id (phase 3). cdk-cli's `mint` lingers on its
# NUT-17 subscription after each phase, so each cdk-cli call is bounded by
# `wallet_bounded` to force a clean SIGKILL inside the container.
if [ "$ACTIVITY_MINTS" -gt 0 ]; then
    log "wallet mints: $ACTIVITY_MINTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_MINTS" ]; do
        amt=$(rand_sat 100 2000)
        tmp=$(mktemp)

        wallet_bounded 5 mint "$MINT_URL" "$amt" --wait-duration=0 > "$tmp" 2>&1 || true
        bolt11=$(grep -oE 'lnbcrt[0-9a-z]+' "$tmp" 2>/dev/null | head -1 || true)
        quote_id=$(grep -oE 'id=[A-Za-z0-9_-]+' "$tmp" 2>/dev/null | head -1 | cut -d= -f2)

        if [ -z "$bolt11" ] || [ -z "$quote_id" ]; then
            log "  mint ${amt} FAILED (no invoice/quote_id in cdk-cli output)"
            sed 's/^/    /' "$tmp" || true
            rm -f "$tmp"
            i=$((i + 1))
            continue
        fi

        if ! cln_pay alice "$bolt11"; then
            log "  mint ${amt} FAILED (pay)"
            rm -f "$tmp"
            i=$((i + 1))
            continue
        fi

        wallet_bounded 5 mint "$MINT_URL" --quote-id "$quote_id" --wait-duration=0 > "$tmp" 2>&1 || true
        log "  mint ${amt} sat"
        rm -f "$tmp"
        i=$((i + 1))
    done
fi

# ───── 5. Internal swaps (wallet → wallet) ─────
if [ "$ACTIVITY_SWAPS" -gt 0 ]; then
    log "wallet swaps: $ACTIVITY_SWAPS"
    i=0
    while [ "$i" -lt "$ACTIVITY_SWAPS" ]; do
        amt=$(rand_sat 10 100)
        token=$(wallet send -a "$amt" 2>&1 | grep -oE 'cashu[AB][A-Za-z0-9+/_=-]+' | head -1 || true)
        if [ -z "$token" ]; then
            log "  swap ${amt} FAILED (no token)"
            i=$((i + 1))
            continue
        fi
        if wallet receive "$token" >/dev/null 2>&1; then
            log "  swap ${amt} sat"
        else
            log "  swap ${amt} FAILED (receive)"
        fi
        i=$((i + 1))
    done
fi

# ───── 6. Wallet melts ─────
if [ "$ACTIVITY_MELTS" -gt 0 ]; then
    log "wallet melts: $ACTIVITY_MELTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_MELTS" ]; do
        amt=$(rand_sat 50 500)
        if [ $((i % 2)) -eq 0 ]; then dst=alice; else dst=carol; fi
        inv=$(any_invoice "$dst" "$amt")
        if wallet melt --mint-url "$MINT_URL" --invoice "$inv" >/dev/null 2>&1; then
            log "  melt ${amt} sat → ${dst}"
        else
            log "  melt ${amt} FAILED"
        fi
        i=$((i + 1))
    done
fi

# ───── 7. Wallet bolt12 mints ─────
# Same two-phase pattern as bolt11: phase 1 obtains the offer + quote id,
# alice fetchinvoice's a bolt12 invoice and pays it (phase 2), phase 3 redeems
# proofs by quote id. cdk-cli's NUT-17 subscription means it never exits on
# its own, so each call is bounded by `wallet_bounded`.
if [ "$ACTIVITY_BOLT12_MINTS" -gt 0 ]; then
    log "wallet bolt12 mints: $ACTIVITY_BOLT12_MINTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_BOLT12_MINTS" ]; do
        amt=$(rand_sat 100 2000)
        tmp=$(mktemp)

        wallet_bounded 5 mint "$MINT_URL" "$amt" --method bolt12 --wait-duration=0 > "$tmp" 2>&1 || true
        offer=$(grep -oE 'lno1[0-9a-z]+' "$tmp" 2>/dev/null | head -1 || true)
        quote_id=$(grep -oE 'id=[A-Za-z0-9_-]+' "$tmp" 2>/dev/null | head -1 | cut -d= -f2)

        if [ -z "$offer" ] || [ -z "$quote_id" ]; then
            log "  bolt12 mint ${amt} FAILED (no offer)"
            rm -f "$tmp"
            i=$((i + 1))
            continue
        fi

        msat=$((amt * 1000))
        invoice=$(cln alice fetchinvoice "offer=$offer" "amount_msat=$msat" 2>/dev/null | jq -r '.invoice // ""')
        if [ -z "$invoice" ] || [ "$invoice" = "null" ]; then
            log "  bolt12 mint ${amt} FAILED (fetchinvoice)"
            rm -f "$tmp"
            i=$((i + 1))
            continue
        fi

        if ! cln_pay alice "$invoice"; then
            log "  bolt12 mint ${amt} FAILED (pay)"
            rm -f "$tmp"
            i=$((i + 1))
            continue
        fi

        wallet_bounded 5 mint "$MINT_URL" --method bolt12 --quote-id "$quote_id" --wait-duration=0 > "$tmp" 2>&1 || true
        log "  bolt12 mint ${amt} sat"
        rm -f "$tmp"
        i=$((i + 1))
    done
fi

# ───── 8. Wallet bolt12 melts ─────
# Alice creates an offer (bolt12 string starting `lno1…`). Wallet sends the
# offer to the mint, which fetchinvoice's it to alice, pays the resulting
# bolt11, then tells the wallet to burn proofs.
if [ "$ACTIVITY_BOLT12_MELTS" -gt 0 ]; then
    log "wallet bolt12 melts: $ACTIVITY_BOLT12_MELTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_BOLT12_MELTS" ]; do
        amt=$(rand_sat 50 500)
        label="bolt12-melt-$(rand_id)"
        offer=$(cln alice offer "${amt}sat" "$label" 2>/dev/null | jq -r '.bolt12 // ""')
        if [ -z "$offer" ] || [ "$offer" = "null" ]; then
            log "  bolt12 melt ${amt} FAILED (offer creation)"
            i=$((i + 1))
            continue
        fi
        if wallet melt --mint-url "$MINT_URL" --method bolt12 --offer "$offer" >/dev/null 2>&1; then
            log "  bolt12 melt ${amt} sat → alice"
        else
            log "  bolt12 melt ${amt} FAILED"
        fi
        i=$((i + 1))
    done
fi

# ───── 9. Mempool fill — varied-fee unconfirmed self-sends ─────
# Broadcasts ACTIVITY_MEMPOOL_PER_RATE × 6 tiny txs at fee rates
# {1, 2, 5, 10, 25, 50} sat/vB and leaves them unconfirmed, so the UI's
# fee / mempool / block-template panels have realistic input. Reuses the
# bitcoind default wallet (113 coinbase outputs mined by fund-cln-topology,
# first 100 mature by the time activity runs).
if [ "$ACTIVITY_MEMPOOL_PER_RATE" -gt 0 ]; then
    : "${BTC_RPC_USER:?BTC_RPC_USER must be set for mempool-fill}"
    : "${BTC_RPC_PASS:?BTC_RPC_PASS must be set for mempool-fill}"
    log "mempool fill: $ACTIVITY_MEMPOOL_PER_RATE × 6 rates"
    for rate in 1 2 5 10 25 50; do
        i=0
        while [ "$i" -lt "$ACTIVITY_MEMPOOL_PER_RATE" ]; do
            addr=$(bcli getnewaddress)
            txid=$(bcli sendtoaddress "[\"$addr\", 0.0001, \"\", \"\", false, true, null, \"unset\", null, ${rate}]")
            if [ -z "$txid" ] || [ "$txid" = "null" ]; then
                log "  ${rate} sat/vB FAILED"
            fi
            i=$((i + 1))
        done
        log "  ${ACTIVITY_MEMPOOL_PER_RATE}× @ ${rate} sat/vB"
    done
fi

log "DONE — forwards=$ACTIVITY_FORWARDS inbound=$ACTIVITY_INBOUND outbound=$ACTIVITY_OUTBOUND mints=$ACTIVITY_MINTS swaps=$ACTIVITY_SWAPS melts=$ACTIVITY_MELTS bolt12_mints=$ACTIVITY_BOLT12_MINTS bolt12_melts=$ACTIVITY_BOLT12_MELTS mempool=$((ACTIVITY_MEMPOOL_PER_RATE * 6))"
