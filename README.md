# webpack-subresource-integrity

[![npm version](npm-badge)](npm-url)
[![Build Status](tests-badge)](tests-url)
[![Coverage Status](coverage-badge)](coverage-url)
[![License](license-badge)](license-url)

If you're looking for **installation and usage instructions**, visit the [main package](https://github.com/waysact/webpack-subresource-integrity/blob/next/webpack-subresource-integrity/#readme).

Or you might be looking for the 1.x version with **support for Webpack 1-4 and older versions of html-webpack-plugin**? Visit the [1.x branch](https://github.com/waysact/webpack-subresource-integrity/tree/1.x/#readme).

If you want to hack on the package, read on -- you're in the right place.

## Installing from source

To install from source, clone this repository, cd into it and run

```
yarn
```

Note: this repository uses yarn workspaces; you _have to_ use a recent
version of Yarn, npm won't work. (This limitation does not apply to
the built package; you can install that with npm, yarn, or any other
package manager.)

## Running tests

```
yarn test
```

## Adding a new test

The easiest way to add a new test is to create an example, which is an
integration test. An example is a self-contained package in directory
`example` which follows these rules:

- When `yarn webpack` is invoked inside the package, it returns a zero
  exit code for a test pass, and a non-zero exit code for a test
  failure.
- The package _must_ have `nyc` installed for coverage reporting to
  work.
- The package _must_ specify `*` as the version for
  `webpack-subresource-integrity` so that it picks up the version from
  inside the workspace (instead of using a published version.)
- The package _should_ use `expect` for testing expectations.
- The package _should_ make sure all versions it uses for `nyc`,
  `expect`, `webpack` etc. match those used in other examples, unless
  there's a good reason to use a different version.
- If the example is an end-to-end test (runs tests in the browser) it
  should use
  [wsi-test-helper](https://github.com/waysact/webpack-subresource-integrity/blob/master/wsi-test-helper/)
  to do so. See its README for more information.

[npm-badge]: https://img.shields.io/npm/v/webpack-subresource-integrity/next.svg
[npm-url]: https://www.npmjs.com/package/webpack-subresource-integrity
[tests-badge]: https://github.com/waysact/webpack-subresource-integrity/actions/workflows/test.yml/badge.svg?branch=next
[tests-url]: https://github.com/waysact/webpack-subresource-integrity/actions
[coverage-badge]: https://coveralls.io/repos/github/waysact/webpack-subresource-integrity/badge.svg?branch=next
[coverage-url]: https://coveralls.io/github/waysact/webpack-subresource-integrity?branch=next
[license-badge]: https://img.shields.io/badge/license-MIT-blue.svg
[license-url]: https://raw.githubusercontent.com/waysact/webpack-subresource-integrity/next/LICENSE
