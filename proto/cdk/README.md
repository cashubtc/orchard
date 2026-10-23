# CDK management RPC contract

Vendored from `crates/cdk-mint-rpc/src/proto` at CDK commit
`d02c12c0703dea29fb88f0b463910ee2040b7e01` (`federation-setup-grpc`), matching
`e2e/docker/federation/env`.

This experimental branch uses the split services; the legacy CdkMint service
and its x-cdk-protocol-version header are no longer used.

After updating these files, run `node scripts/generate-cdk-rpc-types.mjs` and
format `src/server/modules/cashu/cdk/cdkrpc.types.ts`. The generated contracts
match runtime decoding: snake_case fields, string enums, and string uint64s.
