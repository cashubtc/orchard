#!/bin/sh
# Orchard e2e — activity generator for LND topology (alice/orchard/bob).
#
# Runs once from the `activity` compose service after orchard is healthy.
# Sprays realistic LN + Cashu wallet activity on a freshly-funded stack so
# the SUT has history to observe.
#
# Categories (each count env-overridable; set to 0 to skip, or ACTIVITY_SKIP=1
# to disable the whole script):
#   - ACTIVITY_FORWARDS — alice ⇄ bob via orchard (forwarded LN payments)
#   - ACTIVITY_INBOUND  — alice/bob → orchard (inbound LN)
#   - ACTIVITY_OUTBOUND — orchard → alice/bob (outbound LN)
#   - ACTIVITY_MINTS    — wallet mints ecash; alice pays the mint's invoice
#   - ACTIVITY_SWAPS    — wallet sends + receives to itself (internal swap)
#   - ACTIVITY_MELTS    — wallet pays alice/bob invoice (burns ecash → LN)
#   - ACTIVITY_ONCHAIN_MINTS — wallet mints by depositing on-chain to a mint
#     address (lnd-cdk only; needs [onchain]/[bdk] in mintd.toml, default 0)
#   - ACTIVITY_ONCHAIN_MELTS — wallet melts to an on-chain address (lnd-cdk only)
#
# Requires:
#   - docker socket mounted (for exec into the wallet container)
#   - /lnd/{orchard,alice,bob} volumes mounted ro for macaroon + tls access
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
ACTIVITY_ONCHAIN_MINTS=${ACTIVITY_ONCHAIN_MINTS:-0}
ACTIVITY_ONCHAIN_MELTS=${ACTIVITY_ONCHAIN_MELTS:-0}
ACTIVITY_MEMPOOL_PER_RATE=${ACTIVITY_MEMPOOL_PER_RATE:-4}

log() { printf '[activity] %s\n' "$*"; }

if [ "${ACTIVITY_SKIP:-0}" = "1" ]; then
    log "ACTIVITY_SKIP=1 — exiting without generating activity"
    exit 0
fi

# ── bitcoind JSON-RPC wrapper (mirrors fund-lnd-topology.sh). ──
bcli() {
    method="$1"; params="${2:-[]}"
    curl -sS --fail \
        -u "${BTC_RPC_USER}:${BTC_RPC_PASS}" \
        -H 'content-type: application/json' \
        -d "{\"jsonrpc\":\"1.0\",\"method\":\"${method}\",\"params\":${params}}" \
        http://bitcoind:18443/ | jq -r '.result'
}

# Mine N regtest blocks to a throwaway address — confirms on-chain txs so the
# mint's BDK backend (num_confs=1) sees deposits and its own melt broadcasts.
btc_mine() {
    # POSIX sh has no `local` — prefix vars so callers' $addr survives.
    mine_n="${1:-1}"
    mine_addr=$(bcli getnewaddress)
    bcli generatetoaddress "[${mine_n}, \"${mine_addr}\"]" > /dev/null
}

# Send `sats` on-chain from bitcoind's default wallet to `addr` (sats → BTC).
btc_send_sats() {
    send_addr="$1"; send_sats="$2"
    send_btc=$(awk "BEGIN{printf \"%.8f\", ${send_sats}/100000000}")
    bcli sendtoaddress "[\"${send_addr}\", ${send_btc}]" > /dev/null
}

# ── LND REST helper (mirrors fund-lnd-topology.sh) ──
lnd() {
    node="$1"; method="$2"; path="$3"; body="${4:-}"
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

# Add invoice on an LND node, echo bolt11.
lnd_invoice() {
    lnd "$1" POST /v1/invoices "{\"value\":$2}" | jq -r '.payment_request'
}

# Pay a bolt11 from an LND node (synchronous legacy sendpayment).
# /v1/channels/transactions is the simple sync endpoint; v2 router is streaming.
lnd_pay() {
    resp=$(lnd "$1" POST /v1/channels/transactions "{\"payment_request\":\"$2\"}")
    err=$(printf '%s' "$resp" | jq -r '.payment_error // ""')
    if [ -n "$err" ]; then
        log "  pay failed: $err"
        return 1
    fi
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

# Random sat amount in [min, max).
rand_sat() {
    min="${1:-100}"; max="${2:-5000}"
    range=$((max - min))
    r=$(od -An -N2 -tu2 < /dev/urandom | tr -cd '0-9')
    echo $((min + (r % range)))
}

# ───── 1. Forwarded LN payments (alice ⇄ bob via orchard) ─────
if [ "$ACTIVITY_FORWARDS" -gt 0 ]; then
    log "forwarded LN payments: $ACTIVITY_FORWARDS"
    i=0
    while [ "$i" -lt "$ACTIVITY_FORWARDS" ]; do
        amt=$(rand_sat 100 5000)
        if [ $((i % 2)) -eq 0 ]; then src=alice; dst=bob; else src=bob; dst=alice; fi
        inv=$(lnd_invoice "$dst" "$amt")
        lnd_pay "$src" "$inv" || true
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
        if [ $((i % 2)) -eq 0 ]; then src=alice; else src=bob; fi
        inv=$(lnd_invoice orchard "$amt")
        lnd_pay "$src" "$inv" || true
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
        if [ $((i % 2)) -eq 0 ]; then dst=alice; else dst=bob; fi
        inv=$(lnd_invoice "$dst" "$amt")
        lnd_pay orchard "$inv" || true
        log "  out orchard → ${dst} ${amt} sat"
        i=$((i + 1))
    done
fi

# ───── 4. Wallet mints ─────
# `cdk-cli mint <url> N` fetches a mint quote, prints the bolt11, then polls
# until paid and redeems. Run it backgrounded, extract the invoice, pay from
# alice, wait for cdk-cli to finish redeeming.
if [ "$ACTIVITY_MINTS" -gt 0 ]; then
    log "wallet mints: $ACTIVITY_MINTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_MINTS" ]; do
        amt=$(rand_sat 100 2000)
        tmp=$(mktemp)

        wallet mint "$MINT_URL" "$amt" > "$tmp" 2>&1 &
        pid=$!

        bolt11=""
        tries=30
        while [ "$tries" -gt 0 ]; do
            bolt11=$(grep -oE 'lnbcrt[0-9a-z]+' "$tmp" 2>/dev/null | head -1 || true)
            [ -n "$bolt11" ] && break
            sleep 0.5
            tries=$((tries - 1))
        done

        if [ -z "$bolt11" ]; then
            log "  mint ${amt} FAILED (no invoice in cdk-cli output)"
            sed 's/^/    /' "$tmp" || true
            kill "$pid" 2>/dev/null || true
            rm -f "$tmp"
            i=$((i + 1))
            continue
        fi

        lnd_pay alice "$bolt11" || true

        if wait "$pid"; then
            log "  mint ${amt} sat"
        else
            log "  mint ${amt} FAILED (redeem)"
            sed 's/^/    /' "$tmp" || true
        fi
        rm -f "$tmp"
        i=$((i + 1))
    done
fi

# ───── 5. Internal swaps (wallet → wallet) ─────
# `cdk-cli send -a N` splits proofs (= a mint swap) and outputs a token.
# `cdk-cli receive <token>` swaps again on the receiving side. Net balance
# delta is zero but the mint records two swap operations.
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
        if [ $((i % 2)) -eq 0 ]; then dst=alice; else dst=bob; fi
        inv=$(lnd_invoice "$dst" "$amt")
        if wallet melt --mint-url "$MINT_URL" --invoice "$inv" >/dev/null 2>&1; then
            log "  melt ${amt} sat → ${dst}"
        else
            log "  melt ${amt} FAILED"
        fi
        i=$((i + 1))
    done
fi

# ───── 7. Wallet onchain mints (NUT-30 / BDK backend) ─────
# Three-phase like bolt11, but the mint returns a bitcoin ADDRESS instead of an
# invoice: (1) request quote → address, (2) send on-chain from bitcoind + mine
# confs, (3) redeem proofs by quote id. These deposits also fund the mint's BDK
# wallet, giving the onchain melts below UTXOs to spend — so they run first.
# Skipped (default 0) on stacks whose mintd.toml has no [onchain] backend.
if [ "$ACTIVITY_ONCHAIN_MINTS" -gt 0 ]; then
    log "wallet onchain mints: $ACTIVITY_ONCHAIN_MINTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_ONCHAIN_MINTS" ]; do
        amt=$(rand_sat 5000 20000)
        tmp=$(mktemp)

        wallet_bounded 15 mint "$MINT_URL" "$amt" --method onchain --wait-duration=0 > "$tmp" 2>&1 || true
        addr=$(grep -oE 'bcrt1[0-9a-z]+' "$tmp" 2>/dev/null | head -1 || true)
        quote_id=$(grep -oE 'id=[A-Za-z0-9_-]+' "$tmp" 2>/dev/null | head -1 | cut -d= -f2)

        if [ -z "$addr" ] || [ -z "$quote_id" ]; then
            log "  onchain mint ${amt} FAILED (no address/quote_id in cdk-cli output)"
            sed 's/^/    /' "$tmp" || true
            rm -f "$tmp"
            i=$((i + 1))
            continue
        fi

        btc_send_sats "$addr" "$amt"
        btc_mine 2   # num_confs=1 in mintd.toml; mine 2 for margin

        # Redeem. The mint's BDK poller needs a moment to spot the confirmed
        # deposit, so allow a generous idle window (--wait-duration=0) bounded by
        # a host-side timeout in case detection never happens.
        wallet_bounded 90 mint "$MINT_URL" --quote-id "$quote_id" --method onchain --wait-duration=0 > "$tmp" 2>&1 || true
        if grep -q 'Minted' "$tmp" 2>/dev/null; then
            log "  onchain mint ${amt} sat"
        else
            log "  onchain mint ${amt} redeem UNCONFIRMED"
            sed 's/^/    /' "$tmp" || true
        fi
        rm -f "$tmp"
        i=$((i + 1))
    done
fi

# ───── 8. Wallet onchain melts (NUT-30 / BDK backend) ─────
# Wallet burns ecash and the mint pays a bitcoin address on-chain. Destination
# is a fresh bitcoind address; a block is mined afterwards to confirm the mint's
# broadcast. Needs the onchain mints above to have funded the mint's BDK wallet,
# plus enough wallet sat balance to cover amount + fee reserve.
if [ "$ACTIVITY_ONCHAIN_MELTS" -gt 0 ]; then
    log "wallet onchain melts: $ACTIVITY_ONCHAIN_MELTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_ONCHAIN_MELTS" ]; do
        amt=$(rand_sat 2000 5000)
        addr=$(bcli getnewaddress)
        if wallet_bounded 60 melt --mint-url "$MINT_URL" --method onchain --address "$addr" --amount "$amt" >/dev/null 2>&1; then
            btc_mine 1
            log "  onchain melt ${amt} sat → ${addr}"
        else
            log "  onchain melt ${amt} FAILED"
        fi
        i=$((i + 1))
    done
fi

# ───── 9. Mempool fill — varied-fee unconfirmed self-sends ─────
# Broadcasts ACTIVITY_MEMPOOL_PER_RATE × 6 tiny txs at fee rates
# {1, 2, 5, 10, 25, 50} sat/vB and leaves them unconfirmed, so the UI's
# fee / mempool / block-template panels have realistic input. Reuses the
# bitcoind default wallet (113 coinbase outputs mined by fund-lnd-topology,
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

log "DONE — forwards=$ACTIVITY_FORWARDS inbound=$ACTIVITY_INBOUND outbound=$ACTIVITY_OUTBOUND mints=$ACTIVITY_MINTS swaps=$ACTIVITY_SWAPS melts=$ACTIVITY_MELTS onchain_mints=$ACTIVITY_ONCHAIN_MINTS onchain_melts=$ACTIVITY_ONCHAIN_MELTS mempool=$((ACTIVITY_MEMPOOL_PER_RATE * 6))"
