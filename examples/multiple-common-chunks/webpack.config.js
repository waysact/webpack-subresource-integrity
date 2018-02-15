var SriPlugin = require('webpack-subresource-integrity');
var webpack = require('webpack');

module.exports = {
  entry: {
    pageA: './pageA.js',
    pageB: './pageB.js'
  },
  output: {
    filename: '[name].js',
    crossOriginLoading: 'anonymous'
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: 'commons1',
      chunks: ['pageA']
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'commons2',
      chunks: ['pageB']
    }),
    new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
  ]
};
