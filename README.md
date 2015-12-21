# webpack-subresource-integrity

A Webpack plugin for ensuring
[subresource integrity](http://www.w3.org/TR/SRI/).

Integrity is ensured automatically for lazy-loaded chunks (loaded via
`require.ensure`) on browsers that have
[support for SRI](http://caniuse.com/#feat=subresource-integrity).

It's your responsibility to include the `integrity` attribute in the
HTML for top-level chunks.
[Obviously](https://en.wikipedia.org/wiki/Merkle_tree), SRI for
lazy-loaded chunks is pointless unless integrity of the top-level
chunks is ensured as well.

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

Use that value to generate the `<script>` and `<link
rel="stylesheet">` tags in your initial DOM.

## Caveats

* There is a
  [known bug relating to SRI in Chrome versions before 47](https://code.google.com/p/chromium/issues/detail?id=527286)
  which will break loading of scripts containing certain UTF-8
  characters.  You might want to hold off using SRI if you need to
  support older Chrome versions.

* This plugin uses some black magic and thus might break in arbitrary
  ways for future webpack releases, even point releases.  You have
  been warned.  Tested with webpack 1.12.9 and webpack-core 0.6.8.
