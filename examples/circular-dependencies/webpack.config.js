var SriPlugin = require('webpack-subresource-integrity');
var webpack = require('webpack');

module.exports = {
  entry: {
    chunk1: ['./chunk1.js'],
    chunk2: ['./chunk2.js']
  },
  output: {
    filename: '[name].js',
    crossOriginLoading: 'anonymous'
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: 'chunk1',
      chunks: ['chunk2']
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'chunk2',
      chunks: ['chunk1']
    }),
    new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
  ]
};
