var SriPlugin = require('webpack-subresource-integrity');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path');

module.exports = {
  entry: {
    main: './index.js'
  },
  output: {
    path: path.resolve('./dist/sub'),
    filename: 'bundle.js',
    publicPath: '/',
    crossOriginLoading: 'anonymous'
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: '../index.html',
      chunks: ['main']
    }),
    new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
  ]
};
