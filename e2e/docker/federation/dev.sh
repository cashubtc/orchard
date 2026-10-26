#!/bin/sh
# Entry point for this stack. It lives outside e2e/docker/configs so `e2e:* all` skips it.
set -eu
here="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
global_env="$here/../../.env"

compose() {
    # e2e/.env, when present, overrides this stack's env (e.g. CDK_FEDERATION_COMMIT).
    if [ -f "$global_env" ]; then set -- --env-file "$global_env" "$@"; fi
    docker compose --env-file "$here/env" -f "$here/compose.yml" "$@"
}

start() {
    compose up -d "$@" --wait --wait-timeout 300
}

cli() {
    member="${1:?usage: $0 cli <1|2|3> <cdk-mint-cli arguments>}"
    shift
    compose exec -T member1 sh /stack/cli.sh "$member" "$@"
}

case "${1:-}" in
    up) start --build ;;
    down) compose down -v ;;
    ps) compose ps ;;
    logs) compose logs -f ;;
    smoke)
        for member in 1 2 3; do
            echo "Member $member setup status or active federation info:"
            cli "$member" federation-setup status --json 2>/dev/null \
                || cli "$member" federation info --json
        done
        ;;
    ceremony) compose exec -T member1 sh /stack/ceremony.sh ;;
    restart)
        # Parallel compose restart can start peers while member1's netns is down.
        compose stop
        start --no-build
        ;;
    reset)
        echo "Removing only this stack's volumes, including its three Orchard accounts."
        compose down -v
        start --no-build
        ;;
    cli)
        shift
        cli "$@"
        ;;
    *)
        echo "usage: $0 <up|down|ps|logs|smoke|ceremony|restart|reset|cli>" >&2
        exit 1
        ;;
esac
