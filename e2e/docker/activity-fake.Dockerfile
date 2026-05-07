# Orchard e2e — activity-fake image (no LN node available).
#
# Provides docker-cli (for `docker exec` into the wallet), curl + jq, and
# node + bolt11 npm package for in-script bolt11 invoice generation.
# Used only by fake-cdk-postgres's `activity` service, which has no real LN
# node to ask for invoices. Stacks with a CLN/LND node (cln-nutshell-postgres)
# instead use setup.Dockerfile + the `LN_INVOICE_NODE` env var to delegate
# invoice creation to the existing node.
#
# Slim Debian base so secp256k1 prebuilt binaries resolve cleanly (alpine's
# musl libc would force a source compile).
FROM node:22-slim
ARG DOCKER_CLI_VERSION=27.5.1

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl jq ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Static docker binary — only `docker exec` is needed, not a full daemon.
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_CLI_VERSION}.tgz \
        | tar xz -C /usr/local/bin --strip-components=1 docker/docker

# Install bolt11 in a shared prefix so /scripts/gen-one-bolt11.js can require
# it without a package.json in /scripts.
RUN npm install --omit=dev --no-package-lock --prefix /opt/bolt11 bolt11@1.4.1
ENV NODE_PATH=/opt/bolt11/node_modules
