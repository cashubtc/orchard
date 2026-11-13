<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/orchard-github-readme-dark.svg">
    <img src="public/orchard-github-readme.svg" alt="Orchard" width="300">
  </picture>
</p>

<p align="center"><em>Your sovereign bank in cyberspace</em></p>

<p align="center"><a href="https://orchard.space"><strong>orchard.space</strong></a></p>

<p align="center">
  <a href="https://github.com/cashubtc/orchard/actions/workflows/ci.yml"><img src="https://github.com/cashubtc/orchard/actions/workflows/ci.yml/badge.svg?branch=master" alt="CI"></a>
  <a href="https://github.com/cashubtc/orchard/releases"><img src="https://img.shields.io/github/v/release/cashubtc/orchard" alt="Release"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/cashubtc/orchard" alt="License: MIT"></a>
</p>

<hr>

## Documentation

For full documentation, visit [docs.orchard.space](https://docs.orchard.space).

## Community

For help, questions, and feature ideas, open an issue:
[GitHub Issues](https://github.com/cashubtc/orchard/issues).

## Contributing

If you're interested in contributing to Orchard, please read the
[development guide](https://docs.orchard.space/development/) before submitting a pull request.

## License

Orchard is open source software [licensed as MIT](./LICENSE).

## Application assets and writable state

`ASSETS_DIR` selects the application installation containing `dist/client/browser`
and `proto`. It defaults to the working directory and may be read-only, for example
in a Nix store installation. `DATABASE_DIR` defaults to `data` relative to the
working directory and must be writable. It holds the existing database and encryption
key, generated production `config.json`, and backup/restore temporary files under
`tmp`. Startup creates the temporary directory recursively. Use absolute paths when
running from a different working directory; keep the data directory outside the
frontend asset directory.

Production startup (`npm start`) serves the generated public configuration at
`/config.json` with caching disabled; it does not expose the data directory as static
files. Development continues generating `public/config.json`.

The runtime configuration script uses Node's built-in `process.loadEnvFile` instead
of the development-only `dotenv` dependency, so it also runs after pruning development
dependencies. A missing `.env` is allowed; other read errors stop startup. Existing
environment variables take precedence. Use the supported Node 22 version specified
by `package.json` (currently `>=22.23.4 <23`); this change adds no newer requirement.
