# Federation development stack

Three CDK members and three Orchards for a local 2-of-3 federation. Members start
in **uninitialized setup mode**, so the same fresh stack serves both the CLI
ceremony and Orchard's setup wizard. Payments use a shared fakewallet volume; there
is no Bitcoin or Lightning node. Development only: insecure local RPC and public
test credentials. Consensus and the fake payment policy need all three members online.

It lives outside `e2e/docker/configs/`, so `e2e:* all` skips it. Use `dev.sh`.

## Run

CDK is pinned by `CDK_FEDERATION_COMMIT` in `env` (override it in `e2e/.env`). The
image builds that commit from the git dir of `CDK_FEDERATION_SOURCE_REPO`, which
defaults to `../cdk` beside this checkout. Use an absolute path and a regular clone
(not a `git worktree`). Uncommitted CDK changes are never built. The first Rust build
takes several minutes.

```sh
./e2e/docker/federation/dev.sh up         # build and start, all members in setup mode
./e2e/docker/federation/dev.sh smoke      # setup status, or federation info after activation
./e2e/docker/federation/dev.sh ceremony   # create, join, approve, key generation, activate
./e2e/docker/federation/dev.sh cli 1 federation members --json
./e2e/docker/federation/dev.sh restart    # keep data, start in dependency order
./e2e/docker/federation/dev.sh reset      # wipe this stack's volumes, start fresh
./e2e/docker/federation/dev.sh ps|logs|down
```

| Member | Orchard | Public mint URL | Management RPC |
|---|---|---|---|
| 1 | http://localhost:3361 | http://localhost:3351 | http://127.0.0.1:8091 |
| 2 | http://localhost:3362 | http://localhost:3352 | http://127.0.0.1:8092 |
| 3 | http://localhost:3363 | http://localhost:3353 | http://127.0.0.1:8093 |

Orchard's setup key is `orchard-e2e-admin-key`.

## Caveats

- Every container shares member1's network namespace, because CDK only allows
  plain-HTTP federation URLs on loopback. Federation URLs use `127.0.0.1` and public
  URLs use `localhost`, since CDK requires the two to differ.
- Use `dev.sh restart`, not `docker compose restart`. A parallel restart can start
  peers while member1's namespace is down.
- The ceremony refuses an already initialized setup, and leaves the activated
  federation running. Its output stays in member1's `/tmp/ceremony` until the
  container is recreated. It checks federation startup, not paid mint, swap or melt.
- Each ceremony readiness check allows up to 300 attempts with 2 seconds between
  failures. A CLI call can take up to 120 seconds, so this is an attempt limit,
  not a ten-minute deadline.

## Browser wizard and dashboard smoke test

With Chrome installed and repository dependencies available, run from the repository root.
The wizard and its lifecycle/dashboard helpers load `proto/cdk/...` using paths relative
to the current directory.

```sh
./e2e/docker/federation/dev.sh up
./e2e/docker/federation/dev.sh reset
node e2e/docker/federation/wizard-smoke.mjs
```

This creates three disposable Orchard accounts. The first account picks Bitcoin,
configures an unavailable RPC port, tests the connection, saves anyway, reviews the
saved warning, and opens the setup-mode mint. It then removes the temporary Bitcoin
connection through Settings. The other accounts skip service configuration.
The smoke checks that home and layout skip unavailable mint APIs, and exercises
invitation replacement and independent
coordinator/member aborts before completing create, join, proposal, fingerprint review,
key generation and activation through three browser sessions. A successful run prints
exactly nine PASS lines. It checks desktop
and phone layouts and writes review screenshots to `/tmp/orchard-m3-*-review.png`.
It uses synthetic development data and tests backup acknowledgments only; it does
not perform or verify a real backup. Reset before each run. Set `CHROME_CHANNEL`
to use another installed Playwright Chromium channel.

The lifecycle checks also read raw setup status from each mint to confirm how
absent enums decode, check invitation expiry and fingerprints grouped in fours,
require checks for only the other two members on Review, and verify that a
fresh ceremony has a new setup ID. Invitations are held only by the page that
created or replaced them; the lifecycle check explicitly accepts the browser warning
before refreshing, then replaces the invitation selected by member ID. A
member who joins with a replaced invitation sees the mint's refusal. cdk then
can't report that member's setup status (it asks the coordinator, which refuses
the old invitation), so the wizard can't offer abort; the script cleans up with
AbortSetup over RPC using the known setup ID.

After activation, the script runs `dashboard-smoke.mjs` on all three members. It
checks Overview, Consensus, the empty Custody state, the backup checklist,
peer polling intervals and cancellation, and the existing mint dashboard, info,
keysets, database and analytics reads. Dashboard screenshots are written to
`/tmp/orchard-m4-desktop.png` and `/tmp/orchard-m4-mobile.png`.

The wizard uses a three-member payment observation quorum. Because this fakewallet
stack has no BDK or Bark custody, it shows the DEVELOPMENT badge and banner. Unit
fixtures cover the explicit single-observation policy, BDK-only, Bark-only and
combined custody; this stack does not exercise real BDK or Bark funds.
