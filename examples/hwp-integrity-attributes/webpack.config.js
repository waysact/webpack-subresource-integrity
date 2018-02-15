var SriPlugin = require('webpack-subresource-integrity');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var createExtractTextLoader = require('../utils').createExtractTextLoader;

module.exports = {
  entry: './index.js',
  output: {
    filename: 'bundle.js',
    crossOriginLoading: 'anonymous'
  },
  module: {
    loaders: [{ test: /\.css$/, loader: createExtractTextLoader() }]
  },
  plugins: [
    new HtmlWebpackPlugin({ hash: true }),
    new ExtractTextPlugin('styles.css'),
    new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
  ]
};
