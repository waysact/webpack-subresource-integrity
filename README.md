# webpack-subresource-integrity

[![npm version](https://badge.fury.io/js/webpack-subresource-integrity.svg)](https://badge.fury.io/js/webpack-subresource-integrity) [![Build Status](https://travis-ci.org/waysact/webpack-subresource-integrity.svg?branch=master)](https://travis-ci.org/waysact/webpack-subresource-integrity) [![Dependency Status](https://david-dm.org/waysact/webpack-subresource-integrity.svg)](https://david-dm.org/waysact/webpack-subresource-integrity) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/waysact/webpack-subresource-integrity/master/LICENSE)

Webpack plugin for enabling Subresource Integrity.

[Subresource Integrity](http://www.w3.org/TR/SRI/) (SRI) is a security
feature that enables browsers to verify that files they fetch (for
example, from a CDN) are delivered without unexpected
manipulation.

## Features

- Integration with [html-webpack-plugin](https://github.com/ampedandwired/html-webpack-plugin)
- Support for code-splitting (integrity for lazy-loaded chunks)

## Installation

```shell
npm install webpack-subresource-integrity --save-dev
```

### Webpack Configuration Example

```javascript
import SriPlugin from 'webpack-subresource-integrity';

const compiler = webpack({
    plugins: [
        new SriPlugin({
            hashFuncNames: ['sha256', 'sha384'],
            enabled: process.env.NODE_ENV === 'production',
            crossorigin: 'anonymous',
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
default), the `integrity` attribute will be set automatically.  There
is nothing else to be done.

#### With HtmlWebpackPlugin({ inject: false })

When you use html-webpack-plugin with `inject: false`, you are
required to set the `integrity` and `crossorigin` attributes in your
template as follows:

```ejs
<% for (var index in htmlWebpackPlugin.files.js) { %>
  <script
     src="<%= htmlWebpackPlugin.files.js[index] %>"
     integrity="<%= htmlWebpackPlugin.files.jsIntegrity[index] %>"
     crossorigin="<%= htmlWebpackPlugin.options.sriCrossOrigin %>"
  ></script>
<% } %>

<% for (var index in htmlWebpackPlugin.files.css) { %>
  <link
     href="<%= htmlWebpackPlugin.files.css[index] %>"
     integrity="<%= htmlWebpackPlugin.files.cssIntegrity[index] %>"
     crossorigin="<%= htmlWebpackPlugin.options.sriCrossOrigin %>"
     rel="stylesheet"
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

#### crossorigin

Default value: `"anonymous"`

When using `HtmlWebpackPlugin({ inject: true })`, this option
specifies the value to be used for the `crossorigin` attribute for
injected assets.

The value will also be available as
`htmlWebpackPlugin.options.sriCrossOrigin` in html-webpack-plugin
templates.

See
[SRI: Cross-origin data leakage](https://www.w3.org/TR/SRI/#cross-origin-data-leakage) and
[MDN: CORS settings attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes)

## Caveats

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
support these Chrome versions. (Unfortunately, Chrome 45 still
[holds a relatively high market share](https://www.netmarketshare.com/report.aspx?qprid=3&qpaf=&qpcustom=Chrome+45.0&qpcustomb=0)
of around 5% at the time of this writing.)

### Hot Module Replacement

Chunks loaded via Hot Module Replacement (HMR) are not currently
protected.  This shouldn't be a problem because HMR is usually used
only in development mode where SRI is not normally needed.

## Further Reading

- [MDN: Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)

## License

Copyright (c) 2015, 2016 Waysact Pty Ltd

MIT (see [LICENSE](LICENSE))
