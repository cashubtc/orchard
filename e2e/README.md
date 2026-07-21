# Orchard E2E Testing

End-to-end testing infrastructure. Docker-based regtest Bitcoin + Lightning stacks,
real mints, Orchard built from repo source.

See [tasks/todo.md](../tasks/todo.md) for the full rollout plan.

## Config matrix

Five configs. The first four form a diagonal across (LN × Mint × DB) that
exercises every axis exactly twice. The fifth is an LN-less multi-unit
(sat + usd) mint — cdk-mintd + fake_wallet — which exists to prove
Orchard's mint integration tolerates an absent LN backend and handles
multiple units.

| Config | Bitcoin | LN | Mint | DB | Tapd | Multi-unit |
|---|---|---|---|---|---|---|
| `lnd-nutshell-sqlite` | core | lnd | nutshell | sqlite | — | — |
| `cln-nutshell-postgres` | core | cln | nutshell | postgres | — | ✓ (sat + usd + eur) |
| `lnd-cdk-sqlite` | core | lnd | cdk | sqlite | ✓ | — |
| `cln-cdk-postgres` | core | cln | cdk | postgres | — | — |
| `fake-cdk-postgres` | — | — (fake) | cdk | postgres | — | ✓ (sat + usd) |

## Directory structure

```
e2e/
├── .env.example                     # copy to .env for global local overrides
├── docker/
│   ├── setup.Dockerfile                # shared alpine+tools image (curl/jq/xxd/docker-cli)
│   ├── activity-fake.Dockerfile        # debian+node+bolt11+docker-cli — fake-cdk-postgres only
│   ├── scripts/
│   │   ├── compose.sh                  # dispatcher: up/down/logs/ps
│   │   ├── activity-cadence.sh         # long-running cadence simulator (host-controlled)
│   │   ├── fund-lnd-topology.sh        # runs inside setup for lnd-* configs
│   │   ├── fund-cln-topology.sh        # runs inside setup for cln-* configs
│   │   ├── activity-fake.sh            # runs inside activity for fake-backed paths
│   │   └── gen-one-bolt11.js           # in-script bolt11 signer (no-LN-stack fallback)
│   └── configs/
│       ├── lnd-nutshell-sqlite/
│       │   ├── compose.yml
│       │   └── env
│       ├── lnd-cdk-sqlite/
│       │   ├── compose.yml
│       │   ├── env
│       │   └── mintd.toml              # cdk-mintd config (lnd backend)
│       ├── cln-cdk-postgres/
│       │   ├── compose.yml
│       │   ├── env
│       │   └── mintd.toml              # cdk-mintd config (cln backend + postgres)
│       ├── cln-nutshell-postgres/
│       │   ├── compose.yml
│       │   └── env
│       └── fake-cdk-postgres/
│           ├── compose.yml
│           ├── env
│           └── mintd.toml              # cdk-mintd config (fake_wallet, sat+usd)
└── README.md
```

## Topologies

**lnd configs** (`lnd-nutshell-sqlite`, `lnd-cdk-sqlite`):

```
lnd-alice ⇄ lnd-orchard ⇄ lnd-bob     (NO direct alice⇄bob — forces routing)
```

Plus tapd (if applicable), nutshell or cdk-mintd backed by `lnd-orchard`, and Orchard.

**cln configs** (`cln-cdk-*`, `cln-nutshell-*`):

```
cln-alice ⇄ cln-orchard ⇄ lnd-carol    (cross-implementation cln↔lnd)
```

Plus the mint backed by `cln-orchard` (unix socket for cdk, REST for nutshell).

`cln-nutshell-postgres` additionally wires nutshell with
`MINT_BACKEND_BOLT11_SAT=CLNRestWallet` + `MINT_BACKEND_BOLT11_USD=FakeWallet`
+ `MINT_BACKEND_BOLT11_EUR=FakeWallet` so a single mint issues three
keysets. SAT traffic exercises real LN via clnrest; USD/EUR exercise the
fake code paths (quotes auto-confirm) so Orchard's multi-unit UI surfaces
have something to read.

**fake config** (`fake-cdk-postgres`):

No LN nodes, no bitcoind. cdk-mintd runs `fake_wallet` with
`supported_units = ["sat", "usd"]`; Orchard boots without `LIGHTNING_TYPE`
and without `BITCOIN_TYPE`. Its job is to exercise Orchard's UI when both
optional services are absent.

## Running

Global operator overrides live in `e2e/.env` (gitignored; create from
`e2e/.env.example`). `compose.sh` and `bootstrap-mainchain.sh` auto-load it.
Use it for cadence knobs, host CLI paths, and future cross-stack e2e settings.

```bash
# single stack (blocks until healthy)
npm run e2e:up lnd-nutshell-sqlite
npm run e2e:up cln-cdk-sqlite
npm run e2e:up fake-cdk-postgres
npm run e2e:up cln-nutshell-postgres   # requires prior e2e:bootstrap-mainchain

# the whole matrix (every stack, mainchain overlay included)
npm run e2e:up all

# test runner
npm run e2e:test                                          # full suite
npm run e2e:test -- --project=cln-nutshell-postgres:3325  # filter

# watch logs (single stack only — 'all' would interleave)
npm run e2e:logs cln-cdk-sqlite

# inspect
npm run e2e:ps cln-cdk-sqlite
npm run e2e:ps all

# cadence simulator (start/stop on demand)
npm run e2e:activity:start cln-cdk-postgres
npm run e2e:activity:status cln-cdk-postgres
npm run e2e:activity:logs cln-cdk-postgres
npm run e2e:activity:stop cln-cdk-postgres

# tear down (removes all named volumes for that stack)
npm run e2e:down cln-cdk-sqlite
npm run e2e:down all         # wipe everything including mainchain-data
```

## Cadence activity simulator

The cadence simulator is a host-side long-running loop that replays stack
activity and injects unhappy/disruptive paths on a schedule. It is intended for
"turn all stones" activity runs where you want sustained traffic and fault
injection while Playwright specs run.

### Control surface

- `npm run e2e:activity:start <config>` starts one background runner per stack and writes state to `e2e/.runtime/`.
- `npm run e2e:activity:stop <config>` stops the runner gracefully (idempotent; safe to call repeatedly).
- `npm run e2e:activity:status <config>` reports running/stopped plus PID/log path.
- `npm run e2e:activity:logs <config>` tails that stack's cadence log.
- `all` is supported for `start|stop|status`:
  - `npm run e2e:activity:start all`
  - `npm run e2e:activity:stop all`
  - `npm run e2e:activity:status all`

### Behavior

Each cadence cycle performs:

1. **Happy path replay**: reruns stack-native `activity` containers (and
   `activity-fake` on `cln-nutshell-postgres`) so LN + mint + bitcoin traffic
   remains fresh.
2. **Unhappy path injection**: deterministic injections for unpaid mint quotes,
   failed melt quotes, and failed LN payments (where LN exists).
3. **Disruptive fault injection (default on)**: pause/unpause mint + LN
   containers, then require health recovery before continuing.

If recovery fails inside timeout, the cadence runner aborts with actionable log
output rather than silently hanging.

### Tunables

Set these in `e2e/.env` (or export before `e2e:activity:start`):

- `ACTIVITY_INTERVAL_SECONDS` (default `90`) - base delay between cycles
- `ACTIVITY_JITTER_SECONDS` (default `15`) - randomized plus/minus jitter
- `ACTIVITY_DISRUPT_SECONDS` (default `4`) - duration for pause windows
- `ACTIVITY_DISRUPT_EVERY` (default `1`) - run disruption every N cycles
- `ACTIVITY_RECOVERY_TIMEOUT` (default `60`) - health wait ceiling per service
- `ACTIVITY_SEED` (optional) - deterministic RNG seed for reproducible cycle timing

### Stack scenario matrix

- `lnd-nutshell-sqlite`, `lnd-cdk-sqlite`
  - replay `activity`, inject failed LN pay from LND, unpaid mint + failed melt quote
  - disrupt nutshell/cdk mint + `lnd-orchard`
- `cln-cdk-postgres`
  - replay `activity` (including bolt12 categories if enabled by stack env)
  - inject failed LN pay from CLN, unpaid mint + failed melt quote
  - disrupt cdk mint + `cln-orchard`
- `cln-nutshell-postgres`
  - replay both `activity` and `activity-fake` (sat via real LN + usd/eur fake paths)
  - inject failed LN pay from CLN, unpaid mint + failed melt quote
  - disrupt nutshell mint + `cln-orchard`
- `fake-cdk-postgres`
  - replay `activity` for no-LN fake mint paths
  - inject unpaid mint + failed melt quote
  - disrupt cdk mint only (no LN container)

## Writing specs — tag conventions

Every test under `e2e/specs/` must carry at least one tag declaring which
stacks it's meaningful for. Each real project's `grep` is computed from its
`ConfigInfo` — a test runs on a stack only if one of its tags is in the
stack's grep set.

| Tag | Meaning | Where it runs |
|---|---|---|
| `@canary` | config-agnostic feature | `lnd-nutshell-sqlite` only |
| `@lightning` | Orchard has `LIGHTNING_TYPE` configured (app-state) | every stack with `config.ln !== false` |
| `@no-lightning` | Orchard boots without `LIGHTNING_TYPE` (app-state) | `fake-cdk-postgres` only |
| `@no-bitcoin` | Orchard boots without `BITCOIN_TYPE` (app-state) | `fake-cdk-postgres` only |
| `@lnd` / `@cln` | LN impl-name tags (stack identity) | stacks with matching `config.ln` |
| `@cdk` / `@nutshell` | mint-impl-sensitive | stacks with matching mint |
| `@sqlite` / `@postgres` | DB-sensitive | stacks with matching DB |
| `@tapd` | requires Taproot Assets | `lnd-cdk-sqlite` only |
| `@mainchain` | Orchard wired to a real mainnet bitcoind | `cln-nutshell-postgres` (overlay always loaded — see [Mainchain overlay](#mainchain-overlay)) |
| `@mint-metrics` | stack env sets `MINT_METRICS_API` to the cdk-mintd prometheus exporter (config-state) | `lnd-cdk-sqlite` only |
| `@all` | genuine matrix coverage | all five stacks |

**Prefer app-state tags (`@lightning` / `@no-lightning`) over impl-name
tags (`@lnd` / `@cln`)** — they describe the Orchard configuration the spec
cares about, not the docker backend. `@lightning` vs `@no-lightning`
captures "is there a lightning node wired in at all?", which is a real
operator deployment decision and a valid app state to test on both sides.
Reserve `@lnd` / `@cln` for specs that assert impl-specific behavior
(e.g. LND's `uris[]` field, CLN-specific quirks).

Apply tags at the `describe` level when every test in a file shares scope:

```ts
test.describe('feature name', {tag: '@canary'}, () => {
    test('...', async ({page}) => { ... });
});
```

Or per-test for mixed scopes:

```ts
test('tapd-specific flow', {tag: '@tapd'}, async ({page}) => { ... });
test('general feature', {tag: '@canary'}, async ({page}) => { ... });
```

**Gotcha:** untagged tests match no project's grep → they silently don't
run. A new spec that "passes" with zero tests executed probably just needs
a tag annotation.

Setup projects (`e2e/setup/*.setup.ts`) have no grep and run regardless —
auth bootstrapping always happens.

## Ports exposed to the host

### lnd-nutshell-sqlite

| Service      | Host port | Purpose              |
|--------------|-----------|----------------------|
| bitcoind RPC | 18443     | chain manipulation   |
| lnd-orchard  | 10009     | gRPC                 |
| lnd-alice    | 10019     | gRPC                 |
| lnd-bob      | 10029     | gRPC                 |
| nutshell     | 3338      | mint HTTP API        |
| orchard      | 3322      | Orchard GraphQL + UI |

### lnd-cdk-sqlite (+ tapd)

| Service      | Host port  | Purpose                    |
|--------------|------------|----------------------------|
| bitcoind RPC | 18543      | chain manipulation         |
| lnd-orchard  | 10109      | gRPC                       |
| lnd-alice    | 10119      | gRPC                       |
| lnd-bob      | 10129      | gRPC                       |
| tapd-orchard | 10139      | gRPC                       |
| tapd-alice   | 10149      | gRPC                       |
| cdk-mintd    | 3349/8096  | mint HTTP / management RPC |
| orchard      | 3324       | Orchard GraphQL + UI       |

### cln-cdk-postgres

| Service      | Host port  | Purpose                    |
|--------------|------------|----------------------------|
| bitcoind RPC | 28443      | chain manipulation         |
| cln-orchard  | 21001      | gRPC                       |
| cln-alice    | 21011      | gRPC                       |
| lnd-carol    | 20029      | gRPC                       |
| postgres     | 5532       | shared DB                  |
| cdk-mintd    | 3339/8086  | mint HTTP / management RPC |
| orchard      | 3323       | Orchard GraphQL + UI       |

### cln-nutshell-postgres

| Service      | Host port  | Purpose                    |
|--------------|------------|----------------------------|
| bitcoind RPC | 28543      | chain manipulation         |
| cln-orchard  | 21101      | gRPC (+ clnrest on 3010 internal) |
| cln-alice    | 21111      | gRPC                       |
| lnd-carol    | 20129      | gRPC                       |
| postgres     | 5632       | shared DB                  |
| nutshell     | 3340       | mint HTTP API              |
| orchard      | 3325       | Orchard GraphQL + UI       |

### fake-cdk-postgres

| Service      | Host port  | Purpose                    |
|--------------|------------|----------------------------|
| postgres     | 5732       | shared DB                  |
| cdk-mintd    | 3341/8087  | mint HTTP / management RPC |
| orchard      | 3326       | Orchard GraphQL + UI       |

No bitcoind — Orchard boots without `BITCOIN_TYPE` to exercise its
no-bitcoin code path.

All five configs have disjoint port ranges and can run concurrently. Pair-2 / cln
configs sit in the 20k/28k/55xx range to avoid collisions with Polar Lightning
(desktop app) which occupies 18443–18453 / 10000–13999 / 11000–11099.
`fake-cdk-postgres` uses a 38443 / 57xx / 3326 / 8087 slice for the same reason.
Client dev-server previews (`.claude/launch.json`) sit on 3327–3331, one per
docker stack.

## What the setup service does

Per-config `setup` compose service runs once, funds wallets, opens channel
topology, then exits.

- **lnd configs**: [fund-lnd-topology.sh](docker/scripts/fund-lnd-topology.sh)
  opens `alice → orchard` and `orchard → bob` channels.
- **cln configs**: [fund-cln-topology.sh](docker/scripts/fund-cln-topology.sh)
  opens `alice → orchard` and `orchard → carol` channels. Drives CLN via
  `docker exec` + `lightning-cli`. Notes:
    - funds Taproot addresses explicitly because CLN 25.12 signs with BIP86 keys
    - when `CREATE_RUNE_FOR=<node>` is set, mints a clnrest rune after channels
      open and writes it to `/shared/<node>.rune` for mint containers to read
      (used by `cln-nutshell-postgres` which authenticates nutshell → clnrest
      with a rune)
- **fake-cdk-postgres**: no `setup` service (no channels to fund). The
  activity container runs [activity-fake.sh](docker/scripts/activity-fake.sh)
  which drives `cdk-cli --unit sat|usd` through mint/swap/melt. Melts call
  [gen-one-bolt11.js](docker/scripts/gen-one-bolt11.js) per-iteration to
  self-sign a fresh regtest bolt11 (random privkey + payment_hash per call,
  so the mint never sees a duplicate). Container is built from
  [activity-fake.Dockerfile](docker/activity-fake.Dockerfile) which bundles
  node + the `bolt11` npm package alongside docker-cli.
  `ACTIVITY_MEMPOOL_PER_RATE` is pinned to 0 because there's no bitcoind
  to broadcast into.
- **cln-nutshell-postgres** (multi-unit): runs the normal cln `setup` +
  `activity` (SAT via real LN) alongside an extra `activity-fake` service.
  The second container exercises nutshell's USD + EUR keysets through their
  FakeWallet backends; melt invoices come from `cln-alice` via the
  `LN_INVOICE_NODE` env var, so each call gets a fresh payment hash. Sat
  counts on `activity-fake` are pinned to 0 to avoid double-dipping with
  the LN activity container.

Downstream services (mint, orchard) depend on setup via
`service_completed_successfully`.

## Mainchain overlay

One stack (`cln-nutshell-postgres`) ships an overlay that adds a
pruned, host-peered mainnet bitcoind and re-points **Orchard's**
`BITCOIN_RPC_*` at it. The LN/mint backend stays on regtest (cln-orchard,
cln-alice, lnd-carol, nutshell all keep talking to the stack's regtest
bitcoind). The overlay is always loaded when bringing this stack up,
and unlocks `@mainchain`-tagged specs — utxoracle, mempool, block-tip,
chain-sync.

Use `e2e/.env` for shared host/mainchain defaults (gitignored; create from
`e2e/.env.example`).

```sh
# e2e/.env (global)
BITCOIN_CLI=/usr/local/bin/bitcoin-cli
# BITCOIN_CLI_ARGS='-rpcuser=you -rpcpassword=secret'  # if you use rpcauth
# HOST_BITCOIN_P2P_PORT=8333                            # override if non-default
```

Bootstrap sources this with `.`, so `~` and `$HOME` expand normally.
Compose consumes it via `--env-file` for `HOST_BITCOIN_P2P_PORT`
substitution into the bitcoind command.

**One-time snapshot dump:**

```bash
# Blocks your host bitcoind ~15-25 min — rewinds to the most recent
# AssumeUTXO-eligible height (v30: 910000), dumps, then rebuilds to tip.
npm run e2e:bootstrap-mainchain
# Writes e2e/.mainchain/utxos.dat (gitignored).
# Pass `-- --force` to regenerate an existing snapshot.
```

Rolling back is mandatory: Bitcoin Core only accepts snapshots whose
base hash is in its hardcoded AssumeUTXO allowlist. `dumptxoutset latest`
produces a snapshot that's always rejected; we use `rollback` mode
instead — see [bootstrap-mainchain.sh](docker/scripts/bootstrap-mainchain.sh).

**Bring the stack(s) up:**

```bash
# full matrix (mainchain overlay on cln-nutshell-postgres included)
npm run e2e:up all

# or just the mainchain stack on its own
npm run e2e:up cln-nutshell-postgres
```

The overlay adds `bitcoind-mainchain` (pruned, `-connect=host.docker.internal:8333`)
and a one-shot `setup-mainchain` that runs `loadtxoutset` once headers
catch up from your host peer. First bring-up takes a few minutes;
subsequent bring-ups are seconds because the persistent `mainchain-data`
volume carries the loaded chainstate.

**Run `@mainchain` specs:**

```bash
# full suite
npm run e2e:test

# just the mainchain stack
npm run e2e:test -- --project=cln-nutshell-postgres:3325
```

**Host requirements:**

- bitcoind 26+ running on the same machine (we pin v30 in
  `versions.env`; your host major should match so LevelDB loads).
- P2P port 8333 accessible from Docker (default binding is fine on
  Docker Desktop — `host.docker.internal` resolves to the host gateway).
- No `rpcallowip` change needed — the container talks to your host over
  P2P, not RPC.

**Teardown:** `npm run e2e:down cln-nutshell-postgres` (or `e2e:down all`)
wipes every named volume for the stack, including `mainchain-data` — the
overlay is always loaded so compose always sees and removes it. Plan to
re-run `npm run e2e:bootstrap-mainchain` before the next bring-up.

## Regenerating credentials

Every `e2e:down <config>` wipes named volumes — certs, macaroons, wallets,
runes, channel state are all regenerated on the next `e2e:up`. No committed
credential fixtures. (Exception: the `mainchain-data` volume above, only
relevant to the mainchain overlay.)

## Troubleshooting

- **Build takes forever first run**: builds Orchard + setup image from source.
  Subsequent runs hit Docker's layer cache.
- **Setup service exits non-zero**: `docker logs <config>-setup` shows the
  funding script's last action. Common causes: LN not fully synced, funding
  race, gossip propagation slow.
- **Port collision**: `lsof -iTCP:<port> -sTCP:LISTEN` finds the holder. If
  it's Polar Lightning's desktop app, its ports sit in the 18443–18453 and
  10000–13999 ranges.
