<h1 align="center">Orchard</h1>

<p align="center">
  <br>
  <img src="src/client/assets/img/orchard-logo.svg" alt="orchard-logo" width="150px"/>
  <br>
  <br>
  <em>Your sovereign bank in cyberspace</em>
  <p align="center">
    <img src="public/orchard-readme.jpg" alt="Orchard screenshot" style="max-width: 100%; height: auto;" />
  </p>
  <br>
</p>

<hr>

# Implementation support

| Protocol       | Implementation                     | Version                    |
| -------------- | ---------------------------------- | -------------------------- |
| Bitcoin        | core (knots compatible)            | (^Satoshi:28.0.0)          |
| Lightning      | lnd, cln                           | (^v0.20.0-beta), (^v25.12) |
| Cashu Mint     | cdk, nutshell                      | (^v0.16.0), (^0.20.0)      |
| Taproot Assets | tapd                               | (^v0.7.0-alpha)            |
| AI             | ollama                             | (^0.23.2)                  |

<br>
<br>

# Setup

## Prerequisites

- Install [Node.js] which includes [Node Package Manager][npm]
  - Recommended version (v22)

## Versioning
Always check out the latest release tag before installing or updating. Running from `master` is unsupported and may leave your database in a state that cannot be cleanly upgraded.
```bash
git fetch --tags
git checkout v1.8.4
```

## Environment Variables
```bash
cp .env.example .env
# edit .env file
nano .env
```

## Configuration Options
|           | Orchard | Bitcoin | Lightning  | Taproot Assets | Cashu Mint | AI |
| --------- | ------- | ------- | ---------- | -------------- | ---------- | -- |
| Required  | ✅      |         |            |                |            |     |
| Optional  |         | ✅      | ✅          | ✅             | ✅         | ✅  |

<br>
<br>

# Production Setup

## Run the application (standard)
```bash
npm install
npm run build
npm run start
```

## Updating
```bash
git pull
npm install
npm run build
npm run start
```

## Run the application (docker)

Configure access to your mints database in `.env`:

```bash
# Postgres
MINT_DATABASE=postgres://user:pass@host:5432/db

# SQLite
MINT_DATANAME=mint.sqlite3
MINT_DATADIR=/path/to/mint-dir
```

**Note:** The nutshell mint rpc can be run in insecure mode, omitting the need for certs.<br>
To allow this in a docker container set `MINT_RPC_MTLS=false` in .env

### From source

```bash
docker compose build
docker compose up -d
```

### From registry image

```bash
docker compose -f docker-compose.yml -f compose.image.yml up -d
```

Pin a version with `VERSION=1.2.3` in `.env` or inline (defaults to `latest`).

<br>
<br>

# Development Setup

## Run the application

### Package Management 
```bash
npm install
```

### Client
```bash
npm run start:client
```

### Server
```bash
npm run start:server
```

### Tests
```bash
npm run format
npm run lint
npm run test
```