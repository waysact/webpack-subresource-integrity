var SriPlugin = require('webpack-subresource-integrity');
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './a.js',
  output: {
    filename: '[name]-[hash]-[hash:4]-[id]-[query].js',
    chunkFilename:
      '[name]-[hash]-[chunkhash]-[hash:4]-[chunkhash:4]-[id]-[query].js',
    crossOriginLoading: 'anonymous'
  },
  plugins: [new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })]
};
