#!/bin/sh
# Orchard e2e cadence activity runner.
#
# Host-side long-running simulator that repeatedly:
#   1) replays happy-path activity containers
#   2) injects deterministic unhappy-path operations
#   3) injects disruptive faults (pause/unpause) and verifies recovery
#
# Usage:
#   ./activity-cadence.sh <config-name>
#
# Tunables (env):
#   ACTIVITY_INTERVAL_SECONDS   default 90
#   ACTIVITY_JITTER_SECONDS     default 15
#   ACTIVITY_DISRUPT_SECONDS    default 4
#   ACTIVITY_DISRUPT_EVERY      default 1   (every N cycles)
#   ACTIVITY_RECOVERY_TIMEOUT   default 60
#   ACTIVITY_SEED               optional deterministic RNG seed

set -eu

CONFIG_NAME="${1:-}"
if [ -z "$CONFIG_NAME" ]; then
    echo "usage: $0 <config-name>" >&2
    exit 1
fi

ACTIVITY_INTERVAL_SECONDS="${ACTIVITY_INTERVAL_SECONDS:-90}"
ACTIVITY_JITTER_SECONDS="${ACTIVITY_JITTER_SECONDS:-15}"
ACTIVITY_DISRUPT_SECONDS="${ACTIVITY_DISRUPT_SECONDS:-4}"
ACTIVITY_DISRUPT_EVERY="${ACTIVITY_DISRUPT_EVERY:-1}"
ACTIVITY_RECOVERY_TIMEOUT="${ACTIVITY_RECOVERY_TIMEOUT:-60}"

if [ "${ACTIVITY_SEED:-}" = "" ]; then
    RNG_STATE=$(date +%s)
else
    RNG_STATE="$ACTIVITY_SEED"
fi

RUN_LOOP=1

log() {
    printf '[activity-cadence:%s] %s\n' "$CONFIG_NAME" "$*"
}

on_signal() {
    RUN_LOOP=0
    log "received stop signal"
}

trap on_signal INT TERM

next_rand() {
    RNG_STATE=$(( (RNG_STATE * 1103515245 + 12345) % 2147483647 ))
    printf '%s' "$RNG_STATE"
}

rand_between() {
    max_exclusive="$1"
    if [ "$max_exclusive" -le 1 ]; then
        printf '0'
        return
    fi
    n="$(next_rand)"
    printf '%s' $((n % max_exclusive))
}

safe_sleep() {
    total="$1"
    slept=0
    while [ "$slept" -lt "$total" ]; do
        if [ "$RUN_LOOP" -eq 0 ]; then
            return 0
        fi
        sleep 1
        slept=$((slept + 1))
    done
}

container_exists() {
    container="$1"
    docker inspect "$container" >/dev/null 2>&1
}

container_running() {
    container="$1"
    [ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || echo false)" = "true" ]
}

container_healthish() {
    container="$1"
    docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{if .State.Running}}running{{else}}exited{{end}}{{end}}' "$container" 2>/dev/null || echo exited
}

wait_for_container_healthy() {
    container="$1"
    timeout="$2"
    elapsed=0
    while [ "$elapsed" -lt "$timeout" ]; do
        status="$(container_healthish "$container")"
        if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done
    return 1
}

start_and_wait_activity() {
    container="$1"
    if ! container_exists "$container"; then
        log "phase=happy container=$container missing (run npm run e2e:up $CONFIG_NAME first)"
        return 1
    fi
    if container_running "$container"; then
        log "phase=happy container=$container already running; waiting for completion"
    else
        docker start "$container" >/dev/null 2>&1 || {
            log "phase=happy container=$container failed_to_start"
            return 1
        }
    fi
    exit_code="$(docker wait "$container" 2>/dev/null || echo 1)"
    log "phase=happy container=$container exit_code=$exit_code"
    [ "$exit_code" = "0" ]
}

inject_unpaid_mint_quote() {
    if ! container_exists "$WALLET_CONTAINER"; then
        log "phase=unhappy unpaid_mint_quote skipped wallet_missing"
        return 0
    fi
    if docker exec -i "$WALLET_CONTAINER" sh -c '
set -eu
tmp="$(mktemp)"
cdk-cli mint "$MINT_URL" 111 >"$tmp" 2>&1 &
pid=$!
tries=24
found=0
while [ "$tries" -gt 0 ]; do
    invoice="$(grep -oE "lnbcrt[0-9a-z]+" "$tmp" 2>/dev/null | head -1 || true)"
    if [ -n "$invoice" ]; then
        found=1
        break
    fi
    sleep 0.25
    tries=$((tries - 1))
done
kill "$pid" 2>/dev/null || true
wait "$pid" 2>/dev/null || true
rm -f "$tmp"
[ "$found" -eq 1 ]
'; then
        log "phase=unhappy op=unpaid_mint_quote result=ok"
    else
        log "phase=unhappy op=unpaid_mint_quote result=failed"
    fi
}

inject_failed_melt_quote() {
    if ! container_exists "$WALLET_CONTAINER"; then
        log "phase=unhappy failed_melt_quote skipped wallet_missing"
        return 0
    fi
    if docker exec -i "$WALLET_CONTAINER" sh -c 'set -eu; cdk-cli melt --mint-url "$MINT_URL" --invoice "lnbcrt1invalid" >/dev/null 2>&1'; then
        log "phase=unhappy op=failed_melt_quote result=unexpected_success"
        return 1
    fi
    log "phase=unhappy op=failed_melt_quote result=expected_failure"
    return 0
}

inject_failed_ln_payment() {
    case "$LN_MODE" in
        lnd)
            if docker exec "$LN_FAIL_CONTAINER" sh -c 'lncli --lnddir=/home/lnd/.lnd --network=regtest payinvoice --force lnbcrt1invalid >/dev/null 2>&1'; then
                log "phase=unhappy op=failed_ln_payment result=unexpected_success"
                return 1
            fi
            ;;
        cln)
            if docker exec "$LN_FAIL_CONTAINER" lightning-cli --lightning-dir=/home/clightning/.lightning --network=regtest pay lnbcrt1invalid >/dev/null 2>&1; then
                log "phase=unhappy op=failed_ln_payment result=unexpected_success"
                return 1
            fi
            ;;
        none)
            log "phase=unhappy op=failed_ln_payment skipped no_lightning"
            return 0
            ;;
    esac
    log "phase=unhappy op=failed_ln_payment result=expected_failure"
    return 0
}

with_pause_window() {
    container="$1"
    if ! container_exists "$container"; then
        log "phase=disruption container=$container skipped_missing"
        return 0
    fi
    if ! container_running "$container"; then
        log "phase=disruption container=$container skipped_not_running"
        return 0
    fi
    log "phase=disruption container=$container action=pause duration=${ACTIVITY_DISRUPT_SECONDS}s"
    docker pause "$container" >/dev/null
    safe_sleep "$ACTIVITY_DISRUPT_SECONDS"
    docker unpause "$container" >/dev/null
    log "phase=disruption container=$container action=unpause"
}

run_disruption_cycle() {
    with_pause_window "$MINT_CONTAINER"
    if [ "$LN_MODE" != "none" ]; then
        with_pause_window "$LN_HEALTH_CONTAINER"
    fi
}

wait_for_recovery() {
    if ! wait_for_container_healthy "$ORCHARD_CONTAINER" "$ACTIVITY_RECOVERY_TIMEOUT"; then
        log "phase=recovery container=$ORCHARD_CONTAINER result=timeout"
        return 1
    fi
    if ! wait_for_container_healthy "$MINT_CONTAINER" "$ACTIVITY_RECOVERY_TIMEOUT"; then
        log "phase=recovery container=$MINT_CONTAINER result=timeout"
        return 1
    fi
    if [ "$LN_MODE" != "none" ]; then
        if ! wait_for_container_healthy "$LN_HEALTH_CONTAINER" "$ACTIVITY_RECOVERY_TIMEOUT"; then
            log "phase=recovery container=$LN_HEALTH_CONTAINER result=timeout"
            return 1
        fi
    fi
    log "phase=recovery result=ok"
    return 0
}

compute_sleep_seconds() {
    jitter="$ACTIVITY_JITTER_SECONDS"
    base="$ACTIVITY_INTERVAL_SECONDS"
    if [ "$jitter" -le 0 ]; then
        printf '%s' "$base"
        return
    fi
    span=$((jitter * 2 + 1))
    delta="$(rand_between "$span")"
    delta=$((delta - jitter))
    sleep_for=$((base + delta))
    if [ "$sleep_for" -lt 1 ]; then
        sleep_for=1
    fi
    printf '%s' "$sleep_for"
}

init_scenario() {
    ACTIVITY_CONTAINERS="${CONFIG_NAME}-activity"
    case "$CONFIG_NAME" in
        lnd-nutshell-sqlite|lnd-cdk-sqlite)
            LN_MODE="lnd"
            ORCHARD_CONTAINER="${CONFIG_NAME}-orchard"
            MINT_CONTAINER="${CONFIG_NAME}-$( [ "$CONFIG_NAME" = "lnd-cdk-sqlite" ] && printf 'cdk-mintd' || printf 'nutshell' )"
            WALLET_CONTAINER="${CONFIG_NAME}-wallet"
            LN_FAIL_CONTAINER="${CONFIG_NAME}-lnd-bob"
            LN_HEALTH_CONTAINER="${CONFIG_NAME}-lnd-orchard"
            ;;
        cln-cdk-postgres)
            LN_MODE="cln"
            ORCHARD_CONTAINER="${CONFIG_NAME}-orchard"
            MINT_CONTAINER="${CONFIG_NAME}-cdk-mintd"
            WALLET_CONTAINER="${CONFIG_NAME}-wallet"
            LN_FAIL_CONTAINER="${CONFIG_NAME}-cln-orchard"
            LN_HEALTH_CONTAINER="${CONFIG_NAME}-cln-orchard"
            ;;
        cln-nutshell-postgres)
            LN_MODE="cln"
            ORCHARD_CONTAINER="${CONFIG_NAME}-orchard"
            MINT_CONTAINER="${CONFIG_NAME}-nutshell"
            WALLET_CONTAINER="${CONFIG_NAME}-wallet"
            LN_FAIL_CONTAINER="${CONFIG_NAME}-cln-orchard"
            LN_HEALTH_CONTAINER="${CONFIG_NAME}-cln-orchard"
            ACTIVITY_CONTAINERS="${CONFIG_NAME}-activity ${CONFIG_NAME}-activity-fake"
            ;;
        fake-cdk-postgres)
            LN_MODE="none"
            ORCHARD_CONTAINER="${CONFIG_NAME}-orchard"
            MINT_CONTAINER="${CONFIG_NAME}-cdk-mintd"
            WALLET_CONTAINER="${CONFIG_NAME}-wallet"
            LN_FAIL_CONTAINER=""
            LN_HEALTH_CONTAINER=""
            ;;
        *)
            echo "unknown config: $CONFIG_NAME" >&2
            exit 1
            ;;
    esac
}

init_scenario
log "starting cadence interval=${ACTIVITY_INTERVAL_SECONDS}s jitter=${ACTIVITY_JITTER_SECONDS}s seed=${RNG_STATE} disrupt_every=${ACTIVITY_DISRUPT_EVERY}"

if ! container_exists "$ORCHARD_CONTAINER"; then
    log "orchard container missing: $ORCHARD_CONTAINER"
    log "start stack first: npm run e2e:up $CONFIG_NAME"
    exit 1
fi

cycle=0
while [ "$RUN_LOOP" -eq 1 ]; do
    cycle=$((cycle + 1))
    log "cycle=$cycle phase=start"

    for activity_container in $ACTIVITY_CONTAINERS; do
        start_and_wait_activity "$activity_container" || true
    done

    inject_unpaid_mint_quote || true
    inject_failed_melt_quote || true
    inject_failed_ln_payment || true

    if [ "$ACTIVITY_DISRUPT_EVERY" -gt 0 ] && [ $((cycle % ACTIVITY_DISRUPT_EVERY)) -eq 0 ]; then
        run_disruption_cycle || true
        wait_for_recovery || {
            log "cycle=$cycle phase=recovery result=failed_abort"
            exit 1
        }
    fi

    sleep_for="$(compute_sleep_seconds)"
    log "cycle=$cycle phase=complete sleep_seconds=$sleep_for"
    safe_sleep "$sleep_for"
done

log "stopped"
