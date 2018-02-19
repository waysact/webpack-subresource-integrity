var SriPlugin = require('webpack-subresource-integrity');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var createExtractTextLoader = require('../utils').createExtractTextLoader;

module.exports = {
  entry: './index.js',
  output: {
    filename: 'bundle.js'
  },
  module: {
    loaders: [{ test: /\.css$/, loader: createExtractTextLoader() }]
  },
  plugins: [
    new ExtractTextPlugin('styles.css'),
    new SriPlugin({ hashFuncNames: ['sha256'], enabled: false })
  ]
};
