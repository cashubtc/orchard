# syntax=docker/dockerfile:1
FROM rust:1-slim-trixie AS builder
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY pecan-wallet/ ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    cargo build --release --locked && cp target/release/orchard-pecan-wallet /usr/local/bin/pecan-wallet

FROM node:22-trixie-slim
COPY --from=builder /usr/local/bin/pecan-wallet /usr/local/bin/pecan-wallet
ENTRYPOINT ["sleep", "infinity"]
