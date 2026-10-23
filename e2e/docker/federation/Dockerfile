# syntax=docker/dockerfile:1
FROM rust:1.99.0-slim-trixie AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev protobuf-compiler clang cmake git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ARG CDK_FEDERATION_COMMIT
WORKDIR /src
# Build the pinned commit from the CDK git dir, never its working tree.
RUN --mount=type=bind,from=cdk-git,target=/cdk.git \
    if ! git -c safe.directory='*' --git-dir=/cdk.git cat-file -e "$CDK_FEDERATION_COMMIT^{commit}"; then \
        echo "CDK commit $CDK_FEDERATION_COMMIT not found; fetch it into CDK_FEDERATION_SOURCE_REPO (default ../cdk)" >&2; \
        exit 1; \
    fi \
    && git -c safe.directory='*' --git-dir=/cdk.git archive "$CDK_FEDERATION_COMMIT" | tar -x
# Avoid installing the mobile targets from CDK's toolchain file.
ENV RUSTUP_TOOLCHAIN=1.99.0
ENV CARGO_PROFILE_DEV_DEBUG=0
# git archive stamps files with the commit time, so touch them when the pin moves or cargo may reuse a stale build.
# Dependencies (BLS, FROST, AlephBFT) are optimized; CDK crates stay fast to rebuild.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/src/target \
    if [ "$(cat target/cdk-commit 2>/dev/null)" != "$CDK_FEDERATION_COMMIT" ]; then \
        find . -path ./target -prune -o -type f -exec touch {} +; \
    fi \
    && cargo build --locked -p cdk-mintd -p cdk-mint-rpc --bins --no-default-features \
      --features "cdk-mintd/management-rpc,cdk-mintd/sqlite,cdk-mintd/federation-test-utils" \
      --config 'profile.dev.package."*".opt-level=2' \
    && echo "$CDK_FEDERATION_COMMIT" >target/cdk-commit \
    && install -D target/debug/cdk-mintd /out/cdk-mintd \
    && install -D target/debug/cdk-mint-cli /out/cdk-mint-cli

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3t64 curl jq openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /out/ /usr/local/bin/
CMD ["cdk-mintd"]
