var SriPlugin = require('webpack-subresource-integrity');
var WebpackAssetsManifest = require('webpack-assets-manifest');

module.exports = {
  entry: {
    index: './index.js'
  },
  output: {
    crossOriginLoading: 'anonymous'
  },
  plugins: [
    new SriPlugin({
      hashFuncNames: ['sha384', 'sha512'],
      enabled: true
    }),
    new WebpackAssetsManifest({ integrity: true })
  ]
};
