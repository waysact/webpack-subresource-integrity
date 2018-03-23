var SriPlugin = require('webpack-subresource-integrity');
var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    index: './index.js'
  },
  output: {
    crossOriginLoading: 'anonymous'
  },
  plugins: [
    new SriPlugin({
      hashFuncNames: ['sha256', 'sha384'],
      enabled: true
    }),
    new CopyWebpackPlugin([
      {
        from: 'asset.txt',
        to: 'asset_copy.txt'
      }
    ])
  ]
};
