#!/bin/sh
# Setup has no public mint API. Activation replaces the setup RPC in-process.
set -eu
sh /stack/cli.sh "$MEMBER_ID" federation-setup status --json >/dev/null 2>&1 \
    || sh /stack/cli.sh "$MEMBER_ID" federation info --json >/dev/null
