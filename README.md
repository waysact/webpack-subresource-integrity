# webpack-subresource-integrity

[![npm version](https://badge.fury.io/js/webpack-subresource-integrity.svg)](https://badge.fury.io/js/webpack-subresource-integrity) [![Travis Build Status](https://travis-ci.org/waysact/webpack-subresource-integrity.svg?branch=master)](https://travis-ci.org/waysact/webpack-subresource-integrity) [![Appveyor Build Status](https://ci.appveyor.com/api/projects/status/63bydfph00sghg18/branch/master?svg=true)](https://ci.appveyor.com/project/jscheid/webpack-subresource-integrity) [![Coverage Status](https://coveralls.io/repos/github/waysact/webpack-subresource-integrity/badge.svg)](https://coveralls.io/github/waysact/webpack-subresource-integrity) [![Dependency Status](https://www.versioneye.com/user/projects/587755bd3c8039003a1c358f/badge.svg?style=flat-square)](https://www.versioneye.com/user/projects/587755bd3c8039003a1c358f) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/waysact/webpack-subresource-integrity/master/LICENSE)

Webpack plugin for enabling Subresource Integrity.

[Subresource Integrity](http://www.w3.org/TR/SRI/) (SRI) is a security
feature that enables browsers to verify that files they fetch (for
example, from a CDN) are delivered without unexpected
manipulation.

## Features

- Optional integration with [html-webpack-plugin](https://github.com/ampedandwired/html-webpack-plugin)
- Support for code splitting (integrity for lazy-loaded chunks)
- Compatible with Webpack 1.x and 2.x

## Installation

```shell
npm install webpack-subresource-integrity --save-dev
```

### Webpack Configuration Example

```javascript
import SriPlugin from 'webpack-subresource-integrity';

const compiler = webpack({
    output: {
        crossOriginLoading: 'anonymous',
    },
    plugins: [
        new SriPlugin({
            hashFuncNames: ['sha256', 'sha384'],
            enabled: process.env.NODE_ENV === 'production',
        }),
    ],
});
```

### Setting the `integrity` attribute for top-level assets

For the plugin to take effect it is **essential** that you set the
`integrity` attribute for top-level assets (i.e. assets loaded by your
HTML pages.)

#### With HtmlWebpackPlugin

When html-webpack-plugin is injecting assets into the template (the
default), the `integrity` attribute will be set automatically.  The
`crossorigin` attribute will be set as well, to the value of
`output.crossOriginLoading` webpack option. There is nothing else to
be done.

#### With HtmlWebpackPlugin({ inject: false })

When you use html-webpack-plugin with `inject: false`, you are
required to set the `integrity` and `crossorigin` attributes in your
template as follows:

```ejs
<% for (var index in htmlWebpackPlugin.files.js) { %>
  <script
     src="<%= htmlWebpackPlugin.files.js[index] %>"
     integrity="<%= htmlWebpackPlugin.files.jsIntegrity[index] %>"
     crossorigin="<%= webpackConfig.output.crossOriginLoading %>"
  ></script>
<% } %>

<% for (var index in htmlWebpackPlugin.files.css) { %>
  <link
     rel="stylesheet"
     href="<%= htmlWebpackPlugin.files.css[index] %>"
     integrity="<%= htmlWebpackPlugin.files.cssIntegrity[index] %>"
     crossorigin="<%= webpackConfig.output.crossOriginLoading %>"
  />
<% } %>
```

#### Without HtmlWebpackPlugin

The correct value for the `integrity` attribute can be retrieved from
the `integrity` property of Webpack assets.  However, that property is
not copied over by Webpack's `stats` module so you'll have to access
the "original" asset on the `compilation` object.  For example:

```javascript
compiler.plugin("done", stats => {
    const mainAssetName = stats.toJson().assetsByChunkName.main;
    const integrity = stats.compilation.assets[mainAssetName].integrity;
});
```

Note that you're also required to set the `crossorigin` attribute.  It
is recommended to set this attribute to the same value as the webpack
`output.crossOriginLoading` configuration option.

### Web Server Configuration

If your page can be loaded through plain HTTP (as opposed to HTTPS),
you must set the `Cache-Control: no-transform` response header or your
page will break when assets are loaded through a transforming
proxy.  [See below](#proxies) for more information.

### Options

#### hashFuncNames

Required option, no default value.

An array of strings, each specifying the name of a hash function to be
used for calculating integrity hash values.  For example, `['sha256',
'sha512']`.

See [SRI: Cryptographic hash functions](http://www.w3.org/TR/SRI/#cryptographic-hash-functions)

#### enabled

Default value: `true`

When this value is falsy, the plugin doesn't run and no integrity
values are calculated. It is recommended to disable the plugin in
development mode.

## Caveats

### Proxies

By its very nature, SRI can cause your page to break when assets are
modified by a proxy.  This is because SRI doesn't distinguish between
malicious and benevolent modifications: any modification will prevent
an asset from being loaded.

Notably, this issue can arise when your page is loaded through
[Chrome Data Saver](https://developer.chrome.com/multidevice/data-compression).

This is only a problem when your page can be loaded with plain HTTP,
since proxies are incapable of modifying encrypted HTTPS responses.

Presumably, you're looking to use SRI because you're concerned about
security and thus your page is only served through HTTPS anyway.
However, if you really need to use SRI and HTTP together, you should
set the `Cache-Control: no-transform` response header.  This will
instruct all well-behaved proxies (including Chrome Data Saver) to
refrain from modifying the assets.

### Browser support

Browser support for SRI is currently patchy.  Your page will still
work on browsers without support for SRI, but subresources won't be
protected from tampering.

See [Can I use Subresource Integrity?](http://caniuse.com/#feat=subresource-integrity)

### Broken browser versions

There is a
[known bug relating to SRI in Chrome 45 and 46](https://code.google.com/p/chromium/issues/detail?id=527286)
which will break loading of scripts containing certain UTF-8
characters. You might want to hold off using SRI if you need to
support these Chrome versions. (Unfortunately, by some measures
Chrome 45 still
[holds a relatively high market share](https://www.netmarketshare.com/report.aspx?qprid=3&qpaf=&qpcustom=Chrome+45.0&qpcustomb=0)
of around 5% at the time of this writing.)

### Hot Module Replacement

Chunks loaded via Hot Module Replacement (HMR) are not currently
protected.  This shouldn't be a problem because HMR is usually used
only in development mode where SRI is not normally needed.

## Further Reading

- [MDN: Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)

## License

Copyright (c) 2015-2017 Waysact Pty Ltd

MIT (see [LICENSE](LICENSE))
