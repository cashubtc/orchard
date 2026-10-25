# CDK management RPC contract

Vendored from `crates/cdk-mint-rpc/src/proto` at CDK commit
`e2619ed666f5ef153ac38d4fe43f0677eeb5ec25` (`federation-setup-grpc`), matching
`e2e/docker/federation/env`.

This experimental branch uses the split services; the legacy CdkMint service
and its x-cdk-protocol-version header are no longer used.

After updating these files, run `node scripts/generate-cdk-rpc-types.mjs` and
format `src/server/modules/cashu/cdk/cdkrpc.types.ts`. The generated contracts
match runtime decoding: snake_case fields, string enums, and string uint64s.

This pin encodes setup phases/roles, sync state, chain-source health and Bark
readiness as enums. It is not wire-compatible with the previous string fields.
The federation services normalize their known `*_UNSPECIFIED` values to absence
for GraphQL, while preserving other enum names. Optional enums omitted on the wire
remain omitted by the loader even with `defaults: true`.
