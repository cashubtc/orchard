#!/bin/sh
# Run cdk-mint-cli against member $1's management RPC.
set -eu
member="$1"
shift
exec cdk-mint-cli --addr "http://127.0.0.1:$((8090 + member))" "$@"
