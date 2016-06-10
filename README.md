# webpack-subresource-integrity

[![Build Status](https://travis-ci.org/waysact/webpack-subresource-integrity.svg?branch=master)](https://travis-ci.org/waysact/webpack-subresource-integrity)

A Webpack plugin for ensuring
[subresource integrity](http://www.w3.org/TR/SRI/).

Integrity is ensured automatically for lazy-loaded chunks (loaded via
`require.ensure`) on browsers that have
[support for SRI](http://caniuse.com/#feat=subresource-integrity).

It's your responsibility to include the `integrity` attribute in the
HTML for top-level chunks.  Obviously, SRI for lazy-loaded chunks is
pointless unless integrity of the top-level chunks is ensured as well.

## Usage

### Installing the Plugin

Pass an array of
[hash algorithms](http://www.w3.org/TR/SRI/#cryptographic-hash-functions)
to the plugin constructor:

    import SriPlugin from 'webpack-subresource-integrity';

    const compiler = webpack({
        plugins: [
            // ...
            new SriPlugin(['sha256', 'sha384']),
        ],
    });

### Accessing the `integrity` Value for Top-level Assets

The correct value for the `integrity` attribute can be retrieved from
the `integrity` property of webpack assets.  However, that property is
not copied over by webpack's stats module so you'll have to access the
"original" asset on the `compilation` object.  Something like this:

    compiler.plugin("done", stats => {
        var integrity = stats.compilation.assets[stats.toJson().assetsByChunkName.main].integrity;
    });

Use that value to generate the `<script>` and `<link>` tags in your
initial DOM.

## Caveats

* There is a
  [known bug relating to SRI in Chrome versions before 47](https://code.google.com/p/chromium/issues/detail?id=527286)
  which will break loading of scripts containing certain UTF-8
  characters.  You might want to hold off using SRI if you need to
  support older Chrome versions.

## Contributing

If you have discovered a bug or have a feature suggestion, feel free to create an issue on Github.

Pull requests are welcome. Please run `npm test` and `npm run lint` on
your branch before submitting it.

You are also welcome to correct any spelling mistakes or any language issues.

## License

Copyright (c) 2015, 2016 Waysact Pty Ltd

MIT (see [`LICENSE`](LICENSE))
