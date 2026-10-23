#!/bin/sh
# Initialize once. An existing but unreadable config must fail, not be replaced.
set -eu
if [ ! -f /data/cdk-mintd.sqlite ]; then
    umask 077
    [ -f /data/mint-seed ] || openssl rand -hex 32 | tr -d '\n' >/data/mint-seed
    sed -e "s/@MEMBER_ID@/$MEMBER_ID/g" \
        -e "s/@HTTP_PORT@/$((3350 + MEMBER_ID))/g" \
        -e "s/@RPC_PORT@/$((8090 + MEMBER_ID))/g" /stack/mintd.toml >/data/member.toml
    cdk-mintd --work-dir /data config init --new-mint --file /data/member.toml
fi
exec cdk-mintd --work-dir /data
