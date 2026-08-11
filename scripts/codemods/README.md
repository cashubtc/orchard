# ESM migration codemods

One-shot tools kept for rebasing a branch that predates the ESM migration. They are idempotent,
so running them on an already-migrated tree changes nothing.

Run them in this order — each one needs the previous one's output to resolve:

```bash
node scripts/codemods/esm-import-extensions.mjs   # relative imports get an explicit .js
node scripts/codemods/relativize-server-alias.mjs # @server/* becomes #server/*
node scripts/codemods/type-only-imports.mjs       # type-only imports get the `type` modifier
```

Pass `--dry` to any of them to preview. The last one reads the TypeScript checker, so it needs a
resolvable program — out of order it skips work and warns.

Delete this directory once every pre-ESM branch has merged or rebased.
