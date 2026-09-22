#!/bin/sh
# Initialize fresh e2e mints once; subsequent starts preserve RPC-managed settings.
set -eu

if ! cdk-mintd config show >/dev/null 2>&1; then
    cdk-mintd config init --new-mint --file /config.toml
fi

exec cdk-mintd
