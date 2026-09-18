#!/bin/sh
# Orchard e2e — activity generator for fake-backed mint paths.
#
# Runs once from the `activity` compose service after orchard is healthy.
# Exercises mint → swap → melt flows via cdk-cli for each configured unit.
# Melts need a fresh bolt11 per call (the mint rejects re-melts of the same
# payment_hash with code 11000 "already paid or pending"). Two paths:
#   - LN_INVOICE_NODE set → `docker exec <node> lightning-cli invoice ...`
#     against the existing CLN node. Used on cln-nutshell-postgres.
#   - else → `node /scripts/gen-one-bolt11.js <sats>` self-signs locally.
#     Used on fake-cdk-postgres which has no LN node.
#
# Designed to run on:
#   - fake-cdk-postgres (sat + usd both via fake)
#   - cln-nutshell-postgres (usd only; sat handled by activity-cln-topology.sh)
#
# Per-unit counts; set any to 0 to skip that unit's work. EUR defaults to
# 0 so stacks that don't wire a EUR keyset (e.g. fake-cdk-postgres) don't
# silently attempt EUR traffic — opt in explicitly per-stack.
#   - ACTIVITY_MINTS_SAT / ACTIVITY_MINTS_USD / ACTIVITY_MINTS_EUR
#   - ACTIVITY_SWAPS_SAT / ACTIVITY_SWAPS_USD / ACTIVITY_SWAPS_EUR
#   - ACTIVITY_MELTS_SAT / ACTIVITY_MELTS_USD / ACTIVITY_MELTS_EUR
#   - ACTIVITY_BOLT12_MINTS / ACTIVITY_BOLT12_MELTS — sat-unit bolt12 quotes
#     (fake_wallet auto-settles them; no LN node needed; default 0)
#   - ACTIVITY_ONCHAIN_MINTS / ACTIVITY_ONCHAIN_MELTS — sat-unit onchain quotes
#     (fake_wallet auto-settles them; no bitcoind needed; default 0)
#   - ACTIVITY_MEMPOOL_PER_RATE
#
# Requires:
#   - docker socket mounted (for exec into wallet and optionally LN node)
#   - CONFIG_NAME, MINT_SERVICE, MINT_PORT env vars set by compose
#   - LN_INVOICE_NODE (optional): short name of a CLN container to ask
#     for melt invoices, e.g. "cln-alice". Resolved as ${CONFIG_NAME}-${LN_INVOICE_NODE}.

set -eu

: "${CONFIG_NAME:?CONFIG_NAME must be set}"
: "${MINT_SERVICE:?MINT_SERVICE must be set (cdk-mintd|nutshell)}"
: "${MINT_PORT:?MINT_PORT must be set (3341|3340)}"

MINT_URL="http://${MINT_SERVICE}:${MINT_PORT}"

ACTIVITY_MINTS_SAT=${ACTIVITY_MINTS_SAT:-5}
ACTIVITY_MINTS_USD=${ACTIVITY_MINTS_USD:-3}
ACTIVITY_MINTS_EUR=${ACTIVITY_MINTS_EUR:-0}
ACTIVITY_SWAPS_SAT=${ACTIVITY_SWAPS_SAT:-3}
ACTIVITY_SWAPS_USD=${ACTIVITY_SWAPS_USD:-2}
ACTIVITY_SWAPS_EUR=${ACTIVITY_SWAPS_EUR:-0}
ACTIVITY_MELTS_SAT=${ACTIVITY_MELTS_SAT:-3}
ACTIVITY_MELTS_USD=${ACTIVITY_MELTS_USD:-2}
ACTIVITY_MELTS_EUR=${ACTIVITY_MELTS_EUR:-0}
ACTIVITY_BOLT12_MINTS=${ACTIVITY_BOLT12_MINTS:-0}
ACTIVITY_BOLT12_MELTS=${ACTIVITY_BOLT12_MELTS:-0}
ACTIVITY_ONCHAIN_MINTS=${ACTIVITY_ONCHAIN_MINTS:-0}
ACTIVITY_ONCHAIN_MELTS=${ACTIVITY_ONCHAIN_MELTS:-0}
ACTIVITY_MEMPOOL_PER_RATE=${ACTIVITY_MEMPOOL_PER_RATE:-4}

log() { printf '[activity-fake] %s\n' "$*"; }

if [ "${ACTIVITY_SKIP:-0}" = "1" ]; then
    log "ACTIVITY_SKIP=1 — exiting without generating activity"
    exit 0
fi

# bitcoind JSON-RPC wrapper (mirrors activity-cln-topology.sh).
bcli() {
    method="$1"; params="${2:-[]}"
    curl -sS --fail \
        -u "${BTC_RPC_USER}:${BTC_RPC_PASS}" \
        -H 'content-type: application/json' \
        -d "{\"jsonrpc\":\"1.0\",\"method\":\"${method}\",\"params\":${params}}" \
        http://bitcoind:18443/ | jq -r '.result'
}

# Run cdk-cli inside the wallet container. `--unit` is a global flag on the
# root Cli struct (cdk-cli ≥ 0.12), applied before the subcommand.
wallet_unit() {
    unit="$1"; shift
    docker exec -i "${CONFIG_NAME}-wallet" cdk-cli --unit "$unit" "$@"
}

AMOUNTS="100 500 1000"

rand_amount() {
    r=$(od -An -N1 -tu1 < /dev/urandom | tr -cd '0-9')
    idx=$((r % 3))
    i=0
    for a in $AMOUNTS; do
        if [ "$i" -eq "$idx" ]; then printf '%s' "$a"; return; fi
        i=$((i + 1))
    done
}

# Echo a fresh bolt11 invoice for $amt sats. CLN path uses a unique label per
# call so the node never rejects a duplicate; local path uses random privkey +
# payment_hash per invocation so the mint sees a fresh payment_hash every time.
fresh_bolt11() {
    amt_sat="$1"
    if [ -n "${LN_INVOICE_NODE:-}" ]; then
        msat=$((amt_sat * 1000))
        rid=$(od -An -N4 -tu4 < /dev/urandom | tr -cd '0-9')
        docker exec -i "${CONFIG_NAME}-${LN_INVOICE_NODE}" \
            lightning-cli --lightning-dir=/home/clightning/.lightning --network=regtest \
            invoice "$msat" "activity-fake-${rid}" "e2e-fake-melt" 2>/dev/null \
            | jq -r '.bolt11'
    else
        node /scripts/gen-one-bolt11.js "$amt_sat"
    fi
}

# ── Per-unit mint/swap/melt loop ──
run_unit() {
    unit="$1"; n_mints="$2"; n_swaps="$3"; n_melts="$4"

    if [ "$n_mints" -gt 0 ]; then
        log "[$unit] mints: $n_mints"
        i=0
        while [ "$i" -lt "$n_mints" ]; do
            amt=$(rand_amount)
            if wallet_unit "$unit" mint "$MINT_URL" "$amt" >/dev/null 2>&1; then
                log "  [$unit] mint ${amt}"
            else
                log "  [$unit] mint ${amt} FAILED"
            fi
            i=$((i + 1))
        done
    fi

    if [ "$n_swaps" -gt 0 ]; then
        log "[$unit] swaps: $n_swaps"
        i=0
        while [ "$i" -lt "$n_swaps" ]; do
            amt=$(rand_amount)
            # `--mint-url` is required: without it cdk-cli prompts "Enter mint
            # number to send from" interactively when multiple (mint, unit)
            # entries exist in the wallet, and the docker exec has no stdin.
            token=$(wallet_unit "$unit" send --mint-url "$MINT_URL" -a "$amt" 2>&1 | grep -oE 'cashu[AB][A-Za-z0-9+/_=-]+' | head -1 || true)
            if [ -z "$token" ]; then
                log "  [$unit] swap ${amt} FAILED (no token)"
            elif wallet_unit "$unit" receive "$token" >/dev/null 2>&1; then
                log "  [$unit] swap ${amt}"
            else
                log "  [$unit] swap ${amt} FAILED (receive)"
            fi
            i=$((i + 1))
        done
    fi

    if [ "$n_melts" -gt 0 ]; then
        log "[$unit] melts: $n_melts"
        i=0
        while [ "$i" -lt "$n_melts" ]; do
            amt=$(rand_amount)
            inv=$(fresh_bolt11 "$amt")
            if [ -z "$inv" ] || [ "$inv" = "null" ]; then
                log "  [$unit] melt ${amt} FAILED (invoice gen)"
                i=$((i + 1)); continue
            fi
            if wallet_unit "$unit" melt --mint-url "$MINT_URL" --invoice "$inv" >/dev/null 2>&1; then
                log "  [$unit] melt ${amt}"
            else
                log "  [$unit] melt ${amt} FAILED"
            fi
            i=$((i + 1))
        done
    fi
}

run_unit sat "$ACTIVITY_MINTS_SAT" "$ACTIVITY_SWAPS_SAT" "$ACTIVITY_MELTS_SAT"
run_unit usd "$ACTIVITY_MINTS_USD" "$ACTIVITY_SWAPS_USD" "$ACTIVITY_MELTS_USD"
run_unit eur "$ACTIVITY_MINTS_EUR" "$ACTIVITY_SWAPS_EUR" "$ACTIVITY_MELTS_EUR"

# ── bolt12 / onchain quotes (sat) — fake_wallet auto-settles ─────
# fake_wallet advertises bolt12 + onchain and marks their quotes paid with no
# LN node or bitcoind, so ONE cdk-cli call covers the whole quote→pay→redeem
# flow. Melts need a payable target (offer / address): harvest it from a
# throwaway mint quote's own output — the extra quote row is harmless sim data.
# Runs BEFORE the SAT cap mint below so the newest mint_quote row stays bolt11.
wallet_bounded() {
    secs="$1"; shift
    docker exec -i "${CONFIG_NAME}-wallet" timeout -k 1 "$secs" cdk-cli "$@"
}

if [ "$ACTIVITY_BOLT12_MINTS" -gt 0 ]; then
    log "bolt12 mints (sat): $ACTIVITY_BOLT12_MINTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_BOLT12_MINTS" ]; do
        amt=$(rand_amount)
        if wallet_bounded 20 mint "$MINT_URL" "$amt" --method bolt12 2>&1 | grep -q 'Minted'; then
            log "  bolt12 mint ${amt}"
        else
            log "  bolt12 mint ${amt} FAILED"
        fi
        i=$((i + 1))
    done
fi

if [ "$ACTIVITY_BOLT12_MELTS" -gt 0 ]; then
    log "bolt12 melts (sat): $ACTIVITY_BOLT12_MELTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_BOLT12_MELTS" ]; do
        amt=$(rand_amount)
        offer=$(wallet_bounded 20 mint "$MINT_URL" "$amt" --method bolt12 2>&1 | grep -oE 'lno1[0-9a-z]+' | head -1 || true)
        if [ -z "$offer" ]; then
            log "  bolt12 melt ${amt} FAILED (no offer)"
            i=$((i + 1)); continue
        fi
        if wallet_bounded 20 melt --mint-url "$MINT_URL" --method bolt12 --offer "$offer" --amount "$amt" >/dev/null 2>&1; then
            log "  bolt12 melt ${amt}"
        else
            log "  bolt12 melt ${amt} FAILED"
        fi
        i=$((i + 1))
    done
fi

if [ "$ACTIVITY_ONCHAIN_MINTS" -gt 0 ]; then
    log "onchain mints (sat): $ACTIVITY_ONCHAIN_MINTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_ONCHAIN_MINTS" ]; do
        amt=$(rand_amount)
        if wallet_bounded 20 mint "$MINT_URL" "$amt" --method onchain 2>&1 | grep -q 'Minted'; then
            log "  onchain mint ${amt}"
        else
            log "  onchain mint ${amt} FAILED"
        fi
        i=$((i + 1))
    done
fi

if [ "$ACTIVITY_ONCHAIN_MELTS" -gt 0 ]; then
    log "onchain melts (sat): $ACTIVITY_ONCHAIN_MELTS"
    i=0
    while [ "$i" -lt "$ACTIVITY_ONCHAIN_MELTS" ]; do
        amt=$(rand_amount)
        addr=$(wallet_bounded 20 mint "$MINT_URL" "$amt" --method onchain 2>&1 | grep -oE 'bcrt1[0-9a-z]+' | head -1 || true)
        if [ -z "$addr" ]; then
            log "  onchain melt ${amt} FAILED (no address)"
            i=$((i + 1)); continue
        fi
        if wallet_bounded 20 melt --mint-url "$MINT_URL" --method onchain --address "$addr" --amount "$amt" >/dev/null 2>&1; then
            log "  onchain melt ${amt}"
        else
            log "  onchain melt ${amt} FAILED"
        fi
        i=$((i + 1))
    done
fi

# ── SAT cap mint ─────────────────────────────────────────────────
# Ensures the most-recent mint_quotes row is SAT — LightningInfoService
# inspects the last row to decide whether to render the "Mint backend"
# sub-label. USD/EUR fake quotes above would otherwise bury the real-
# backend SAT quote. We only need the DB row, not payment: ask for a
# quote with --wait-duration=0 and force-kill cdk-cli's lingering NUT-17
# subscription via in-container `timeout -k`. A host-side `kill` of the
# `docker exec` wrapper would orphan cdk-cli — signals don't cross the
# docker exec PID-namespace boundary. Set ACTIVITY_CAP_SAT=0 to skip.
if [ "${ACTIVITY_CAP_SAT:-1}" = "1" ]; then
    # Nutshell stores created_time at second precision (no sub-second). If
    # this cap's quote lands in the same second as the final USD/EUR mint,
    # ORDER BY created_time DESC is a tied non-deterministic pick and
    # sometimes returns a fake-backend row. Sleep into the next second.
    sleep 2
    amt=$(rand_amount)
    tmp=$(mktemp)
    docker exec -i "${CONFIG_NAME}-wallet" timeout -k 1 5 \
        cdk-cli --unit sat mint "$MINT_URL" "$amt" --wait-duration=0 > "$tmp" 2>&1 || true
    if grep -q 'Please pay' "$tmp"; then
        log "[cap] sat mint ${amt}"
    else
        log "[cap] sat mint ${amt} FAILED (no invoice printed)"
        cat "$tmp" | tail -5
    fi
    rm -f "$tmp"
fi

# ── Mempool fill — varied-fee unconfirmed self-sends ──
# Broadcasts ACTIVITY_MEMPOOL_PER_RATE × 6 tiny txs at fee rates
# {1, 2, 5, 10, 25, 50} sat/vB and leaves them unconfirmed, so the UI's
# fee / mempool / block-template panels have realistic input. Requires a
# funded bitcoind default wallet — skipped when there's no mature balance.
if [ "$ACTIVITY_MEMPOOL_PER_RATE" -gt 0 ]; then
    : "${BTC_RPC_USER:?BTC_RPC_USER must be set for mempool-fill}"
    : "${BTC_RPC_PASS:?BTC_RPC_PASS must be set for mempool-fill}"
    # Ensure the default wallet has mature coins. On a fresh fake-cdk-postgres
    # stack there's no fund script, so mine enough blocks to unlock coinbase.
    balance=$(bcli getbalance '[]' 2>/dev/null || echo "0")
    # Compare as integer-truncated for portability (balance is a decimal string).
    int_balance=$(printf '%.0f' "${balance:-0}" 2>/dev/null || echo "0")
    if [ "${int_balance:-0}" -lt 1 ]; then
        log "mining 101 blocks to fund mempool-fill"
        addr=$(bcli getnewaddress)
        bcli generatetoaddress "[101, \"$addr\"]" >/dev/null
    fi

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

log "DONE — sat(mints=$ACTIVITY_MINTS_SAT swaps=$ACTIVITY_SWAPS_SAT melts=$ACTIVITY_MELTS_SAT) usd(mints=$ACTIVITY_MINTS_USD swaps=$ACTIVITY_SWAPS_USD melts=$ACTIVITY_MELTS_USD) eur(mints=$ACTIVITY_MINTS_EUR swaps=$ACTIVITY_SWAPS_EUR melts=$ACTIVITY_MELTS_EUR) bolt12(mints=$ACTIVITY_BOLT12_MINTS melts=$ACTIVITY_BOLT12_MELTS) onchain(mints=$ACTIVITY_ONCHAIN_MINTS melts=$ACTIVITY_ONCHAIN_MELTS) mempool=$((ACTIVITY_MEMPOOL_PER_RATE * 6))"
