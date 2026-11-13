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

Use Node.js 24 for development (`nvm install && nvm use`). Supported versions are
`^22.23.4 || ^24.22.1 || ^26.12.1`, as specified in `package.json`. These minimums
preserve the [October 21, 2026 Node.js security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
baseline for each supported major. The range excludes older releases and other
majors rather than assuming they include the same fixes. CI tests these exact
minimum versions; Node 24 remains the development and Docker default. Operators
should use the latest patch release of their chosen supported major.

If you're interested in contributing to Orchard, please read the
[development guide](https://docs.orchard.space/development/) before submitting a pull request.

## License

Orchard is open source software [licensed as MIT](./LICENSE).
