# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Orchard is a web application for Cashu mint management with support for Bitcoin, Lightning (lnd, cln), Cashu mints (cdk, nutshell), Taproot Assets (tapd), and AI (ollama).

## Common Commands

```bash
# Development
npm run start:client          # Start Angular dev server with proxy
npm run start:server          # Start NestJS server with watch mode
npm run generate:types        # Generate GraphQL schema and TypeScript types

# Testing
npm run test                  # Run all tests (server + client)
npm run test:server           # Run Jest server tests only
npm run test:server:watch     # Run server tests in watch mode
npm run test:client           # Run Karma client tests (headless Chrome)

# Code Quality
npm run lint                  # Run ESLint
npm run lint:fix              # Run ESLint with auto-fix
npm run format                # Run Prettier on all source files
npm run format:check          # Check Prettier formatting

# Build
npm run build                 # Full production build (schema + codegen + nest + ng)

# Database Migrations
npm run migration:generate    # Generate new migration
npm run migration:run         # Run pending migrations
npm run migration:revert      # Revert last migration
```

## Architecture

### Monorepo Structure
- `src/client/` - Angular 20 frontend (prefix: `orc-`)
- `src/server/` - NestJS backend
- `src/shared/` - Generated GraphQL types shared between client and server

### Server (NestJS)
- Entry: `src/server/main.ts`
- Uses GraphQL with Apollo (code-first approach, auto-generates `schema.gql`)
- Database: SQLite via TypeORM with better-sqlite3
- Authentication: JWT with Passport
- Module organization: `src/server/modules/` contains domain modules (ai, api, auth, bitcoin, cashu, lightning, tapass, etc.)
- API endpoints organized by domain in `src/server/modules/api/`
- Path alias: `#server/` maps to `src/server/` (a Node subpath import, extensionless; relative imports need explicit `.js`)

### Client (Angular)
- Entry: `src/client/main.ts`
- Uses Angular Material with SCSS
- Lazy-loaded feature modules via routing
- Component change detection: OnPush (default via schematics)
- Module organization: `src/client/modules/` contains feature modules (ai, auth, bitcoin, mint, lightning, nav, settings, etc.)
- Path alias: `@client/` maps to `src/client/`
- Global styles are found in `src/client/styles`

### GraphQL Type Generation
1. Server generates `schema.gql` from NestJS resolvers
2. `graphql-codegen` generates `src/shared/generated.types.ts` from schema
3. Both client and server import types from `src/shared/`

### TypeScript Configuration
- `tsconfig.server.json` - Server compilation
- `tsconfig.client.json` - Client compilation
- `tsconfig.server.spec.json` - Server test compilation
- `tsconfig.client.spec.json` - Client test compilation

## Code Style

- Prettier: 4-space tabs, single quotes, no bracket spacing, 140 char line width
- ESLint: TypeScript with unused vars enforcement (prefix unused with `_`)
- Angular components use OnPush change detection and SCSS styling

## Angular-Specific Instructions
- Use modern signals, inputs, and outputs
- Services and dependencies are injected using `inject()` (not constructor injection)
- Always use pure CSS and modern Angular animation techniques
- When writing SCSS, always try to use the global style system designed to inherit common styles for consistency. For ex: `@extend %flex;`
