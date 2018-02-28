var SriPlugin = require('webpack-subresource-integrity');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var createExtractTextLoader = require('../utils').createExtractTextLoader;
var path = require('path');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports = {
  entry: './index.js',
  output: {
    filename: 'bundle.js',
    crossOriginLoading: 'anonymous'
  },
  module:
    webpackVersion > 1
      ? { rules: [{ test: /\.css$/, use: createExtractTextLoader() }] }
      : { loaders: [{ test: /\.css$/, loader: createExtractTextLoader() }] },
  plugins: [
    new HtmlWebpackPlugin({
      hash: true,
      inject: false,
      filename: 'index.html',
      template: './index.ejs'
    }),
    new ExtractTextPlugin(path.join('output', 'bundle.css')),
    new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
  ]
};
