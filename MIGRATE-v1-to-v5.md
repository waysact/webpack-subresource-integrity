# Migrate from version 1.x to version 5.x

## tl;dr

### New import syntax

Replace this:

```js
var SriPlugin = require('webpack-subresource-integrity');
```

... with this:

```js
import { SubresourceIntegrityPlugin } from 'webpack-subresource-integrity';
// or: const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
```

### New usage, suggested defaults (recommended)

We strongly recommend that you use this plugin with default values:

Replace this:

```js
    new SriPlugin({
      hashFuncNames: [ /* ... */ ],
      enabled: process.env.NODE_ENV === 'production',
    })
```

... with this:

```js
    new SubresourceIntegrityPlugin()
```

Then, review the documentation for all plugin options and decide
whether you want to change any from the default settings.

## What happened to v2, v3, v4?

We've decided to skip these versions and go straight from major
version 1 to 5.  The new version number reflects the fact that this
version is compatible (only) with Webpack 5 and html-webpack-plugin 5.
We intend to keep the versioning scheme in lockstep with these
packages.

## Notable changes between v1 to v5

Version 5 constitutes a major rewrite of version 1, but it should
behave identically for most purposes: all applicable tests from v1
still pass.  There have been a number of notable changes, however,
that you should be aware of:

### Default hash function: (only) SHA-384

In the past, we've shied away from recommending any specific hash
functions to use.  However, our README _did_, by way of example,
suggest to use `["sha256", "sha384"]`. This was really only ever
meant as an example, in particular the only reason that it lists _two_
functions instead of one was to demonstrate that doing so is
possible.

Years later and it turns out that most deployments of this plugin
ended up simply copying that example without changing it, meaning that
we _did_ end up making a _de facto_ recommendation, just not a very
good one.

We've decided that _if_ we are going to recommend any hash functions,
it should be to use only `sha384`. See the README for a discussion of
why we've chosen this default and when you might want to choose a
different setting.

### Default enabled in production, disabled in development

Version 1.x is disabled by default and has to be enabled explicitly in
production only -- enabling SRI in development mode is discouraged as
it usually doesn't bring any benefits and can interfere with hot
reloading.

Requiring users to handle enabling and disabling the plugin themselves
is verbose and can lead to mistakes: the plugin might be disabled in
production by accident, or enabled in development mode.

Version 5.x simplifies things by making the default so that the plugin
is disabled when the [Webpack
mode](https://webpack.js.org/configuration/mode/) is `development` and
enabling it otherwise (when it is `production` or `none`.)

This should make things work as expected for 99% of users. You're free
to override the `enabled` setting if this default doesn't suit your
needs.

### Named export `SubresourceIntegrityPlugin`

Version 1.x uses a default export and, again by way of the README
example, suggests to use `SriPlugin` as a name.  For version 5 we've
decided to use an export named `SubresourceIntegrityPlugin` instead,
for the following reasons:

- The named export ensures that everyone uses this name, which
  improves consistency and means you never have to wonder whether
  there might be a better name for it.
- `SubresourceIntegrityPlugin`, while more verbose, more clearly
  communicates what the plugin does compared to the previously
  suggested name `SriPlugin`.
- [API Extractor](https://api-extractor.com/) doesn't like `export =`
  in Typescript files, and `export default` doesn't necessarily
  translate well into Javascript land.
- A nice side effect is that changing the import will get more people
  to read this very document and revisit their settings.

### Missing integrity errors

We're working hard to ensure that this plugin will calculate and emit
integrity values for _all_ chunks.  However, due to the complexity of
Webpack and its ecosystem, this has not always been possible.  The
question is, what to do in the rare case when integrity for a chunk
cannot be determined?

Version 1.x chose to emit a warning in this case.  The problem with
this approach is that a whole site's integrity checks are only as
strong as the weakest link.  For example, if the asset store is
compromised then it's not necessary for _all_ assets to be
unprotected; a _single_ unprotected asset can be enough opportunity
for deploying a malicious payload.

Therefore, beginning in version 5, an error is emitted instead of a
warning when this plugin cannot determine a chunk's integrity at build
time, to force you to either fix the underlying problem or disable the
plugin, rather than giving you a false sense of security.

There is no way to emulate the previous behaviour. If you run into
this error, you're better off disabling this plugin entirely until the
bug is resolved in order to avoid a false sense of security.
