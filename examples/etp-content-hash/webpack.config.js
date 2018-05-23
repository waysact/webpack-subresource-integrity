var SriPlugin = require('webpack-subresource-integrity');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var createExtractTextLoader = require('../utils').createExtractTextLoader;
var webpackVersionMajMin = require('webpack/package.json')
  .version.split('.')
  .map(Number);

// https://github.com/webpack-contrib/extract-text-webpack-plugin/issues/763
const placeholder =
  webpackVersionMajMin[0] > 4 ||
  (webpackVersionMajMin[0] === 4 && webpackVersionMajMin[1] >= 3)
    ? 'md5:contenthash:hex:20'
    : 'contenthash';

module.exports = {
  entry: './index.js',
  output: {
    filename: 'bundle.js',
    crossOriginLoading: 'anonymous'
  },
  module:
    webpackVersionMajMin[0] > 1
      ? { rules: [{ test: /\.css$/, use: createExtractTextLoader() }] }
      : { loaders: [{ test: /\.css$/, loader: createExtractTextLoader() }] },
  plugins: [
    new HtmlWebpackPlugin({
      hash: true,
      inject: false,
      filename: 'index.html',
      template: 'index.ejs'
    }),
    new ExtractTextPlugin('bundle.css?[' + placeholder + ']'),
    new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
  ]
};
