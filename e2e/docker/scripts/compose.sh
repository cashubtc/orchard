#!/bin/sh
# Generic compose dispatcher for e2e configs.
#
# Usage:
#   ./compose.sh <action> <config-name>
#   ./compose.sh <action> all     # iterate every stack
# Actions:
#   up    — build + bring up and wait for healthy
#   down  — tear down and remove volumes
#   logs  — follow logs (not supported with 'all')
#   ps    — list service state
#   activity <start|stop|status|logs> — cadence simulator control
#
# Optional global overrides: e2e/.env (gitignored, create from e2e/.env.example).
# Loaded for host-side actions and passed to docker compose as an env file.
#
# The mainchain overlay is always included when a config ships one
# (`compose.mainchain.yml` present in the config dir). Running any
# cln-nutshell-postgres action therefore requires a prior
# `npm run e2e:bootstrap-mainchain` — see e2e/README.md §"Mainchain overlay".
set -eu

ACTION="${1:-}"
SUBACTION=""
if [ "${ACTION}" = "activity" ]; then
    SUBACTION="${2:-}"
    CONFIG="${3:-all}"
else
    CONFIG="${2:-all}"
fi

HERE="$(cd "$(dirname "$0")/.." && pwd)"
CONFIGS_DIR="${HERE}/configs"
VERSIONS_ENV="${HERE}/versions.env"
RUNTIME_DIR="${HERE}/../.runtime"
ACTIVITY_RUNNER="${HERE}/scripts/activity-cadence.sh"
GLOBAL_E2E_ENV="${HERE}/../.env"
GLOBAL_E2E_ENV_FLAG=""

list_configs() {
    (cd "$CONFIGS_DIR" && ls -1 -d */) 2>/dev/null | sed 's|/$||'
}

if [ -z "$ACTION" ]; then
    echo "usage: $0 <up|down|logs|ps> [config-name|all]  (default: all)" >&2
    echo "       $0 activity <start|stop|status|logs> [config-name|all]  (default: all)" >&2
    echo "configs:" >&2
    list_configs | sed 's|^|  |' >&2
    exit 1
fi

# Optional global e2e env: e2e/.env
# - sourced for host-side actions (activity cadence runner)
# - passed to docker compose for stack vars/default overrides
if [ -f "$GLOBAL_E2E_ENV" ]; then
    # shellcheck disable=SC1090
    set -a; . "$GLOBAL_E2E_ENV"; set +a
    GLOBAL_E2E_ENV_FLAG="--env-file $GLOBAL_E2E_ENV"
fi

# cadence runner helpers (host-level, no docker compose context needed)
pid_file() {
    config="$1"
    printf '%s/activity-%s.pid' "$RUNTIME_DIR" "$config"
}

log_file() {
    config="$1"
    printf '%s/activity-%s.log' "$RUNTIME_DIR" "$config"
}

pid_is_running() {
    pid="$1"
    kill -0 "$pid" 2>/dev/null
}

activity_start_one() {
    config="$1"
    mkdir -p "$RUNTIME_DIR"
    pidfile="$(pid_file "$config")"
    logfile="$(log_file "$config")"
    if [ -f "$pidfile" ]; then
        pid="$(cat "$pidfile" 2>/dev/null || true)"
        if [ -n "${pid:-}" ] && pid_is_running "$pid"; then
            echo "==> activity cadence already running for $config (pid $pid)"
            echo "==> logs: $logfile"
            return 0
        fi
        rm -f "$pidfile"
    fi

    if [ ! -x "$ACTIVITY_RUNNER" ]; then
        echo "activity runner is missing or not executable: $ACTIVITY_RUNNER" >&2
        return 1
    fi

    echo "==> starting activity cadence for $config"
    "$ACTIVITY_RUNNER" "$config" >>"$logfile" 2>&1 &
    pid=$!
    printf '%s' "$pid" >"$pidfile"
    sleep 0.2
    if ! pid_is_running "$pid"; then
        echo "activity cadence failed to start for $config (see $logfile)" >&2
        rm -f "$pidfile"
        return 1
    fi
    echo "==> activity cadence started for $config (pid $pid)"
    echo "==> logs: $logfile"
}

activity_stop_one() {
    config="$1"
    pidfile="$(pid_file "$config")"
    if [ ! -f "$pidfile" ]; then
        echo "==> activity cadence not running for $config"
        return 0
    fi
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -z "${pid:-}" ] || ! pid_is_running "$pid"; then
        echo "==> activity cadence not running for $config (stale pid file)"
        rm -f "$pidfile"
        return 0
    fi

    echo "==> stopping activity cadence for $config (pid $pid)"
    kill -TERM "$pid" 2>/dev/null || true
    tries=30
    while [ "$tries" -gt 0 ]; do
        if ! pid_is_running "$pid"; then
            break
        fi
        sleep 0.2
        tries=$((tries - 1))
    done
    if pid_is_running "$pid"; then
        echo "==> force-killing activity cadence for $config (pid $pid)"
        kill -KILL "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
    echo "==> activity cadence stopped for $config"
}

activity_status_one() {
    config="$1"
    pidfile="$(pid_file "$config")"
    logfile="$(log_file "$config")"
    if [ ! -f "$pidfile" ]; then
        echo "$config: stopped (no pid file)"
        return 0
    fi
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && pid_is_running "$pid"; then
        echo "$config: running (pid $pid, logs $logfile)"
    else
        echo "$config: stopped (stale pid file)"
    fi
}

activity_logs_one() {
    config="$1"
    logfile="$(log_file "$config")"
    if [ ! -f "$logfile" ]; then
        echo "log file not found for $config: $logfile" >&2
        return 1
    fi
    tail -f "$logfile"
}

if [ "$ACTION" = "activity" ]; then
    if [ -z "$SUBACTION" ]; then
        echo "usage: $0 activity <start|stop|status|logs> [config-name|all]" >&2
        exit 1
    fi
    status=0
    if [ "$CONFIG" = "all" ]; then
        for c in $(list_configs); do
            case "$SUBACTION" in
                start)  activity_start_one "$c" || status=$? ;;
                stop)   activity_stop_one "$c" || status=$? ;;
                status) activity_status_one "$c" || status=$? ;;
                logs)
                    echo "activity logs against 'all' would interleave — run against a single config" >&2
                    exit 1
                    ;;
                *)
                    echo "unknown activity subaction: $SUBACTION (valid: start, stop, status, logs)" >&2
                    exit 1
                    ;;
            esac
        done
    else
        case "$SUBACTION" in
            start)  activity_start_one "$CONFIG" || status=$? ;;
            stop)   activity_stop_one "$CONFIG" || status=$? ;;
            status) activity_status_one "$CONFIG" || status=$? ;;
            logs)   activity_logs_one "$CONFIG" || status=$? ;;
            *)
                echo "unknown activity subaction: $SUBACTION (valid: start, stop, status, logs)" >&2
                exit 1
                ;;
        esac
    fi
    exit "$status"
fi

# `all` iterates every config; overlays load automatically per config.
if [ "$CONFIG" = "all" ]; then
    if [ "$ACTION" = "logs" ]; then
        echo "logs against 'all' would interleave — run against a single config" >&2
        exit 1
    fi
    status=0
    for c in $(list_configs); do
        echo ""
        echo "=========================================="
        echo "==> $ACTION $c"
        echo "=========================================="
        # Don't abort the loop on per-config failure (especially on down).
        "$0" "$ACTION" "$c" || status=$?
    done
    exit "$status"
fi

DIR="${CONFIGS_DIR}/${CONFIG}"
COMPOSE="${DIR}/compose.yml"
ENVFILE="${DIR}/env"

if [ ! -f "$COMPOSE" ]; then
    echo "compose file not found: $COMPOSE" >&2
    exit 1
fi

if [ ! -f "$VERSIONS_ENV" ]; then
    echo "versions file not found: $VERSIONS_ENV" >&2
    exit 1
fi

# cd into the config dir so compose's relative build contexts + volume
# bind mounts resolve correctly.
cd "$DIR"

# Always include compose.mainchain.yml when the config ships one. Adds a
# host-connected mainnet bitcoind + re-points Orchard's BITCOIN_RPC_* at
# it without touching the LN/mint stack. Today only cln-nutshell-postgres
# ships an overlay.
COMPOSE_FILES="-f $COMPOSE"
UP_TIMEOUT=300
if [ -f "${DIR}/compose.mainchain.yml" ]; then
    echo "==> including compose.mainchain.yml overlay"
    COMPOSE_FILES="$COMPOSE_FILES -f ${DIR}/compose.mainchain.yml"
    # loadtxoutset + header sync from host can push setup-mainchain past
    # the default 300s window. Bump for mainchain runs only.
    UP_TIMEOUT=900
fi

# Layer versions.env first, then per-config env, then optional global e2e env.
# Later --env-file entries override earlier
# ones, so a config can pin its own tag and a user can pin per-host values.
compose() {
    # shellcheck disable=SC2086
    docker compose --env-file "$VERSIONS_ENV" --env-file "$ENVFILE" $GLOBAL_E2E_ENV_FLAG $COMPOSE_FILES "$@"
}

case "$ACTION" in
    up)
        echo "==> building + bringing up $CONFIG"
        compose up -d --build --wait --wait-timeout "$UP_TIMEOUT"
        echo "==> $CONFIG is healthy"
        compose ps
        ;;
    down)
        compose down -v
        ;;
    logs)
        compose logs -f
        ;;
    ps)
        compose ps
        ;;
    *)
        echo "unknown action: $ACTION (valid: up, down, logs, ps)" >&2
        exit 1
        ;;
esac
