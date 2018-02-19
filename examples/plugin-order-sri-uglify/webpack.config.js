var SriPlugin = require('webpack-subresource-integrity');
var webpack = require('webpack');

module.exports = {
  entry: './index.js',
  output: {
    filename: 'bundle.js',
    crossOriginLoading: 'anonymous'
  },
  plugins: [
    new SriPlugin({ hashFuncNames: ['sha256'] }),
    new webpack.optimize.UglifyJsPlugin()
  ]
};
